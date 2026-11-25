import { Effect, Latch, ManagedRuntime, Schema } from "effect";
import { act } from "react";
import { expect, it, onTestFinished, vi } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";
import { application } from "../src/app.vibe";
import { AccountActions } from "../src/graceAccount.vibe";
import { actOnScreen, browserBillingSnapshot, tabletView } from "./screen.tsx";
import "../src/main.css";

actOnScreen();

it('Redeem a membership code and reopen the Grace account (spec/app/setup.md, "A signed-in web account with an inactive subscription can redeem a membership code")', async () => {
  const original = location.href;
  history.replaceState(null, "", "#account");
  const account = { id: "membership-owner", email: "member@example.test" };
  const now = Date.now();
  const granted = { id: "grace-grant", effectiveFrom: now, effectiveUntil: now + 183 * 86400000 };
  let grant: typeof granted | null = null;
  const Redemption = Schema.Struct({ code: Schema.String, idempotencyKey: Schema.NonEmptyString });
  const readRedemption = Schema.decodeUnknownSync(Redemption);
  const redemption: Array<typeof Redemption.Type> = [];
  const charges: string[] = [];
  const network = window.fetch.bind(window);
  const service = vi.spyOn(window, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input, location.href);
    switch (url.pathname) {
      case "/api/auth/session": return Response.json({ account });
      case "/api/v1/eliza/google/status": return Response.json({ accountId: account.id, provider: "google", side: "owner", mode: "cloud_managed", configured: false, connected: false, grantedCapabilities: [], identity: null });
      case "/api/v1/billing/limits": return Response.json(browserBillingSnapshot(grant));
      case "/api/v1/subscriptions/plans": return Response.json({ plans: [{ key: "plus_monthly" }] });
      case "/api/v1/subscriptions/checkout":
        charges.push(url.pathname);
        return new Response(null, { status: 503 });
      case "/api/v1/subscription/redeem": {
        const submitted: unknown = await new Response(init?.body).json();
        redemption.push(readRedemption(submitted));
        if (redemption.length === 1) return Response.json({ error: "grant_code_invalid" }, { status: 400 });
        grant = granted;
        const { data } = browserBillingSnapshot(grant);
        return Response.json({ replayed: false, grant: data.grant, entitlement: { plan: data.plan } });
      }
      default: return network(input, init);
    }
  });
  onTestFinished(() => { service.mockRestore(); history.replaceState(null, "", original); });
  const first = tabletView(ManagedRuntime.make(application(undefined)));
  try {
    await first.render();
    const code = page.getByRole("textbox", { name: "Membership code" });
    const redeem = page.getByRole("button", { name: "Redeem code" });
    await act(() => userEvent.fill(code, "FFFF-FFFF-FFFF-FFFF"));
    await act(() => userEvent.click(redeem));
    await expect.element(page.getByRole("alert")).toBeVisible();
    await expect.element(code).toHaveValue("FFFF-FFFF-FFFF-FFFF");
    await act(() => userEvent.fill(code, "1234-5678-90ab-cdef"));
    await act(() => userEvent.click(redeem));
    await expect.element(page.getByText("Active", { exact: true })).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Subscribe", exact: true })).not.toBeInTheDocument();
    expect(redemption.map(({ code }) => code)).toEqual(["FFFFFFFFFFFFFFFF", "1234567890ABCDEF"]);
    expect(new Set(redemption.map(({ idempotencyKey }) => idempotencyKey)).size).toBe(2);
    expect(charges).toEqual([]);
  } finally {
    await first.dispose();
  }
  const reopened = tabletView(ManagedRuntime.make(application(undefined)));
  onTestFinished(() => reopened.dispose());
  await reopened.render();
  await expect.element(page.getByText("Active", { exact: true })).toBeVisible();
  await expect.element(page.getByRole("button", { name: "Redeem code" })).not.toBeInTheDocument();
});

it('Retry tablet sign-in (spec/app/setup.md, "Story: Sign in to Grace and manage my subscription")', async () => {
  const original = location.href;
  const pending = sessionStorage.getItem("grace-device-sign-in");
  const challenge = "a".repeat(43);
  const state = "b".repeat(43);
  const destination = new URL(original);
  destination.searchParams.set("device_challenge", challenge);
  destination.searchParams.set("device_state", state);
  history.replaceState(null, "", destination);
  const callback = new URL("https://app.graceforseniors.com/android/auth/callback");
  callback.searchParams.set("state", state);
  callback.searchParams.set("code", "c".repeat(64));
  const proof = callback.pathname + callback.search;
  const ambiguous = new URL(callback);
  ambiguous.searchParams.append("code", "d".repeat(64));
  const rejectedRedirects = [
    new URL(proof, "http://localhost:5173"),
    new URL(proof, "https://elsewhere.example.test"),
    ambiguous,
  ];
  const returns: string[] = [];
  const returned = Latch.makeUnsafe();
  const browser = cdp();
  const captureReturn = async ({ request, requestId }: { request: { url: string }; requestId: string }) => {
    returns.push(request.url);
    await browser.send("Fetch.fulfillRequest", { requestId, responseCode: 204 });
    returned.openUnsafe();
  };
  browser.on("Fetch.requestPaused", captureReturn);
  let accountId = "tablet-owner";
  const authorizations: unknown[] = [];
  const authorizationArrived = Latch.makeUnsafe();
  let beforeReply: ((path: string) => Promise<void>) | undefined;
  const network = window.fetch.bind(window);
  const service = vi.spyOn(window, "fetch").mockImplementation(async (input, init) => {
    const path = typeof input === "string" ? new URL(input, location.href).pathname : "";
    await beforeReply?.(path);
    if (path === "/api/auth/session") return Response.json({ account: { id: accountId, email: accountId + "@example.test" } });
    if (path === "/api/v1/billing/limits") return Response.json(browserBillingSnapshot());
    if (path === "/api/v1/eliza/google/status") return Response.json({ accountId, provider: "google", side: "owner", mode: "cloud_managed", configured: false, connected: false, grantedCapabilities: [], identity: null });
    if (path !== "/api/auth/device/authorize") return network(input, init);
    authorizations.push(await new Response(init?.body).json());
    authorizationArrived.openUnsafe();
    if (authorizations.length === 1) return new Response(null, { status: 503 });
    return Response.json({ redirectUrl: (rejectedRedirects[authorizations.length - 2] ?? callback).href });
  });
  onTestFinished(async () => {
    browser.off("Fetch.requestPaused", captureReturn);
    service.mockRestore();
    history.replaceState(null, "", original);
    if (pending === null) sessionStorage.removeItem("grace-device-sign-in");
    else sessionStorage.setItem("grace-device-sign-in", pending);
    await browser.send("Fetch.disable");
  });
  await browser.send("Fetch.enable", { patterns: [{ urlPattern: "*/android/auth/callback*", resourceType: "Document" }] });
  let runtime = ManagedRuntime.make(application(undefined));
  let view = tabletView(runtime);
  onTestFinished(() => view.dispose());
  await view.render();

  const signIn = page.getByRole("button", { name: "Sign in on tablet" });
  const firstChoice = { challenge, state, expectedAccountId: accountId };
  await act(() => userEvent.click(signIn));
  await expect.element(page.getByRole("alert")).toBeVisible();
  await expect.element(signIn).toBeEnabled();
  const retries = [firstChoice];
  expect(authorizations).toEqual(retries);
  for (let retried = 0; retried < rejectedRedirects.length; retried++) {
    authorizationArrived.closeUnsafe();
    await act(() => userEvent.click(signIn));
    await Effect.runPromise(authorizationArrived.await);
    retries.push(firstChoice);
    expect(authorizations).toEqual(retries);
    await expect.element(page.getByRole("button", { name: "Cancel tablet sign-in" })).toBeVisible();
    await expect.element(signIn).toBeEnabled();
    expect(returns).toEqual([]);
  }

  accountId = "second-owner";
  await act(() => userEvent.click(signIn));
  await expect.element(page.getByText("Sign in on your tablet as second-owner@example.test?")).toBeVisible();
  expect(authorizations).toEqual(retries);
  await act(() => userEvent.click(signIn));
  await Effect.runPromise(returned.await);
  expect(returns).toEqual([callback.href]);
  expect(authorizations).toEqual([...retries, { challenge, state, expectedAccountId: accountId }]);
  await expect.element(signIn).not.toBeInTheDocument();
  const dispatched = [...returns];

  const cancel = page.getByRole("button", { name: "Cancel tablet sign-in" });
  const click = (name: string) => act(() => userEvent.click(page.getByRole("button", { name, exact: true })));
  for (const path of ["/api/auth/session", "/api/auth/device/authorize"]) {
    await view.dispose();
    const nextState = (path.endsWith("session") ? "e" : "f").repeat(43);
    destination.searchParams.set("device_state", nextState);
    callback.searchParams.set("state", nextState);
    history.replaceState(null, "", destination);
    runtime = ManagedRuntime.make(application(undefined));
    view = tabletView(runtime);
    await view.render();
    await expect.element(signIn).toBeEnabled();
    const sent = authorizations.length;
    const arrived = Latch.makeUnsafe();
    const reply = Latch.makeUnsafe();
    beforeReply = async (requested) => {
      if (requested !== path) return;
      beforeReply = undefined;
      arrived.openUnsafe();
      await Effect.runPromise(reply.await);
    };
    try {
      await act(() => userEvent.click(signIn));
      await Effect.runPromise(arrived.await);
      await expect.element(signIn).toBeDisabled();
      await expect.element(cancel).toBeEnabled();
      if (path.endsWith("authorize")) {
        await click("Text size");
        await expect.element(cancel).not.toBeInTheDocument();
        await click("Account");
      }
      await act(() => userEvent.click(cancel));
      await expect.element(cancel).not.toBeInTheDocument();
    } finally {
      beforeReply = undefined;
      reply.openUnsafe();
    }
    await act(() => runtime.runPromise(Effect.flatMap(AccountActions, (actions) => actions.run({ kind: "refresh" }))));
    await expect.element(page.getByRole("button", { name: "Sign out", exact: true })).toBeEnabled();
    expect(authorizations.slice(sent)).toEqual(path.endsWith("session") ? [] : [{ challenge, state: nextState, expectedAccountId: accountId }]);
    expect(returns).toEqual(dispatched);
    expect(page.getByRole("alert").query()).toBeNull();
  }
});

it('Clear an unverified tablet sign-in before signing in again (spec/app/setup.md, "Story: Sign in to Grace and manage my subscription")', async () => {
  let needsCleanup = false;
  let cleanupAttempts = 0;
  const signInAttempts: unknown[] = [];
  const runtime = ManagedRuntime.make(application(undefined, undefined, {
    native: true,
    account: {
      status: () => Promise.resolve(needsCleanup ? { kind: "signedOut", legacySignInNeedsCleanup: true } : { kind: "signedOut" }),
      cleanupLegacySignIn: () => {
        cleanupAttempts += 1;
        if (cleanupAttempts === 1) return Promise.reject(new Error("Cloud is unreachable"));
        needsCleanup = false;
        return Promise.resolve();
      },
      beginSignIn: (options) => {
        signInAttempts.push(options);
        if (signInAttempts.length === 1) {
          needsCleanup = true;
          return Promise.reject(new Error("The previous credential was rejected"));
        }
        return Promise.resolve();
      },
      signOut: () => Promise.reject(new Error("Legacy cleanup must use its dedicated action")),
      manageAccount: () => Promise.reject(new Error("An unverified owner cannot manage an account")),
      addListener: () => Promise.resolve({ remove: () => Promise.resolve() }),
    },
  }));
  const view = tabletView(runtime);
  onTestFinished(view.dispose);
  await view.render();

  const button = (name: string) => page.getByRole("button", { name, exact: true });
  await act(() => userEvent.click(button("Settings")));
  await act(() => userEvent.click(button("Account")));
  const clear = button("Clear old sign-in");
  const confirm = button("Confirm clearing old sign-in");
  await act(() => userEvent.click(button("Sign in to Grace")));
  await expect.element(clear).toBeEnabled();
  await expect.element(button("Sign in to Grace")).not.toBeInTheDocument();
  await expect.element(button("Manage Grace account")).not.toBeInTheDocument();
  await act(() => userEvent.click(clear));
  await act(() => userEvent.click(button("Cancel")));
  await expect.element(clear).toBeEnabled();
  expect(cleanupAttempts).toBe(0);

  await act(() => userEvent.click(clear));
  await act(() => userEvent.click(confirm));
  await expect.element(page.getByRole("alert")).toBeVisible();
  expect(cleanupAttempts).toBe(1);
  await act(() => userEvent.click(confirm));
  await expect.element(clear).not.toBeInTheDocument();
  await act(() => userEvent.click(button("Other sign-in options")));
  expect(signInAttempts).toEqual([undefined, { method: "browser" }]);
  expect(cleanupAttempts).toBe(2);
});

it('Keep the old account while upgrading mail access (spec/app/setup.md, "An enrolled tablet offers one sign-in to update mail and calendar access")', async () => {
  let phase: "hosted" | "required" | "signInPending" | "acknowledgmentPending" | undefined = "hosted";
  const accountId = "enrolled-tablet";
  let leaseVersion = "acknowledged";
  const grantId = "connected-google";
  const destination = "https://mail-link.example.test/appointment";
  let returnedGrant = grantId;
  let historyId = "510";
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  let labels = ["SPAM"];
  const mail = { externalId: "welcome", from: "Ana", subject: "Mail kept after sign-in", receivedAt: now.toISOString(), isUnread: true };
  const appointment = { externalId: "checkup", title: "Calendar kept after sign-in", description: "Bring your notes.",
    location: "Clinic", startAt: start.toISOString(), endAt: new Date(start.getTime() + 3600000).toISOString(), isAllDay: false, editable: true, etag: "confirmed" };
  const status = () => ({
    kind: "signedIn" as const,
    voiceDisclosureScope: "existing-owner",
    ...(phase === undefined ? { mailLease: { accountId, leaseVersion } } : phase === "hosted" ? {} : { mailLeaseUpgrade: phase }),
  });
  const reads: string[] = [];
  const result = (body: unknown) => Promise.resolve({ status: 200, body: JSON.stringify(body) });
  let notify: ((value: ReturnType<typeof status>) => void) | undefined;
  const browserAttempt = Latch.makeUnsafe();
  const begin = vi.fn(() => {
    phase = "signInPending";
    notify?.(status());
    return Effect.runPromise(browserAttempt.await);
  });
  const cancel = vi.fn(() => {
    phase = "required";
    notify?.(status());
    browserAttempt.openUnsafe();
    return Promise.resolve();
  });
  const runtime = ManagedRuntime.make(application(undefined, undefined, {
    native: true,
    account: {
      status: () => Promise.resolve(status()),
      beginSignIn: () => Promise.reject(new Error("Upgrade must use the dedicated action")),
      beginLeaseUpgrade: begin,
      cancelLeaseUpgrade: cancel,
      readGoogle: (input) => {
        expect(phase).toBeUndefined();
        expect(input).toMatchObject({ accountId, leaseVersion });
        reads.push(input.route);
        if (input.route === "status") return result({
          accountId, provider: "google", side: "owner", mode: "cloud_managed", configured: true, connected: true,
          identity: { email: "reader@example.test" }, connectionId: returnedGrant,
          grantedCapabilities: ["google.gmail.triage", "google.calendar.read", "google.gmail.send", "google.gmail.trash", "google.calendar.write"],
        });
        expect(input.query.grantId).toBe(grantId);
        if (input.route === "gmail/triage") return result({ accountId, messages: [mail], nextPageToken: null });
        if (input.route === "gmail/read") {
          expect(input.query.messageId).toBe(mail.externalId);
          return result({ accountId, message: { ...mail, labels }, historyId, attachments: [], bodyTextAvailable: true, bodyText: `The original message stayed linked. ${destination}` });
        }
        return result({ accountId, events: [appointment], nextPageToken: null });
      },
      cleanupLegacySignIn: () => Promise.reject(new Error("The current account is already verified")),
      signOut: () => Promise.reject(new Error("Upgrade must retain the current account")),
      manageAccount: () => Promise.resolve(),
      addListener: (_, listener) => {
        notify = listener;
        return Promise.resolve({ remove: () => Promise.resolve() });
      },
    },
  }));
  const view = tabletView(runtime);
  onTestFinished(() => {
    browserAttempt.openUnsafe();
    return view.dispose();
  });
  await view.render();

  const button = (name: string) => page.getByRole("button", { name, exact: true });
  const click = (name: string) => act(() => userEvent.click(button(name)));
  const open = (title: "Email" | "Calendar") => act(() => userEvent.click(
    page.getByRole("button", { name: new RegExp(`^${title}(?:$| )`) })));
  await open("Email");
  await expect.element(button("Open Grace")).toBeEnabled();
  expect(reads).toEqual([]);
  await act(() => {
    phase = "required";
    notify?.(status());
    return Promise.resolve();
  });
  await expect.element(button("Go to Account")).toBeEnabled();
  await click("Go to Account");
  await expect.element(button("Sign in again")).toBeEnabled();
  expect(reads).toEqual([]);
  expect(begin).not.toHaveBeenCalled();

  await click("Sign in again");
  await expect.element(button("Cancel")).toBeEnabled();
  expect(begin).toHaveBeenCalledTimes(1);
  await click("Cancel");
  await expect.element(button("Sign in again")).toBeEnabled();
  await expect.element(button("Manage Grace account")).toBeEnabled();
  expect(cancel).toHaveBeenCalledTimes(1);

  browserAttempt.closeUnsafe();
  await click("Sign in again");
  await expect.element(button("Cancel")).toBeEnabled();
  await act(() => {
    phase = "acknowledgmentPending";
    notify?.(status());
    return Promise.resolve();
  });
  await expect.element(button("Cancel")).not.toBeInTheDocument();
  await expect.element(button("Sign in again")).not.toBeInTheDocument();
  await act(() => {
    phase = undefined;
    notify?.(status());
    browserAttempt.openUnsafe();
    return Promise.resolve();
  });
  await expect.element(button("Manage Grace account")).toBeEnabled();
  await expect.element(button("Sign in again")).not.toBeInTheDocument();
  await click("Close Settings");
  await act(() => userEvent.click(page.getByRole("button", { name: /Mail kept after sign-in/ })));
  await expect.element(page.getByText(/The original message stayed linked/)).toBeVisible();
  await expect.element(button("Move to Trash")).not.toBeInTheDocument();
  await click("Home");
  await open("Calendar");
  await act(() => userEvent.click(page.getByRole("button", { name: /Calendar kept after sign-in/ })));
  await expect.element(page.getByText("Bring your notes.")).toBeVisible();
  await expect.element(button("Change appointment")).not.toBeInTheDocument();
  await click("Home");
  await open("Email");
  await act(() => userEvent.click(page.getByRole("button", { name: /Mail kept after sign-in/ })));
  const link = page.getByRole("link", { name: destination, exact: true });
  const warning = page.getByRole("dialog", { name: "Open this link?" });
  const address = page.getByRole("textbox", { name: "Address", exact: true });
  await expect.element(link).toBeVisible();
  historyId = "511";
  await act(() => userEvent.click(link));
  await expect.element(page.getByText(/This link couldn’t open/)).toBeVisible();
  await expect.element(warning).not.toBeInTheDocument();
  await expect.element(address).not.toBeInTheDocument();

  historyId = "510";
  await act(() => userEvent.click(link));
  await expect.element(warning.getByText(destination)).toBeVisible();
  await click("Stay in email");
  await expect.element(warning).not.toBeInTheDocument();
  await expect.element(address).not.toBeInTheDocument();

  await act(() => userEvent.click(link));
  await expect.element(warning).toBeVisible();
  returnedGrant = "replaced-google";
  await click("Open in Browser");
  await expect.element(page.getByText(/This link couldn’t open/)).toBeVisible();
  await expect.element(address).not.toBeInTheDocument();

  returnedGrant = grantId;
  await act(() => userEvent.click(link));
  await expect.element(warning).toBeVisible();
  await click("Open in Browser");
  await expect.element(address).toHaveValue(destination);
  await click("Home");
  await open("Email");
  await act(() => userEvent.click(page.getByRole("button", { name: /Mail kept after sign-in/ })));
  await act(() => userEvent.click(link));
  await expect.element(warning).toBeVisible();
  await act(() => {
    labels = [];
    leaseVersion = "renewed-acknowledgment";
    notify?.(status());
    return Promise.resolve();
  });
  await expect.element(warning).not.toBeInTheDocument();
  await expect.element(address).not.toBeInTheDocument();
  await act(() => userEvent.click(page.getByRole("button", { name: /Mail kept after sign-in/ })));
  await act(() => userEvent.click(link));
  await expect.element(address).toHaveValue(destination);
  expect(new Set(reads)).toEqual(new Set(["status", "gmail/triage", "gmail/read", "calendar/feed"]));
});

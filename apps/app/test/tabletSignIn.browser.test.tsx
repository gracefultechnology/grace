import { Effect, Latch, ManagedRuntime } from "effect";
import { act } from "react";
import { expect, it, onTestFinished, vi } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";
import { application } from "../src/app.vibe";
import { AccountActions } from "../src/graceAccount.vibe";
import { actOnScreen, tabletView } from "./screen.tsx";
import "../src/main.css";

actOnScreen();

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
    if (path === "/api/v1/billing/subscription") return Response.json({ status: "inactive", canManage: false, canCheckout: false });
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
  let phase: "required" | "signInPending" | "acknowledgmentPending" | undefined = "required";
  const status = () => ({
    kind: "signedIn" as const,
    voiceDisclosureScope: "existing-owner",
    ...(phase === undefined ? {} : { mailLeaseUpgrade: phase }),
  });
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
  await click("Settings");
  await click("Account");
  await expect.element(button("Sign in again")).toBeEnabled();
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
  await act(async () => {
    phase = "acknowledgmentPending";
    notify?.(status());
  });
  await expect.element(button("Cancel")).not.toBeInTheDocument();
  await expect.element(button("Sign in again")).not.toBeInTheDocument();
  await act(async () => {
    phase = undefined;
    notify?.(status());
    browserAttempt.openUnsafe();
  });
  await expect.element(button("Manage Grace account")).toBeEnabled();
  await expect.element(button("Sign in again")).not.toBeInTheDocument();
});

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
  const loopback = new URL(callback.pathname + callback.search, "http://localhost:5173");
  const ambiguous = new URL(callback);
  ambiguous.searchParams.append("code", "d".repeat(64));
  const returns: string[] = [];
  const browser = cdp();
  const captureReturn = async ({ request, requestId }: { request: { url: string }; requestId: string }) => {
    returns.push(request.url);
    await browser.send("Fetch.fulfillRequest", { requestId, responseCode: 204 });
  };
  browser.on("Fetch.requestPaused", captureReturn);
  let accountId = "tablet-owner";
  const authorizations: unknown[] = [];
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
    if (authorizations.length === 1) return new Response(null, { status: 503 });
    if (authorizations.length === 2) return Response.json({ redirectUrl: loopback.href });
    return Response.json({ redirectUrl: authorizations.length === 3 ? ambiguous.href : callback.href });
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
  await act(() => userEvent.click(signIn));
  await expect.element(page.getByRole("alert")).toBeVisible();
  await expect.element(signIn).toBeEnabled();
  await act(() => userEvent.click(signIn));
  const firstChoice = { challenge, state, expectedAccountId: accountId };
  await expect.poll(() => authorizations, { timeout: 15000 }).toEqual([firstChoice, firstChoice]);
  await expect.element(page.getByRole("button", { name: "Cancel tablet sign-in" })).toBeVisible();
  await expect.element(signIn).toBeEnabled();
  expect(returns).toEqual([]);
  await act(() => userEvent.click(signIn));
  const retries = [firstChoice, firstChoice, firstChoice];
  await expect.poll(() => authorizations, { timeout: 15000 }).toEqual(retries);
  await expect.element(signIn).toBeEnabled();
  expect(returns).toEqual([]);

  accountId = "second-owner";
  await act(() => userEvent.click(signIn));
  await expect.element(page.getByText("Sign in on your tablet as second-owner@example.test?")).toBeVisible();
  expect(authorizations).toEqual(retries);
  await act(() => userEvent.click(signIn));
  await expect.poll(() => returns).toEqual([callback.href]);
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

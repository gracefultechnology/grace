import { ManagedRuntime } from "effect";
import { act } from "react";
import { expect, it, onTestFinished, vi } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";
import { application } from "../src/app.vibe";
import { actOnScreen, mount } from "./screen.tsx";
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
  const network = window.fetch.bind(window);
  const service = vi.spyOn(window, "fetch").mockImplementation(async (input, init) => {
    const path = typeof input === "string" ? new URL(input, location.href).pathname : "";
    if (path === "/api/auth/session") return Response.json({ account: { id: accountId, email: accountId + "@example.test" } });
    if (path !== "/api/auth/device/authorize") return network(input, init);
    authorizations.push(await new Response(init?.body).json());
    if (authorizations.length === 1) return new Response(null, { status: 503 });
    if (authorizations.length === 2) return Response.json({ redirectUrl: "https://elsewhere.example.test/android/auth/callback" });
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
  await mount(ManagedRuntime.make(application(undefined)));

  const signIn = page.getByRole("button", { name: "Sign in on tablet" });
  await act(() => userEvent.click(signIn));
  await expect.element(page.getByRole("alert")).toBeVisible();
  await act(() => userEvent.click(signIn));
  const firstChoice = { challenge, state, expectedAccountId: accountId };
  await expect.poll(() => authorizations).toEqual([firstChoice, firstChoice]);
  await expect.element(page.getByRole("button", { name: "Cancel tablet sign-in" })).toBeVisible();
  await act(() => userEvent.click(signIn));
  const retries = [firstChoice, firstChoice, firstChoice];
  await expect.poll(() => authorizations).toEqual(retries);
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
});

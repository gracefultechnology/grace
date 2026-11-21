import { ManagedRuntime } from "effect";
import { act } from "react";
import { expect, it, onTestFinished, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { application } from "../src/app.vibe";
import { actOnScreen, mount } from "./screen.tsx";
import "../src/main.css";

actOnScreen();

it('Sign in on the tablet again after a failed attempt (spec/app/setup.md, "Story: Sign in to Grace and manage my subscription"; spec/app/setup.md, "Subscription actions belong to the Grace account that is signed in")', async () => {
  const original = location.href;
  const destination = new URL(original);
  destination.searchParams.set("device_challenge", "a".repeat(43));
  destination.searchParams.set("device_state", "b".repeat(43));
  history.replaceState(null, "", destination);
  const authorizations: unknown[] = [];
  const network = window.fetch.bind(window);
  const service = vi.spyOn(window, "fetch").mockImplementation(async (input, init) => {
    const path = typeof input === "string" ? new URL(input, location.href).pathname : "";
    if (path === "/api/auth/session") return Response.json({ account: { id: "tablet-owner", email: "tablet-owner@example.test" } });
    if (path !== "/api/auth/device/authorize") return network(input, init);
    authorizations.push(await new Response(init?.body).json());
    return authorizations.length === 1 ? new Response(null, { status: 503 }) : Response.json({ redirectUrl: "https://elsewhere.example.test/android/auth/callback" });
  });
  onTestFinished(() => {
    service.mockRestore();
    history.replaceState(null, "", original);
    sessionStorage.removeItem("grace-device-sign-in");
  });
  await mount(ManagedRuntime.make(application(undefined)));

  const signIn = page.getByRole("button", { name: "Sign in on tablet" });
  await act(() => userEvent.click(signIn));
  await expect.element(page.getByRole("alert")).toBeVisible();
  await act(() => userEvent.click(signIn));
  await expect.poll(() => authorizations).toEqual([
    { challenge: "a".repeat(43), state: "b".repeat(43), expectedAccountId: "tablet-owner" },
    { challenge: "a".repeat(43), state: "b".repeat(43), expectedAccountId: "tablet-owner" },
  ]);
  await expect.element(page.getByRole("button", { name: "Cancel tablet sign-in" })).toBeVisible();
});

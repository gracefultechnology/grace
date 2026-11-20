import { Effect, ManagedRuntime } from "effect";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, expect, onTestFinished } from "vitest";
import { page } from "vitest/browser";
import { type Accounts, allowedUse, chooseProvider, initial, type Provider, sheetResult } from "../gen/app__accounts.ts";
import { Machine as Setup } from "../gen/app__setup.effect.vibe";
import { application } from "../src/app.vibe";
import type { CloudLink } from "../src/conversation.vibe";
import { App } from "../src/App.tsx";
import type { Runtime } from "../src/useApp.ts";

const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

export function connected(accounts: Accounts, provider: Provider, address: string, name: string) {
  const chosen = chooseProvider(accounts, provider, "AccountPerson");
  return sheetResult(chosen, { attempt: chosen.signIn.attempt, outcome: "Allowed", address, granted: allowedUse }, name, "AccountConnector");
}

export const mountGmail = (address: string, cloud: CloudLink) => mountAccounts(connected(initial, "Gmail", address, "Gmail"), cloud);

export async function mountAccounts(accounts: Accounts, cloud: CloudLink) {
  localStorage.clear();
  localStorage.setItem("accounts", JSON.stringify(accounts));
  onTestFinished(() => localStorage.clear());
  const runtime = ManagedRuntime.make(application(undefined, undefined, cloud));
  await mount(runtime);
  return runtime;
}

export function actOnScreen() {
  beforeAll(async () => { environment.IS_REACT_ACT_ENVIRONMENT = true; await page.viewport(1280, 800); });
  afterAll(() => { environment.IS_REACT_ACT_ENVIRONMENT = false; });
}

export async function mount(runtime: Runtime) {
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  onTestFinished(async () => {
    await act(() => root.unmount());
    host.remove();
    await runtime.dispose();
  });
  await act(() => root.render(<App runtime={runtime} />));
  return root;
}

export async function signInToGrace(runtime: Runtime) {
  await expect.poll(async () => (await runtime.runPromise(Effect.flatMap(Setup, (setup) => setup.get()))).graceAccount.tag).toBe("AccountUnavailable");
  await act(() => runtime.runPromise(Effect.flatMap(Setup, (setup) => setup.send({ type: "reportGraceAccount",
    report: { tag: "GraceDeviceSignedIn" }, link: { tag: "GoogleLinkUnknown" } }))));
}

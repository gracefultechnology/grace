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

export function browserAccountResponse(url: URL, accountId?: string) {
  if (url.origin !== location.origin) return;
  if (url.pathname === "/api/auth/session") return Response.json({ account: accountId ? { id: accountId, email: null } : null });
  if (url.pathname === "/api/auth/providers") return Response.json({ google: true, email: true, sms: false });
  if (url.pathname === "/api/auth/refresh") return new Response(null, { status: 401 });
}

export function captureSignedOutChat(bodies: string[], observe?: (url: string) => void | Promise<void>) {
  const fetchNetwork = globalThis.fetch;
  bodies.length = 0;
  globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    const account = browserAccountResponse(new URL(url, location.href));
    if (account) return account;
    if (url.includes("/chat/completions")) {
      const body = init?.body ?? (input instanceof Request ? input.clone().body : null);
      bodies.push(await new Response(body).text());
    }
    await observe?.(url);
    return fetchNetwork(input, init);
  };
  return () => { globalThis.fetch = fetchNetwork; };
}

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

export function tabletView(runtime: Runtime) {
  const outside = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  return {
    render: (content = <App runtime={runtime} />) => act(() => Promise.resolve(root.render(content))),
    dispose: async () => {
      await act(() => Promise.resolve(root.unmount()));
      await runtime.dispose();
      host.remove();
      environment.IS_REACT_ACT_ENVIRONMENT = outside;
    },
  };
}

export async function mount(runtime: Runtime) {
  const view = tabletView(runtime);
  onTestFinished(view.dispose);
  await view.render();
  return view;
}

export async function signInToGrace(runtime: Runtime) {
  await expect.poll(async () => (await runtime.runPromise(Effect.flatMap(Setup, (setup) => setup.get()))).graceAccount.tag).toBe("AccountUnavailable");
  await act(() => runtime.runPromise(Effect.flatMap(Setup, (setup) => setup.send({ type: "reportGraceAccount",
    report: { tag: "GraceDeviceSignedIn" }, link: { tag: "GoogleLinkUnknown" } }))));
}

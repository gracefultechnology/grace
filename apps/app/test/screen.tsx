import { Effect, Layer, ManagedRuntime, Schema } from "effect";
import { TestClock } from "effect/testing";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, beforeEach, expect, onTestFinished } from "vitest";
import { page, userEvent } from "vitest/browser";
import { type Accounts, allowedUse, chooseProvider, initial, type Provider, sheetResult } from "../gen/app__accounts.ts";
import { Machine as Setup, signedInTablet } from "../gen/app__setup.effect.vibe";
import { application } from "../src/app.vibe";
import type { CloudLink } from "../src/conversation.vibe";
import type { WakePort } from "../src/graceSpeechPlatform.ts";
import { App } from "../src/App.tsx";
import type { Runtime } from "../src/useApp.ts";

const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

export function browserAccountResponse(url: URL, accountId?: string) {
  if (url.origin !== location.origin) return;
  if (url.pathname === "/api/auth/session") return Response.json({ account: accountId ? { id: accountId, email: null } : null });
  if (url.pathname === "/api/auth/providers") return Response.json({ google: true, email: true, sms: false });
  if (url.pathname === "/api/auth/refresh") return new Response(null, { status: 401 });
}

export function browserBillingSnapshot(grant: { id: string; effectiveFrom: number; effectiveUntil: number } | null = null) {
  const lane = grant ? "allowanceThenCredits" : "refused";
  return {
    data: {
      schemaVersion: 3, observedAt: Date.now(), account: { status: "active" }, balance: { usdMicros: 0, revision: 0 },
      plan: grant ? { key: "plus_monthly", source: "grant", effectiveUntil: grant.effectiveUntil } : { key: "free", source: "free", effectiveUntil: null },
      subscription: null, grant: grant && { ...grant, planKey: "plus_monthly", family: "grace-pilot", revoked: false }, allowance: null,
      funding: { inference: lane, speech: lane, maps: lane },
    },
  };
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

export async function allowOutlook({ cloud, key, address }: { cloud: string; key: string; address: string }) {
  const started = await fetch(new URL("/api/v1/eliza/connections/outlook/sessions", cloud), {
    method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ loginHint: "" }),
  });
  expect(started.ok).toBe(true);
  const { pageUrl } = Schema.decodeUnknownSync(Schema.Struct({ pageUrl: Schema.String }))(await started.json());
  const consent = await fetch(pageUrl, { method: "POST", body: new URLSearchParams({ address, choice: "allow" }) });
  expect(consent.ok).toBe(true);
}

export function connected(accounts: Accounts, provider: Provider, address: string, name: string) {
  const chosen = chooseProvider(accounts, provider, "AccountPerson");
  return sheetResult(chosen, { attempt: chosen.signIn.attempt, outcome: "Allowed", address, granted: allowedUse }, name, "AccountConnector");
}

export const mountGmail = (address: string, cloud: CloudLink, clockAt?: number) => mountAccounts(connected(initial, "Gmail", address, "Gmail"), cloud, clockAt);

export async function mountAccounts(accounts: Accounts, cloud: CloudLink, clockAt?: number) {
  localStorage.clear();
  localStorage.setItem("accounts", JSON.stringify(accounts));
  onTestFinished(() => localStorage.clear());
  const app = application(undefined, undefined, cloud);
  const runtime = ManagedRuntime.make(clockAt === undefined ? app : app.pipe(
    Layer.provideMerge(Layer.effectDiscard(TestClock.setTime(clockAt)).pipe(Layer.provideMerge(TestClock.layer()))),
  ));
  await mount(runtime);
  return runtime;
}

export const homeCalendarLauncher = () => page.getByRole("group", { name: "Calendar", exact: true }).getByRole("button", { name: /^Calendar(?:\s|$)/ });

export async function tapHomeCalendar() {
  const titles = () => homeCalendarLauncher().getByText("Calendar", { exact: true }).elements().filter((item) => !item.closest("[inert]"));
  await expect.poll(() => titles().length).toBe(1);
  const [title] = titles();
  if (!title) throw new Error("The Calendar launcher is no longer visible");
  await act(() => userEvent.click(title));
}

export function mockNetworkReach() {
  const network = { online: true };
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => network.online });
  onTestFinished(() => { Reflect.deleteProperty(navigator, "onLine"); });
  return (online: boolean) => act(() => {
    network.online = online;
    window.dispatchEvent(new Event(online ? "online" : "offline"));
    return Promise.resolve();
  });
}

export function actOnScreen() {
  beforeAll(async () => { environment.IS_REACT_ACT_ENVIRONMENT = true; await page.viewport(1280, 800); });
  beforeEach(() => page.viewport(1280, 800));
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

export function fixtureListener(listeners: Map<string, (value: unknown) => void>) {
  return (event: string, listener: (value: unknown) => void) => {
    listeners.set(event, listener);
    return Promise.resolve({ remove: () => { listeners.delete(event); return Promise.resolve(); } });
  };
}

export function wakeBoundary() {
  const key = "grace/voice-disclosure/wake";
  const previous = localStorage.getItem(key);
  localStorage.removeItem(key);
  onTestFinished(() => {
    if (previous === null) localStorage.removeItem(key);
    else localStorage.setItem(key, previous);
  });
  const listeners = new Map<string, (value: unknown) => void>();
  let permitted = false;
  let generation: number | null = null;
  let chimes = 0;
  const status = () => Promise.resolve({ available: true, permitted });
  const port: WakePort = {
    status,
    requestPermission: () => { permitted = true; return status(); },
    configure: (choice) => { generation = choice.generation; return Promise.resolve(); },
    chime: () => { chimes++; return Promise.resolve(); },
    addListener: fixtureListener(listeners),
  };
  return {
    port,
    armed: (): number | null => generation,
    permitted: () => permitted,
    chimes: () => chimes,
    report: () => act(async () => { listeners.get("wakeStatus")?.(await status()); }),
    detect: (value = generation) => {
      if (value === null) throw new Error("Wake needs to be armed before it detects a phrase");
      return act(() => Promise.resolve(listeners.get("wakeDetected")?.({ generation: value })));
    },
  };
}

export async function signInToGrace(runtime: Runtime) {
  await expect.poll(async () => (await runtime.runPromise(Effect.flatMap(Setup, (setup) => setup.get()))).graceAccount.tag).toBe("AccountUnavailable");
  await act(() => runtime.runPromise(Effect.flatMap(Setup, (setup) => setup.send({ type: "reportGraceAccount",
    report: signedInTablet, link: { tag: "GoogleLinkUnknown" } }))));
}

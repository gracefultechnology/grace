import { Effect, Layer, ManagedRuntime, Schema } from "effect";
import { TestClock } from "effect/testing";
import { createRoot } from "react-dom/client";
import { expect, inject, onTestFinished, type TestContext } from "vitest";
import { page, userEvent } from "vitest/browser";
import { Machine as Workspaces } from "../gen/app__workspace.effect.vibe";
import { App } from "../src/App.tsx";
import { application } from "../src/app.vibe";
import type { SurfacePlugin } from "../src/surfacePlugin.ts";
import { client, script, signIn } from "./cloud.vibe";
import "../src/main.css";

export { guidedDetails } from "../gen/app__workspace.effect.vibe";
export { guidedPageState, privateFormRecovery } from "../src/nativePage.vibe";
export { LinkObservation } from "../src/nativePage.schema.ts";
export { decisionCloud } from "./browser-decisions.fixture.vibe";

export const typedAddress = () => document.querySelector<HTMLInputElement>("input[aria-label=Address]")?.value;

export async function launch(plugin?: SurfacePlugin, cloud?: Parameters<typeof application>[2], context?: TestContext, testClock = false) {
  context?.signal.throwIfAborted();
  const app = application(plugin, undefined, cloud);
  const runtime = ManagedRuntime.make(testClock ? Layer.provideMerge(app, TestClock.layer()) : app);
  const container = document.body.appendChild(document.createElement("div"));
  container.dataset.testid = crypto.randomUUID();
  const root = createRoot(container);
  const finished = context?.onTestFinished ?? onTestFinished;
  finished(async () => {
    root.unmount();
    container.remove();
    await runtime.dispose();
  });
  await page.viewport(1280, 800);
  context?.signal.throwIfAborted();
  if (!container.isConnected) throw new Error("The browser test has already ended");
  root.render(<App runtime={runtime} />);
  return { ui: page.getByTestId(container.dataset.testid), runtime, workspace: () => runtime.runSync(Effect.flatMap(Effect.service(Workspaces), (m) => m.get())) };
}

export function androidPagePluginAtItsBoundary(overrides: Partial<SurfacePlugin> = {}) {
  const calls: [string, Record<string, unknown>][] = [];
  const listeners = new Map<string, (event: unknown) => void>();
  const refused = { creates: 0 };
  let committed = "";
  const plugin = new Proxy(overrides, {
    get: (_, method: string) => (options: Record<string, unknown> | string, listener?: (event: unknown) => void) => {
      if (typeof options === "string") {
        if (listener !== undefined) listeners.set(options, listener);
        return Promise.resolve({ remove: () => Promise.resolve() });
      }
      calls.push([method, options]);
      if (method === "createSurface" && refused.creates > 0) {
        refused.creates -= 1;
        return Promise.reject(new Error("This WebView cannot isolate the page"));
      }
      if (method === "reloadSurface") emit("pageStarted", { url: committed });
      const override: unknown = Reflect.get(overrides, method);
      if (typeof override === "function") {
        const result: unknown = Reflect.apply(override, overrides, [options]);
        return result;
      }
      return Promise.resolve({});
    },
  }) as SurfacePlugin;
  const emit = (event: string, fields: Record<string, unknown>) => {
    if (event === "pageStarted" && typeof fields.url === "string" && fields.url !== "") committed = fields.url;
    const surface = calls.find(([method]) => method === "createSurface")?.[1];
    listeners.get(event)?.({ owner: surface?.owner, session: surface?.session, epoch: surface?.epoch, id: "tab-1", ...fields });
  };
  return {
    plugin,
    refused,
    called: (method: string) => calls.filter(([m]) => m === method).map(([, options]) => options),
    started: (url = "") => emit("pageStarted", { url }),
    finished: (url: string, state: Record<string, unknown> = {}) =>
      emit("navigationChanged", { exists: true, currentUrl: url, progress: 100, pageError: null, securityBlocked: false, ...state }),
    ask: (event: string, fields: Record<string, unknown>) => emit(event, fields),
    crashed: () => emit("surfaceCrashed", {}),
  };
}

export const SelectorRead = Schema.Struct({
  url: Schema.String, title: Schema.String, text: Schema.String, truncated: Schema.Boolean,
});
export async function proposeRead(said: string, text: string, step: "ReadChangedBrowser" | "ReadStatement", signal?: AbortSignal) {
  localStorage.clear();
  const cloud = inject("cloud");
  const { secret } = await Effect.runPromise(Effect.provide(signIn(cloud), client));
  signal?.throwIfAborted();
  await Effect.runPromise(Effect.provide(script(cloud, secret, [{
    said, answer: JSON.stringify({ text, isQuestion: false, answers: [], actions: [{ kind: "proposeReadPlan", steps: [step] }] }),
  }]), client));
  return { cloud, secret };
}
export const BrowserControl = Schema.Struct({
  documentId: Schema.NonEmptyString,
  frameScope: Schema.Literal("main"),
  result: Schema.Record(Schema.String, Schema.Unknown),
});

export async function startBrowserReadPlan(
  { ui, workspace }: Pick<Awaited<ReturnType<typeof launch>>, "ui" | "workspace">,
  { url, question, askWith }: { url: string; question: string; askWith: "keyboard" | "pointer" },
) {
  await userEvent.click(ui.getByRole("button", { name: "Internet", exact: true }));
  await userEvent.fill(ui.getByRole("textbox", { name: "Address" }), url);
  await userEvent.click(ui.getByRole("button", { name: "Go", exact: true }));
  await expect.poll(() => workspace().browser.tabs[0]?.load).toBe("Loaded");
  const ask = ui.getByRole("button", { name: "Ask Grace", exact: true });
  if (askWith === "keyboard") await userEvent.type(ask, "{Enter}");
  else await userEvent.click(ask);
  await userEvent.click(ui.getByRole("button", { name: "Allow Grace to read this browser", exact: true }));
  await expect.element(ui.getByRole("button", { name: "Turn off browser reading", exact: true })).toBeVisible();
  await userEvent.fill(ui.getByRole("textbox", { name: "Message to Grace" }), question);
  await userEvent.click(ui.getByRole("button", { name: "Send", exact: true }));
  await expect.element(ui.getByRole("region", { name: "Review read plan" })).toBeVisible();
  await userEvent.click(ui.getByRole("button", { name: "Collapse", exact: true }));
  await userEvent.click(ui.getByRole("button", { name: "Start read plan" }));
}

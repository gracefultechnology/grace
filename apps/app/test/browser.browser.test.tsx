// spec/app/surface.md, "Story: Use the website under Grace's controls"; spec/app/browser.md, "Story: Enter a website and understand loading or failure"; spec/app/browser.md, "A page that moves by itself keeps the address the person is typing"; spec/app/browser.md, "Load results must match the tab and request that produced them"; spec/app/browser.md, "Back and Forward stay within the selected tab's history"; spec/app/browser.md, "Overflow retains the selected tab and the most recently used other tabs in opening order"; spec/app/browser.md, "Address entry preserves a draft and empty Go gives a visible explanation"; spec/app/browser.md, "Recent websites can be removed individually or cleared after one confirmation"; spec/app/surface.md, "A Grace control is drawn over the page only after the host routes its rect to Grace"
import { Effect, ManagedRuntime, Schema } from "effect";
import { createRoot } from "react-dom/client";
import { expect, inject, it, onTestFinished } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import { Machine as PageLayers } from "../gen/app__surface.effect.vibe";
import { Machine as Workspaces } from "../gen/app__workspace.effect.vibe";
import { App } from "../src/App.tsx";
import { application } from "../src/app.vibe";
import type { SurfacePlugin } from "../src/surfacePlugin.ts";
import { client, script, signIn } from "./cloud.vibe";
import "../src/main.css";

const topmost = (element: Element) => {
  const { left, top, width, height } = element.getBoundingClientRect();
  return document.elementFromPoint(left + width / 2, top + height / 2);
};
const onTop = (element: Element | null) => element !== null && element.contains(topmost(element));
const typedAddress = () => document.querySelector<HTMLInputElement>("input[aria-label=Address]")?.value;

async function launch(plugin?: SurfacePlugin, cloud?: Parameters<typeof application>[2]) {
  await page.viewport(1280, 800);
  const runtime = ManagedRuntime.make(application(plugin, undefined, cloud));
  const container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  onTestFinished(async () => {
    root.unmount();
    container.remove();
    await runtime.dispose();
  });
  root.render(<App runtime={runtime} />);
  return { runtime, workspace: () => runtime.runSync(Effect.flatMap(Effect.service(Workspaces), (m) => m.get())) };
}

it('Browse and return to the page I left (spec/app/browser.md, "Story: Browse and return to the page I left")', async () => {
  const site = new URL("/browse/", inject("site")).href;
  const { runtime, workspace } = await launch();
  const tab = (id = 1) => workspace().browser.tabs.find((t) => t.id === id);
  const placed = () => runtime.runSync(Effect.flatMap(Effect.service(PageLayers), (m) => m.get())).page;
  const frames = () => [...document.querySelectorAll<HTMLIFrameElement>('iframe[title="Website"]')];
  const shown = (id = 1) => frames().find((frame) => frame.dataset.page === `tab-${id}`) ?? null;
  const showing = () => frames().filter((frame) => !frame.hidden).map((frame) => frame.src);
  const address = page.getByRole("textbox", { name: "Address" });
  const go = page.getByRole("button", { name: "Go", exact: true });
  const enter = () => userEvent.keyboard("{Enter}");
  const visit = async (url: string, id = 1, submit = enter) => {
    await address.fill(url);
    await submit();
    await expect.poll(() => ({ src: shown(id)?.src, load: tab(id)?.load })).toEqual({ src: url, load: "Loaded" });
  };
  const host = new URL(site).hostname;
  const drawnTabs = () => page.getByRole("button", { name: host, exact: true }).elements();
  const tabsDrawn = () => drawnTabs().length;

  await userEvent.click(page.getByRole("button", { name: "Internet" }));
  await visit(`${site}index.html`);
  await expect.poll(() => {
    const frame = shown();
    const rect = frame?.getBoundingClientRect();
    const fills = rect !== undefined && [rect.x, rect.y, rect.width, rect.height].map(Math.round).join() === Object.values(placed()).join();
    return { hidden: frame?.hidden, top: frame !== null && topmost(frame) === frame, fills };
  }).toEqual({ hidden: false, top: true, fills: true });

  await visit(`${site}bill/index.html`, 1, () => userEvent.click(go));
  await userEvent.click(page.getByRole("button", { name: "Back" }));
  await expect.poll(() => ({ src: shown()?.src, cursor: tab()?.cursor, load: tab()?.load })).toEqual({ src: `${site}index.html`, cursor: 1, load: "Loaded" });
  await userEvent.click(page.getByRole("button", { name: "Forward" }));
  await expect.poll(() => ({ src: shown()?.src, cursor: tab()?.cursor, load: tab()?.load })).toEqual({ src: `${site}bill/index.html`, cursor: 2, load: "Loaded" });
  const loaded = tab()?.loadVersion ?? 0;
  await userEvent.type(address, "wea");
  await userEvent.click(page.getByRole("button", { name: "Reload" }));
  await expect.poll(() => ({ load: tab()?.load, reloaded: (tab()?.loadVersion ?? 0) > loaded, address: typedAddress() })).toEqual({ load: "Loaded", reloaded: true, address: `${site}bill/index.html` });
  const reloaded = tab()?.loadVersion ?? 0;
  await userEvent.click(go);
  await expect.poll(() => ({ history: tab()?.history.length, load: tab()?.load, again: (tab()?.loadVersion ?? 0) > reloaded, address: typedAddress() })).toEqual({ history: 3, load: "Loaded", again: true, address: `${site}bill/index.html` });
  const notice = page.getByText("Type a website or what you’re looking for.");
  await userEvent.clear(address);
  await userEvent.click(go);
  await expect.poll(() => onTop(notice.query())).toBe(true);

  await userEvent.click(page.getByRole("button", { name: "Back" }));
  await userEvent.click(page.getByRole("button", { name: "Back" }));
  await expect.poll(() => ({ cursor: tab()?.cursor, page: shown() })).toEqual({ cursor: 0, page: null });
  await userEvent.click(page.getByRole("button", { name: "Forward" }));
  await expect.poll(() => ({ src: shown()?.src, load: tab()?.load })).toEqual({ src: `${site}index.html`, load: "Loaded" });
  await userEvent.click(page.getByRole("button", { name: "Forward" }));
  await expect.poll(() => ({ src: shown()?.src, cursor: tab()?.cursor, load: tab()?.load, address: typedAddress() })).toEqual({ src: `${site}bill/index.html`, cursor: 2, load: "Loaded", address: `${site}bill/index.html` });

  await userEvent.click(page.getByRole("button", { name: "Open a new tab" }));
  await visit(`${site}booking/index.html`, 2, () => userEvent.click(go));
  await expect.poll(showing).toEqual([`${site}booking/index.html`]);
  await userEvent.click(page.getByRole("button", { name: host, exact: true }).first());
  await expect.poll(showing).toEqual([`${site}bill/index.html`]);
  const kept = tab()?.loadVersion;
  await userEvent.click(page.getByRole("button", { name: "Home", exact: true }));
  await userEvent.click(page.getByRole("button", { name: "Internet" }));
  await expect.poll(() => ({ showing: showing(), cursor: tab()?.cursor, loadVersion: tab()?.loadVersion })).toEqual({ showing: [`${site}bill/index.html`], cursor: 2, loadVersion: kept });

  await userEvent.click(page.getByRole("button", { name: "Open a new tab" }));
  await userEvent.click(go);
  await expect.poll(() => onTop(notice.query())).toBe(true);
  const recent = () => workspace().browser.recent;
  const remembered = recent().length;
  await userEvent.click(page.getByRole("button", { name: `Remove ${host}` }).first());
  await expect.poll(() => recent().length).toBe(remembered - 1);
  const left = recent();
  await userEvent.click(page.getByRole("button", { name: "Clear", exact: true }));
  await userEvent.click(page.getByRole("dialog").getByRole("button", { name: "Cancel" }));
  await expect.poll(recent).toEqual(left);
  await userEvent.click(page.getByRole("button", { name: "Clear", exact: true }));
  await userEvent.click(page.getByRole("dialog").getByRole("button", { name: "Clear" }));
  await expect.poll(recent).toEqual([]);
  await visit(`${site}index.html`, 3);
  await userEvent.click(page.getByRole("button", { name: "Open a new tab" }));
  await visit(`${site}bill/index.html`, 4);
  await page.viewport(800, 800);
  await expect.poll(() => ({ drawn: tabsDrawn(), selected: drawnTabs().filter((t) => t.getAttribute("aria-current") === "page").length })).toEqual({ drawn: 2, selected: 1 });
  const listed = page.getByRole("dialog", { name: "More tabs" }).getByRole("button", { name: host, exact: true });
  await userEvent.click(page.getByRole("button", { name: "2 more" }));
  await expect.poll(() => onTop(listed.nth(1).query())).toBe(true);
  await userEvent.click(listed.nth(1));
  await expect.poll(showing).toEqual([`${site}booking/index.html`]);
  await page.viewport(1280, 800);
  await expect.poll(() => ({ drawn: tabsDrawn(), tabs: frames().length })).toEqual({ drawn: 4, tabs: 4 });
  await userEvent.click(page.getByRole("button", { name: host, exact: true }).first());
  await expect.poll(showing).toEqual([`${site}bill/index.html`]);

  await userEvent.click(page.getByRole("button", { name: "Ask Grace" }));
  await expect.poll(() => shown()?.hidden).toBe(true);
  await userEvent.click(page.getByRole("button", { name: "Collapse" }));
  await expect.poll(() => shown()?.hidden).toBe(false);
  const grace = page.getByRole("region", { name: "Grace" });
  await expect.poll(() => grace.query()?.contains(topmost(grace.element())) ?? false).toBe(true);

  await page.viewport(800, 800);
  await userEvent.click(page.getByRole("button", { name: "2 more" }));
  const closing = page.getByRole("dialog", { name: "More tabs" }).getByRole("button", { name: `Close ${host}` }).nth(1);
  await expect.poll(() => onTop(closing.query())).toBe(true);
  await userEvent.click(closing);
  await expect.poll(() => workspace().browser.tabs.length).toBe(3);
  await userEvent.click(page.getByRole("dialog", { name: "More tabs" }).getByRole("button", { name: `Close ${host}` }));
  await expect.poll(() => ({ tabs: workspace().browser.tabs.length, top: onTop(frames().find((frame) => !frame.hidden) ?? null) })).toEqual({ tabs: 2, top: true });

  await userEvent.click(page.getByRole("button", { name: "Close browser" }));
  await expect.poll(frames).toEqual([]);
});

function androidPagePluginAtItsBoundary(overrides: Partial<SurfacePlugin> = {}) {
  const calls: [string, Record<string, unknown>][] = [];
  const listeners = new Map<string, (event: unknown) => void>();
  const refused = { creates: 0 };
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
      const override: unknown = Reflect.get(overrides, method);
      if (typeof override === "function") {
        const result: unknown = Reflect.apply(override, overrides, [options]);
        return result;
      }
      return Promise.resolve({});
    },
  }) as SurfacePlugin;
  const emit = (event: string, fields: Record<string, unknown>) => {
    const surface = calls.find(([method]) => method === "createSurface")?.[1];
    listeners.get(event)?.({ owner: surface?.owner, session: surface?.session, epoch: surface?.epoch, id: "tab-1", ...fields });
  };
  return {
    plugin,
    refused,
    called: (method: string) => calls.filter(([m]) => m === method).map(([, options]) => options),
    started: (url = "") => emit("pageStarted", { url }),
    finished: (url: string) => emit("navigationChanged", { exists: true, currentUrl: url, progress: 100 }),
    crashed: () => emit("surfaceCrashed", {}),
  };
}

const BrowserDocument = Schema.Struct({
  url: Schema.NonEmptyString,
  documentId: Schema.NonEmptyString,
  title: Schema.String,
  text: Schema.String,
  truncated: Schema.Boolean,
});
const BrowserControl = Schema.Struct({
  documentId: Schema.NonEmptyString,
  frameScope: Schema.Literal("main"),
  result: Schema.Record(Schema.String, Schema.Unknown),
});
it.each(inject("browserBenchmarks"))('Follow Grace to a benchmark link $taskId (spec/app/workspace.md, "Story: Follow one reviewed plan across apps")', async ({ taskId, intent, startUrl, gradeWholeCohort }) => {
  const transport = commands.benchmarkSurface;
  await transport({ kind: "begin", taskId });
  const read = async () => Schema.decodeUnknownSync(BrowserDocument)(await transport({ kind: "read" }));
  let selected: string | null | undefined;
  const outcome: Record<string, unknown> = {
    chatProvider: "fixture", observationPermission: "awaiting permission",
    operator: "trusted Chromium mouse input at visible guide ring",
  };
  const native = androidPagePluginAtItsBoundary({
    async createSurface(request) {
      if (!request.url) throw new Error("A benchmark surface needs a start URL");
      try {
        await transport({ kind: "open", url: request.url });
        const actual = await read();
        native.started(actual.url);
        native.finished(actual.url);
      } catch (error) {
        outcome.browserBoundaryFailure = { operation: "createSurface", url: request.url, detail: error instanceof Error ? error.message : String(error) };
        throw error;
      }
    },
    presentSurface(request) {
      selected = request.id;
      return Promise.resolve();
    },
    async readPage(request) {
      if (request.id !== selected) throw new Error("The benchmark site is not the selected Grace surface");
      const { url, title, text, truncated } = await read();
      return { url, title, text, truncated };
    },
    async controlPage(request) {
      if (request.id !== selected && request.command.guidance?.kind !== "hide")
        throw new Error("The benchmark site is not the selected Grace surface");
      return Schema.decodeUnknownSync(BrowserControl)(await transport({ kind: "control", request }));
    },
  });
  try {
    localStorage.clear();
    const cloud = inject("cloud");
    const { secret } = await Effect.runPromise(Effect.provide(signIn(cloud), client));
    await Effect.runPromise(Effect.provide(script(cloud, secret, [{
      said: intent,
      answer: JSON.stringify({ text: "Review the browser step.", isQuestion: false, answers: [], actions: [{ kind: "proposeReadPlan", steps: ["ReadChangedBrowser"] }] }),
    }]), client));
    await transport({ kind: "decisionRoute", cloud });
    const { workspace } = await launch(native.plugin, { url: cloud, key: secret });
    await userEvent.click(page.getByRole("button", { name: "Internet" }));
    const address = page.getByRole("textbox", { name: "Address" });
    await userEvent.fill(address, startUrl);
    await userEvent.click(page.getByRole("button", { name: "Go", exact: true }));
    await expect.poll(() => outcome.browserBoundaryFailure ?? workspace().browser.tabs[0]?.load, { timeout: 30_000 }).toBe("Loaded");
    const initial = await read();
    outcome.start = { url: initial.url, documentId: initial.documentId };
    expect(initial.url).toBe(new URL(startUrl).href);
    await userEvent.click(page.getByRole("button", { name: "Ask Grace" }));
    await userEvent.click(page.getByRole("button", { name: "Allow Grace to read this browser", exact: true }));
    await expect.element(page.getByRole("button", { name: "Turn off browser reading", exact: true })).toBeVisible();
    outcome.observationPermission = "person granted browser reading in Grace";
    await userEvent.fill(page.getByRole("textbox", { name: "Message to Grace" }), intent);
    await userEvent.click(page.getByRole("button", { name: "Send", exact: true }));
    await expect.element(page.getByRole("region", { name: "Review read plan" })).toBeVisible();
    await userEvent.click(page.getByRole("button", { name: "Collapse", exact: true }));
    await userEvent.click(page.getByRole("button", { name: "Start read plan" }));
    const showLink = page.getByRole("button", { name: "Show me the link" });
    try {
      await userEvent.click(showLink);
    } catch (error) {
      const { device, assistant, browser } = workspace();
      outcome.guideBoundary = {
        connection: device.connectivity, observationAllowed: device.observationAllowed, reasoningAvailable: device.reasoningAvailable,
        surface: device.surface, presentation: assistant.presentation, activity: assistant.activity, load: browser.tabs[0]?.load,
      };
      throw error;
    }
    await expect.poll(async () => (await transport({ kind: "tapGuide" })).tapped, { timeout: 45_000 }).toBe(true);
    outcome.ringTap = true;
    await expect.poll(async () => (await read()).documentId, { timeout: 15_000 }).not.toBe(initial.documentId);
    const landed = await read();
    outcome.destination = { url: landed.url, documentId: landed.documentId };
    expect(landed.url).not.toBe(initial.url);
    const beforeLoad = workspace().browser.tabs[0]?.loadVersion ?? 0;
    native.started(landed.url);
    native.finished(landed.url);
    await expect.poll(() => {
      const tab = workspace().browser.tabs[0];
      return { address: typedAddress(), arrived: tab !== undefined && tab.load === "Loaded" && tab.loadVersion > beforeLoad };
    }, { timeout: 15_000 }).toEqual({ address: landed.url, arrived: true });
    const resume = page.getByRole("button", { name: "Resume Grace" });
    const check = page.getByRole("button", { name: "Check page", exact: true });
    await expect.poll(() => resume.query() !== null || check.query() !== null).toBe(true);
    if (resume.query() !== null) await userEvent.click(resume);
    await userEvent.click(check);
    const plan = page.getByRole("region", { name: "Task plan" });
    await expect.element(plan.getByText("Read checks complete", { exact: true })).toBeVisible();
    outcome.graceTerminal = plan.element().textContent;
  } catch (error) {
    outcome.failure = error instanceof Error ? error.message : String(error);
    if (!gradeWholeCohort) throw error;
  } finally {
    await transport({ kind: "receipt", outcome });
  }
}, 120_000);

it.skipIf(!inject("releasedBillworldEnabled"))('Read the released BillWorld statement (spec/app/workspace.md, "Story: Follow one reviewed plan across apps")', async () => {
  const transport = commands.releasedStatement;
  const { url, taskId, question } = Schema.decodeUnknownSync(Schema.Struct({
    url: Schema.NonEmptyString, taskId: Schema.NonEmptyString, question: Schema.NonEmptyString,
  }))(await transport({ kind: "prepare" }));
  expect(taskId).toBe("task_md9");
  let shown: string | null | undefined;
  const native = androidPagePluginAtItsBoundary({
    createSurface(request) {
      if (request.url !== url) return Promise.reject(new Error("Grace must attach to the exact prepared statement"));
      native.started(url);
      native.finished(url);
      return Promise.resolve();
    },
    presentSurface(request) {
      shown = request.id;
      return Promise.resolve();
    },
    async controlPage(request) {
      if (request.id !== shown || request.command.subaction !== "snapshot") throw new Error("Only the presented statement can be read");
      return Schema.decodeUnknownSync(BrowserControl)(await transport({ kind: "observe", request }));
    },
  });
  try {
    localStorage.clear();
    const cloud = inject("cloud");
    const { secret } = await Effect.runPromise(Effect.provide(signIn(cloud), client));
    await Effect.runPromise(Effect.provide(script(cloud, secret, [{
      said: question,
      answer: JSON.stringify({ text: "Review the statement read.", isQuestion: false, answers: [], actions: [{ kind: "proposeReadPlan", steps: ["ReadStatement"] }] }),
    }]), client));
    const { workspace } = await launch(native.plugin, { url: cloud, key: secret });
    await userEvent.click(page.getByRole("button", { name: "Internet", exact: true }));
    await userEvent.fill(page.getByRole("textbox", { name: "Address" }), url);
    await userEvent.click(page.getByRole("button", { name: "Go", exact: true }));
    await expect.poll(() => workspace().browser.tabs[0]?.load).toBe("Loaded");
    await userEvent.type(page.getByRole("button", { name: "Ask Grace", exact: true }), "{Enter}");
    await userEvent.click(page.getByRole("button", { name: "Allow Grace to read this browser", exact: true }));
    await expect.element(page.getByRole("button", { name: "Turn off browser reading", exact: true })).toBeVisible();
    await userEvent.fill(page.getByRole("textbox", { name: "Message to Grace" }), question);
    await userEvent.click(page.getByRole("button", { name: "Send", exact: true }));
    await expect.element(page.getByRole("region", { name: "Review read plan" })).toBeVisible();
    await userEvent.click(page.getByRole("button", { name: "Collapse", exact: true }));
    await userEvent.click(page.getByRole("button", { name: "Start read plan" }));
    await userEvent.click(page.getByRole("button", { name: "Read statement", exact: true }));
    await expect.element(page.getByRole("region", { name: "Task plan" }).getByText("Read checks complete", { exact: true })).toBeVisible();
    await userEvent.click(page.getByRole("button", { name: "Expand", exact: true }));
    const answer = page.getByRole("region", { name: "Grace" }).getByText(/^Statement amount due:/);
    await expect.element(answer).toBeVisible();
    const grade = await transport({ kind: "answer", text: answer.element().textContent ?? "" });
    expect(grade).toMatchObject({ success: true, constructionSlice: false, actionBudgetEnforced: true, withinActionBudget: true,
      checks: { statement_viewed_after_login: true, due_date_reported: true, amount_reported: true, protected_state_unchanged: true, credentials_unchanged: true, no_forbidden_operations: true },
    });
  } finally {
    await transport({ kind: "close" });
  }
}, 120_000);

it('Enter a website and understand loading or failure (spec/app/browser.md, "Story: Enter a website and understand loading or failure")', async () => {
  const device = androidPagePluginAtItsBoundary();
  const { workspace } = await launch(device.plugin);
  const tab = () => workspace().browser.tabs[0];
  const address = page.getByRole("textbox", { name: "Address" });
  const at = () => ({ url: tab().history[tab().cursor], load: tab().load, address: document.querySelector<HTMLInputElement>("input[aria-label=Address]")?.value });

  device.refused.creates = 1;
  await userEvent.click(page.getByRole("button", { name: "Internet" }));
  await userEvent.type(address, "example.com{Enter}");
  await expect.poll(at).toEqual({ url: "https://example.com/", load: "LoadFailed", address: "https://example.com/" });
  expect(device.called("createSurface")).toHaveLength(1);
  await userEvent.click(page.getByRole("button", { name: "Try again" }));
  await expect.poll(() => device.called("createSurface")).toHaveLength(2);
  device.started("https://example.com/");
  device.finished("https://example.com/");
  await expect.poll(at).toEqual({ url: "https://example.com/", load: "Loaded", address: "https://example.com/" });

  device.started("https://example.com/b");
  await expect.poll(at).toEqual({ url: "https://example.com/b", load: "Loading", address: "https://example.com/b" });
  device.started("https://example.com/next");
  await expect.poll(at).toEqual({ url: "https://example.com/next", load: "Loading", address: "https://example.com/next" });
  device.finished("https://example.com/next");
  await expect.poll(at).toEqual({ url: "https://example.com/next", load: "Loaded", address: "https://example.com/next" });

  device.crashed();
  await expect.poll(() => device.called("createSurface").at(-1)?.url).toBe("https://example.com/next");
  device.started();
  device.finished("https://example.com/next");
  await userEvent.click(page.getByRole("button", { name: "Back" }));
  await expect.poll(() => ({ navigated: device.called("navigate").map((n) => n.url), back: device.called("goBack") })).toEqual({ navigated: ["https://example.com/b"], back: [] });
  device.started("https://example.com/b");
  device.finished("https://example.com/b");
  await expect.poll(at).toEqual({ url: "https://example.com/b", load: "Loaded", address: "https://example.com/b" });
});

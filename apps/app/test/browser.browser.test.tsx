// spec/app/surface.md, "Story: Use the website under Grace's controls"; spec/app/browser.md, "Story: Enter a website and understand loading or failure"; spec/app/browser.md, "A load that ends at another address records where the page really is"; spec/app/browser.md, "A load that never starts or never ends becomes the failure view with Reload"; spec/app/browser.md, "The padlock shows only on a page that loaded over a secure connection"; spec/app/websiteRequests.md, "When the app or browser I confirmed does not open, I am told"; spec/app/browser.md, "A page that moves by itself keeps the address the person is typing"; spec/app/browser.md, "Load results must match the tab and request that produced them"; spec/app/browser.md, "Back and Forward stay within the selected tab's history"; spec/app/browser.md, "Overflow retains the selected tab and the most recently used other tabs in opening order"; spec/app/browser.md, "Address entry preserves a draft and empty Go gives a visible explanation"; spec/app/browser.md, "Recent websites can be removed individually or cleared after one confirmation"; spec/app/surface.md, "A Grace control is drawn over the page only after the host routes its rect to Grace"; spec/app/browser.md, "Stay on a leave-page warning keeps the page she was on"; spec/app/websiteRequests.md, "A website message is answered once with OK, Cancel or typed text"
import { Effect, Layer, ManagedRuntime, Schema } from "effect";
import { TestClock } from "effect/testing";
import { createRoot } from "react-dom/client";
import { expect, inject, it, onTestFinished, type TestContext } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import { loadWaitSeconds } from "../gen/app__browser.ts";
import { Machine as PageLayers } from "../gen/app__surface.effect.vibe";
import { Machine as WebsiteRequests } from "../gen/app__websiteRequests.effect.vibe";
import { guidedDetails, Machine as Workspaces } from "../gen/app__workspace.effect.vibe";
import { App } from "../src/App.tsx";
import { application } from "../src/app.vibe";
import type { SurfacePlugin } from "../src/surfacePlugin.ts";
import { client, script, signIn } from "./cloud.vibe";
import { decisionCloud } from "./browser-decisions.fixture.vibe";
import "../src/main.css";

const topmost = (element: Element) => {
  const { left, top, width, height } = element.getBoundingClientRect();
  return document.elementFromPoint(left + width / 2, top + height / 2);
};
const onTop = (element: Element | null) => element !== null && element.contains(topmost(element));
const typedAddress = () => document.querySelector<HTMLInputElement>("input[aria-label=Address]")?.value;

async function launch(plugin?: SurfacePlugin, cloud?: Parameters<typeof application>[2], context?: TestContext, testClock = false) {
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
  const framed = showing();
  await address.fill("https://bank.invalid/");
  await enter();
  await expect.poll(() => ({ load: workspace().browser.tabs.find((t) => t.id === workspace().browser.selected)?.load, showing: showing() })).toEqual({ load: "LoadFailed", showing: framed });
  const framedTabs = workspace().browser.tabs;
  const framedPage = frames().find((frame) => !frame.hidden)!;
  const away = new Promise((resolve) => framedPage.addEventListener("load", resolve, { once: true }));
  framedPage.contentWindow!.location.href = "about:blank";
  await away;
  await expect.poll(() => framedPage.contentDocument).toBeNull();
  expect(workspace().browser.tabs).toEqual(framedTabs);

  await userEvent.click(page.getByRole("button", { name: "Close browser" }));
  await expect.poll(frames).toEqual([]);
});

function androidPagePluginAtItsBoundary(overrides: Partial<SurfacePlugin> = {}) {
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
    finished: (url: string, state: Record<string, unknown> = {}) => emit("navigationChanged", { exists: true, currentUrl: url, progress: 100, ...state }),
    ask: (event: string, fields: Record<string, unknown>) => emit(event, fields),
    crashed: () => emit("surfaceCrashed", {}),
  };
}

const BrowserDocument = Schema.Struct({
  url: Schema.NonEmptyString,
  documentId: Schema.NonEmptyString,
  title: Schema.String,
  text: Schema.String,
  readyState: Schema.Literals(["loading", "interactive", "complete"]),
  truncated: Schema.Boolean,
});
const SelectorRead = Schema.Struct({
  url: Schema.String, title: Schema.String, text: Schema.String, truncated: Schema.Boolean,
});
async function proposeRead(said: string, text: string, step: "ReadChangedBrowser" | "ReadStatement", signal?: AbortSignal) {
  localStorage.clear();
  const cloud = inject("cloud");
  const { secret } = await Effect.runPromise(Effect.provide(signIn(cloud), client));
  signal?.throwIfAborted();
  await Effect.runPromise(Effect.provide(script(cloud, secret, [{
    said, answer: JSON.stringify({ text, isQuestion: false, answers: [], actions: [{ kind: "proposeReadPlan", steps: [step] }] }),
  }]), client));
  return { cloud, secret };
}
const BrowserControl = Schema.Struct({
  documentId: Schema.NonEmptyString,
  frameScope: Schema.Literal("main"),
  result: Schema.Record(Schema.String, Schema.Unknown),
});
it.each(inject("browserBenchmarks"))('Follow Grace to a benchmark link $taskId (spec/app/workspace.md, "Story: Follow one reviewed plan across apps")', async ({ taskId, intent, startUrl, gradeWholeCohort, requiredStep }) => {
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
      if (request.selector !== undefined) return Schema.decodeUnknownSync(SelectorRead)(await transport({ kind: "read", selector: request.selector }));
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
    const { cloud, secret } = await proposeRead(intent, "Review the browser step.", "ReadChangedBrowser");
    const decisions = await Effect.runPromise(decisionCloud(cloud, secret));
    await transport({ kind: "decisionRoute", cloud, deadlineMs: decisions.deadlineMs });
    const { workspace } = await launch(native.plugin, decisions.host);
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
    const reviewed = workspace().review.request.steps;
    const named = reviewed.find(step => step.tag === "ReachNamedPage");
    if (named) outcome.reviewedDestination = named.subject;
    if (requiredStep === "ReachNamedPage") {
      outcome.reviewedSteps = reviewed.map(step => ({ kind: step.tag, subject: guidedDetails(step).subject }));
      expect(named).toBeDefined();
      expect(reviewed).toHaveLength(1);
    }
    await userEvent.click(page.getByRole("button", { name: "Collapse", exact: true }));
    await userEvent.click(page.getByRole("button", { name: "Start read plan" }));
    const showLink = page.getByRole("button", { name: "Show me the link" });
    const plan = page.getByRole("region", { name: "Task plan" });
    const finished = plan.getByText("Read checks complete", { exact: true });
    const continuing = page.getByRole("status", { name: "Page check result" });
    const menuGuidance = page.getByRole("status", { name: "Open submenu guidance" });
    const linkGuidance = page.getByRole("status", { name: "Link guide result" });
    const guidanceFailure = page.getByRole("status", { name: "Link unavailable" });
    const visited = new Set([initial.url]);
    const disclosed = new Set<string>();
    const disclosures: { url: string; documentId: string; snapshotId: string; pointer: { x: number; y: number }; before: number; after: number }[] = [];
    outcome.disclosures = disclosures;
    const hops: { url: string; documentId: string; checked: boolean }[] = [];
    outcome.hops = hops;
    let previous = initial;
    while (hops.length + disclosures.length < (named ? 8 : 1)) {
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
      if (named) {
        await expect.poll(() => menuGuidance.query() !== null || linkGuidance.query() !== null || guidanceFailure.query() !== null, { timeout: 45_000 }).toBe(true);
        if (guidanceFailure.query()) throw new Error(guidanceFailure.query()?.textContent ?? "The link could not be highlighted");
        if (menuGuidance.query() !== null) {
          expect(disclosed.has(previous.documentId)).toBe(false);
          outcome.menuInstruction = menuGuidance.query()?.textContent
          await expect.poll(async () => {
            const result = await transport({ kind: "hoverGuide" })
            outcome.menuInteraction = result
            if (result.reason) throw new Error(typeof result.reason === "string" ? result.reason : JSON.stringify(result.reason))
            return result.disclosed === true
          }, { timeout: 15000 }).toBe(true)
          const evidence = Schema.decodeUnknownSync(Schema.Struct({
            disclosed: Schema.Literal(true), url: Schema.NonEmptyString, documentId: Schema.NonEmptyString,
            snapshotId: Schema.NonEmptyString, pointer: Schema.Struct({ x: Schema.Finite, y: Schema.Finite }),
            before: Schema.Int, after: Schema.Int,
          }))(outcome.menuInteraction);
          expect(evidence.url).toBe(previous.url);
          expect(evidence.documentId).toBe(previous.documentId);
          expect(evidence.after).toBeGreaterThan(evidence.before);
          disclosed.add(evidence.documentId);
          disclosures.push(evidence);
          await expect.poll(() => linkGuidance.query() !== null || guidanceFailure.query() !== null, { timeout: 50_000 }).toBe(true);
          if (guidanceFailure.query()) throw new Error(guidanceFailure.query()?.textContent ?? "The submenu link could not be highlighted");
        }
      }
      await expect.poll(async () => (await transport({ kind: "tapGuide" })).tapped, { timeout: 45_000 }).toBe(true);
      outcome.ringTap = true;
      await expect.poll(async () => {
        const document = await read();
        return document.documentId !== previous.documentId && document.readyState === "complete";
      }, { timeout: 30_000 }).toBe(true);
      const landed = await read();
      outcome.destination = { url: landed.url, documentId: landed.documentId };
      expect(visited.has(landed.url)).toBe(false);
      visited.add(landed.url);
      const beforeLoad = workspace().browser.tabs[0]?.loadVersion ?? 0;
      native.started(landed.url);
      native.finished(landed.url);
      await expect.poll(() => {
        const tab = workspace().browser.tabs[0];
        return { address: typedAddress(), arrived: tab !== undefined && tab.load === "Loaded" && tab.loadVersion > beforeLoad };
      }, { timeout: 15_000 }).toEqual({ address: landed.url, arrived: true });
      const resume = page.getByRole("button", { name: "Resume Grace" });
      const check = page.getByRole("button", { name: "Check page", exact: true });
      await expect.poll(() => resume.query() !== null || check.query() !== null, {
        message: "Waiting for Grace to offer Resume Grace or Check page after navigation",
      }).toBe(true);
      if (resume.query() !== null) await userEvent.click(resume);
      await userEvent.click(check);
      await expect.poll(() => finished.query() !== null || continuing.query() !== null, {
        message: "Waiting for Grace to show a completed read or a page-check result after Check page",
      }).toBe(true);
      const checked = finished.query() !== null;
      hops.push({ url: landed.url, documentId: landed.documentId, checked });
      if (checked) break;
      expect(named).toBeDefined();
      expect(workspace().plan.receipts).toHaveLength(0);
      previous = landed;
    }
    await expect.element(finished).toBeVisible();
    outcome.graceTerminal = plan.element().textContent;
  } catch (error) {
    outcome.failure = error instanceof Error ? error.message : String(error);
    if (!gradeWholeCohort) throw error;
  } finally {
    await transport({ kind: "receipt", outcome });
  }
}, 240_000);

it.for(inject("billworldStatements"))('Read the $label BillWorld statement (spec/app/workspace.md, "Story: Follow one reviewed plan across apps")', { timeout: 120_000 }, async ({ billerId }, context) => {
  const attempt = crypto.randomUUID();
  context.onTestFinished(async () => { await commands.releasedStatement(attempt, { kind: "close" }); });
  const transport = async (action: Parameters<typeof commands.releasedStatement>[1]) => {
    context.signal.throwIfAborted();
    const result = await commands.releasedStatement(attempt, action);
    context.signal.throwIfAborted();
    return result;
  };
  const { url, taskId, question } = Schema.decodeUnknownSync(Schema.Struct({
    url: Schema.NonEmptyString, taskId: Schema.NonEmptyString, question: Schema.NonEmptyString,
  }))(await transport({ kind: "prepare", billerId }));
  expect(taskId).toBe(billerId === undefined ? "task_md9" : billerId + ":view-bill");
  let shown: string | null | undefined;
  let observations = 0;
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
      const observed = Schema.decodeUnknownSync(BrowserControl)(await transport({ kind: "observe", request }));
      observations++;
      return observed;
    },
  });
  const { cloud, secret } = await proposeRead(question, "Review the statement read.", "ReadStatement", context.signal);
  const { ui, workspace } = await launch(native.plugin, { url: cloud, key: secret }, context);
  await userEvent.click(ui.getByRole("button", { name: "Internet", exact: true }));
  await userEvent.fill(ui.getByRole("textbox", { name: "Address" }), url);
  await userEvent.click(ui.getByRole("button", { name: "Go", exact: true }));
  await expect.poll(() => workspace().browser.tabs[0]?.load).toBe("Loaded");
  await userEvent.type(ui.getByRole("button", { name: "Ask Grace", exact: true }), "{Enter}");
  await userEvent.click(ui.getByRole("button", { name: "Allow Grace to read this browser", exact: true }));
  await expect.element(ui.getByRole("button", { name: "Turn off browser reading", exact: true })).toBeVisible();
  await userEvent.fill(ui.getByRole("textbox", { name: "Message to Grace" }), question);
  await userEvent.click(ui.getByRole("button", { name: "Send", exact: true }));
  await expect.element(ui.getByRole("region", { name: "Review read plan" })).toBeVisible();
  await userEvent.click(ui.getByRole("button", { name: "Collapse", exact: true }));
  await userEvent.click(ui.getByRole("button", { name: "Start read plan" }));
  const check = ui.getByRole("button", { name: "Read statement", exact: true });
  const complete = ui.getByRole("region", { name: "Task plan" }).getByText("Read checks complete", { exact: true });
  if (billerId !== undefined) {
    for (const value of ["past", "ambiguous"] as const) {
      await transport({ kind: "evidence", value });
      const before = observations;
      await userEvent.click(check);
      await expect.poll(() => observations).toBeGreaterThan(before);
      await expect.element(check).toBeEnabled();
      expect(complete.query()).toBeNull();
    }
    await transport({ kind: "evidence", value: "restored" });
  }
  await userEvent.click(check);
  await expect.element(complete).toBeVisible();
  await userEvent.click(ui.getByRole("button", { name: "Expand", exact: true }));
  const answer = ui.getByRole("region", { name: "Grace" }).getByText(/^Statement amount due:/);
  await expect.element(answer).toBeVisible();
  const grade = await transport({ kind: "answer", text: answer.element().textContent ?? "" });
  if (billerId === undefined) {
    expect(grade).toMatchObject({ success: true, constructionSlice: false, actionBudgetEnforced: true, withinActionBudget: true,
      checks: { statement_viewed_after_login: true, due_date_reported: true, amount_reported: true, protected_state_unchanged: true, credentials_unchanged: true, no_forbidden_operations: true },
    });
  } else {
    expect(grade).toMatchObject({ success: true, taskId, predicateSource: "task",
      results: [{ pass: true }, { pass: true }, { pass: true }, { pass: true }, { pass: true }],
    });
  }
});

it('Enter a website and understand loading or failure (spec/app/browser.md, "Story: Enter a website and understand loading or failure")', async () => {
  const unavailable = Object.assign(new Error("No app on this device opens this link"), { code: "EXTERNAL_APP_UNAVAILABLE" });
  let opening = (): Promise<{ status: "dispatched" }> => Promise.reject(unavailable);
  const device = androidPagePluginAtItsBoundary({ openExternalLink: () => opening() });
  const { runtime, workspace } = await launch(device.plugin, undefined, undefined, true);
  const tab = () => workspace().browser.tabs[0];
  const address = page.getByRole("textbox", { name: "Address" });
  const at = () => ({ url: tab().history[tab().cursor], load: tab().load, address: document.querySelector<HTMLInputElement>("input[aria-label=Address]")?.value });
  const later = async (seconds: number) => {
    await runtime.runPromise(TestClock.adjust(`${seconds} seconds`));
    await Effect.runPromise(Effect.sleep("100 millis"));
  };
  const count = (method: string) => device.called(method).length;

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

  const entries = tab().history.length;
  device.started("https://example.com/b");
  device.finished("https://example.com/b");
  await expect.poll(at).toEqual({ url: "https://example.com/b", load: "Loaded", address: "https://example.com/b" });
  expect(tab().history).toHaveLength(entries + 1);
  device.started("https://example.com/c");
  await expect.poll(at).toEqual({ url: "https://example.com/c", load: "Loading", address: "https://example.com/c" });
  device.started("https://example.com/next");
  device.finished("https://example.com/next");
  await expect.poll(at).toEqual({ url: "https://example.com/next", load: "Loaded", address: "https://example.com/next" });
  expect(tab().history).toHaveLength(entries + 2);
  await userEvent.click(page.getByRole("button", { name: "Back" }));
  await expect.poll(() => count("goBack")).toBe(1);
  device.started("https://example.com/b");
  device.finished("https://example.com/b");
  await expect.poll(at).toEqual({ url: "https://example.com/b", load: "Loaded", address: "https://example.com/b" });

  device.crashed();
  await expect.poll(() => device.called("createSurface").at(-1)?.url).toBe("https://example.com/b");
  device.started();
  device.finished("https://example.com/b");
  await userEvent.click(page.getByRole("button", { name: "Back" }));
  await expect.poll(() => ({ navigated: device.called("navigate").map((n) => n.url), back: count("goBack") })).toEqual({ navigated: ["https://example.com/"], back: 1 });
  device.started("https://example.com/");
  device.finished("https://example.com/");
  await expect.poll(at).toEqual({ url: "https://example.com/", load: "Loaded", address: "https://example.com/" });
  const padlock = page.getByRole("img", { name: "Secure connection" });
  await expect.element(padlock).toBeVisible();
  await userEvent.type(address, "x");
  await expect.element(padlock).not.toBeInTheDocument();
  const go = async (text: string, url: string) => {
    await userEvent.fill(address, text);
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => device.called("navigate").at(-1)?.url).toBe(url);
  };

  await go("example.com/start", "https://example.com/start");
  const history = tab().history.length;
  device.started("https://www.example.com/home");
  device.finished("https://www.example.com/home");
  await expect.poll(at).toEqual({ url: "https://www.example.com/home", load: "Loaded", address: "https://www.example.com/home" });
  expect(tab().history).toHaveLength(history);
  await expect.element(padlock).toBeVisible();
  const navigated = count("navigate");
  await userEvent.click(page.getByRole("button", { name: "Back" }));
  await expect.poll(() => count("goBack")).toBe(2);
  expect(count("navigate")).toBe(navigated);
  device.started("https://example.com/");
  device.finished("https://example.com/");
  await expect.poll(at).toEqual({ url: "https://example.com/", load: "Loaded", address: "https://example.com/" });

  await later(loadWaitSeconds - 10);
  await go("example.com/slow", "https://example.com/slow");
  await later(10);
  expect(tab().load).toBe("Loading");
  await later(loadWaitSeconds - 10);
  await expect.poll(at).toEqual({ url: "https://example.com/slow", load: "LoadFailed", address: "https://example.com/slow" });
  expect(device.called("stopLoading")).toHaveLength(1);
  expect(padlock.query()).toBeNull();
  await userEvent.click(page.getByRole("button", { name: "Try again" }));
  await expect.poll(() => count("navigate")).toBe(navigated + 2);
  expect({ to: device.called("navigate").at(-1)?.url, reloaded: count("reloadSurface") }).toEqual({ to: "https://example.com/slow", reloaded: 0 });
  device.started("https://example.com/slow");
  device.finished("https://example.com/slow", { securityBlocked: true, pageError: "net::ERR_CERT_DATE_INVALID" });
  await expect.poll(at).toEqual({ url: "https://example.com/slow", load: "SecurityBlocked", address: "https://example.com/slow" });
  expect(padlock.query()).toBeNull();

  await go("example.com/hang", "https://example.com/hang");
  await later(loadWaitSeconds);
  await expect.poll(at).toEqual({ url: "https://example.com/hang", load: "LoadFailed", address: "https://example.com/hang" });
  await userEvent.click(page.getByRole("button", { name: "Back" }));
  await expect.poll(() => count("reloadSurface")).toBe(1);
  expect(count("goBack")).toBe(2);
  device.finished("https://example.com/slow");
  await expect.poll(at).toEqual({ url: "https://example.com/slow", load: "Loaded", address: "https://example.com/slow" });

  await go("example.com/stalled", "https://example.com/stalled");
  device.started("https://example.com/stalled");
  await later(loadWaitSeconds);
  await expect.poll(at).toEqual({ url: "https://example.com/stalled", load: "LoadFailed", address: "https://example.com/stalled" });
  await userEvent.click(page.getByRole("button", { name: "Try again" }));
  await expect.poll(() => count("reloadSurface")).toBe(2);
  device.finished("https://example.com/stalled");
  await expect.poll(at).toEqual({ url: "https://example.com/stalled", load: "Loaded", address: "https://example.com/stalled" });

  const question = page.getByRole("alertdialog");
  await go("example.com/ask", "https://example.com/ask");
  device.started("https://example.com/ask");
  device.ask("dialogRequested", { dialogId: "hello-1", kind: "alert", message: "Welcome back" });
  await expect.element(question).toBeVisible();
  await later(loadWaitSeconds + 10);
  expect(tab().load).toBe("Loading");
  await userEvent.click(question.getByRole("button", { name: "OK" }));
  await expect.poll(() => device.called("answerDialog")).toMatchObject([{ dialogId: "hello-1", accept: true }]);
  await later(loadWaitSeconds - 1);
  expect(tab().load).toBe("Loading");
  device.finished("https://example.com/ask");
  await expect.poll(at).toEqual({ url: "https://example.com/ask", load: "Loaded", address: "https://example.com/ask" });

  const kept = tab().history;
  await go("example.com/away", "https://example.com/away");
  device.ask("dialogRequested", { dialogId: "leave-1", kind: "beforeunload", message: "" });
  await expect.element(question).toBeVisible();
  await userEvent.click(question.getByRole("button", { name: "Stay" }));
  await expect.poll(at).toEqual({ url: "https://example.com/ask", load: "Loaded", address: "https://example.com/ask" });
  expect(tab().history).toEqual(kept);
  await expect.element(padlock).toBeVisible();
  await later(loadWaitSeconds);
  expect(tab().load).toBe("Loaded");

  await go("http://example.com/plain", "http://example.com/plain");
  device.started("http://example.com/plain");
  device.finished("http://example.com/plain");
  await expect.poll(at).toEqual({ url: "http://example.com/plain", load: "Loaded", address: "http://example.com/plain" });
  expect(padlock.query()).toBeNull();

  const openings = () => runtime.runSync(Effect.flatMap(Effect.service(WebsiteRequests), (m) => m.get())).openings;
  const intent = "intent://pay#Intent;scheme=examplepay;package=com.example.pay;end";
  const fallback = "https://example.com/pay";
  const offer = async (fallbackUrl: string | null) => {
    const asked = count("openExternalLink");
    device.ask("externalLinkRequested", { url: intent, handoff: "view", fallbackUrl });
    await expect.element(question).toBeVisible();
    await userEvent.click(question.getByRole("button", { name: "Open" }));
    await expect.poll(() => count("openExternalLink")).toBe(asked + 1);
    expect(device.called("openExternalLink").at(-1)?.url).toBe(intent);
  };
  const before = count("navigate");
  device.ask("externalLinkRequested", { url: intent, handoff: "view", fallbackUrl: fallback });
  await expect.element(question).toBeVisible();
  expect(count("navigate")).toBe(before);
  await userEvent.click(question.getByRole("button", { name: "Open" }));
  await expect.poll(() => device.called("navigate").at(-1)?.url).toBe(fallback);
  expect(device.called("openExternalLink")).toMatchObject([{ url: intent }]);
  device.started(fallback);
  device.finished(fallback);
  await expect.poll(at).toEqual({ url: fallback, load: "Loaded", address: fallback });
  expect(openings()).toEqual([]);

  opening = () => Promise.resolve({ status: "dispatched" });
  await offer(fallback);
  await expect.poll(() => ({ navigated: count("navigate"), openings: openings() })).toEqual({ navigated: before + 1, openings: [] });

  opening = () => Promise.reject(Object.assign(new Error("Android refused the link"), { code: "EXTERNAL_LINK_DENIED" }));
  await offer(fallback);
  await expect.poll(() => openings().map((o) => o.failed)).toEqual([true]);
  expect(count("navigate")).toBe(before + 1);
  await userEvent.click(page.getByRole("button", { name: "Close", exact: true }));
  await expect.poll(openings).toEqual([]);

  opening = () => Promise.reject(unavailable);
  await offer("http://example.com/pay");
  await expect.poll(() => openings().map((o) => o.failed)).toEqual([true]);
  expect(count("navigate")).toBe(before + 1);
}, 180_000);

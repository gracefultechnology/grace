// spec/app/surface.md, "Story: Use the website under Grace's controls"; spec/app/browser.md, "Story: Enter a website and understand loading or failure"; spec/app/browser.md, "A load that ends at another address records where the page really is"; spec/app/browser.md, "A load that never starts or never ends becomes the failure view with Reload"; spec/app/browser.md, "The padlock shows only on a page that loaded over a secure connection"; spec/app/websiteRequests.md, "When the app or browser I confirmed does not open, I am told"; spec/app/browser.md, "A page that moves by itself keeps the address the person is typing"; spec/app/browser.md, "Load results must match the tab and request that produced them"; spec/app/browser.md, "Back and Forward stay within the selected tab's history"; spec/app/browser.md, "Overflow retains the selected tab and the most recently used other tabs in opening order"; spec/app/browser.md, "Address entry preserves a draft and empty Go gives a visible explanation"; spec/app/browser.md, "Recent websites can be removed individually or cleared after one confirmation"; spec/app/surface.md, "A Grace control is drawn over the page only after the host routes its rect to Grace"; spec/app/browser.md, "Stay on a leave-page warning keeps the page she was on"; spec/app/websiteRequests.md, "A website message is answered once with OK, Cancel or typed text"
import { Effect, Layer, ManagedRuntime, Schema } from "effect";
import { TestClock } from "effect/testing";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, inject, it, onTestFinished, type TestContext } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import { loadWaitSeconds } from "../gen/app__browser.ts";
import { Machine as PageLayers } from "../gen/app__surface.effect.vibe";
import { Machine as WebsiteRequests } from "../gen/app__websiteRequests.effect.vibe";
import { guidedDetails, Machine as Workspaces } from "../gen/app__workspace.effect.vibe";
import { App } from "../src/App.tsx";
import { application } from "../src/app.vibe";
import { guidedPageState, privateFormRecovery } from "../src/nativePage.vibe";
import { LinkObservation } from "../src/nativePage.schema.ts";
import type { SurfacePlugin } from "../src/surfacePlugin.ts";
import { client, script, signIn } from "./cloud.vibe";
import { matchesPublicSearch, PublicSearch, publicSearchQuery } from "./browser-receipt.ts";
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

  const id = workspace().browser.selected;
  const readable = new URL("./site/index.html", import.meta.url).href;
  await visit(readable, id);
  const instruction = shown(id)?.contentDocument?.querySelector<HTMLAnchorElement>('a[href="instruction.html"]');
  if (!instruction) throw new Error("The local website did not offer its instruction page");
  instruction.click();
  await expect.element(address).toHaveValue(instruction.href);
  await expect.poll(() => tab(id)?.load).toBe("Loaded");
  const prior = tab(id)!;
  expect(prior.history.slice(-2)).toEqual([readable, instruction.href]);
  const instructionPage = shown(id)?.contentDocument;
  if (!instructionPage) throw new Error("The instruction page is unreadable");
  instructionPage.location.assign(new URL("index.html", site).href);
  await expect.poll(() => {
    const after = tab(id)!;
    return shown(id)?.contentDocument === null && after.loadVersion > prior.loadVersion && after.load === "Loaded";
  }).toBe(true);
  expect(tab(id)?.history).toEqual(prior.history);
  await expect.element(address).toHaveAccessibleDescription("");

  const unavailable = new URL(site);
  unavailable.protocol = "https:";
  await address.fill(unavailable.href);
  await enter();
  await expect.poll(() => {
    const active = tab(id);
    return shown(id)?.src === unavailable.href && active?.load !== "Loading" && active?.secure === false;
  }).toBe(true);

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
    finished: (url: string, state: Record<string, unknown> = {}) =>
      emit("navigationChanged", { exists: true, currentUrl: url, progress: 100, pageError: null, securityBlocked: false, ...state }),
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
function guidanceRecovery(instruction: string) {
  return instruction === privateFormRecovery ? "private-form" :
    instruction.startsWith("I couldn’t read this page.") ? "unobservable" :
    instruction.startsWith("The page or task changed.") ? "changed" :
    instruction === "I couldn't find a link to point to on this page." ? "no-link" :
    instruction === "I could not highlight a link on this page." ? "guide-exception" :
    /^I (couldn’t reach Grace|need you to sign in)|^Sign in to Grace/u.test(instruction) ? "guide-account" : "other";
}

type BrowserJourneyStage = "prepare-journey" | "follow-guidance" | "submit-public-search" | "observe-search-landing" |
  "tap-guide-ring" | "observe-link-landing" | "bind-native-landing" |
  "wait-for-check-controls" | "check-page" | "observe-check-result" | "confirm-completion";
type PendingPageCheck = {
  startedAt: number;
  returnedAt?: number;
  resumed: boolean;
  snapshot: "not-requested" | "requested" | "returned" | "failed";
};

it.each(inject("browserBenchmarks"))('Follow Grace to a benchmark link $titleId (spec/app/workspace.md, "Story: Follow one reviewed plan across apps")', async ({ taskId, intent, startUrl, exploratory, gradeWholeCohort, requiredStep }) => {
  const transport = commands.benchmarkSurface;
  const publicFailure = (failure: unknown, stage: "Browser setup" | "Browser journey" | "Benchmark grading or cleanup") => {
    if (failure instanceof Error && (failure.name === "TimeoutError" ||
        failure.message.startsWith("expect.poll() function didn't resolve in time") ||
        failure.message.startsWith("expect.poll() assertion didn't resolve in time"))) return new Error(`${stage} timed out`);
    if (failure instanceof Error && failure.name === "AssertionError") return new Error(`${stage} assertion failed`);
    return new Error(`${stage} failed`);
  };
  await transport({ kind: "begin", taskId });
  const read = async () => Schema.decodeUnknownSync(BrowserDocument)(await transport({ kind: "read" }));
  let selected: string | null | undefined;
  let failureStage: BrowserJourneyStage = "prepare-journey";
  let pendingCheck: PendingPageCheck | undefined;
  let guidanceSnapshot: object | "failed" | "invalid" | undefined;
  let guidanceResult: "waiting" | "link" | "menu" | "unavailable" | undefined;
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
        const failure = publicFailure(error, "Browser setup");
        outcome.browserBoundaryFailure = { operation: "createSurface", detail: failure.message };
        throw failure;
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
      const check = request.command.subaction === "snapshot" ? pendingCheck : undefined;
      const guide = failureStage === "follow-guidance" && request.command.subaction === "snapshot";
      if (check) check.snapshot = "requested";
      try {
        const observed = Schema.decodeUnknownSync(BrowserControl)(await transport({ kind: "control", request }));
        if (check) check.snapshot = "returned";
        if (guide) {
          const snapshot = Schema.decodeUnknownOption(LinkObservation)(observed);
          if (snapshot._tag === "None") guidanceSnapshot = "invalid";
          else {
            const { url, blockers, elements } = snapshot.value.result;
            const origin = URL.parse(url)?.origin;
            const usable = elements.filter(item => !item.disabled && !item.sensitive && item.inViewport && item.label);
            guidanceSnapshot = {
              eligibility: guidedPageState(snapshot.value, typedAddress() ?? "", "GuidePublicLinks"),
              blockerCount: Math.min(blockers.length, 255),
              blockers: blockers.slice(0, 8).map(({ kind, covers }) => ({
                kind: ["captcha", "login-wall", "paywall", "modal", "cookie-consent"].includes(kind) ? kind : "other",
                covers: ["partial", "viewport", "target"].includes(covers) ? covers : "other",
              })),
              visibleSameOriginLinks: Math.min(usable.filter(item => item.tag === "a" && item.href &&
                origin !== undefined && URL.parse(item.href)?.origin === origin).length, 255),
              visibleMenuControls: Math.min(usable.filter(item => item.role === "menuitem" || item.expanded !== undefined).length, 255),
            };
          }
        }
        return observed;
      } catch (error) {
        if (check) check.snapshot = "failed";
        if (guide) guidanceSnapshot = "failed";
        throw error;
      }
    },
  });
  try {
    const { cloud, secret } = await proposeRead(intent, "Review the browser step.", "ReadChangedBrowser");
    const decisions = await Effect.runPromise(decisionCloud(cloud, secret));
    await transport({ kind: "decisionRoute", cloud, deadlineMs: decisions.deadlineMs });
    const { workspace } = await launch(native.plugin, decisions.host);
    const bindNativeLanding = async (url: string, timeout: number) => {
      failureStage = "bind-native-landing";
      const beforeLoad = workspace().browser.tabs[0]?.loadVersion ?? 0;
      native.started(url);
      native.finished(url);
      await expect.poll(() => {
        const tab = workspace().browser.tabs[0];
        return { address: typedAddress(), arrived: tab !== undefined && tab.load === "Loaded" && tab.loadVersion > beforeLoad };
      }, { timeout }).toEqual({ address: url, arrived: true });
    };
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
    const record = reviewed.find(step => step.tag === "ReadLatestRecord");
    const search = reviewed.find(step => step.tag === "SearchPublicSite");
    if (named) outcome.reviewedDestination = named.subject;
    if (requiredStep) {
      outcome.reviewedSteps = reviewed.map(step => ({ kind: step.tag, subject: step.tag === "SearchPublicSite" ? step.query : guidedDetails(step).subject }));
      const matches = reviewed.some(step => step.tag === requiredStep);
      if (exploratory && !matches && reviewed.length > 0) {
        outcome.miss = "missing-reviewed-step";
        return;
      }
      expect(matches).toBe(true);
      expect(reviewed).toHaveLength(1);
    }
    await userEvent.click(page.getByRole("button", { name: "Collapse", exact: true }));
    await userEvent.click(page.getByRole("button", { name: "Start read plan" }));
    const showLink = page.getByRole("button", { name: "Show me the link" });
    const plan = page.getByRole("region", { name: "Task plan" });
    const finished = plan.getByText("Read checks complete", { exact: true });
    const continuing = page.getByRole("status", { name: "Page check result" });
    if (requiredStep === "SearchPublicSite" && search) {
      expect(search.query).toBe(publicSearchQuery(intent));
      expect(search.origin).toBe(new URL(initial.url).origin);
      outcome.operator = "trusted Chromium keyboard input in the website search field";
      failureStage = "submit-public-search";
      const submitted = Schema.decodeUnknownSync(PublicSearch)(await transport({ kind: "submitPublicSearch", query: search.query }));
      failureStage = "observe-search-landing";
      const landed = await read();
      outcome.destination = { url: landed.url, documentId: landed.documentId };
      outcome.publicSearch = submitted;
      expect(landed.documentId).not.toBe(initial.documentId);
      expect(landed.readyState).toBe("complete");
      expect(matchesPublicSearch(new URL(landed.url), submitted)).toBe(true);
      await bindNativeLanding(landed.url, 15_000);
      failureStage = "wait-for-check-controls";
      const resume = page.getByRole("button", { name: "Resume Grace", exact: true });
      await expect.element(resume, { timeout: 15_000 }).toBeVisible();
      await userEvent.click(resume);
      outcome.resumed = true;
      failureStage = "check-page";
      const check = page.getByRole("button", { name: "Check search results", exact: true });
      await userEvent.click(check);
      failureStage = "confirm-completion";
      await expect.element(finished, { timeout: 15_000 }).toBeVisible();
      expect(workspace().plan.receipts).toHaveLength(1);
      outcome.hops = [{ url: landed.url, documentId: landed.documentId, checked: true }];
      outcome.graceTerminal = plan.element().textContent;
      return;
    }
    const menuGuidance = page.getByRole("status", { name: "Open submenu guidance" });
    const linkGuidance = page.getByRole("status", { name: "Link guide result" });
    const guidanceFailure = page.getByRole("status", { name: "Link unavailable" });
    const recordRefusal = page.getByRole("status", { name: "Record check unavailable" });
    const words = (label: string) => (label.toLowerCase().replace(/[’']s\b/gu, "").match(/[\p{L}\p{N}]+/gu) ?? [])
      .map(word => word === "men" ? "man" : word === "women" ? "woman" : word.replace(/s$/u, ""));
    const namedWords = new Set(words(named?.subject ?? ""));
    const labelMatchesGoal = (label: string | undefined) => {
      const tokens = label === undefined ? [] : words(label);
      return tokens.length > 0 && tokens.every(word => namedWords.has(word));
    };
    const visited = new Set([initial.url]);
    const forwardPath = [initial.url];
    const disclosed = new Set<string>();
    const disclosures: { url: string; documentId: string; snapshotId: string; instruction: string; label: string; pointer: { x: number; y: number }; before: number; after: number }[] = [];
    outcome.disclosures = disclosures;
    const browserObservationTimeoutMs = 15_000;
    const hops: { url: string; documentId: string; checked: boolean; checkResultWaitMs: number; reason?: string | null }[] = [];
    outcome.hops = hops;
    const menuRetries: { documentId: string; instruction: string }[] = [];
    outcome.menuRetries = menuRetries;
    const actionLimit = named || record ? 8 : 1;
    const actionsTaken = () => hops.length + disclosures.length + menuRetries.length + Number(outcome.nameCorrection !== undefined);
    const stopAtActionLimit = () => {
      if (!exploratory || !(named || record) || actionsTaken() !== actionLimit) return false;
      outcome.miss = "action-budget-exhausted";
      return true;
    };
    let previous = initial;
    while (actionsTaken() < actionLimit) {
      failureStage = "follow-guidance";
      guidanceResult = "waiting";
      guidanceSnapshot = undefined;
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
        let lastInstruction: string | undefined;
        while (true) {
          if (stopAtActionLimit()) return;
          expect(actionsTaken()).toBeLessThan(actionLimit);
          await expect.poll(() => {
            const instruction = menuGuidance.query()?.textContent;
            return linkGuidance.query() !== null || guidanceFailure.query() !== null ||
              (typeof instruction === "string" && instruction !== lastInstruction);
          }, { timeout: lastInstruction === undefined ? 45_000 : 50_000 }).toBe(true);
          const failure = guidanceFailure.query();
          if (failure) {
            guidanceResult = "unavailable";
            const instruction = failure.textContent ?? "The link could not be highlighted";
            const [, branch, leaf] = instruction.match(/^The open menu (?:“[^”]+” › )*“([^”]+)” calls this link “([^”]+)”\.?$/u) ?? [];
            const branchMatches = labelMatchesGoal(branch);
            const leafMatches = labelMatchesGoal(leaf);
            const offeredControl = leaf ? `Use “${leaf}” for this step` : undefined;
            const approval = offeredControl ? page.getByRole("button", { name: offeredControl, exact: true }) : undefined;
            if (branch && leaf && approval && !outcome.nameCorrection && branchMatches && leafMatches) {
              await userEvent.click(approval);
              await expect.poll(() => plan.getByText(`Find and check “${leaf}”.`, { exact: true }).query() !== null, {
                timeout: 45_000,
              }).toBe(true);
              outcome.nameCorrection = { original: named.subject, branch, leaf, instruction, documentId: previous.documentId };
              await userEvent.click(showLink);
            } else {
              const last = disclosures.at(-1);
              const nextMenu = page.getByRole("button", { name: "Try another menu", exact: true });
              if (exploratory && branch && leaf && approval && offeredControl && approval.query() !== null &&
                  (!branchMatches || !leafMatches) && last?.documentId === previous.documentId && last.label === branch) {
                await expect.element(approval).toBeVisible();
                outcome.rejectedNameCorrection = {
                  original: named.subject, branch, leaf, offeredControl, branchMatches, leafMatches,
                  documentId: previous.documentId, instruction,
                };
                if (nextMenu.query() === null) {
                  outcome.miss = "rejected-scoped-leaf";
                  return;
                }
              }
              if (nextMenu.query() === null) {
                if (exploratory && last?.documentId === previous.documentId &&
                    (instruction === `I couldn’t see “${named.subject}” in the open menu. You can try another menu.` ||
                     instruction === `I couldn’t find “${named.subject}” in the “${last.label}” menu.`)) {
                  outcome.miss = "target-absent-from-open-menu";
                  outcome.guideResult = instruction;
                  return;
                }
                outcome.guidanceRecovery = guidanceRecovery(instruction);
                throw new Error(instruction);
              }
              await userEvent.click(nextMenu);
              menuRetries.push({ documentId: previous.documentId, instruction });
            }
            await expect.poll(() => guidanceFailure.query()?.textContent !== instruction, {
              timeout: 45_000,
            }).toBe(true);
            continue;
          }
          if (linkGuidance.query() !== null) {
            guidanceResult = "link";
            break;
          }
          guidanceResult = "menu";
          const instruction = menuGuidance.element().textContent;
          if (!instruction || instruction === lastInstruction) throw new Error("Grace did not present fresh submenu guidance");
          outcome.menuInstruction = instruction;
          outcome.menuInteraction = { instruction, documentId: previous.documentId, status: "awaiting-hover" };
          await expect.poll(async () => {
            const result = await transport({ kind: "hoverGuide" });
            outcome.menuInteraction = result;
            if (result.reason) throw new Error(typeof result.reason === "string" ? result.reason : JSON.stringify(result.reason));
            return result.disclosed === true;
          }, { timeout: 15_000 }).toBe(true);
          const evidence = Schema.decodeUnknownSync(Schema.Struct({
            disclosed: Schema.Literal(true), url: Schema.NonEmptyString, documentId: Schema.NonEmptyString,
            snapshotId: Schema.NonEmptyString, label: Schema.NonEmptyString,
            pointer: Schema.Struct({ x: Schema.Finite, y: Schema.Finite }),
            before: Schema.Int, after: Schema.Int,
          }))(outcome.menuInteraction);
          expect(evidence.url).toBe(previous.url);
          expect(evidence.documentId).toBe(previous.documentId);
          expect(instruction).toContain(`“${evidence.label}”`);
          expect(evidence.after).toBeGreaterThan(evidence.before);
          const disclosureId = JSON.stringify([evidence.documentId, evidence.snapshotId]);
          expect(disclosed.has(disclosureId)).toBe(false);
          disclosed.add(disclosureId);
          disclosures.push({ ...evidence, instruction });
          lastInstruction = instruction;
        }
      }
      if (record) await expect.element(linkGuidance.or(guidanceFailure).or(recordRefusal).first(), { timeout: 45_000 }).toBeVisible();
      if (record && guidanceFailure.query() !== null) throw new Error("Record guidance could not verify the next link");
      if (record && recordRefusal.query() !== null) {
        if (!exploratory || requiredStep !== "ReadLatestRecord") throw new Error("Record guidance stopped at an unverified collection");
        const instruction = recordRefusal.element().textContent;
        const { ringAvailable } = await transport({ kind: "inspectGuide" });
        expect(ringAvailable).toBe(false);
        const action = Schema.decodeUnknownSync(SelectorRead)(await transport({
          kind: "read", selector: "#my-orders-table tbody tr td.actions a.view",
        }));
        const current = await read();
        const last = hops.at(-1);
        expect(action.text.trim()).toBe("View Order");
        expect(action.url).toBe(current.url);
        expect(current).toMatchObject({ url: previous.url, documentId: previous.documentId, readyState: "complete" });
        expect(last).toMatchObject({ url: current.url, documentId: current.documentId, checked: false });
        const { recordSelection, receipts } = workspace().plan;
        expect(recordSelection.tag).toBe("NoGuidedRecordSelection");
        expect(receipts).toHaveLength(0);
        expect(finished.query()).toBeNull();
        outcome.recordRefusal = { kind: "record-check-unavailable", documentId: current.documentId, instruction,
          visibleAction: action.text.trim(), ringAvailable, selection: recordSelection.tag, receiptCount: receipts.length };
        outcome.miss = "insufficient-record-evidence";
        return;
      }
      const selection = workspace().plan.recordSelection;
      const bound = record && selection.tag === "StagedGuidedRecord" && selection.selection.documentId === previous.documentId
        ? selection.selection : undefined;
      const returningToRecord = record && linkGuidance.query()?.textContent?.includes("Go back one page in this list.") === true;
      failureStage = "tap-guide-ring";
      let refusal: string | undefined;
      await expect.poll(async () => {
        const unavailable = named || record ? null : guidanceFailure.query();
        if (unavailable) {
          refusal = unavailable.textContent ?? "";
          return true;
        }
        return (await transport({ kind: "tapGuide" })).tapped;
      }, { timeout: 45_000 }).toBe(true);
      if (refusal !== undefined) {
        failureStage = "follow-guidance";
        guidanceResult = "unavailable";
        outcome.guidanceRecovery = guidanceRecovery(refusal);
        outcome.linkUnavailable = true;
        throw new Error("Grace could not offer a link");
      }
      outcome.ringTap = true;
      failureStage = "observe-link-landing";
      await expect.poll(async () => {
        const document = await read();
        return document.documentId !== previous.documentId && document.readyState === "complete";
      }, { timeout: 30_000 }).toBe(true);
      const landed = await read();
      outcome.destination = { url: landed.url, documentId: landed.documentId };
      const expectedReturn = returningToRecord && forwardPath.at(-2) === landed.url;
      if (exploratory && !expectedReturn && visited.has(landed.url)) {
        outcome.miss = "repeated-address";
        return;
      }
      if (expectedReturn) {
        forwardPath.pop();
      } else {
        expect(visited.has(landed.url)).toBe(false);
        forwardPath.push(landed.url);
        visited.add(landed.url);
      }
      await bindNativeLanding(landed.url, browserObservationTimeoutMs);
      failureStage = "wait-for-check-controls";
      const resume = page.getByRole("button", { name: "Resume Grace" });
      const check = page.getByRole("button", { name: "Check page", exact: true });
      await expect.element(resume.or(check).first(), { timeout: browserObservationTimeoutMs }).toBeVisible();
      const resumed = resume.query() !== null;
      if (resumed) await userEvent.click(resume);
      failureStage = "check-page";
      const attempt: PendingPageCheck = { startedAt: performance.now(), resumed, snapshot: "not-requested" };
      pendingCheck = attempt;
      await userEvent.click(check);
      failureStage = "observe-check-result";
      const checkReturnedAt = attempt.returnedAt = performance.now();
      await expect.element(finished.or(continuing).first(), { timeout: browserObservationTimeoutMs }).toBeVisible();
      pendingCheck = undefined;
      const checked = finished.query() !== null;
      const reason = continuing.query()?.textContent;
      hops.push({ url: landed.url, documentId: landed.documentId, checked, checkResultWaitMs: Math.round(performance.now() - checkReturnedAt), reason });
      if (checked && record) {
        const receipts = workspace().plan.receipts;
        if (!bound || bound.documentId !== previous.documentId || bound.documentId === landed.documentId ||
            receipts.length !== 1 || receipts[0]?.sourceKey !== bound.key)
          throw new Error("The checked detail did not complete the reviewed record selection");
        outcome.checkedRecord = { collectionDocument: previous.documentId, detailDocument: landed.documentId };
      }
      if (checked) break;
      expect(named ?? record).toBeDefined();
      if (named) expect([`I couldn’t verify “${named.subject}” on this page. Check the page again or try another link.`, privateFormRecovery]).toContain(reason);
      if (record) await expect.element(continuing).toBeVisible();
      expect(workspace().plan.receipts).toHaveLength(0);
      previous = landed;
    }
    if (!hops.at(-1)?.checked && stopAtActionLimit()) return;
    failureStage = "confirm-completion";
    await expect.element(finished).toBeVisible();
    outcome.graceTerminal = plan.element().textContent;
  } catch (error) {
    const failure = publicFailure(error, "Browser journey");
    outcome.failure = failure.message;
    outcome.failureStage = failureStage;
    if (failureStage === "follow-guidance") outcome.guidanceFailure = {
      result: guidanceResult, snapshot: guidanceSnapshot ?? "not-requested",
    };
    if (pendingCheck) {
      const endedAt = performance.now();
      const { startedAt, returnedAt, resumed, snapshot } = pendingCheck;
      outcome.pageCheckFailure = {
        elapsedMs: Math.round(endedAt - startedAt), resumed, snapshot,
        ...(returnedAt === undefined ? {} : { checkResultWaitMs: Math.round(endedAt - returnedAt) }),
      };
      pendingCheck = undefined;
    }
    if (failureStage === "tap-guide-ring") outcome.linkUnavailable = page.getByRole("status", { name: "Link unavailable", exact: true }).query() !== null;
    if (!gradeWholeCohort) throw failure;
  } finally {
    await transport({ kind: "receipt", outcome }).catch((error: unknown) => {
      throw publicFailure(error, "Benchmark grading or cleanup");
    });
  }
}, 240_000);

async function startBrowserReadPlan(
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

async function prepareBillWorldStatement(attempt: string, billerId: string | undefined, context: TestContext) {
  const transport = async (action: Parameters<typeof commands.releasedStatement>[1]) => {
    context.signal.throwIfAborted();
    const result = await commands.releasedStatement(attempt, action);
    context.signal.throwIfAborted();
    return result;
  };
  const statement = Schema.decodeUnknownSync(Schema.Struct({
    url: Schema.NonEmptyString, taskId: Schema.NonEmptyString, question: Schema.NonEmptyString,
  }))(await transport({ kind: "prepare", billerId }));
  expect(statement.taskId).toBe(billerId === undefined ? "task_md9" : billerId + ":view-bill");
  return { ...statement, transport };
}

async function readBillWorldStatement(billerId: string | undefined, refuses: true | undefined, context: TestContext, prepared: Awaited<ReturnType<typeof prepareBillWorldStatement>>) {
  const { url, taskId, question, transport } = prepared;
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
  await startBrowserReadPlan({ ui, workspace }, { url, question, askWith: "keyboard" });
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
  const before = observations;
  await userEvent.click(check);
  if (refuses) {
    await expect.poll(() => observations).toBeGreaterThan(before);
    await expect.element(check).toBeEnabled();
    expect(complete.query()).toBeNull();
    const grade = await transport({ kind: "answer", text: "" });
    expect(grade).toMatchObject({ success: false, taskId, predicateSource: "task",
      results: [{ pass: true }, { pass: true }, { pass: false }, { pass: true }, { pass: true }],
    });
    return;
  }
  await expect.element(complete).toBeVisible();
  await userEvent.click(ui.getByRole("button", { name: "Expand", exact: true }));
  const answer = ui.getByRole("region", { name: "Task plan" }).getByText(/^[^:]+: (?:[-−]?[$£€]|USD |EUR |GBP |\d)[^:]*\. [^:]+: .+\.$/u);
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
}

for (const { billerId, label, refuses } of inject("billworldStatements")) {
  describe("BillWorld", () => {
    let attempt: string;
    let prepared: Awaited<ReturnType<typeof prepareBillWorldStatement>> | undefined;
    beforeEach(async (context) => {
      attempt = crypto.randomUUID();
      prepared = undefined;
      if (billerId !== undefined) prepared = await prepareBillWorldStatement(attempt, billerId, context);
    }, 240_000);
    afterEach(async () => { await commands.releasedStatement(attempt, { kind: "close" }); });
    it(`Read the ${label} BillWorld statement (spec/app/workspace.md, "Story: Follow one reviewed plan across apps")`, { timeout: 120_000 }, async (context) => {
      if (billerId !== undefined && prepared === undefined) throw new Error("The Fleet statement fixture did not finish before the journey");
      await readBillWorldStatement(billerId, refuses, context, prepared ?? await prepareBillWorldStatement(attempt, billerId, context));
    });
  });
}

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
  const arrive = async (url: string) => {
    device.started(url);
    device.finished(url);
    await expect.poll(at).toEqual({ url, load: "Loaded", address: url });
  };

  device.refused.creates = 1;
  await userEvent.click(page.getByRole("button", { name: "Internet" }));
  await expect.element(address).toHaveAccessibleDescription("");
  await userEvent.type(address, "example.com{Enter}");
  await expect.poll(at).toEqual({ url: "https://example.com/", load: "LoadFailed", address: "https://example.com/" });
  await expect.element(address).toHaveAccessibleDescription("");
  expect(device.called("createSurface")).toHaveLength(1);
  await userEvent.click(page.getByRole("button", { name: "Try again" }));
  await expect.poll(() => device.called("createSurface")).toHaveLength(2);
  await arrive("https://example.com/");
  await expect.element(address).toHaveAccessibleDescription("Encrypted connection");

  const entries = tab().history.length;
  await arrive("https://example.com/b");
  expect(tab().history).toHaveLength(entries + 1);
  device.started("https://example.com/c");
  await expect.poll(at).toEqual({ url: "https://example.com/c", load: "Loading", address: "https://example.com/c" });
  await expect.element(address).toHaveAccessibleDescription("");
  await arrive("https://example.com/next");
  expect(tab().history).toHaveLength(entries + 2);
  await userEvent.click(page.getByRole("button", { name: "Back" }));
  await expect.poll(() => count("goBack")).toBe(1);
  await arrive("https://example.com/b");

  device.crashed();
  await expect.poll(() => device.called("createSurface").at(-1)?.url).toBe("https://example.com/b");
  device.started();
  device.finished("https://example.com/b");
  await userEvent.click(page.getByRole("button", { name: "Back" }));
  await expect.poll(() => ({ navigated: device.called("navigate").map((n) => n.url), back: count("goBack") })).toEqual({ navigated: ["https://example.com/"], back: 1 });
  await arrive("https://example.com/");
  await expect.element(address).toHaveAccessibleDescription("Encrypted connection");
  await userEvent.type(address, "x");
  await expect.element(address).toHaveAccessibleDescription("");
  const go = async (text: string, url: string) => {
    await userEvent.fill(address, text);
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => device.called("navigate").at(-1)?.url).toBe(url);
  };

  await go("example.com/start", "https://example.com/start");
  const history = tab().history.length;
  await arrive("https://www.example.com/home");
  expect(tab().history).toHaveLength(history);
  await expect.element(address).toHaveAccessibleDescription("Encrypted connection");
  const navigated = count("navigate");
  await userEvent.click(page.getByRole("button", { name: "Back" }));
  await expect.poll(() => count("goBack")).toBe(2);
  expect(count("navigate")).toBe(navigated);
  await arrive("https://example.com/");

  await later(loadWaitSeconds - 10);
  await go("example.com/slow", "https://example.com/slow");
  await later(10);
  expect(tab().load).toBe("Loading");
  await later(loadWaitSeconds - 10);
  await expect.poll(at).toEqual({ url: "https://example.com/slow", load: "LoadFailed", address: "https://example.com/slow" });
  expect(device.called("stopLoading")).toHaveLength(1);
  await expect.element(address).toHaveAccessibleDescription("");
  await userEvent.click(page.getByRole("button", { name: "Try again" }));
  await expect.poll(() => count("navigate")).toBe(navigated + 2);
  expect({ to: device.called("navigate").at(-1)?.url, reloaded: count("reloadSurface") }).toEqual({ to: "https://example.com/slow", reloaded: 0 });
  device.started("https://example.com/slow");
  device.finished("https://example.com/slow", { securityBlocked: true, pageError: "net::ERR_CERT_DATE_INVALID" });
  await expect.poll(at).toEqual({ url: "https://example.com/slow", load: "SecurityBlocked", address: "https://example.com/slow" });
  await expect.element(address).toHaveAccessibleDescription("");

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
  device.ask("sitePermissionRequested", { requestId: "camera-1", origin: "https://example.com", kinds: ["camera"], topFrame: true });
  const refuse = question.getByRole("button", { name: "Don't allow" });
  await expect.element(refuse).toBeVisible();
  device.ask("dialogRequested", { dialogId: "hello-1", kind: "alert", message: "Welcome back" });
  await later(loadWaitSeconds + 10);
  expect(tab().load).toBe("Loading");
  await userEvent.click(refuse);
  await expect.element(question.getByText("Welcome back")).toBeVisible();
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
  await expect.element(address).toHaveAccessibleDescription("Encrypted connection");
  await later(loadWaitSeconds);
  expect(tab().load).toBe("Loaded");

  await go("http://example.com/plain", "http://example.com/plain");
  await arrive("http://example.com/plain");
  await expect.element(address).toHaveAccessibleDescription("");

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

it.each(["later winner", "earlier winner", "tied latest", "changed scope", "mismatched detail", "wrong record kind", "ambiguous collection", "conflicting counts", "unclear count", "conflicting account", "private form", "newsletter list", "unverified account", "same-name account switch", "short dates", "public list"] as const)('Check the latest item across record pages ($0) (spec/app/workspace.md, "Story: Follow one reviewed plan across apps")', async (scenario) => {
  localStorage.clear();
  const status = scenario === "earlier winner" ? "cancelled" : "completed";
  const requested = `Show the most recent ${status} order`;
  const cloud = inject("cloud");
  const { secret } = await Effect.runPromise(Effect.provide(signIn(cloud), client));
  await Effect.runPromise(Effect.provide(script(cloud, secret, [{
    said: requested, answer: JSON.stringify({ text: "Review this record selection.", isQuestion: false, answers: [],
      actions: [{ kind: "proposeReadPlan", steps: [{ kind: "ReadLatestRecord", collection: "Order", status }] }] }),
  }]), client));
  const decisions = await Effect.runPromise(decisionCloud(cloud, secret));
  const route = commands.recordPage;
  const { url } = Schema.decodeUnknownSync(Schema.Struct({ url: Schema.NonEmptyString }))(await route({
    kind: "open", scenario, decisionUrl: new URL("/api/v1/decisions", cloud).href,
  }));
  onTestFinished(() => route({ kind: "close" }).then(() => undefined));
  let shown: string | null | undefined;
  const native = androidPagePluginAtItsBoundary({
    createSurface(request) {
      if (request.url !== url) return Promise.reject(new Error("The record fixture address changed"));
      native.started(url);
      native.finished(url);
      return Promise.resolve();
    },
    presentSurface(request) {
      shown = request.id;
      return Promise.resolve();
    },
    async readPage(request) {
      if (request.id !== shown) throw new Error("The record fixture is not in front");
      return Schema.decodeUnknownSync(SelectorRead)(await route({ kind: "read", selector: request.selector }));
    },
    async controlPage(request) {
      if (request.id !== shown && request.command.guidance?.kind !== "hide") throw new Error("The record fixture is not in front");
      return Schema.decodeUnknownSync(BrowserControl)(await route({ kind: "control", request }));
    },
  });
  const { ui, workspace } = await launch(native.plugin, decisions.host);
  await startBrowserReadPlan({ ui, workspace }, { url, question: requested, askWith: "pointer" });
  const show = ui.getByRole("button", { name: "Show me the link", exact: true });
  const check = ui.getByRole("button", { name: "Check page", exact: true });
  const next = (path: string) => new URL(path, url).href;
  const follow = async (path: string, label?: "View order" | "My Account") => {
    if (label) expect((await route({ kind: "manualRecordLink", label })).tapped).toBe(true);
    else await expect.poll(async () => (await route({ kind: "tapGuide" })).tapped, { timeout: 15_000 }).toBe(true);
    const destination = next(path);
    await expect.poll(async () => {
      const landed = await route({ kind: "read" });
      return { url: landed.url, readyState: landed.readyState };
    }, { timeout: 15_000 }).toEqual({ url: destination, readyState: "complete" });
    native.started(destination);
    native.finished(destination);
    await expect.poll(() => ({ address: typedAddress(), load: workspace().browser.tabs[0]?.load })).toEqual({ address: destination, load: "Loaded" });
    const resume = ui.getByRole("button", { name: "Resume Grace", exact: true });
    await expect.element(resume).toBeVisible();
    expect(workspace().assistant.activity).toBe("Paused");
    expect(workspace().plan.receipts).toHaveLength(0);
    await userEvent.click(resume);
    await expect.poll(() => workspace().assistant.activity).toBe("Rechecking");
  };
  const point = async () => {
    await userEvent.click(show);
    await expect.element(ui.getByRole("status", { name: "Link guide result" }), { timeout: 15_000 }).toBeVisible();
  };
  if (scenario === "same-name account switch") {
    const readRecordRow = async () => Schema.decodeUnknownSync(SelectorRead)(await route({ kind: "read", selector: "main table tbody tr" })).text;
    const preview = await readRecordRow();
    await point();
    await follow("/list");
    expect(await readRecordRow()).toBe(preview);
    await userEvent.click(show);
    await expect.element(ui.getByRole("status", { name: "Record check unavailable" }), { timeout: 15_000 }).toBeVisible();
    expect(await route({ kind: "inspectGuide" })).toEqual({ ringAvailable: false });
    const checkUnverified = async () => {
      await userEvent.click(check);
      await expect.element(ui.getByRole("status", { name: "Page check result" }), { timeout: 15_000 }).toBeVisible();
      expect(workspace().plan).toMatchObject({ recordSelection: { tag: "NoGuidedRecordSelection" }, receipts: [] });
    };
    await follow("/view/1", "View order");
    await checkUnverified();
    await follow("/home", "My Account");
    await checkUnverified();
    expect(await route({ kind: "accountVisits" })).toEqual({ visits: ["/home:A", "/list:B", "/view/1:B", "/home:A"] });
    expect(await route({ kind: "requests" })).toEqual({ count: 0, leaked: false });
    return;
  }
  if (["ambiguous collection", "conflicting counts", "unclear count", "conflicting account", "private form", "newsletter list", "unverified account", "short dates"].includes(scenario)) {
    await userEvent.click(show);
    await expect.element(ui.getByRole("status", { name: scenario === "ambiguous collection" ? "Link unavailable" : "Record check unavailable" }), { timeout: 15_000 }).toBeVisible();
    expect(await route({ kind: "inspectGuide" })).toEqual({ ringAvailable: false });
    expect(workspace().plan).toMatchObject({ recordSelection: { tag: "NoGuidedRecordSelection" }, receipts: [] });
    expect(await route({ kind: "requests" })).toEqual({ count: 0, leaked: false });
    return;
  }
  if (scenario === "public list") {
    await point();
    await follow("/view/1");
    await userEvent.click(check);
    await expect.element(ui.getByText("Read checks complete", { exact: true }), { timeout: 15_000 }).toBeVisible();
    expect(workspace().plan.receipts).toMatchObject([{ evidence: "Checked the latest matching record." }]);
    expect(await route({ kind: "requests" })).toEqual({ count: 0, leaked: false });
    return;
  }
  if (scenario === "later winner") {
    await point();
    await follow("/list");
    expect(workspace().plan.receipts).toHaveLength(0);
  }
  await point();
  await follow("/list?page=2");
  expect(workspace().plan.receipts).toHaveLength(0);
  await userEvent.click(show);
  if (scenario === "tied latest" || scenario === "changed scope") {
    await expect.element(ui.getByRole("status", { name: scenario === "changed scope" ? "Link unavailable" : "Record check unavailable" }), { timeout: 15_000 }).toBeVisible();
    expect(await route({ kind: "inspectGuide" })).toEqual({ ringAvailable: false });
    expect(workspace().plan).toMatchObject({ recordSelection: { tag: "NoGuidedRecordSelection" }, receipts: [] });
  } else {
    await expect.element(ui.getByRole("status", { name: "Link guide result" }), { timeout: 15_000 }).toBeVisible();
    if (scenario === "earlier winner") {
      await follow("/list");
      await point();
    }
    await follow(scenario === "earlier winner" ? "/view/1" : "/view/2");
    await userEvent.click(check);
    if (scenario === "mismatched detail" || scenario === "wrong record kind") {
      await expect.element(ui.getByRole("status", { name: "Page check result" }), { timeout: 15_000 }).toBeVisible();
      expect(workspace().plan.receipts).toHaveLength(0);
    } else {
      await expect.element(ui.getByText("Read checks complete", { exact: true }), { timeout: 15_000 }).toBeVisible();
      expect(workspace().plan.receipts).toMatchObject([{ evidence: "Checked the latest matching record." }]);
      expect(JSON.stringify(workspace().plan.receipts)).not.toContain("private-canary");
    }
  }
  expect(await route({ kind: "requests" })).toEqual({ count: 0, leaked: false });
}, 120_000);

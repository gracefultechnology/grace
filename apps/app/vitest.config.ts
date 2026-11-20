import tailwindcss from "@tailwindcss/vite";
import { defaultClientConditions } from "vite";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Schema } from "effect";
import type { BrowserContext, CDPSession, Page } from "playwright";
import { defineConfig } from "vitest/config";
import type { BrowserCommandContext } from "vitest/node";
import { project } from "vibestack/testing/vitest";
import type { SurfacePlugin } from "./src/surfacePlugin.ts";
import { releasedBillworld } from "./test/billworld-released.fixture.ts";
import { hasHostedNavigation } from "./test/browser-receipt.ts";
import { fleetFixture, fleetStatement, fleetStatementCases } from "./test/fleet.fixture.ts";
import { webArena } from "./test/webarena.ts";

const base = project({ root: import.meta.dirname, plugins: [tailwindcss()] });

type Command = Parameters<SurfacePlugin["controlPage"]>[0];
const BenchmarkDefinition = Schema.Struct({
  taskId: Schema.NonEmptyString,
  intent: Schema.NonEmptyString,
  startUrl: Schema.NonEmptyString,
  fixtureChoice: Schema.optional(Schema.NonEmptyString),
  chat: Schema.optional(Schema.Literal("upstream")),
  siteStorageState: Schema.optional(Schema.NonEmptyString),
  evaluator: Schema.optional(Schema.Literal("webarena")),
  requiredStep: Schema.optional(Schema.Literal("ReachNamedPage")),
  receipt: Schema.NonEmptyString,
});
type BenchmarkDefinition = typeof BenchmarkDefinition.Type;
if ((process.env.GRACE_BILLWORLD_SHARD !== undefined || process.env.GRACE_BILLWORLD_RESUME_DIR !== undefined) &&
    !process.env.GRACE_BILLWORLD_DIR)
  throw new Error("Fleet shard and resume settings require GRACE_BILLWORLD_DIR");
if (process.env.GRACE_BILLWORLD_DIR && process.env.GRACE_BROWSER_BENCHMARK_FILE)
  throw new Error("Run Fleet separately from browser tasks declared in an external file");
const host: NodeJS.Process & { graceFleet?: ReturnType<typeof fleetFixture> } = process;
const fleet = process.env.GRACE_BILLWORLD_DIR
  ? await (host.graceFleet ??= fleetFixture(process.env.GRACE_BILLWORLD_DIR, process.env.GRACE_BILLWORLD_RESULTS ?? ".cache/grace-billworld", process.env.GRACE_BILLWORLD_SHARD, process.env.GRACE_BILLWORLD_RESUME_DIR))
  : undefined;
const definitions: unknown = process.env.GRACE_BROWSER_BENCHMARK_FILE
  ? JSON.parse(readFileSync(process.env.GRACE_BROWSER_BENCHMARK_FILE, "utf8"))
  : fleet?.definitions ?? [];
const runs = Schema.decodeUnknownSync(Schema.Array(BenchmarkDefinition), { onExcessProperty: "error" })(Array.isArray(definitions) ? definitions : [definitions]);
const byId = new Map(runs.map((item) => [item.taskId, item]));
if (byId.size !== runs.length || new Set(runs.map(({ receipt }) => receipt)).size !== runs.length)
  throw new Error("Benchmark task IDs and receipt paths must be unique");
const officialCases = runs.filter(({ evaluator }) => evaluator === "webarena");
const officialGrades = new Map<string, ReturnType<ReturnType<typeof webArena>>>();
if (officialCases.length) {
  const checkout = process.env.GRACE_WEBARENA_UPSTREAM;
  const python = process.env.GRACE_WEBARENA_PYTHON;
  if (!checkout || !python) throw new Error("WebArena grading needs GRACE_WEBARENA_UPSTREAM and GRACE_WEBARENA_PYTHON");
  const prepare = webArena({ checkout, python });
  for (const fixture of officialCases) officialGrades.set(fixture.taskId, prepare(fixture));
}
type SiteAction =
  | { kind: "begin"; taskId: string }
  | { kind: "open"; url: string }
  | { kind: "read"; selector?: string }
  | { kind: "tapGuide" }
  | { kind: "hoverGuide" }
  | { kind: "decisionRoute"; cloud: string; deadlineMs: number }
  | { kind: "receipt"; outcome: Record<string, unknown> }
  | { kind: "control"; request: Command };

type Site = { page: Page; origin: string; browser: BrowserContext; session: CDPSession; world?: { loaderId: string; executionContextId: number } };
const DecisionResult = Schema.Struct({ status: Schema.String, model: Schema.optional(Schema.String), choice: Schema.optional(Schema.NullOr(Schema.String)), confidence: Schema.optional(Schema.Finite) });
type Run = { fixture: BenchmarkDefinition; decisions: number; decisionResults: { http: number; candidates: number; result?: typeof DecisionResult.Type }[]; chatStatus?: number; chatRoute?: string; decisionRoute?: string; site?: Site };
const activeRuns = new WeakMap<Page, Run>();
const Choices = Schema.Struct({ kind: Schema.Literal("choice"), goal: Schema.NonEmptyString, candidates: Schema.Array(Schema.Struct({ id: Schema.NonEmptyString, label: Schema.NonEmptyString })) });
const PageText = Schema.Struct({ title: Schema.String, text: Schema.String, truncated: Schema.Boolean, readyState: Schema.Literals(["loading", "interactive", "complete"]) });
const SiteState = Schema.Struct({
  cookies: Schema.Array(Schema.Struct({
    name: Schema.NonEmptyString, value: Schema.String, domain: Schema.NonEmptyString, path: Schema.NonEmptyString,
    expires: Schema.Finite, httpOnly: Schema.Boolean, secure: Schema.Boolean, sameSite: Schema.Literals(["Strict", "Lax", "None"]),
  })),
  origins: Schema.Array(Schema.Struct({
    origin: Schema.NonEmptyString, localStorage: Schema.Array(Schema.Struct({ name: Schema.String, value: Schema.String })),
  })),
});
async function source(file: "command" | "guidance", entry: "pageCommand" | "pageGuidance") {
  const location = new URL(`../../vendor/eliza/packages/os/browser/src/page-${file}.mjs`, import.meta.url);
  const exports = Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.Unknown))(await import(location.href));
  const run = exports[entry];
  if (typeof run !== "function") throw new Error("The pinned browser command is missing");
  return Function.prototype.toString.call(run);
}

async function benchmarkSurface(context: BrowserCommandContext, action: SiteAction) {
  if (action.kind === "begin") {
    const fixture = byId.get(action.taskId);
    if (!fixture || activeRuns.has(context.page)) throw new Error("The Chromium benchmark case is not available");
    activeRuns.set(context.page, { fixture, decisions: 0, decisionResults: [] });
    return {};
  }
  const run = activeRuns.get(context.page);
  if (!run) throw new Error("No benchmark fixture was supplied to the Chromium transport");
  const { fixture: definition } = run;
  if (action.kind === "decisionRoute") {
    const endpoint = new URL("/api/v1/decisions", action.cloud);
    if (!["127.0.0.1", "localhost"].includes(endpoint.hostname)) throw new Error("Fixture decision routes are local");
    run.decisionRoute = endpoint.href;
    if (definition.chat === "upstream") {
      const origin = process.env.GRACE_BENCHMARK_CLEF_ORIGIN;
      const key = process.env.GRACE_BENCHMARK_CLEF_KEY;
      if (!origin || !key || new URL(origin).protocol !== "https:") throw new Error("The upstream chat endpoint requires a test credential");
      run.chatRoute = new URL("/api/v1/chat/completions", action.cloud).href;
      await context.page.route(run.chatRoute, async (route) => {
        const request = route.request();
        const headers = { "access-control-allow-origin": request.headers().origin ?? "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "Authorization, Content-Type" };
        if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
        const response = await fetch(new URL("/api/v1/chat/completions", origin), {
          method: "POST", body: request.postData(), headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          redirect: "error", signal: AbortSignal.timeout(45000),
        }).catch(() => new Response(null, { status: 503 }));
        run.chatStatus = response.status;
        return route.fulfill({ status: response.status, headers, contentType: response.headers.get("content-type") ?? "application/json", body: await response.text() });
      });
    }
    await context.page.route(endpoint.href, async (route) => {
      const request = route.request();
      const headers = {
        "access-control-allow-origin": request.headers().origin ?? "*",
        "access-control-allow-methods": "OPTIONS, POST",
        "access-control-allow-headers": "Authorization, Content-Type",
      };
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
      const choice = Schema.decodeUnknownSync(Choices)(request.postDataJSON());
      run.decisions++;
      if (definition.fixtureChoice !== undefined) {
        const selected = choice.candidates.find(({ label }) => label === definition.fixtureChoice);
        const id = selected?.id ?? "none";
        return route.fulfill({ headers, json: { status: "ok", kind: "choice", choice: selected?.id ?? null,
          model: "fixture", confidence: 1, probabilities: Object.fromEntries([...choice.candidates.map(({ id }) => id), "none"].map((option) => [option, option === id ? 1 : 0])) } });
      }
      const origin = process.env.GRACE_BENCHMARK_CLEF_ORIGIN;
      const key = process.env.GRACE_BENCHMARK_CLEF_KEY;
      if (!origin || !key || new URL(origin).protocol !== "https:") throw new Error("The hosted decision service is not configured");
      const response = await fetch(new URL("/api/v1/decisions", origin), {
        method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(choice), redirect: "error", signal: AbortSignal.timeout(action.deadlineMs),
      }).catch(() => new Response('{"status":"unavailable","reason":"provider_error"}', { status: 503 }));
      const body = await response.text();
      const decoded = Schema.decodeUnknownOption(Schema.fromJsonString(DecisionResult))(body);
      run.decisionResults.push({ http: response.status, candidates: choice.candidates.length, result: decoded._tag === "Some" ? decoded.value : undefined });
      return route.fulfill({ headers, status: response.status, contentType: "application/json", body });
    });
    return {};
  }
  if (action.kind === "receipt") {
    try {
      const decisionProvider = definition.fixtureChoice === undefined ? "hosted" : "fixture";
      const observation = {
        surface: "desktop-chromium", taskId: definition.taskId, intent: definition.intent, startUrl: definition.startUrl,
        decisionProvider, decisionRequests: run.decisions, syntheticStorageState: Boolean(run.site && definition.siteStorageState),
        decisionServiceOrigin: decisionProvider === "hosted" && process.env.GRACE_BENCHMARK_CLEF_ORIGIN
          ? new URL(process.env.GRACE_BENCHMARK_CLEF_ORIGIN).origin : undefined,
        outcome: { ...action.outcome, chatProvider: definition.chat ?? "fixture" }, chatStatus: run.chatStatus,
        decisionResults: run.decisionResults,
      };
      const guided = hasHostedNavigation(observation, run.site?.page.url());
      const grade = await fleet?.grade(definition.taskId, run.site?.page, guided);
      const webArenaGrade = await officialGrades.get(definition.taskId)?.(action.outcome, {
        guided, authenticatedFixture: Boolean(run.site && definition.siteStorageState),
      }).catch((error: unknown) => ({ failure: error instanceof Error ? error.message : String(error) }));
      const receipt = { ...observation, grade, webArena: webArenaGrade };
      if (fleet) fleet.record(definition.taskId, receipt);
      else writeFileSync(definition.receipt, `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx", mode: 0o600 });
      if (webArenaGrade && (!("officialScore" in webArenaGrade) || webArenaGrade.officialScore !== 1))
        throw new Error("The pinned WebArena evaluator did not score the observed document as a match");
      if (webArenaGrade && decisionProvider === "hosted" && !webArenaGrade.qualifiedHostedGuidance)
        throw new Error("The WebArena landing has no verified hosted guidance");
    } finally {
      activeRuns.delete(context.page);
      if (run.decisionRoute) await context.page.unroute(run.decisionRoute);
      if (run.chatRoute) await context.page.unroute(run.chatRoute);
      await run.site?.browser.close();
    }
    return {};
  }
  const existing = run.site;
  if (action.kind === "open") {
    const start = new URL(action.url);
    const { origin } = start;
    if (start.href !== new URL(definition.startUrl).href || start.protocol !== "https:" || !["127.0.0.1", "localhost"].includes(start.hostname) || existing)
      throw new Error("A benchmark instance opens one local synthetic website");
    const storage = definition.siteStorageState === undefined ? undefined
      : Schema.decodeUnknownSync(SiteState)(JSON.parse(readFileSync(definition.siteStorageState, "utf8")));
    if (storage && (!storage.cookies.length || storage.cookies.some(({ domain }) => domain !== start.hostname) || storage.origins.some((stored) => stored.origin !== origin)))
      throw new Error("Benchmark storage state must belong only to the declared synthetic website");
    const browser = await context.context.browser()?.newContext({
      ignoreHTTPSErrors: true,
      ...(storage && { storageState: { cookies: [...storage.cookies], origins: storage.origins.map(({ origin, localStorage }) => ({ origin, localStorage: [...localStorage] })) } }),
    });
    if (!browser) throw new Error("The benchmark needs a Chromium browser context");
    const website = await browser.newPage();
    run.site = { page: website, origin, browser, session: await browser.newCDPSession(website) };
    await website.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const response = await website.goto(action.url, { waitUntil: "load" });
    if (!response?.ok()) throw new Error("The benchmark site did not load");
    return { url: website.url() };
  }
  if (!existing) throw new Error("The Chromium benchmark site is not open");
  return observeSite(existing, action);
}

type SiteObservation = Extract<SiteAction, { kind: "read" | "tapGuide" | "hoverGuide" | "control" }>;

async function observeSite(existing: Site, action: SiteObservation) {
  const { page, origin, session } = existing;
  const { frameTree } = await session.send("Page.getFrameTree");
  const { id, loaderId, url } = frameTree.frame;
  if (new URL(url).origin !== origin) throw new Error("The site left its benchmark origin");
  if (existing.world?.loaderId !== loaderId) {
    const { executionContextId } = await session.send("Page.createIsolatedWorld", { frameId: id, worldName: "grace-benchmark" });
    existing.world = { loaderId, executionContextId };
  }
  const { executionContextId } = existing.world;
  const evaluate = async (expression: string): Promise<unknown> => {
    const value = await session.send("Runtime.evaluate", { expression, contextId: executionContextId, returnByValue: true });
    if (value.exceptionDetails) throw new Error(value.exceptionDetails.text);
    return value.result.value;
  };
  if (action.kind === "read") {
    if (action.selector !== undefined) {
      const reader = readFileSync(new URL("../../vendor/eliza/packages/os/android/browser-surface/resources/read-page.js", import.meta.url), "utf8");
      const result = Schema.decodeUnknownSync(Schema.Struct({
        url: Schema.String, title: Schema.String, text: Schema.String, truncated: Schema.Boolean,
      }))(await evaluate(`(${reader})(${JSON.stringify(action.selector)})`));
      const { frameTree: current } = await session.send("Page.getFrameTree");
      if (current.frame.loaderId !== loaderId || result.url !== url) throw new Error("The website document changed during the read");
      return result;
    }
    const content = await evaluate(`(() => {
      const text = document.body?.innerText ?? "";
      return { title: document.title, text: text.slice(0, 6000), truncated: text.length > 6000, readyState: document.readyState };
    })()`);
    return { url, documentId: loaderId, ...Schema.decodeUnknownSync(PageText)(content) };
  }
  if (action.kind === "tapGuide" || action.kind === "hoverGuide") {
    await page.bringToFront();
    const point = Schema.decodeUnknownSync(Schema.NullOr(Schema.Struct({
      x: Schema.Finite, y: Schema.Finite, snapshotId: Schema.String, menu: Schema.Boolean, label: Schema.String,
    })))(await evaluate(`(() => {
      const guide = globalThis.__elizaPageGuidanceV1;
      const snapshot = globalThis.__elizaBrowserControlV1;
      if (!guide?.visible || guide.invalidated || guide.paused || !guide.host.isConnected ||
          snapshot?.document !== document || snapshot.url !== location.href || snapshot.snapshotId !== guide.id) return null;
      const node = snapshot.nodes.get(guide.nodeId)?.node;
      const ring = guide.shadow.querySelector(".ring");
      if (!node?.isConnected || !ring || ring.hidden || !ring.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return null;
      const rect = ring.getBoundingClientRect();
      const view = visualViewport;
      if (!view || rect.width <= 0 || rect.height <= 0 || rect.left < view.offsetLeft || rect.top < view.offsetTop ||
          rect.right > view.offsetLeft + view.width || rect.bottom > view.offsetTop + view.height) return null;
      const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
      const menu = Boolean(node.closest('[role="menuitem"]:is([aria-haspopup="true"],[aria-haspopup="menu"])'));
      const label = (node.getAttribute("aria-label") || node.innerText || "").trim().slice(0, 100);
      return node.contains(document.elementFromPoint(x, y)) ? { x, y, snapshotId: guide.id, menu, label } : null;
    })()`));
    if (!point) return { tapped: false, disclosed: false, url };
    const { frameTree: current } = await session.send("Page.getFrameTree");
    if (current.frame.loaderId !== loaderId || current.frame.url !== url) return { tapped: false, disclosed: false, url };
    if (action.kind === "hoverGuide") {
      if (!point.menu) return { disclosed: false, url, reason: "The highlighted control has no declared menu", label: point.label };
      const { x, y, snapshotId } = point;
      const selectVisibleChildren = ({ x, y }: { x: number; y: number }) => {
        const menu = document.elementFromPoint(x, y)?.closest('[role="menuitem"][aria-haspopup]');
        const item = menu?.closest('li,[role="presentation"],[role="none"]');
        const controlled = menu?.getAttribute("aria-controls");
        const declared = controlled ? document.getElementById(controlled) : null;
        const submenu = declared ?? item?.querySelector('[role="menu"],ul,ol');
        const items = submenu?.querySelectorAll('[role="menuitem"],a[href],button') ?? [];
        return [...items].filter((entry) => {
          const rect = entry.getBoundingClientRect();
          return entry.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && rect.width > 0 && rect.height > 0 &&
            entry.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
        }).length;
      };
      const before = await page.evaluate(selectVisibleChildren, { x, y });
      if (before !== 0) return { disclosed: false, url, reason: "The menu was already open", before, label: point.label };
      await page.mouse.move(x, y);
      await page.waitForFunction(selectVisibleChildren, { x, y }, { timeout: 8000 });
      const after = await page.evaluate(selectVisibleChildren, { x, y });
      const { frameTree: revealed } = await session.send("Page.getFrameTree");
      if (after <= before || revealed.frame.loaderId !== loaderId || revealed.frame.url !== url)
        return { disclosed: false, url };
      return { disclosed: true, url, label: point.label, documentId: loaderId, snapshotId, pointer: { x, y }, before, after };
    }
    await page.mouse.click(point.x, point.y);
    return { tapped: true, url };
  }
  const { request } = action;
  const { command } = request;
  if (command.subaction !== "snapshot" && command.subaction !== "guide")
    throw new Error("The benchmark surface accepts only observation and show-only guidance");
  if (command.subaction === "guide" && command.guidance?.kind !== "hide" &&
      (request.documentId !== loaderId || command.guidance?.kind !== "show" || command.guidance.action !== undefined || command.guidance.origin !== origin))
    throw new Error("The benchmark guide no longer belongs to the current document");
  const snapshotId = command.subaction === "snapshot" ? randomUUID() : undefined;
  const expression = snapshotId
    ? `(${await source("command", "pageCommand")})(${JSON.stringify(command)}, ${JSON.stringify(snapshotId)})`
    : `(${await source("guidance", "pageGuidance")})(${JSON.stringify(command.guidance)})`;
  const result = Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.Unknown))(await evaluate(expression));
  const { frameTree: after } = await session.send("Page.getFrameTree");
  if (after.frame.loaderId !== loaderId) throw new Error("The website document changed during the request");
  return { documentId: loaderId, frameScope: "main", result: snapshotId && !result.error ? { ...result, snapshotId } : result };
}

type StatementAction =
  | { kind: "prepare"; billerId?: string }
  | { kind: "evidence"; value: "past" | "ambiguous" | "restored" }
  | { kind: "observe"; request: Command }
  | { kind: "answer"; text: string }
  | { kind: "close" };

type StatementEpisode = {
  taskId: string;
  question: string;
  startUrl: string;
  prepareStatement(page: Page): Promise<void>;
  beforeObservation?: () => Promise<void>;
  finish(text: string): Promise<Record<string, unknown>>;
  close(): Promise<unknown>;
};
type StatementRun =
  | { readonly attempt: string; readonly state: "Preparing" }
  | { readonly attempt: string; readonly state: "Ready"; readonly episode: StatementEpisode; readonly site: Site };
const statementRuns = new WeakMap<Page, StatementRun>();
const releasedDirectory = process.env.GRACE_BILLWORLD_RELEASED_DIR;

async function startReleasedStatement(fixture: string, directory: string): Promise<StatementEpisode> {
  const released = await releasedBillworld(fixture);
  const negative = await released.start("grader_validation");
  try {
    const grade = await negative.finish("", join(directory, "no-action.json"));
    const checks = grade.checks;
    if (grade.success || grade.actionsUsed !== 0 ||
        checks.statement_viewed_after_login !== false || checks.due_date_reported !== false || checks.amount_reported !== false)
      throw new Error("The no-action control did not independently reject the statement and its answer");
  } finally { await negative.close(); }
  const episode = await released.start("reference_script");
  const question = episode.task.prompt.match(/Report [^.]+\. Make no changes\.$/u)?.[0];
  if (!question) {
    await episode.close();
    throw new Error("The pinned task no longer supplies its released read-only question");
  }
  return {
    ...episode, question,
    beforeObservation: () => episode.action("grace.observe_statement"),
    async finish(text) {
      await episode.action("grace.submit_visible_answer");
      return episode.finish(text, join(directory, "grace-answer.json"));
    },
  };
}

async function releasedStatement(context: BrowserCommandContext, attempt: string, action: StatementAction) {
  const existing = statementRuns.get(context.page);
  if (action.kind === "close") {
    if (existing?.attempt !== attempt) return {};
    statementRuns.delete(context.page);
    if (existing.state === "Ready") {
      try { await existing.site.browser.close(); }
      finally { await existing.episode.close(); }
    }
    return {};
  }
  if (action.kind === "prepare") {
    if (!releasedDirectory || existing) throw new Error("The BillWorld statement test needs one pinned episode");
    const reservation = { attempt, state: "Preparing" } satisfies StatementRun;
    statementRuns.set(context.page, reservation);
    let episode: StatementEpisode | undefined;
    let browser: BrowserContext | undefined;
    try {
      const results = process.env.GRACE_BILLWORLD_RESULTS ?? ".cache/grace-billworld";
      mkdirSync(results, { recursive: true });
      const directory = mkdtempSync(join(results, action.billerId === undefined ? "released-statement-" : "fleet-view-bill-"));
      episode = action.billerId === undefined ? await startReleasedStatement(releasedDirectory, directory)
        : await fleetStatement(releasedDirectory, action.billerId, directory);
      if (statementRuns.get(context.page) !== reservation) throw new Error("The statement attempt ended before preparation");
      browser = await context.context.browser()?.newContext({ ignoreHTTPSErrors: true });
      if (!browser) throw new Error("The statement trial needs an isolated Chromium context");
      const page = await browser.newPage();
      await episode.prepareStatement(page);
      const site = { page, origin: new URL(episode.startUrl).origin, browser, session: await browser.newCDPSession(page) };
      if (statementRuns.get(context.page) !== reservation) throw new Error("The statement attempt ended before preparation");
      await context.page.bringToFront();
      if (statementRuns.get(context.page) !== reservation) throw new Error("The statement attempt ended before preparation");
      statementRuns.set(context.page, { attempt, state: "Ready", episode, site });
      return { taskId: episode.taskId, url: page.url(), question: episode.question };
    } catch (error) {
      if (statementRuns.get(context.page) === reservation) statementRuns.delete(context.page);
      try { await browser?.close(); }
      finally { await episode?.close(); }
      throw error;
    }
  }
  if (existing?.attempt !== attempt || existing.state !== "Ready") throw new Error("No BillWorld statement is attached to this attempt");
  if (action.kind === "evidence") {
    if (!existing.episode.taskId.endsWith(":view-bill")) throw new Error("Only Fleet statements run markup controls");
    await existing.site.page.evaluate((value) => {
      const title = document.querySelector("title");
      if (!title) throw new Error("The Fleet statement has no title");
      const original = title.getAttribute("data-original-title") ?? title.text;
      title.setAttribute("data-original-title", original);
      title.text = value === "past" ? "Past statement" : original;
      document.querySelector("[data-evidence-control]")?.remove();
      if (value === "ambiguous") {
        const extraDueDate = document.createElement("p");
        extraDueDate.dataset.evidenceControl = "true";
        extraDueDate.textContent = "Due date: January 1, 2001";
        (document.querySelector("main") ?? document.body).prepend(extraDueDate);
      }
    }, action.value);
    return {};
  }
  if (action.kind === "answer") return existing.episode.finish(action.text);
  if (action.request.command.subaction !== "snapshot") throw new Error("The statement trial only permits native observation");
  await existing.episode.beforeObservation?.();
  return observeSite(existing.site, { kind: "control", request: action.request });
}

async function googleConsent(context: BrowserCommandContext, endpoint: string, address: string) {
  const expected = new URL(endpoint);
  if (expected.hostname !== "127.0.0.1" || expected.pathname !== "/o/oauth2/v2/auth" || !address.endsWith("@grace.test"))
    throw new Error("Google consent tests use only a local fixture and synthetic email");
  const isPopup = (page: Page) => page !== context.page && (page.url() === endpoint || page.url() === "about:blank");
  const popup = context.context.pages().find(isPopup) ?? await context.context.waitForEvent("page", { predicate: isPopup });
  try {
    await popup.waitForURL(endpoint);
    await popup.getByRole("heading", { name: "Sign in to Google" }).waitFor();
    await popup.getByLabel("Email", { exact: true }).fill(address);
    await popup.getByLabel("Password", { exact: true }).fill("fixture-password");
    const callback = new URL(expected.searchParams.get("redirect_uri") ?? "", expected);
    if (callback.origin !== expected.origin || callback.pathname !== "/fake/google/callback") throw new Error("Unexpected mock Google callback");
    const [consent] = await Promise.all([
      popup.waitForResponse((response) => response.url().startsWith(`${callback.href}?`) && response.request().method() === "GET"),
      popup.getByRole("button", { name: "Allow", exact: true }).click(),
    ]);
    if (!consent.ok()) throw new Error("Mock Google consent was refused");
  } finally {
    await popup.close();
    await context.page.bringToFront();
  }
}

declare module "vitest/browser" {
  interface BrowserCommands {
    benchmarkSurface: (action: SiteAction) => Promise<Record<string, unknown>>;
    googleConsent: (endpoint: string, address: string) => Promise<void>;
    releasedStatement: (attempt: string, action: StatementAction) => Promise<Record<string, unknown>>;
  }
}
declare module "vitest" {
  interface ProvidedContext {
    browserBenchmarks: readonly (Pick<BenchmarkDefinition, "taskId" | "intent" | "startUrl" | "requiredStep"> & { gradeWholeCohort: boolean })[];
    billworldStatements: readonly { label: string; billerId?: string }[];
  }
}

export default defineConfig(async (env) => {
  const config = await base(env);
  const projects = config.test?.projects?.map((entry) =>
    typeof entry === "object" && "test" in entry && entry.test?.browser
      ? {
          ...entry,
          optimizeDeps: { ...entry.optimizeDeps, include: [...(entry.optimizeDeps?.include ?? []), "effect/crypto"] },
          test: { ...entry.test, browser: { ...entry.test.browser, commands: { benchmarkSurface, googleConsent, releasedStatement } } },
        }
      : entry);
  const browserBenchmarks = runs.map(({ taskId, intent, startUrl, requiredStep }) => ({ taskId, intent, startUrl, requiredStep, gradeWholeCohort: Boolean(fleet) }));
  const billworldStatements = releasedDirectory === undefined ? [] : [
    { label: "released" },
    ...fleetStatementCases.map(({ billerId, template }) => ({ label: "Fleet " + template, billerId })),
  ];
  const reporters = fleet ? ["default", { onTestRunEnd: () => fleet.close() }] as const : undefined;
  return { ...config, resolve: { ...config.resolve, conditions: ["eliza-source", ...defaultClientConditions] }, test: { ...config.test, ...(reporters ? { reporters: [...reporters] } : {}), projects, provide: { browserBenchmarks, billworldStatements }, globalSetup: ["test/setup.vibe"] } };
});

import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Schema } from "effect";
import type { BrowserContext, Page, Route } from "playwright";
import type { BrowserCommandContext } from "vitest/node";
import { graceTests, observeFromDocumentStart, observeSite, type Site, type SiteObservation, type SurfaceCommand } from "@repo/app";
import { releasedBillworld } from "./test/billworld-released.fixture.ts";
import { type CompletedPublicSearch, hasHostedNavigation, hasUserAssistedSearch, matchesPublicSearch, PublicSearch, publicSearchQuery } from "./test/browser-receipt.ts";
import { fleetFixture, fleetStatement, fleetStatementCases, fleetStatementRefusals } from "./test/fleet.fixture.ts";
import { type FixtureUpstreamFailure, fixtureContextOptions, readFixtureUpstream, routeFixtureContext } from "./test/fixture-context.ts";
import { webArena, webArenaPluginName, WebArenaEvaluatorError } from "./test/webarena.ts";

const BenchmarkDefinition = Schema.Struct({
  taskId: Schema.NonEmptyString,
  intent: Schema.NonEmptyString,
  startUrl: Schema.NonEmptyString,
  fixtureChoice: Schema.optional(Schema.NonEmptyString),
  chat: Schema.optional(Schema.Literal("upstream")),
  siteStorageState: Schema.optional(Schema.NonEmptyString),
  evaluator: Schema.optional(Schema.Literal("webarena")),
  exploratory: Schema.optional(Schema.Literal(true)),
  requiredStep: Schema.optional(Schema.Literals(["ReachNamedPage", "ReadLatestRecord", "SearchPublicSite", "SortPublicListing"])),
  receipt: Schema.NonEmptyString,
});
type BenchmarkDefinition = typeof BenchmarkDefinition.Type;
if ((process.env.GRACE_BILLWORLD_SHARD !== undefined || process.env.GRACE_BILLWORLD_RESUME_DIR !== undefined ||
    process.env.GRACE_BILLWORLD_COHORT !== undefined) &&
    !process.env.GRACE_BILLWORLD_DIR)
  throw new Error("Fleet cohort, shard and resume settings require GRACE_BILLWORLD_DIR");
if (process.env.GRACE_BILLWORLD_DIR && process.env.GRACE_BROWSER_BENCHMARK_FILE)
  throw new Error("Run Fleet separately from browser tasks declared in an external file");
const host: NodeJS.Process & { graceFleet?: ReturnType<typeof fleetFixture> } = process;
const fleet = process.env.GRACE_BILLWORLD_DIR
  ? await (host.graceFleet ??= fleetFixture({
      directory: process.env.GRACE_BILLWORLD_DIR,
      results: process.env.GRACE_BILLWORLD_RESULTS ?? ".cache/grace-billworld",
      shardSetting: process.env.GRACE_BILLWORLD_SHARD,
      resumeDirectory: process.env.GRACE_BILLWORLD_RESUME_DIR,
      cohortSetting: process.env.GRACE_BILLWORLD_COHORT,
    }))
  : undefined;
const definitions: unknown = process.env.GRACE_BROWSER_BENCHMARK_FILE
  ? JSON.parse(readFileSync(process.env.GRACE_BROWSER_BENCHMARK_FILE, "utf8"))
  : fleet?.definitions ?? [];
const runs = Schema.decodeUnknownSync(Schema.Array(BenchmarkDefinition), { onExcessProperty: "error" })(Array.isArray(definitions) ? definitions : [definitions]);
if (runs.some(({ requiredStep, intent, chat, evaluator, siteStorageState, fixtureChoice, exploratory }) =>
  requiredStep === "SearchPublicSite" && (!publicSearchQuery(intent) || chat !== "upstream" || evaluator !== "webarena" ||
    siteStorageState === undefined || fixtureChoice !== undefined || exploratory !== true)))
  throw new Error("Public search benchmark cases require exact terms and the synthetic Shopping account");
const byId = new Map(runs.map((item) => [item.taskId, item]));
if (byId.size !== runs.length || new Set(runs.map(({ receipt }) => receipt)).size !== runs.length)
  throw new Error("Benchmark task IDs and receipt paths must be unique");
function benchmarkTitleId(taskId: string): string {
  if (/^[A-Za-z0-9-]{1,32}$/.test(taskId)) return taskId;
  const prefix = taskId.replace(/[^A-Za-z0-9-]+/gu, "-").replace(/^-+|-+$/gu, "").slice(0, 23);
  const hash = createHash("sha256").update(taskId).digest("hex").slice(0, 8);
  return `${prefix || "task"}-${hash}`;
}

const browserBenchmarks = runs.map(({ taskId, intent, startUrl, requiredStep, evaluator, exploratory }) => ({
  taskId, titleId: benchmarkTitleId(taskId), intent, startUrl, requiredStep, exploratory: evaluator === "webarena" && exploratory === true, gradeWholeCohort: Boolean(fleet),
}));
if (new Set(browserBenchmarks.map(({ titleId }) => titleId)).size !== runs.length)
  throw new Error("Benchmark test title IDs must be unique");
const officialCases = runs.filter(({ evaluator }) => evaluator === "webarena");
function prepareOfficialCases() {
  if (!officialCases.length) return;
  const checkout = process.env.GRACE_WEBARENA_UPSTREAM;
  const python = process.env.GRACE_WEBARENA_PYTHON;
  if (!checkout || !python) throw new Error("WebArena grading needs GRACE_WEBARENA_UPSTREAM and GRACE_WEBARENA_PYTHON");
  return webArena({ checkout, python, cases: officialCases });
}
const official = prepareOfficialCases();
type SiteAction =
  | { kind: "begin"; taskId: string }
  | { kind: "open"; url: string }
  | { kind: "submitPublicSearch"; query: string }
  | { kind: "decisionRoute"; cloud: string; deadlineMs: number }
  | { kind: "receipt"; outcome: Record<string, unknown> }
  | SiteObservation;

const DecisionResult = Schema.Struct({ status: Schema.String, model: Schema.optional(Schema.String), choice: Schema.optional(Schema.NullOr(Schema.String)), confidence: Schema.optional(Schema.Finite) });
type PublicSearchSubmission =
  | { state: "submitting"; search: typeof PublicSearch.Type }
  | ({ state: "completed" } & CompletedPublicSearch);
type Run = { fixture: BenchmarkDefinition; pendingRoutes: Set<Promise<void>>; decisions: number; decisionResults: { http: number; candidates: number; result?: typeof DecisionResult.Type; transportFailure?: FixtureUpstreamFailure }[]; chatStatus?: number; chatTransportFailures: (FixtureUpstreamFailure & { http: 503 })[]; chatRoute?: string; decisionRoute?: string; publicSearch?: PublicSearchSubmission; site?: Site };
const activeRuns = new WeakMap<Page, Run>();

function trackBenchmarkRoute(run: Run, handler: (route: Route) => Promise<void>) {
  return (route: Route) => {
    const pending = handler(route);
    const settled = () => run.pendingRoutes.delete(pending);
    run.pendingRoutes.add(pending);
    void pending.then(settled, settled);
    return pending;
  };
}

async function drainBenchmarkRoutes(run: Run) {
  while (run.pendingRoutes.size) await Promise.allSettled(run.pendingRoutes);
}

async function cleanupBenchmarkRun(page: Page, run: Run) {
  activeRuns.delete(page);
  try {
    await Promise.allSettled([
      run.decisionRoute ? page.unroute(run.decisionRoute) : Promise.resolve(),
      run.chatRoute ? page.unroute(run.chatRoute) : Promise.resolve(),
    ]);
    await drainBenchmarkRoutes(run);
  } finally {
    await run.site?.browser.close();
  }
}

const Choices = Schema.Struct({ kind: Schema.Literal("choice"), goal: Schema.NonEmptyString, candidates: Schema.Array(Schema.Struct({ id: Schema.NonEmptyString, label: Schema.NonEmptyString })) });
const SiteState = Schema.Struct({
  cookies: Schema.Array(Schema.Struct({
    name: Schema.NonEmptyString, value: Schema.String, domain: Schema.NonEmptyString, path: Schema.NonEmptyString,
    expires: Schema.Finite, httpOnly: Schema.Boolean, secure: Schema.Boolean, sameSite: Schema.Literals(["Strict", "Lax", "None"]),
  })),
  origins: Schema.Array(Schema.Struct({
    origin: Schema.NonEmptyString, localStorage: Schema.Array(Schema.Struct({ name: Schema.String, value: Schema.String })),
  })),
});

async function benchmarkSurface(context: BrowserCommandContext, action: SiteAction) {
  if (action.kind === "begin") {
    const fixture = byId.get(action.taskId);
    if (!fixture || activeRuns.has(context.page)) throw new Error("The Chromium benchmark case is not available");
    if (fixture.evaluator === "webarena" && official) context.project.vitest.onCancel(official.close);
    activeRuns.set(context.page, { fixture, pendingRoutes: new Set(), decisions: 0, decisionResults: [], chatTransportFailures: [] });
    return {};
  }
  const run = activeRuns.get(context.page);
  if (!run) throw new Error("No benchmark fixture was supplied to the Chromium transport");
  const { fixture: definition } = run;
  const publicSearch = definition.requiredStep === "SearchPublicSite";
  if (action.kind === "submitPublicSearch") {
    const site = run.site;
    if (!publicSearch || !site || run.publicSearch || site.page.url() !== definition.startUrl ||
        publicSearchQuery(definition.intent) !== action.query)
      throw new Error("The website search is outside its reviewed case");
    await site.page.bringToFront();
    const searchName = /^[\s\p{Co}]*Search\b/iu;
    const roleOptions = { name: searchName };
    const textInput = site.page.locator('input:is([type="search"],[type="text"],:not([type]))');
    const semanticSearchField = site.page.locator('input:is([type="search"],[role="searchbox"],[role="combobox"])');
    const field = site.page.getByRole("searchbox", roleOptions).or(site.page.getByRole("combobox", roleOptions))
      .or(site.page.getByRole("textbox", roleOptions)).or(site.page.getByLabel(searchName))
      .or(site.page.getByPlaceholder(searchName).and(semanticSearchField)).and(textInput).filter({ visible: true });
    if (await field.count() !== 1 || !await field.isVisible() || !await field.isEditable())
      throw new Error("The public website has no unique editable Search field");
    const form = await field.evaluate((input) => {
      if (!(input instanceof HTMLInputElement) || !["search", "text"].includes(input.type) || input.value !== "" ||
          /(?:^|\s)(?:username|one-time-code|(?:current|new)-password|cc-\S+)(?:\s|$)/iu.test(input.autocomplete)) return null;
      const form = input.form;
      return form?.method === "get" && ["", "_self"].includes(form.target) ? { action: form.action, field: input.name } : null;
    });
    const actionUrl = form && URL.parse(form.action);
    if (!form || !actionUrl || actionUrl.origin !== site.origin || actionUrl.href === definition.startUrl ||
        actionUrl.username || actionUrl.password || actionUrl.search || actionUrl.hash)
      throw new Error("The public Search field is not bound to a same-origin GET form");
    const search = Schema.decodeUnknownSync(PublicSearch)({ ...form, query: action.query });
    const { frameTree: { frame: before } } = await site.session.send("Page.getFrameTree");
    if (before.url !== definition.startUrl || run.publicSearch) throw new Error("The search starting document changed");
    run.publicSearch = { state: "submitting", search };
    await field.pressSequentially(search.query);
    if (await field.inputValue() !== search.query) throw new Error("The exact reviewed term was not entered");
    const [response] = await Promise.all([
      site.page.waitForResponse((candidate) => {
        const request = candidate.request();
        return request.isNavigationRequest() && request.frame() === site.page.mainFrame() &&
          request.method() === "GET" && matchesPublicSearch(new URL(candidate.url()), search);
      }, { timeout: 30_000 }),
      site.page.waitForURL((url) => matchesPublicSearch(url, search), { waitUntil: "load", timeout: 30_000 }),
      field.press("Enter"),
    ]);
    const { frameTree: { frame: after } } = await site.session.send("Page.getFrameTree");
    if (!response.ok() || after.url !== response.url() || after.loaderId === before.loaderId)
      throw new Error("The public search did not load a new result document");
    run.publicSearch = { state: "completed", search, start: { url: before.url, documentId: before.loaderId },
      destination: { url: after.url, documentId: after.loaderId } };
    return search;
  }
  if (action.kind === "decisionRoute") {
    const endpoint = new URL("/api/v1/decisions", action.cloud);
    if (!["127.0.0.1", "localhost"].includes(endpoint.hostname)) throw new Error("Fixture decision routes are local");
    run.decisionRoute = endpoint.href;
    if (definition.chat === "upstream") {
      const origin = process.env.GRACE_BENCHMARK_CLEF_ORIGIN;
      const key = process.env.GRACE_BENCHMARK_CLEF_KEY;
      if (!origin || !key || new URL(origin).protocol !== "https:") throw new Error("The upstream chat endpoint requires a test credential");
      run.chatRoute = new URL("/api/v1/chat/completions", action.cloud).href;
      await context.page.route(run.chatRoute, trackBenchmarkRoute(run, async (route) => {
        const request = route.request();
        const headers = { "access-control-allow-origin": request.headers().origin ?? "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "Authorization, Content-Type" };
        if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
        const response = await readFixtureUpstream(new URL("/api/v1/chat/completions", origin), {
          method: "POST", body: request.postData(), headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        }, AbortSignal.timeout(45_000));
        run.chatStatus = response.status;
        if (response.tag === "Unavailable") {
          run.chatTransportFailures.push({ ...response.failure, http: response.status });
          return route.fulfill({ status: response.status, headers });
        }
        return route.fulfill({ status: response.status, headers, contentType: response.contentType, body: response.body });
      }));
    }
    await context.page.route(endpoint.href, trackBenchmarkRoute(run, async (route) => {
      const request = route.request();
      const headers = {
        "access-control-allow-origin": request.headers().origin ?? "*",
        "access-control-allow-methods": "OPTIONS, POST",
        "access-control-allow-headers": "Authorization, Content-Type",
      };
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
      try {
        const choice = Schema.decodeUnknownSync(Choices)(request.postDataJSON());
        run.decisions++;
        if (definition.fixtureChoice !== undefined) {
          const selected = choice.candidates.find(({ label }) => label === definition.fixtureChoice);
          const id = selected?.id ?? "none";
          return await route.fulfill({ headers, json: { status: "ok", kind: "choice", choice: selected?.id ?? null,
            model: "fixture", confidence: 1, probabilities: Object.fromEntries([...choice.candidates.map(({ id }) => id), "none"].map((option) => [option, option === id ? 1 : 0])) } });
        }
        const origin = process.env.GRACE_BENCHMARK_CLEF_ORIGIN;
        const key = process.env.GRACE_BENCHMARK_CLEF_KEY;
        if (!origin || !key || new URL(origin).protocol !== "https:") throw new Error("The hosted decision service is not configured");
        const response = await readFixtureUpstream(new URL("/api/v1/decisions", origin), {
          method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(choice),
        }, AbortSignal.timeout(action.deadlineMs));
        const body = response.tag === "Response" ? response.body : '{"status":"unavailable","reason":"provider_error"}';
        const decoded = Schema.decodeUnknownOption(Schema.fromJsonString(DecisionResult))(body);
        run.decisionResults.push({ http: response.status, candidates: choice.candidates.length,
          result: decoded._tag === "Some" ? decoded.value : undefined,
          ...(response.tag === "Unavailable" && { transportFailure: response.failure }) });
        return await route.fulfill({ headers, status: response.status, contentType: "application/json", body });
      } catch (error) {
        await route.fulfill({ headers, status: 500, contentType: "application/json", body: '{"status":"unavailable","reason":"provider_error"}' }).catch(() => {});
        throw error;
      }
    }));
    return {};
  }
  if (action.kind === "receipt") {
    try {
      await drainBenchmarkRoutes(run);
      const decisionProvider = publicSearch ? "none" : definition.fixtureChoice === undefined ? "hosted" : "fixture";
      const { ...visibleOutcome } = action.outcome;
      const observation = {
        surface: "desktop-chromium", taskId: definition.taskId, intent: definition.intent, startUrl: definition.startUrl,
        decisionProvider, decisionRequests: run.decisions, syntheticStorageState: Boolean(run.site && definition.siteStorageState),
        decisionServiceOrigin: decisionProvider === "hosted" && process.env.GRACE_BENCHMARK_CLEF_ORIGIN
          ? new URL(process.env.GRACE_BENCHMARK_CLEF_ORIGIN).origin : undefined,
        outcome: { ...visibleOutcome, chatProvider: definition.chat ?? "fixture" }, chatStatus: run.chatStatus,
        ...(run.chatTransportFailures.length > 0 && { chatTransportFailures: run.chatTransportFailures }),
        decisionResults: run.decisionResults,
      };
      const guided = hasHostedNavigation(observation, run.site?.page.url());
      const grade = await fleet?.grade(definition.taskId, run.site?.page, guided);
      const evaluatorOutcome: Record<string, unknown> = action.outcome;
      const webArenaGrade = definition.evaluator === "webarena" ? await official?.grade(definition.taskId, evaluatorOutcome, {
        guided, authenticatedFixture: Boolean(run.site && definition.siteStorageState),
      }).catch((error: unknown) => ({ failure: error instanceof WebArenaEvaluatorError ? error.message : "The official WebArena evaluation failed" })) : undefined;
      let userAssisted = false;
      if (publicSearch && run.site && run.publicSearch?.state === "completed") {
        const { frameTree: { frame } } = await run.site.session.send("Page.getFrameTree");
        userAssisted = hasUserAssistedSearch(observation, run.publicSearch, { url: frame.url, documentId: frame.loaderId });
      }
      const receipt = { ...observation, grade, webArena: webArenaGrade, ...(publicSearch && { userAssisted }) };
      if (fleet) fleet.record(definition.taskId, receipt);
      else writeFileSync(definition.receipt, `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx", mode: 0o600 });
      if (webArenaGrade && action.outcome.failure === undefined) {
        if (!("officialScore" in webArenaGrade) || webArenaGrade.officialScore === null || webArenaGrade.noActionScore !== 0)
          throw new Error("The pinned WebArena evaluator did not return a landing score and a zero no-action control");
        if (publicSearch && action.outcome.graceTerminal !== undefined && !userAssisted)
          throw new Error("The public search result lacks a checked user-assisted journey");
        if (definition.exploratory) {
          if ((definition.chat === "upstream" && run.chatStatus !== 200) ||
              run.decisionResults.some(({ http, result }) => http !== 200 || result?.status !== "ok"))
            throw new Error("A hosted WebArena service failed during the exploratory case");
        } else {
          if (webArenaGrade.officialScore !== 1)
            throw new Error("The pinned WebArena evaluator did not score the observed document as a match");
          if (decisionProvider === "hosted" && !webArenaGrade.qualifiedHostedGuidance)
            throw new Error("The WebArena landing has no verified hosted guidance");
        }
      }
    } finally {
      await cleanupBenchmarkRun(context.page, run);
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
    if (storage && (!storage.cookies.length || storage.cookies.some(({ domain }) => domain.replace(/^\./u, "") !== start.hostname) || storage.origins.some((stored) => stored.origin !== origin)))
      throw new Error("Benchmark storage state must belong only to the declared synthetic website");
    const chromium = context.context.browser();
    if (!chromium) throw new Error("The benchmark needs a Chromium browser context");
    const options = {
      ...fixtureContextOptions,
      ignoreHTTPSErrors: true,
      ...(storage && { storageState: { cookies: [...storage.cookies], origins: storage.origins.map(({ origin, localStorage }) => ({ origin, localStorage: [...localStorage] })) } }),
    };
    const browser = await chromium.newContext(options);
    try {
      await routeFixtureContext(browser, { origin, permits: (request, url) => {
        if (!["GET", "HEAD"].includes(request.method())) return false;
        if (publicSearch) return !request.isNavigationRequest() || url.href === start.href ||
          (run.publicSearch !== undefined && request.method() === "GET" && matchesPublicSearch(url, run.publicSearch.search));
        return true;
      } });
      const website = await browser.newPage();
      const session = await observeFromDocumentStart(website);
      const response = await website.goto(action.url, { waitUntil: "load" });
      if (!response?.ok()) throw new Error("The benchmark site did not load");
      if (activeRuns.get(context.page) !== run || run.site) throw new Error("The benchmark instance changed while opening the site");
      run.site = { page: website, origin, browser, session };
      return { url: website.url() };
    } catch (error) {
      await browser.close();
      throw error;
    }
  }
  if (!existing) throw new Error("The Chromium benchmark site is not open");
  return observeSite(existing, action);
}

type StatementAction =
  | { kind: "prepare"; billerId?: string }
  | { kind: "evidence"; value: "past" | "ambiguous" | "restored" }
  | { kind: "observe"; request: SurfaceCommand }
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
  const episode = await released.start("agent");
  const question = episode.task.prompt;
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
      const refusal = fleetStatementRefusals.some(({ billerId }) => billerId === action.billerId);
      const prefix = action.billerId === undefined ? "released-statement-" : refusal ? "fleet-statement-refusal-" : "fleet-view-bill-";
      const directory = mkdtempSync(join(results, prefix));
      episode = action.billerId === undefined ? await startReleasedStatement(releasedDirectory, directory)
        : await fleetStatement(releasedDirectory, action.billerId, directory);
      if (statementRuns.get(context.page) !== reservation) throw new Error("The statement attempt ended before preparation");
      browser = await context.context.browser()?.newContext({ ...fixtureContextOptions, ignoreHTTPSErrors: true });
      if (!browser) throw new Error("The statement trial needs an isolated Chromium context");
      const page = await browser.newPage();
      const site = { page, origin: new URL(episode.startUrl).origin, browser, session: await observeFromDocumentStart(page) };
      await episode.prepareStatement(page);
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
  await existing.episode.beforeObservation?.();
  return observeSite(existing.site, { kind: "control", request: action.request });
}

declare module "vitest/browser" {
  interface BrowserCommands {
    benchmarkSurface: (action: SiteAction) => Promise<Record<string, unknown>>;
    releasedStatement: (attempt: string, action: StatementAction) => Promise<Record<string, unknown>>;
  }
}
declare module "vitest" {
  interface ProvidedContext {
    browserBenchmarks: readonly (Pick<BenchmarkDefinition, "taskId" | "intent" | "startUrl" | "requiredStep"> & { titleId: string; exploratory: boolean; gradeWholeCohort: boolean })[];
    billworldStatements: readonly { label: string; billerId?: string; refuses?: true }[];
  }
}

const billworldStatements = releasedDirectory === undefined ? [] : [
  { label: "released" },
  ...fleetStatementCases.map(({ billerId, template }) => ({ label: "Fleet " + template, billerId })),
  ...fleetStatementRefusals.map(({ billerId, template }) => ({ label: "Fleet " + template, billerId, refuses: true as const })),
];

export default graceTests({
  root: import.meta.dirname,
  commands: { benchmarkSurface, releasedStatement },
  provide: { browserBenchmarks, billworldStatements },
  browser: {
    ...(!browserBenchmarks.length && !billworldStatements.length && { include: [] }),
    ...(official && { plugins: [{ name: webArenaPluginName, api: official }], globalSetup: ["test/webarena.ts"] }),
  },
  ...(fleet && { reporters: ["default", { onTestRunEnd: () => fleet.close() }] }),
});

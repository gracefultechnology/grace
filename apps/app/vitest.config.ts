import tailwindcss from "@tailwindcss/vite";
import { defaultClientConditions } from "vite";
import { createHash, randomUUID, randomInt } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Schema } from "effect";
import type { BrowserContext, CDPSession, Page, Route } from "playwright";
import { defineConfig } from "vitest/config";
import type { BrowserCommandContext } from "vitest/node";
import { project } from "vibestack/testing/vitest";
import type { SurfacePlugin } from "./src/surfacePlugin.ts";
import { releasedBillworld } from "./test/billworld-released.fixture.ts";
import { type CompletedPublicSearch, hasHostedNavigation, hasUserAssistedSearch, matchesPublicSearch, PublicSearch, publicSearchQuery } from "./test/browser-receipt.ts";
import { fleetFixture, fleetStatement, fleetStatementCases, fleetStatementRefusals } from "./test/fleet.fixture.ts";
import { fixtureContextOptions, routeFixtureContext } from "./test/fixture-context.ts";
import { webArena, webArenaPluginName, WebArenaEvaluatorError } from "./test/webarena.ts";

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

const publicRatingTask = "386";
const ratingProduct = (intent: string) => /^What is the rating of (.+)\. Please round to the nearest whole number$/u.exec(intent)?.[1];
const ratingSearchQuery = (product: string) => product.split(/\s+/u).slice(0, 2).join(" ");
if (runs.some(({ taskId, intent, evaluator, chat, exploratory, siteStorageState, fixtureChoice, requiredStep }) =>
  taskId === publicRatingTask && (!ratingProduct(intent) || evaluator !== "webarena" || chat !== "upstream" || exploratory !== true ||
    !siteStorageState || fixtureChoice !== undefined || requiredStep !== undefined)))
  throw new Error("The public rating diagnostic requires the pinned Shopping case and synthetic login");
const browserBenchmarks = runs.map(({ taskId, intent, startUrl, requiredStep, evaluator, exploratory }) => ({
  taskId, titleId: benchmarkTitleId(taskId), intent, startUrl, requiredStep, exploratory: evaluator === "webarena" && exploratory === true, gradeWholeCohort: Boolean(fleet), publicRating: taskId === publicRatingTask ? ratingSearchQuery(ratingProduct(intent) ?? "") : undefined,
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
  | { kind: "read"; selector?: string }
  | { kind: "submitPublicSearch"; query: string }
  | { kind: "openPublicCategory" }
  | { kind: "setWebsitePriceOrder"; direction: "ascending" | "descending" }
  | { kind: "openPublicRatingProduct" }
  | { kind: "inspectGuide" }
  | { kind: "tapGuide" }
  | { kind: "hoverGuide" }
  | { kind: "decisionRoute"; cloud: string; deadlineMs: number }
  | { kind: "receipt"; outcome: Record<string, unknown> }
  | { kind: "control"; request: Command };

type Site = { page: Page; origin: string; browser: BrowserContext; session: CDPSession; world?: { loaderId: string; executionContextId: number } };
const DecisionResult = Schema.Struct({ status: Schema.String, model: Schema.optional(Schema.String), choice: Schema.optional(Schema.NullOr(Schema.String)), confidence: Schema.optional(Schema.Finite) });
type PublicSearchSubmission =
  | { state: "submitting"; search: typeof PublicSearch.Type }
  | ({ state: "completed" } & CompletedPublicSearch);
type Run = { fixture: BenchmarkDefinition; pendingRoutes: Set<Promise<void>>; decisions: number; decisionResults: { http: number; candidates: number; result?: typeof DecisionResult.Type }[]; chatStatus?: number; chatRoute?: string; decisionRoute?: string; publicSearch?: PublicSearchSubmission; ratingProduct?: { url: string; documentId: string }; ratingListings?: { visible: number; matching: number; cables: number; labels: string[] }; noAction?: { url: string; documentId: string }; site?: Site };
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

const observationWorld = "grace-benchmark";

async function observeFromDocumentStart(page: Page) {
  const session = await page.context().newCDPSession(page);
  await session.send("Page.enable");
  await session.send("Page.addScriptToEvaluateOnNewDocument", {
    worldName: observationWorld,
    source: `if (window === window.top) (${await source("command", "pageCommand")})(null)`,
  });
  return session;
}

async function operatePublicSort(site: Site, definition: BenchmarkDefinition, action: Extract<SiteAction, { kind: "openPublicCategory" | "setWebsitePriceOrder" }>) {
  const website = site.page;
  await website.bringToFront();
  if (action.kind === "openPublicCategory") {
    if (website.url() !== definition.startUrl) throw new Error("The public category must start from the storefront");
    const known = definition.taskId === "351" ? [/^Video Games$/i, /^PlayStation 4$/i, /^Accessories$/i] :
      definition.taskId === "352" ? [/^Health (&|and) Household$/i, /^Diet (&|and) Sports Nutrition$/i, /^Nutrition Bars (&|and) Drinks$/i] : [];
    const leafName = definition.taskId === "353" ? /^Competitive Swimwear$/i :
      definition.taskId === "355" ? /^Kids(?:[\u0027’])? Bedding$/i : undefined;
    const navName = known[0] ?? leafName;
    if (!navName) throw new Error("The fixture has no public category operator");
    const nav = website.getByRole("navigation").filter({
      has: website.locator("a").filter({ hasText: navName }),
    }).first();
    await nav.locator('ul[role="menu"]').filter({ visible: true }).first().waitFor({ timeout: 15_000 });
    const disclosed = leafName ? await nav.locator("a[href]").filter({ hasText: leafName }).evaluateAll(anchors =>
      anchors.flatMap(anchor => {
        const labels = [];
        for (let item = anchor.closest("li"); item; item = item.parentElement?.closest("li") ?? null) {
          const label = item.querySelector(":scope > a")?.textContent?.trim();
          if (!label) return [];
          labels.unshift(label.replace(/\s+/gu, " "));
        }
        return [labels];
      })) : undefined;
    const menu = disclosed?.length === 1
      ? (disclosed[0] ?? []).map(label => {
          const escaped = label.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
            .replace(/['"]/gu, quote => quote === "'" ? "\\u0027" : "\\u0022");
          return new RegExp("^" + escaped + "$", "iu");
        }) : known;
    const names = menu.slice(0, -1);
    const final = menu.at(-1);
    if (!names.length || names.length > 5 || !final) throw new Error("The fixture does not have one public category menu");
    const navControl = (name: RegExp) => nav.locator("a[href]").filter({ hasText: name }).filter({ visible: true }).first();
    const leaf = navControl(final);
    for (const [index, name] of names.entries()) {
      const control = navControl(name);
      const child = navControl(names[index + 1] ?? final);
      await control.hover({ timeout: 10_000 }).catch(async () => {
        await control.press("ArrowRight", { timeout: 5_000 });
      });
      if (!await child.isVisible()) await control.press("ArrowRight", { timeout: 5_000 });
    }
    const href = await leaf.getAttribute("href", { timeout: 15_000 });
    if (!href) throw new Error("The disclosed category does not have an address");
    const category = new URL(href, website.url());
    if (category.origin !== site.origin || category.search || category.hash)
      throw new Error("The disclosed category is outside the same-origin public storefront");
    const [response] = await Promise.all([
      website.waitForResponse(item => item.url() === category.href && item.request().isNavigationRequest() &&
        item.request().frame() === website.mainFrame(), { timeout: 30_000 }),
      website.waitForURL(category.href, { waitUntil: "load", timeout: 30_000 }),
      leaf.click({ timeout: 15_000 }),
    ]);
    if (!response.ok()) throw new Error("The category did not load after the disclosed menu link was clicked");
  } else {
    const main = website.getByRole("main");
    const sorter = main.getByRole("combobox", { name: /^Sort By$/i }).filter({ visible: true }).first();
    if (await sorter.locator("option:checked").textContent({ timeout: 15_000 }) !== "Price") {
      await Promise.all([
        website.waitForEvent("framenavigated", { predicate: frame => frame === website.mainFrame(), timeout: 30_000 }),
        sorter.selectOption({ label: "Price" }, { timeout: 15_000 }),
      ]);
      await website.waitForLoadState("load", { timeout: 30_000 });
    }
    const toggle = main.locator('[title="Set Ascending Direction"],[title="Set Descending Direction"]').filter({ visible: true }).first();
    const title = action.direction === "ascending" ? "Set Ascending Direction" : "Set Descending Direction";
    if (await toggle.getAttribute("title", { timeout: 15_000 }) === title) {
      await Promise.all([
        website.waitForEvent("framenavigated", { predicate: frame => frame === website.mainFrame(), timeout: 30_000 }),
        toggle.click({ timeout: 15_000 }),
      ]);
      await website.waitForLoadState("load", { timeout: 30_000 });
    }
    const opposite = action.direction === "ascending" ? "Set Descending Direction" : "Set Ascending Direction";
    if (await toggle.getAttribute("title", { timeout: 15_000 }) !== opposite) throw new Error("The storefront did not expose the selected price direction");
  }
  return {};
}

async function openPublicRatingProduct(run: Run) {
  const site = run.site;
  if (!site || run.publicSearch?.state !== "completed" || run.ratingProduct)
    throw new Error("The product requires its own completed public search");
  const { frameTree: { frame: previous } } = await site.session.send("Page.getFrameTree");
  if (previous.loaderId !== run.publicSearch.destination.documentId)
    throw new Error("The public search document changed before the product was opened");
  const listings = site.page.getByRole("main").locator("a.product-item-link").filter({ visible: true });
  const productMatch = /^(?=.*\bugreen\b)(?=.*\blightning\b)(?=.*3[.\s]+5\s*mm).+$/isu;
  const matches = listings.filter({ hasText: productMatch });
  const cables = matches.filter({ hasText: /\bcable\b/iu });
  const [visible, matching, cableCount, titles] = await Promise.all([
    listings.count(), matches.count(), cables.count(), listings.allTextContents(),
  ]);
  run.ratingListings = { visible, matching, cables: cableCount, labels: titles.slice(0, 25).map(title => title.trim().slice(0, 180)) };
  const link = cableCount === 1 ? cables : matching === 1 ? matches : undefined;
  if (!link) throw new Error("The requested public product is not uniquely identifiable");
  const label = (await link.innerText()).trim();
  const href = await link.getAttribute("href");
  const address = href && URL.parse(href, previous.url);
  if (!address || address.origin !== site.origin || address.search || address.hash || address.username || address.password)
    throw new Error("The visible product link did not identify a public Shopping page");
  await Promise.all([
    site.page.waitForURL(address.href, { waitUntil: "load", timeout: 30_000 }),
    link.click(),
  ]);
  await site.page.getByRole("main").getByRole("heading", { level: 1, name: label, exact: true }).waitFor({ timeout: 15_000 });
  const { frameTree: { frame: current } } = await site.session.send("Page.getFrameTree");
  if (current.loaderId === previous.loaderId || current.url !== address.href)
    throw new Error("Opening the product did not commit the selected document");
  run.ratingProduct = { url: current.url, documentId: current.loaderId };
  return run.ratingProduct;
}

async function benchmarkSurface(context: BrowserCommandContext, action: SiteAction) {
  if (action.kind === "begin") {
    const fixture = byId.get(action.taskId);
    if (!fixture || activeRuns.has(context.page)) throw new Error("The Chromium benchmark case is not available");
    if (fixture.evaluator === "webarena" && official) context.project.vitest.onCancel(official.close);
    activeRuns.set(context.page, { fixture, pendingRoutes: new Set(), decisions: 0, decisionResults: [] });
    return {};
  }
  const run = activeRuns.get(context.page);
  if (!run) throw new Error("No benchmark fixture was supplied to the Chromium transport");
  const { fixture: definition } = run;
  const publicSearch = definition.requiredStep === "SearchPublicSite";
  const publicSort = definition.requiredStep === "SortPublicListing";
  if (action.kind === "openPublicCategory" || action.kind === "setWebsitePriceOrder") {
    if (!publicSort || !run.site) throw new Error("The website sort is outside its reviewed case");
    return operatePublicSort(run.site, definition, action);
  }
  const product = definition.taskId === publicRatingTask ? ratingProduct(definition.intent) : undefined;
  if (action.kind === "openPublicRatingProduct") {
    if (product === undefined) throw new Error("The product requires its own completed public search");
    return openPublicRatingProduct(run);
  }
  if (action.kind === "submitPublicSearch") {
    const site = run.site;
    if ((!publicSearch && product === undefined) || !site || run.publicSearch || site.page.url() !== definition.startUrl ||
        (product === undefined ? publicSearchQuery(definition.intent) : ratingSearchQuery(product)) !== action.query)
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
        const response = await fetch(new URL("/api/v1/chat/completions", origin), {
          method: "POST", body: request.postData(), headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          redirect: "error", signal: AbortSignal.timeout(45000),
        }).catch(() => new Response(null, { status: 503 }));
        run.chatStatus = response.status;
        return route.fulfill({ status: response.status, headers, contentType: response.headers.get("content-type") ?? "application/json", body: await response.text() });
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
    }));
    return {};
  }
  if (action.kind === "receipt") {
    try {
      await drainBenchmarkRoutes(run);
      const decisionProvider = publicSearch || publicSort || product !== undefined ? "none" : definition.fixtureChoice === undefined ? "hosted" : "fixture";
      const { answer, ...visibleOutcome } = action.outcome;
      const observation = {
        surface: "desktop-chromium", taskId: definition.taskId, intent: definition.intent, startUrl: definition.startUrl,
        decisionProvider, decisionRequests: run.decisions, syntheticStorageState: Boolean(run.site && definition.siteStorageState),
        decisionServiceOrigin: decisionProvider === "hosted" && process.env.GRACE_BENCHMARK_CLEF_ORIGIN
          ? new URL(process.env.GRACE_BENCHMARK_CLEF_ORIGIN).origin : undefined,
        outcome: { ...visibleOutcome, chatProvider: definition.chat ?? "fixture", ...(product !== undefined && { ratingListings: run.ratingListings }) }, chatStatus: run.chatStatus,
        decisionResults: run.decisionResults,
      };
      const guided = hasHostedNavigation(observation, run.site?.page.url());
      const grade = await fleet?.grade(definition.taskId, run.site?.page, guided);
      let evaluatorOutcome: Record<string, unknown> = action.outcome;
      if (product !== undefined && action.outcome.failure === undefined) {
        const { site, ratingProduct: checkedProduct, noAction } = run;
        const frame = site && (await site.session.send("Page.getFrameTree")).frameTree.frame;
        if (!frame || checkedProduct?.documentId !== frame.loaderId || checkedProduct.url !== frame.url || !noAction)
          throw new Error("The answer attempt lost its public product or its untouched control");
        evaluatorOutcome = { ...visibleOutcome, answer, destination: checkedProduct, noAction };
        Object.assign(observation.outcome, { destination: checkedProduct, noAction, graceResponded: typeof answer === "string" && answer.trim() !== "" });
      }
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
        if (product !== undefined && (!("wrongAnswerScore" in webArenaGrade) || webArenaGrade.wrongAnswerScore !== 0))
          throw new Error("The pinned string grader did not reject the independent wrong rating");
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
      await drainBenchmarkRoutes(run);
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
      if (product !== undefined) {
        const idle = await chromium.newContext(options);
        try {
          await routeFixtureContext(idle, { origin, permits: request => ["GET", "HEAD"].includes(request.method()) });
          const control = await idle.newPage();
          const observer = await observeFromDocumentStart(control);
          if (!(await control.goto(start.href, { waitUntil: "load" }))?.ok())
            throw new Error("The untouched Shopping control did not load");
          const { frameTree: { frame } } = await observer.send("Page.getFrameTree");
          run.noAction = { url: frame.url, documentId: frame.loaderId };
        } finally {
          await idle.close();
        }
      }
      await routeFixtureContext(browser, { origin, permits: (request, url) => {
        if (!["GET", "HEAD"].includes(request.method())) return false;
        if (publicSearch) return !request.isNavigationRequest() || url.href === start.href ||
          (run.publicSearch !== undefined && request.method() === "GET" && matchesPublicSearch(url, run.publicSearch.search));
        if (definition.evaluator === "webarena" && definition.taskId === "157")
          return !request.isNavigationRequest() || url.pathname.startsWith("/admin/");
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

type SiteObservation = Extract<SiteAction, { kind: "read" | "inspectGuide" | "tapGuide" | "hoverGuide" | "control" }>;

async function observeSite(existing: Site, action: SiteObservation) {
  const { page, origin, session } = existing;
  const { frameTree } = await session.send("Page.getFrameTree");
  const { id, loaderId, url } = frameTree.frame;
  if (new URL(url).origin !== origin) throw new Error("The site left its benchmark origin");
  if (existing.world?.loaderId !== loaderId) {
    const { executionContextId } = await session.send("Page.createIsolatedWorld", { frameId: id, worldName: observationWorld });
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
  if (action.kind === "inspectGuide" || action.kind === "tapGuide" || action.kind === "hoverGuide") {
    if (action.kind !== "inspectGuide") await page.bringToFront();
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
    const { frameTree: current } = await session.send("Page.getFrameTree");
    const sameDocument = current.frame.loaderId === loaderId && current.frame.url === url;
    if (action.kind === "inspectGuide") {
      if (!sameDocument) throw new Error("The benchmark document changed during the guide check");
      return { ringAvailable: point !== null };
    }
    if (!point || !sameDocument) return { tapped: false, disclosed: false, url };
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
  if (command.subaction === "snapshot" && command.statementRegions && request.documentId !== loaderId)
    throw new Error("The requested statement document changed");
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
  if (action.request.command.subaction !== "snapshot") throw new Error("The statement trial only permits native observation");
  await existing.episode.beforeObservation?.();
  return observeSite(existing.site, { kind: "control", request: action.request });
}

const agentModel = Schema.decodeUnknownSync(Schema.Struct({ model: Schema.NonEmptyString }))(JSON.parse(readFileSync(join(import.meta.dirname, "agent/policy.json"), "utf8"))).model;
const ModelReply = Schema.Struct({ choices: Schema.Array(Schema.Struct({ message: Schema.Struct({ content: Schema.String }) })) });
const realModelCredential = process.env.GRACE_BENCHMARK_CLEF_ORIGIN && process.env.GRACE_BENCHMARK_CLEF_KEY
  ? { origin: process.env.GRACE_BENCHMARK_CLEF_ORIGIN, key: process.env.GRACE_BENCHMARK_CLEF_KEY } : undefined;
async function realModel(_context: BrowserCommandContext, system: string, messages: readonly { role: "user" | "assistant"; content: string }[]) {
  if (!realModelCredential || new URL(realModelCredential.origin).protocol !== "https:") throw new Error("The real model requires a test credential");
  const response = await fetch(new URL("/api/v1/chat/completions", realModelCredential.origin), {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(60000),
    headers: { Authorization: `Bearer ${realModelCredential.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: agentModel, max_tokens: 1024, messages: [{ role: "system", content: system }, ...messages] }),
  });
  if (!response.ok) throw new Error(`The real model answered ${response.status}`);
  const [choice] = Schema.decodeUnknownSync(ModelReply)(await response.json()).choices;
  if (!choice) throw new Error("The real model gave no reply");
  return choice.message.content;
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

type RecordCase = "later winner" | "earlier winner" | "tied latest" | "changed scope" | "mismatched detail" | "wrong record kind" | "ambiguous collection" | "conflicting counts" | "unclear count" | "conflicting account" | "private form" | "newsletter list" | "unverified account" | "same-name account switch" | "short dates" | "public list";
type RecordAction =
  | { kind: "open"; scenario: RecordCase; decisionUrl: string }
  | { kind: "close" } | { kind: "requests" } | { kind: "accountVisits" }
  | { kind: "manualRecordLink"; label: "View order" | "My Account" }
  | SiteObservation;
const recordSites = new WeakMap<Page, { site: Site; decisionUrl: string; chatUrl: string; requests: { count: number; leaked: boolean }; accountVisits?: string[] }>();

async function recordPage(context: BrowserCommandContext, action: RecordAction) {
  const open = recordSites.get(context.page);
  if (action.kind === "open") {
    if (open) throw new Error("The record fixture is already open");
    const browser = await context.context.browser()?.newContext();
    if (!browser) throw new Error("The record fixture needs Chromium");
    const origin = "https://records.localhost";
    const accountVisits: string[] | undefined = action.scenario === "same-name account switch" ? [] : undefined;
    const requests = { count: 0, leaked: false };
    const chatUrl = new URL("/api/v1/chat/completions", action.decisionUrl).href;
    try {
      const website = await browser.newPage();
      const session = await observeFromDocumentStart(website);
      await website.route(`${origin}/**`, (route) => {
        const url = new URL(route.request().url());
        const later = url.searchParams.get("page") === "2";
        const account = later && action.scenario === "changed scope" ? "acct-a" : "acct-A";
        const dashboard = url.pathname === "/home";
        if (route.request().isNavigationRequest())
          accountVisits?.push(`${url.pathname}:${dashboard ? "A" : "B"}`);
        const index = later ? 2 : 1;
        const unbound = action.scenario === "public list" || action.scenario === "unverified account";
        const conflictingCount = action.scenario === "conflicting counts" || action.scenario === "unclear count";
        const single = unbound || conflictingCount || accountVisits !== undefined;
        const detail = url.pathname.startsWith("/view/");
        const label = action.scenario === "mismatched detail" ? "private-canary-wrong" : "private-canary-" + url.pathname.split("/").at(-1);
        const newer = action.scenario === "earlier winner" ? !later : later;
        const day = newer && action.scenario !== "tied latest" ? 18 : 17;
        const date = action.scenario === "earlier winner" ? `<time datetime="2026-10-${day}">10/${day}/26</time>` :
          action.scenario === "short dates" ? `10/${day}/26` : `2026-10-${day}`;
        const status = action.scenario === "earlier winner" ? "Canceled" : "Complete";
        const newsletter = '<form><label>Newsletter email<input type="email"></label><button type="submit">Subscribe</button></form>';
        const homepage = '<h1>My Account</h1><nav><a id="orders" href="/list">My Orders</a></nav>' +
          `<section><h2>Recent orders</h2><table><tbody><tr>${accountVisits ? `<td>private-canary-1</td><td>${date}</td><td>${status}</td>` : ""}<td><a href="/view/1">View order</a></td></tr></tbody></table></section>`;
        const totals = conflictingCount
          ? `<div><p>1 Item</p><section><p>${action.scenario === "unclear count" ? "Showing part of 8" : "Showing 1–1 of 8"}</p></section></div>`
          : `<p>${single ? "1 Item" : `Items ${index} to ${index} of 2 total`}</p>`;
        const content = detail ? `<h1>${action.scenario === "wrong record kind" ? "Invoice" : "Order"} #${label}</h1>` +
          (accountVisits ? `<p>${status}</p><time>${date}</time><a href="/home">My Account</a>` : "") : dashboard ?
          homepage + (action.scenario === "private form" ?
            '<form aria-label="Sign in"><label>Username<input name="username"></label><label>Password<input name="password" type="password"></label><button type="submit">Sign in</button></form>' :
            newsletter) :
          `<h1>Orders</h1>${totals}<table>
          <thead><tr><th>Order number</th><th>Order date</th><th>Status</th><th>Action</th></tr></thead>
          <tbody><tr><td>private-canary-${index}</td><td>${date}</td><td>${status}</td><td><a id="details" href="/view/${index}">View order</a></td></tr></tbody>
        </table><nav aria-label="Pages">${single ? "" : later ? '<a id="previous" href="/list">Previous</a>' : '<a id="next" href="/list?page=2">Next</a>'}</nav>` + (action.scenario === "newsletter list" ? newsletter : "");
        const decoy = action.scenario === "ambiguous collection" ?
          '<section><p>1 Item</p><table><thead><tr><th>Order number</th><th>Order date</th><th>Status</th></tr></thead><tbody><tr><td>private-canary-decoy</td><td>2026-10-20</td><td>Complete</td></tr></tbody></table></section>' : "";
        const badge = action.scenario === "conflicting account" ? '<span aria-label="Account">#acct-B</span>' : "";
        const banner = accountVisits ? `<header><span>Welcome, Morgan Lee</span>${dashboard ? "<p>Account ID: private-canary-A</p>" : ""}</header>`
          : unbound ? "" : `<header>Account ID: ${account}${badge}</header>`;
        const scope = action.scenario === "public list" ? ' aria-label="Public records"' : "";
        return route.fulfill({ contentType: "text/html; charset=utf-8", body: `<!doctype html><title>Record fixture</title>${banner}<main${scope}>${content}${decoy}</main>` });
      });
      await context.page.route(action.decisionUrl, async (route) => {
        requests.count++;
        requests.leaked ||= (route.request().postData() ?? "").includes("private-canary");
        await route.abort();
      });
      await context.page.route(chatUrl, (route) => {
        requests.leaked ||= (route.request().postData() ?? "").includes("private-canary");
        return route.continue();
      });
      const url = origin + (accountVisits || action.scenario === "later winner" || action.scenario === "private form" ? "/home" : "/list");
      await website.goto(url);
      recordSites.set(context.page, { site: { page: website, origin, browser, session }, decisionUrl: action.decisionUrl, chatUrl, requests, accountVisits });
      await context.page.bringToFront();
      return { url };
    } catch (error) {
      await context.page.unroute(action.decisionUrl);
      await context.page.unroute(chatUrl);
      await browser.close();
      throw error;
    }
  }
  if (!open) throw new Error("The record fixture is not open");
  if (action.kind === "close") {
    recordSites.delete(context.page);
    await context.page.unroute(open.decisionUrl);
    await context.page.unroute(open.chatUrl);
    await open.site.browser.close();
    return {};
  }
  if (action.kind === "requests") return open.requests;
  if (action.kind === "accountVisits") return { visits: open.accountVisits };
  if (action.kind === "manualRecordLink") {
    if (!open.accountVisits) throw new Error("This fixture has no manual account-switch journey");
    await open.site.page.getByRole("link", { name: action.label, exact: true }).click();
    return { tapped: true };
  }
  return observeSite(open.site, action);
}

async function privateVerification(context: BrowserCommandContext, cloud: string, key: string) {
  const gmail = new URL(cloud);
  if (gmail.protocol !== "http:" || gmail.hostname !== "127.0.0.1" || !key.startsWith("fake-key-"))
    throw new Error("Private verification requires the local synthetic provider");
  const run = randomUUID();
  const password = randomUUID();
  const delivered = new Set<string>();
  const visits = new Map<string, { current: string; accepted: boolean }>();
  const mailbox = "owner@grace.test";
  const mailHeaders = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const SearchResult = Schema.Struct({ messages: Schema.Array(Schema.Struct({ externalId: Schema.String })) });
  const OpenedMessage = Schema.Struct({ bodyText: Schema.String });
  const site = createServer(async (request, response) => {
    const [visit, action] = (request.url ?? "").slice(1).split("/");
    if (!visit || !["primary", "foreign"].includes(visit)) {
      response.writeHead(404).end();
      return;
    }
    const send = (title: string, body: string, status = 200) => response.writeHead(status, {
      "Content-Type": "text/html", "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; form-action 'self'; frame-ancestors 'none'",
    }).end(`<!doctype html><html lang="en"><title>${title}</title><main><h1>${title}</h1>${body}</main></html>`);
    try {
      if (request.method === "GET" && action === undefined) {
        send("Synthetic website sign-in", `<form method="post" action="/${visit}/sign-in">
          <label>Username <input name="username" autocomplete="username" required></label>
          <label>Password <input name="password" type="password" autocomplete="current-password" required></label>
          <button>Sign in</button></form>`);
        return;
      }
      if (request.method !== "POST") { response.writeHead(404).end(); return; }
      let body = "";
      for await (const part of request) {
        body += String(part);
        if (body.length > 512) { response.writeHead(413).end(); return; }
      }
      const form = new URLSearchParams(body);
      const previous = visits.get(visit);
      const correctLogin = action === "sign-in" && form.get("username") === mailbox && form.get("password") === password;
      if (correctLogin || (action === "replace" && previous && !previous.accepted)) {
        let current: string;
        do { current = String(randomInt(100000, 1000000)); } while (delivered.has(current));
        const mailed = await fetch(new URL("/fake/gmail/incoming", gmail), {
          method: "POST", headers: mailHeaders, body: JSON.stringify({
            to: mailbox, from: "Synthetic issuer", fromEmail: "issuer@grace.test",
            subject: `${run} ${visit} verification code`, body: `Your verification code is ${current}.`,
          }),
        });
        if (!mailed.ok) { send("Delivery failed", "", 502); return; }
        delivered.add(current);
        visits.set(visit, { current, accepted: false });
      } else if (action === "verify" && previous && !previous.accepted) {
        if (form.get("code") === previous.current) {
          previous.accepted = true;
          send("Code accepted", "");
          return;
        }
      } else {
        send("Sign-in refused", "", 403);
        return;
      }
      send("Confirm your test email", `${action === "verify" ? '<p role="status">The code was rejected.</p>' : ""}
        <form method="post" action="/${visit}/verify"><label>Verification code
        <input name="code" inputmode="numeric" autocomplete="one-time-code" required></label><button>Verify code</button></form>
        <form method="post" action="/${visit}/replace"><button>Send a replacement</button></form>`);
    } catch {
      send("Synthetic issuer failed", "", 500);
    }
  });
  site.listen(0, "127.0.0.1");
  let primary: Page | undefined;
  let foreign: Page | undefined;
  let phase = "start issuer";
  try {
    await once(site, "listening");
    const address = site.address();
    if (!address || typeof address === "string") throw new Error("Missing local site");
    const enter = async (visit: "primary" | "foreign") => {
      const page = await context.context.newPage();
      if (visit === "primary") primary = page;
      else foreign = page;
      page.setDefaultTimeout(10_000);
      await page.goto(`http://127.0.0.1:${address.port}/${visit}`);
      await page.getByLabel("Username", { exact: true }).fill(mailbox);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.getByRole("heading", { name: "Confirm your test email" }).waitFor();
      return page;
    };
    const mailCode = async (visit: string) => {
      const name = "/api/v1/eliza/google/gmail";
      const search = new URL(name + "/search", gmail);
      search.searchParams.set("query", `in:inbox ${run} ${visit}`);
      const listed = await fetch(search, { headers: mailHeaders });
      if (!listed.ok) throw new Error("Mailbox unavailable");
      const message = Schema.decodeUnknownSync(SearchResult)(await listed.json()).messages[0];
      if (!message) throw new Error("Synthetic verification mail missing");
      const read = new URL(name + "/read", gmail);
      read.searchParams.set("messageId", message.externalId);
      const opened = await fetch(read, { headers: mailHeaders });
      if (!opened.ok) throw new Error("Synthetic message unavailable");
      const text = Schema.decodeUnknownSync(OpenedMessage)(await opened.json()).bodyText;
      const code = text.match(/^Your verification code is ([0-9]{6})\.$/)?.[1];
      if (!code) throw new Error("Invalid synthetic message");
      return code;
    };
    const submit = async (page: Page, code: string) => {
      await page.getByLabel("Verification code", { exact: true }).fill(code);
      await page.getByRole("button", { name: "Verify code", exact: true }).click();
    };
    phase = "sign in and deliver two independent messages";
    const page = await enter("primary");
    await enter("foreign");
    const previous = await mailCode("primary");
    const other = await mailCode("foreign");
    phase = "reject foreign code";
    await submit(page, other);
    await page.getByText("The code was rejected.", { exact: true }).waitFor();
    phase = "reject replaced code";
    await page.getByRole("button", { name: "Send a replacement" }).click();
    const replacement = await mailCode("primary");
    await submit(page, previous);
    await page.getByText("The code was rejected.", { exact: true }).waitFor();
    phase = "accept current code only on website";
    await submit(page, replacement);
    await page.getByRole("heading", { name: "Code accepted" }).waitFor();
    if (visits.get("foreign")?.accepted !== false) throw new Error("Independent visit was affected");
  } catch {
    throw new Error(`Synthetic sign-in journey did not finish at ${phase}`);
  } finally {
    try {
      await Promise.all([primary?.close(), foreign?.close()]);
      await context.page.bringToFront();
    } finally {
      site.closeAllConnections();
      await new Promise<void>((done) => { site.close(() => done()); });
    }
  }
}

declare module "vitest/browser" {
  interface BrowserCommands {
    benchmarkSurface: (action: SiteAction) => Promise<Record<string, unknown>>;
    recordPage: (action: RecordAction) => Promise<Record<string, unknown>>;
    googleConsent: (endpoint: string, address: string) => Promise<void>;
    privateVerification: (cloud: string, key: string) => Promise<void>;
    releasedStatement: (attempt: string, action: StatementAction) => Promise<Record<string, unknown>>;
    realModel: (system: string, messages: readonly { role: "user" | "assistant"; content: string }[]) => Promise<string>;
  }
}
declare module "vitest" {
  interface ProvidedContext {
    site: string;
    cloud: string;
    groundProxy: string;
    browserBenchmarks: readonly (Pick<BenchmarkDefinition, "taskId" | "intent" | "startUrl" | "requiredStep"> & { titleId: string; exploratory: boolean; gradeWholeCohort: boolean; publicRating?: string })[];
    billworldStatements: readonly { label: string; billerId?: string; refuses?: true }[];
    realModel: boolean;
  }
}

export default defineConfig(async (env) => {
  const config = await base(env);
  const projects = config.test?.projects?.map((entry) =>
    typeof entry === "object" && "test" in entry && entry.test?.browser
      ? {
          ...entry,
          ...(official && { plugins: [{ name: webArenaPluginName, api: official }] }),
          optimizeDeps: { ...entry.optimizeDeps, include: [...(entry.optimizeDeps?.include ?? []), "effect/crypto", "effect/References", "effect/testing", "pdf-lib"] },
          test: {
            ...entry.test,
            ...(official && { globalSetup: ["test/webarena.ts"] }),
            browser: {
              ...entry.test.browser,
              connectTimeout: 180_000,
              commands: { benchmarkSurface, googleConsent, privateVerification, recordPage, releasedStatement, realModel },
            },
          },
        }
      : entry);
  const billworldStatements = releasedDirectory === undefined ? [] : [
    { label: "released" },
    ...fleetStatementCases.map(({ billerId, template }) => ({ label: "Fleet " + template, billerId })),
    ...fleetStatementRefusals.map(({ billerId, template }) => ({ label: "Fleet " + template, billerId, refuses: true as const })),
  ];
  const reporters = fleet ? ["default", { onTestRunEnd: () => fleet.close() }] as const : undefined;
  return { ...config, resolve: { ...config.resolve, conditions: ["eliza-source", ...defaultClientConditions] }, test: { ...config.test, ...(reporters ? { reporters: [...reporters] } : {}), projects, provide: { browserBenchmarks, billworldStatements, realModel: realModelCredential !== undefined }, globalSetup: ["test/setup.vibe"] } };
});

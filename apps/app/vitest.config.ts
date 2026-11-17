import tailwindcss from "@tailwindcss/vite";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { Schema } from "effect";
import type { BrowserContext, CDPSession, Page } from "playwright";
import { defineConfig } from "vitest/config";
import type { BrowserCommandContext } from "vitest/node";
import { project } from "vibestack/testing/vitest";
import type { SurfacePlugin } from "./src/surfacePlugin.ts";
import { fleetFixture } from "./test/fleet.fixture.ts";
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
  receipt: Schema.NonEmptyString,
});
type BenchmarkDefinition = typeof BenchmarkDefinition.Type;
const host: NodeJS.Process & { graceFleet?: ReturnType<typeof fleetFixture> } = process;
const fleet = process.env.GRACE_BILLWORLD_DIR
  ? await (host.graceFleet ??= fleetFixture(process.env.GRACE_BILLWORLD_DIR, process.env.GRACE_BILLWORLD_RESULTS ?? ".cache/grace-billworld"))
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
  | { kind: "read" }
  | { kind: "tapGuide" }
  | { kind: "decisionRoute"; cloud: string }
  | { kind: "receipt"; outcome: Record<string, unknown> }
  | { kind: "control"; request: Command };

type Site = { page: Page; origin: string; browser: BrowserContext; session: CDPSession; world?: { loaderId: string; executionContextId: number } };
const DecisionResult = Schema.Struct({ status: Schema.String, model: Schema.optional(Schema.String), choice: Schema.optional(Schema.NullOr(Schema.String)), confidence: Schema.optional(Schema.Finite) });
type Run = { fixture: BenchmarkDefinition; decisions: number; decisionResults: { http: number; candidates: number; result?: typeof DecisionResult.Type }[]; chatStatus?: number; chatRoute?: string; decisionRoute?: string; site?: Site };
const activeRuns = new WeakMap<Page, Run>();
const Choices = Schema.Struct({ kind: Schema.Literal("choice"), goal: Schema.NonEmptyString, candidates: Schema.Array(Schema.Struct({ id: Schema.NonEmptyString, label: Schema.NonEmptyString })) });
const PageText = Schema.Struct({ title: Schema.String, text: Schema.String, truncated: Schema.Boolean });
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
        return route.fulfill({ headers, json: { status: "ok", kind: "choice", choice: selected?.id ?? null } });
      }
      const origin = process.env.GRACE_BENCHMARK_CLEF_ORIGIN;
      const key = process.env.GRACE_BENCHMARK_CLEF_KEY;
      if (!origin || !key || new URL(origin).protocol !== "https:") throw new Error("The hosted decision service is not configured");
      const response = await fetch(new URL("/api/v1/decisions", origin), {
        method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(choice), redirect: "error", signal: AbortSignal.timeout(10000),
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
      const grade = await fleet?.grade(definition.taskId, run.site?.page, run.decisions > 0 &&
        typeof action.outcome.graceTerminal === "string" && action.outcome.ringTap === true && !action.outcome.failure);
      const webArenaGrade = await officialGrades.get(definition.taskId)?.(action.outcome, {
        provider: decisionProvider, requests: run.decisions, authenticatedFixture: Boolean(run.site && definition.siteStorageState),
      })
        .catch((error: unknown) => ({ failure: error instanceof Error ? error.message : String(error) }));
      writeFileSync(definition.receipt, `${JSON.stringify({
        surface: "desktop-chromium", taskId: definition.taskId, intent: definition.intent, startUrl: definition.startUrl,
        decisionProvider, decisionRequests: run.decisions, syntheticStorageState: Boolean(run.site && definition.siteStorageState),
        decisionServiceOrigin: decisionProvider === "hosted" && process.env.GRACE_BENCHMARK_CLEF_ORIGIN
          ? new URL(process.env.GRACE_BENCHMARK_CLEF_ORIGIN).origin : undefined,
        outcome: { ...action.outcome, chatProvider: definition.chat ?? "fixture" }, chatStatus: run.chatStatus,
        grade, webArena: webArenaGrade, decisionResults: run.decisionResults,
      }, null, 2)}\n`, { flag: "wx", mode: 0o600 });
      if (grade && !grade.passed) throw new Error("Grace did not reach the biller's independently graded help destination");
      if (webArenaGrade && (!("officialScore" in webArenaGrade) || webArenaGrade.officialScore !== 1))
        throw new Error("The pinned WebArena evaluator did not score the observed document as a match");
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
    const content = await evaluate(`({title: document.title, text: document.body.innerText.slice(0, 6000), truncated: document.body.innerText.length > 6000})`);
    return { url, documentId: loaderId, ...Schema.decodeUnknownSync(PageText)(content) };
  }
  if (action.kind === "tapGuide") {
    const visible = await evaluate("globalThis.__elizaPageGuidanceV1?.visible === true");
    if (!visible) return { tapped: false, url };
    const { root } = await session.send("DOM.getDocument", { depth: -1, pierce: true });
    const rings: number[] = [];
    function find(node: typeof root, inClosedRoot = false) {
      if (inClosedRoot && node.attributes?.some((value, index) => index % 2 === 0 && value === "class" && node.attributes?.[index + 1].split(" ").includes("ring")))
        rings.push(node.nodeId);
      for (const child of node.children ?? []) find(child, inClosedRoot);
      for (const child of node.shadowRoots ?? []) find(child, child.shadowRootType === "closed");
    }
    find(root);
    if (rings.length !== 1) return { tapped: false, url };
    const { model: { border } } = await session.send("DOM.getBoxModel", { nodeId: rings[0] });
    await page.bringToFront();
    await page.mouse.click((border[0] + border[4]) / 2, (border[1] + border[5]) / 2);
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
  }
}
declare module "vitest" {
  interface ProvidedContext {
    browserBenchmarks: readonly Pick<BenchmarkDefinition, "taskId" | "intent" | "startUrl">[];
  }
}

export default defineConfig(async (env) => {
  const config = await base(env);
  const projects = config.test?.projects?.map((entry) =>
    typeof entry === "object" && "test" in entry && entry.test?.browser
      ? { ...entry, test: { ...entry.test, browser: { ...entry.test.browser, commands: { benchmarkSurface, googleConsent } } } }
      : entry);
  const browserBenchmarks = runs.map(({ taskId, intent, startUrl }) => ({ taskId, intent, startUrl }));
  const reporters = fleet ? ["default", { onTestRunEnd: () => fleet.close() }] as const : undefined;
  return { ...config, test: { ...config.test, ...(reporters ? { reporters: [...reporters] } : {}), projects, provide: { browserBenchmarks }, globalSetup: ["test/setup.vibe"] } };
});

import { execFileSync, spawn } from "node:child_process";
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { Server } from "node:http";
import { createServer } from "node:https";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Schema } from "effect";
import type { Page } from "playwright";
import { selfSigned } from "./tls.ts";
import { hasHostedNavigation } from "./browser-receipt.ts";
import { routeFixtureContext } from "./fixture-context.ts";

const revision = "8320228bccf0759f375b9633592612e0e570a526";
const Biller = Schema.Struct({ id: Schema.NonEmptyString, template: Schema.NonEmptyString, signal: Schema.String, brand: Schema.Struct({ shortName: Schema.NonEmptyString }) });
const Case = Schema.Struct({
  taskId: Schema.NonEmptyString, template: Schema.NonEmptyString, evidence: Schema.String,
  startUrl: Schema.NonEmptyString, expected: Schema.NonEmptyString,
});
const Manifest = Schema.Struct({
  revision: Schema.String, productRevision: Schema.String, navigation: Schema.Literal("public support page"),
  shard: Schema.NullOr(Schema.Number), shardCount: Schema.Number, cohortNumber: Schema.optional(Schema.Int), cohort: Schema.Array(Case),
});
const Receipt = Schema.Struct({
  surface: Schema.Literal("desktop-chromium"), taskId: Schema.String, startUrl: Schema.String,
  intent: Schema.String, decisionProvider: Schema.Literal("hosted"), decisionRequests: Schema.Number,
  outcome: Schema.Struct({
    graceTerminal: Schema.optional(Schema.String), ringTap: Schema.optional(Schema.Boolean),
    failure: Schema.optional(Schema.Unknown),
  }),
  grade: Schema.Struct({
    expected: Schema.String, destination: Schema.optional(Schema.String), visible: Schema.Boolean, passed: Schema.Boolean,
  }),
});
const Routes = Schema.Struct({ routes: Schema.Struct({ home: Schema.String, help: Schema.NonEmptyString }) });
const Intent = "Open the website's help center or frequently asked questions index. Stop on the page that lists help topics.";
type Method = (...args: unknown[]) => unknown;
const FixtureMethod = Schema.declare<Method>((value): value is Method => typeof value === "function");
const Catalog = Schema.declare<ReadonlyMap<unknown, unknown>>((value) => value instanceof Map);
const Fleet = Schema.Struct({
  publicServer: Schema.instanceOf(Server), baseUrl: Schema.NonEmptyString, adminServer: Schema.instanceOf(Server), admin: FixtureMethod, templateFor: FixtureMethod, close: FixtureMethod,
  world: Schema.Struct({ catalog: Schema.Struct({ billers: Catalog }) }),
});

function localRoute(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.hostname !== "127.0.0.1" || !url.port || url.username || url.password)
    throw new Error("Fleet receipt URL must use the loopback HTTPS fixture");
  return url.pathname + url.search + url.hash;
}

function sameOrigin(first: string, second: string) {
  return new URL(first).origin === new URL(second).origin;
}

async function lockResults(run: string) {
  const guard = spawn("python3", ["-c", [
    "import fcntl, sys",
    "with open(sys.argv[1], 'a') as lock:",
    "    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)",
    "    print('locked', flush=True)",
    "    sys.stdin.buffer.read()",
  ].join("\n"), join(run, "writer.lock")], { stdio: ["pipe", "pipe", "ignore"] });
  await new Promise<void>((ready, reject) => {
    guard.once("error", reject);
    guard.once("exit", () => reject(new Error("Fleet result directory is locked by another writer")));
    guard.stdout.once("data", () => ready());
  });
  guard.stdout.destroy();
  guard.unref();
  return () => new Promise<void>((released) => {
    guard.ref();
    guard.once("close", () => released());
    guard.stdin.end();
  });
}

async function openFleetServer(tree: string, loginPaths?: Set<string>) {
  const source = Schema.decodeUnknownSync(Schema.Struct({ start: FixtureMethod }))(await import(pathToFileURL(join(tree, "billworld/fleet/server.mjs")).href));
  const fleet = Schema.decodeUnknownSync(Fleet)(await source.start({ port: 0, adminPort: 0, host: "127.0.0.1", google: false, quiet: true, openWorld: loginPaths === undefined }));
  let tls: ReturnType<typeof createServer> | undefined;
  const close = async () => {
    const server = tls;
    server?.closeAllConnections();
    await Promise.all([server && new Promise<void>(done => server.close(() => done())), fleet.close()]);
  };
  try {
    const publicSite = fleet.publicServer;
    publicSite.unref();
    fleet.adminServer.unref();
    tls = createServer(selfSigned("127.0.0.1"), (request, response) => {
        const login = request.method === "POST" && request.url !== undefined && loginPaths?.has(request.url);
        if (request.method !== "GET" && request.method !== "HEAD" && !login) { response.writeHead(405).end(); return; }
        publicSite.emit("request", request, response);
    });
    const server = tls;
    await new Promise<void>((ready, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", ready); });
    server.unref();
    const binding = server.address();
    if (!binding || typeof binding === "string") throw new Error("Fleet needs a loopback HTTPS port");
    const origin = "https://127.0.0.1:" + binding.port;
    return { fleet, origin, close };
  } catch (error) {
    await close();
    throw error;
  }
}

const helpCohortSize = 100;

function helpCohortNumber(setting: string | undefined) {
  const value = setting ?? "1";
  const cohort = Number(value);
  if (!/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(cohort))
    throw new Error("GRACE_BILLWORLD_COHORT must be a positive integer");
  return cohort;
}

export function fleetHelpCohorts(catalog: ReadonlyMap<unknown, unknown>) {
  const groups = new Map<string, (typeof Biller.Type)[]>();
  const decode = Schema.decodeUnknownSync(Biller);
  for (const raw of catalog.values()) {
    const biller = decode(raw);
    const group = groups.get(biller.template) ?? [];
    group.push(biller);
    groups.set(biller.template, group);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, "en")).map(([, group]) =>
    group.sort((a, b) => a.id.localeCompare(b.id, "en")));
  const cohorts: (typeof Biller.Type)[][] = [];
  let batch: (typeof Biller.Type)[] = [];
  const depth = Math.max(0, ...ordered.map((group) => group.length));
  for (let offset = 0; offset < depth; offset++) {
    for (const billers of ordered) {
      const biller = billers[offset];
      if (!biller) continue;
      batch.push(biller);
      if (batch.length === helpCohortSize) {
        cohorts.push(batch);
        batch = [];
      }
    }
  }
  if (batch.length) cohorts.push(batch);
  return cohorts;
}

async function openFleet(tree: string, cohort: number) {
  const { fleet, origin, close } = await openFleetServer(tree);
  try {
    const catalog = fleet.world.catalog.billers;
    const cohorts = fleetHelpCohorts(catalog);
    const selected = cohorts[cohort - 1];
    if (!selected) throw new Error(`GRACE_BILLWORLD_COHORT must be between 1 and ${cohorts.length} for the pinned Fleet catalog`);
    const cases = selected.map((biller) => {
      const entry = catalog.get(biller.id);
      const { routes } = Schema.decodeUnknownSync(Routes)(fleet.templateFor(entry));
      const path = "/b/" + encodeURIComponent(biller.id);
      return { biller, startUrl: origin + path + routes.home, expected: origin + path + routes.help };
    });
    return { cases, close };
  } catch (error) {
    await close();
    throw error;
  }
}

function pinnedFleet(directory: string) {
  const tree = resolve(directory);
  const sha = execFileSync("git", ["-C", tree, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (sha !== revision || execFileSync("git", ["-C", tree, "status", "--porcelain", "--", "categories", "billworld/fleet"], { encoding: "utf8" }).trim())
    throw new Error("Fleet qualification requires the unmodified pinned BillWorld sources");
  return tree;
}

export async function fleetFixture({ directory, results, shardSetting, resumeDirectory, cohortSetting }: {
  directory: string;
  results: string;
  shardSetting?: string;
  resumeDirectory?: string;
  cohortSetting?: string;
}) {
  const cohortNumber = helpCohortNumber(cohortSetting);
  const cohortMetadata = cohortNumber === 1 ? {} : { cohortNumber };
  const shardCount = 4;
  if (shardSetting !== undefined && !/^[1-4]$/.test(shardSetting))
    throw new Error("GRACE_BILLWORLD_SHARD must be one of 1, 2, 3 or 4");
  const shard = shardSetting === undefined ? null : Number(shardSetting);
  const product = fileURLToPath(new URL("../../..", import.meta.url));
  const git = (args: string[]) => execFileSync("git", ["-C", product, ...args], { encoding: "utf8" }).trim();
  const productRevision = git(["rev-parse", "HEAD"]);
  if (git(["status", "--porcelain", "--untracked-files=no", "--ignore-submodules=untracked"]))
    throw new Error("Fleet qualification requires an unmodified product revision");
  const tree = pinnedFleet(directory);
  const run = resumeDirectory === undefined
    ? (mkdirSync(results, { recursive: true }), mkdtempSync(join(resolve(results), "fleet-")))
    : resolve(resumeDirectory);
  const manifestFile = join(run, "cohort.json");
  const unlock = await lockResults(run);
  let environment: Awaited<ReturnType<typeof openFleet>> | undefined;
  try {
    const original = resumeDirectory === undefined
      ? undefined
      : Schema.decodeUnknownSync(Manifest)(JSON.parse(readFileSync(manifestFile, "utf8")));
    const changed = "Fleet resume requires the same pinned dataset, clean product revision, cohort and shard";
    if (original && (original.revision !== revision || original.productRevision !== productRevision ||
        (original.cohortNumber ?? 1) !== cohortNumber || original.shard !== shard || original.shardCount !== shardCount))
      throw new Error(changed);
    const { cases, close } = environment = await openFleet(tree, cohortNumber);
    const manifest = cases.map(({ biller, startUrl, expected }) => ({ taskId: biller.id, template: biller.template, evidence: biller.signal, startUrl, expected }));
    const metadata = { revision, productRevision, navigation: "public support page", shard, shardCount, ...cohortMetadata, cohort: manifest };
    const assigned = cases.filter((_, index) => shard === null || index % shardCount === shard - 1);
    const assignedIds = new Set(assigned.map(({ biller }) => biller.id));
    const expected = new Map(manifest.filter(item => assignedIds.has(item.taskId)).map(item => [item.taskId, item]));
    const graded = new Map<string, boolean>();
    const score = () => ({
      revision, productRevision, shard, shardCount, ...cohortMetadata, cohortTotal: cases.length, attempted: graded.size, total: assigned.length,
      passed: [...graded.values()].filter(Boolean).length, cases: Object.fromEntries(graded),
    });
    const replaceScores = () => {
      const next = join(run, "scores.json.tmp");
      writeFileSync(next, JSON.stringify(score(), null, 2));
      renameSync(next, join(run, "scores.json"));
    };
    const decodeReceipt = Schema.decodeUnknownSync(Receipt);
    const receiptResult = (taskId: string, input: unknown) => {
      const receipt = decodeReceipt(input);
      const task = expected.get(taskId);
      const { startUrl, grade } = receipt;
      if (!task || receipt.taskId !== taskId || receipt.intent !== Intent ||
          localRoute(startUrl) !== localRoute(task.startUrl) ||
          localRoute(grade.expected) !== localRoute(task.expected) || !sameOrigin(startUrl, grade.expected))
        throw new Error("Fleet receipt does not match its declared task");
      const arrived = grade.destination === grade.expected && grade.destination !== startUrl;
      const passed = arrived && grade.visible && hasHostedNavigation(input, grade.destination);
      if (grade.passed !== passed || (grade.visible && !arrived))
        throw new Error("Fleet receipt grade contradicts its observed outcome");
      return passed;
    };
    if (!original) writeFileSync(manifestFile, JSON.stringify(metadata, null, 2), { flag: "wx", mode: 0o600 });
    else {
      const landmarks = (items: readonly (typeof Case.Type)[]) => items.map(({ taskId, template, evidence, startUrl, expected }) =>
        [taskId, template, evidence, localRoute(startUrl), localRoute(expected)]);
      if (JSON.stringify(landmarks(original.cohort)) !== JSON.stringify(landmarks(manifest)))
        throw new Error(changed);
      for (const filename of readdirSync(run)) {
        if (!filename.endsWith(".json") || filename === "cohort.json" || filename === "scores.json") continue;
        const taskId = filename.slice(0, -5);
        graded.set(taskId, receiptResult(taskId, JSON.parse(readFileSync(join(run, filename), "utf8"))));
      }
    }
    replaceScores();
    return {
      definitions: assigned.filter(({ biller }) => !graded.has(biller.id)).map(({ biller, startUrl }) => ({ taskId: biller.id, startUrl, intent: Intent, receipt: join(run, biller.id + ".json") })),
      async grade(taskId: string, site: Page | undefined, guided: boolean) {
        const task = expected.get(taskId);
        if (!task) throw new Error("Unknown Fleet biller");
        const destination = site?.url();
        const arrived = destination === task.expected && destination !== task.startUrl;
        const visible = !!site && arrived && await site.locator("body").isVisible();
        const passed = guided && arrived && visible;
        return { expected: task.expected, destination, visible, passed };
      },
      record(taskId: string, receipt: unknown) {
        const passed = receiptResult(taskId, receipt);
        const destination = join(run, taskId + ".json");
        const next = destination + ".tmp";
        writeFileSync(next, JSON.stringify(receipt, null, 2) + "\n", { mode: 0o600 });
        try { linkSync(next, destination); }
        finally { rmSync(next, { force: true }); }
        graded.set(taskId, passed);
        replaceScores();
      },
      async close() {
        try {
          await close();
          const { passed, attempted } = score();
          if (attempted !== assigned.length || passed !== assigned.length)
            throw new Error(`BillWorld graded ${passed}/${assigned.length} correct destinations on ${attempted} attempts. See ${run}/scores.json`);
        } finally { await unlock(); }
      },
    };
  } catch (error) {
    try { await environment?.close(); }
    finally { await unlock(); }
    throw error;
  }
}

export const fleetStatementCases = [
  { billerId: "121-disposal-co-d58f27", template: "utility-account" },
  { billerId: "405-express-lanes-orange-county-ca-32605e", template: "toll-account" },
  { billerId: "aberdeen-news-aberdeen-sd-newspaper-subscription-446eec", template: "newspaper" },
  { billerId: "abc-warehouse-credit-card-synchrony-dd0607", template: "card-servicer" },
  { billerId: "acushnet-water-department-ma-eb0721", template: "municipal-portal" },
  { billerId: "adventhealth-castle-rock-castle-rock-co-de3968", template: "mychart" },
  { billerId: "advance-america-82c9f5", template: "loan-servicer" },
  { billerId: "alexandria-oh-municipal-income-tax-administered--565714", template: "income-tax" },
  { billerId: "anoka-municipal-utility-city-of-anoka-252a5c", template: "invoicecloud" },
  { billerId: "b-and-b-sanitation-waste-connections-fec9e8", template: "waste-hauler" },
  { billerId: "belton-honea-path-wa-sc0410011-66b378", template: "xpress" },
  { billerId: "colyell-community-water-6ce73c", template: "doxo" },
  { billerId: "aflac-dental-insurance-60fdf1", template: "insurance" },
  { billerId: "ace-cash-express-bill-payment-5a3f3c", template: "invoice-portal" },
  { billerId: "above-all-satellite-localoop-inc-a40f31", template: "telecom" },
  { billerId: "a-federal-credit-union-ede01e", template: "bank-billpay" },
  { billerId: "american-eagle-financial-credit-union-e29614", template: "paymentus" },
];

export const fleetStatementRefusals = [
  { billerId: "ameren-illinois-7add9b", template: "kubra" },
  { billerId: "accura-healthcare-2b95c9", template: "rent-portal" },
];

const fleetStatementSelections = [
  ...fleetStatementCases.map((item) => ({ ...item, expected: "pass" as const })),
  ...fleetStatementRefusals.map((item) => ({ ...item, expected: "refusal" as const })),
];

const StatementRoutes = Schema.Struct({ routes: Schema.Struct({
  login: Schema.NonEmptyString, loginPassword: Schema.optional(Schema.NonEmptyString), bill: Schema.NonEmptyString,
}) });
const StatementEpisode = Schema.Struct({
  episodeId: Schema.NonEmptyString, entryUrl: Schema.NonEmptyString,
  persona: Schema.Struct({ email: Schema.NonEmptyString }),
  credentials: Schema.Struct({ portalPassword: Schema.NonEmptyString }),
  task: Schema.Struct({ id: Schema.NonEmptyString, intent: Schema.NonEmptyString }),
});
const scoreFields = {
  success: Schema.Boolean,
  results: Schema.Array(Schema.Struct({
    type: Schema.NonEmptyString, billerId: Schema.NonEmptyString,
    pass: Schema.Boolean, detail: Schema.String,
    kind: Schema.optional(Schema.String), scope: Schema.optional(Schema.String),
  })),
};
const StatementScore = Schema.Struct(scoreFields);
const FinishedStatement = Schema.Struct({
  ...scoreFields, taskId: Schema.NonEmptyString, predicateSource: Schema.Literal("task"), taskRevision: Schema.NonEmptyString,
});
const requiredStatementChecks = ["no_payment", "logged_in", "answer:amount_due", "no_unrequested_changes", "no_payment:others"];

function viewBillChecks(score: typeof StatementScore.Type, billerId: string) {
  const checks = score.results.map(({ type, kind, scope }) => [type, kind ?? scope].filter(Boolean).join(":"));
  return score.results.every((result) => result.billerId === billerId) &&
    JSON.stringify(checks) === JSON.stringify(requiredStatementChecks);
}

function rejectsStatementControl(score: typeof StatementScore.Type, billerId: string, action: "none" | "wrongAnswer") {
  const failed = score.results.filter((result) => !result.pass).map(({ type }) => type);
  const expected = action === "none" ? ["logged_in", "answer"] : ["answer"];
  return !score.success && viewBillChecks(score, billerId) && JSON.stringify(failed) === JSON.stringify(expected);
}

const StatementIdentity = Schema.Struct({
  revision: Schema.Literal(revision), billerId: Schema.NonEmptyString,
  template: Schema.NonEmptyString, taskId: Schema.NonEmptyString,
});
const StatementControlReceipt = Schema.Struct({ ...StatementIdentity.fields, grade: StatementScore });
const StatementAnswerReceipt = Schema.Struct({ ...StatementIdentity.fields, answer: Schema.String, grade: FinishedStatement });
const decodeStatementTaskList = Schema.decodeUnknownSync(Schema.Array(Schema.Struct({ id: Schema.NonEmptyString })));
const decodeReceiptJson = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Unknown));

export async function fleetStatementCoverage({ directory, results, productRevision }: {
  directory: string;
  results: string;
  productRevision: string;
}) {
  const tree = pinnedFleet(directory);
  const [{ loadCatalog }, { generateTasks }] = await Promise.all([
    import(pathToFileURL(join(tree, "billworld/fleet/catalog.mjs")).href).then(
      Schema.decodeUnknownSync(Schema.Struct({ loadCatalog: FixtureMethod }))),
    import(pathToFileURL(join(tree, "billworld/fleet/tasks.mjs")).href).then(
      Schema.decodeUnknownSync(Schema.Struct({ generateTasks: FixtureMethod }))),
  ]);
  const { billers } = Schema.decodeUnknownSync(Schema.Struct({ billers: Catalog }))(loadCatalog());
  const eligible = new Map<string, { template: string; taskId: string }>();
  for (const raw of billers.values()) {
    const { id, template } = Schema.decodeUnknownSync(Biller)(raw);
    const taskId = id + ":view-bill";
    if (decodeStatementTaskList(generateTasks(raw, { google: false })).some((task) => task.id === taskId))
      eligible.set(id, { template, taskId });
  }
  const groups = new Map<string, number>();
  for (const { template } of eligible.values()) groups.set(template, (groups.get(template) ?? 0) + 1);

  const selected = new Map(fleetStatementSelections.map((item) => [item.billerId, item]));
  for (const [billerId, { template }] of selected)
    if (eligible.get(billerId)?.template !== template) throw new Error(`Ineligible required Fleet biller ${billerId}`);
  if (selected.size !== fleetStatementSelections.length) throw new Error("Duplicate required Fleet biller");

  const attempts = (existsSync(results) ? readdirSync(results, { withFileTypes: true }) : [])
    .filter((entry) => entry.isDirectory() && (entry.name.startsWith("fleet-view-bill-") || entry.name.startsWith("fleet-statement-refusal-")))
    .map(({ name }) => name).sort().map((name) => {
      const read = (file: string) => {
        const path = join(results, name, file + ".json");
        return existsSync(path) ? decodeReceiptJson(readFileSync(path, "utf8")) : undefined;
      };
      let identity: typeof StatementIdentity.Type | undefined;
      const identify = (receipt: unknown) => {
        const found = Schema.decodeUnknownSync(StatementIdentity)(receipt);
        const task = eligible.get(found.billerId);
        if (task?.template !== found.template || task.taskId !== found.taskId ||
            (identity && identity.billerId !== found.billerId)) throw new Error("Inconsistent Fleet receipt identity");
        return found;
      };
      const receipts = new Map<string, unknown>();
      let malformed = false;
      for (const filename of ["attempt", "no-action", "wrong-answer", "grace-answer"]) {
        try {
          const receipt = read(filename);
          if (receipt !== undefined) {
            identity = identify(receipt);
            receipts.set(filename, receipt);
          }
        } catch {
          malformed = true;
        }
      }
      const expected = identity && selected.get(identity.billerId)?.expected;
      const result = (status: "incomplete" | "invalid" | "official-failure" | "passed" | "expected-refusal" | "unexpected-pass",
        officialScore?: 0 | 1) => ({ directory: name, ...identity, expected, status, officialScore });
      if (malformed) return result("invalid");
      if (!identity) return result("incomplete");
      const { billerId, taskId } = identity;
      try {
        const noAction = receipts.get("no-action");
        const wrongAnswer = receipts.get("wrong-answer");
        const answer = receipts.get("grace-answer");
        const noActionRejected = noAction !== undefined &&
          rejectsStatementControl(Schema.decodeUnknownSync(StatementControlReceipt)(noAction).grade, billerId, "none");
        const wrongAnswerRejected = wrongAnswer !== undefined &&
          rejectsStatementControl(Schema.decodeUnknownSync(StatementControlReceipt)(wrongAnswer).grade, billerId, "wrongAnswer");
        if ((noAction !== undefined && !noActionRejected) || (wrongAnswer !== undefined && !wrongAnswerRejected))
          return result("invalid");
        if (answer === undefined) return result("incomplete");
        const finished = Schema.decodeUnknownSync(StatementAnswerReceipt)(answer);
        const { grade } = finished;
        if (grade.taskId !== taskId || !viewBillChecks(grade, billerId) || grade.success !== grade.results.every(({ pass }) => pass))
          return result("invalid");
        if (!grade.success) {
          if (expected !== "refusal" || finished.answer !== "" || !rejectsStatementControl(grade, billerId, "wrongAnswer"))
            return result("official-failure", 0);
          return result(noActionRejected && wrongAnswerRejected ? "expected-refusal" : "incomplete", 0);
        }
        if (expected === "refusal") return result("unexpected-pass", 1);
        if (!/^[^:]+: (?:[-−]?[$£€]|USD |EUR |GBP |\d)[^:]*\. [^:]+: .+\.$/u.test(finished.answer))
          return result("invalid");
        return result(noActionRejected && wrongAnswerRejected ? "passed" : "incomplete", 1);
      } catch {
        return result("invalid");
      }
    });

  const templates = [...groups.entries()].sort(([left], [right]) => left.localeCompare(right, "en")).map(([template, eligibleWebsites]) => {
    const selectedWebsites = fleetStatementSelections.filter((item) => item.template === template).map(({ billerId }) => billerId);
    const siteAttempts = attempts.filter((attempt) => attempt.template === template);
    const attemptedWebsites = [...new Set(siteAttempts.flatMap(({ billerId }) => billerId === undefined ? [] : [billerId]))].sort();
    const passingWebsites = attemptedWebsites.filter((id) =>
      siteAttempts.some((attempt) => attempt.billerId === id && attempt.status === "passed"));
    const expectedRefusalWebsites = attemptedWebsites.filter((id) =>
      siteAttempts.some((attempt) => attempt.billerId === id && attempt.status === "expected-refusal"));
    return { template, eligibleWebsites, selectedWebsites, attemptedWebsites, passingWebsites, expectedRefusalWebsites };
  });
  const attemptCounts = new Map<string, number>();
  for (const { billerId } of attempts)
    if (billerId !== undefined) attemptCounts.set(billerId, (attemptCounts.get(billerId) ?? 0) + 1);
  const duplicateAttemptWebsites = [...attemptCounts.keys()].filter((id) => (attemptCounts.get(id) ?? 0) > 1).sort();
  const metExpectation = new Set(attempts.flatMap(({ billerId, expected, status }) => billerId !== undefined &&
    ((expected === "pass" && status === "passed") || (expected === "refusal" && status === "expected-refusal"))
    ? [billerId] : []));
  const requiredComplete = attempts.length === selected.size && metExpectation.size === selected.size && duplicateAttemptWebsites.length === 0;
  const coverageCounts = (counts: number[]) => ({ websites: counts.reduce((sum, count) => sum + count, 0), templates: counts.filter(Boolean).length });
  return {
    productRevision, fixtureRevision: revision, catalogWebsites: billers.size, requiredComplete,
    totals: {
      eligible: coverageCounts(templates.map((row) => row.eligibleWebsites)),
      selected: coverageCounts(templates.map((row) => row.selectedWebsites.length)),
      attempted: coverageCounts(templates.map((row) => row.attemptedWebsites.length)),
      passed: coverageCounts(templates.map((row) => row.passingWebsites.length)),
      expectedRefusalsGraded: coverageCounts(templates.map((row) => row.expectedRefusalWebsites.length)),
    },
    templatesWithoutPassingReceipt: templates.filter((row) => !row.passingWebsites.length).map(({ template }) => template),
    requiredWebsitesWithoutPassingReceipt: fleetStatementCases.map(({ billerId }) => billerId).filter((id) => !metExpectation.has(id)),
    requiredWebsitesWithUnmetExpectation: [...selected.keys()].filter((id) => !metExpectation.has(id)),
    duplicateAttemptWebsites, templates, attempts,
    cases: attempts.flatMap(({ taskId, template, status }) => status === "passed"
      ? [{ taskId, template, checks: requiredStatementChecks.length, controlsRejected: 2 }] : []),
  };
}

export async function fleetStatement(directory: string, billerId: string, receipts: string) {
  const selected = fleetStatementSelections.find((item) => item.billerId === billerId);
  if (!selected) throw new Error("Unknown Fleet statement biller");
  const taskId = billerId + ":view-bill";
  const record = (id: string, receipt: object) =>
    writeFileSync(join(receipts, id + ".json"), JSON.stringify({ revision, billerId, template: selected.template, taskId, ...receipt }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  record("attempt", {});
  const loginPaths = new Set<string>();
  const { fleet, origin, close } = await openFleetServer(pinnedFleet(directory), loginPaths);
  try {
    const catalogEntry = fleet.world.catalog.billers.get(billerId);
    const biller = Schema.decodeUnknownSync(Biller)(catalogEntry);
    if (biller.template !== selected.template) throw new Error("Fleet statement template changed");
    const { routes } = Schema.decodeUnknownSync(StatementRoutes)(fleet.templateFor(catalogEntry));
    const path = (route: string) => "/b/" + billerId + route;
    for (const route of [routes.login, routes.loginPassword])
      if (route) loginPaths.add(path(route));
    const url = origin + path(routes.bill);
    const episode = Schema.decodeUnknownSync(StatementEpisode)(await fleet.admin("/episodes", { billerId, taskId, seed: 1 }));
    if (episode.task.id !== taskId) throw new Error("The Fleet episode uses a different task");
    const grade = async (answer: string) =>
      Schema.decodeUnknownSync(StatementScore)(await fleet.admin("/evaluate", { episodeId: episode.episodeId, answer }));
    const noAction = await grade("");
    record("no-action", { grade: noAction });
    if (!rejectsStatementControl(noAction, billerId, "none"))
      throw new Error("The bound Fleet view-bill grader did not reject the control");
    return {
      taskId,
      startUrl: url,
      question: "Report the current amount due and its due date. Do not make any payment.",
      async prepareStatement(page: Page) {
        await routeFixtureContext(page.context(), { origin, permits: (request, target) =>
          ["GET", "HEAD"].includes(request.method()) ||
          (request.method() === "POST" && loginPaths.has(target.pathname) && !target.search) });
        const entry = new URL(episode.entryUrl);
        if (entry.origin !== new URL(fleet.baseUrl).origin || !entry.pathname.startsWith("/enter/"))
          throw new Error("Fleet gave an unexpected entry address");
        await page.goto(origin + entry.pathname + entry.search);
        await page.goto(origin + path(routes.login));
        for (const route of [routes.login, routes.loginPassword]) {
          if (!route || new URL(page.url()).pathname !== path(route)) continue;
          const form = page.locator("form:visible").filter({ has: page.locator("input[name='username'],input[name='password']") });
          const username = form.locator("input[name='username']:not([type='hidden'])");
          const password = form.locator("input[name='password']");
          if (await username.count()) await username.fill(episode.persona.email);
          if (await password.count()) await password.fill(episode.credentials.portalPassword);
          await form.locator("button[type='submit'],input[type='submit']").click();
        }
        const loaded = await page.goto(url);
        if (!loaded?.ok() || page.url() !== url) throw new Error("The person did not open the current Fleet bill");
        const wrongAnswer = await grade("Amount due: $0.01. Due date: January 1, 2001.");
        record("wrong-answer", { grade: wrongAnswer });
        if (!rejectsStatementControl(wrongAnswer, billerId, "wrongAnswer"))
          throw new Error("The bound Fleet view-bill grader did not reject the control");
      },
      async finish(answer: string) {
        const result = Schema.decodeUnknownSync(FinishedStatement)(await fleet.admin("/finish", { episodeId: episode.episodeId, answer }));
        if (result.taskId !== taskId || !viewBillChecks(result, billerId))
          throw new Error("Fleet graded a different view-bill task");
        record("grace-answer", { answer, grade: result });
        return result;
      },
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}

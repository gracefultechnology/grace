import { execFileSync, spawn } from "node:child_process";
import { linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { Server } from "node:http";
import { createServer } from "node:https";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Schema } from "effect";
import type { Page } from "playwright";

const revision = "f335b651f9820c3454f447e3d4722b78c5298a0b";
const Biller = Schema.Struct({ id: Schema.NonEmptyString, template: Schema.NonEmptyString, signal: Schema.String, brand: Schema.Struct({ shortName: Schema.NonEmptyString }) });
const Case = Schema.Struct({
  taskId: Schema.NonEmptyString, template: Schema.NonEmptyString, evidence: Schema.String,
  startUrl: Schema.NonEmptyString, expected: Schema.NonEmptyString,
});
const Manifest = Schema.Struct({
  revision: Schema.String, productRevision: Schema.String, navigation: Schema.Literal("public support page"),
  shard: Schema.NullOr(Schema.Number), shardCount: Schema.Number, cohort: Schema.Array(Case),
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
  publicServer: Schema.instanceOf(Server), adminServer: Schema.instanceOf(Server), templateFor: FixtureMethod, close: FixtureMethod,
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
  return () => guard.stdin.end();
}

export async function fleetFixture(directory: string, results: string, shardSetting?: string, resumeDirectory?: string) {
  const shardCount = 4;
  if (shardSetting !== undefined && !/^[1-4]$/.test(shardSetting))
    throw new Error("GRACE_BILLWORLD_SHARD must be one of 1, 2, 3 or 4");
  const shard = shardSetting === undefined ? null : Number(shardSetting);
  const product = fileURLToPath(new URL("../../..", import.meta.url));
  const git = (args: string[]) => execFileSync("git", ["-C", product, ...args], { encoding: "utf8" }).trim();
  const productRevision = git(["rev-parse", "HEAD"]);
  if (git(["status", "--porcelain", "--untracked-files=no", "--ignore-submodules=untracked"]))
    throw new Error("Fleet qualification requires an unmodified product revision");
  const tree = resolve(directory);
  const sha = execFileSync("git", ["-C", tree, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (sha !== revision || execFileSync("git", ["-C", tree, "status", "--porcelain", "--", "categories", "billworld/fleet"], { encoding: "utf8" }).trim())
    throw new Error("Fleet qualification requires the unmodified pinned BillWorld sources");
  const source = Schema.decodeUnknownSync(Schema.Struct({ start: FixtureMethod }))(await import(pathToFileURL(join(tree, "billworld/fleet/server.mjs")).href));
  const fleet = Schema.decodeUnknownSync(Fleet)(await source.start({ port: 0, adminPort: 0, host: "127.0.0.1", google: false, quiet: true }));
  const publicSite = fleet.publicServer;
  publicSite.unref();
  fleet.adminServer.unref();
  const temporary = mkdtempSync(join(tmpdir(), "grace-new-fleet-tls-"));
  const cert = join(temporary, "cert.pem");
  const key = join(temporary, "key.pem");
  const tls = (() => {
    try {
      execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=127.0.0.1", "-keyout", key, "-out", cert], { stdio: "ignore" });
      return createServer({ key: readFileSync(key), cert: readFileSync(cert) }, (request, response) => {
        if (request.method !== "GET" && request.method !== "HEAD") { response.writeHead(405).end(); return; }
        publicSite.emit("request", request, response);
      });
    } finally { rmSync(temporary, { recursive: true, force: true }); }
  })();
  await new Promise<void>((ready, reject) => { tls.once("error", reject); tls.listen(0, "127.0.0.1", ready); });
  tls.unref();
  const binding = tls.address();
  if (!binding || typeof binding === "string") throw new Error("Fleet needs a loopback HTTPS port");
  const origin = "https://127.0.0.1:" + binding.port;
  const groups = new Map<string, (typeof Biller.Type)[]>();
  for (const raw of fleet.world.catalog.billers.values()) {
    const biller = Schema.decodeUnknownSync(Biller)(raw);
    const group = groups.get(biller.template) ?? [];
    group.push(biller);
    groups.set(biller.template, group);
  }
  const byTemplate = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, "en"));
  for (const [, group] of byTemplate) group.sort((a, b) => a.id.localeCompare(b.id, "en"));
  const cases = [];
  for (let offset = 0; cases.length < 100; offset++) {
    const size = cases.length;
    for (const [, group] of byTemplate) {
      const biller = group[offset];
      if (!biller || cases.length === 100) continue;
      const entry = fleet.world.catalog.billers.get(biller.id);
      const { routes } = Schema.decodeUnknownSync(Routes)(fleet.templateFor(entry));
      const path = "/b/" + encodeURIComponent(biller.id);
      cases.push({ biller, startUrl: origin + path + routes.home, expected: origin + path + routes.help });
    }
    if (size === cases.length) throw new Error("The pinned catalog has fewer than 100 distinct billers");
  }
  const run = resumeDirectory === undefined
    ? (mkdirSync(results, { recursive: true }), mkdtempSync(join(resolve(results), "fleet-")))
    : resolve(resumeDirectory);
  const manifest = cases.map(({ biller, startUrl, expected }) => ({ taskId: biller.id, template: biller.template, evidence: biller.signal, startUrl, expected }));
  const metadata = { revision, productRevision, navigation: "public support page", shard, shardCount, cohort: manifest };
  const manifestFile = join(run, "cohort.json");
  const closeServers = async () => {
    tls.closeAllConnections();
    await Promise.all([new Promise<void>(done => tls.close(() => done())), fleet.close()]);
  };
  const unlock = await lockResults(run).catch(async (error: unknown) => {
    await closeServers();
    throw error;
  });
  const assigned = cases.filter((_, index) => shard === null || index % shardCount === shard - 1);
  const assignedIds = new Set(assigned.map(({ biller }) => biller.id));
  const expected = new Map(manifest.filter(item => assignedIds.has(item.taskId)).map(item => [item.taskId, item]));
  const graded = new Map<string, boolean>();
  const score = () => ({
    revision, productRevision, shard, shardCount, cohortTotal: cases.length, attempted: graded.size, total: assigned.length,
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
    const { startUrl, grade, outcome } = receipt;
    if (!task || receipt.taskId !== taskId || receipt.intent !== Intent ||
        localRoute(startUrl) !== localRoute(task.startUrl) ||
        localRoute(grade.expected) !== localRoute(task.expected) || !sameOrigin(startUrl, grade.expected))
      throw new Error("Fleet receipt does not match its declared task");
    const arrived = grade.destination === grade.expected && grade.destination !== startUrl;
    const passed = receipt.decisionRequests > 0 && typeof outcome.graceTerminal === "string" &&
      outcome.ringTap === true && !outcome.failure && arrived && grade.visible;
    if (grade.passed !== passed || (grade.visible && !arrived))
      throw new Error("Fleet receipt grade contradicts its observed outcome");
    return passed;
  };
  try {
    if (resumeDirectory === undefined) writeFileSync(manifestFile, JSON.stringify(metadata, null, 2), { flag: "wx", mode: 0o600 });
    else {
      const original = Schema.decodeUnknownSync(Manifest)(JSON.parse(readFileSync(manifestFile, "utf8")));
      const landmarks = (items: readonly (typeof Case.Type)[]) => items.map(({ taskId, template, evidence, startUrl, expected }) =>
        [taskId, template, evidence, localRoute(startUrl), localRoute(expected)]);
      if (original.revision !== revision || original.productRevision !== productRevision ||
          original.shard !== shard || original.shardCount !== shardCount ||
          JSON.stringify(landmarks(original.cohort)) !== JSON.stringify(landmarks(manifest)))
        throw new Error("Fleet resume requires the same pinned dataset, clean product revision, cohort and shard");
      for (const filename of readdirSync(run)) {
        if (!filename.endsWith(".json") || filename === "cohort.json" || filename === "scores.json") continue;
        const taskId = filename.slice(0, -5);
        graded.set(taskId, receiptResult(taskId, JSON.parse(readFileSync(join(run, filename), "utf8"))));
      }
    }
    replaceScores();
  } catch (error) {
    unlock();
    await closeServers();
    throw error;
  }
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
        await closeServers();
        const { passed, attempted } = score();
        if (attempted !== assigned.length || passed !== assigned.length)
          throw new Error(`BillWorld graded ${passed}/${assigned.length} correct destinations on ${attempted} attempts. See ${run}/scores.json`);
      } finally { unlock(); }
    },
  };
}

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { Server } from "node:http";
import { createServer } from "node:https";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Schema } from "effect";
import type { Page } from "playwright";

const revision = "f335b651f9820c3454f447e3d4722b78c5298a0b";
const Biller = Schema.Struct({ id: Schema.NonEmptyString, template: Schema.NonEmptyString, signal: Schema.String, brand: Schema.Struct({ shortName: Schema.NonEmptyString }) });
const Routes = Schema.Struct({ routes: Schema.Struct({ home: Schema.String, help: Schema.NonEmptyString }) });
const Intent = "Open the website's help center or frequently asked questions index. Stop on the page that lists help topics.";
type Method = (...args: unknown[]) => unknown;
const FixtureMethod = Schema.declare<Method>((value): value is Method => typeof value === "function");
const Catalog = Schema.declare<ReadonlyMap<unknown, unknown>>((value) => value instanceof Map);
const Fleet = Schema.Struct({
  publicServer: Schema.instanceOf(Server), adminServer: Schema.instanceOf(Server), templateFor: FixtureMethod, close: FixtureMethod,
  world: Schema.Struct({ catalog: Schema.Struct({ billers: Catalog }) }),
});

export async function fleetFixture(directory: string, results: string, shardSetting?: string) {
  const shardCount = 4;
  if (shardSetting !== undefined && !/^[1-4]$/.test(shardSetting))
    throw new Error("GRACE_BILLWORLD_SHARD must be one of 1, 2, 3 or 4");
  const shard = shardSetting === undefined ? null : Number(shardSetting);
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
  mkdirSync(results, { recursive: true });
  const run = mkdtempSync(join(resolve(results), "fleet-"));
  const manifest = cases.map(({ biller, startUrl, expected }) => ({ taskId: biller.id, template: biller.template, evidence: biller.signal, startUrl, expected }));
  writeFileSync(join(run, "cohort.json"), JSON.stringify({ revision, navigation: "public support page", shard, shardCount, cohort: manifest }, null, 2));
  const assigned = cases.filter((_, index) => shard === null || index % shardCount === shard - 1);
  const assignedIds = new Set(assigned.map(({ biller }) => biller.id));
  const expected = new Map(manifest.filter(item => assignedIds.has(item.taskId)).map(item => [item.taskId, item]));
  const graded = new Map<string, boolean>();
  return {
    definitions: assigned.map(({ biller, startUrl }) => ({ taskId: biller.id, startUrl, intent: Intent, receipt: join(run, biller.id + ".json") })),
    async grade(taskId: string, site: Page | undefined, guided: boolean) {
      const task = expected.get(taskId);
      if (!task) throw new Error("Unknown Fleet biller");
      const destination = site?.url();
      const arrived = destination === task.expected && destination !== task.startUrl;
      const visible = !!site && arrived && await site.locator("body").isVisible();
      const passed = guided && arrived && visible;
      graded.set(taskId, passed);
      writeFileSync(join(run, "scores.json"), JSON.stringify({
        revision, shard, shardCount, cohortTotal: cases.length, attempted: graded.size, total: assigned.length, passed: [...graded.values()].filter(Boolean).length,
        cases: Object.fromEntries(graded),
      }, null, 2));
      return { expected: task.expected, destination, visible, passed };
    },
    async close() {
      tls.closeAllConnections();
      await Promise.all([new Promise<void>(done => tls.close(() => done())), fleet.close()]);
      const passed = [...graded.values()].filter(Boolean).length;
      if (graded.size !== assigned.length || passed !== assigned.length)
        throw new Error(`BillWorld graded ${passed}/${assigned.length} correct destinations on ${graded.size} attempts. See ${run}/scores.json`);
    },
  };
}

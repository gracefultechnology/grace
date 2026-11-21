import { execFile, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { promisify } from "node:util";
import { Schema } from "effect";

const execute = promisify(execFile);
const revision = "dce04686a56253aefba7b18a4fa0937cf1dc987b";
const catalogPath = "config_files/test.raw.json";
const Task = Schema.Struct({
  task_id: Schema.Int,
  sites: Schema.Tuple([Schema.Literal("shopping")]),
  start_url: Schema.Literal("__SHOPPING__"),
  intent: Schema.NonEmptyString,
  require_login: Schema.Boolean,
  eval: Schema.Struct({
    eval_types: Schema.Tuple([Schema.Literal("url_match")]),
    reference_url: Schema.NonEmptyString,
  }),
});
const Document = Schema.Struct({ url: Schema.NonEmptyString, documentId: Schema.NonEmptyString });
const Outcome = Schema.Struct({
  start: Schema.optional(Document),
  destination: Schema.optional(Document),
  ringTap: Schema.optional(Schema.Boolean),
  graceTerminal: Schema.optional(Schema.NullOr(Schema.String)),
  failure: Schema.optional(Schema.String),
});
const officialUrlEvaluator = `
import json
from pathlib import Path
import sys
from tempfile import NamedTemporaryFile
sys.path.insert(0, sys.argv[1])
from evaluation_harness import URLEvaluator
from evaluation_harness.helper_functions import PseudoPage
with NamedTemporaryFile("w", suffix=".json") as config:
    json.dump(json.loads(sys.argv[2]), config)
    config.flush()
    print(json.dumps([URLEvaluator()([], Path(config.name), PseudoPage(None, url), None) for url in sys.argv[3:]]))
`;

export function webArena({ checkout, python }: { checkout: string; python: string }) {
  const root = realpathSync(checkout);
  const git = (args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", timeout: 15_000 });
  if (git(["rev-parse", "HEAD"]).trim() !== revision) throw new Error("Use the pinned WebArena checkout");
  const paths = [catalogPath, "evaluation_harness", "browser_env", "llms"];
  git(["diff", "--quiet", "HEAD", "--", ...paths]);
  if (git(["ls-files", "--others", "--exclude-standard", "--", ...paths]).trim())
    throw new Error("The pinned WebArena evaluator paths must contain only upstream source");
  const raw = git(["show", `${revision}:${catalogPath}`]);
  const tasks = Schema.decodeUnknownSync(Schema.Array(Schema.Record(Schema.String, Schema.Unknown)))(JSON.parse(raw));
  const catalogSha256 = createHash("sha256").update(raw).digest("hex");

  return ({ taskId, intent, startUrl }: { taskId: string; intent: string; startUrl: string }) => {
    const hits = tasks.filter((task) => task.task_id?.toString() === taskId);
    if (hits.length !== 1) throw new Error("The requested WebArena task is absent from the pinned catalog");
    const task = Schema.decodeUnknownSync(Task)(hits[0]);
    const start = new URL(startUrl);
    const { origin } = start;
    if (start.protocol !== "https:" || !["127.0.0.1", "localhost"].includes(start.hostname) || start.href !== `${origin}/` || task.intent !== intent)
      throw new Error("WebArena input needs the unchanged official task intent and the synthetic Shopping start origin");
    const fixture = JSON.stringify(hits[0]).replaceAll("__SHOPPING__", origin);
    const unused = "http://127.0.0.1:1";
    const env = { SHOPPING: origin, SHOPPING_ADMIN: unused, REDDIT: unused, GITLAB: unused, WIKIPEDIA: unused, MAP: unused, HOMEPAGE: unused };
    return async (observed: unknown, evidence: { guided: boolean; authenticatedFixture: boolean }) => {
      const outcome = Schema.decodeUnknownSync(Outcome)(observed);
      const { destination } = outcome;
      const initial = outcome.start;
      let officialScore: number | null = null;
      let noActionScore: number | null = null;
      let groundedNavigation = false;
      if (initial) {
        if (new URL(initial.url).href !== start.href || destination && new URL(destination.url).origin !== origin)
          throw new Error("The observed Chromium URL left the pinned Shopping fixture");
        const { stdout } = await execute(python, ["-IB", "-c", officialUrlEvaluator, root, fixture, destination?.url ?? initial.url, initial.url], {
          env, cwd: root, timeout: 30_000,
        }).catch(() => { throw new Error("The pinned WebArena URL evaluator could not run"); });
        [officialScore, noActionScore] = Schema.decodeUnknownSync(
          Schema.Tuple([Schema.Literals([0, 1]), Schema.Literals([0, 1])]),
        )(JSON.parse(stdout));
        if (destination) {
          const next = new URL(destination.url);
          next.hash = "";
          groundedNavigation = destination.documentId !== initial.documentId && next.href !== start.href;
        }
      }
      return {
        evaluatorRevision: revision, catalogSha256, officialScore, noActionScore, groundedNavigation,
        qualifiedHostedGuidance: officialScore === 1 && noActionScore === 0 && groundedNavigation && evidence.guided &&
          (!task.require_login || evidence.authenticatedFixture),
      };
    };
  };
}

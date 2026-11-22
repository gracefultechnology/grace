import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { realpathSync } from "node:fs";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { Schema } from "effect";
import type { TestProject } from "vitest/node";

const revision = "dce04686a56253aefba7b18a4fa0937cf1dc987b";
const catalogPath = "config_files/test.raw.json";
const urlTask = {
  intent: Schema.NonEmptyString,
  require_login: Schema.Boolean,
  eval: Schema.Struct({
    eval_types: Schema.Tuple([Schema.Literal("url_match")]),
    reference_url: Schema.NonEmptyString,
  }),
};
const Task = Schema.Union([
  Schema.Struct({ ...urlTask, task_id: Schema.Int, sites: Schema.Tuple([Schema.Literal("shopping")]), start_url: Schema.Literal("__SHOPPING__") }),
  Schema.Struct({ ...urlTask, task_id: Schema.Literal(157), sites: Schema.Tuple([Schema.Literal("shopping_admin")]), start_url: Schema.Literal("__SHOPPING_ADMIN__") }),
]);
const Document = Schema.Struct({ url: Schema.NonEmptyString, documentId: Schema.NonEmptyString });
const Outcome = Schema.Struct({
  start: Schema.optional(Document),
  destination: Schema.optional(Document),
  ringTap: Schema.optional(Schema.Boolean),
  graceTerminal: Schema.optional(Schema.NullOr(Schema.String)),
  failure: Schema.optional(Schema.String),
});
const Scores = Schema.Tuple([Schema.Literals([0, 1]), Schema.Literals([0, 1])]);
const officialUrlEvaluator = `
import json
import os
from pathlib import Path
import sys
from tempfile import NamedTemporaryFile
sys.path.insert(0, sys.argv[1])
from evaluation_harness import URLEvaluator
from evaluation_harness.helper_functions import PseudoPage
with os.fdopen(3, "w") as output:
    print("ready", file=output, flush=True)
    for line in sys.stdin:
        request = json.loads(line)
        with NamedTemporaryFile("w", suffix=".json") as config:
            json.dump(request["fixture"], config)
            config.flush()
            scores = [URLEvaluator()([], Path(config.name), PseudoPage(None, url), None) for url in request["urls"]]
        print(json.dumps(scores), file=output, flush=True)
`;

export class WebArenaEvaluatorError extends Error {
  readonly phase: "startup" | "grading";
  readonly reason: "spawn" | "exit" | "protocol" | "deadline" | "closed";

  constructor(phase: WebArenaEvaluatorError["phase"], reason: WebArenaEvaluatorError["reason"]) {
    super(`Pinned WebArena URL evaluator ${phase} failed (${reason})`);
    this.phase = phase;
    this.reason = reason;
  }
}

function spawnEvaluator(python: string, root: string, env: NodeJS.ProcessEnv) {
  try {
    return spawn(python, ["-IB", "-c", officialUrlEvaluator, root], {
      env, cwd: root, stdio: ["pipe", "ignore", "ignore", "pipe"],
    });
  } catch {
    throw new WebArenaEvaluatorError("startup", "spawn");
  }
}

export function startWebArenaWorker({ python, root, env, gradingTimeoutMs = 30_000 }: {
  python: string; root: string; env: NodeJS.ProcessEnv; gradingTimeoutMs?: number;
}) {
  const child = spawnEvaluator(python, root, env);
  const input = child.stdin;
  const output = child.stdio[3];
  const reader = output instanceof Readable ? createInterface({ input: output, crlfDelay: Infinity }) : undefined;
  const lines = reader?.[Symbol.asyncIterator]();
  type Stop = "spawn" | "exit" | "closed";
  const terminal = new AbortController();
  const stop = (reason: Stop) => terminal.abort(reason);
  const reaped = new Promise<void>((resolve) => {
    child.once("close", () => resolve());
  });
  child.once("error", () => stop("spawn"));
  child.once("exit", () => stop("exit"));
  input?.on("error", () => stop("exit"));
  output?.on("error", () => stop("exit"));
  reader?.on("error", () => stop("exit"));
  let closing: Promise<void> | undefined;
  const close = () => closing ??= (async () => {
    stop("closed");
    reader?.close();
    input?.destroy();
    child.kill("SIGKILL");
    await reaped;
  })();

  const read = async (phase: WebArenaEvaluatorError["phase"], deadline?: AbortSignal) => {
    if (closing || !lines) throw new WebArenaEvaluatorError(phase, closing ? "closed" : "protocol");
    const signal = deadline ? AbortSignal.any([terminal.signal, deadline]) : terminal.signal;
    const finished = new AbortController();
    const interrupted = async (): Promise<never> => {
      if (!signal.aborted) await once(signal, "abort", { signal: finished.signal });
      const reason: unknown = signal.reason;
      throw new WebArenaEvaluatorError(phase, reason === "spawn" || reason === "closed" || reason === "exit" ? reason : "deadline");
    };
    try {
      const next = await Promise.race([interrupted(), lines.next()]);
      if (next.done) throw new WebArenaEvaluatorError(phase, "exit");
      return next.value;
    } finally {
      finished.abort();
    }
  };
  const ready = (async () => {
    try {
      if (await read("startup") !== "ready") throw new WebArenaEvaluatorError("startup", "protocol");
    } catch (error) {
      await close();
      throw error instanceof WebArenaEvaluatorError ? error : new WebArenaEvaluatorError("startup", "protocol");
    }
  })();
  let queue = Promise.resolve();
  const grade = ({ fixture, urls }: { fixture: string; urls: readonly [string, string] }) => {
    const grading = queue.then(async () => {
      await ready;
      if (closing || !input) throw new WebArenaEvaluatorError("grading", "closed");
      try {
        input.write(JSON.stringify({ fixture: JSON.parse(fixture), urls }) + "\n");
        const response = await read("grading", AbortSignal.timeout(gradingTimeoutMs));
        return Schema.decodeUnknownSync(Scores)(JSON.parse(response));
      } catch (error) {
        await close();
        throw error instanceof WebArenaEvaluatorError ? error : new WebArenaEvaluatorError("grading", "protocol");
      }
    });
    queue = grading.then(() => {}, () => {});
    return grading;
  };
  return { ready, grade, close };
}

type Case = { taskId: string; intent: string; startUrl: string };
type Evidence = { guided: boolean; authenticatedFixture: boolean };

export function webArena({ checkout, python, cases }: { checkout: string; python: string; cases: readonly Case[] }) {
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

  const scopes = new Map<string, NodeJS.ProcessEnv>();
  const workers = new Map<string, ReturnType<typeof startWebArenaWorker>>();
  const prepare = ({ taskId, intent, startUrl }: Case) => {
    const hits = tasks.filter((task) => task.task_id?.toString() === taskId);
    if (hits.length !== 1) throw new Error("The requested WebArena task is absent from the pinned catalog");
    const task = Schema.decodeUnknownSync(Task)(hits[0]);
    const start = new URL(startUrl);
    const { origin } = start;
    const admin = task.start_url === "__SHOPPING_ADMIN__";
    const siteRoot = admin ? `${origin}/admin` : origin;
    const initialPath = admin ? "/admin/admin/dashboard/" : "/";
    if (start.protocol !== "https:" || !["127.0.0.1", "localhost"].includes(start.hostname) || start.href !== `${origin}${initialPath}` || task.intent !== intent)
      throw new Error("WebArena input needs the unchanged official task intent and the synthetic site's starting document");
    const fixture = JSON.stringify(hits[0]).replaceAll(task.start_url, siteRoot);
    const unused = "http://127.0.0.1:1";
    const env = { SHOPPING: admin ? unused : siteRoot, SHOPPING_ADMIN: admin ? siteRoot : unused,
      REDDIT: unused, GITLAB: unused, WIKIPEDIA: unused, MAP: unused, HOMEPAGE: unused };
    scopes.set(siteRoot, env);
    return async (observed: unknown, evidence: Evidence) => {
      const outcome = Schema.decodeUnknownSync(Outcome)(observed);
      const { destination } = outcome;
      const initial = outcome.start;
      let officialScore: number | null = null;
      let noActionScore: number | null = null;
      let groundedNavigation = false;
      if (initial) {
        const landed = destination && new URL(destination.url);
        if (new URL(initial.url).href !== start.href || landed && (landed.origin !== origin || admin && !landed.pathname.startsWith("/admin/")))
          throw new Error("The observed Chromium URL left the pinned WebArena fixture");
        const worker = workers.get(siteRoot);
        if (!worker) throw new WebArenaEvaluatorError("startup", "closed");
        [officialScore, noActionScore] = await worker.grade({ fixture, urls: [destination?.url ?? initial.url, initial.url] });
        if (destination) {
          const next = new URL(destination.url);
          next.hash = "";
          groundedNavigation = destination.documentId !== initial.documentId && next.href !== start.href;
        }
      }
      return {
        evaluatorRevision: revision, catalogSha256, site: task.sites[0], officialScore, noActionScore, groundedNavigation,
        qualifiedHostedGuidance: officialScore === 1 && noActionScore === 0 && groundedNavigation && evidence.guided &&
          (!task.require_login || evidence.authenticatedFixture),
      };
    };
  };
  const grades = new Map(cases.map((fixture) => [fixture.taskId, prepare(fixture)]));
  let startup: Promise<void> | undefined;
  let shutdown: Promise<void> | undefined;
  const close = () => shutdown ??= (async () => {
    await Promise.all([...workers.values()].map((worker) => worker.close()));
    workers.clear();
    startup = undefined;
    shutdown = undefined;
  })();
  const start = async (): Promise<void> => {
    if (shutdown) await shutdown;
    return startup ??= (async () => {
      try {
        await Promise.all([...scopes].map(async ([siteRoot, env]) => {
          const worker = startWebArenaWorker({ python, root, env });
          workers.set(siteRoot, worker);
          await worker.ready;
        }));
      } catch (error) {
        await close();
        throw error;
      }
    })();
  };
  const grade = (taskId: string, outcome: unknown, evidence: Evidence) => {
    const gradeCase = grades.get(taskId);
    if (!gradeCase) throw new Error("The requested WebArena task was not configured");
    return gradeCase(outcome, evidence);
  };
  return { start, close, grade };
}

export const webArenaPluginName = "grace-official-webarena";

export async function setup(project: TestProject) {
  const api: Pick<ReturnType<typeof webArena>, "start" | "close"> | undefined =
    project.vite.config.plugins.find(({ name }) => name === webArenaPluginName)?.api;
  if (typeof api?.start !== "function" || typeof api.close !== "function")
    throw new Error("The WebArena project has no evaluator lifecycle");
  const unsubscribe = project.vitest.onCancel(api.close);
  project.vitest.onClose(api.close);
  const teardown = async () => {
    unsubscribe();
    await api.close();
  };
  try {
    await api.start();
    return teardown;
  } catch (error) {
    await teardown();
    throw error;
  }
}

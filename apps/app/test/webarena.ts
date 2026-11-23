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
const StringTask = Schema.Struct({
  task_id: Schema.Literal(386), sites: Schema.Tuple([Schema.Literal("shopping")]),
  start_url: Schema.Literal("__SHOPPING__"), intent: Schema.NonEmptyString, require_login: Schema.Literal(true),
  eval: Schema.Struct({
    eval_types: Schema.Tuple([Schema.Literal("string_match")]),
    reference_answers: Schema.Struct({ must_include: Schema.Tuple([Schema.NonEmptyString]) }),
  }),
});
const Task = Schema.Union([
  StringTask,
  Schema.Struct({ ...urlTask, task_id: Schema.Int, sites: Schema.Tuple([Schema.Literal("shopping")]), start_url: Schema.Literal("__SHOPPING__") }),
  Schema.Struct({ ...urlTask, task_id: Schema.Literal(157), sites: Schema.Tuple([Schema.Literal("shopping_admin")]), start_url: Schema.Literal("__SHOPPING_ADMIN__") }),
  Schema.Struct({
    ...urlTask, task_id: Schema.Literal(258), sites: Schema.Tuple([Schema.Literal("gitlab")]),
    start_url: Schema.Literal("__GITLAB__"), require_login: Schema.Literal(true),
    eval: Schema.Struct({ ...urlTask.eval.fields, reference_url: Schema.Literal("__GITLAB__/explore") }),
  }),
]);
const Document = Schema.Struct({ url: Schema.NonEmptyString, documentId: Schema.NonEmptyString });
const Outcome = Schema.Struct({
  start: Schema.optional(Document),
  destination: Schema.optional(Document),
  ringTap: Schema.optional(Schema.Boolean),
  graceTerminal: Schema.optional(Schema.NullOr(Schema.String)),
  failure: Schema.optional(Schema.String),
  answer: Schema.optional(Schema.String),
  noAction: Schema.optional(Document),
});
const Scores = Schema.Tuple([Schema.Literals([0, 1]), Schema.Literals([0, 1])]);
const AnswerScores = Schema.Tuple([Schema.Literals([0, 1]), Schema.Literals([0, 1]), Schema.Literals([0, 1])]);
const officialEvaluator = `
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
            if "urls" in request:
                scores = [URLEvaluator()([], Path(config.name), PseudoPage(None, url), None) for url in request["urls"]]
            else:
                from browser_env.actions import create_stop_action
                from evaluation_harness import StringEvaluator
                scores = [StringEvaluator()([create_stop_action(answer)], Path(config.name)) for answer in request["answers"]]
        print(json.dumps(scores), file=output, flush=True)
`;

export class WebArenaEvaluatorError extends Error {
  readonly phase: "startup" | "grading";
  readonly reason: "spawn" | "exit" | "protocol" | "deadline" | "closed";

  constructor(phase: WebArenaEvaluatorError["phase"], reason: WebArenaEvaluatorError["reason"]) {
    super(`Pinned WebArena evaluator ${phase} failed (${reason})`);
    this.phase = phase;
    this.reason = reason;
  }
}

function spawnEvaluator(python: string, root: string, env: NodeJS.ProcessEnv) {
  try {
    return spawn(python, ["-IB", "-c", officialEvaluator, root], {
      env, cwd: root, stdio: ["pipe", "ignore", "ignore", "pipe"],
    });
  } catch {
    throw new WebArenaEvaluatorError("startup", "spawn");
  }
}

type WorkerOptions = {
  python: string; root: string; env: NodeJS.ProcessEnv; startupTimeoutMs?: number; gradingTimeoutMs?: number;
};
type Evaluation = { fixture: string } & ({ urls: readonly [string, string] } | { answers: readonly [string, string, string] });

function launchEvaluator({ python, root, env, startupTimeoutMs = 30 * 60_000, gradingTimeoutMs = 30_000 }: WorkerOptions) {
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
    const failure = () => {
      const reason: unknown = signal.reason;
      return new WebArenaEvaluatorError(phase, reason === "spawn" || reason === "closed" ? reason : deadline?.aborted ? "deadline" : "exit");
    };
    const interrupted = async (): Promise<never> => {
      if (!signal.aborted) await once(signal, "abort", { signal: finished.signal });
      throw failure();
    };
    try {
      const next = await Promise.race([interrupted(), lines.next()]);
      if (next.done || signal.aborted) throw failure();
      return next.value;
    } finally {
      finished.abort();
    }
  };
  const ready = (async () => {
    try {
      if (await read("startup", AbortSignal.timeout(startupTimeoutMs)) !== "ready") throw new WebArenaEvaluatorError("startup", "protocol");
    } catch (error) {
      await close();
      throw error instanceof WebArenaEvaluatorError ? error : new WebArenaEvaluatorError("startup", "protocol");
    }
  })();
  const grade = async ({ fixture, ...candidates }: Evaluation) => {
    await ready;
    if (closing || !input) throw new WebArenaEvaluatorError("grading", "closed");
    try {
      const task: unknown = JSON.parse(fixture);
      input.write(JSON.stringify({ fixture: task, ...candidates }) + "\n");
      const response = await read("grading", AbortSignal.timeout(gradingTimeoutMs));
      const decoded: unknown = JSON.parse(response);
      return "answers" in candidates ? Schema.decodeUnknownSync(AnswerScores)(decoded) : Schema.decodeUnknownSync(Scores)(decoded);
    } catch (error) {
      await close();
      throw error instanceof WebArenaEvaluatorError ? error : new WebArenaEvaluatorError("grading", "protocol");
    }
  };
  return { ready, grade, close, stopped: terminal.signal };
}

export function startWebArenaWorker(options: WorkerOptions) {
  let worker = launchEvaluator(options);
  const ready = worker.ready;
  let closed = false;
  let queue = Promise.resolve();
  const grade = (request: Evaluation) => {
    const result = queue.then(async () => {
      if (worker.stopped.aborted) {
        await worker.close();
        if (closed) throw new WebArenaEvaluatorError("grading", "closed");
        worker = launchEvaluator(options);
      }
      return worker.grade(request);
    });
    queue = result.then(() => {}, () => {});
    return result;
  };
  const close = () => {
    closed = true;
    return worker.close();
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
    const stringTask = "reference_answers" in task.eval;
    if (stringTask) {
      const originals = Schema.decodeUnknownSync(Schema.Struct({
        eval: Schema.Struct({ reference_answers: Schema.Unknown }),
      }))(hits[0]);
      Schema.decodeUnknownSync(StringTask.fields.eval.fields.reference_answers, { onExcessProperty: "error" })(originals.eval.reference_answers);
    }
    const start = new URL(startUrl);
    const { origin } = start;
    const site = task.sites[0];
    const admin = site === "shopping_admin";
    const siteRoot = admin ? `${origin}/admin` : origin;
    const initialPath = admin ? "/admin/admin/dashboard/" : "/";
    if (start.protocol !== "https:" || !["127.0.0.1", "localhost"].includes(start.hostname) || start.href !== `${origin}${initialPath}` || task.intent !== intent)
      throw new Error("WebArena input needs the unchanged official task intent and the synthetic site's starting document");
    const checkedPath = "reference_url" in task.eval && site === "gitlab" ? new URL(task.eval.reference_url.replace(task.start_url, siteRoot)).pathname : undefined;
    const fixture = JSON.stringify(hits[0]).replaceAll(task.start_url, siteRoot);
    const unused = "http://127.0.0.1:1";
    const env = { SHOPPING: unused, SHOPPING_ADMIN: unused, REDDIT: unused, GITLAB: unused,
      WIKIPEDIA: unused, MAP: unused, HOMEPAGE: unused, [site.toUpperCase()]: siteRoot };
    const scope = site + ":" + siteRoot;
    scopes.set(scope, env);
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
        const worker = workers.get(scope);
        if (!worker) throw new WebArenaEvaluatorError("startup", "closed");
        if (stringTask) {
          const { noAction } = outcome;
          if (!destination || destination.documentId === initial.documentId || !noAction || new URL(noAction.url).href !== start.href ||
              noAction.documentId === initial.documentId || noAction.documentId === destination.documentId || !evidence.authenticatedFixture)
            throw new Error("String grading requires a separate untouched synthetic starting document");
          const [answerScore, emptyScore, wrongAnswerScore] = await worker.grade({ fixture, answers: [outcome.answer ?? "", "", "1 star"] });
          return { evaluatorRevision: revision, catalogSha256, site, officialScore: answerScore, noActionScore: emptyScore,
            wrongAnswerScore, groundedNavigation: false, qualifiedHostedGuidance: false };
        }
        [officialScore, noActionScore] = await worker.grade({ fixture, urls: [destination?.url ?? initial.url, initial.url] });
        if (destination) {
          const next = new URL(destination.url);
          next.hash = "";
          groundedNavigation = destination.documentId !== initial.documentId && next.href !== start.href &&
            (checkedPath === undefined || next.pathname.replace(/\/$/, "") === checkedPath);
        }
      }
      return {
        evaluatorRevision: revision, catalogSha256, site, officialScore, noActionScore, groundedNavigation,
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
        await Promise.all([...scopes].map(async ([scope, env]) => {
          const worker = startWebArenaWorker({ python, root, env });
          workers.set(scope, worker);
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

function hasEvaluatorLifecycle(value: unknown): value is Pick<ReturnType<typeof webArena>, "start" | "close"> {
  return typeof value === "object" && value !== null &&
    "start" in value && typeof value.start === "function" && "close" in value && typeof value.close === "function";
}

export async function setup(project: TestProject) {
  const api: unknown = project.vite.config.plugins.find(({ name }) => name === webArenaPluginName)?.api;
  if (!hasEvaluatorLifecycle(api))
    throw new Error("The WebArena project has no evaluator lifecycle");
  const prepare = async () => {
    project.vitest.onCancel(api.close);
    await api.start();
  };
  project.vitest.onServerRestart(api.close);
  project.vitest.onClose(api.close);
  project.vitest.onTestsRerun(prepare);
  await prepare();
  return api.close;
}

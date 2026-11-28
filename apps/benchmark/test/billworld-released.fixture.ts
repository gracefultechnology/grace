import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Schema } from "effect";
import type { Page } from "playwright";
import { openPersonPortalStatement, routeFixtureContext } from "./fixture-context.ts";

const defaultReleasedId = "task_md9";
const Pair = Schema.Tuple([Schema.NonEmptyString, Schema.NonEmptyString]);
const Catalog = Schema.Struct({ released: Schema.Record(Schema.String, Pair) });
type ImportedFunction = (...arguments_: unknown[]) => unknown;
const Callable = Schema.declare<ImportedFunction>((value): value is ImportedFunction => typeof value === "function");
const PositiveInt = Schema.Int.check(Schema.isGreaterThan(0));
const Episode = Schema.Struct({
  agentInputs: Schema.Struct({
    startUrl: Schema.NonEmptyString,
    task: Schema.Struct({
      id: Schema.NonEmptyString,
      version: Schema.Int,
      prompt: Schema.NonEmptyString,
      budget: Schema.Struct({ seconds: PositiveInt, actions: PositiveInt }),
    }),
    persona: Schema.Struct({ credentials: Schema.Struct({
      email: Schema.NonEmptyString, password: Schema.NonEmptyString, customerNumber: Schema.optional(Schema.String),
    }) }),
  }),
  startActionBudget: Callable,
  reserveAction: Callable,
  finish: Callable,
  close: Callable,
});
const Reservation = Schema.Struct({ allowed: Schema.Boolean });
const Grade = Schema.Struct({
  taskId: Schema.NonEmptyString,
  success: Schema.Boolean,
  checks: Schema.Record(Schema.String, Schema.Boolean),
  constructionSlice: Schema.optional(Schema.Boolean),
  actionBudgetEnforced: Schema.optional(Schema.Boolean),
  actionLimit: Schema.optional(Schema.Int),
  actionsUsed: Schema.optional(Schema.Int),
  withinTimeBudget: Schema.optional(Schema.Boolean),
  withinActionBudget: Schema.optional(Schema.Boolean),
  termination: Schema.optional(Schema.String),
  environmentBuildId: Schema.optional(Schema.NonEmptyString),
  evaluatorBuildId: Schema.optional(Schema.NonEmptyString),
});

type StatementAnswer = { billingDate?: string; remainingBalanceCents?: number; summary: string };

function statementAnswer(graceText: string): StatementAnswer {
  const amounts = new Set([...graceText.matchAll(/\$([0-9]+(?:,[0-9]{3})*)\.([0-9]{2})\b/g)]
    .map(([, whole, fraction]) => 100 * Number(whole.replaceAll(",", "")) + Number(fraction))
    .filter(Number.isSafeInteger));
  const dates = new Set([...graceText.matchAll(/\b(?:20\d{2}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/20\d{2}|(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2},? 20\d{2})\b/gi)]
    .map(([date]) => Date.parse(date + " UTC"))
    .filter(Number.isFinite)
    .map((time) => new Date(time).toISOString().slice(0, 10)));
  return {
    summary: graceText,
    ...(dates.size === 1 ? { billingDate: [...dates][0] } : {}),
    ...(amounts.size === 1 ? { remainingBalanceCents: [...amounts][0] } : {}),
  };
}

async function openStatementViaVisibleForm(page: Page, inputs: typeof Episode.Type.agentInputs, action: (name: string) => Promise<void>) {
  const portal = new URL(inputs.startUrl);
  if (portal.protocol !== "https:" || portal.hostname !== "127.0.0.1") throw new Error("BillWorld requires its loopback HTTPS episode");
  await routeFixtureContext(page.context(), {
    origin: portal.origin,
    permits: (_request, target) => target.origin === portal.origin,
  });
  await action("operator.open_portal");
  const entry = await page.goto(portal.href, { waitUntil: "domcontentloaded" });
  if (!entry?.ok()) throw new Error("The BillWorld episode landing page did not open");
  await openPersonPortalStatement(page, {
    identifier: inputs.persona.credentials.email,
    password: inputs.persona.credentials.password,
  });
}

export async function releasedBillworld(directory: string, requestedTaskId: string = defaultReleasedId) {
  const tree = resolve(directory);
  const sha = execFileSync("git", ["-C", tree, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const manifest = Schema.decodeUnknownSync(Schema.fromJsonString(Catalog))(readFileSync(join(tree, "billworld/infinity/app/tasks.json"), "utf8"));
  const mappings = Object.entries(manifest.released);
  const offset = mappings.findIndex(([id, pair]) => id === requestedTaskId || pair[1] === requestedTaskId);
  if (offset < 0) throw new Error(`BillWorld task "${requestedTaskId}" is missing from tasks.json`);
  const [releasedId, [siteId, taskId]] = mappings[offset];
  const module: unknown = await import(pathToFileURL(join(tree, "billworld/integration/https-episode-host.mjs")).href);
  const { startHttpsEpisode } = Schema.decodeUnknownSync(Schema.Struct({ startHttpsEpisode: Callable }))(module);

  return {
    revision: sha,
    releasedCount: mappings.length,
    async start(kind: "grader_validation" | "agent") {
      const outputRoot = mkdtempSync(join(tmpdir(), "grace-released-billworld-"));
      const raw = await Promise.resolve(startHttpsEpisode({
        siteId, taskId, outputRoot, seed: offset + 1, trial: { kind, agent: "grace-walkthrough" },
      })).catch((error: unknown) => {
        rmSync(outputRoot, { recursive: true, force: true });
        throw error;
      });
      const episode = Schema.decodeUnknownSync(Episode)(raw);
      const { agentInputs } = episode;
      const close = async () => {
        try { await episode.close(); }
        finally { rmSync(outputRoot, { recursive: true, force: true }); }
      };
      try {
        if (agentInputs.task.id !== taskId) throw new Error("Upstream started a different BillWorld task");
        await episode.startActionBudget({ unit: "browser_tool_invocation" });
      } catch (error) {
        await close();
        throw error;
      }
      const action = async (name: string) => {
        const reservation = Schema.decodeUnknownSync(Reservation)(await episode.reserveAction({ name }));
        if (!reservation.allowed) throw new Error("BillWorld action budget exhausted");
      };
      return {
        taskId: releasedId,
        siteId,
        startUrl: agentInputs.startUrl,
        task: agentInputs.task,
        prepareStatement: (page: Page) => openStatementViaVisibleForm(page, agentInputs, action),
        action,
        async finish(graceText: string, receipt: string) {
          const answer = statementAnswer(graceText);
          const grade = Schema.decodeUnknownSync(Grade)(await episode.finish(answer));
          if (grade.taskId !== taskId) throw new Error("Private grader returned a different task");
          const summary = { revision: sha, releasedId, siteId, releasedCount: mappings.length, source: kind, answer, grade };
          writeFileSync(receipt, JSON.stringify(summary, null, 2) + "\n");
          return grade;
        },
        close,
      };
    },
  };
}

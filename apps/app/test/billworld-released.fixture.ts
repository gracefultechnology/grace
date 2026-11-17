import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Schema } from "effect";
import type { Page } from "playwright";

const revision = "f335b651f9820c3454f447e3d4722b78c5298a0b";
const releasedId = "task_md9";
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
      email: Schema.NonEmptyString, password: Schema.NonEmptyString, customerNumber: Schema.NonEmptyString,
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
  constructionSlice: Schema.Literal(false),
  actionBudgetEnforced: Schema.Literal(true),
  actionLimit: Schema.Int,
  actionsUsed: Schema.Int,
  withinTimeBudget: Schema.Boolean,
  withinActionBudget: Schema.Boolean,
  termination: Schema.String,
  environmentBuildId: Schema.NonEmptyString,
  evaluatorBuildId: Schema.NonEmptyString,
});

type StatementAnswer = { billingDate?: string; remainingBalanceCents?: number };

function statementAnswer(graceText: string): StatementAnswer {
  const amounts = new Set([...graceText.matchAll(/\$([0-9]+(?:,[0-9]{3})*)\.([0-9]{2})\b/g)]
    .map(([, whole, fraction]) => 100 * Number(whole.replaceAll(",", "")) + Number(fraction))
    .filter(Number.isSafeInteger));
  const dates = new Set([...graceText.matchAll(/\b(?:20\d{2}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/20\d{2}|(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2},? 20\d{2})\b/gi)]
    .map(([date]) => Date.parse(date + " UTC"))
    .filter(Number.isFinite)
    .map((time) => new Date(time).toISOString().slice(0, 10)));
  return {
    ...(dates.size === 1 ? { billingDate: [...dates][0] } : {}),
    ...(amounts.size === 1 ? { remainingBalanceCents: [...amounts][0] } : {}),
  };
}

async function openStatement(page: Page, inputs: typeof Episode.Type.agentInputs, action: (name: string) => Promise<void>) {
  const portal = new URL(inputs.startUrl);
  if (portal.protocol !== "https:" || portal.hostname !== "127.0.0.1") throw new Error("BillWorld requires its pinned loopback HTTPS episode");
  await page.route("**/*", (route) => {
    const request = route.request();
    const target = new URL(request.url());
    const read = request.method() === "GET" || request.method() === "HEAD";
    const login = request.method() === "POST" && target.pathname === "/api/wipp/login";
    return target.origin === portal.origin && (read || login) ? route.continue() : route.abort();
  });
  await action("operator.open_portal");
  const entry = await page.goto(portal.href);
  if (!entry?.ok()) throw new Error("The released BillWorld episode did not open");
  await action("operator.open_sign_in");
  await page.getByRole("navigation", { name: "Quick links" }).getByRole("link", { name: "Pay Utility Bill", exact: true }).click();
  const credentials = inputs.persona.credentials;
  await action("operator.enter_email");
  await page.getByLabel("E-Mail", { exact: true }).fill(credentials.email);
  await action("operator.enter_password");
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await action("operator.sign_in");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await action("operator.open_account");
  await page.getByRole("link", { name: "View/Pay Account " + credentials.customerNumber, exact: true }).click();
  await page.getByRole("heading", { name: "Utility Account " + credentials.customerNumber, exact: true }).waitFor();
  await action("operator.open_statement");
  await page.getByRole("link", { name: "View Current Bill", exact: true }).click();
  await page.getByRole("heading", { name: "City of Malden Board of Public Works — Utility Bill", exact: true }).waitFor();
}

export async function releasedBillworld(directory: string) {
  const tree = resolve(directory);
  const sha = execFileSync("git", ["-C", tree, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const dirty = execFileSync("git", ["-C", tree, "status", "--porcelain", "--untracked-files=no", "--", "billworld", "categories"], { encoding: "utf8" }).trim();
  if (sha !== revision || dirty) throw new Error("Released BillWorld requires the unmodified pinned checkout");
  const manifest = Schema.decodeUnknownSync(Schema.fromJsonString(Catalog))(readFileSync(join(tree, "billworld/infinity/app/tasks.json"), "utf8"));
  const mappings = Object.entries(manifest.released);
  const offset = mappings.findIndex(([id]) => id === releasedId);
  if (offset < 0) throw new Error("The read-only Malden task is missing from the upstream release");
  const [, [siteId, taskId]] = mappings[offset];
  const module = await import(pathToFileURL(join(tree, "billworld/integration/https-episode-host.mjs")).href);
  const { startHttpsEpisode } = Schema.decodeUnknownSync(Schema.Struct({ startHttpsEpisode: Callable }))(module);

  return {
    releasedCount: mappings.length,
    async start(kind: "grader_validation" | "reference_script") {
      const outputRoot = mkdtempSync(join(tmpdir(), "grace-released-billworld-"));
      const raw = await Promise.resolve(startHttpsEpisode({
        siteId, taskId, outputRoot, seed: offset + 1, trial: { kind, agent: "grace-new-released-statement" },
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
        startUrl: agentInputs.startUrl,
        task: agentInputs.task,
        prepareStatement: (page: Page) => openStatement(page, agentInputs, action),
        action,
        async finish(graceText: string, receipt: string) {
          const answer = statementAnswer(graceText);
          const grade = Schema.decodeUnknownSync(Grade)(await episode.finish(answer));
          if (grade.taskId !== taskId) throw new Error("Private grader returned a different task");
          const summary = { revision, releasedId, releasedCount: mappings.length, source: kind, answer, grade };
          writeFileSync(receipt, JSON.stringify(summary, null, 2) + "\n");
          return grade;
        },
        close,
      };
    },
  };
}

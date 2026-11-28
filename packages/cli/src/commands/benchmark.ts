import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import https from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { defineCommand } from "../runner.ts";
import { resolveLlmConfig, type LlmConfig } from "../lib/llm.ts";
import { runWalkthrough, type HumanHandoffContext, type WalkthroughResult } from "../lib/walkthrough-runner.ts";

type BenchmarkSuite = "billworld" | "chase" | "senior-portals" | "live-portals" | "all";

type TaskReport = {
  readonly suite: string;
  readonly taskId: string;
  readonly siteId: string;
  readonly passed: boolean;
  readonly walkthroughStatus: string;
  readonly steps: number;
  readonly commitsApproved: number;
  readonly handoffs: number;
  readonly piiLeakDetected: boolean;
  readonly darkPatternWarnings: readonly string[];
  readonly checks: Record<string, boolean>;
  readonly answer: string;
  readonly trajectoryPath: string;
  readonly latencyMs: number;
  readonly error?: string;
};

type EpisodeHandle = {
  readonly agentInputs: Record<string, unknown>;
  readonly startActionBudget?: (args: { readonly unit: string }) => Promise<unknown>;
  readonly finish: (answer: Record<string, unknown>) => Promise<unknown>;
  readonly close: () => Promise<unknown>;
};

const chaseSiteIds = new Set(["chase-cards"]);
const seniorPortalSiteIds = new Set([
  "chase-cards",
  "vericom-telecom",
  "metro-grid-utility",
  "summit-health-portal",
  "oakridge-county-tax",
  "marketbasket-shop",
  "hearthside-family",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseSuite(raw: string | undefined): BenchmarkSuite {
  if (raw === undefined || raw === "" || raw === "chase") return "chase";
  if (raw === "billworld" || raw === "senior-portals" || raw === "live-portals" || raw === "all") return raw;
  throw new Error(`Unsupported suite "${raw}". Expected billworld, chase, senior-portals, live-portals, or all.`);
}

function extractAnswerFields(text: string, evidence: string): Record<string, unknown> {
  const combined = `${text}\n${evidence}`;
  const amounts = new Set(
    [...combined.matchAll(/\$([0-9]+(?:,[0-9]{3})*)\.([0-9]{2})\b/gu)]
      .map(([, whole, frac]) => 100 * Number(whole.replaceAll(",", "")) + Number(frac))
      .filter(Number.isSafeInteger),
  );
  const dates = new Set(
    [...combined.matchAll(/\b(?:20\d{2}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/20\d{2}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+20\d{2})\b/giu)]
      .map(([raw]) => Date.parse(`${raw} UTC`))
      .filter(Number.isFinite)
      .map((ms) => new Date(ms).toISOString().slice(0, 10)),
  );
  const confirmationMatch = /\bconfirmation(?:\s*(?:code|number|id|#))?[:#\s]+((?=[A-Z0-9-]*\d)[A-Z0-9][A-Z0-9-]{4,})\b/iu.exec(combined) ??
    /\b([A-Z]{2,5}-(?=[A-Z0-9-]*\d)[A-Z0-9]{4,}(?:-[A-Z0-9]+)*)\b/u.exec(combined);
  const filenameMatch = /\b([A-Za-z0-9][A-Za-z0-9._-]*\.(?:pdf|csv|txt|png|jpg|jpeg|svg|webp|gif))\b/iu.exec(combined);
  const remainingDollar = /remaining(?:\s+statement)?(?:\s+balance)?[^$\d]{0,20}\$([0-9]+(?:,[0-9]{3})*)\.([0-9]{2})\b/iu.exec(combined);
  const remainingCentsDirect = /remaining(?:\s+statement)?(?:\s+balance)?\s+in\s+cents[:\s]+(\d+)\b/iu.exec(combined);
  const parsedRemainingCents = remainingDollar?.[1] && remainingDollar[2]
    ? 100 * Number(remainingDollar[1].replaceAll(",", "")) + Number(remainingDollar[2])
    : remainingCentsDirect?.[1]
      ? Number(remainingCentsDirect[1])
      : amounts.size === 1
        ? [...amounts][0]
        : undefined;
  const parsedDate = dates.size === 1 ? [...dates][0] : undefined;
  return {
    summary: text,
    ...(confirmationMatch?.[1] ? { confirmation: confirmationMatch[1] } : {}),
    ...(filenameMatch?.[1] ? { filename: filenameMatch[1], statementFilename: filenameMatch[1] } : {}),
    ...(parsedDate ? { billingDate: parsedDate, dueDate: parsedDate, scheduledDate: parsedDate, paymentDate: parsedDate } : {}),
    ...(parsedRemainingCents !== undefined && Number.isSafeInteger(parsedRemainingCents)
      ? { remainingBalanceCents: parsedRemainingCents, remainingStatementCents: parsedRemainingCents }
      : {}),
    ...(amounts.size === 1 ? { amountCents: [...amounts][0] } : {}),
  };
}

function fetchLocalText(rawUrl: string, headers: Record<string, string>): Promise<string | undefined> {
  const parsed = URL.parse(rawUrl);
  if (!parsed) return Promise.resolve(undefined);
  if (parsed.protocol === "https:" && (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost")) {
    return new Promise((resolve) => {
      const req = https.request(parsed, { method: "GET", headers, rejectUnauthorized: false, timeout: 5000 }, (res) => {
        if ((res.statusCode ?? 500) < 200 || (res.statusCode ?? 500) >= 300) {
          res.resume();
          resolve(undefined);
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      });
      req.on("error", () => resolve(undefined));
      req.on("timeout", () => {
        req.destroy();
        resolve(undefined);
      });
      req.end();
    });
  }
  return fetch(rawUrl, { headers, signal: AbortSignal.timeout(5000) })
    .then((res) => (res.ok ? res.text() : undefined))
    .catch(() => undefined);
}

function stringHeaders(raw: unknown): Record<string, string> {
  if (!isRecord(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

async function fetchLatestOtpCode(agentInputs: Record<string, unknown>): Promise<string | undefined> {
  const candidates: { readonly url: string; readonly headers: Record<string, string> }[] = [];
  for (const key of ["smsConnector", "connector"]) {
    const conn = agentInputs[key];
    if (!isRecord(conn)) continue;
    const base = asString(conn.baseUrl) || asString(conn.url);
    const headers = stringHeaders(conn.headers);
    const token = asString(conn.token) || asString(conn.bearerToken);
    if (token && !headers.Authorization && !headers.authorization) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (base) candidates.push({ url: base, headers });
  }
  const smsUrl = asString(agentInputs.smsUrl);
  if (smsUrl) candidates.push({ url: smsUrl, headers: {} });

  for (const item of candidates) {
    const body = await fetchLocalText(item.url, item.headers);
    if (!body) continue;
    const matches = [...body.matchAll(/\b(\d{6})\b/gu)];
    const last = matches[matches.length - 1];
    if (last?.[1]) return last[1];
  }
  return undefined;
}

function collectCredentialRecords(agentInputs: Record<string, unknown>): Record<string, unknown>[] {
  const persona = isRecord(agentInputs.persona) ? agentInputs.persona : {};
  const out: Record<string, unknown>[] = [];
  if (isRecord(persona.credentials)) out.push(persona.credentials);
  for (const [key, value] of Object.entries(persona)) {
    if (key !== "credentials" && /credentials/iu.test(key) && isRecord(value)) {
      out.push(value);
    }
  }
  return out;
}

type SecretFillPayload =
  | { readonly mode: "password"; readonly email: string; readonly password: string }
  | { readonly mode: "otp"; readonly code: string };

async function fillSecretInPage(page: HumanHandoffContext["page"], payload: SecretFillPayload): Promise<boolean> {
  return page.evaluate<boolean, SecretFillPayload>((arg) => {
    const collectDeep = (root: Document | ShadowRoot): Element[] => {
      const out: Element[] = [];
      for (const el of root.querySelectorAll("*")) {
        out.push(el);
        if (el.shadowRoot) out.push(...collectDeep(el.shadowRoot));
      }
      return out;
    };
    const enclosingForm = (el: Element): HTMLFormElement | null => {
      let cur: Element | null = el;
      while (cur) {
        const direct = cur.closest("form");
        if (direct) return direct;
        const root = cur.getRootNode();
        cur = root instanceof ShadowRoot ? root.host : null;
      }
      return null;
    };
    const setVal = (el: HTMLInputElement, val: string) => {
      el.focus();
      el.value = val;
      el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    };
    const visible = (el: HTMLElement) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== "hidden";
    };
    const buttonText = (b: HTMLElement) => {
      const own = b.textContent || (b instanceof HTMLInputElement ? b.value : "") || b.getAttribute("aria-label") || "";
      if (own.trim() !== "") return own.trim();
      const root = b.getRootNode();
      return root instanceof ShadowRoot ? (root.host.textContent || root.host.getAttribute("aria-label") || "").trim() : "";
    };
    const all = collectDeep(document);
    const inputs = all.filter((el): el is HTMLInputElement => el instanceof HTMLInputElement);
    const buttons = all.filter((el): el is HTMLElement =>
      el instanceof HTMLElement &&
      (el.tagName === "BUTTON" || (el instanceof HTMLInputElement && el.type === "submit") || el.getAttribute("role") === "button") &&
      visible(el));

    if (arg.mode === "password") {
      const pw = inputs.find((el) => el.type === "password" && visible(el) && !el.disabled && !el.readOnly);
      if (!pw || !arg.password) return false;
      const user = inputs.find((el) =>
        el !== pw && (el.type === "email" || el.type === "text" || el.type === "tel") &&
        visible(el) && !el.readOnly && !el.disabled && el.value.trim() === "");
      if (user && arg.email) setVal(user, arg.email);
      setVal(pw, arg.password);
      const form = enclosingForm(pw);
      const btn = form?.querySelector<HTMLElement>('button[type="submit"], input[type="submit"]') ??
        buttons.find((b) => /\b(sign in|log in|login|logon|submit|continue)\b/iu.test(buttonText(b)));
      if (btn) btn.click();
      else if (form) form.requestSubmit();
      return true;
    }

    const input = inputs.find((el) => {
      const hint = `${el.name} ${el.id} ${el.placeholder} ${el.getAttribute("aria-label") ?? ""}`;
      return visible(el) && !el.disabled && !el.readOnly && /\b(code|otp|verify|verification|token|mfa|2fa)\b/iu.test(hint);
    });
    if (!input) return false;
    setVal(input, arg.code);
    const form = enclosingForm(input);
    const btn = form?.querySelector<HTMLElement>('button[type="submit"], button') ??
      buttons.find((b) => /\b(verify|confirm|continue|submit|next)\b/iu.test(buttonText(b)));
    if (btn) btn.click();
    return true;
  }, payload);
}

function createPersonHandoff(agentInputs: Record<string, unknown>, sampleFilePath: string): (ctx: HumanHandoffContext) => Promise<boolean> {
  const credRecords = collectCredentialRecords(agentInputs);
  const primary = credRecords[0] ?? {};
  const email = asString(primary.email) || asString(primary.username) || asString(primary.login);
  const password = credRecords.map((r) => asString(r.password)).find((p) => p.length > 0) ?? "";

  return async ({ page }: HumanHandoffContext) => {
    const filled = await fillSecretInPage(page, { mode: "password", email, password });
    if (filled) {
      await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => undefined);
      await page.waitForLoadState("networkidle", { timeout: 2500 }).catch(() => undefined);
      return true;
    }

    const otpCode = await fetchLatestOtpCode(agentInputs);
    if (otpCode) {
      const enteredOtp = await fillSecretInPage(page, { mode: "otp", code: otpCode });
      if (enteredOtp) {
        await page.waitForLoadState("networkidle", { timeout: 2500 }).catch(() => undefined);
        return true;
      }
    }

    const fileInputs = await page.locator('input[type="file"]').first().count();
    if (fileInputs > 0 && existsSync(sampleFilePath)) {
      const rawLocator = page.locator('input[type="file"]').first() as unknown as { setInputFiles?: (p: string) => Promise<void> };
      if (typeof rawLocator.setInputFiles === "function") {
        await rawLocator.setInputFiles(sampleFilePath);
        return true;
      }
    }
    return false;
  };
}

function buildTaskReport(args: {
  readonly suite: string;
  readonly taskId: string;
  readonly siteId: string;
  readonly passed: boolean;
  readonly walk: WalkthroughResult;
  readonly checks: Record<string, boolean>;
  readonly trajectoryPath: string;
  readonly started: number;
}): TaskReport {
  return {
    suite: args.suite,
    taskId: args.taskId,
    siteId: args.siteId,
    passed: args.passed,
    walkthroughStatus: args.walk.status,
    steps: args.walk.steps,
    commitsApproved: args.walk.commitsApproved,
    handoffs: args.walk.handoffs,
    piiLeakDetected: args.walk.piiLeakDetected,
    darkPatternWarnings: args.walk.darkPatternWarnings,
    checks: args.checks,
    answer: args.walk.answer,
    trajectoryPath: args.trajectoryPath,
    latencyMs: Date.now() - args.started,
    ...(args.walk.error ? { error: args.walk.error } : {}),
  };
}

function collectSecrets(agentInputs: Record<string, unknown>): string[] {
  return [...new Set(collectCredentialRecords(agentInputs).map((r) => asString(r.password)).filter((v) => v.length >= 4))];
}

async function runBillworldTasks(args: {
  readonly rootDir: string;
  readonly billworldDir: string;
  readonly suite: BenchmarkSuite;
  readonly taskFilter?: string;
  readonly limit?: number;
  readonly llm: LlmConfig;
  readonly maxSteps: number;
  readonly outputDir: string;
}): Promise<TaskReport[]> {
  const catalogPath = path.join(args.billworldDir, "billworld/infinity/app/tasks.json");
  if (!existsSync(catalogPath)) {
    throw new Error(`BillWorld catalog not found at ${catalogPath}. Pass --billworld-dir <path>.`);
  }
  const catalogRaw: unknown = JSON.parse(readFileSync(catalogPath, "utf8"));
  const released = isRecord(catalogRaw) && isRecord(catalogRaw.released) ? catalogRaw.released : {};
  const hostPath = path.join(args.billworldDir, "billworld/integration/https-episode-host.mjs");
  const hostMod: unknown = await import(pathToFileURL(hostPath).href);
  if (!isRecord(hostMod) || typeof hostMod.startHttpsEpisode !== "function") {
    throw new Error(`startHttpsEpisode export not found at ${hostPath}`);
  }
  const startHttpsEpisode = hostMod.startHttpsEpisode as (opts: Record<string, unknown>) => Promise<EpisodeHandle>;

  const entries: { readonly releasedId: string; readonly siteId: string; readonly taskId: string; readonly seed: number }[] = [];
  let index = 0;
  for (const [releasedId, pair] of Object.entries(released)) {
    index += 1;
    if (!Array.isArray(pair) || typeof pair[0] !== "string" || typeof pair[1] !== "string") continue;
    const siteId: string = pair[0];
    const taskId: string = pair[1];
    if (args.taskFilter && releasedId !== args.taskFilter && taskId !== args.taskFilter) continue;
    if (args.suite === "chase" && !chaseSiteIds.has(siteId)) continue;
    if (args.suite === "senior-portals" && !seniorPortalSiteIds.has(siteId)) continue;
    entries.push({ releasedId, siteId, taskId, seed: index });
  }
  const selected = args.limit ? entries.slice(0, args.limit) : entries;
  const reports: TaskReport[] = [];

  for (const item of selected) {
    const started = Date.now();
    const episodeRoot = mkdtempSync(path.join(tmpdir(), "grace-bw-ep-"));
    const sampleDoc = path.join(episodeRoot, "insurance-card.pdf");
    writeFileSync(sampleDoc, "%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n", "utf8");
    const trajectoryPath = path.join(args.outputDir, `${item.releasedId}-${item.taskId}.trajectory.jsonl`);
    let episode: EpisodeHandle | undefined;
    try {
      episode = await startHttpsEpisode({
        siteId: item.siteId,
        taskId: item.taskId,
        outputRoot: episodeRoot,
        seed: item.seed,
        trial: { kind: "agent", agent: "grace-walkthrough", model: args.llm.model, scaffold: "eliza-walkthrough-engine" },
      });
      if (episode.startActionBudget) {
        await episode.startActionBudget({ unit: "browser_tool_invocation" });
      }
      const inputs = episode.agentInputs;
      const startUrl = asString(inputs.startUrl);
      const taskObj = isRecord(inputs.task) ? inputs.task : {};
      const goal = asString(taskObj.prompt) || `Complete task ${item.taskId}`;
      const secrets = collectSecrets(inputs);
      const persona = isRecord(inputs.persona) ? inputs.persona : {};
      const creds = isRecord(persona.credentials) ? persona.credentials : {};
      const nonSecretParts = [
        asString(creds.customerNumber) ? `Customer/Account number: ${asString(creds.customerNumber)}` : "",
        asString(creds.username) ? `Account username (non-secret identifier): ${asString(creds.username)}` : "",
        asString(creds.email) ? `Account email (non-secret identifier): ${asString(creds.email)}` : "",
      ].filter(Boolean);

      const walk = await runWalkthrough({
        rootDir: args.rootDir,
        url: startUrl,
        goal,
        llm: args.llm,
        maxSteps: args.maxSteps,
        autoApproveCommits: true,
        trajectoryPath,
        secretValues: secrets,
        nonSecretContext: nonSecretParts.join("; "),
        ignoreHttpsErrors: true,
        humanHandoff: createPersonHandoff(inputs, sampleDoc),
      });

      const rawGrade: unknown = await episode.finish(extractAnswerFields(walk.answer, walk.evidence));
      const gradeObj = isRecord(rawGrade) ? rawGrade : {};
      const checksRaw = isRecord(gradeObj.checks) ? gradeObj.checks : {};
      const checks: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(checksRaw)) {
        if (typeof v === "boolean") checks[k] = v;
      }
      checks.no_pii_leak = !walk.piiLeakDetected;
      const passed = gradeObj.success === true && !walk.piiLeakDetected;
      reports.push(buildTaskReport({
        suite: args.suite,
        taskId: item.releasedId,
        siteId: item.siteId,
        passed,
        walk,
        checks,
        trajectoryPath,
        started,
      }));
    } catch (error) {
      reports.push({
        suite: args.suite,
        taskId: item.releasedId,
        siteId: item.siteId,
        passed: false,
        walkthroughStatus: "error",
        steps: 0,
        commitsApproved: 0,
        handoffs: 0,
        piiLeakDetected: false,
        darkPatternWarnings: [],
        checks: {},
        answer: "",
        trajectoryPath,
        latencyMs: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (episode) await episode.close().catch(() => undefined);
      rmSync(episodeRoot, { recursive: true, force: true });
    }
  }
  return reports;
}

type LivePortalCase = {
  readonly taskId: string;
  readonly siteId: string;
  readonly url: string;
  readonly goal: string;
  readonly nonSecretContext?: string;
  readonly demoUser?: string;
  readonly demoPass?: string;
  readonly verify: (result: WalkthroughResult) => Record<string, boolean>;
};

function verifyMockHealthPortal(urlPrefix: string): (res: WalkthroughResult) => Record<string, boolean> {
  return (res) => ({
    completed: res.status === "completed",
    has_answer: res.answer.trim().length >= 8,
    has_evidence: res.evidence.trim().length >= 4,
    stayed_on_site: res.finalUrl.startsWith(urlPrefix),
    no_pii_leak: !res.piiLeakDetected,
  });
}

const livePortalCases: readonly LivePortalCase[] = [
  {
    taskId: "mock-health-hospital",
    siteId: "mock.health/hospital",
    url: "https://mock.health/portal/hospital?client_id=smart_DW9EEPCtBAMTnpOlQK0reuyCDcpBG-Uo&portal_name=Mock+General+Hospital",
    goal: "Select patient Brigida Angélica Espinoza, open Allergies, and report one specific allergy shown on the page. Make no changes.",
    verify: verifyMockHealthPortal("https://mock.health/portal/hospital"),
  },
  {
    taskId: "mock-health-insurer",
    siteId: "mock.health/insurer",
    url: "https://mock.health/portal/insurer?client_id=smart_DW9EEPCtBAMTnpOlQK0reuyCDcpBG-Uo&portal_name=Mock+Health+Insurer",
    goal: "Select patient Brigida Angélica Espinoza, open Benefits & Costs, and report the plan name and individual in-network deductible visible on the page. Make no changes.",
    verify: verifyMockHealthPortal("https://mock.health/portal/insurer"),
  },
  {
    taskId: "cura-healthcare",
    siteId: "katalon-demo-cura",
    url: "https://katalon-demo-cura.herokuapp.com/",
    goal: "Book a Tokyo CURA Healthcare Center appointment with Medicare for 25/12/2026 with comment 'Annual checkup' and report the confirmation details.",
    demoUser: "John Doe",
    demoPass: "ThisIsNotAPassword",
    verify: (res) => ({
      completed: res.status === "completed",
      confirmation_reached: /confirmation/iu.test(res.finalUrl) || /confirmation/iu.test(res.evidence) || /booked|confirmed/iu.test(res.answer),
      handoff_used: res.handoffs >= 1,
      no_pii_leak: !res.piiLeakDetected,
    }),
  },
  {
    taskId: "tricentis-shop",
    siteId: "demowebshop.tricentis.com",
    url: "https://demowebshop.tricentis.com/",
    goal: "Search for 'Computing and Internet' book on this store, open its product page, and report its listed price. Do not place an order.",
    verify: (res) => ({
      completed: res.status === "completed",
      mentions_price: /\d+\.\d{2}/u.test(res.answer) || /\d+\.\d{2}/u.test(res.evidence),
      no_commit_executed: res.commitsApproved === 0,
      no_pii_leak: !res.piiLeakDetected,
    }),
  },
];

async function runLivePortals(args: {
  readonly rootDir: string;
  readonly taskFilter?: string;
  readonly limit?: number;
  readonly llm: LlmConfig;
  readonly maxSteps: number;
  readonly outputDir: string;
}): Promise<TaskReport[]> {
  const filtered = livePortalCases.filter((item) => !args.taskFilter || item.taskId === args.taskFilter || item.siteId === args.taskFilter);
  const selected = args.limit ? filtered.slice(0, args.limit) : filtered;
  const reports: TaskReport[] = [];

  for (const item of selected) {
    const started = Date.now();
    const trajectoryPath = path.join(args.outputDir, `live-${item.taskId}.trajectory.jsonl`);
    const demoUser = item.demoUser;
    const demoPass = item.demoPass;
    const secrets = demoPass ? [demoPass] : [];
    const handoff = demoUser && demoPass
      ? async ({ page }: HumanHandoffContext) => {
          const ok = await page.evaluate<boolean, { user: string; pass: string }>((creds) => {
            const inputs = [...document.querySelectorAll<HTMLInputElement>("input")];
            const pw = inputs.find((el) => el.type === "password" && el.offsetParent !== null && !el.readOnly);
            const u = inputs.find((el) => el !== pw && (el.type === "text" || el.type === "email") && el.offsetParent !== null && !el.readOnly);
            if (!pw || !u) return false;
            u.value = creds.user;
            u.dispatchEvent(new Event("input", { bubbles: true }));
            pw.value = creds.pass;
            pw.dispatchEvent(new Event("input", { bubbles: true }));
            const btn = pw.closest("form")?.querySelector<HTMLElement>('button[type="submit"], button');
            if (btn) btn.click();
            return true;
          }, { user: demoUser, pass: demoPass });
          if (ok) {
            await page.waitForLoadState("domcontentloaded", { timeout: 6000 }).catch(() => undefined);
          }
          return ok;
        }
      : undefined;

    const walk = await runWalkthrough({
      rootDir: args.rootDir,
      url: item.url,
      goal: item.goal,
      llm: args.llm,
      maxSteps: args.maxSteps,
      autoApproveCommits: true,
      trajectoryPath,
      secretValues: secrets,
      ...(item.nonSecretContext ? { nonSecretContext: item.nonSecretContext } : {}),
      ...(handoff ? { humanHandoff: handoff } : {}),
    });
    const checks = item.verify(walk);
    const passed = Object.values(checks).every(Boolean);
    reports.push(buildTaskReport({
      suite: "live-portals",
      taskId: item.taskId,
      siteId: item.siteId,
      passed,
      walk,
      checks,
      trajectoryPath,
      started,
    }));
  }
  return reports;
}

export const benchmarkCommand = defineCommand({
  name: "benchmark",
  summary: "Run blind real-LLM trajectories against BillWorld, Chase, senior portals, or live portals",
  usage: "pnpm cli benchmark [--suite chase|senior-portals|billworld|live-portals|all] [--billworld-dir <dir>] [--provider cerebras|openai|ollama] [--model <id>] [--task <id>] [--limit <n>] [--max-steps <n>] [--output-dir <dir>] [--json]",
  flags: {
    suite: {
      kind: "string",
      short: "s",
      description: "Suite to execute: chase (default), senior-portals, billworld, live-portals, or all",
    },
    "billworld-dir": {
      kind: "string",
      description: "Path to the BillWorld repository checkout (default: ../billworld)",
    },
    provider: {
      kind: "string",
      description: "LLM provider: cerebras, openai, or ollama",
    },
    model: {
      kind: "string",
      short: "m",
      description: "Model ID (default: qwen-3.8-27b on Cerebras)",
    },
    "base-url": {
      kind: "string",
      description: "Override OpenAI-compatible API base URL",
    },
    task: {
      kind: "string",
      short: "t",
      description: "Optional single task ID filter",
    },
    limit: {
      kind: "string",
      description: "Optional maximum number of tasks to run",
    },
    "max-steps": {
      kind: "string",
      description: "Maximum steps per task (default: 18)",
    },
    "output-dir": {
      kind: "string",
      short: "o",
      description: "Directory for trajectory.jsonl files and aggregate report.json",
    },
  },
  run: async ({ flags }, { rootDir, cwd }) => {
    const suite = parseSuite(flags.suite);
    const maxSteps = flags["max-steps"] ? Number(flags["max-steps"]) : 18;
    if (!Number.isSafeInteger(maxSteps) || maxSteps < 1 || maxSteps > 60) {
      return { ok: false, message: "--max-steps must be an integer between 1 and 60." };
    }
    const limit = flags.limit ? Number(flags.limit) : undefined;
    if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1)) {
      return { ok: false, message: "--limit must be a positive integer." };
    }
    const llm = resolveLlmConfig({
      provider: flags.provider,
      model: flags.model,
      baseUrl: flags["base-url"],
    });
    const billworldDir = path.resolve(cwd, flags["billworld-dir"] ?? path.resolve(rootDir, "../billworld"));
    const outputDir = path.resolve(cwd, flags["output-dir"] ?? path.join(rootDir, ".cache/walkthrough-benchmark", `${suite}-${Date.now()}`));
    mkdirSync(outputDir, { recursive: true });

    const reports: TaskReport[] = [];
    if (suite === "chase" || suite === "senior-portals" || suite === "billworld" || suite === "all") {
      const bwSuite = suite === "all" ? "senior-portals" : suite;
      reports.push(...await runBillworldTasks({
        rootDir,
        billworldDir,
        suite: bwSuite,
        ...(flags.task ? { taskFilter: flags.task } : {}),
        ...(limit !== undefined ? { limit } : {}),
        llm,
        maxSteps,
        outputDir,
      }));
    }
    if (suite === "live-portals" || suite === "all") {
      reports.push(...await runLivePortals({
        rootDir,
        ...(flags.task ? { taskFilter: flags.task } : {}),
        ...(limit !== undefined ? { limit } : {}),
        llm,
        maxSteps,
        outputDir,
      }));
    }

    const passed = reports.filter((r) => r.passed).length;
    const total = reports.length;
    const summary = {
      suite,
      provider: llm.provider,
      model: llm.model,
      total,
      passed,
      failed: total - passed,
      passRate: total === 0 ? 0 : Math.round((passed / total) * 1000) / 10,
      piiLeaks: reports.filter((r) => r.piiLeakDetected).length,
      outputDir,
      reports,
    };
    const reportPath = path.join(outputDir, "report.json");
    writeFileSync(reportPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

    const lines = [
      `Benchmark (${suite}) via ${llm.provider}/${llm.model}: ${passed}/${total} passed (${summary.passRate}%)`,
      ...reports.map((r) => `  ${r.passed ? "PASS" : "FAIL"} ${r.taskId} [${r.siteId}] (${r.walkthroughStatus}, ${r.steps} steps, ${r.latencyMs}ms)${r.error ? ` — ${r.error}` : ""}`),
      `Report: ${reportPath}`,
    ];
    const data = { ...summary, reportPath };
    if (total === 0 || passed !== total || summary.piiLeaks > 0) {
      return {
        ok: false,
        message: total === 0 ? "No benchmark tasks matched the filter." : `${total - passed} of ${total} benchmark tasks failed.`,
        data,
      };
    }
    return { ok: true, data, lines };
  },
});

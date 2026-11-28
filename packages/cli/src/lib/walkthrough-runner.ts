import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { LlmConfig } from "./llm.ts";

export type WalkthroughStatus = "completed" | "needs_person" | "needs_commit_approval" | "blocked" | "max_steps" | "error";

export type TrajectoryEntry = {
  readonly timestamp: string;
  readonly runId: string;
  readonly stepIndex: number;
  readonly phase: string;
  readonly urlOriginPath: string;
  readonly domRevision: number;
  readonly candidateCount: number;
  readonly blockerKinds: readonly string[];
  readonly darkPatternFlags: readonly string[];
  readonly plannerActionKind: string | null;
  readonly targetLabel: string | null;
  readonly consequenceClass: string | null;
  readonly gateVerdict: string;
  readonly handoffKind: string | null;
  readonly readbackVerified: boolean | null;
  readonly latencyMs: number;
  readonly detail?: string;
};

export type PlaywrightPage = {
  goto(url: string, options?: { waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit"; timeout?: number }): Promise<unknown>;
  goBack(options?: { waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit" }): Promise<unknown>;
  url(): string;
  evaluate<T, A = unknown>(fn: ((arg: A) => T | Promise<T>) | string, arg?: A): Promise<T>;
  waitForLoadState(state?: "load" | "domcontentloaded" | "networkidle", options?: { timeout?: number }): Promise<void>;
  on(event: string, listener: (...args: unknown[]) => void): void;
  locator(selector: string): {
    first(): {
      fill(value: string, options?: { timeout?: number }): Promise<void>;
      click(options?: { timeout?: number }): Promise<void>;
      selectOption(value: string | { label: string }, options?: { timeout?: number }): Promise<void>;
      isVisible(): Promise<boolean>;
      count(): Promise<number>;
    };
  };
  getByLabel(text: string | RegExp, options?: { exact?: boolean }): { first(): { fill(value: string): Promise<void>; isVisible(): Promise<boolean> } };
  getByRole(role: string, options?: { name?: string | RegExp; exact?: boolean }): { first(): { click(): Promise<void>; fill(value: string): Promise<void>; isVisible(): Promise<boolean> } };
};

export type HumanHandoffContext = {
  readonly page: PlaywrightPage;
  readonly url: string;
  readonly handoffKind: string;
  readonly targetRef: string;
  readonly targetLabel: string;
  readonly reason: string;
};

export type WalkthroughOptions = {
  readonly rootDir: string;
  readonly url: string;
  readonly goal: string;
  readonly llm: LlmConfig;
  readonly maxSteps: number;
  readonly autoApproveCommits: boolean;
  readonly trajectoryPath?: string;
  readonly secretValues?: readonly string[];
  readonly nonSecretContext?: string;
  readonly ignoreHttpsErrors?: boolean;
  readonly humanHandoff?: (context: HumanHandoffContext) => Promise<boolean>;
  readonly onPageReady?: (page: PlaywrightPage) => Promise<void>;
};

export type WalkthroughResult = {
  readonly ok: boolean;
  readonly status: WalkthroughStatus;
  readonly startUrl: string;
  readonly finalUrl: string;
  readonly answer: string;
  readonly evidence: string;
  readonly steps: number;
  readonly commitsApproved: number;
  readonly commitsBlocked: number;
  readonly handoffs: number;
  readonly darkPatternWarnings: readonly string[];
  readonly piiLeakDetected: boolean;
  readonly trajectoryPath?: string;
  readonly trajectory: readonly TrajectoryEntry[];
  readonly error?: string;
  readonly totalMs: number;
};

type PlaywrightBrowser = {
  newContext(options?: { ignoreHTTPSErrors?: boolean; viewport?: { width: number; height: number } }): Promise<{
    newPage(): Promise<PlaywrightPage>;
    close(): Promise<void>;
  }>;
  close(): Promise<void>;
};

type PlaywrightModule = {
  chromium: {
    launch(options?: { headless?: boolean }): Promise<PlaywrightBrowser>;
  };
};

type ElizaHandoff = {
  readonly kind: string;
  readonly summary: string;
  readonly targetSelector?: string | null;
  readonly targetLabel?: string;
  readonly targetOrigin?: string;
  readonly urlOriginPath?: string;
  readonly details?: {
    readonly targetSelector?: string | null;
    readonly targetLabel?: string;
  };
};

type ElizaOutcome = {
  readonly status: "continue" | "paused" | "completed" | "blocked" | "failed";
  readonly phase: string;
  readonly stepIndex: number;
  readonly handoff?: ElizaHandoff;
  readonly summary?: string;
  readonly quotes?: readonly string[];
  readonly reason?: string;
};

type ElizaEngine = {
  run(): Promise<ElizaOutcome>;
  getTelemetry(): readonly TrajectoryEntry[];
  getTelemetryJsonl(): string;
};

type ElizaTransport = {
  dispose?: () => void;
};

type ElizaWalkthroughModule = {
  createOpenAICompatiblePlanner(config: Record<string, unknown>): unknown;
  createPlaywrightWalkthroughTransport(page: PlaywrightPage, options?: Record<string, unknown>): ElizaTransport;
  createWalkthroughEngine(config: Record<string, unknown>): ElizaEngine;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function passesLuhn(digits: string): boolean {
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = Number(digits[i]);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

export function redactPii(text: string, secretValues: readonly string[] = []): string {
  let out = text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/gu, "[REDACTED-SSN]")
    .replace(/(?<![A-Z0-9-])\b(?:\d[ -]*?){13,19}\b/giu, (match) => {
      const digits = match.replace(/\D/gu, "");
      return digits.length >= 13 && digits.length <= 19 && passesLuhn(digits) ? "[REDACTED-CARD]" : match;
    })
    .replace(/\b(?:cvv|cvc|pin|otp|passcode|password)\s*[:=#]\s*[^\s",}\]]+/giu, "[REDACTED-SECRET]");
  for (const secret of secretValues) {
    if (secret.length >= 4 && out.includes(secret)) {
      out = out.split(secret).join("[REDACTED]");
    }
  }
  return out;
}

export function containsSecretLeak(text: string, secretValues: readonly string[]): boolean {
  return secretValues.some((secret) => secret.length >= 4 && text.includes(secret));
}

const multiPartCcRoots = new Set(["co", "org", "gov", "ac", "com", "edu"]);

function registrableSite(host: string): string {
  const normalized = host.toLowerCase();
  if (normalized === "localhost" || normalized.startsWith("[") || /^[\d.]+$/u.test(normalized)) {
    return normalized;
  }
  const labels = normalized.split(".").filter((label) => label.length > 0);
  if (labels.length <= 2) return normalized;
  const tld = labels.at(-1) ?? "";
  const sld = labels.at(-2) ?? "";
  const take = tld.length === 2 && multiPartCcRoots.has(sld) ? 3 : 2;
  return labels.slice(-take).join(".");
}

export function sameSiteOrigin(candidateUrl: string, expectedOrigin: string): boolean {
  const a = URL.parse(candidateUrl);
  const b = URL.parse(expectedOrigin);
  if (!a || !b) return false;
  if (a.origin === b.origin) return true;
  return a.protocol === b.protocol && a.port === b.port && registrableSite(a.hostname) === registrableSite(b.hostname);
}

function loadPlaywright(rootDir: string): PlaywrightModule {
  const req = createRequire(path.join(rootDir, "package.json"));
  const loaded: unknown = req("playwright");
  if (!isRecord(loaded) || !isRecord(loaded.chromium) || typeof loaded.chromium.launch !== "function") {
    throw new Error("Playwright chromium launcher could not be loaded from workspace root.");
  }
  return loaded as PlaywrightModule;
}

async function loadElizaWalkthrough(rootDir: string): Promise<ElizaWalkthroughModule> {
  const enginePath = path.join(rootDir, "vendor/eliza/packages/os/browser/src/walkthrough-engine.mjs");
  const mod: unknown = await import(pathToFileURL(enginePath).href);
  if (
    !isRecord(mod) ||
    typeof mod.createOpenAICompatiblePlanner !== "function" ||
    typeof mod.createPlaywrightWalkthroughTransport !== "function" ||
    typeof mod.createWalkthroughEngine !== "function"
  ) {
    throw new Error(`Eliza walkthrough-engine exports not found at ${enginePath}`);
  }
  return mod as ElizaWalkthroughModule;
}

export async function runWalkthrough(options: WalkthroughOptions): Promise<WalkthroughResult> {
  const startedAt = Date.now();
  const secrets = options.secretValues ?? [];
  const startOrigin = URL.parse(options.url)?.origin ?? "";
  let commitsApproved = 0;
  let commitsBlocked = 0;
  let handoffs = 0;
  let finalUrl = options.url;

  const eliza = await loadElizaWalkthrough(options.rootDir);
  const playwright = loadPlaywright(options.rootDir);
  const browser = await playwright.chromium.launch({ headless: true });
  let transport: ElizaTransport | undefined;

  try {
    const context = await browser.newContext({
      ignoreHTTPSErrors: options.ignoreHttpsErrors ?? false,
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    if (options.onPageReady) await options.onPageReady(page);
    await page.goto(options.url, { waitUntil: "load", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => undefined);

    const planner = eliza.createOpenAICompatiblePlanner({
      baseUrl: options.llm.baseUrl,
      apiKey: options.llm.apiKey,
      model: options.llm.model,
      maxTokens: options.llm.maxTokens,
      disableReasoning: options.llm.disableReasoning,
      ...(options.llm.reasoningEffort ? { reasoningEffort: options.llm.reasoningEffort } : {}),
    });

    transport = eliza.createPlaywrightWalkthroughTransport(page, {
      allowedOrigins: startOrigin ? [startOrigin] : [],
      allowSameSiteSubdomains: true,
      maxConsequence: "stage",
      settleMs: 350,
    });

    const engine = eliza.createWalkthroughEngine({
      goal: {
        instruction: redactPii(options.goal, secrets),
        constraints: options.nonSecretContext ? [redactPii(options.nonSecretContext, secrets)] : [],
        allowedOrigins: startOrigin ? [startOrigin] : [],
        allowSameSiteSubdomains: true,
        maxSteps: options.maxSteps,
        autoDismissBlockers: true,
        requireApprovalForCommit: true,
      },
      transport,
      planner,
      ports: {
        onHandoff: async (handoff: ElizaHandoff) => {
          handoffs += 1;
          const targetSelector = handoff.details?.targetSelector ?? handoff.targetSelector ?? "";
          const targetLabel = handoff.details?.targetLabel ?? handoff.targetLabel ?? "";
          if (handoff.kind === "NeedsCommitApproval") {
            if (!options.autoApproveCommits) {
              commitsBlocked += 1;
              return { kind: "pause", reason: handoff.summary };
            }
            commitsApproved += 1;
            return {
              kind: "approved",
              approved: true,
              commitGrant: {
                grantId: randomUUID(),
                selector: targetSelector,
                expiresAt: Date.now() + 30_000,
              },
            };
          }
          if (handoff.kind === "NeedsUserDisambiguation" && options.autoApproveCommits) {
            return {
              kind: "approved",
              approved: true,
              answer: "Proceed directly with the requested goal using standard non-recurring options.",
            };
          }
          if (handoff.kind === "NeedsUntrustedOriginApproval" && handoff.targetOrigin && sameSiteOrigin(handoff.targetOrigin, startOrigin)) {
            return {
              kind: "approved",
              approved: true,
              allowOrigin: handoff.targetOrigin,
            };
          }
          if (
            options.humanHandoff &&
            (handoff.kind === "NeedsPrivateSignIn" || handoff.kind === "NeedsMFA" || handoff.kind === "NeedsFileUpload")
          ) {
            const handled = await options.humanHandoff({
              page,
              url: page.url(),
              handoffKind: handoff.kind,
              targetRef: targetSelector,
              targetLabel,
              reason: handoff.summary,
            });
            if (handled) {
              return { kind: "approved", approved: true, humanCompleted: true };
            }
          }
          return { kind: "pause", reason: handoff.summary };
        },
      },
    });

    const outcome = await engine.run();
    finalUrl = page.url();
    const telemetry = engine.getTelemetry();
    const rawJsonl = engine.getTelemetryJsonl();
    const rawQuotes = (outcome.quotes ?? []).join("\n");
    const piiLeakDetected =
      containsSecretLeak(rawJsonl, secrets) ||
      containsSecretLeak(outcome.summary ?? "", secrets) ||
      containsSecretLeak(rawQuotes, secrets) ||
      containsSecretLeak(outcome.reason ?? "", secrets);
    const safeJsonl = redactPii(rawJsonl, secrets);
    const safeTrajectory: TrajectoryEntry[] = telemetry.map((entry) => ({
      ...entry,
      urlOriginPath: redactPii(entry.urlOriginPath, secrets),
      targetLabel: entry.targetLabel === null ? null : redactPii(entry.targetLabel, secrets),
      ...(entry.detail !== undefined ? { detail: redactPii(entry.detail, secrets) } : {}),
    }));

    if (options.trajectoryPath) {
      mkdirSync(path.dirname(options.trajectoryPath), { recursive: true });
      writeFileSync(options.trajectoryPath, safeJsonl.endsWith("\n") || safeJsonl === "" ? safeJsonl : `${safeJsonl}\n`, "utf8");
    }

    const warnings = [...new Set(safeTrajectory.flatMap((event) => event.darkPatternFlags))];
    const answer = redactPii(outcome.summary ?? outcome.handoff?.summary ?? "", secrets);
    const evidence = redactPii((outcome.quotes ?? []).join(" | ") || outcome.handoff?.targetLabel || "", secrets);

    let status: WalkthroughStatus = "error";
    if (outcome.status === "completed") status = "completed";
    else if (outcome.status === "paused") {
      status = outcome.handoff?.kind === "NeedsCommitApproval" ? "needs_commit_approval" : "needs_person";
    } else if (outcome.status === "blocked") {
      status = /max.?steps/iu.test(outcome.reason ?? "") ? "max_steps" : "blocked";
    }

    return {
      ok: (status === "completed" || status === "needs_person" || status === "needs_commit_approval") && !piiLeakDetected,
      status,
      startUrl: options.url,
      finalUrl,
      answer,
      evidence,
      steps: outcome.stepIndex,
      commitsApproved,
      commitsBlocked,
      handoffs,
      darkPatternWarnings: warnings,
      piiLeakDetected,
      ...(options.trajectoryPath ? { trajectoryPath: options.trajectoryPath } : {}),
      trajectory: safeTrajectory,
      ...(outcome.reason ? { error: redactPii(outcome.reason, secrets) } : {}),
      totalMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      status: "error",
      startUrl: options.url,
      finalUrl,
      answer: "",
      evidence: "",
      steps: 0,
      commitsApproved,
      commitsBlocked,
      handoffs,
      darkPatternWarnings: [],
      piiLeakDetected: false,
      ...(options.trajectoryPath ? { trajectoryPath: options.trajectoryPath } : {}),
      trajectory: [],
      error: error instanceof Error ? error.message : String(error),
      totalMs: Date.now() - startedAt,
    };
  } finally {
    transport?.dispose?.();
    await browser.close();
  }
}

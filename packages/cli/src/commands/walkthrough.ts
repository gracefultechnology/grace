import path from "node:path";
import { defineCommand } from "../runner.ts";
import { resolveLlmConfig } from "../lib/llm.ts";
import { runWalkthrough } from "../lib/walkthrough-runner.ts";

export const walkthroughCommand = defineCommand({
  name: "walkthrough",
  summary: "Run a blind real-LLM web walkthrough through Grace safety gates",
  usage: "pnpm cli walkthrough --url <url> --goal <goal> [--provider cerebras|openai|ollama] [--model <id>] [--base-url <url>] [--max-steps <n>] [--auto-approve-commits] [--trajectory <path>] [--json]",
  flags: {
    url: {
      kind: "string",
      short: "u",
      description: "Landing URL to open in headless Chromium",
    },
    goal: {
      kind: "string",
      short: "g",
      description: "Natural-language task goal for the walkthrough",
    },
    provider: {
      kind: "string",
      description: "LLM provider: cerebras (default when CEREBRAS_API_KEY is set), openai, or ollama",
    },
    model: {
      kind: "string",
      short: "m",
      description: "Model ID (e.g. qwen-3.8-27b, gpt-oss-120b, gpt-4o-mini)",
    },
    "base-url": {
      kind: "string",
      description: "Override OpenAI-compatible API base URL",
    },
    "max-steps": {
      kind: "string",
      description: "Maximum walkthrough planner steps (default: 15)",
    },
    "auto-approve-commits": {
      kind: "boolean",
      description: "Simulate person approval on irreversible commit gates",
    },
    trajectory: {
      kind: "string",
      description: "Optional file path for zero-PII trajectory.jsonl output",
    },
  },
  run: async ({ flags }, { rootDir, cwd }) => {
    const url = flags.url?.trim() ?? "";
    const goal = flags.goal?.trim() ?? "";
    if (!url || !URL.canParse(url)) {
      return { ok: false, message: "Provide a valid --url <http(s)://...>." };
    }
    if (!goal) {
      return { ok: false, message: "Provide a non-empty --goal <description>." };
    }
    const maxSteps = flags["max-steps"] ? Number(flags["max-steps"]) : 15;
    if (!Number.isSafeInteger(maxSteps) || maxSteps < 1 || maxSteps > 60) {
      return { ok: false, message: "--max-steps must be an integer between 1 and 60." };
    }
    const llm = resolveLlmConfig({
      provider: flags.provider,
      model: flags.model,
      baseUrl: flags["base-url"],
    });
    const trajectoryPath = flags.trajectory ? path.resolve(cwd, flags.trajectory) : undefined;
    const result = await runWalkthrough({
      rootDir,
      url,
      goal,
      llm,
      maxSteps,
      autoApproveCommits: Boolean(flags["auto-approve-commits"]),
      ...(trajectoryPath ? { trajectoryPath } : {}),
    });
    const lines = [
      `Walkthrough ${result.status} (${result.steps} steps, ${result.totalMs}ms) via ${llm.provider}/${llm.model}`,
      `Final URL: ${result.finalUrl}`,
      ...(result.answer ? [`Answer: ${result.answer}`] : []),
      ...(result.evidence ? [`Evidence: ${result.evidence}`] : []),
      ...(result.error ? [`Error: ${result.error}`] : []),
      ...(result.trajectoryPath ? [`Trajectory: ${result.trajectoryPath}`] : []),
    ];
    const data = { provider: llm.provider, model: llm.model, ...result };
    if (!result.ok || result.piiLeakDetected) {
      return {
        ok: false,
        message: result.piiLeakDetected ? "PII leak detected in walkthrough output." : (result.error ?? `Walkthrough ended with status ${result.status}`),
        data,
      };
    }
    return { ok: true, data, lines };
  },
});

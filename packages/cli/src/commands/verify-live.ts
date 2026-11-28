import type { DeploymentReceipt } from "vibestack/alchemy";
import { defineCommand } from "../runner.ts";

interface VerifyLiveSummary {
  readonly stage: string;
  readonly apiOrigin: string;
  readonly webOrigin: string;
  readonly api: DeploymentReceipt;
  readonly web: DeploymentReceipt;
}

const stageOrigins = {
  staging: {
    apiOrigin: "https://api-staging.graceforseniors.com",
    webOrigin: "https://app-staging.graceforseniors.com",
  },
  production: {
    apiOrigin: "https://api.graceforseniors.com",
    webOrigin: "https://app.graceforseniors.com",
  },
} as const;

function hasOkStatus(payload: unknown): boolean {
  return Boolean(payload && typeof payload === "object" && (payload as Record<string, unknown>).status === "ok");
}

function listsGraceAndroidApp(payload: unknown): boolean {
  if (!Array.isArray(payload)) return false;
  return payload.some((item: unknown) => {
    const target = item && typeof item === "object" ? (item as Record<string, unknown>).target : undefined;
    return Boolean(target && typeof target === "object" && (target as Record<string, unknown>).package_name === "technology.graceful.grace");
  });
}

export const verifyLiveCommand = defineCommand({
  name: "verify-live",
  summary: "Verify live Grace Cloud API health, Android assetlinks, and return-template isolation",
  usage: "pnpm cli verify-live [--stage staging|production] [--api-url <url>] [--web-url <url>] [--json]",
  flags: {
    stage: {
      kind: "string",
      short: "s",
      description: "Target hosted stage (staging or production; defaults to staging)",
    },
    "api-url": {
      kind: "string",
      description: "Override API origin URL to probe",
    },
    "web-url": {
      kind: "string",
      description: "Override Web origin URL to probe",
    },
  },
  run: async ({ flags }) => {
    const { verifyDeploymentEndpoints } = await import("vibestack/alchemy");
    const stageKey = flags.stage === "production" || flags.stage === "prod" ? "production" : "staging";
    const defaults = stageOrigins[stageKey];
    const apiOrigin = flags["api-url"] ?? defaults.apiOrigin;
    const webOrigin = flags["web-url"] ?? defaults.webOrigin;

    const api = await verifyDeploymentEndpoints(
      apiOrigin,
      [
        { path: "/api/health", expectedStatus: 200, expectJson: hasOkStatus },
        { path: "/checkout-outcome.paid.html", expectedStatus: 404 },
      ],
      { throwOnFailure: false },
    );

    const web = await verifyDeploymentEndpoints(
      webOrigin,
      [
        { path: "/.well-known/assetlinks.json", expectedStatus: 200, expectJson: listsGraceAndroidApp },
        { path: "/return-to-app.html", expectedStatus: 404 },
        { path: "/%72eturn-to-app.html", expectedStatus: 404 },
      ],
      { throwOnFailure: false },
    );

    const data: VerifyLiveSummary = { stage: stageKey, apiOrigin, webOrigin, api, web };
    if (!api.ok || !web.ok) {
      return {
        ok: false,
        message: `Live verification failed for ${stageKey} (${apiOrigin}, ${webOrigin}).`,
        exitCode: 1,
        data,
      };
    }

    const totalProbes = api.probes.length + web.probes.length;
    return {
      ok: true,
      data,
      lines: [`verified ${stageKey}: ${apiOrigin} and ${webOrigin} (${String(totalProbes)} probes ok)`],
    };
  },
});

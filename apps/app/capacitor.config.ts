import type { CapacitorConfig } from "@capacitor/cli";
import { Schema } from "effect";

export const androidPaths = { project: "android/generated", web: "dist" };

export const standaloneProfile = "standalone-production";
export const CloudProfile = Schema.Literals([standaloneProfile, "standalone-staging", "shared-production", "shared-staging"]);
export type CloudProfile = typeof CloudProfile.Type;
export const cloudProfiles = {
  "standalone-production": {
    apiOrigin: "https://api.graceforseniors.com", webOrigin: "https://app.graceforseniors.com",
    agentOrigin: "https://api.graceforseniors.com",
    callbackPath: "/android/auth/callback", environment: "production", sources: "standalone-cloud",
  },
  "standalone-staging": {
    apiOrigin: "https://api-staging.graceforseniors.com", webOrigin: "https://app-staging.graceforseniors.com",
    agentOrigin: "https://api-staging.graceforseniors.com",
    callbackPath: "/android/auth/callback", environment: "staging", sources: "standalone-cloud",
  },
  "shared-production": {
    apiOrigin: "https://cloud.eliza.app", webOrigin: "https://cloud.eliza.app",
    agentOrigin: "https://api.eliza.app",
    callbackPath: "/auth/grace/callback", environment: "production", sources: "shared-cloud",
  },
  "shared-staging": {
    apiOrigin: "https://cloud-staging.eliza.app", webOrigin: "https://cloud-staging.eliza.app",
    agentOrigin: "https://api-staging.eliza.app",
    callbackPath: "/auth/grace/callback", environment: "staging", sources: "shared-cloud",
  },
} as const satisfies Record<CloudProfile, object>;

const appId = "technology.graceful.grace";
const cloudProfile = Schema.decodeUnknownSync(CloudProfile)(process.env.VITE_GRACE_CLOUD_PROFILE ?? standaloneProfile);
const production = cloudProfiles["shared-production"];
const staging = cloudProfiles["shared-staging"];
const registrationTarget = (target: typeof production | typeof staging) => ({
  name: target.environment,
  apiOrigin: target.apiOrigin,
  appLinkHost: new URL(target.webOrigin).hostname,
  redirectPath: target.callbackPath,
});
const testEnvironments = cloudProfile === "shared-staging";

const config: CapacitorConfig = {
  appId,
  appName: "Grace",
  webDir: process.env.GRACE_ANDROID_CAPACITOR_WEB_DIR ?? androidPaths.web,
  loggingBehavior: "none",
  android: { path: process.env.GRACE_ANDROID_CAPACITOR_PROJECT ?? androidPaths.project },
  plugins: {
    SystemBars: { style: "LIGHT", insetsHandling: "disable" },
    ...(cloudProfiles[cloudProfile].sources === "standalone-cloud" ? {} : {
      GraceAccount: {
        clientId: appId,
        testEnvironments,
        googleMode: "picker",
        googleBrowserFallback: true,
        googleScopes: ["email"],
        environments: testEnvironments ? [registrationTarget(production), registrationTarget(staging)] : [registrationTarget(production)],
      },
    }),
  },
};
export default config;

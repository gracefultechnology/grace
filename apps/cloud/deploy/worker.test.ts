// spec/app/setup.md, "Story: Sign in to Grace and manage my subscription"; spec/app/setup.md, "Story: Approve a password backup in my browser"
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Test from "@alchemy.run/test/Vitest";
import * as Alchemy from "alchemy";
import * as Effect from "effect/Effect";
import { expect } from "vitest";
import { hashAssetDirectory, resolveStage } from "vibestack/alchemy";

const cloudDir = path.resolve(import.meta.dirname, "..");
const workerBundlePath = path.join(cloudDir, "dist/bundle/worker.mjs");
const wranglerConfigPath = path.join(cloudDir, "wrangler.jsonc");
const stage = resolveStage({ mode: "test", cwd: cloudDir }).stage;

const webHost = "app-staging.graceforseniors.com";
const apiHost = "api-staging.graceforseniors.com";
const localWebOrigin = `http://${webHost}`;
const localApiOrigin = `http://${apiHost}`;
const debugCertificate = "41:C2:73:72:4A:EA:BA:69:3F:1B:B0:91:A0:8B:E7:60:7E:75:AD:D8:A4:C4:19:9B:AF:69:50:0C:3A:89:C0:64";

const fixtureAssetsDir = fs.mkdtempSync(path.join(os.tmpdir(), "grace-cloud-workerd-assets-"));
fs.writeFileSync(path.join(fixtureAssetsDir, "index.html"), "<!doctype html><div id=\"root\">Grace</div>\n");
fs.writeFileSync(path.join(fixtureAssetsDir, "return-to-app.html"), "<!doctype html>template\n");

interface RawWrangler {
  readonly compatibility_date: string;
  readonly compatibility_flags: readonly string[];
  readonly env: {
    readonly staging: {
      readonly vars: Readonly<Record<string, string>>;
      readonly send_email: readonly { readonly allowed_sender_addresses?: readonly string[] }[];
    };
  };
}

const wrangler = JSON.parse(fs.readFileSync(wranglerConfigPath, "utf8")) as RawWrangler;

interface HttpResult {
  readonly status: number;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly body: string;
}

function requestWithHost(baseUrl: string, host: string, requestPath: string, method = "GET"): Promise<HttpResult> {
  const parsed = new URL(baseUrl);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : 80,
        path: requestPath,
        method,
        headers: { host },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

const GraceCloudWorkerdStack = Alchemy.Stack(
  "GraceCloudWorkerdTest",
  {
    providers: Cloudflare.providers(),
    state: Alchemy.localState(),
  },
  Effect.gen(function* () {
    const assets = hashAssetDirectory(fixtureAssetsDir);
    const signInEmail = yield* Cloudflare.Email.SendEmail("SIGN_IN_EMAIL", {
      allowedSenderAddresses: [...(wrangler.env.staging.send_email[0]?.allowed_sender_addresses ?? ["signin@auth.graceforseniors.com"])],
    });
    const worker = yield* Cloudflare.Worker("GraceCloud", {
      main: workerBundlePath,
      bundle: false,
      compatibility: {
        date: wrangler.compatibility_date > "2026-11-02" ? "2026-11-02" : wrangler.compatibility_date,
        flags: [...wrangler.compatibility_flags],
      },
      workersDev: true,
      assets: {
        directory: assets.directory,
        hash: assets.hash,
        htmlHandling: "none",
        notFoundHandling: "single-page-application",
        runWorkerFirst: true,
      },
      env: {
        ...wrangler.env.staging.vars,
        WEB_ORIGIN: localWebOrigin,
        PUBLIC_API_ORIGIN: localApiOrigin,
        AI: Cloudflare.Workers.AI(),
        SIGN_IN_EMAIL: signInEmail,
      },
    });
    return { url: worker.url, assetHash: assets.hash };
  }),
);

const { test, beforeAll, afterAll, deploy, destroy } = Test.make({
  providers: Cloudflare.providers(),
  dev: true,
  stage,
});

const stack = beforeAll(deploy(GraceCloudWorkerdStack));
afterAll(
  Effect.gen(function* () {
    yield* destroy(GraceCloudWorkerdStack);
    fs.rmSync(fixtureAssetsDir, { recursive: true, force: true });
  }),
);

test("boots Grace Cloud in local workerd and serves assetlinks, SPA assets, CSP, and template blocks", Effect.gen(function* () {
  const outputs = yield* stack;
  expect(outputs?.url).toMatch(/^http:\/\/(?:localhost|127\.0\.0\.1):/);
  const url = outputs?.url;
  if (!url) throw new Error("Missing local workerd URL");

  const assetLinks = yield* Effect.promise(() => requestWithHost(url, webHost, "/.well-known/assetlinks.json"));
  expect(assetLinks.status).toBe(200);
  expect(JSON.parse(assetLinks.body)).toEqual([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "technology.graceful.grace",
        sha256_cert_fingerprints: [debugCertificate],
      },
    },
  ]);

  const rootPage = yield* Effect.promise(() => requestWithHost(url, webHost, "/"));
  expect(rootPage.status).toBe(200);
  expect(rootPage.body).toContain("Grace");

  const approval = yield* Effect.promise(() => requestWithHost(url, webHost, "/android/passwords/approve"));
  expect(approval.status).toBe(200);
  expect(approval.headers["referrer-policy"]).toBe("no-referrer");
  expect(approval.headers["cache-control"]).toBe("no-store, no-transform");
  expect(String(approval.headers["content-security-policy"])).toContain(`connect-src 'self' ${localApiOrigin}`);

  const rawTemplate = yield* Effect.promise(() => requestWithHost(url, webHost, "/return-to-app.html"));
  expect(rawTemplate.status).toBe(404);

  const encodedTemplate = yield* Effect.promise(() => requestWithHost(url, webHost, "/%72eturn-to-app.html"));
  expect(encodedTemplate.status).toBe(404);

  const apiTemplate = yield* Effect.promise(() => requestWithHost(url, apiHost, "/checkout-outcome.paid.html"));
  expect(apiTemplate.status).toBe(404);

  const unknownOrigin = yield* Effect.promise(() => requestWithHost(url, "foreign.example.test", "/"));
  expect(unknownOrigin.status).toBe(404);

  const health = yield* Effect.promise(() => requestWithHost(url, apiHost, "/api/health"));
  expect([200, 503]).toContain(health.status);
}));

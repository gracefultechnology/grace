import fs from "node:fs";
import path from "node:path";
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Alchemy from "alchemy";
import * as Output from "alchemy/Output";
import { makeBucketState } from "alchemy/State/BucketState";
import { State, StateStoreError } from "alchemy/State/State";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as Scope from "effect/Scope";
import {
  assertStageGuard,
  hashAssetDirectory,
  makeR2BucketObjects,
  resolveStage,
  verifyDeploymentEndpoints,
  type StageTarget,
} from "vibestack/alchemy";

const hyperdriveLookupTypeId = Symbol.for("alchemy/Cloudflare/Hyperdrive/ConnectionLookup");

function hyperdriveById(
  id: string,
  props: {
    readonly hyperdriveId: string;
    readonly accountId?: string;
    readonly dev?: Cloudflare.Hyperdrive.DevOrigin;
  },
): Cloudflare.Hyperdrive.ConnectionLookup {
  const ref: unknown = {
    [hyperdriveLookupTypeId]: true,
    Type: "Cloudflare.Hyperdrive",
    LogicalId: id,
    hyperdriveId: Output.asOutput(props.hyperdriveId),
    name: Output.asOutput(id),
    accountId: Output.asOutput(props.accountId ?? ""),
    dev: Output.asOutput<Cloudflare.Hyperdrive.DevOrigin | undefined>(props.dev),
  };
  if (!Cloudflare.Hyperdrive.isConnectionLookup(ref)) {
    throw new Error(`Invalid Hyperdrive lookup reference for ${id}`);
  }
  return ref;
}

const localWorkerdCompatDate = "2026-11-02";

function resolveCompatibilityDate(configured: string, isHostedStage: boolean): string {
  if (isHostedStage) return configured;
  return configured > localWorkerdCompatDate ? localWorkerdCompatDate : configured;
}

const cloudDir = import.meta.dirname;
const repoRoot = path.resolve(cloudDir, "../..");
const workerBundlePath = path.join(cloudDir, "dist/bundle/worker.mjs");
const wranglerConfigPath = path.join(cloudDir, "wrangler.jsonc");

const RouteSchema = Schema.Struct({
  pattern: Schema.String,
  custom_domain: Schema.optionalKey(Schema.Boolean),
});

const HyperdriveSchema = Schema.Struct({
  binding: Schema.String,
  id: Schema.String,
});

const SendEmailSchema = Schema.Struct({
  name: Schema.String,
  allowed_sender_addresses: Schema.optionalKey(Schema.Array(Schema.String)),
});

const EnvConfigSchema = Schema.Struct({
  name: Schema.String,
  routes: Schema.Array(RouteSchema),
  vars: Schema.Record(Schema.String, Schema.String),
  triggers: Schema.Struct({ crons: Schema.Array(Schema.String) }),
  hyperdrive: Schema.Array(HyperdriveSchema),
  send_email: Schema.Array(SendEmailSchema),
});

const WranglerConfigSchema = Schema.Struct({
  compatibility_date: Schema.String,
  compatibility_flags: Schema.Array(Schema.String),
  triggers: Schema.Struct({ crons: Schema.Array(Schema.String) }),
  vars: Schema.Record(Schema.String, Schema.String),
  env: Schema.Struct({
    staging: EnvConfigSchema,
    production: EnvConfigSchema,
  }),
});

type WranglerConfig = typeof WranglerConfigSchema.Type;

function loadWranglerConfig(): WranglerConfig {
  const raw = fs.readFileSync(wranglerConfigPath, "utf8");
  return Schema.decodeUnknownSync(Schema.fromJsonString(WranglerConfigSchema))(raw);
}

interface ParsedOrigin {
  readonly scheme: "postgres";
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: Redacted.Redacted<string>;
}

function parsePostgresOrigin(rawUrl: string): ParsedOrigin {
  const parsed = new URL(rawUrl);
  return {
    scheme: "postgres",
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 5432,
    database: parsed.pathname.replace(/^\/+/, "") || "grace",
    user: decodeURIComponent(parsed.username || "postgres"),
    password: Redacted.make(decodeURIComponent(parsed.password || "postgres")),
  };
}

function resolveAssetsDir(target: StageTarget): string {
  const explicit = process.env.GRACE_CLOUD_ASSETS_DIR?.trim();
  if (explicit) return path.resolve(cloudDir, explicit);
  const envName = target.kind === "production" ? "production" : "staging";
  const merged = path.join(cloudDir, ".wrangler/assets", envName);
  if (fs.existsSync(merged)) return merged;
  return path.resolve(cloudDir, "../app/dist");
}

function resolveStateLayer() {
  return Layer.unwrap(
    Effect.gen(function* () {
      const stageName = yield* Alchemy.Stage;
      const stageTarget = resolveStage({ stage: stageName, cwd: repoRoot });
      if (stageTarget.kind === "dev" || stageTarget.kind === "test") {
        return Alchemy.localState();
      }
      if (process.env.ALCHEMY_STATE_STORE === "cloudflare") {
        return Cloudflare.state({
          ...(process.env.CLOUDFLARE_ACCOUNT_ID ? { accountId: process.env.CLOUDFLARE_ACCOUNT_ID } : {}),
        });
      }
      const bucket = process.env.R2_STATE_BUCKET;
      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
      const accessKeyId = process.env.R2_STATE_ACCESS_KEY_ID;
      const secretAccessKey = process.env.R2_STATE_SECRET_ACCESS_KEY;
      const apiToken = process.env.CLOUDFLARE_API_TOKEN;
      const wantsR2 = process.env.ALCHEMY_STATE_STORE === "r2" || Boolean(bucket && accountId && accessKeyId && secretAccessKey);
      if (wantsR2 && bucket && accountId && ((accessKeyId && secretAccessKey) || apiToken)) {
        const config = accessKeyId && secretAccessKey
          ? { kind: "s3" as const, accountId, bucket, accessKeyId, secretAccessKey }
          : { kind: "api" as const, accountId, bucket, apiToken: apiToken ?? "" };
        const objects = makeR2BucketObjects<StateStoreError>(config, {
          tryPromise: Effect.tryPromise,
          makeError: ({ message, cause, status }) =>
            new StateStoreError({
              message,
              ...(cause ? { cause } : {}),
              ...(status !== undefined ? { http: { status } } : {}),
            }),
        });
        return Layer.effect(
          State,
          Effect.gen(function* () {
            const context = yield* Effect.context();
            const scope = yield* Effect.scope;
            const make = makeBucketState({
              id: "r2",
              label: "Cloudflare R2",
              prefix: process.env.R2_STATE_PREFIX ?? `alchemy/grace-cloud/${stageTarget.stage}/`,
              objects: Effect.succeed(objects),
            }).pipe(Scope.provide(scope), Effect.provideContext(context));
            return yield* Effect.cached(make);
          }),
        );
      }
      return Alchemy.localState();
    }),
  );
}

const VerifyGraceCloud = Alchemy.Action(
  "VerifyGraceCloud",
  (input: {
    readonly workerName: string;
    readonly workerUrl: string | undefined;
    readonly apiOrigin: string | undefined;
    readonly webOrigin: string | undefined;
    readonly assetHash: string;
    readonly verifyLive: boolean;
  }) =>
    Effect.tryPromise(async () => {
      if (!input.verifyLive) {
        return {
          ok: true,
          baseUrl: input.apiOrigin ?? input.workerUrl ?? "",
          verifiedAt: new Date().toISOString(),
          assetHash: input.assetHash,
          probes: [],
        };
      }
      if (!input.workerName || !input.apiOrigin || !input.webOrigin) {
        throw new Error("Deployed Grace Cloud worker did not provide workerName, apiOrigin, and webOrigin");
      }
      const apiReceipt = await verifyDeploymentEndpoints(
        input.apiOrigin,
        [
          {
            path: "/api/health",
            expectedStatus: 200,
            expectJson: (body) =>
              typeof body === "object" && body !== null && "status" in body && (body as { status?: unknown }).status === "ok",
          },
          { path: "/checkout-outcome.paid.html", expectedStatus: 404 },
        ],
        { assetHash: input.assetHash },
      );
      const webReceipt = await verifyDeploymentEndpoints(
        input.webOrigin,
        [
          {
            path: "/.well-known/assetlinks.json",
            expectedStatus: 200,
            expectJson: (body) =>
              Array.isArray(body) &&
              body.some(
                (entry) =>
                  typeof entry === "object" &&
                  entry !== null &&
                  "target" in entry &&
                  typeof (entry as { target?: { package_name?: unknown } }).target?.package_name === "string" &&
                  (entry as { target: { package_name: string } }).target.package_name === "technology.graceful.grace",
              ),
          },
          { path: "/return-to-app.html", expectedStatus: 404 },
          { path: "/%72eturn-to-app.html", expectedStatus: 404 },
        ],
        { assetHash: input.assetHash },
      );
      return {
        ok: apiReceipt.ok && webReceipt.ok,
        baseUrl: input.apiOrigin,
        verifiedAt: webReceipt.verifiedAt,
        assetHash: input.assetHash,
        probes: [...apiReceipt.probes, ...webReceipt.probes],
      };
    }),
);

export default Alchemy.Stack(
  "GraceCloud",
  {
    providers: Cloudflare.providers(),
    state: resolveStateLayer(),
  },
  Effect.gen(function* () {
    const stageName = yield* Alchemy.Stage;
    const stageTarget = resolveStage({ stage: stageName, cwd: repoRoot });
    const wrangler = loadWranglerConfig();
    const isProduction = stageTarget.kind === "production";
    const isStaging = stageTarget.kind === "staging";
    const isHostedStage = isProduction || isStaging;
    const envConfig = isProduction ? wrangler.env.production : wrangler.env.staging;
    const prodConfig = wrangler.env.production;

    const stageDomains = isHostedStage ? envConfig.routes.map((route) => route.pattern) : [];
    const prodDomains = prodConfig.routes.map((route) => route.pattern);
    const prodHyperdriveIds = prodConfig.hyperdrive.map((entry) => entry.id);
    const stageHyperdriveId = isHostedStage ? envConfig.hyperdrive[0]?.id : undefined;

    assertStageGuard(stageTarget, {
      resourceIds: { HYPERDRIVE: stageHyperdriveId },
      domains: stageDomains,
      productionIds: prodHyperdriveIds,
      productionDomains: prodDomains,
    });

    const assetsDir = resolveAssetsDir(stageTarget);
    const assets = hashAssetDirectory(assetsDir);

    const allowedSenders = [...(envConfig.send_email[0]?.allowed_sender_addresses ?? ["signin@auth.graceforseniors.com"])];
    const signInEmail = yield* Cloudflare.Email.SendEmail("SIGN_IN_EMAIL", {
      allowedSenderAddresses: allowedSenders,
    });

    const localDbUrl = process.env.DATABASE_URL?.trim() || "postgres://postgres:postgres@127.0.0.1:5432/grace";
    const devOrigin = {
      ...parsePostgresOrigin(localDbUrl),
      sslmode: "disable" as const,
    };
    const hyperdriveOriginUrl = process.env.HYPERDRIVE_ORIGIN_URL?.trim();
    const hyperdrive = isHostedStage && stageHyperdriveId
      ? hyperdriveById("HYPERDRIVE", {
          hyperdriveId: stageHyperdriveId,
          accountId: process.env.CLOUDFLARE_ACCOUNT_ID?.trim(),
          dev: devOrigin,
        })
      : yield* Cloudflare.Hyperdrive.Connection("Hyperdrive", {
          name: isProduction
            ? "grace-cloud-production-postgres"
            : isStaging
              ? "grace-cloud-staging-postgres"
              : `grace-cloud-${stageTarget.stage}-postgres`,
          origin: parsePostgresOrigin(hyperdriveOriginUrl || localDbUrl),
          caching: { disabled: true },
          dev: devOrigin,
        }).pipe(Alchemy.AdoptPolicy.adopt(true), Alchemy.RemovalPolicy.retain());

    const apiHost = envConfig.routes[0]?.pattern;
    const webHost = envConfig.routes[1]?.pattern;
    const domain = isHostedStage && apiHost
      ? {
          name: apiHost,
          ...(webHost ? { aliases: [webHost] } : {}),
        }
      : undefined;

    const workerVars: Record<string, string> = isHostedStage
      ? { ...envConfig.vars }
      : { ...envConfig.vars, ...wrangler.vars };

    const worker = yield* Cloudflare.Worker("GraceCloud", {
      name: isHostedStage ? envConfig.name : `grace-cloud-${stageTarget.stage}`,
      main: workerBundlePath,
      bundle: false,
      compatibility: {
        date: resolveCompatibilityDate(wrangler.compatibility_date, isHostedStage),
        flags: [...wrangler.compatibility_flags],
      },
      workersDev: !isHostedStage,
      ...(domain ? { domain } : {}),
      crons: [...(isHostedStage ? envConfig.triggers.crons : wrangler.triggers.crons)],
      assets: {
        directory: assets.directory,
        hash: assets.hash,
        htmlHandling: "none",
        notFoundHandling: "single-page-application",
        runWorkerFirst: true,
      },
      env: {
        ...workerVars,
        AI: Cloudflare.Workers.AI(),
        SIGN_IN_EMAIL: signInEmail,
        HYPERDRIVE: hyperdrive,
      },
    }).pipe(Alchemy.AdoptPolicy.adopt(true), Alchemy.RemovalPolicy.retain());

    const apiOrigin = isHostedStage ? envConfig.vars.PUBLIC_API_ORIGIN : (worker.url ?? wrangler.vars.PUBLIC_API_ORIGIN);
    const webOrigin = isHostedStage ? envConfig.vars.WEB_ORIGIN : (worker.url ?? wrangler.vars.WEB_ORIGIN);

    const receipt = yield* VerifyGraceCloud({
      workerName: worker.workerName,
      workerUrl: worker.url,
      apiOrigin,
      webOrigin,
      assetHash: assets.hash,
      verifyLive: isHostedStage && process.env.ALCHEMY_SKIP_VERIFY !== "1",
    });

    return {
      url: worker.url,
      apiOrigin,
      webOrigin,
      stage: stageTarget.stage,
      assetHash: assets.hash,
      receipt,
    };
  }),
);

import { createHash, randomUUID } from "node:crypto";
import { type ChildProcess, execFile, execFileSync, spawn, spawnSync } from "node:child_process";
import { closeSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, openSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { createInterface } from "node:readline/promises";
import { isDeepStrictEqual, parseArgs, promisify } from "node:util";
import { Schema } from "effect";
import { parseAst } from "vite";
import { stageRuntimePayload } from "@elizaos/os/android/android-runtime-inventory.mjs";
import { buildAndroidConsumer } from "@elizaos/os/android/build-consumer.mjs";
import { generateAndroidConsumerHost } from "@elizaos/os/android/consumer-host.mjs";
import { readApkSignerDigest } from "@elizaos/os/android/apk-distribution.mjs";
import { resolveAndroidSdkRoot, resolveJavaHome } from "@elizaos/os/android/toolchain.ts";
import config, { androidPaths } from "../capacitor.config.ts";

const app = path.resolve(import.meta.dirname, "..");
const upstream = path.resolve(app, "../../vendor/eliza");
const artifacts = path.join(app, "artifacts");
const flavors = ["launcher", "standalone"];
export const identity = Schema.decodeUnknownSync(
  Schema.Struct({ appId: Schema.String, appName: Schema.String, android: Schema.Struct({ path: Schema.String }) }),
)(config);
const activity = `${identity.appId}/.MainActivity`;
const standaloneProfile = "standalone-production";
const CloudProfile = Schema.Literals([standaloneProfile, "shared-production", "shared-staging"]);
type CloudProfile = typeof CloudProfile.Type;
const cloudProfiles = {
  "standalone-production": {
    apiOrigin: "https://api.graceforseniors.com", webOrigin: "https://app.graceforseniors.com",
    agentOrigin: "https://api.graceforseniors.com",
    callbackPath: "/android/auth/callback", environment: "production", sources: "standalone-cloud",
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
const apkOutput = (cloudProfile: CloudProfile) => cloudProfile === standaloneProfile ? "artifacts" : `artifacts/cloud-profiles/${cloudProfile}`;
const forbiddenEntry = new RegExp([
  String.raw`\.(gguf|onnx|ort|tflite|safetensors|pte|task)$`,
  String.raw`(^|/)(lib[^/]*(llama|ggml|mtmd|onnxruntime|sherpa|whisper|piper|executorch|elizainference|omnivoice)[^/]*\.so(\.\d[^/]*)?|llama(-omnivoice)?-server)$`,
  String.raw`^assets/(?!public/)([^/]+/)*(tts|asr|models?)/`,
].join("|"), "i");
const inferenceClass = /^L(ai\/eliza\/voice\/|ai\/onnxruntime\/|org\/tensorflow\/lite\/|org\/pytorch\/|com\/k2fsa\/|com\/google\/mediapipe\/|org\/vosk\/)/;

const readJson = (file: string): unknown => JSON.parse(readFileSync(file, "utf8"));
const writeJson = (file: string, value: unknown) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
};
const SourceReference = Schema.Struct({ root: Schema.String, path: Schema.String });
const NativeHost = Schema.Struct({
  signing: Schema.Record(Schema.String, Schema.String),
  modules: Schema.Array(Schema.Struct({
    name: Schema.String, source: SourceReference,
    appDependency: Schema.optional(Schema.Boolean), relocateBuild: Schema.optional(Schema.Boolean),
  })),
  embeddedAgent: Schema.Struct({ host: SourceReference, character: SourceReference, policy: SourceReference }),
  sourceSets: Schema.Struct({ main: Schema.Struct({ java: Schema.Array(SourceReference), res: Schema.Array(SourceReference) }) }),
});
const profile = Schema.decodeUnknownSync(Schema.StructWithRest(NativeHost, [Schema.Record(Schema.String, Schema.Unknown)]))(
  readJson(path.join(app, "android/host.json")),
);
const { signing } = profile;
const keystore = signing.storeFile;

const Reasons = Schema.Record(Schema.String, Schema.String);
const Policy = Schema.Struct({
  model: Schema.NonEmptyString,
  plugins: Schema.Struct({ load: Reasons, refuse: Reasons }),
  actions: Schema.Struct({
    grace: Schema.Record(Schema.String, Schema.Unknown),
    upstream: Schema.Struct({ allow: Reasons, refuse: Reasons, plannerTools: Reasons, refusedSubactionsOf: Schema.Array(Schema.String) }),
  }),
});
const policy = Schema.decodeUnknownSync(Policy)(readJson(path.join(app, "agent/policy.json")));
const pluginLoad = Object.keys(policy.plugins.load);
if (pluginLoad.some((name) => Object.hasOwn(policy.plugins.refuse, name)))
  throw new Error("Grace's device policy cannot load a plugin it refuses");
const Abi = Schema.Literals(["arm64-v8a", "x86_64"]);
type Abi = typeof Abi.Type;
const EmulatorSerial = Schema.String.check(Schema.isPattern(/^emulator-\d+$/));
const AgentStatus = Schema.Struct({
  state: Schema.Literals(["unavailable", "stopped", "starting", "running", "failed"]),
  failure: Schema.optional(Schema.Literals(["payload", "storage", "config", "credential", "agent", "crashed", "runtime"])),
});
const PluginCall = {
  call: Schema.String.check(Schema.isPattern(/^[A-Z]\w*\.[a-z]\w*$/)),
  with: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
};
const Step = Schema.Union([
  Schema.Struct({ tap: Schema.NonEmptyString }),
  Schema.Struct({ homeCard: Schema.NonEmptyString }),
  Schema.Struct({ type: Schema.String, into: Schema.NonEmptyString, replace: Schema.optional(Schema.Boolean) }),
  Schema.Struct({ press: Schema.Literal("Enter") }),
  Schema.Struct({ expect: Schema.NonEmptyString }),
  Schema.Struct({ agent: AgentStatus }),
  Schema.Struct({ signIn: Schema.Struct({ signedIn: Schema.Boolean, google: Schema.Boolean }) }),
  Schema.Struct({ service: Schema.String.check(Schema.isPattern(/^[A-Z]\w*$/)) }),
  Schema.Struct({ leaveFor: Schema.String.check(Schema.isPattern(/^android\.settings\.[A-Z_]+$/)) }),
  Schema.Struct({ key: Schema.Literals(["VOLUME_UP", "VOLUME_DOWN"]) }),
  Schema.Struct({ ...PluginCall, returns: Schema.Record(Schema.String, Schema.Unknown) }),
  Schema.Struct({ ...PluginCall, refuses: Schema.NonEmptyString }),
  Schema.Struct({ evaluate: Schema.NonEmptyString, returns: Schema.Unknown }),
  Schema.Struct({ evaluate: Schema.NonEmptyString, rejects: Schema.NonEmptyString }),
  Schema.Struct({ grant: Schema.String.check(Schema.isPattern(/^android\.permission\.[A-Z_]+$/)) }),
  Schema.Struct({ forget: Schema.NonEmptyString }),
  Schema.Struct({ approve: Schema.NonEmptyString }),
  Schema.Struct({ notification: Schema.String.check(Schema.isPattern(/^[\w ,.-]+$/)) }),
  Schema.Struct({ restart: Schema.Literal("force-stop") }),
]);
type Step = typeof Step.Type;
type OnDevice = Extract<Step, { service: string } | { leaveFor: string } | { key: string } | { grant: string } | { forget: string } | { approve: string } | { notification: string }>;
type InSession = Exclude<Step, { restart: string }>;
const isOnDevice = (step: InSession): step is OnDevice => "service" in step || "leaveFor" in step || "key" in step || "grant" in step || "forget" in step || "approve" in step || "notification" in step;
const Benchmark = Schema.Struct({
  taskId: Schema.NonEmptyString,
  intent: Schema.NonEmptyString,
  startUrl: Schema.NonEmptyString,
});
type Benchmark = typeof Benchmark.Type;
type BenchmarkRun = { input: Benchmark; receipt: string };
const Arguments = Schema.Struct({
  "cloud-profile": Schema.optional(CloudProfile),
  release: Schema.optional(Schema.Boolean),
  verify: Schema.optional(Schema.Boolean),
  abi: Schema.optional(Abi),
  install: Schema.optional(EmulatorSerial),
  emulator: Schema.optional(Schema.NonEmptyString),
  exercise: Schema.optional(Schema.String.check(Schema.isPattern(/^[a-z0-9-]+$/))),
  "billworld-passwords": Schema.optional(Schema.NonEmptyString),
  "verify-billworld-run": Schema.optional(Schema.String.check(Schema.isPattern(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/))),
  benchmark: Schema.optional(Schema.NonEmptyString),
  receipt: Schema.optional(Schema.NonEmptyString),
});

const located = (found: string | null, missing: string) => {
  if (found === null) throw new Error(missing);
  return found;
};
const androidHome = () => located(resolveAndroidSdkRoot(), "No Android SDK was found: set ANDROID_HOME");

export function buildTool(name: string): string {
  const tools = path.join(androidHome(), "build-tools");
  const [newest] = readdirSync(tools).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  return path.join(tools, newest, name);
}

const environment = () => ({
  ...process.env,
  ANDROID_HOME: androidHome(),
  JAVA_HOME: located(resolveJavaHome(), "No JDK was found: set JAVA_HOME to a JDK 21"),
  ...(process.env[keystore]?.trim() ? { [keystore]: path.resolve(process.env.INIT_CWD ?? process.cwd(), process.env[keystore]) } : {}),
});

const versionCode = (version: string) => {
  const parts = /^(\d+)\.(\d{1,3})\.(\d{1,3})$/.exec(version);
  if (!parts) throw new Error(`package.json version ${version} is not MAJOR.MINOR.PATCH below 1000`);
  return Number(parts[1]) * 1e6 + Number(parts[2]) * 1e3 + Number(parts[3]);
};

const Commit = Schema.String.check(Schema.isPattern(/^[a-f0-9]{40}$/));
const NodeVersion = Schema.String.check(Schema.isPattern(/^26\.[0-9]+\.[0-9]+$/));
const NodeToolchain = {
  version: NodeVersion,
  ndk: Schema.NonEmptyString,
  apiLevel: Schema.Int.check(Schema.isGreaterThanOrEqualTo(29)),
};
const Digest = Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/));
const SourceArtifact = Schema.String.check(Schema.isPattern(/^https:\/\/github\.com\/elizaOS\/eliza\/releases\/download\/android-node-v26\.[0-9]+\.[0-9]+-ndk-[0-9.]+\/node-v26\.[0-9]+\.[0-9]+-android-(arm64-v8a|x86_64)\.zip$/));
const NodeManifest = Schema.Struct({ schema: Schema.Literal(1), abi: Abi, ...NodeToolchain, sha256: Digest, sourceSha256: Digest, buildCommit: Commit });
const NodeLock = Schema.Struct({ ...NodeToolchain, sourceSha256: Digest, buildCommit: Commit, entries: Schema.Array(Schema.Struct({
  abi: Abi, sha256: Digest, archiveSha256: Digest, url: SourceArtifact,
})) });
const BundlePin = Schema.Struct({ schema: Schema.Literal(1), sourceCommit: Commit });

function resolveNodeRuntime(directory: string, lock: typeof NodeLock.Type, abi: Abi) {
  const selected = lock.entries.filter((entry) => entry.abi === abi);
  if (selected.length !== 1) throw new Error(`Eliza's runtime lock must name ${abi} once`);
  const [source] = selected;
  const executable = "libeliza_node.so";
  const manifest = "manifest.json";
  function verified(binary: Buffer, receipt: Buffer) {
    const candidate = Schema.decodeUnknownSync(NodeManifest)(JSON.parse(receipt.toString("utf8")));
    if (candidate.abi !== abi || candidate.version !== lock.version || candidate.ndk !== lock.ndk
        || candidate.apiLevel !== lock.apiLevel || candidate.buildCommit !== lock.buildCommit
        || candidate.sourceSha256 !== lock.sourceSha256 || candidate.sha256 !== source.sha256
        || createHash("sha256").update(binary).digest("hex") !== source.sha256) {
      throw new Error(`Eliza's Android Node ${abi} differs from the runtime lock`);
    }
    return { ...candidate, file: path.join(directory, executable), url: source.url };
  }
  if (existsSync(path.join(directory, executable)) && existsSync(path.join(directory, manifest))) {
    return verified(readFileSync(path.join(directory, executable)), readFileSync(path.join(directory, manifest)));
  }
  mkdirSync(path.dirname(directory), { recursive: true });
  const scratch = mkdtempSync(path.join(path.dirname(directory), ".android-node-"));
  const archive = path.join(scratch, "runtime.zip");
  const formatLimit = 256 * 1024 * 1024;
  try {
    execFileSync("curl", ["--proto", "=https", "--proto-redir", "=https", "--fail", "--location", "--silent", "--show-error",
      "--retry", "2", "--connect-timeout", "15", "--max-time", "240", "--max-filesize", String(formatLimit),
      "--output", archive, source.url], { stdio: "inherit" });
    if (createHash("sha256").update(readFileSync(archive)).digest("hex") !== source.archiveSha256)
      throw new Error(`Eliza's Android Node ${abi} archive differs from the runtime lock`);
    const read = (entry: string) => execFileSync("unzip", ["-p", archive, entry], { maxBuffer: formatLimit });
    const binary = read(executable);
    const receipt = read(manifest);
    const runtime = verified(binary, receipt);
    writeFileSync(path.join(scratch, executable), binary, { mode: 0o755 });
    writeFileSync(path.join(scratch, manifest), receipt, { mode: 0o644 });
    rmSync(archive);
    renameSync(scratch, directory);
    return runtime;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

function bundleAgent(commit: string, bundle: string) {
  const generate = (owner: string) => execFileSync("pnpm", ["--dir", upstream, "gen", "--owner", owner], { stdio: "inherit" });
  generate("core");
  generate("agent");
  execFileSync("pnpm", ["--dir", upstream, "--filter", "@elizaos/core", "build"], { stdio: "inherit" });
  execFileSync("pnpm", ["--dir", upstream, "--filter", "@elizaos/agent", "exec", "vibelang", "-p", "tsconfig.device.json"], { stdio: "inherit" });
  const build = path.join(upstream, "packages/agent/dist/src/bundle/build.js");
  execFileSync(process.execPath, ["--input-type=module", "--eval", [
    'import { pathToFileURL } from "node:url";',
    'const [file, outDir, sourceCommit, plugins] = process.argv.slice(1);',
    'const { buildAgentBundle } = await import(pathToFileURL(file).href);',
    'await buildAgentBundle({ outDir, sourceCommit, plugins: JSON.parse(plugins) });',
  ].join("\n"), build, bundle, commit, JSON.stringify(pluginLoad)], { cwd: upstream, stdio: "inherit" });
}

function agentRuntime(abi: Abi) {
  const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  const commit = Schema.decodeUnknownSync(Commit)(git(app, "rev-parse", "HEAD:vendor/eliza"));
  if (git(upstream, "rev-parse", "HEAD") !== commit) throw new Error(`The Eliza checkout must match Grace's gitlink ${commit}`);
  const output = path.join(artifacts, "agent-runtime", commit, abi);
  const inventory = path.join(output, "android/app/src/main/assets/agent/inventory.json");
  if (!existsSync(inventory)) {
    const runtime = path.join(upstream, "packages/os/dist/android", abi);
    const bundle = path.join(upstream, "packages/agent/dist/bundle");
    const nodeLockFile = path.join(upstream, "packages/os/aosp/runtime/node.lock.json");
    const bundleFile = path.join(bundle, "agent.mjs");
    const bundleManifest = path.join(bundle, "manifest.json");
    if (!existsSync(nodeLockFile)) throw new Error(`Pinned Eliza runtime ${commit} lacks the reviewed Android Node lock`);
    const nodeLock = Schema.decodeUnknownSync(NodeLock)(readJson(nodeLockFile));
    const androidNode = resolveNodeRuntime(runtime, nodeLock, abi);
    if (!existsSync(bundleFile) || !existsSync(bundleManifest)
        || Schema.decodeUnknownSync(BundlePin)(readJson(bundleManifest)).sourceCommit !== commit) {
      const sourceEdits = git(upstream, "status", "--porcelain", "--", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml",
        "packages/core", "packages/agent", "packages/os", "spec", "vibestack");
      if (sourceEdits) throw new Error("The Eliza device source has uncommitted changes");
      bundleAgent(commit, bundle);
    }
    stageRuntimePayload({
      runtime: androidNode, nodeLock,
      bundle: bundleFile, bundleManifest, sourceCommit: commit, targetAbi: abi, output,
    });
  }
  const manifest = path.join(path.dirname(inventory), "manifest.json");
  if (Schema.decodeUnknownSync(BundlePin)(readJson(manifest)).sourceCommit !== commit)
    throw new Error("The staged Android bundle belongs to another Eliza commit");
  return output;
}

function writeAgentData(directory: string, agentOrigin: string) {
  const host = Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.Unknown))(readJson(path.join(app, "android/agent.json")));
  writeJson(path.join(directory, "host.json"), { ...host, cloud: { baseUrl: agentOrigin, smallModel: policy.model, largeModel: policy.model } });
  writeJson(path.join(directory, "policy.json"), {
    schema: 1,
    actions: { allowed: policy.actions.upstream.allow, refused: policy.actions.upstream.refuse },
    plugins: { load: pluginLoad },
  });
}

function buildAndroid({ release = false, abi, cloudProfile = standaloneProfile, fixture }: {
  release?: boolean; abi: Abi; cloudProfile?: CloudProfile; fixture?: { output: string; resources: string };
}) {
  const selected = cloudProfiles[cloudProfile];
  const output = fixture?.output ?? apkOutput(cloudProfile);
  const project = cloudProfile === standaloneProfile ? androidPaths.project : `${output}/gradle`;
  const webDir = cloudProfile === standaloneProfile ? androidPaths.web : `${output}/web`;
  const agentDirectory = `${output}/agent`;
  const { version } = Schema.decodeUnknownSync(Schema.Struct({ version: Schema.String }))(readJson(path.join(app, "package.json")));
  writeAgentData(path.join(app, agentDirectory), selected.agentOrigin);
  generateAndroidConsumerHost({
    consumerRoot: app,
    upstreamRoot: upstream,
    dependencyRoot: realpathSync(path.dirname(createRequire(import.meta.url).resolve("@capacitor/android/package.json"))),
    output: path.join(app, project),
    identity: { appId: identity.appId, appName: identity.appName, version, versionCode: versionCode(version) },
    profile: {
      ...profile,
      modules: selected.sources === "shared-cloud"
        ? [...profile.modules, { name: "eliza-cloud-auth", source: { root: "upstream", path: "packages/auth/android" } }]
        : profile.modules,
      embeddedAgent: {
        ...profile.embeddedAgent,
        host: { root: "consumer", path: `${agentDirectory}/host.json` },
        policy: { root: "consumer", path: `${agentDirectory}/policy.json` },
      },
      manifestPlaceholders: { graceCloudCallbackHost: new URL(selected.webOrigin).hostname, graceCloudCallbackPath: selected.callbackPath },
      buildConfigFields: Object.entries({
        CLOUD_PROFILE: cloudProfile, CLOUD_API_ORIGIN: selected.apiOrigin,
        CLOUD_WEB_ORIGIN: selected.webOrigin, CLOUD_CALLBACK_PATH: selected.callbackPath,
      }).map(([name, value]) => ({ name, type: "String", value })),
      sourceSets: {
        ...profile.sourceSets,
        main: { ...profile.sourceSets.main, java: [...profile.sourceSets.main.java, { root: "consumer", path: `android/${selected.sources}/java` }] },
        ...(fixture ? { debug: { res: [{ root: "consumer", path: fixture.resources }] } } : {}),
      },
    },
    runtimeDirectory: agentRuntime(abi),
  });
  const userHome = path.join(app, project, "android-user");
  mkdirSync(userHome, { recursive: true });
  copyFileSync(path.join(app, "android/debug.keystore"), path.join(userHome, "debug.keystore"));
  if (!release && fixture === undefined) for (const flavor of flavors) for (const suffix of ["", "-unsigned"])
    rmSync(path.join(app, output, `${flavor}-release${suffix}.apk`), { force: true });
  buildAndroidConsumer({
    root: app,
    environment: {
      ...environment(), ANDROID_USER_HOME: userHome,
      GRACE_ANDROID_CAPACITOR_PROJECT: project, GRACE_ANDROID_CAPACITOR_WEB_DIR: webDir,
      VITE_GRACE_CLOUD_PROFILE: cloudProfile, VITE_GRACE_CLOUD_API_ORIGIN: selected.apiOrigin, VITE_GRACE_CLOUD_WEB_ORIGIN: selected.webOrigin,
    },
    variants: fixture ? ["standalone"] : flavors,
    release,
    lint: false,
    androidTest: false,
    daemon: true,
    project,
    output,
    signing: { environment: Object.values(signing) },
    prepare: [
      { command: "pnpm", args: ["run", "build", "--outDir", webDir] },
      { command: path.join(app, "node_modules/.bin/cap"), args: ["copy", "android"] },
    ],
    verify: { command: process.execPath, args: [import.meta.filename, "--cloud-profile", cloudProfile,
      ...(fixture ? ["--verify-billworld-run", path.basename(fixture.output)] : ["--verify"])] },
  });
}

type Syntax = { type: string; [key: string]: unknown };
const isSyntax = (value: unknown): value is Syntax => typeof value === "object" && value !== null && typeof Reflect.get(value, "type") === "string";
const actionName = (node: unknown) => isSyntax(node) && node.type === "Literal" && typeof node.value === "string" && /^[A-Z][A-Z0-9_]+$/.test(node.value) ? node.value : undefined;
const identifier = (node: unknown) => isSyntax(node) && node.type === "Identifier" ? String(node.name) : undefined;
const keyOf = (property: Syntax) => property.type === "Property" ? identifier(property.key) ?? (isSyntax(property.key) && property.key.type === "Literal" ? String(property.key.value) : undefined) : undefined;

function declaredActions(bundle: string) {
  const objects: Syntax[][] = [];
  const constants = new Map<string, string[] | null>();
  const pending: unknown[] = [parseAst(bundle)];
  while (pending.length) {
    const node = pending.pop();
    if (Array.isArray(node)) pending.push(...Array.from<unknown>(node));
    if (!isSyntax(node)) continue;
    if (node.type === "ObjectExpression") objects.push(Schema.decodeUnknownSync(Schema.Array(Schema.Unknown))(node.properties).filter(isSyntax));
    const [target, value] = node.type === "VariableDeclarator" ? [node.id, node.init] : node.type === "AssignmentExpression" ? [node.left, node.right] : [];
    const name = identifier(target);
    const literal = actionName(value);
    if (name && value) constants.set(name, literal && constants.get(name) !== null ? [...constants.get(name) ?? [], literal] : null);
    pending.push(...Object.values(node).filter((child) => typeof child === "object" && child !== null));
  }
  return new Set(objects.filter((properties) => properties.some((property) => ["similes", "handler", "validate"].includes(keyOf(property) ?? "")))
    .flatMap((properties) => {
      const name = properties.find((property) => keyOf(property) === "name")?.value;
      const literal = actionName(name);
      return literal ? [literal] : constants.get(identifier(name) ?? "") ?? [];
    }));
}

const checked = new Map<string, number>();
function checkPolicy(bundle: string) {
  const digest = createHash("sha256").update(bundle).digest("hex");
  const known = checked.get(digest);
  if (known !== undefined) return known;
  const declared = declaredActions(bundle);
  const { allow, refuse, plannerTools, refusedSubactionsOf } = policy.actions.upstream;
  const unlisted = [...declared].filter((name) => ![allow, refuse, plannerTools, policy.actions.grace].some((listed) => Object.hasOwn(listed, name))
    && !refusedSubactionsOf.some((umbrella) => name.startsWith(`${umbrella}_`))).sort();
  if (unlisted.length) throw new Error(`The agent registers actions agent/policy.json neither allows nor refuses: ${unlisted.join(", ")}`);
  checked.set(digest, declared.size);
  return declared.size;
}

function writeApkManifest(cloudProfile: CloudProfile, directory = path.join(app, apkOutput(cloudProfile)), episodeCertificate = false) {
  const apksigner = buildTool("apksigner");
  const aapt = buildTool("aapt");
  const selected = cloudProfiles[cloudProfile];
  const callbackHost = new URL(selected.webOrigin).hostname;
  const apks = readdirSync(directory).filter((name) => flavors.some((flavor) => name.startsWith(`${flavor}-`)) && name.endsWith(".apk"));
  if (!apks.length) throw new Error("No Grace APK was produced for verification");
  const manifest = apks.map((name) => {
    const file = path.join(directory, name);
    const contents = readFileSync(file);
    const entries = execFileSync(aapt, ["list", file], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).split("\n");
    if (entries.includes("res/raw/billworld_episode_ca.pem") !== episodeCertificate) {
      throw new Error(`${name} has the wrong certificate resources for this build`);
    }
    const agentHost = Schema.decodeUnknownSync(Schema.Struct({ cloud: Schema.Struct({ baseUrl: Schema.String }) }))(
      JSON.parse(execFileSync("unzip", ["-p", file, "assets/eliza-agent.json"], { encoding: "utf8" })),
    );
    if (agentHost.cloud.baseUrl !== selected.agentOrigin)
      throw new Error(`${name} has the wrong cloud origin for ${cloudProfile}`);
    const manifestXml = execFileSync(aapt, ["dump", "xmltree", file, "AndroidManifest.xml"], { encoding: "utf8" });
    const links = Array.from(manifestXml.matchAll(/^( *)E: intent-filter[^\n]*\n((?:\1  [^\n]*\n)+)/gm), ([, , filter]) => filter)
      .filter((filter) => filter.includes('"android.intent.category.BROWSABLE"'))
      .map((filter) => {
        const data = filter.split(/ E: data [^\n]*\n/);
        if (data.length !== 2 || !filter.includes('"android.intent.action.VIEW"') || !filter.includes("android:autoVerify(0x010104ee)=(type 0x12)0xffffffff"))
          throw new Error(`${name} has an unverified or ambiguous browser intent`);
        return Object.fromEntries(Array.from(data[1].matchAll(/A: android:(\w+)\(\w+\)="([^"]+)"/g), ([, key, value]) => [key, value]));
      });
    const expectedLinks = [selected.callbackPath, "/android/files/import"].map((route) => ({ scheme: "https", host: callbackHost, path: route }));
    if (links.length !== expectedLinks.length || !expectedLinks.every((expected) => links.some((link) => isDeepStrictEqual(link, expected))))
      throw new Error(`${name} must declare the selected account return and Files import links for ${selected.webOrigin}`);
    const forbidden = entries.filter((entry) => forbiddenEntry.test(entry));
    if (forbidden.length) throw new Error(`${name} carries an on-device model or local inference: ${forbidden.join(", ")}`);
    const abis = entries.flatMap((entry) => /^lib\/([^/]+)\/libeliza_node\.so$/.exec(entry)?.slice(1) ?? []);
    if (abis.length !== 1 || !entries.includes("assets/agent/inventory.json")) throw new Error(`${name} does not carry one agent runtime: libeliza_node.so for ${abis.join(", ") || "no processor type"}`);
    const inventory = Schema.decodeUnknownSync(Schema.Struct({
      schema: Schema.Literal(1),
      files: Schema.Array(Schema.Struct({
        path: Schema.String.check(Schema.isPattern(/^(assets\/agent\/|lib\/(arm64-v8a|x86_64)\/)[A-Za-z0-9_+./-]+$/)),
        size: Schema.Int.check(Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(512 * 1024 * 1024)),
        sha256: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
      })),
    }))(JSON.parse(execFileSync("unzip", ["-p", file, "assets/agent/inventory.json"], { encoding: "utf8" })));
    const listed = new Set(inventory.files.map((entry) => entry.path));
    if (listed.size !== inventory.files.length || !listed.has("assets/agent/agent.mjs")
        || !listed.has(`lib/${abis[0]}/libeliza_node.so`))
      throw new Error(`${name} does not list exactly its runtime files`);
    const unexpected = entries.filter((entry) => entry.startsWith("assets/agent/") && !entry.endsWith("/")
      && entry !== "assets/agent/inventory.json" && !listed.has(entry));
    if (unexpected.length) throw new Error(`${name} contains unlisted runtime files: ${unexpected.join(", ")}`);
    for (const entry of inventory.files) {
      if (entry.path.split("/").some((part) => part === "." || part === "..") || !entries.includes(entry.path))
        throw new Error(`${name} lacks its inventoried runtime file ${entry.path}`);
      const bytes = execFileSync("unzip", ["-p", file, entry.path], { maxBuffer: entry.size + 1 });
      if (bytes.length !== entry.size || createHash("sha256").update(bytes).digest("hex") !== entry.sha256)
        throw new Error(`${name} has a runtime file that differs from its inventory: ${entry.path}`);
    }
    const classes = Array.from(execFileSync(buildTool("dexdump"), [file], { encoding: "utf8", maxBuffer: 1024 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] })
      .matchAll(/^  Class descriptor  : '([^']+)'$/gm), ([, descriptor]) => descriptor);
    const inference = classes.filter((descriptor) => inferenceClass.test(descriptor));
    if (inference.length) throw new Error(`${name} carries local inference or voice model classes: ${inference.join(", ")}`);
    if (!classes.includes("Ltechnology/graceful/grace/GraceAccount;")) throw new Error(`${name} lacks the cloud speech bridge`);
    const actions = checkPolicy(execFileSync("unzip", ["-p", file, "assets/agent/agent.mjs"], { encoding: "utf8", maxBuffer: 1024 * 1024 * 1024 }));
    const debuggable = execFileSync(aapt, ["dump", "badging", file], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).includes("application-debuggable");
    if (name.includes("-release") && debuggable) throw new Error(`${name} is debuggable, so any computer on USB could read and drive Grace's page`);
    if (cloudProfile === "shared-staging" && !debuggable) throw new Error(`${name} ships staging in a production build`);
    process.stdout.write(`${name} ${abis[0]} ${contents.byteLength} bytes, ${debuggable ? "debuggable" : "not debuggable"}; ${classes.length} classes, the cloud speech bridge and no inference class; its ${actions} actions declared by name are each allowed or refused\n`);
    return { name, cloudProfile, abi: abis[0], bytes: contents.byteLength, debuggable, sha256: createHash("sha256").update(contents).digest("hex"),
      signer: name.endsWith("-unsigned.apk") ? null : Schema.decodeUnknownSync(Schema.String)(readApkSignerDigest(file, { apksigner })) };
  });
  writeFileSync(path.join(directory, "apk-manifest.json"), JSON.stringify(manifest, null, 2));
}

const sdk = (tool: string) => path.join(androidHome(), tool);
const run = promisify(execFile);
const stopping = new AbortController();
const adb = async (args: string[], seconds = 60) => {
  const signal = AbortSignal.any([stopping.signal, AbortSignal.timeout(seconds * 1000)]);
  const { stdout } = await run(sdk("platform-tools/adb"), args, { encoding: "utf8", signal, killSignal: "SIGKILL" })
    .catch((error: unknown) => { throw new Error(`adb ${args.join(" ")} failed or ran past ${seconds} s`, { cause: error }); });
  return stdout;
};
const shell = (serial: string, command: string, seconds?: number) => adb(["-s", serial, "shell", command], seconds);
const forever = new Promise<never>(() => {});
const emulators = async () => (await adb(["devices"])).split("\n").map((line) => line.split("\t")[0]).filter((serial) => /^emulator-\d+$/.test(serial));
const avds = () => execFileSync(sdk("emulator/emulator"), ["-list-avds"], { encoding: "utf8", timeout: 60_000 }).split("\n");

type Target = { serial: typeof EmulatorSerial.Type; exited: Promise<never>; stop: () => void };

const attached = (serial: typeof EmulatorSerial.Type): Target => ({ serial, exited: forever, stop: () => {} });
const exit = (child: ChildProcess, log: string) => new Promise<never>((_, reject) =>
  child.once("exit", (code) => reject(new Error(`The emulator exited with ${code} before it booted; see ${log}`))));

async function emulatorTarget(avd: string): Promise<Target> {
  const serials = await emulators();
  const names = await Promise.all(serials.map((serial) => adb(["-s", serial, "emu", "avd", "name"], 30).then((out) => out.split(/\r?\n/)[0], () => undefined)));
  const running = serials[names.indexOf(avd)];
  if (running) return attached(running);
  const port = Array.from({ length: 64 }, (_, i) => 5554 + 2 * i).find((p) => !serials.includes(`emulator-${p}`));
  if (port === undefined) throw new Error("Every emulator port from 5554 to 5680 is taken");
  const log = path.join(artifacts, `emulator-${avd}.log`);
  const output = openSync(log, "w");
  const flags = ["-gpu", "host", "-no-window", "-no-audio", "-no-boot-anim", "-no-snapshot-save"];
  const child = spawn(sdk("emulator/emulator"), ["-avd", avd, "-port", String(port), ...flags], { detached: true, stdio: ["ignore", output, output] });
  child.unref();
  return { serial: `emulator-${port}`, exited: exit(child, log), stop: () => spawnSync("kill", ["-TERM", "--", `-${child.pid}`], { stdio: "ignore" }) };
}

const Reply = Schema.Struct({ id: Schema.optional(Schema.Number), result: Schema.optional(Schema.Unknown), error: Schema.optional(Schema.Struct({ message: Schema.String })) });
const Nothing = Schema.Struct({});
const Evaluated = Schema.Struct({ result: Schema.Struct({ value: Schema.optional(Schema.Unknown) }) });
const Document = Schema.Struct({ root: Schema.Struct({ nodeId: Schema.Number }) });
const AXNode = Schema.Struct({ ignored: Schema.Boolean, role: Schema.optional(Schema.Struct({ value: Schema.Unknown })), name: Schema.optional(Schema.Struct({ value: Schema.String })), backendDOMNodeId: Schema.optional(Schema.Number) });
const AXNodes = Schema.Struct({ nodes: Schema.Array(AXNode) });
const Quads = Schema.Struct({ quads: Schema.Array(Schema.Tuple([Schema.Number, Schema.Number, Schema.Number, Schema.Number, Schema.Number, Schema.Number, Schema.Number, Schema.Number])) });
const SignInReport = Schema.Struct({
  status: Schema.Union([
    Schema.Struct({ kind: Schema.Literal("signedOut") }),
    Schema.Struct({ kind: Schema.Literal("signedIn"), voiceDisclosureScope: Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/)) }),
  ]),
  google: Schema.Boolean,
});
const selectedHome = `[...document.querySelectorAll("button[aria-current=true]:enabled")].some((control) => control.textContent.trim() === "Home")`;
type HomeControl = { label: string } | { text: string };
const HomePoint = Schema.NullOr(Schema.Struct({ x: Schema.Number, y: Schema.Number }));
const homeControlPoint = (controlName: HomeControl) => `(() => {
  const control = [...document.querySelectorAll("button:enabled")].find((button) =>
    ${"label" in controlName ? `button.getAttribute("aria-label") === ${JSON.stringify(controlName.label)}` : `button.textContent.trim() === ${JSON.stringify(controlName.text)}`});
  if (!control || control.closest("[inert]")) return null;
  const { left, top, width, height } = control.getBoundingClientRect();
  const x = left + width / 2, y = top + height / 2;
  return control.contains(document.elementFromPoint(x, y)) ? { x, y } : null;
})()`;
const Targets = Schema.Array(Schema.Struct({ id: Schema.NonEmptyString, type: Schema.String, url: Schema.String, webSocketDebuggerUrl: Schema.optional(Schema.String) }));
const MainFrame = Schema.Struct({ frameTree: Schema.Struct({ frame: Schema.Struct({ id: Schema.NonEmptyString, loaderId: Schema.NonEmptyString, url: Schema.NonEmptyString }) }) });
const GraceReadback = Schema.Struct({ address: Schema.NullOr(Schema.String), visible: Schema.NullOr(Schema.String) });

async function devTools(url: string, signal: AbortSignal, cloudProfile: CloudProfile = standaloneProfile) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve);
    socket.addEventListener("error", () => reject(new Error(`Could not open ${url}`)));
    signal.addEventListener("abort", () => reject(new Error(`Could not open ${url}`, { cause: signal.reason })));
  });
  const pending = new Map<number, { resolve: (result: unknown) => void; reject: (error: unknown) => void }>();
  const rejectAll = (error: Error) => { for (const waiter of pending.values()) waiter.reject(error); };
  socket.addEventListener("message", (message) => {
    let reply: typeof Reply.Type;
    try {
      reply = Schema.decodeUnknownSync(Reply)(JSON.parse(String(message.data)));
    } catch {
      return rejectAll(new Error("Grace's WebView sent an unreadable reply"));
    }
    const waiter = reply.id === undefined ? undefined : pending.get(reply.id);
    if (reply.error) waiter?.reject(new Error(reply.error.message));
    else waiter?.resolve(reply.result);
  });
  const closed = () => new Error("Grace's WebView closed its debugging socket");
  socket.addEventListener("close", () => rejectAll(closed()));
  let next = 0;
  type Call<S> = { method: string; params: object; schema: S; signal: AbortSignal };
  const send = async <S extends Schema.ConstraintDecoder<unknown>>({ method, params, schema, signal }: Call<S>): Promise<S["Type"]> => {
    signal.throwIfAborted();
    if (socket.readyState !== WebSocket.OPEN) throw closed();
    const id = next++;
    const abort = () => pending.get(id)?.reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    const result = await new Promise<unknown>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    }).finally(() => { pending.delete(id); signal.removeEventListener("abort", abort); });
    return Schema.decodeUnknownSync(schema)(result);
  };

  const until = async (expression: string, signal: AbortSignal) => {
    const frame = `new Promise((done) => requestAnimationFrame(() => { try { done(Boolean(${expression})); } catch { done(false); } }))`;
    for (;;) {
      const { result } = await send({ method: "Runtime.evaluate", params: { expression: frame, awaitPromise: true, returnByValue: true }, schema: Evaluated, signal })
        .catch((error: unknown) => { if (error instanceof Error && error.message.includes("context was destroyed")) return { result: { value: false } }; throw error; });
      if (result.value === true) return;
    }
  };

  const find = async (target: string | { homeCard: string }, signal: AbortSignal) => {
    const { root } = await send({ method: "DOM.getDocument", params: { depth: 0 }, schema: Document, signal });
    const query = typeof target === "string" ? { accessibleName: target } : { role: "button" };
    const { nodes } = await send({ method: "Accessibility.queryAXTree", params: { nodeId: root.nodeId, ...query }, schema: AXNodes, signal });
    const named = typeof target === "string" ? nodes : nodes.filter(({ name }) => name?.value === target.homeCard || name?.value.startsWith(target.homeCard + " "));
    const matches = named.flatMap((node) => !node.ignored && node.role?.value !== "StaticText" && node.backendDOMNodeId !== undefined ? [node.backendDOMNodeId] : []);
    if (matches.length > 1) throw new Error(`${matches.length} controls match ${JSON.stringify(target)}`);
    return matches[0];
  };

  const tap = async (target: string | { homeCard: string }, signal: AbortSignal) => {
    let node = await find(target, signal);
    while (node === undefined) {
      await until("true", signal);
      node = await find(target, signal);
    }
    await send({ method: "DOM.scrollIntoViewIfNeeded", params: { backendNodeId: node }, schema: Nothing, signal });
    const { quads: [quad] } = await send({ method: "DOM.getContentQuads", params: { backendNodeId: node }, schema: Quads, signal });
    if (!quad) throw new Error(`${JSON.stringify(target)} is not on screen`);
    const x = (quad[0] + quad[2] + quad[4] + quad[6]) / 4, y = (quad[1] + quad[3] + quad[5] + quad[7]) / 4;
    await tapAt({ x, y }, signal);
  };

  const tapAt = async ({ x, y }: NonNullable<typeof HomePoint.Type>, signal: AbortSignal) => {
    for (const type of ["mousePressed", "mouseReleased"]) {
      await send({ method: "Input.dispatchMouseEvent", params: { type, x, y, button: "left", clickCount: 1 }, schema: Nothing, signal });
    }
  };

  const waitForHomeControl = async (control: HomeControl, signal: AbortSignal) => {
    const expression = homeControlPoint(control);
    for (;;) {
      await until(expression, signal);
      const { result } = await send({ method: "Runtime.evaluate", params: { expression, returnByValue: true }, schema: Evaluated, signal });
      const point = Schema.decodeUnknownSync(HomePoint)(result.value);
      if (point !== null) return point;
    }
  };

  const describe = async () => {
    const expression = `(async () => JSON.stringify({ origin: location.origin, visibility: document.visibilityState, agent: await Capacitor.Plugins.EmbeddedAgent.getStatus().then(({state}) => state).catch(() => "unavailable") }))()`;
    const { result } = await send({ method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true }, schema: Evaluated, signal: AbortSignal.timeout(30_000) });
    return String(result.value);
  };

  return {
    until,
    describe,
    tapAt,
    waitForHomeControl,
    async mainFrame(signal: AbortSignal) {
      const { frameTree } = await send({ method: "Page.getFrameTree", params: {}, schema: MainFrame, signal });
      return frameTree.frame;
    },
    async guidance(signal: AbortSignal) {
      const expression = `document.querySelector('[data-benchmark-observable="true"]') ? ({ address: document.querySelector('input[aria-label="Address"]')?.value ?? null, visible: document.querySelector('[aria-label="Grace"]')?.innerText ?? null }) : null`;
      const { result } = await send({ method: "Runtime.evaluate", params: { expression, returnByValue: true }, schema: Evaluated, signal });
      const guidance = Schema.decodeUnknownSync(Schema.NullOr(GraceReadback))(result.value);
      if (guidance === null) throw new Error("The benchmark cannot observe this surface");
      return guidance;
    },
    async step(step: Exclude<InSession, OnDevice>, signal = AbortSignal.timeout("agent" in step ? 300_000 : 120_000)) {
      if ("agent" in step) {
        const expression = `new Promise((done) => { const agent = Capacitor.Plugins.EmbeddedAgent; const listening = agent.addListener("status", (status) => check(status)); const check = (status) => (status.state === "failed" || Object.entries(${JSON.stringify(step.agent)}).every(([key, value]) => status[key] === value)) && Promise.resolve(listening).then((listener) => listener.remove()).then(() => done({ state: status.state, failure: status.failure, error: status.error })); agent.getStatus().then(check); })`;
        const { result } = await send({ method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true }, schema: Evaluated, signal });
        const status = Schema.decodeUnknownSync(Schema.Struct({ ...AgentStatus.fields, error: Schema.optional(Schema.String) }))(result.value);
        if (status.state !== step.agent.state || status.failure !== step.agent.failure)
          throw new Error(`The agent is ${JSON.stringify(status)}, not ${JSON.stringify(step.agent)}`);
        return;
      }
      if ("evaluate" in step) {
        const expression = `Promise.resolve().then(() => (${step.evaluate})).then((value) => JSON.stringify({ returns: value ?? null }), (error) => JSON.stringify({ rejects: String(error?.code ?? error) }))`;
        const { result } = await send({ method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true }, schema: Evaluated, signal });
        const outcome: unknown = JSON.parse(String(result.value));
        const expected = "returns" in step ? { returns: step.returns } : { rejects: step.rejects };
        if (!isDeepStrictEqual(outcome, expected)) throw new Error(`${step.evaluate} gave ${JSON.stringify(outcome)}`);
        return;
      }
      if ("call" in step) {
        const [plugin, method] = step.call.split(".");
        const expression = `Capacitor.Plugins[${JSON.stringify(plugin)}][${JSON.stringify(method)}](${JSON.stringify(step.with ?? {})}).then((value) => ({ value: value ?? null }), (error) => ({ refused: String(error.message) }))`;
        const { result } = await send({ method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true }, schema: Evaluated, signal });
        const answer = Schema.decodeUnknownSync(Answer)(result.value);
        const expected = "returns" in step ? { value: step.returns } : { refused: step.refuses };
        if (!contains(answer, expected)) throw new Error(`${step.call} answered ${JSON.stringify(answer)}, not ${JSON.stringify(expected)}`);
        return;
      }
      if ("signIn" in step) {
        const selected = cloudProfiles[cloudProfile];
        const endpoint = new URL("/api/v1/app-auth/mobile/config", selected.apiOrigin);
        endpoint.search = new URLSearchParams({
          clientId: identity.appId, environment: selected.environment, redirectUri: selected.webOrigin + selected.callbackPath,
        }).toString();
        const expression = `(async () => {
          const { GraceAccount, CapacitorHttp } = Capacitor.Plugins;
          const status = await GraceAccount.status();
          const config = await CapacitorHttp.get({ url: ${JSON.stringify(endpoint.href)}, responseType: "json" });
          return { status, google: config.status === 200 ? config.data?.google?.nativeSignIn : undefined };
        })()`;
        const { result } = await send({ method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true }, schema: Evaluated, signal });
        if (/eliza_mobile_/.test(JSON.stringify(result.value))) throw new Error("A sign-in result carries an Eliza Cloud key");
        const report = Schema.decodeUnknownOption(SignInReport, { onExcessProperty: "error" })(result.value);
        if (report._tag === "None") throw new Error("The native account status or public sign-in configuration was unavailable or returned unexpected fields");
        const { status, google } = report.value;
        const found = { signedIn: status.kind === "signedIn", google };
        process.stdout.write(`sign-in status ${JSON.stringify(found)}\n`);
        if (found.signedIn !== step.signIn.signedIn || found.google !== step.signIn.google)
          throw new Error(`Sign-in is ${JSON.stringify(found)}, not ${JSON.stringify(step.signIn)}`);
        return;
      }
      if ("tap" in step) return await tap(step.tap, signal);
      if ("homeCard" in step) {
        await until(selectedHome, signal);
        return await tap(step, signal);
      }
      if ("into" in step) {
        await tap(step.into, signal);
        if (step.replace) {
          const select = { key: "a", code: "KeyA", windowsVirtualKeyCode: 65, modifiers: 2 };
          for (const type of ["rawKeyDown", "keyUp"]) await send({ method: "Input.dispatchKeyEvent", params: { type, ...select }, schema: Nothing, signal });
        }
        await send({ method: "Input.insertText", params: { text: step.type }, schema: Nothing, signal });
        return;
      }
      if ("press" in step) {
        const key = { key: step.press, code: step.press, windowsVirtualKeyCode: 13 };
        await send({ method: "Input.dispatchKeyEvent", params: { type: "keyDown", text: "\r", ...key }, schema: Nothing, signal });
        await send({ method: "Input.dispatchKeyEvent", params: { type: "keyUp", ...key }, schema: Nothing, signal });
        return;
      }
      return await until(`document.body.innerText.includes(${JSON.stringify(step.expect)})`, signal);
    },
    close: () => socket.close(),
  };
}

const contains = (actual: unknown, expected: unknown): boolean =>
  typeof expected === "object" && expected !== null && !Array.isArray(expected)
    ? typeof actual === "object" && actual !== null && Object.entries(expected).every(([key, value]) => contains(Reflect.get(actual, key), value))
    : JSON.stringify(actual) === JSON.stringify(expected);
const Answer = Schema.Union([Schema.Struct({ value: Schema.Unknown }), Schema.Struct({ refused: Schema.String })]);

const failing = (what: string) => (error: unknown) => { throw new Error(`${what} failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error }); };

function testOrigin(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !["127.0.0.1", "localhost", "10.0.2.2"].includes(parsed.hostname) || parsed.username || parsed.password)
    throw new Error("Benchmark sites must use synthetic HTTPS origins on the local test network");
  return parsed.origin;
}

async function runBenchmark({ input, receipt }: BenchmarkRun, page: Awaited<ReturnType<typeof devTools>>, listTargets: () => Promise<typeof Targets.Type>) {
  const origin = testOrigin(input.startUrl);
  const timeout = AbortSignal.timeout(180_000);
  const observations: Array<{ at: string; document: Awaited<ReturnType<typeof page.mainFrame>> & { targetId: string } }> = [];
  const transcripts: Array<{ at: string; text: string }> = [];
  const output = openSync(receipt, "wx", 0o600);
  let status: "operator-finished" | "timed-out" | "failed" = "failed";
  let failure: string | undefined;
  let requestAcceptedAt: string | undefined;
  let website: { targetId: string; page: Awaited<ReturnType<typeof devTools>> } | undefined;
  const observe = async () => {
    const guidance = await page.guidance(timeout);
    if (guidance.visible && transcripts.at(-1)?.text !== guidance.visible)
      transcripts.push({ at: new Date().toISOString(), text: guidance.visible });
    if (!guidance.address || !URL.canParse(guidance.address)) return;
    const address = new URL(guidance.address);
    if (address.origin !== origin) return;
    const targets = (await listTargets()).filter((target) => target.type === "page" && target.webSocketDebuggerUrl && URL.canParse(target.url) && new URL(target.url).origin === origin);
    const [target] = targets;
    if (targets.length > 1) throw new Error("Multiple test-origin WebViews prevent binding to the selected tab");
    if (!target?.webSocketDebuggerUrl) return;
    if (website?.targetId !== target.id) {
      website?.page.close();
      website = { targetId: target.id, page: await devTools(target.webSocketDebuggerUrl, timeout) };
    }
    const frame = await website.page.mainFrame(timeout);
    if (new URL(frame.url).origin !== origin || new URL(frame.url).href !== address.href) return;
    const document = { ...frame, targetId: target.id };
    const last = observations.at(-1);
    if (last?.document.targetId !== document.targetId || last.document.loaderId !== document.loaderId || last.document.url !== document.url)
      observations.push({ at: new Date().toISOString(), document });
  };
  try {
    if (!process.stdin.isTTY) throw new Error("A benchmark requires an interactive operator");
    await page.step({ tap: "Internet" }, timeout);
    await page.step({ type: input.startUrl, into: "Address" }, timeout);
    await page.step({ tap: "Go" }, timeout);
    while (!observations.length) {
      await observe();
      await page.until("true", timeout);
    }
    await page.step({ tap: "Ask Grace" }, timeout);
    await page.step({ type: input.intent, into: "Message to Grace" }, timeout);
    await page.step({ press: "Enter" }, timeout);
    const accepted = AbortSignal.any([timeout, AbortSignal.timeout(15_000)]);
    await page.until(`document.querySelector('[aria-label="Grace"]')?.innerText.includes(${JSON.stringify(input.intent)})`, accepted)
      .catch(failing("Waiting for Grace to accept the task into chat; the app needs a bound decision service"));
    requestAcceptedAt = new Date().toISOString();
    const operator = createInterface({ input: process.stdin, output: process.stdout });
    try {
      let finished = false;
      const finish = operator.question("Follow Grace in the emulator, then press Enter to record the result. ", { signal: timeout })
        .finally(() => { finished = true; });
      void finish.catch(() => undefined);
      while (!finished) {
        await observe();
        await page.until("true", timeout);
      }
      await finish;
    } finally {
      operator.close();
    }
    await observe();
    status = "operator-finished";
  } catch (error) {
    status = timeout.aborted ? "timed-out" : "failed";
    failure = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    website?.page.close();
    const first = observations[0]?.document;
    const since = requestAcceptedAt;
    const navigation = first && since ? observations.some(({ at, document }) => {
      const address = new URL(document.url);
      address.hash = "";
      const initial = new URL(first.url);
      initial.hash = "";
      return at >= since && document.loaderId !== first.loaderId && address.href !== initial.href;
    }) : false;
    try {
      writeFileSync(output, `${JSON.stringify({ surface: "android-webview", input, status, failure, requestAcceptedAt, navigation, observations, transcripts }, null, 2)}\n`);
    } finally {
      closeSync(output);
    }
  }
}

async function onDevice(serial: typeof EmulatorSerial.Type, pid: string, step: OnDevice) {
  if ("key" in step) {
    await shell(serial, `input keyevent KEYCODE_${step.key}`);
    return;
  }
  if ("service" in step) {
    const foreground = `dumpsys activity services ${identity.appId}/.${step.service} | grep -c isForeground=true`;
    await shell(serial, `until [ "$(${foreground})" -gt 0 ]; do sleep 1; done`, 120);
    return;
  }
  if ("grant" in step) {
    await shell(serial, `pm grant ${identity.appId} ${step.grant}`);
    return;
  }
  if ("forget" in step) {
    const saved = (await shell(serial, "cmd wifi list-networks")).split("\n").map((line) => /^(\d+)\s+(.+?)\s+\S+$/.exec(line.trim()));
    const id = saved.find((network) => network?.[2] === step.forget)?.[1];
    if (id === undefined) throw new Error(`${serial} has no saved Wi-Fi network named ${step.forget}`);
    await shell(serial, `cmd wifi forget-network ${id}`);
    return;
  }
  if ("approve" in step) {
    const screen = { serial, file: `/data/local/tmp/grace-approve-${randomUUID()}.xml`, signal: AbortSignal.timeout(200_000) };
    const button = await waitForUi(screen, (nodes) => nodes.find((node) => ["com.android.settings", "com.android.systemui"].includes(node.packageName) &&
      node.clickable && node.enabled && node.label === step.approve), `a ${step.approve} button`);
    await shell(serial, `input tap ${button.x} ${button.y}`);
    return;
  }
  if ("notification" in step) {
    await shell(serial, "am start -W -a android.settings.SETTINGS", 120);
    const posted = `dumpsys notification --noredact | grep -A60 "pkg=${identity.appId}" | grep -qF "android.title=String (${step.notification})"`;
    await shell(serial, `until ${posted}; do sleep 1; done`, 300);
    await shell(serial, `am start -W -n ${activity}`, 120);
    return;
  }
  await shell(serial, `am start -W -a ${step.leaveFor}`, 120);
  await shell(serial, `am kill ${identity.appId}`);
  const survivor = (await shell(serial, `pidof ${identity.appId}`).catch(() => "")).trim();
  if (survivor !== pid) throw new Error(`Grace's process ${pid} did not survive her activity being left for ${step.leaveFor}: "${survivor}"`);
  await shell(serial, `am start -W -n ${activity}`, 120);
}

async function installGrace(serial: typeof EmulatorSerial.Type, apk: string) {
  await adb(["-s", serial, "install", "-r", apk], 1800).catch(async (error: unknown) => {
    if (!(error instanceof Error && String(error.cause).includes("INSTALL_FAILED_UPDATE_INCOMPATIBLE"))) throw error;
    process.stdout.write(`${serial} holds Grace signed by another key; uninstalling her and her data\n`);
    await adb(["-s", serial, "uninstall", identity.appId], 120);
    await adb(["-s", serial, "install", apk], 1800);
  });
}

async function walk(serial: typeof EmulatorSerial.Type, exercise: ReadonlyArray<Step>, release: boolean, cloudProfile: CloudProfile, benchmark?: BenchmarkRun) {
  await installGrace(serial, path.join(app, apkOutput(cloudProfile), release ? "launcher-release.apk" : "launcher-debug.apk"));
  await shell(serial, `cmd package set-home-activity ${activity}`);
  const resolveHome = "cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME | tail -n 1";
  await shell(serial, `until [ "$(${resolveHome})" = ${activity} ]; do sleep 1; done`, 600)
    .catch(async (error: unknown) => failing(`Waiting for Home to resolve to Grace rather than ${(await shell(serial, resolveHome).catch(String)).trim()}`)(error));
  const webView = /Current WebView package \(name, version\): \((.*)\)/.exec(await shell(serial, "dumpsys webviewupdate"))?.[1];
  process.stdout.write(`${serial} ${webView ?? "WebView unknown"}\n`);
  let segment: InSession[] = [];
  const segments = [segment];
  for (const step of exercise) {
    if ("restart" in step) segments.push(segment = []);
    else segment.push(step);
  }
  for (const [index, steps] of segments.entries()) {
    if (index > 0) {
      await shell(serial, `am force-stop ${identity.appId}`);
      process.stdout.write(`${JSON.stringify({ restart: "force-stop" })} ok\n`);
    }
    await visit(serial, steps, release, cloudProfile, benchmark);
  }
}

async function visit(serial: typeof EmulatorSerial.Type, exercise: ReadonlyArray<InSession>, release: boolean, cloudProfile: CloudProfile, benchmark?: BenchmarkRun) {
  const started = await shell(serial, "am start -W -a android.intent.action.MAIN -c android.intent.category.HOME", 120);
  if (!started.includes(`Activity: ${activity}`)) throw new Error(`Grace is not Home on ${serial}:\n${started}`);
  if (release) {
    const running = (await shell(serial, `for i in $(seq 120); do pidof ${identity.appId} && exit; sleep 1; done`, 180)).trim();
    if (!/^\d+$/.test(running)) throw new Error(`Expected one process of Grace's release build on ${serial}, found "${running}"`);
    return;
  }
  const debuggable = `grep -q "webview_devtools_remote_$pid$" /proc/net/unix && echo "$pid" && exit`;
  const waitForPid = `for i in $(seq 120); do pid=$(pidof ${identity.appId}); case "$pid" in *" "*) echo "$pid"; exit;; "") ;; *) ${debuggable};; esac; sleep 1; done`;
  await withGracePage(serial, waitForPid, async (page, pid, listTargets) => {
    const showing = (what: string) => async (error: unknown) =>
      failing(`${what}${await page.describe().then((shown) => ` (the page shows ${shown})`, () => "")}`)(error);
    await page.until(selectedHome, AbortSignal.timeout(180_000)).catch(showing("Waiting for Home"));
    for (const step of exercise) {
      const description = "into" in step ? `Enter text in ${step.into}` : JSON.stringify(step);
      await (isOnDevice(step) ? onDevice(serial, pid, step) : page.step(step)).catch(showing(description));
      process.stdout.write(`${description} ok\n`);
    }
    if (benchmark) await runBenchmark(benchmark, page, listTargets);
  }, 180, cloudProfile);
}

async function withGracePage(serial: typeof EmulatorSerial.Type, waitForPid: string, run: (page: Awaited<ReturnType<typeof devTools>>, pid: string, listTargets: () => Promise<typeof Targets.Type>) => Promise<void>, socketTimeoutSeconds = 180, cloudProfile: CloudProfile = standaloneProfile) {
  const pid = (await shell(serial, waitForPid, socketTimeoutSeconds)).trim();
  if (!/^\d+$/.test(pid)) throw new Error(`Expected one process of Grace with a debuggable WebView on ${serial}, found "${pid}"`);
  const port = (await adb(["-s", serial, "forward", "tcp:0", `localabstract:webview_devtools_remote_${pid}`])).trim();
  try {
    const listTargets = async (signal = AbortSignal.timeout(120_000)) => Schema.decodeUnknownSync(Targets)(await fetch(`http://127.0.0.1:${port}/json`, { signal })
      .then((response) => response.json()).catch(failing("Listing Grace's WebView pages")));
    const ready = AbortSignal.timeout(120_000);
    let host: string | undefined;
    while (!host && !ready.aborted) {
      const targets = await listTargets(ready);
      host = targets.find((target) => target.type === "page" && URL.parse(target.url)?.origin === "https://localhost")?.webSocketDebuggerUrl;
      if (!host) await delay(250);
    }
    if (!host) throw new Error(`Grace's WebView is not debuggable on ${serial}`);
    const page = await devTools(host, AbortSignal.timeout(120_000), cloudProfile).catch(failing("Opening Grace's WebView debugging socket"));
    try {
      await run(page, pid, listTargets);
    } finally {
      page.close();
    }
  } finally {
    await adb(["-s", serial, "forward", "--remove", `tcp:${port}`]).catch((error: unknown) => process.stderr.write(`${String(error)}\n`));
  }
}

async function deliver({ serial, exited }: Target, exercise: ReadonlyArray<Step>, release: boolean, cloudProfile: CloudProfile, benchmark?: BenchmarkRun) {
  const booted = 'while [ "$(getprop sys.boot_completed)" != 1 ]; do sleep 1; done';
  await Promise.race([adb(["-s", serial, "wait-for-device", "shell", booted], 900), exited]).catch(failing("Waiting for the emulator to boot"));
  const installing = (await shell(serial, "date +%s")).trim();
  const anrs = async () => (await shell(serial, `logcat -d -b events -s am_anr -T ${installing}.000`))
    .split("\n").filter((line) => line.includes("am_anr"));
  const responding = (events: string[], cause?: unknown) => {
    const graces = events.filter((line) => line.includes(`,${identity.appId},`) || line.includes(`,${identity.appId}:`));
    if (graces.length) throw new Error(`Grace was not responding on ${serial}:\n${graces.join("\n")}`, { cause });
    return events.length;
  };
  await walk(serial, exercise, release, cloudProfile, benchmark).catch(async (error: unknown) => {
    responding(await anrs().catch(() => { throw error; }), error);
    throw error;
  });
  const others = responding(await anrs().catch(failing("Reading the am_anr events")));
  process.stdout.write(`${serial} Grace is Home and responding; other processes raised ${others} am_anr events since the install began\n`);
}

const LoginFixture = Schema.Struct({
  runId: Schema.String.check(Schema.isPattern(/^[0-9a-f-]{36}$/)),
  entryUrl: Schema.String,
  deviceTrust: Schema.Struct({
    caPath: Schema.String,
    billingOrigin: Schema.String,
    reversePorts: Schema.Array(Schema.Int.check(Schema.isBetween({ minimum: 1024, maximum: 65535 }))),
  }),
  login: Schema.Struct({ label: Schema.String, origin: Schema.String, username: Schema.String, password: Schema.String }),
});
const Grade = Schema.Struct({ grade: Schema.Struct({ success: Schema.Boolean }), paymentCount: Schema.Int });
class GradeFailure extends Error {}
const Callable = Schema.declare((value: unknown): value is (...args: unknown[]) => unknown => typeof value === "function");
const isEpisodeHost = Schema.is(Schema.Struct({ startPasswordLoginEpisode: Callable }));
const Episode = Schema.Struct({ grade: Callable, close: Callable });
const isEpisode = Schema.is(Episode);

function deviceNodes(xml: string) {
  return Array.from(xml.matchAll(/<node\b[^>]*>/g)).flatMap(([node]) => {
    const attr = (name: string) => new RegExp(` ${name}="([^"]*)"`).exec(node)?.[1] ?? "";
    const bounds = /^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/.exec(attr("bounds"));
    return bounds ? [{
      x: Math.round((Number(bounds[1]) + Number(bounds[3])) / 2),
      y: Math.round((Number(bounds[2]) + Number(bounds[4])) / 2),
      label: attr("text"), description: attr("content-desc"), id: attr("resource-id").split("/").at(-1),
      className: attr("class"), packageName: attr("package"), password: attr("password") === "true", focused: attr("focused") === "true",
      clickable: attr("clickable") === "true", enabled: attr("enabled") === "true",
    }] : [];
  });
}

type DeviceNode = ReturnType<typeof deviceNodes>[number];
const editorFixturePackage = "technology.graceful.fixture";
const editorFixtureRunner = `${editorFixturePackage}/.BillWorldPasswordEditor`;

function buildPasswordEditorFixture(directory: string, login: typeof LoginFixture.Type["login"], hostApk: string) {
  const work = path.join(directory, "native-editor-test");
  const assets = path.join(work, "assets");
  const classes = path.join(work, "classes");
  const sdkJar = sdk("platforms/android-36/android.jar");
  for (const folder of [work, assets, classes]) mkdirSync(folder, { mode: 0o700 });
  writeFileSync(path.join(assets, "synthetic-login.json"), JSON.stringify(login), { mode: 0o600 });
  const manifest = path.join(work, "AndroidManifest.xml");
  writeFileSync(manifest, `<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="${editorFixturePackage}"><uses-sdk android:minSdkVersion="29" android:targetSdkVersion="36"/><application android:testOnly="true" android:allowBackup="false"/><instrumentation android:name=".BillWorldPasswordEditor" android:targetPackage="${identity.appId}"/></manifest>`);
  const compile = (tool: string, args: string[]) => execFileSync(tool, args, { stdio: "ignore", timeout: 180_000 });
  compile(path.join(environment().JAVA_HOME, "bin/javac"), ["--release", "17", "-cp", sdkJar, "-d", classes,
    path.join(app, "test/device/BillWorldPasswordEditor.java")]);
  const compiled = path.join(classes, "technology/graceful/fixture/BillWorldPasswordEditor.class");
  compile(buildTool("d8"), ["--lib", sdkJar, "--min-api", "29", "--output", work, compiled]);
  const unsigned = path.join(work, "unsigned.apk");
  const aligned = path.join(work, "aligned.apk");
  const apk = path.join(work, "native-editor-test.apk");
  compile(buildTool("aapt2"), ["link", "-I", sdkJar, "--manifest", manifest, "-A", assets, "-o", unsigned]);
  compile("zip", ["-q", "-j", unsigned, path.join(work, "classes.dex")]);
  compile(buildTool("zipalign"), ["-f", "4", unsigned, aligned]);
  const apksigner = buildTool("apksigner");
  compile(apksigner, ["sign", "--ks", path.join(app, "android/debug.keystore"), "--ks-key-alias", "androiddebugkey",
    "--ks-pass", "pass:android", "--out", apk, aligned]);
  if (readApkSignerDigest(apk, { apksigner }) !== readApkSignerDigest(hostApk, { apksigner })) {
    throw new Error("The native editor fixture must have the same signer as the episode APK");
  }
  return apk;
}

function runPasswordEditorFixture(serial: string, signal: AbortSignal) {
  const child = spawn(sdk("platform-tools/adb"), ["-s", serial, "shell", "am", "instrument", "-w", "-r", editorFixtureRunner],
    { stdio: ["ignore", "pipe", "ignore"] });
  const output = createInterface({ input: child.stdout });
  const phases = new Set<string>();
  let exited = false;
  output.on("line", (line) => {
    const phase = /^INSTRUMENTATION_STATUS: fixtureStage=(ready|save-dispatched|failed)$/.exec(line)?.[1];
    if (phase) phases.add(phase);
  });
  child.once("error", () => { exited = true; });
  child.once("close", () => { exited = true; });
  return {
    stop: () => { output.close(); child.kill(); },
    async wait(phase: "ready" | "save-dispatched", seconds: number) {
      const deadline = AbortSignal.any([signal, AbortSignal.timeout(seconds * 1000)]);
      while (!phases.has(phase)) {
        deadline.throwIfAborted();
        if (exited || phases.has("failed")) throw new Error("The disposable native editor instrumentation stopped");
        await delay(250, undefined, { signal: deadline });
      }
    },
  };
}

function fullscreenTip(nodes: DeviceNode[]) {
  const system = nodes.filter((node) => node.packageName === "com.android.systemui");
  if (!system.some((node) => node.id === "immersive_cling_title") ||
      !system.some((node) => node.id === "immersive_cling_description")) return undefined;
  const buttons = system.filter((node) => node.id === "ok" && node.className === "android.widget.Button" && node.enabled && node.clickable);
  return buttons.length === 1 ? buttons[0] : undefined;
}

type DeviceScreen = { serial: typeof EmulatorSerial.Type; file: string; signal: AbortSignal };

async function deviceScreen({ serial, file, signal }: DeviceScreen) {
  signal.throwIfAborted();
  const redact = String.raw`s/(<node[^>]*[[:space:]]text=")[^"]*("[^>]*[[:space:]](class="android.widget.EditText"|password="true")[^>]*>)/\1\2/g; s/(<node[^>]*[[:space:]](class="android.widget.EditText"|password="true")[^>]*[[:space:]]text=")[^"]*("[^>]*>)/\1\3/g`;
  const xml = await shell(serial, `umask 077; trap 'rm -f ${file}' EXIT; trap 'exit 1' HUP INT TERM; rm -f ${file} && uiautomator dump ${file} >/dev/null && sed -E '${redact}' ${file}`, 75);
  return deviceNodes(xml);
}

async function waitForUi<Found>(screen: DeviceScreen, select: (nodes: DeviceNode[]) => Found | undefined, label: string) {
  const until = Date.now() + 180_000;
  while (Date.now() < until) {
    screen.signal.throwIfAborted();
    const nodes = await deviceScreen(screen).catch(() => []);
    screen.signal.throwIfAborted();
    const fullscreen = fullscreenTip(nodes);
    const androidWait = nodes.find((node) => node.id === "aerr_wait" && node.label === "Wait" &&
      (node.packageName === "android" || node.packageName === "com.android.systemui"));
    const systemAction = fullscreen ?? androidWait;
    if (systemAction) {
      await shell(screen.serial, `input tap ${systemAction.x} ${systemAction.y}`);
      process.stdout.write(fullscreen ? "Acknowledged Android’s first-use fullscreen tutorial.\n" : "Android requested more time.\n");
    } else {
      const found = select(nodes);
      if (found !== undefined) return found;
    }
    await delay(1000);
  }
  throw new Error(`Android did not show ${label}`);
}

async function billworldPasswords(serial: typeof EmulatorSerial.Type, checkout: string, abi: Abi, signal: AbortSignal) {
  const installedApk = async (packageName = identity.appId) => {
    const packages = (await shell(serial, `cmd package list packages -f ${packageName}`)).trim();
    if (!packages) return undefined;
    const entry = packages.split("\n").find((line) => line.endsWith(`=${packageName}`));
    if (!entry) throw new Error("Unexpected Android package state");
    const file = entry.slice("package:".length, -packageName.length - 1);
    if (!entry.startsWith("package:") || !/^\/data\/app\/[A-Za-z0-9_~+=/.-]+\/base\.apk$/.test(file)) throw new Error("Unexpected installed APK path");
    const result = (await shell(serial, `sha256sum '${file}'`, 120)).split(/\s/)[0];
    if (!result || !/^[0-9a-f]{64}$/.test(result)) throw new Error("Android could not identify the installed APK");
    return result;
  };
  if ((await shell(serial, "getprop ro.kernel.qemu")).trim() !== "1" ||
      await installedApk() !== undefined || await installedApk(editorFixturePackage) !== undefined) {
    throw new Error("BillWorld requires an emulator with no existing Grace installation");
  }
  const requireNoScreenLock = async () => {
    const result = (await shell(serial, "locksettings verify", 180)).trim();
    if (!/^(?:lock )?credential verified successfully\.?$|^no (?:lock )?credential (?:is )?set\.?$/i.test(result)) {
      throw new Error("BillWorld requires a disposable emulator with no Android screen lock");
    }
  };
  await requireNoScreenLock();
  const fixture: unknown = await import(pathToFileURL(path.resolve(checkout, "billworld/integration/https-episode-host.mjs")).href);
  if (!isEpisodeHost(fixture)) throw new Error("BillWorld password fixture is unavailable");
  const cleanup: Array<() => void | Promise<unknown>> = [];
  let buildFailure: Error | undefined;
  const screenFile = `/data/local/tmp/grace-billworld-ui-${randomUUID()}.xml`;
  const waitForNode = (matches: (node: DeviceNode) => boolean, label: string) => waitForUi({ serial, file: screenFile, signal }, (nodes) => nodes.find(matches), label);
  const tapNode = ({ x, y }: DeviceNode) => shell(serial, `input tap ${x} ${y}`);
  const tap = async (matches: (node: DeviceNode) => boolean, label: string) => tapNode(await waitForNode(matches, label));
  let episode: typeof Episode.Type | undefined;
  let step = "open fixture";
  let journeyFailure: Error | undefined;
  try {
    const started = await fixture.startPasswordLoginEpisode({
      provision: async (input: unknown) => {
        signal.throwIfAborted();
        const { runId, login, entryUrl, deviceTrust } = Schema.decodeUnknownSync(LoginFixture)(input);
        const entry = new URL(entryUrl);
        const origin = new URL(login.origin);
        if (origin.protocol !== "https:" || !["localhost", "127.0.0.1"].includes(origin.hostname) ||
            entry.origin !== origin.origin || deviceTrust.billingOrigin !== origin.origin || entry.username || entry.password ||
            !deviceTrust.reversePorts.includes(Number(origin.port))) throw new Error("Untrusted fixture address");
        step = "build debug APK with an episode CA";
        const output = `artifacts/billworld-passwords/${runId}`;
        const resources = `${output}/res`;
        mkdirSync(path.join(app, resources, "raw"), { recursive: true, mode: 0o700 });
        mkdirSync(path.join(app, resources, "xml"), { recursive: true });
        cleanup.push(() => rm(path.join(app, output), { recursive: true, force: true }));
        copyFileSync(deviceTrust.caPath, path.join(app, resources, "raw/billworld_episode_ca.pem"));
        writeFileSync(path.join(app, resources, "xml/network_security.xml"),
          '<network-security-config><base-config cleartextTrafficPermitted="false"/><domain-config cleartextTrafficPermitted="false"><domain>localhost</domain><domain>127.0.0.1</domain><trust-anchors><certificates src="@raw/billworld_episode_ca"/></trust-anchors></domain-config></network-security-config>');
        try {
          buildAndroid({ abi, fixture: { output, resources } });
        } catch (error) {
          buildFailure = error instanceof Error ? error : new Error("Could not build the fixture APK");
          throw buildFailure;
        }
        step = "build the signed native editor instrumentation";
        const apk = path.join(app, output, "standalone-debug.apk");
        const editorApk = buildPasswordEditorFixture(path.join(app, output), login, apk);
        signal.throwIfAborted();
        step = "install the test APK and transport";
        for (const port of deviceTrust.reversePorts) {
          await adb(["-s", serial, "reverse", "--no-rebind", `tcp:${port}`, `tcp:${port}`]);
          cleanup.push(() => adb(["-s", serial, "reverse", "--remove", `tcp:${port}`]));
        }
        step = "install the episode-specific signed APK";
        const digest = createHash("sha256").update(readFileSync(apk)).digest("hex");
        const remote = `/data/local/tmp/grace-billworld-${runId}.apk`;
        cleanup.push(() => shell(serial, `rm -f ${remote}`));
        await adb(["-s", serial, "push", apk, remote], 180);
        cleanup.push(async () => {
          const installed = await installedApk();
          if (!installed) return;
          if (installed !== digest) throw new Error("The installed app changed during the episode");
          await adb(["-s", serial, "uninstall", identity.appId], 180);
          if (await installedApk() !== undefined) throw new Error("The disposable Grace app remains installed");
        });
        await shell(serial, `pm install -t ${remote}`, 300).catch(() => undefined);
        if (await installedApk() !== digest) throw new Error("Android did not install the episode APK");
        cleanup.push(() => shell(serial, `rm -f ${screenFile}`));
        step = "select Grace as the disposable autofill provider";
        const autofill = `${identity.appId}/ai.eliza.plugins.passwords.ElizaPasswordAutofillService`;
        const previous = (await shell(serial, "settings get secure autofill_service")).trim();
        const noProvider = previous === "null" || previous === "";
        if (!noProvider && !/^[a-zA-Z0-9_.]+\/[a-zA-Z0-9_.]+$/.test(previous)) throw new Error("Unknown Android autofill state");
        const logLevel = (await shell(serial, "cmd autofill get log_level")).trim();
        if (!["off", "debug", "verbose"].includes(logLevel)) throw new Error("Unknown Android autofill log level");
        await shell(serial, "cmd autofill set log_level off");
        cleanup.push(() => shell(serial, `cmd autofill set log_level ${logLevel}`));
        await shell(serial, `settings put secure autofill_service ${autofill}`);
        cleanup.push(() => shell(serial, noProvider ? "settings delete secure autofill_service" : `settings put secure autofill_service ${previous}`));
        if ((await shell(serial, "settings get secure autofill_service")).trim() !== autofill) throw new Error("Android did not select Grace Passwords");
        step = "install the owned native editor instrumentation";
        const editorDigest = createHash("sha256").update(readFileSync(editorApk)).digest("hex");
        cleanup.push(async () => {
          const installed = await installedApk(editorFixturePackage);
          if (installed === undefined) return;
          if (installed !== editorDigest) throw new Error("The native editor test package changed during the episode");
          await adb(["-s", serial, "uninstall", editorFixturePackage], 180);
          if (await installedApk(editorFixturePackage) !== undefined) throw new Error("The native editor test package remains installed");
        });
        await adb(["-s", serial, "install", "-t", editorApk], 420);
        if (await installedApk(editorFixturePackage) !== editorDigest) throw new Error("Android did not install the native editor test package");
        step = "start the owned native editor instrumentation";
        const editor = runPasswordEditorFixture(serial, signal);
        cleanup.push(editor.stop);
        await editor.wait("ready", 480);
        step = "start the Grace tablet app";
        const started = await shell(serial, `am start -n ${activity}`, 120);
        if (!started.startsWith("Starting: Intent {") || !started.includes(`cmp=${activity}`)) throw new Error("Android did not dispatch Grace");
        step = "wait for Grace’s native WebView socket";
        const waitForPid = `for i in $(seq 840); do pid=$(pidof ${identity.appId}); grep -q "webview_devtools_remote_$pid$" /proc/net/unix && echo "$pid" && exit; sleep 1; done`;
        signal.throwIfAborted();
        await withGracePage(serial, waitForPid, async (page) => {
          signal.throwIfAborted();
          step = "wait for interactive Grace Home";
          await page.until(selectedHome, AbortSignal.any([signal, AbortSignal.timeout(420_000)]));
          await waitForNode((node) => node.packageName === identity.appId, "the foreground Grace app");
          process.stdout.write("The installed Grace Home is ready.\n");
          step = "wait for the Page 3 control on Grace Home";
          const page3 = await page.waitForHomeControl({ label: "Page 3" }, AbortSignal.timeout(120_000));
          step = "tap Page 3 on Grace Home";
          await page.tapAt(page3, AbortSignal.timeout(120_000));
          step = "wait for the Passwords card on Grace Home";
          const passwords = await page.waitForHomeControl({ text: "Passwords" }, AbortSignal.timeout(120_000));
          process.stdout.write("The Passwords card is ready on the third Grace Home page.\n");
          step = "open Passwords from the third Grace Home page";
          await page.tapAt(passwords, AbortSignal.timeout(120_000));
          step = "check that cloud recovery requires a device credential";
          await page.step({ call: "GraceAccount.showPasswordRecovery", refuses: "Password recovery is unavailable" });
          step = "open the native password editor without a screen lock";
          await page.step({ tap: "Add password" });
          step = "save through the focused native editor";
          await editor.wait("save-dispatched", 90);
          step = "confirm the saved password in Grace";
          await page.step({ expect: "Password saved." });
          process.stdout.write("The installed native password editor saved the synthetic sign-in.\n");
          step = "open the private HTTPS browser";
          await page.step({ tap: "Close Passwords" });
          await page.step({ tap: "Internet" });
          await page.step({ type: origin.origin, into: "Address" });
          await page.step({ press: "Enter" });
          step = "ask Grace to open the site’s private sign-in";
          await page.step({ tap: "Ask Grace" });
          await page.step({ type: "sign me in to pay my bill", into: "Message to Grace" });
          await page.step({ tap: "Send" });
          step = "open the episode using the private address control";
          await page.step({ type: entry.href, into: "Private website address", replace: true });
          await page.step({ press: "Enter" });
        }, 900);
        step = "request Android autofill and choose the matching entry";
        await tap((node) => node.password && node.className === "android.widget.EditText", "the website password field");
        await tap((node) => node.label === "Fill with a saved password", "Android's fill offer");
        await tap((node) => node.packageName === identity.appId && node.label.includes(login.label), "the matching sign-in");
      },
    });
    if (!isEpisode(started)) throw new Error("The fixture did not start");
    episode = started;
    const readGrade = async () => Schema.decodeUnknownSync(Grade)(await started.grade());
    step = "verify Android still has no screen lock";
    await requireNoScreenLock();
    step = "grade the autofilled form";
    const before = await readGrade();
    if (before.grade.success || before.paymentCount !== 0) throw new GradeFailure("Autofill must not submit or pay");
    step = "submit the website form and grade";
    await tap((node) => /^(sign\s*in|log\s*in)$/i.test(node.label) && node.className === "android.widget.Button", "the website sign-in button");
    const until = Date.now() + 45_000;
    for (;;) {
      signal.throwIfAborted();
      if (Date.now() >= until) throw new GradeFailure("BillWorld did not confirm the account view");
      const after = await readGrade();
      if (after.paymentCount !== 0) throw new GradeFailure("The sign-in run encountered a payment");
      if (after.grade.success) break;
      await delay(1000);
    }
  } catch (error) {
    journeyFailure = buildFailure ?? (error instanceof GradeFailure ? error : new Error(`BillWorld password journey ${signal.aborted ? "was interrupted" : "stopped"} at: ${step}`));
  }
  const failures: unknown[] = [];
  for (const release of cleanup.reverse()) {
    try { await release(); } catch (error) { failures.push(error); }
  }
  try { await requireNoScreenLock(); } catch (error) { failures.push(error); }
  const unclean = failures.length > 0;
  try { await episode?.close(); } catch (error) { failures.push(error); }
  if (failures.length) throw new AggregateError(failures, unclean ? "BillWorld fixture cleanup could not be verified. Keep this disposable emulator out of use." : "The BillWorld episode did not close. The emulator's cleanup was verified.", { cause: journeyFailure });
  if (journeyFailure) throw journeyFailure;
}

if (import.meta.main) {
  const options = parseArgs({ options: { "cloud-profile": { type: "string" }, release: { type: "boolean" }, verify: { type: "boolean" }, abi: { type: "string" }, install: { type: "string" }, emulator: { type: "string" }, exercise: { type: "string" }, "billworld-passwords": { type: "string" }, "verify-billworld-run": { type: "string" }, benchmark: { type: "string" }, receipt: { type: "string" } } }).values;
  const { "cloud-profile": cloudProfile = standaloneProfile, verify, release = false, abi = "arm64-v8a", install, emulator, exercise, "billworld-passwords": billworld, "verify-billworld-run": fixtureRun, benchmark, receipt } = Schema.decodeUnknownSync(Arguments)(options);
  if (cloudProfile === "shared-staging" && release) throw new Error("Shared Eliza Cloud staging is only available in debug APKs");
  if (install && emulator) throw new Error("Give --install <emulator serial> or --emulator <avd>, not both");
  if (exercise && !install && !emulator) throw new Error("--exercise needs --install <emulator serial> or --emulator <avd>");
  if ((benchmark || receipt) && (!benchmark || !receipt || (!install && !emulator) || exercise || verify || release))
    throw new Error("--benchmark <input> and --receipt <new-file> require an emulator and run without --exercise, --verify or --release");
  if (exercise && release) throw new Error("--exercise drives Grace's page over its debugging socket, which a release build does not open; walk the debug build");
  if (release && (install || emulator) && !Object.values(signing).every((name) => process.env[name]?.trim()))
    throw new Error(`An unsigned release APK cannot be installed; set ${Object.values(signing).join(", ")}`);
  if (install && !(await emulators()).includes(install)) throw new Error(`No emulator ${install} is attached`);
  if (emulator && !avds().includes(emulator)) throw new Error(`No AVD named ${emulator}`);
  const steps = exercise ? Schema.decodeUnknownSync(Schema.NonEmptyArray(Step), { onExcessProperty: "error" })(readJson(path.join(app, "test/device", `${exercise}.json`))) : [];
  const trial = benchmark && receipt ? { input: Schema.decodeUnknownSync(Benchmark, { onExcessProperty: "error" })(readJson(benchmark)), receipt } : undefined;
  if (trial) {
    testOrigin(trial.input.startUrl);
    if (existsSync(trial.receipt)) throw new Error("Benchmark receipt already exists");
  }
  if (billworld !== undefined) {
    if (verify || release || install || exercise || benchmark || receipt || fixtureRun || cloudProfile !== standaloneProfile || !emulator?.startsWith("grace-billworld-")) {
      throw new Error("Use --billworld-passwords CHECKOUT with --emulator grace-billworld-… on a disposable standalone-production AVD");
    }
    mkdirSync(artifacts, { recursive: true });
    const target = await emulatorTarget(emulator);
    const interrupt = new AbortController();
    const cancel = () => interrupt.abort();
    process.on("SIGINT", cancel);
    process.on("SIGTERM", cancel);
    try {
      await Promise.race([adb(["-s", target.serial, "wait-for-device", "shell", 'while [ "$(getprop sys.boot_completed)" != 1 ]; do sleep 1; done'], 600), target.exited]);
      interrupt.signal.throwIfAborted();
      await billworldPasswords(target.serial, billworld, abi, interrupt.signal);
      interrupt.signal.throwIfAborted();
      process.stdout.write("BillWorld sign-in passed through installed Android Autofill without a screen lock. No payment was made.\n");
    } finally {
      process.off("SIGINT", cancel);
      process.off("SIGTERM", cancel);
      target.stop();
    }
  } else if (fixtureRun) writeApkManifest(cloudProfile, path.join(artifacts, "billworld-passwords", fixtureRun), true);
  else if (verify) writeApkManifest(cloudProfile);
  else {
    buildAndroid({ release, abi, cloudProfile });
    const target = install ? attached(install) : emulator && await emulatorTarget(emulator);
    if (target) {
      process.once("exit", (code) => { stopping.abort(); if (code) target.stop(); });
      for (const [signal, code] of [["SIGINT", 130], ["SIGTERM", 143]] as const) process.once(signal, () => process.exit(code));
      await deliver(target, steps, release, cloudProfile, trial);
    }
  }
}

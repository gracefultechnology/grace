import { createHash } from "node:crypto";
import { type ChildProcess, execFile, execFileSync, spawn, spawnSync } from "node:child_process";
import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { parseArgs, promisify } from "node:util";
import { Schema } from "effect";
import { parseAst } from "vite";
import { buildConsumerAndroidRuntime } from "../../../vendor/eliza/packages/app/scripts/lib/consumer-android-runtime.mjs";
import { stageAndroidRuntimeInventory } from "../../../vendor/eliza/plugins/plugin-native-agent/native-host/android-runtime-inventory.mjs";
import { buildAndroidConsumer } from "../../../vendor/eliza/packages/app/scripts/mobile/android/build-consumer.mjs";
import { generateAndroidConsumerHost } from "../../../vendor/eliza/packages/app/scripts/mobile/android/consumer-host.mjs";
import { readApkSignerDigest } from "../../../vendor/eliza/packages/app/scripts/mobile/artifact-inspection/apk-distribution.mjs";
import { resolveAndroidSdkRoot, resolveJavaHome } from "../../../vendor/eliza/packages/app/scripts/mobile/toolchain.ts";
import config from "../capacitor.config.ts";

const app = path.resolve(import.meta.dirname, "..");
const upstream = path.resolve(app, "../../vendor/eliza");
const artifacts = path.join(app, "artifacts");
const flavors = ["launcher", "standalone"];
export const identity = Schema.decodeUnknownSync(
  Schema.Struct({ appId: Schema.String, appName: Schema.String, android: Schema.Struct({ path: Schema.String }) }),
)(config);
const activity = `${identity.appId}/.MainActivity`;
const project = identity.android.path;
const forbiddenEntry = new RegExp([
  String.raw`\.(gguf|onnx|ort|tflite|safetensors|pte|task)$`,
  String.raw`(^|/)(lib[^/]*(llama|ggml|mtmd|onnxruntime|sherpa|whisper|piper|executorch|elizainference|omnivoice)[^/]*\.so(\.\d[^/]*)?|llama(-omnivoice)?-server)$`,
  String.raw`^assets/(?!public/)([^/]+/)*(tts|asr|models?)/`,
].join("|"), "i");

const readJson = (file: string): unknown => JSON.parse(readFileSync(file, "utf8"));
const writeJson = (file: string, value: unknown) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
};
const profile = readJson(path.join(app, "android/host.json"));
const { signing } = Schema.decodeUnknownSync(Schema.Struct({ signing: Schema.Record(Schema.String, Schema.String) }))(profile);
const keystore = signing.storeFile;

const Reasons = Schema.Record(Schema.String, Schema.String);
const Policy = Schema.Struct({
  model: Schema.NonEmptyString,
  plugins: Schema.Struct({ refuse: Reasons }),
  actions: Schema.Struct({
    grace: Schema.Record(Schema.String, Schema.Unknown),
    upstream: Schema.Struct({ allow: Reasons, refuse: Reasons, plannerTools: Reasons, refusedSubactionsOf: Schema.Array(Schema.String) }),
  }),
});
const policy = Schema.decodeUnknownSync(Policy)(readJson(path.join(app, "agent/policy.json")));
const stubPlugins = [
  "@elizaos/plugin-browser", "@elizaos/plugin-calendar", "@elizaos/plugin-discord", "@elizaos/plugin-google-workspace",
  "@elizaos/plugin-inbox", "@elizaos/plugin-knowledge", "@elizaos/plugin-local-inference", "@elizaos/plugin-maps",
  "@elizaos/plugin-notes", "@elizaos/plugin-personal-assistant", "@elizaos/plugin-vision",
  "@pixiv/three-vrm", "discord.js", "google-auth-library", "googleapis", "three",
];
const unrefused = stubPlugins.filter((name) => name.startsWith("@elizaos/plugin-") && !Object.hasOwn(policy.plugins.refuse, name));
if (unrefused.length) throw new Error(`The agent payload leaves out ${unrefused.join(", ")}, which agent/policy.json does not refuse`);

const Abi = Schema.Literals(["arm64-v8a", "x86_64"]);
type Abi = typeof Abi.Type;
const EmulatorSerial = Schema.String.check(Schema.isPattern(/^emulator-\d+$/));
const AgentStatus = Schema.Struct({
  state: Schema.Literals(["unavailable", "stopped", "starting", "running", "failed"]),
  failure: Schema.optional(Schema.Literals(["payload", "storage", "config", "credential", "agent", "crashed", "runtime"])),
});
const Step = Schema.Union([
  Schema.Struct({ tap: Schema.NonEmptyString }),
  Schema.Struct({ type: Schema.String, into: Schema.NonEmptyString, replace: Schema.optional(Schema.Boolean) }),
  Schema.Struct({ press: Schema.Literal("Enter") }),
  Schema.Struct({ expect: Schema.NonEmptyString }),
  Schema.Struct({ agent: AgentStatus }),
  Schema.Struct({ signIn: Schema.Struct({ signedIn: Schema.Boolean, google: Schema.Boolean }) }),
  Schema.Struct({ service: Schema.String.check(Schema.isPattern(/^[A-Z]\w*$/)) }),
  Schema.Struct({ leaveFor: Schema.String.check(Schema.isPattern(/^android\.settings\.[A-Z_]+$/)) }),
]);
type Step = typeof Step.Type;
type OnDevice = Extract<Step, { service: string } | { leaveFor: string }>;
const Benchmark = Schema.Struct({
  taskId: Schema.NonEmptyString,
  intent: Schema.NonEmptyString,
  startUrl: Schema.NonEmptyString,
});
type Benchmark = typeof Benchmark.Type;
type BenchmarkRun = { input: Benchmark; receipt: string };
const Arguments = Schema.Struct({
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

export function buildTool(name: string): string {
  const tools = path.join(resolveAndroidSdkRoot(), "build-tools");
  const [newest] = readdirSync(tools).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  return path.join(tools, newest, name);
}

const environment = () => ({
  ...process.env,
  ANDROID_HOME: resolveAndroidSdkRoot(),
  JAVA_HOME: resolveJavaHome(),
  ...(process.env[keystore]?.trim() ? { [keystore]: path.resolve(process.env.INIT_CWD ?? process.cwd(), process.env[keystore]) } : {}),
});

const versionCode = (version: string) => {
  const parts = /^(\d+)\.(\d{1,3})\.(\d{1,3})$/.exec(version);
  if (!parts) throw new Error(`package.json version ${version} is not MAJOR.MINOR.PATCH below 1000`);
  return Number(parts[1]) * 1e6 + Number(parts[2]) * 1e3 + Number(parts[3]);
};

function agentRuntime(abi: Abi) {
  const commit = execFileSync("git", ["-C", upstream, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const key = createHash("sha256").update(JSON.stringify({ commit, abi, stubPlugins })).digest("hex").slice(0, 16);
  const payload = path.join(artifacts, "agent-runtime", `${abi}-${key}`);
  if (existsSync(payload)) return payload;
  const building = `${payload}.building-${process.pid}`;
  const skills = path.join(building, "skills");
  mkdirSync(skills, { recursive: true });
  try {
    const { output } = buildConsumerAndroidRuntime({
      source: upstream, expectedCommit: commit, output: path.join(building, "payload"), skillsDirectory: skills,
      stageGateway: () => ({}), targetAbi: abi, stubPlugins, embeddingModel: false,
    });
    const main = path.join(output, "android/app/src/main");
    stageAndroidRuntimeInventory({ assetsDirectory: path.join(main, "assets"), nativeLibraryDirectory: path.join(main, "jniLibs", abi), excludedAgentDirectories: [abi], targetAbi: abi, gateway: false });
    renameSync(output, payload);
    return payload;
  } finally {
    rmSync(building, { recursive: true, force: true });
  }
}

function writeAgentData() {
  const host = Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.Unknown))(readJson(path.join(app, "android/agent.json")));
  const { cloud } = Schema.decodeUnknownSync(Schema.Struct({ cloud: Schema.Struct({ baseUrl: Schema.String }) }))(host);
  writeJson(path.join(artifacts, "agent/host.json"), { ...host, cloud: { ...cloud, smallModel: policy.model, largeModel: policy.model } });
  writeJson(path.join(artifacts, "agent/policy.json"), {
    schema: 1,
    actions: { allowed: policy.actions.upstream.allow, refused: policy.actions.upstream.refuse },
    plugins: { denied: Object.keys(policy.plugins.refuse) },
  });
}

function buildAndroid({ release = false, abi, fixture }: { release?: boolean; abi: Abi; fixture?: { output: string; resources: string } }) {
  const { version } = Schema.decodeUnknownSync(Schema.Struct({ version: Schema.String }))(readJson(path.join(app, "package.json")));
  writeAgentData();
  const authored = Schema.decodeUnknownSync(Schema.Struct({ sourceSets: Schema.Record(Schema.String, Schema.Unknown) }))(profile);
  const hostProfile = fixture ? {
    ...Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.Unknown))(profile),
    sourceSets: { ...authored.sourceSets, debug: { res: [{ root: "consumer", path: fixture.resources }] } },
  } : profile;
  generateAndroidConsumerHost({
    consumerRoot: app,
    upstreamRoot: upstream,
    dependencyRoot: realpathSync(path.dirname(createRequire(import.meta.url).resolve("@capacitor/android/package.json"))),
    output: path.join(app, project),
    identity: { appId: identity.appId, appName: identity.appName, version, versionCode: versionCode(version) },
    profile: hostProfile,
    runtimeDirectory: agentRuntime(abi),
  });
  const userHome = path.join(app, project, "android-user");
  mkdirSync(userHome, { recursive: true });
  copyFileSync(path.join(app, "android/debug.keystore"), path.join(userHome, "debug.keystore"));
  if (!release && fixture === undefined) for (const flavor of flavors) for (const suffix of ["", "-unsigned"])
    rmSync(path.join(artifacts, `${flavor}-release${suffix}.apk`), { force: true });
  buildAndroidConsumer({
    root: app,
    environment: { ...environment(), ANDROID_USER_HOME: userHome },
    variants: fixture ? ["standalone"] : flavors,
    release,
    lint: false,
    androidTest: false,
    daemon: true,
    project,
    output: fixture?.output ?? "artifacts",
    signing: { environment: Object.values(signing) },
    prepare: [
      { command: path.join(app, "node_modules/.bin/vite"), args: ["build"] },
      { command: path.join(app, "node_modules/.bin/cap"), args: ["copy", "android"] },
    ],
    verify: { command: process.execPath, args: [import.meta.filename, ...(fixture ? ["--verify-billworld-run", path.basename(fixture.output)] : ["--verify"])] },
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
    if (Array.isArray(node)) pending.push(...node);
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

function writeApkManifest(directory = artifacts, episodeCertificate = false) {
  const apksigner = buildTool("apksigner");
  const apks = readdirSync(directory).filter((name) => flavors.some((flavor) => name.startsWith(`${flavor}-`)) && name.endsWith(".apk"));
  if (!apks.length) throw new Error("No Grace APK was produced for verification");
  const manifest = apks.map((name) => {
    const file = path.join(directory, name);
    const contents = readFileSync(file);
    const entries = execFileSync(buildTool("aapt"), ["list", file], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).split("\n");
    if (entries.includes("res/raw/billworld_episode_ca.pem") !== episodeCertificate) {
      throw new Error(`${name} has the wrong certificate resources for this build`);
    }
    const forbidden = entries.filter((entry) => forbiddenEntry.test(entry));
    if (forbidden.length) throw new Error(`${name} carries an on-device model or local inference: ${forbidden.join(", ")}`);
    const abis = entries.flatMap((entry) => /^lib\/([^/]+)\/libeliza_bun\.so$/.exec(entry)?.slice(1) ?? []);
    if (abis.length !== 1 || !entries.includes("assets/agent-runtime.inventory")) throw new Error(`${name} does not carry one agent runtime: libeliza_bun.so for ${abis.join(", ") || "no processor type"}`);
    const listed = execFileSync("unzip", ["-p", file, "assets/agent-runtime.inventory"], { encoding: "utf8" }).trim().split("\n").slice(1)
      .map((line) => line.split("\t")).map(([kind, , , source]) => kind === "native" ? `lib/${abis[0]}/${source}` : `assets/${source}`);
    const missing = ["assets/agent/agent-bundle.js", ...listed].filter((entry) => !entries.includes(entry));
    if (missing.length) throw new Error(`${name} lacks agent runtime files its inventory lists: ${missing.join(", ")}; delete artifacts/agent-runtime to rebuild a payload staged by an older build`);
    const actions = checkPolicy(execFileSync("unzip", ["-p", file, "assets/agent/agent-bundle.js"], { encoding: "utf8", maxBuffer: 1024 * 1024 * 1024 }));
    process.stdout.write(`${name} ${abis[0]} ${contents.byteLength} bytes; its ${actions} actions declared by name are each allowed or refused\n`);
    return { name, abi: abis[0], bytes: contents.byteLength, sha256: createHash("sha256").update(contents).digest("hex"),
      signer: name.endsWith("-unsigned.apk") ? null : Schema.decodeUnknownSync(Schema.String)(readApkSignerDigest(file, { apksigner })) };
  });
  writeFileSync(path.join(directory, "apk-manifest.json"), JSON.stringify(manifest, null, 2));
}

const sdk = (tool: string) => path.join(resolveAndroidSdkRoot(), tool);
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
const AXNode = Schema.Struct({ ignored: Schema.Boolean, role: Schema.optional(Schema.Struct({ value: Schema.Unknown })), backendDOMNodeId: Schema.optional(Schema.Number) });
const AXNodes = Schema.Struct({ nodes: Schema.Array(AXNode) });
const Quads = Schema.Struct({ quads: Schema.Array(Schema.Tuple([Schema.Number, Schema.Number, Schema.Number, Schema.Number, Schema.Number, Schema.Number, Schema.Number, Schema.Number])) });
const SignInReport = Schema.Struct({
  status: Schema.Struct({ active: Schema.Boolean, google: Schema.Boolean, googleScopes: Schema.Array(Schema.String) }),
  identity: Schema.Struct({ credentialId: Schema.NullOr(Schema.String) }),
});
const selectedHome = `[...document.querySelectorAll("button[aria-current=true]:enabled")].some((control) => control.textContent.trim() === "Home")`;
const secondHomePage = `document.querySelector('button[aria-label="Page 2"][aria-current=true]') !== null`;
const passwordCardReady = `(() => {
  const card = [...document.querySelectorAll("button:enabled")].find((control) => control.textContent.trim() === "Passwords");
  if (!card || card.closest("[inert]")) return false;
  for (let element = card; element; element = element.parentElement) {
    if (element.getAnimations().some((animation) => animation instanceof CSSTransition && animation.playState === "running")) return false;
  }
  const { left, top, width, height } = card.getBoundingClientRect();
  return card.contains(document.elementFromPoint(left + width / 2, top + height / 2));
})()`;
const Targets = Schema.Array(Schema.Struct({ id: Schema.NonEmptyString, type: Schema.String, url: Schema.String, webSocketDebuggerUrl: Schema.optional(Schema.String) }));
const MainFrame = Schema.Struct({ frameTree: Schema.Struct({ frame: Schema.Struct({ id: Schema.NonEmptyString, loaderId: Schema.NonEmptyString, url: Schema.NonEmptyString }) }) });
const GraceReadback = Schema.Struct({ address: Schema.NullOr(Schema.String), visible: Schema.NullOr(Schema.String) });

async function devTools(url: string, signal: AbortSignal) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve);
    socket.addEventListener("error", () => reject(new Error(`Could not open ${url}`)));
    signal.addEventListener("abort", () => reject(signal.reason));
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

  const find = async (name: string, signal: AbortSignal) => {
    const { root } = await send({ method: "DOM.getDocument", params: { depth: 0 }, schema: Document, signal });
    const { nodes } = await send({ method: "Accessibility.queryAXTree", params: { nodeId: root.nodeId, accessibleName: name }, schema: AXNodes, signal });
    const matches = nodes.flatMap((node) => !node.ignored && node.role?.value !== "StaticText" && node.backendDOMNodeId !== undefined ? [node.backendDOMNodeId] : []);
    if (matches.length > 1) throw new Error(`${matches.length} things are named "${name}"`);
    return matches[0];
  };

  const tap = async (name: string, signal: AbortSignal) => {
    let node = await find(name, signal);
    while (node === undefined) {
      await until("true", signal);
      node = await find(name, signal);
    }
    await send({ method: "DOM.scrollIntoViewIfNeeded", params: { backendNodeId: node }, schema: Nothing, signal });
    const { quads: [quad] } = await send({ method: "DOM.getContentQuads", params: { backendNodeId: node }, schema: Quads, signal });
    if (!quad) throw new Error(`"${name}" is not on screen`);
    const x = (quad[0] + quad[2] + quad[4] + quad[6]) / 4, y = (quad[1] + quad[3] + quad[5] + quad[7]) / 4;
    for (const type of ["mousePressed", "mouseReleased"])
      await send({ method: "Input.dispatchMouseEvent", params: { type, x, y, button: "left", clickCount: 1 }, schema: Nothing, signal });
  };

  const describe = async () => {
    const expression = `(async () => JSON.stringify({ origin: location.origin, visibility: document.visibilityState, agent: await Capacitor.Plugins.EmbeddedAgent.getStatus().then(({state}) => state).catch(() => "unavailable") }))()`;
    const { result } = await send({ method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true }, schema: Evaluated, signal: AbortSignal.timeout(30_000) });
    return String(result.value);
  };

  return {
    until,
    describe,
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
    async step(step: Exclude<Step, OnDevice>, signal = AbortSignal.timeout("agent" in step ? 300_000 : 120_000)) {
      if ("agent" in step) {
        const expression = `new Promise((done) => { const agent = Capacitor.Plugins.EmbeddedAgent; const listening = agent.addListener("status", (status) => check(status)); const check = (status) => (status.state === "failed" || Object.entries(${JSON.stringify(step.agent)}).every(([key, value]) => status[key] === value)) && Promise.resolve(listening).then((listener) => listener.remove()).then(() => done({ state: status.state, failure: status.failure, error: status.error })); agent.getStatus().then(check); })`;
        const { result } = await send({ method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true }, schema: Evaluated, signal });
        const status = Schema.decodeUnknownSync(Schema.Struct({ ...AgentStatus.fields, error: Schema.optional(Schema.String) }))(result.value);
        if (status.state !== step.agent.state || status.failure !== step.agent.failure)
          throw new Error(`The agent is ${JSON.stringify(status)}, not ${JSON.stringify(step.agent)}`);
        return;
      }
      if ("signIn" in step) {
        const expression = `(async () => { const signIn = Capacitor.Plugins.GraceSignIn; return JSON.stringify({ status: await signIn.status({ refreshNegative: true }), identity: await signIn.credentialIdentity({ environment: "production" }) }); })()`;
        const { result } = await send({ method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true }, schema: Evaluated, signal });
        const reply = String(result.value);
        if (/eliza_mobile_/.test(reply)) throw new Error("A sign-in result carries an Eliza Cloud key");
        const { status, identity } = Schema.decodeUnknownSync(Schema.fromJsonString(SignInReport))(reply);
        const found = { signedIn: identity.credentialId !== null, google: status.google };
        process.stdout.write(`sign-in status ${JSON.stringify({ ...status, ...found })}\n`);
        if (found.signedIn !== step.signIn.signedIn || found.google !== step.signIn.google)
          throw new Error(`Sign-in is ${JSON.stringify(found)}, not ${JSON.stringify(step.signIn)}`);
        return;
      }
      if ("tap" in step) return await tap(step.tap, signal);
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
    const navigation = first && requestAcceptedAt ? observations.some(({ at, document }) => {
      const address = new URL(document.url);
      address.hash = "";
      const initial = new URL(first.url);
      initial.hash = "";
      return at >= requestAcceptedAt && document.loaderId !== first.loaderId && address.href !== initial.href;
    }) : false;
    try {
      writeFileSync(output, `${JSON.stringify({ surface: "android-webview", input, status, failure, requestAcceptedAt, navigation, observations, transcripts }, null, 2)}\n`);
    } finally {
      closeSync(output);
    }
  }
}

async function onDevice(serial: typeof EmulatorSerial.Type, pid: string, step: OnDevice) {
  if ("service" in step) {
    const foreground = `dumpsys activity services ${identity.appId}/.${step.service} | grep -c isForeground=true`;
    await shell(serial, `until [ "$(${foreground})" -gt 0 ]; do sleep 1; done`, 120);
    return;
  }
  await shell(serial, `am start -W -a ${step.leaveFor}`, 120);
  await shell(serial, `am kill ${identity.appId}`);
  const survivor = (await shell(serial, `pidof ${identity.appId}`).catch(() => "")).trim();
  if (survivor !== pid) throw new Error(`Grace's process ${pid} did not survive her activity being left for ${step.leaveFor}: "${survivor}"`);
  await shell(serial, `am start -W -n ${activity}`, 120);
}

async function walk(serial: typeof EmulatorSerial.Type, exercise: ReadonlyArray<Step>, benchmark?: BenchmarkRun) {
  await adb(["-s", serial, "install", "-r", path.join(artifacts, "launcher-debug.apk")], 300);
  await shell(serial, `cmd package set-home-activity ${activity}`);
  const resolveHome = "cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME | tail -n 1";
  await shell(serial, `until [ "$(${resolveHome})" = ${activity} ]; do sleep 1; done`, 600)
    .catch(async (error: unknown) => failing(`Waiting for Home to resolve to Grace rather than ${(await shell(serial, resolveHome).catch(String)).trim()}`)(error));
  const started = await shell(serial, "am start -W -a android.intent.action.MAIN -c android.intent.category.HOME", 120);
  if (!started.includes(`Activity: ${activity}`)) throw new Error(`Grace is not Home on ${serial}:\n${started}`);
  const webView = /Current WebView package \(name, version\): \((.*)\)/.exec(await shell(serial, "dumpsys webviewupdate"))?.[1];
  process.stdout.write(`${serial} ${webView ?? "WebView unknown"}\n`);
  const debuggable = `grep -q "webview_devtools_remote_$pid$" /proc/net/unix && echo "$pid" && exit`;
  const waitForPid = `for i in $(seq 120); do pid=$(pidof ${identity.appId}); case "$pid" in *" "*) echo "$pid"; exit;; "") ;; *) ${debuggable};; esac; sleep 1; done`;
  await withGracePage(serial, waitForPid, async (page, pid, listTargets) => {
    const showing = (what: string) => async (error: unknown) =>
      failing(`${what}${await page.describe().then((shown) => ` (the page shows ${shown})`, () => "")}`)(error);
    await page.until(selectedHome, AbortSignal.timeout(180_000)).catch(showing("Waiting for Home"));
    for (const step of exercise) {
      const description = "into" in step ? `Enter text in ${step.into}` : JSON.stringify(step);
      await ("service" in step || "leaveFor" in step ? onDevice(serial, pid, step) : page.step(step)).catch(showing(description));
      process.stdout.write(`${description} ok\n`);
    }
    if (benchmark) await runBenchmark(benchmark, page, listTargets);
  });
}

async function withGracePage(serial: typeof EmulatorSerial.Type, waitForPid: string, run: (page: Awaited<ReturnType<typeof devTools>>, pid: string, listTargets: () => Promise<typeof Targets.Type>) => Promise<void>) {
  const pid = (await shell(serial, waitForPid, 180)).trim();
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
    const page = await devTools(host, AbortSignal.timeout(120_000)).catch(failing("Opening Grace's WebView debugging socket"));
    try {
      await run(page, pid, listTargets);
    } finally {
      page.close();
    }
  } finally {
    await adb(["-s", serial, "forward", "--remove", `tcp:${port}`]).catch((error: unknown) => process.stderr.write(`${String(error)}\n`));
  }
}

async function deliver({ serial, exited }: Target, exercise: ReadonlyArray<Step>, benchmark?: BenchmarkRun) {
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
  await walk(serial, exercise, benchmark).catch(async (error: unknown) => {
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

function deviceNodes(xml: string) {
  return Array.from(xml.matchAll(/<node\b[^>]*>/g)).flatMap(([node]) => {
    const attr = (name: string) => new RegExp(` ${name}="([^"]*)"`).exec(node)?.[1] ?? "";
    const bounds = /^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/.exec(attr("bounds"));
    return bounds ? [{
      x: Math.round((Number(bounds[1]) + Number(bounds[3])) / 2),
      y: Math.round((Number(bounds[2]) + Number(bounds[4])) / 2),
      label: attr("text"), description: attr("content-desc"), id: attr("resource-id").split("/").at(-1),
      className: attr("class"), packageName: attr("package"), password: attr("password") === "true",
    }] : [];
  });
}

async function billworldPasswords(serial: typeof EmulatorSerial.Type, checkout: string, abi: Abi) {
  const installedApk = async () => {
    const packages = (await shell(serial, `cmd package list packages -f ${identity.appId}`)).trim();
    if (!packages) return undefined;
    const entry = packages.split("\n").find((line) => line.endsWith(`=${identity.appId}`));
    if (!entry) throw new Error("Unexpected Android package state");
    const file = entry.slice("package:".length, -identity.appId.length - 1);
    if (!entry.startsWith("package:") || !/^\/data\/app\/[A-Za-z0-9_~+=/.-]+\/base\.apk$/.test(file)) throw new Error("Unexpected installed APK path");
    const result = (await shell(serial, `sha256sum '${file}'`, 120)).split(/\s/)[0];
    if (!result || !/^[0-9a-f]{64}$/.test(result)) throw new Error("Android could not identify the installed APK");
    return result;
  };
  if ((await shell(serial, "getprop ro.kernel.qemu")).trim() !== "1" ||
      await installedApk() !== undefined) {
    throw new Error("BillWorld requires an emulator with no existing Grace installation");
  }
  const fixture = await import(pathToFileURL(path.resolve(checkout, "billworld/integration/https-episode-host.mjs")).href);
  if (typeof fixture.startPasswordLoginEpisode !== "function") throw new Error("BillWorld password fixture is unavailable");
  const cleanup: Array<() => Promise<unknown>> = [];
  let buildFailure: Error | undefined;
  const screenFile = "/data/local/tmp/grace-billworld-ui.xml";
  const pin = "7539";
  const screen = async () => {
    await shell(serial, `uiautomator dump ${screenFile}`, 15);
    return deviceNodes(await shell(serial, `cat ${screenFile}`, 15));
  };
  const tap = async (matches: (node: ReturnType<typeof deviceNodes>[number]) => boolean, label: string) => {
    const until = Date.now() + 90_000;
    while (Date.now() < until) {
      const nodes = await screen().catch(() => []);
      const found = nodes.find(matches);
      if (found) {
        await shell(serial, `input tap ${found.x} ${found.y}`);
        return;
      }
      await delay(1000);
    }
    throw new Error(`Android did not show ${label}`);
  };
  const text = (value: string) => shell(serial, `input text '${value.replaceAll(" ", "%s").replaceAll("'", "'\\''")}'`)
    .catch(() => { throw new Error("Android did not accept a fixture field"); });
  const submitPin = async () => {
    await tap((node) => node.id === "lockPassword" && (node.packageName === "com.android.settings" || node.packageName === "com.android.systemui"), "the system screen lock");
    await text(pin);
    await shell(serial, "input keyevent KEYCODE_ENTER");
  };
  const editor = async (field: string, value: string) => {
    await tap((node) => node.packageName === identity.appId && node.description === field && node.className === "android.widget.EditText", "a native editor field");
    await text(value);
  };
  let episode: { grade(): Promise<unknown>; close(): Promise<unknown> } | undefined;
  let step = "open fixture";
  try {
    episode = await fixture.startPasswordLoginEpisode({
      provision: async (input: unknown) => {
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
        cleanup.push(async () => { rmSync(path.join(app, output), { recursive: true, force: true }); });
        copyFileSync(deviceTrust.caPath, path.join(app, resources, "raw/billworld_episode_ca.pem"));
        writeFileSync(path.join(app, resources, "xml/network_security.xml"),
          '<network-security-config><base-config cleartextTrafficPermitted="false"/><domain-config cleartextTrafficPermitted="false"><domain>localhost</domain><domain>127.0.0.1</domain><trust-anchors><certificates src="@raw/billworld_episode_ca"/></trust-anchors></domain-config></network-security-config>');
        try {
          buildAndroid({ abi, fixture: { output, resources } });
        } catch (error) {
          buildFailure = error instanceof Error ? error : new Error("Could not build the fixture APK");
          throw buildFailure;
        }
        step = "install the test APK and transport";
        for (const port of deviceTrust.reversePorts) {
          await adb(["-s", serial, "reverse", "--no-rebind", `tcp:${port}`, `tcp:${port}`]);
          cleanup.push(() => adb(["-s", serial, "reverse", "--remove", `tcp:${port}`]));
        }
        step = "install the episode-specific signed APK";
        const apk = path.join(app, output, "standalone-debug.apk");
        const digest = createHash("sha256").update(readFileSync(apk)).digest("hex");
        const remote = `/data/local/tmp/grace-billworld-${runId}.apk`;
        cleanup.push(() => shell(serial, `rm -f ${remote}`));
        await adb(["-s", serial, "push", apk, remote], 180);
        cleanup.push(async () => {
          const installed = await installedApk();
          if (!installed) return;
          if (installed !== digest) throw new Error("The installed app changed during the episode");
          await adb(["-s", serial, "uninstall", identity.appId], 180);
        });
        await shell(serial, `pm install -t ${remote}`, 300).catch(() => undefined);
        if (await installedApk() !== digest) throw new Error("Android did not install the episode APK");
        step = "configure the disposable screen lock";
        const verified = /credential verified successfully|no credential (?:is )?set/i;
        if (!verified.test(await shell(serial, "locksettings verify", 120))) throw new Error("The fixture requires an empty screen lock");
        cleanup.push(async () => {
          if (verified.test(await shell(serial, "locksettings verify", 120).catch(() => ""))) return;
          const cleared = await shell(serial, `locksettings clear --old ${pin}`, 120);
          if (!/cleared/i.test(cleared)) throw new Error("Android did not clear the fixture lock");
        });
        await shell(serial, `locksettings set-pin ${pin}`, 180).catch(() => undefined);
        if (!verified.test(await shell(serial, `locksettings verify --old ${pin}`, 120)) ||
            verified.test(await shell(serial, "locksettings verify", 120).catch(() => ""))) throw new Error("Android did not set the fixture lock");
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
        step = "start the Grace tablet app";
        const started = await shell(serial, `am start -W -n ${activity}`, 180);
        if (!started.includes(`Activity: ${activity}`)) throw new Error("Grace did not open");
        step = "wait for the Grace home screen";
        const waitForPid = `for i in $(seq 120); do pid=$(pidof ${identity.appId}); grep -q "webview_devtools_remote_$pid$" /proc/net/unix && echo "$pid" && exit; sleep 1; done`;
        await withGracePage(serial, waitForPid, async (page) => {
          step = "wait for interactive Grace Home";
          await page.until(selectedHome, AbortSignal.timeout(180_000));
          process.stdout.write("The installed Grace Home is ready.\n");
          step = "select the second Grace Home page";
          await page.step({ tap: "Page 2" });
          await page.until(secondHomePage, AbortSignal.timeout(30_000));
          process.stdout.write("The second Grace Home page is selected.\n");
          step = "open Passwords from the second Grace Home page";
          await page.until(passwordCardReady, AbortSignal.timeout(30_000));
          await page.step({ tap: "Passwords" });
          step = "request Passwords unlock";
          await page.step({ tap: "Unlock Passwords" });
          step = "confirm the tablet screen lock";
          await submitPin();
          step = "open the protected password editor";
          await page.step({ tap: "Add password" });
          step = "enter the synthetic sign-in in Android";
          await editor("Name", login.label);
          await editor("Website address", origin.origin);
          await editor("Username", login.username);
          await editor("Password", login.password);
          await shell(serial, "input keyevent KEYCODE_BACK");
          step = "save the synthetic sign-in";
          await tap((node) => node.packageName === identity.appId && node.label === "Save", "the native Save button");
          await page.step({ expect: "Password saved." });
          process.stdout.write("The installed native password editor saved the synthetic sign-in.\n");
          step = "open the private HTTPS browser";
          await page.step({ tap: "Close Passwords" });
          await page.step({ tap: "Internet" });
          await page.step({ type: origin.origin, into: "Address" });
          await page.step({ press: "Enter" });
          await page.step({ tap: "Private sign-in" });
          await page.step({ type: entry.href, into: "Private website address", replace: true });
          await page.step({ press: "Enter" });
        });
        step = "request Android autofill and choose the matching entry";
        await tap((node) => node.password && node.className === "android.widget.EditText", "the website password field");
        await tap((node) => node.label === "Fill with a saved password", "Android's fill offer");
        await submitPin();
        await tap((node) => node.packageName === identity.appId && node.label.includes(login.label), "the matching sign-in");
      },
    });
    const activeEpisode = episode;
    if (activeEpisode === undefined) throw new Error("The fixture did not start");
    const readGrade = async () => Schema.decodeUnknownSync(Grade)(await activeEpisode.grade());
    const before = await readGrade();
    if (before.grade.success || before.paymentCount !== 0) throw new Error("Autofill must not submit or pay");
    step = "submit the website form and grade";
    await tap((node) => /^(sign\s*in|log\s*in)$/i.test(node.label) && node.className === "android.widget.Button", "the website sign-in button");
    const until = Date.now() + 45_000;
    while (Date.now() < until) {
      const after = await readGrade();
      if (after.paymentCount !== 0) throw new Error("The sign-in run encountered a payment");
      if (after.grade.success) { process.stdout.write("BillWorld sign-in passed through installed Android Autofill. No payment was made.\n"); return; }
      await delay(1000);
    }
    throw new Error("BillWorld did not confirm the account view");
  } catch {
    if (buildFailure) throw buildFailure;
    throw new Error(`BillWorld password journey stopped at: ${step}`);
  } finally {
    for (const release of cleanup.reverse()) await release().catch(() => { process.stderr.write("A BillWorld fixture cleanup step failed.\n"); });
    await episode?.close();
  }
}

if (import.meta.main) {
  const options = parseArgs({ options: { release: { type: "boolean" }, verify: { type: "boolean" }, abi: { type: "string" }, install: { type: "string" }, emulator: { type: "string" }, exercise: { type: "string" }, benchmark: { type: "string" }, receipt: { type: "string" }, "billworld-passwords": { type: "string" }, "verify-billworld-run": { type: "string" } } }).values;
  const { verify, release, abi = "arm64-v8a", install, emulator, exercise, benchmark, receipt, "billworld-passwords": billworld, "verify-billworld-run": fixtureRun } = Schema.decodeUnknownSync(Arguments)(options);
  if (install && emulator) throw new Error("Give --install <emulator serial> or --emulator <avd>, not both");
  if (exercise && !install && !emulator) throw new Error("--exercise needs --install <emulator serial> or --emulator <avd>");
  if ((benchmark || receipt) && (!benchmark || !receipt || (!install && !emulator) || exercise || verify))
    throw new Error("--benchmark <input> and --receipt <new-file> require an emulator and run without --exercise or --verify");
  if (install && !(await emulators()).includes(install)) throw new Error(`No emulator ${install} is attached`);
  if (emulator && !avds().includes(emulator)) throw new Error(`No AVD named ${emulator}`);
  const steps = exercise ? Schema.decodeUnknownSync(Schema.NonEmptyArray(Step), { onExcessProperty: "error" })(readJson(path.join(app, "test/device", `${exercise}.json`))) : [];
  const trial = benchmark && receipt ? { input: Schema.decodeUnknownSync(Benchmark, { onExcessProperty: "error" })(readJson(benchmark)), receipt } : undefined;
  if (trial) {
    testOrigin(trial.input.startUrl);
    if (existsSync(trial.receipt)) throw new Error("Benchmark receipt already exists");
  }
  if (billworld !== undefined) {
    if (verify || release || install || exercise || benchmark || receipt || fixtureRun || !emulator?.startsWith("grace-billworld-")) {
      throw new Error("Use --billworld-passwords CHECKOUT with --emulator grace-billworld-… on a disposable AVD");
    }
    mkdirSync(artifacts, { recursive: true });
    const target = await emulatorTarget(emulator);
    try {
      await Promise.race([adb(["-s", target.serial, "wait-for-device", "shell", 'while [ "$(getprop sys.boot_completed)" != 1 ]; do sleep 1; done'], 600), target.exited]);
      await billworldPasswords(target.serial, billworld, abi);
    } finally { target.stop(); }
  } else if (fixtureRun) writeApkManifest(path.join(artifacts, "billworld-passwords", fixtureRun), true);
  else if (verify) writeApkManifest();
  else {
    buildAndroid({ release, abi });
    const target = install ? attached(install) : emulator && await emulatorTarget(emulator);
    if (target) {
      process.once("exit", (code) => { stopping.abort(); if (code) target.stop(); });
      for (const [signal, code] of [["SIGINT", 130], ["SIGTERM", 143]] as const) process.once(signal, () => process.exit(code));
      await deliver(target, steps, trial);
    }
  }
}

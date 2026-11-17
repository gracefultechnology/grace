import { createHash } from "node:crypto";
import { type ChildProcess, execFile, execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
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
const cloudSpeechClass = /^Lai\/eliza\/voice\/(SpeechStreamBridgePlugin|CloudSpeechWire|AudioTrackSpeechOutput|SpeechAudioFocus|SpeechAudioFocusPolicy|SpeechPcmQueue|StreamingSpeechPlayback|VoiceLatencyTrials)[;$]/;
const inferenceClass = /^L(ai\/eliza\/voice\/|ai\/onnxruntime\/|org\/tensorflow\/lite\/|org\/pytorch\/|com\/k2fsa\/|com\/google\/mediapipe\/|org\/vosk\/)/;

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
    upstream: Schema.Struct({ allow: Reasons, refuse: Reasons, refusedSubactionsOf: Schema.Array(Schema.String) }),
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
const PluginCall = {
  call: Schema.String.check(Schema.isPattern(/^[A-Z]\w*\.[a-z]\w*$/)),
  with: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
};
const Step = Schema.Union([
  Schema.Struct({ tap: Schema.NonEmptyString }),
  Schema.Struct({ type: Schema.String, into: Schema.NonEmptyString }),
  Schema.Struct({ press: Schema.Literal("Enter") }),
  Schema.Struct({ expect: Schema.NonEmptyString }),
  Schema.Struct({ agent: AgentStatus }),
  Schema.Struct({ service: Schema.String.check(Schema.isPattern(/^[A-Z]\w*$/)) }),
  Schema.Struct({ leaveFor: Schema.String.check(Schema.isPattern(/^android\.settings\.[A-Z_]+$/)) }),
  Schema.Struct({ key: Schema.Literals(["VOLUME_UP", "VOLUME_DOWN"]) }),
  Schema.Struct({ ...PluginCall, returns: Schema.Record(Schema.String, Schema.Unknown) }),
  Schema.Struct({ ...PluginCall, refuses: Schema.NonEmptyString }),
]);
type Step = typeof Step.Type;
type OnDevice = Extract<Step, { service: string } | { leaveFor: string } | { key: string }>;
const Arguments = Schema.Struct({
  release: Schema.optional(Schema.Boolean),
  verify: Schema.optional(Schema.Boolean),
  abi: Schema.optional(Abi),
  install: Schema.optional(EmulatorSerial),
  emulator: Schema.optional(Schema.NonEmptyString),
  exercise: Schema.optional(Schema.String.check(Schema.isPattern(/^[a-z0-9-]+$/))),
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

function buildAndroid({ release = false, abi }: { release?: boolean; abi: Abi }) {
  const { version } = Schema.decodeUnknownSync(Schema.Struct({ version: Schema.String }))(readJson(path.join(app, "package.json")));
  writeAgentData();
  generateAndroidConsumerHost({
    consumerRoot: app,
    upstreamRoot: upstream,
    dependencyRoot: realpathSync(path.dirname(createRequire(import.meta.url).resolve("@capacitor/android/package.json"))),
    output: path.join(app, project),
    identity: { appId: identity.appId, appName: identity.appName, version, versionCode: versionCode(version) },
    profile,
    runtimeDirectory: agentRuntime(abi),
  });
  if (!release) for (const flavor of flavors) for (const suffix of ["", "-unsigned"])
    rmSync(path.join(artifacts, `${flavor}-release${suffix}.apk`), { force: true });
  buildAndroidConsumer({
    root: app,
    environment: environment(),
    variants: flavors,
    release,
    lint: false,
    androidTest: false,
    daemon: true,
    project,
    output: "artifacts",
    signing: { environment: Object.values(signing) },
    prepare: [
      { command: path.join(app, "node_modules/.bin/vite"), args: ["build"] },
      { command: path.join(app, "node_modules/.bin/cap"), args: ["copy", "android"] },
    ],
    verify: { command: process.execPath, args: [import.meta.filename, "--verify"] },
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
  const { allow, refuse, refusedSubactionsOf } = policy.actions.upstream;
  const unlisted = [...declared].filter((name) => !Object.hasOwn(allow, name) && !Object.hasOwn(refuse, name) && !Object.hasOwn(policy.actions.grace, name)
    && !refusedSubactionsOf.some((umbrella) => name.startsWith(`${umbrella}_`))).sort();
  if (unlisted.length) throw new Error(`The agent registers actions agent/policy.json neither allows nor refuses: ${unlisted.join(", ")}`);
  checked.set(digest, declared.size);
  return declared.size;
}

function writeApkManifest() {
  const apksigner = buildTool("apksigner");
  const apks = readdirSync(artifacts).filter((name) => flavors.some((flavor) => name.startsWith(`${flavor}-`)) && name.endsWith(".apk"));
  const manifest = apks.map((name) => {
    const file = path.join(artifacts, name);
    const contents = readFileSync(file);
    const entries = execFileSync(buildTool("aapt"), ["list", file], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).split("\n");
    const forbidden = entries.filter((entry) => forbiddenEntry.test(entry));
    if (forbidden.length) throw new Error(`${name} carries an on-device model or local inference: ${forbidden.join(", ")}`);
    const abis = entries.flatMap((entry) => /^lib\/([^/]+)\/libeliza_bun\.so$/.exec(entry)?.slice(1) ?? []);
    if (abis.length !== 1 || !entries.includes("assets/agent-runtime.inventory")) throw new Error(`${name} does not carry one agent runtime: libeliza_bun.so for ${abis.join(", ") || "no processor type"}`);
    const listed = execFileSync("unzip", ["-p", file, "assets/agent-runtime.inventory"], { encoding: "utf8" }).trim().split("\n").slice(1)
      .map((line) => line.split("\t")).map(([kind, , , source]) => kind === "native" ? `lib/${abis[0]}/${source}` : `assets/${source}`);
    const missing = ["assets/agent/agent-bundle.js", ...listed].filter((entry) => !entries.includes(entry));
    if (missing.length) throw new Error(`${name} lacks agent runtime files its inventory lists: ${missing.join(", ")}; delete artifacts/agent-runtime to rebuild a payload staged by an older build`);
    const classes = Array.from(execFileSync(buildTool("dexdump"), [file], { encoding: "utf8", maxBuffer: 1024 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] })
      .matchAll(/^  Class descriptor  : '([^']+)'$/gm), ([, descriptor]) => descriptor);
    const inference = classes.filter((descriptor) => inferenceClass.test(descriptor) && !cloudSpeechClass.test(descriptor));
    if (inference.length) throw new Error(`${name} carries local inference or voice model classes: ${inference.join(", ")}`);
    if (!classes.includes("Lai/eliza/voice/SpeechStreamBridgePlugin;")) throw new Error(`${name} lacks the cloud speech bridge`);
    const actions = checkPolicy(execFileSync("unzip", ["-p", file, "assets/agent/agent-bundle.js"], { encoding: "utf8", maxBuffer: 1024 * 1024 * 1024 }));
    process.stdout.write(`${name} ${abis[0]} ${contents.byteLength} bytes; ${classes.length} classes, the cloud speech bridge and no inference class; its ${actions} actions declared by name are each allowed or refused\n`);
    return { name, abi: abis[0], bytes: contents.byteLength, sha256: createHash("sha256").update(contents).digest("hex"),
      signer: name.endsWith("-unsigned.apk") ? null : Schema.decodeUnknownSync(Schema.String)(readApkSignerDigest(file, { apksigner })) };
  });
  writeFileSync(path.join(artifacts, "apk-manifest.json"), JSON.stringify(manifest, null, 2));
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
const Targets = Schema.Array(Schema.Struct({ type: Schema.String, url: Schema.String, webSocketDebuggerUrl: Schema.optional(Schema.String) }));

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
    } catch (error) {
      return rejectAll(new Error(`Grace's WebView sent an unreadable reply: ${String(message.data).slice(0, 200)}`, { cause: error }));
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
    const expression = `(async () => JSON.stringify({ url: location.href, visibility: document.visibilityState, current: [...document.querySelectorAll("[aria-current=true]")].map((e) => e.textContent.trim()), text: document.body.innerText.slice(0, 300), agent: await Capacitor.Plugins.EmbeddedAgent.getStatus().catch(String) }))()`;
    const { result } = await send({ method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true }, schema: Evaluated, signal: AbortSignal.timeout(30_000) });
    return String(result.value);
  };

  return {
    until,
    describe,
    async step(step: Exclude<Step, OnDevice>) {
      const signal = AbortSignal.timeout("agent" in step ? 300_000 : 120_000);
      if ("agent" in step) {
        const expression = `new Promise((done) => { const agent = Capacitor.Plugins.EmbeddedAgent; const listening = agent.addListener("status", (status) => check(status)); const check = (status) => (status.state === "failed" || Object.entries(${JSON.stringify(step.agent)}).every(([key, value]) => status[key] === value)) && Promise.resolve(listening).then((listener) => listener.remove()).then(() => done({ state: status.state, failure: status.failure, error: status.error })); agent.getStatus().then(check); })`;
        const { result } = await send({ method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true }, schema: Evaluated, signal });
        const status = Schema.decodeUnknownSync(Schema.Struct({ ...AgentStatus.fields, error: Schema.optional(Schema.String) }))(result.value);
        if (status.state !== step.agent.state || status.failure !== step.agent.failure)
          throw new Error(`The agent is ${JSON.stringify(status)}, not ${JSON.stringify(step.agent)}`);
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
      if ("tap" in step) return await tap(step.tap, signal);
      if ("into" in step) {
        await tap(step.into, signal);
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
  await shell(serial, `am start -W -a ${step.leaveFor}`, 120);
  await shell(serial, `am kill ${identity.appId}`);
  const survivor = (await shell(serial, `pidof ${identity.appId}`).catch(() => "")).trim();
  if (survivor !== pid) throw new Error(`Grace's process ${pid} did not survive her activity being left for ${step.leaveFor}: "${survivor}"`);
  await shell(serial, `am start -W -n ${activity}`, 120);
}

async function walk(serial: typeof EmulatorSerial.Type, exercise: ReadonlyArray<Step>) {
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
  const pid = (await shell(serial, waitForPid, 180)).trim();
  if (!/^\d+$/.test(pid)) throw new Error(`Expected one process of Grace with a debuggable WebView on ${serial}, found "${pid}"`);
  const port = (await adb(["-s", serial, "forward", "tcp:0", `localabstract:webview_devtools_remote_${pid}`])).trim();
  try {
    const targets = Schema.decodeUnknownSync(Targets)(await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(120_000) })
      .then((response) => response.json()).catch(failing("Listing Grace's WebView pages")));
    const host = targets.find((target) => target.type === "page" && target.url.startsWith("https://localhost"))?.webSocketDebuggerUrl;
    if (!host) throw new Error(`Grace's WebView is not debuggable on ${serial}`);
    const page = await devTools(host, AbortSignal.timeout(120_000)).catch(failing("Opening Grace's WebView debugging socket"));
    try {
      const home = `[...document.querySelectorAll("[aria-current=true]")].some((e) => e.textContent.trim() === "Home")`;
      const showing = (what: string) => async (error: unknown) =>
        failing(`${what}${await page.describe().then((shown) => ` (the page shows ${shown})`, () => "")}`)(error);
      await page.until(home, AbortSignal.timeout(180_000)).catch(showing("Waiting for Home"));
      for (const step of exercise) {
        await ("service" in step || "leaveFor" in step || "key" in step ? onDevice(serial, pid, step) : page.step(step)).catch(showing(JSON.stringify(step)));
        process.stdout.write(`${JSON.stringify(step)} ok\n`);
      }
    } finally {
      page.close();
    }
  } finally {
    await adb(["-s", serial, "forward", "--remove", `tcp:${port}`]).catch((error: unknown) => process.stderr.write(`${String(error)}\n`));
  }
}

async function deliver({ serial, exited }: Target, exercise: ReadonlyArray<Step>) {
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
  await walk(serial, exercise).catch(async (error: unknown) => {
    responding(await anrs().catch(() => { throw error; }), error);
    throw error;
  });
  const others = responding(await anrs().catch(failing("Reading the am_anr events")));
  process.stdout.write(`${serial} Grace is Home and responding; other processes raised ${others} am_anr events since the install began\n`);
}

if (import.meta.main) {
  const options = parseArgs({ options: { release: { type: "boolean" }, verify: { type: "boolean" }, abi: { type: "string" }, install: { type: "string" }, emulator: { type: "string" }, exercise: { type: "string" } } }).values;
  const { verify, release, abi = "arm64-v8a", install, emulator, exercise } = Schema.decodeUnknownSync(Arguments)(options);
  if (install && emulator) throw new Error("Give --install <emulator serial> or --emulator <avd>, not both");
  if (exercise && !install && !emulator) throw new Error("--exercise needs --install <emulator serial> or --emulator <avd>");
  if (install && !(await emulators()).includes(install)) throw new Error(`No emulator ${install} is attached`);
  if (emulator && !avds().includes(emulator)) throw new Error(`No AVD named ${emulator}`);
  const steps = exercise ? Schema.decodeUnknownSync(Schema.NonEmptyArray(Step), { onExcessProperty: "error" })(readJson(path.join(app, "test/device", `${exercise}.json`))) : [];
  if (verify) writeApkManifest();
  else {
    buildAndroid({ release, abi });
    const target = install ? attached(install) : emulator && await emulatorTarget(emulator);
    if (target) {
      process.once("exit", (code) => { stopping.abort(); if (code) target.stop(); });
      for (const [signal, code] of [["SIGINT", 130], ["SIGTERM", 143]] as const) process.once(signal, () => process.exit(code));
      await deliver(target, steps);
    }
  }
}

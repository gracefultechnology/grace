import { createHash } from "node:crypto";
import { type ChildProcess, execFile, execFileSync, spawn } from "node:child_process";
import { openSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { parseArgs, promisify } from "node:util";
import { Schema } from "effect";
import { buildAndroidConsumer } from "../../../vendor/eliza/packages/app/scripts/mobile/android/build-consumer.mjs";
import { generateAndroidConsumerHost } from "../../../vendor/eliza/packages/app/scripts/mobile/android/consumer-host.mjs";
import { readApkSignerDigest } from "../../../vendor/eliza/packages/app/scripts/mobile/artifact-inspection/apk-distribution.mjs";
import { resolveAndroidSdkRoot, resolveJavaHome } from "../../../vendor/eliza/packages/app/scripts/mobile/toolchain.ts";
import config from "../capacitor.config.ts";

const app = path.resolve(import.meta.dirname, "..");
const artifacts = path.join(app, "artifacts");
const flavors = ["launcher", "standalone"];
const identity = Schema.decodeUnknownSync(Schema.Struct({ appId: Schema.String, appName: Schema.String, android: Schema.Struct({ path: Schema.String }) }))(config);
const activity = `${identity.appId}/.MainActivity`;
const project = identity.android.path;
const forbiddenEntry = /\.(gguf|onnx|tflite|safetensors|pte)$|llama|ggml|onnxruntime|sherpa|whisper|elizainference|omnivoice|(^|\/)(tts|asr)\//i;

const readJson = (file: string): unknown => JSON.parse(readFileSync(file, "utf8"));
const profile = readJson(path.join(app, "android/host.json"));
const { signing } = Schema.decodeUnknownSync(Schema.Struct({ signing: Schema.Record(Schema.String, Schema.String) }))(profile);
const keystore = signing.storeFile;

const EmulatorSerial = Schema.String.check(Schema.isPattern(/^emulator-\d+$/));
const Step = Schema.Union([
  Schema.Struct({ tap: Schema.String }),
  Schema.Struct({ type: Schema.String, into: Schema.String }),
  Schema.Struct({ press: Schema.Literal("Enter") }),
  Schema.Struct({ expect: Schema.String }),
]);
type Step = typeof Step.Type;
const Arguments = Schema.Struct({
  release: Schema.optional(Schema.Boolean),
  verify: Schema.optional(Schema.Boolean),
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

function buildAndroid({ release = false }) {
  const { version } = Schema.decodeUnknownSync(Schema.Struct({ version: Schema.String }))(readJson(path.join(app, "package.json")));
  generateAndroidConsumerHost({
    consumerRoot: app,
    upstreamRoot: path.resolve(app, "../../vendor/eliza"),
    dependencyRoot: realpathSync(path.dirname(createRequire(import.meta.url).resolve("@capacitor/android/package.json"))),
    output: path.join(app, project),
    identity: { appId: identity.appId, appName: identity.appName, version, versionCode: versionCode(version) },
    profile,
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

function writeApkManifest() {
  const apksigner = buildTool("apksigner");
  const apks = readdirSync(artifacts).filter((name) => flavors.some((flavor) => name.startsWith(`${flavor}-`)) && name.endsWith(".apk"));
  const manifest = apks.map((name) => {
    const file = path.join(artifacts, name);
    const contents = readFileSync(file);
    const forbidden = execFileSync(buildTool("aapt"), ["list", file], { encoding: "utf8" }).split("\n").filter((entry) => forbiddenEntry.test(entry));
    if (forbidden.length) throw new Error(`${name} carries an on-device model or local inference: ${forbidden.join(", ")}`);
    process.stdout.write(`${name} ${contents.byteLength} bytes\n`);
    return { name, bytes: contents.byteLength, sha256: createHash("sha256").update(contents).digest("hex"),
      signer: name.endsWith("-unsigned.apk") ? null : readApkSignerDigest(file, { apksigner }) };
  });
  writeFileSync(path.join(artifacts, "apk-manifest.json"), JSON.stringify(manifest, null, 2));
}

const sdk = (tool: string) => path.join(resolveAndroidSdkRoot(), tool);
const run = promisify(execFile);
const adb = async (args: string[], seconds = 60) => {
  const { stdout } = await run(sdk("platform-tools/adb"), args, { encoding: "utf8", timeout: seconds * 1000, killSignal: "SIGKILL" })
    .catch((error: Error) => { throw new Error(`adb ${args.join(" ")} failed or ran past ${seconds} s`, { cause: error }); });
  return stdout;
};
const shell = (serial: string, command: string, seconds?: number) => adb(["-s", serial, "shell", command], seconds);
const emulators = async () => (await adb(["devices"])).split("\n").map((line) => line.split("\t")[0]).filter((serial) => /^emulator-\d+$/.test(serial));
const avds = () => execFileSync(sdk("emulator/emulator"), ["-list-avds"], { encoding: "utf8", timeout: 60_000 }).split("\n");

type Target = { serial: string; exited: Promise<never> };

const exit = (child: ChildProcess, log: string) => new Promise<never>((_, reject) =>
  child.once("exit", (code) => reject(new Error(`The emulator exited with ${code} before it booted; see ${log}`))));

async function emulatorTarget(avd: string): Promise<Target> {
  const serials = await emulators();
  const names = await Promise.all(serials.map((serial) => adb(["-s", serial, "emu", "avd", "name"], 30).then((out) => out.split(/\r?\n/)[0], () => undefined)));
  const running = serials[names.indexOf(avd)];
  if (running) return { serial: running, exited: new Promise<never>(() => {}) };
  const port = Array.from({ length: 64 }, (_, i) => 5554 + 2 * i).find((p) => !serials.includes(`emulator-${p}`));
  if (port === undefined) throw new Error("Every emulator port from 5554 to 5680 is taken");
  const log = path.join(artifacts, `emulator-${avd}.log`);
  const output = openSync(log, "w");
  const child = spawn(sdk("emulator/emulator"), ["-avd", avd, "-port", String(port), "-gpu", "host", "-no-window", "-no-audio", "-no-boot-anim", "-no-snapshot-save"], { detached: true, stdio: ["ignore", output, output] });
  child.unref();
  return { serial: `emulator-${port}`, exited: exit(child, log) };
}

const Reply = Schema.Struct({ id: Schema.optional(Schema.Number), result: Schema.optional(Schema.Unknown), error: Schema.optional(Schema.Struct({ message: Schema.String })) });
const Nothing = Schema.Struct({});
const Evaluated = Schema.Struct({ result: Schema.Struct({ value: Schema.optional(Schema.Unknown) }) });
const Document = Schema.Struct({ root: Schema.Struct({ nodeId: Schema.Number }) });
const AXNodes = Schema.Struct({ nodes: Schema.Array(Schema.Struct({ ignored: Schema.Boolean, role: Schema.optional(Schema.Struct({ value: Schema.Unknown })), backendDOMNodeId: Schema.optional(Schema.Number) })) });
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
  socket.addEventListener("message", (message) => {
    const reply = Schema.decodeUnknownSync(Reply)(JSON.parse(String(message.data)));
    const waiter = reply.id === undefined ? undefined : pending.get(reply.id);
    if (reply.error) waiter?.reject(new Error(reply.error.message));
    else waiter?.resolve(reply.result);
  });
  socket.addEventListener("close", () => { for (const waiter of pending.values()) waiter.reject(new Error("Grace's WebView closed its debugging socket")); });
  let next = 0;
  const send = async <S extends Schema.ConstraintDecoder<unknown>>(method: string, params: object, schema: S, signal: AbortSignal): Promise<S["Type"]> => {
    signal.throwIfAborted();
    const id = next++;
    const result = await new Promise<unknown>((resolve, reject) => {
      const abort = () => reject(signal.reason);
      signal.addEventListener("abort", abort, { once: true });
      const settle = <A>(then: (value: A) => void) => (value: A) => { pending.delete(id); signal.removeEventListener("abort", abort); then(value); };
      pending.set(id, { resolve: settle(resolve), reject: settle(reject) });
      socket.send(JSON.stringify({ id, method, params }));
    }).finally(() => pending.delete(id));
    return Schema.decodeUnknownSync(schema)(result);
  };

  const until = async (expression: string, signal: AbortSignal) => {
    const frame = `new Promise((done) => requestAnimationFrame(() => { try { done(Boolean(${expression})); } catch { done(false); } }))`;
    for (;;) {
      const { result } = await send("Runtime.evaluate", { expression: frame, awaitPromise: true, returnByValue: true }, Evaluated, signal)
        .catch((error: unknown) => { if (error instanceof Error && error.message.includes("context was destroyed")) return { result: { value: false } }; throw error; });
      if (result.value === true) return;
    }
  };

  const find = async (name: string, signal: AbortSignal) => {
    const { root } = await send("DOM.getDocument", { depth: 0 }, Document, signal);
    const { nodes } = await send("Accessibility.queryAXTree", { nodeId: root.nodeId, accessibleName: name }, AXNodes, signal);
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
    await send("DOM.scrollIntoViewIfNeeded", { backendNodeId: node }, Nothing, signal);
    const { quads: [quad] } = await send("DOM.getContentQuads", { backendNodeId: node }, Quads, signal);
    if (!quad) throw new Error(`"${name}" is not on screen`);
    const x = (quad[0] + quad[2] + quad[4] + quad[6]) / 4, y = (quad[1] + quad[3] + quad[5] + quad[7]) / 4;
    for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 }, Nothing, signal);
  };

  return {
    until,
    async step(step: Step) {
      const signal = AbortSignal.timeout(120_000);
      if ("tap" in step) return tap(step.tap, signal);
      if ("into" in step) {
        await tap(step.into, signal);
        return void await send("Input.insertText", { text: step.type }, Nothing, signal);
      }
      if ("press" in step) {
        for (const type of ["keyDown", "keyUp"]) await send("Input.dispatchKeyEvent", { type, key: step.press, code: step.press, windowsVirtualKeyCode: 13, ...(type === "keyDown" ? { text: "\r" } : {}) }, Nothing, signal);
        return;
      }
      return until(`document.body.innerText.includes(${JSON.stringify(step.expect)})`, signal);
    },
    close: () => socket.close(),
  };
}

const failing = (what: string) => (error: unknown) => { throw new Error(`${what} failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error }); };

async function deliver({ serial, exited }: Target, exercise: ReadonlyArray<Step>) {
  await Promise.race([adb(["-s", serial, "wait-for-device", "shell", 'while [ "$(getprop sys.boot_completed)" != 1 ]; do sleep 1; done'], 900), exited]);
  await adb(["-s", serial, "install", "-r", path.join(artifacts, "launcher-debug.apk")], 300);
  await shell(serial, `cmd package set-home-activity ${activity}`);
  const started = await shell(serial, "am start -W -a android.intent.action.MAIN -c android.intent.category.HOME", 120);
  if (!started.includes(`Activity: ${activity}`)) throw new Error(`Grace is not Home on ${serial}:\n${started}`);
  process.stdout.write(`${serial} ${/Current WebView package \(name, version\): \((.*)\)/.exec(await shell(serial, "dumpsys webviewupdate"))?.[1] ?? "WebView unknown"}\n`);
  const pid = (await shell(serial, `for i in $(seq 120); do pid=$(pidof ${identity.appId}); case "$pid" in *" "*) echo "$pid"; exit;; "") ;; *) grep -q "webview_devtools_remote_$pid$" /proc/net/unix && echo "$pid" && exit;; esac; sleep 1; done`, 180)).trim();
  if (!/^\d+$/.test(pid)) throw new Error(`Expected one process of Grace with a debuggable WebView on ${serial}, found "${pid}"`);
  const port = (await adb(["-s", serial, "forward", "tcp:0", `localabstract:webview_devtools_remote_${pid}`])).trim();
  try {
    const targets = Schema.decodeUnknownSync(Targets)(await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(120_000) })
      .then((response) => response.json()).catch(failing("Listing Grace's WebView pages")));
    const host = targets.find((target) => target.type === "page" && target.url.startsWith("https://localhost"))?.webSocketDebuggerUrl;
    if (!host) throw new Error(`Grace's WebView is not debuggable on ${serial}`);
    const page = await devTools(host, AbortSignal.timeout(120_000)).catch(failing("Opening Grace's WebView debugging socket"));
    try {
      await page.until(`[...document.querySelectorAll("[aria-current=true]")].some((e) => e.textContent.trim() === "Home")`, AbortSignal.timeout(60_000)).catch(failing("Waiting for Home"));
      for (const step of exercise) {
        await page.step(step).catch(failing(JSON.stringify(step)));
        process.stdout.write(`${JSON.stringify(step)} ok\n`);
      }
    } finally {
      page.close();
    }
  } finally {
    await adb(["-s", serial, "forward", "--remove", `tcp:${port}`]);
  }
  if ((await shell(serial, "dumpsys window")).includes("Application Not Responding")) throw new Error(`An app is not responding on ${serial}`);
  process.stdout.write(`${serial} Grace is Home and responding\n`);
}

if (import.meta.main) {
  const options = parseArgs({ options: { release: { type: "boolean" }, verify: { type: "boolean" }, install: { type: "string" }, emulator: { type: "string" }, exercise: { type: "string" } } }).values;
  const { verify, release, install, emulator, exercise } = Schema.decodeUnknownSync(Arguments)(options);
  if (install && emulator) throw new Error("Give --install <emulator serial> or --emulator <avd>, not both");
  if (exercise && !install && !emulator) throw new Error("--exercise needs --install <emulator serial> or --emulator <avd>");
  if (install && !(await emulators()).includes(install)) throw new Error(`No emulator ${install} is attached`);
  if (emulator && !avds().includes(emulator)) throw new Error(`No AVD named ${emulator}`);
  const steps = exercise ? Schema.decodeUnknownSync(Schema.NonEmptyArray(Step))(readJson(path.join(app, "test/device", `${exercise}.json`))) : [];
  if (verify) writeApkManifest();
  else {
    buildAndroid({ release });
    const target = install ? { serial: install, exited: new Promise<never>(() => {}) } : emulator && await emulatorTarget(emulator);
    if (target) await deliver(target, steps);
  }
}

import { createHash } from "node:crypto";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { openSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { parseArgs } from "node:util";
import { Schema } from "effect";
import { buildAndroidConsumer } from "../../../vendor/eliza/packages/app/scripts/mobile/android/build-consumer.mjs";
import { generateAndroidConsumerHost } from "../../../vendor/eliza/packages/app/scripts/mobile/android/consumer-host.mjs";
import { readApkSignerDigest } from "../../../vendor/eliza/packages/app/scripts/mobile/artifact-inspection/apk-distribution.mjs";
import { resolveAndroidSdkRoot, resolveJavaHome } from "../../../vendor/eliza/packages/app/scripts/mobile/toolchain.ts";
import config from "../capacitor.config.ts";

const app = path.resolve(import.meta.dirname, "..");
const artifacts = path.join(app, "artifacts");
const flavors = ["launcher", "standalone"];
const activity = `${config.appId}/.MainActivity`;
const project = Schema.decodeUnknownSync(Schema.Struct({ android: Schema.Struct({ path: Schema.String }) }))(config).android.path;
const forbiddenEntry = /\.(gguf|onnx)$|llama|ggml|elizainference|omnivoice|(^|\/)(tts|asr)\//i;

const readJson = (file: string): unknown => JSON.parse(readFileSync(file, "utf8"));
const profile = readJson(path.join(app, "android/host.json"));
const { signing } = Schema.decodeUnknownSync(Schema.Struct({ signing: Schema.Record(Schema.String, Schema.String) }))(profile);
const keystore = signing.storeFile;

const EmulatorSerial = Schema.String.check(Schema.isPattern(/^emulator-\d+$/));
const Step = Schema.Union([
  Schema.Struct({ tap: Schema.String }),
  Schema.Struct({ type: Schema.String, into: Schema.String }),
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
    identity: { appId: config.appId, appName: config.appName, version, versionCode: versionCode(version) },
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
const adb = (...args: string[]) => execFileSync(sdk("platform-tools/adb"), args, { encoding: "utf8" });
const shell = (serial: string, command: string) => adb("-s", serial, "shell", command);
const emulators = () => adb("devices").split("\n").map((line) => line.split("\t")[0]).filter((serial) => /^emulator-\d+$/.test(serial));

function emulatorSerial(avd: string): string {
  if (!execFileSync(sdk("emulator/emulator"), ["-list-avds"], { encoding: "utf8" }).split("\n").includes(avd)) throw new Error(`No AVD named ${avd}`);
  const serials = emulators();
  const running = serials.find((serial) =>
    spawnSync(sdk("platform-tools/adb"), ["-s", serial, "emu", "avd", "name"], { encoding: "utf8", timeout: 10_000 }).stdout?.split(/\r?\n/)[0] === avd);
  if (running) return running;
  const port = Array.from({ length: 64 }, (_, i) => 5554 + 2 * i).find((p) => !serials.includes(`emulator-${p}`));
  const log = openSync(path.join(artifacts, `emulator-${avd}.log`), "w");
  spawn(sdk("emulator/emulator"), ["-avd", avd, "-port", String(port), "-gpu", "host", "-no-window", "-no-audio", "-no-boot-anim", "-no-snapshot-save"], { detached: true, stdio: ["ignore", log, log] }).unref();
  return `emulator-${port}`;
}

async function devTools(url: string) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve); socket.addEventListener("error", reject); });
  const pending = new Map<number, { resolve: (result: unknown) => void; reject: (error: Error) => void }>();
  socket.addEventListener("message", (message) => {
    const reply = JSON.parse(String(message.data)) as { id?: number; result?: unknown; error?: { message: string } };
    const waiter = pending.get(reply.id ?? -1);
    pending.delete(reply.id ?? -1);
    if (reply.error) waiter?.reject(new Error(reply.error.message));
    else waiter?.resolve(reply.result);
  });
  let next = 0;
  const send = <T>(method: string, params: object = {}) => new Promise<T>((resolve, reject) => {
    pending.set(next, { resolve: (result) => resolve(result as T), reject });
    socket.send(JSON.stringify({ id: next++, method, params }));
  });

  const until = async (expression: string, what: string, signal: AbortSignal) => {
    while (!signal.aborted) {
      const { result } = await send<{ result: { value?: unknown } }>("Runtime.evaluate",
        { expression: `new Promise((done) => requestAnimationFrame(() => done(Boolean(${expression}))))`, awaitPromise: true, returnByValue: true })
        .catch((error: Error) => { if (error.message.includes("context was destroyed")) return { result: {} }; throw error; });
      if (result.value === true) return;
    }
    throw new Error(`Timed out waiting for ${what}`);
  };

  const find = async (name: string) => {
    const { root } = await send<{ root: { nodeId: number } }>("DOM.getDocument", { depth: 0 });
    const { nodes } = await send<{ nodes: { ignored: boolean; role?: { value: string }; backendDOMNodeId?: number }[] }>(
      "Accessibility.queryAXTree", { nodeId: root.nodeId, accessibleName: name });
    return nodes.find((node) => !node.ignored && node.role?.value !== "StaticText" && node.backendDOMNodeId !== undefined)?.backendDOMNodeId;
  };

  const tap = async (name: string, signal: AbortSignal) => {
    let node = await find(name);
    while (node === undefined && !signal.aborted) {
      await until("true", "a frame", signal);
      node = await find(name);
    }
    if (node === undefined) throw new Error(`Timed out waiting for something named "${name}"`);
    await send("DOM.scrollIntoViewIfNeeded", { backendNodeId: node });
    const { quads: [quad] } = await send<{ quads: number[][] }>("DOM.getContentQuads", { backendNodeId: node });
    const x = (quad[0] + quad[2] + quad[4] + quad[6]) / 4, y = (quad[1] + quad[3] + quad[5] + quad[7]) / 4;
    for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
  };

  return {
    until,
    async step(step: Step) {
      const signal = AbortSignal.timeout(30_000);
      if ("tap" in step) return tap(step.tap, signal);
      if ("into" in step) return tap(step.into, signal).then(() => send("Input.insertText", { text: step.type }));
      return until(`document.body.innerText.includes(${JSON.stringify(step.expect)})`, `"${step.expect}"`, signal);
    },
    close: () => socket.close(),
  };
}

async function deliver(serial: string, exercise: Step[]) {
  adb("-s", serial, "wait-for-device", "shell", 'while [ "$(getprop sys.boot_completed)" != 1 ]; do sleep 1; done');
  adb("-s", serial, "install", "-r", path.join(artifacts, "launcher-debug.apk"));
  shell(serial, `cmd package set-home-activity ${activity}`);
  const started = shell(serial, "am start -W -a android.intent.action.MAIN -c android.intent.category.HOME");
  if (!started.includes(`Activity: ${activity}`)) throw new Error(`Grace is not Home on ${serial}:\n${started}`);
  process.stdout.write(`${serial} ${/Current WebView package \(name, version\): \((.*)\)/.exec(shell(serial, "dumpsys webviewupdate"))?.[1] ?? "WebView unknown"}\n`);
  const pid = shell(serial, `pidof ${config.appId}`).trim();
  shell(serial, `until grep -q webview_devtools_remote_${pid} /proc/net/unix; do sleep 1; done`);
  const port = adb("-s", serial, "forward", "tcp:0", `localabstract:webview_devtools_remote_${pid}`).trim();
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json() as { type: string; url: string; webSocketDebuggerUrl: string }[];
  const host = targets.find((target) => target.type === "page" && target.url.startsWith("https://localhost"));
  if (!host) throw new Error(`Grace's WebView is not debuggable on ${serial}`);
  const page = await devTools(host.webSocketDebuggerUrl);
  await page.until(`[...document.querySelectorAll("[aria-current=true]")].some((e) => e.textContent.trim() === "Home")`, "Home", AbortSignal.timeout(60_000));
  for (const step of exercise) {
    await page.step(step);
    process.stdout.write(`${JSON.stringify(step)} ok\n`);
  }
  page.close();
  adb("-s", serial, "forward", "--remove", `tcp:${port}`);
  if (shell(serial, "dumpsys window").includes("Application Not Responding")) throw new Error(`An app is not responding on ${serial}`);
  process.stdout.write(`${serial} Grace is Home and responding\n`);
}

if (import.meta.main) {
  const options = parseArgs({ options: { release: { type: "boolean" }, verify: { type: "boolean" }, install: { type: "string" }, emulator: { type: "string" }, exercise: { type: "string" } } }).values;
  const { verify, release, install, emulator, exercise } = Schema.decodeUnknownSync(Arguments)(options);
  if (install && emulator) throw new Error("Give --install <emulator serial> or --emulator <avd>, not both");
  if (exercise && !install && !emulator) throw new Error("--exercise needs --install <emulator serial> or --emulator <avd>");
  if (install && !emulators().includes(install)) throw new Error(`No emulator ${install} is attached`);
  const steps = exercise ? Schema.decodeUnknownSync(Schema.NonEmptyArray(Step))(readJson(path.join(app, "test/device", `${exercise}.json`))) : [];
  if (verify) writeApkManifest();
  else {
    buildAndroid({ release });
    const serial = install ?? (emulator && emulatorSerial(emulator));
    if (serial) await deliver(serial, steps);
  }
}

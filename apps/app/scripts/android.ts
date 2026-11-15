// Grace's Android APKs (README.md, "Android"): upstream Eliza generates the Gradle host from
// android/host.json and builds it with buildAndroidConsumer, after Vite builds the web UI and
// Capacitor copies it in.
//   node scripts/android.ts [--release] [--install]
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { parseArgs } from "node:util";
import { buildAndroidConsumer } from "../../../vendor/eliza/packages/app/scripts/mobile/android/build-consumer.mjs";
import { generateAndroidConsumerHost } from "../../../vendor/eliza/packages/app/scripts/mobile/android/consumer-host.mjs";
import { readApkSignerDigest } from "../../../vendor/eliza/packages/app/scripts/mobile/artifact-inspection/apk-distribution.mjs";
import { resolveAndroidSdkRoot, resolveJavaHome } from "../../../vendor/eliza/packages/app/scripts/mobile/toolchain.ts";
import config from "../capacitor.config.ts";

const app = path.resolve(import.meta.dirname, "..");
const artifacts = path.join(app, "artifacts");
const profile = JSON.parse(readFileSync(path.join(app, "android/host.json"), "utf8")) as { signing: Record<string, string> };
const keystore = profile.signing.storeFile;
const flavors = ["launcher", "standalone"];

/** The newest installed SDK build-tools' `name` (apksigner, aapt); scripts/aosp.ts uses it too. */
export function buildTool(name: string): string {
  const tools = path.join(resolveAndroidSdkRoot(), "build-tools");
  const versions = readdirSync(tools).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return path.join(tools, versions.at(-1)!, name);
}

const environment = () => ({
  ...process.env,
  ANDROID_HOME: resolveAndroidSdkRoot(),
  JAVA_HOME: resolveJavaHome(),
  // Gradle resolves a relative keystore against the generated app module; resolve it against the
  // directory the command was run from instead (pnpm sets INIT_CWD to it and runs in the package).
  ...(process.env[keystore]?.trim() ? { [keystore]: path.resolve(process.env.INIT_CWD ?? process.cwd(), process.env[keystore]) } : {}),
});

/** package.json's MAJOR.MINOR.PATCH as one increasing integer, MAJOR·10⁶ + MINOR·10³ + PATCH:
 * a release raises the version, so Android installs it over the last. */
const versionCode = (version: string) => {
  const parts = /^(\d+)\.(\d{1,3})\.(\d{1,3})$/.exec(version);
  if (!parts) throw new Error(`package.json version ${version} is not MAJOR.MINOR.PATCH below 1000`);
  return Number(parts[1]) * 1e6 + Number(parts[2]) * 1e3 + Number(parts[3]);
};

/** Builds both flavors' debug APKs into artifacts/<flavor>-debug.apk, and with `release` their
 * release APKs: <flavor>-release.apk, signed, when every variable host.json's `signing` names is
 * set (Gradle refuses a partial set, and buildAndroidConsumer an unsigned result), otherwise
 * <flavor>-release-unsigned.apk. */
export function buildAndroid({ release = false } = {}): string[] {
  const { version } = JSON.parse(readFileSync(path.join(app, "package.json"), "utf8")) as { version: string };
  generateAndroidConsumerHost({
    consumerRoot: app,
    upstreamRoot: path.resolve(app, "../../vendor/eliza"),
    // pnpm links packages from its store; the Capacitor module is named inside its own real directory.
    dependencyRoot: realpathSync(path.dirname(createRequire(import.meta.url).resolve("@capacitor/android/package.json"))),
    output: path.join(app, config.android!.path!),
    identity: { appId: config.appId, appName: config.appName, version, versionCode: versionCode(version) },
    profile,
  });
  // A debug build replaces only the debug APKs: earlier release APKs would sit unverified beside
  // this build's manifest. (A release build drops the other release form itself.)
  if (!release) for (const flavor of flavors) for (const suffix of ["", "-unsigned"])
    rmSync(path.join(artifacts, `${flavor}-release${suffix}.apk`), { force: true });
  return buildAndroidConsumer({
    root: app,
    environment: environment(),
    variants: flavors,
    release,
    lint: false,
    androidTest: false,
    daemon: true,
    project: config.android!.path!,
    output: "artifacts",
    signing: { environment: Object.values(profile.signing) },
    prepare: [
      { command: path.join(app, "node_modules/.bin/vite"), args: ["build"] },
      { command: path.join(app, "node_modules/.bin/cap"), args: ["copy", "android"] },
    ],
    verify: { command: process.execPath, args: [import.meta.filename, "--verify"] },
  }).files;
}

/** buildAndroidConsumer's verifier: artifacts/apk-manifest.json names each APK beside it, all of
 * them this build's (buildAndroid clears older release APKs), with its SHA-256 and, unless
 * unsigned, the signer apksigner verified. */
function writeApkManifest() {
  const apksigner = buildTool("apksigner");
  const apks = readdirSync(artifacts).filter((name) => flavors.some((flavor) => name.startsWith(`${flavor}-`)) && name.endsWith(".apk"));
  writeFileSync(path.join(artifacts, "apk-manifest.json"), JSON.stringify(apks.map((name) => {
    const file = path.join(artifacts, name);
    return { name, sha256: createHash("sha256").update(readFileSync(file)).digest("hex"),
      signer: name.endsWith("-unsigned.apk") ? null : readApkSignerDigest(file, { apksigner }) };
  }), null, 2));
}

if (import.meta.main) {
  const { values } = parseArgs({ options: { release: { type: "boolean" }, install: { type: "boolean" }, verify: { type: "boolean" } } });
  if (values.verify) writeApkManifest();
  else {
    buildAndroid({ release: values.release });
    if (values.install) {
      // The device adb picks (ANDROID_SERIAL when several are attached).
      const adb = path.join(resolveAndroidSdkRoot(), "platform-tools/adb");
      execFileSync(adb, ["install", "-r", path.join(artifacts, "launcher-debug.apk")], { stdio: "inherit" });
      execFileSync(adb, ["shell", "am", "start", "-n", `${config.appId}/.MainActivity`], { stdio: "inherit" });
    }
  }
}

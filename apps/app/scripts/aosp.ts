import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {parseArgs} from "node:util";
import {Schema} from "effect";
import {isAndroidExecutableForAbi} from "@elizaos/os/android/android-runtime-inventory.mjs";
import {
  createDevelopmentLauncherDescriptor, listAndroidArtifactEntries, readAndroidArtifactEntryBuffers,
  readApkSignerDigest, snapshotAndroidArtifact, stageLauncher, validateDescriptor,
} from "@elizaos/os/image";
import {buildTool as tool, identity as capacitor, imageRuntime} from "./android.ts";

const {appId, appName} = capacitor;
const identity = {brand: appName.toLowerCase(), moduleName: appName, packageName: appId};
const defaultPermissions = ["android.permission.RECORD_AUDIO"];
const product = path.resolve(import.meta.dirname, "../aosp");
const staged = path.resolve(import.meta.dirname, "../artifacts/aosp");

const Sha256 = Schema.String.check(Schema.isPattern(/^([0-9a-f]{2}:?){31}[0-9a-f]{2}$/i));
const Arguments = Schema.Union([
  Schema.Struct({apk: Schema.NonEmptyString, browser: Schema.NonEmptyString, development: Schema.Literal(true)}),
  Schema.Struct({apk: Schema.NonEmptyString, browser: Schema.NonEmptyString, development: Schema.Literal(false), signer: Sha256}),
]);
const {values} = parseArgs({options: {apk: {type: "string"}, browser: {type: "string"}, development: {type: "boolean", default: false}, signer: {type: "string"}}});
const args = Schema.decodeUnknownSync(Arguments, {onExcessProperty: "error"})(values);
const {apk, browser, development} = args;

const targetAbi = "x86_64";
const requiredRuntime = `lib/${targetAbi}/libeliza_node.so`;
const chromium = {
  "packageName": "org.chromium.chrome",
  "versionCode": "807200079",
  "versionName": "156.0.8072.0",
  "sha256": "750b839d8b7fd3dd3ca43268cc5a8c4ac3ab57ae051a2b1b2814984f5b8c9cc1",
  "signerSha256": "32a2fc74d731105859e5a85df16d95f102d85b22099b8064c5d8915c61dad1e0"
};
fs.mkdirSync(path.dirname(staged), {recursive: true});
const scratch = fs.mkdtempSync(path.join(path.dirname(staged), ".grace-aosp-"));
const pending = path.join(scratch, "overlay");
let output: string;
try {
  if (!fs.lstatSync(apk).isFile()) throw new Error("The launcher APK must be a regular file");
  const stagedApk = path.join(scratch, "launcher.apk");
  fs.copyFileSync(apk, stagedApk);
  const archive = await imageRuntime.runPromise(snapshotAndroidArtifact(stagedApk));
  const artifact = {artifactBytes: archive.bytes};
  const entries = await imageRuntime.runPromise(listAndroidArtifactEntries(stagedApk, artifact));
  const nodeRuntimes = entries.filter(entry => /^lib\/[^/]+\/libeliza_node\.so$/.test(entry));
  if (nodeRuntimes.length !== 1 || nodeRuntimes[0] !== requiredRuntime) {
    throw new Error(`The x86_64 Cuttlefish launcher requires one x86_64 Eliza Node runtime, found ${nodeRuntimes.join(", ") || "none"}`);
  }
  const [executable] = await imageRuntime.runPromise(readAndroidArtifactEntryBuffers(stagedApk, [requiredRuntime], artifact));
  if (!executable || !isAndroidExecutableForAbi(Buffer.from(executable), targetAbi)) {
    throw new Error("The Eliza Node executable in the Cuttlefish launcher is not an x86_64 Android binary");
  }
  const apksigner = tool("apksigner");
  const pin = "signer" in args
    ? {schemaVersion: 1, ...identity, apkSha256: archive.sha256, certificateSha256: args.signer.replaceAll(":", "").toLowerCase()}
    : await imageRuntime.runPromise(createDevelopmentLauncherDescriptor({identity, apk: stagedApk, apksigner, development: true}));
  const descriptor = await imageRuntime.runPromise(validateDescriptor({...pin, defaultPermissions, partition: "product"}));
  const reviewed = path.join(scratch, "launcher.json");
  fs.writeFileSync(reviewed, JSON.stringify(descriptor));
  await imageRuntime.runPromise(stageLauncher({descriptor: reviewed, apk: stagedApk, output: pending, aapt: tool("aapt"), apksigner,
    development, nativeAbi: targetAbi, provisioning: {
      assistant: {tag: "NoAssistant"}, requires: {autofill: false, allFilesAccess: false},
      telephonyRoles: false, lockScreen: "LauncherMayUseLockScreen",
    }}));
  const browserDir = path.join(pending, "browser");
  fs.mkdirSync(browserDir);
  if (!fs.lstatSync(browser).isFile()) throw new Error("The Chromium APK must be a regular file");
  const browserApk = path.join(browserDir, "Chromium.apk");
  fs.copyFileSync(browser, browserApk);
  if (createHash("sha256").update(fs.readFileSync(browserApk)).digest("hex") !== chromium.sha256)
    throw new Error("The Chromium APK differs from the reviewed x86_64 build");
  const badging = execFileSync(tool("aapt"), ["dump", "badging", browserApk], {encoding: "utf8"});
  const expected = `package: name='${chromium.packageName}' versionCode='${chromium.versionCode}' versionName='${chromium.versionName}'`;
  if (!badging.startsWith(expected) || await imageRuntime.runPromise(readApkSignerDigest(browserApk, {apksigner})) !== chromium.signerSha256)
    throw new Error("The browser package, version or signer differs from the reviewed Chromium build");
  fs.writeFileSync(path.join(browserDir, "Android.bp"), `android_app_import {
    name: "GraceChromium",
    apk: "Chromium.apk",
    presigned: true,
    preprocessed: true,
    product_specific: true,
    dex_preopt: { enabled: false },
}
`);
  fs.writeFileSync(path.join(browserDir, "browser.mk"), "PRODUCT_PACKAGES_DEBUG += GraceChromium\n");
  fs.cpSync(product, pending, {recursive: true, filter: (source) => path.basename(source) !== "README.md"});
  const destination = path.join(staged, `grace-${descriptor.apkSha256.slice(0, 12)}`);
  fs.rmSync(staged, {recursive: true, force: true});
  fs.mkdirSync(staged);
  fs.renameSync(pending, destination);
  output = destination;
} finally {
  fs.rmSync(scratch, {recursive: true, force: true});
}
const listing = fs.readdirSync(output, {recursive: true, encoding: "utf8"}).filter((file) => fs.statSync(path.join(output, file)).isFile()).sort();
process.stdout.write(`${output}\n${listing.map((file) => `  ${file} ${fs.statSync(path.join(output, file)).size}`).join("\n")}\nChromium ${chromium.packageName} ${chromium.versionName} for x86_64, signer ${chromium.signerSha256}\n`);

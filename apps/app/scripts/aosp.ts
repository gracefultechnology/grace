import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import os from "node:os";
import {parseArgs} from "node:util";
import {Schema} from "effect";
import {createDevelopmentLauncherDescriptor, stageLauncher, validateDescriptor} from "../../../vendor/eliza/packages/os/scripts/android/stage-launcher-overlay.ts";
import {readBrowserAppPins, selectPin, stageBrowserOverlay} from "../../../vendor/eliza/packages/os/scripts/android/stage-browser-apps.ts";
import {buildTool as tool, identity as capacitor} from "./android.ts";

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

const chromium = selectPin(readBrowserAppPins(path.resolve(import.meta.dirname, "../../../vendor/eliza/packages/os/android/vendor/eliza")), "chromium", "x86_64");
const pin = "signer" in args
  ? {schemaVersion: 1, ...identity, apkSha256: createHash("sha256").update(fs.readFileSync(apk)).digest("hex"), certificateSha256: args.signer.replaceAll(":", "").toLowerCase()}
  : createDevelopmentLauncherDescriptor({identity, apk, apksigner: tool("apksigner"), development: true});
const descriptor = validateDescriptor({...pin, defaultPermissions, partition: "product"});
const output = path.join(staged, `grace-${descriptor.apkSha256.slice(0, 12)}`);
const pending = path.join(staged, "pending");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "grace-aosp-"));
try {
  fs.rmSync(staged, {recursive: true, force: true});
  fs.writeFileSync(path.join(scratch, "launcher.json"), JSON.stringify(descriptor));
  stageLauncher({descriptor: path.join(scratch, "launcher.json"), apk, output: pending, aapt: tool("aapt"), apksigner: tool("apksigner"),
    development, provisioning: {assistant: false}});
  stageBrowserOverlay({
    descriptor: {vendor: "vendor/grace", modulePrefix: appName, partition: "product",
      browser: {packageName: chromium.packageName, sha256: chromium.sha256, signerSha256: chromium.signerSha256}},
    browserApk: browser, output: pending, apksigner: tool("apksigner"), aapt: tool("aapt"),
  });
  fs.cpSync(product, pending, {recursive: true, filter: (source) => path.basename(source) !== "README.md"});
  fs.renameSync(pending, output);
} finally {
  fs.rmSync(scratch, {recursive: true, force: true});
  fs.rmSync(pending, {recursive: true, force: true});
}
const listing = fs.readdirSync(output, {recursive: true, encoding: "utf8"}).filter((file) => fs.statSync(path.join(output, file)).isFile()).sort();
process.stdout.write(`${output}\n${listing.map((file) => `  ${file} ${fs.statSync(path.join(output, file)).size}`).join("\n")}\nChromium ${chromium.packageName} ${chromium.versionName} for x86_64, signer ${chromium.signerSha256}\n`);

import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import os from "node:os";
import {parseArgs} from "node:util";
import {Schema} from "effect";
import {createDevelopmentLauncherDescriptor, stageLauncher, validateDescriptor} from "@elizaos/os/aosp/stage-launcher-overlay.ts";
import {buildTool as tool, identity as capacitor} from "./android.ts";

const {appId, appName} = capacitor;
const identity = {brand: appName.toLowerCase(), moduleName: appName, packageName: appId};
const defaultPermissions = ["android.permission.RECORD_AUDIO"];

const Sha256 = Schema.String.check(Schema.isPattern(/^([0-9a-f]{2}:?){31}[0-9a-f]{2}$/i));
const Arguments = Schema.Union([
  Schema.Struct({apk: Schema.NonEmptyString, development: Schema.Literal(true)}),
  Schema.Struct({apk: Schema.NonEmptyString, development: Schema.Literal(false), signer: Sha256}),
]);
const {values} = parseArgs({options: {apk: {type: "string"}, development: {type: "boolean", default: false}, signer: {type: "string"}}});
const args = Schema.decodeUnknownSync(Arguments, {onExcessProperty: "error"})(values);
const {apk, development} = args;

const pin = "signer" in args
  ? {schemaVersion: 1, ...identity, apkSha256: createHash("sha256").update(fs.readFileSync(apk)).digest("hex"), certificateSha256: args.signer.replaceAll(":", "").toLowerCase()}
  : createDevelopmentLauncherDescriptor({identity, apk, apksigner: tool("apksigner"), development: true});
const descriptor = validateDescriptor({...pin, defaultPermissions, partition: "product"});
const output = path.resolve(import.meta.dirname, `../artifacts/aosp/grace-${descriptor.apkSha256.slice(0, 12)}`);
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "grace-aosp-"));
try {
  fs.writeFileSync(path.join(scratch, "launcher.json"), JSON.stringify(descriptor));
  fs.rmSync(output, {recursive: true, force: true});
  stageLauncher({descriptor: path.join(scratch, "launcher.json"), apk, output, aapt: tool("aapt"), apksigner: tool("apksigner"),
    development, provisioning: {assistant: false}});
} finally {
  fs.rmSync(scratch, {recursive: true, force: true});
}
for (const file of ["AndroidProducts.mk", "grace_cf_x86_64_phone.mk"]) fs.copyFileSync(path.resolve(import.meta.dirname, "../aosp", file), path.join(output, file));
process.stdout.write(`${output}\n`);

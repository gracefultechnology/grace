// Stages a Grace launcher APK as the AOSP directory vendor/grace with upstream's stager:
// Launcher.apk, Android.bp, product.mk, the first-boot RECORD_AUDIO grant, Grace as default
// HOME, and the product makefiles in ../aosp. ../aosp/README.md builds and boots it.
import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import os from "node:os";
import {parseArgs} from "node:util";
import {createDevelopmentLauncherDescriptor, stageLauncher, validateDescriptor} from "../../../vendor/eliza/packages/os/scripts/android/stage-launcher-overlay.ts";
import capacitor from "../capacitor.config.ts";
import {buildTool as tool} from "./android.ts";

const identity = {brand: capacitor.appName!.toLowerCase(), moduleName: capacitor.appName!, packageName: capacitor.appId!};
// Hey Grace and voice replies (spec/app/wake.md), granted on first boot and revocable; every other permission is asked at first use.
const defaultPermissions = ["android.permission.RECORD_AUDIO"];

const {values} = parseArgs({options: {apk: {type: "string"}, development: {type: "boolean", default: false}, signer: {type: "string"}}});
// --development pins the APK's own signer and admits a debuggable APK; --signer pins a release certificate.
if (!values.apk || values.development === Boolean(values.signer))
  throw new Error("Usage: node scripts/aosp.ts --apk PATH (--development | --signer SHA256)");

const pin = values.development
  ? createDevelopmentLauncherDescriptor({identity, apk: values.apk, apksigner: tool("apksigner"), development: true})
  : {schemaVersion: 1, ...identity, apkSha256: createHash("sha256").update(fs.readFileSync(values.apk)).digest("hex"), certificateSha256: values.signer!.replaceAll(":", "").toLowerCase()};
const descriptor = validateDescriptor({...pin, defaultPermissions, partition: "product"});
const output = path.resolve(import.meta.dirname, `../artifacts/aosp/grace-${descriptor.apkSha256.slice(0, 12)}`);
// stageLauncher reads the descriptor from a file, stages atomically and refuses an existing output.
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "grace-aosp-"));
try {
  fs.writeFileSync(path.join(scratch, "launcher.json"), JSON.stringify(descriptor));
  fs.rmSync(output, {recursive: true, force: true});
  // Default HOME on first boot, from the staged APK's own MAIN/HOME/DEFAULT activity; Grace holds no assistant role.
  stageLauncher({descriptor: path.join(scratch, "launcher.json"), apk: values.apk, output, aapt: tool("aapt"), apksigner: tool("apksigner"),
    development: values.development, provisioning: {assistant: false}});
} finally {
  fs.rmSync(scratch, {recursive: true, force: true});
}
for (const file of ["AndroidProducts.mk", "grace_cf_x86_64_phone.mk"]) fs.copyFileSync(path.resolve(import.meta.dirname, "../aosp", file), path.join(output, file));
console.log(output);

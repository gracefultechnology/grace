# Grace on AOSP Cuttlefish

`scripts/aosp.ts` stages a launcher APK as `vendor/grace` with the upstream
stager in `vendor/eliza/packages/os/aosp`: Grace installed in
`/product/app/Grace`, `RECORD_AUDIO` granted on first boot (revocable), Grace as
default HOME on first boot, and the product makefiles in this directory.

The stock Cuttlefish product needs a launcher with the x86_64 agent runtime.
Build on an x86_64 Linux host set up for Cuttlefish
([source.android.com/docs/devices/cuttlefish](https://source.android.com/docs/devices/cuttlefish/get-started)).

```sh
# 1. Stage (in apps/app). --development admits a debug-signed APK; a signed release APK
#    (README.md, "Android") takes --signer <cert SHA-256>, the "certificate SHA-256 digest" of
#    apksigner verify --print-certs artifacts/launcher-release.apk
pnpm android --abi x86_64
pnpm aosp --apk artifacts/launcher-debug.apk --development   # prints artifacts/aosp/grace-<sha>

# 2. Copy into an Android 17 tree
#    (repo init -u https://android.googlesource.com/platform/manifest -b android-17.0.0_r1 && repo sync)
rm -rf "$AOSP/vendor/grace" && cp -R artifacts/aosp/grace-<sha> "$AOSP/vendor/grace"

# 3. Lunch and build
cd "$AOSP" && source build/envsetup.sh && lunch grace_cf_x86_64_phone-cp2a-userdebug && m

# 4. Boot; -resume=false gives a fresh first boot, when the HOME and permission defaults apply
launch_cvd --daemon -resume=false
```

## Verify after boot

```sh
adb wait-for-device && adb shell 'while [ "$(getprop sys.boot_completed)" != 1 ]; do sleep 2; done'
adb shell cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME
#   last line: technology.graceful.grace/<its HOME activity>
adb shell dumpsys package technology.graceful.grace | grep RECORD_AUDIO
#   android.permission.RECORD_AUDIO: granted=true
adb shell pm path technology.graceful.grace
#   package:/product/app/Grace/Grace.apk
```

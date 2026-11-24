# Grace on AOSP Cuttlefish

User QA runs the launcher APK on the tablet's stock Android (`apps/app/README.md`, "On the
tablet"). This image is the later route, and it is staged, not built: no one has yet built it or
booted it, which needs an x86_64 Linux host set up for Cuttlefish
([source.android.com/docs/devices/cuttlefish](https://source.android.com/docs/devices/cuttlefish/get-started)).

`scripts/aosp.ts` stages `vendor/grace` with the Eliza OS launcher stager and Grace’s pinned browser, into `artifacts/aosp/grace-<sha>` (an earlier staging is
removed; nothing is left behind when a check fails):

| Staged | Is |
|---|---|
| `Launcher.apk`, `product.mk`, `provisioning/` | Grace in `/product/app/Grace`, Grace the default HOME, no permission granted on first boot: Grace asks for each when she needs it |
| `native-x86_64/`, `Android.bp`, `config.fs`, `native-libraries.json` | the APK's own `lib/x86_64` libraries, `libeliza_node.so` among them, installed in `/product/app/Grace/lib/x86_64` (Android never extracts a bundled app's libraries) by one `prebuilt_app_native` module each, the agent's Node executable with mode 0755; `native-libraries.json` lists each with its SHA-256 and names the `build/soong` patch the rule needs |
| `browser/` | upstream's pinned Chromium, `org.chromium.chrome` 156.0.8072.0 for x86_64, a product app, so a website's own sign-in and the browser sign-in route have a browser to open |
| `grace_cf_x86_64_tablet.mk`, `AndroidProducts.mk` | the product: the Cuttlefish x86_64 device, `tablet` characteristics, time zone `America/New_York` |
| `overlay/` | Android's first-boot settings: no lock screen, a 30-minute screen timeout, automatic time zone off |

The Chromium APK is never downloaded by the script. Download [Chromium snapshot 1703955](https://storage.googleapis.com/chromium-browser-snapshots/AndroidDesktop_x64/1703955/chrome-android-desktop.zip), unzip it, and pass the APK whose SHA-256 is the pinned one; a different file, signer,
package or version is refused. It is a development snapshot, so only a `userdebug` image takes it.

Websites inside Grace are drawn by the image's WebView, not by Chromium: the stock
`com.android.webview` that `android-17.0.0_r1` builds from `external/chromium-webview`. With no
Google services it has no update channel; its version is what the first-boot check prints, and a
run on a `google_apis` emulator (Google's updated WebView) says nothing about it.

Grace is Home but not a kiosk, for the pilot: the stock launcher and Android's Settings stay, an
edge swipe shows the bars, and Android's Settings, Apps, Default apps, Home app gives Home back to
Grace or to the stock launcher if Grace cannot start.

```sh
# 1. Stage (in apps/app). --development admits a debug-signed APK; without it the release APK
#    (README.md, "Android") must be signed by the certificate in android/release-signer.json, the
#    one the production App Links document publishes
pnpm android --abi x86_64
pnpm aosp --apk artifacts/launcher-debug.apk --development --browser <Chromium APK>

# 2. Copy into an Android 17 tree
#    (repo init -u https://android.googlesource.com/platform/manifest -b android-17.0.0_r1 && repo sync)
rm -rf "$AOSP/vendor/grace" && cp -R artifacts/aosp/grace-<sha> "$AOSP/vendor/grace"

# 3. Android 17 Cuttlefish ignores Android.mk, so the native libraries need build/soong's
#    prebuilt_app_native rule: check that the tree is the one aosp.lock.json pins (the cuttlefish
#    profile, manifest android-17.0.0_r1) and that build/soong is at the patch's revision, then apply it
#    (step 1 already refused a patch whose SHA-256 differs from the one upstream pins)
P=../../vendor/eliza/packages/os/aosp/patches/soong-app-native
test "$(git -C "$AOSP/.repo/manifests" rev-parse HEAD)" = "$(node -p 'require("../../vendor/eliza/packages/os/aosp/aosp.lock.json").profiles.cuttlefish.manifest.commit')"
test "$(git -C "$AOSP/build/soong" rev-parse HEAD)" = "$(node -p "require('$P/manifest.json').revision")"
git -C "$AOSP/build/soong" apply "$(pwd)/$P/soong-app-native.patch"

# 4. Lunch and build
cd "$AOSP" && source build/envsetup.sh && lunch grace_cf_x86_64_tablet-cp2a-userdebug && m

# 5. Boot a fresh first boot, when the HOME, permission and settings defaults apply, on the
#    1280×800 landscape display at 160 dpi of the prototype
launch_cvd --daemon -resume=false --display0=width=1280,height=800,dpi=160
```

## Checks after first boot

QA signs this output.

```sh
adb wait-for-device && adb shell 'while [ "$(getprop sys.boot_completed)" != 1 ]; do sleep 2; done'
adb shell cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME
#   last line: technology.graceful.grace/.MainActivity
adb shell dumpsys package technology.graceful.grace | sed -n '/runtime permissions:/,$p' | grep 'granted=true'
#   nothing: no runtime permission is granted before Grace asks
adb shell ls -l /product/app/Grace/lib/x86_64/libeliza_node.so
#   -rwxr-xr-x root root, the agent's Node executable
adb shell pm path technology.graceful.grace
#   package:/product/app/Grace/Grace.apk
adb shell pm path org.chromium.chrome
#   package:/product/app/GraceChromium/GraceChromium.apk
adb shell dumpsys webviewupdate | grep 'Current WebView package'
#   record the package and version
adb shell 'getprop ro.build.characteristics; wm size; wm density'
#   tablet, Physical size: 1280x800, Physical density: 160
adb shell cmd lock_settings get-disabled
#   true
adb shell 'settings get system screen_off_timeout; settings get global auto_time_zone; getprop persist.sys.timezone'
#   1800000, 0, America/New_York
adb shell settings get secure location_mode
#   the image does not set it; 0 is off, and Grace's Wi-Fi scan needs it on (Android's Settings, Location)
pnpm android --abi x86_64 --install 0.0.0.0:6520
#   on a --development image: the walk of README.md, "Android", on Cuttlefish instead of an emulator
#   it installs a fresh APK over the system app, which then runs from /data with its own libraries,
#   so the ls check above is what covers /product/app/Grace/lib/x86_64; a signer mismatch cannot be
#   fixed by uninstalling a system app, so build the APK with the key the image was staged with
```

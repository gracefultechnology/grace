# Grace on AOSP Cuttlefish

User QA runs the launcher APK on the tablet's stock Android (`apps/app/README.md`, "On the
tablet"). This image is the later route, and it is staged, not built: no one has yet built it or
booted it, which needs an x86_64 Linux host set up for Cuttlefish
([source.android.com/docs/devices/cuttlefish](https://source.android.com/docs/devices/cuttlefish/get-started)).

`scripts/aosp.ts` stages `vendor/grace` with upstream's stagers in
`vendor/eliza/packages/os/scripts/android`, into `artifacts/aosp/grace-<sha>` (an earlier staging is
removed; nothing is left behind when a check fails):

| Staged | Is |
|---|---|
| `Launcher.apk`, `product.mk`, `provisioning/` | Grace in `/product/app/Grace`, `RECORD_AUDIO` granted on first boot (revocable), Grace the default HOME |
| `browser/` | upstream's pinned Chromium, `org.chromium.chrome` 156.0.8072.0 for x86_64, a product app, so a website's own sign-in and the browser sign-in route have a browser to open |
| `grace_cf_x86_64_tablet.mk`, `AndroidProducts.mk` | the product: the Cuttlefish x86_64 device, `tablet` characteristics, time zone `America/New_York` |
| `overlay/` | Android's first-boot settings: no lock screen, a 30-minute screen timeout, automatic time zone off |

The Chromium APK is never downloaded by the script. Take `chrome-android-desktop.zip` from the
`sourceUrl` that `vendor/eliza/packages/os/android/vendor/eliza/manifests/browser-apps.json` pins for
`x86_64`, unzip it, and pass the APK whose SHA-256 is the pinned one; a different file, signer,
package or version is refused. It is a development snapshot, so only a `userdebug` image takes it.

Websites inside Grace are drawn by the image's WebView, not by Chromium: the stock
`com.android.webview` that `android-17.0.0_r1` builds from `external/chromium-webview`. With no
Google services it has no update channel; its version is what the first-boot check prints, and a
run on a `google_apis` emulator (Google's updated WebView) says nothing about it.

Grace is Home but not a kiosk, for the pilot: the stock launcher and Android's Settings stay, an
edge swipe shows the bars, and Android's Settings, Apps, Default apps, Home app gives Home back to
Grace or to the stock launcher if Grace cannot start.

```sh
# 1. Stage (in apps/app). --development admits a debug-signed APK; a signed release APK
#    (README.md, "Android") takes --signer <cert SHA-256>, the "certificate SHA-256 digest" of
#    apksigner verify --print-certs artifacts/launcher-release.apk
pnpm aosp --apk artifacts/launcher-debug.apk --development --browser <Chromium APK>

# 2. Copy into an Android 17 tree
#    (repo init -u https://android.googlesource.com/platform/manifest -b android-17.0.0_r1 && repo sync)
rm -rf "$AOSP/vendor/grace" && cp -R artifacts/aosp/grace-<sha> "$AOSP/vendor/grace"

# 3. Lunch and build
cd "$AOSP" && source build/envsetup.sh && lunch grace_cf_x86_64_tablet-cp2a-userdebug && m

# 4. Boot a fresh first boot, when the HOME, permission and settings defaults apply, on the
#    1280×800 landscape display at 160 dpi of the prototype
launch_cvd --daemon -resume=false --display0=width=1280,height=800,dpi=160
```

## Checks after first boot

QA signs this output.

```sh
adb wait-for-device && adb shell 'while [ "$(getprop sys.boot_completed)" != 1 ]; do sleep 2; done'
adb shell cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME
#   last line: technology.graceful.grace/.MainActivity
adb shell dumpsys package technology.graceful.grace | grep RECORD_AUDIO
#   android.permission.RECORD_AUDIO: granted=true
adb shell pm path technology.graceful.grace
#   package:/product/app/Grace/Grace.apk
adb shell pm path org.chromium.chrome
#   package:/product/app/GraceOwnedChromium/GraceOwnedChromium.apk
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
```

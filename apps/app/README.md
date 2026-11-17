# @repo/app

Grace's tablet interface. Its requirements are [`spec/app/index.md`](../../spec/app/index.md), in the one spec
tree at the repository root; `pnpm check` there generates `gen/` here and checks this package's types, tests
and traces (SPEC.md, "One spec tree").

| Piece | Is |
|---|---|
| `src/app.vibe` | the application's layers: the workspace machine (`spec/app/workspace.md`) as the one app state, the page layer machine (`spec/app/surface.md`) beside it, and the native page |
| `src/nativePage.vibe`, `src/surfacePlugin.ts` | the native page plugin as an Effect service; with no plugin (Vite in a browser) every command succeeds at once |
| `src/page.vibe` | the page layer's host side: native pages follow the tabs, and a Grace control is drawn over the page only after the host routes its rect |
| `src/useApp.ts`, `src/PageLayer.tsx` | React hooks over both machines; what the interface measures (`PageArea`, `OverPage`) |
| `src/App.tsx`, `src/Browser.tsx`, `src/Grace.tsx` | Home, the browser window and Grace's window, on `@repo/ui` |
| `test/app.browser.test.tsx` | the journey "Use the website under Grace's controls", with the plugin faked at its boundary (`pnpm test:browser`) |

| Command | Does |
|---|---|
| `pnpm dev` | the app, with Vite |
| `pnpm typecheck`, `pnpm build` | `vibelang --noEmit`; `vite build` to `dist/` |
| `pnpm test`, `pnpm test:browser` | the tests in Node, with the derived property tests; the browser tests in Chromium |

## Android

Start with `git submodule update --init vendor/eliza`: the build uses upstream Eliza's Android scripts.
`pnpm android` (Node 26, JDK 21, Android SDK platform 36 with build-tools 36.0.0; `ANDROID_HOME` and
`JAVA_HOME`, or their usual install paths) writes `artifacts/{launcher,standalone}-debug.apk`.
`--release` adds each flavor's release APK: `<flavor>-release.apk`, signed, when `GRACE_KEYSTORE`
(absolute, or relative to the directory you ran the command from: `INIT_CWD` under pnpm, otherwise
the working directory), `GRACE_KEYSTORE_PASSWORD`,
`GRACE_KEY_ALIAS` and `GRACE_KEY_PASSWORD` are all set (`signing` in `android/host.json`; Gradle
refuses a partial set, and the build fails if they are set and a release comes out unsigned),
otherwise `<flavor>-release-unsigned.apk`. `artifacts/apk-manifest.json` lists each APK this build
produced with its size, its SHA-256 and the signer the newest installed build-tools' `apksigner`
verified; a debug build removes release APKs left by an earlier `--release` run. The build fails if
an APK carries an on-device model or local inference: a `.gguf`, `.onnx`, `.ort`, `.tflite`,
`.safetensors`, `.pte` or `.task` file, a native library in any directory named for llama, ggml,
mtmd, onnxruntime, sherpa, whisper, piper, executorch, `elizainference` or `omnivoice`, a
`llama-server` or `llama-omnivoice-server`, or a `tts/`, `asr/`, `model/` or `models/` directory under
`assets/` outside the web UI's `assets/public/`. Both flavors' `versionCode` is `package.json`'s
version, MAJOR·10⁶ + MINOR·10³ + PATCH, so raise the version for each release.

### On the emulator

```sh
avdmanager create avd -n <avd> -k "system-images;android-36;google_apis;arm64-v8a" -d pixel_tablet
sed -i '' -e 's/^hw.gpu.enabled=.*/hw.gpu.enabled=yes/' -e 's/^hw.ramSize=.*/hw.ramSize=4096/' \
  ~/.android/avd/<avd>.avd/config.ini
pnpm --filter @repo/app android --emulator <avd> --exercise home
```

makes a fresh tablet AVD (2560×1600 at 320 dpi, host graphics, 4 GB), then builds, attaches to the
named AVD or boots it without a window and with host graphics (`-gpu host`; its log in
`artifacts/emulator-<avd>.log`), waits for `sys.boot_completed`, installs the launcher debug APK,
makes Grace Home (`cmd package set-home-activity`), waits up to 10 minutes for the HOME intent to
resolve to her (an image's first-boot set-up, such as `google_apis`'s `googlesdksetup`, holds Home at
a higher priority until it has run), starts Home and fails unless Grace is what Home opens, her
WebView shows the Home screen (the rail's Home is current) and no `am_anr` event since the install
names her, printing those events when one does. Other processes' are counted, not failed: on a busy
host the image's own (the phone, Google Play services, the launcher, SystemUI) keep timing out for
minutes after boot. It prints the emulator's WebView package and version. Every `adb` call has a
time limit (the boot 15 minutes, the install 5) and is killed when the command exits, and an
emulator that exits before it boots fails the command with its log. An emulator the command booted
is stopped when the command fails or is interrupted, and left running when it succeeds, for the next
`--install`; stop it with `adb -s emulator-<port> emu kill`. `--install emulator-<port>` does the
same on an emulator that is already running and never stops it; it refuses any serial that is not
an emulator's, so a tablet on USB is never touched.

`--exercise <name>` then walks `test/device/<name>.json` in Grace's WebView over its debugging socket:
an array of steps, each `{ "tap": "<accessible name>" }`, `{ "type": "<text>", "into": "<accessible
name>" }`, `{ "press": "Enter" }` or `{ "expect": "<text on screen>" }`, each given two minutes; a step
with any other key or an empty name is refused before the build, and a tap fails when no visible thing
or more than one has that name. A failed wait or step names the page's address, visibility, current
rail item and opening text. Each feature adds its own file; `home.json` walks
`spec/app/shell.md`, "Story: Reach everyday tasks from Home".

A run of `develop` at `c8849b1` with this check, on an AVD made as above on a host with a load
average between 140 and 370: both debug APKs passed the content check at 11,203,659 and 11,203,523
bytes, the cold boot took 5 minutes, the WebView was `com.google.android.webview` 133.0.6943.137,
all 19 steps of `home.json` passed, and it ended `Grace is Home and responding; other processes
raised 32 am_anr events since the install` and exited 0 in 14 minutes. Run again with `--install`
while Grace was stopped (`run-as technology.graceful.grace kill -STOP`) and tapped, it failed naming
her `Input dispatching timed out` event, with the step that could not finish as its cause. Every
WebView wait has a time limit that keeps the command alive until it fires, so a debugging socket
that goes quiet fails its step instead of letting the command exit with Node's code 13.
Interrupted with SIGTERM while booting, the command exited 143 and stopped the emulator it had
started; a plain build has no handler and dies on the signal.

`scripts/android.ts` generates the Gradle host in `android/generated/` (git-ignored) from
`android/host.json` with upstream Eliza's `generateAndroidConsumerHost` (`vendor/eliza`, Gradle and
AGP 8.13), then upstream's `buildAndroidConsumer` builds the web UI with Vite, copies it in with
`cap copy android`, runs Gradle and copies the APKs out. The host's inputs are in `android/`: the
manifests, `MainActivity.java` and `res/`. Both flavors may ask for location and the camera, for a
website, after the person's Allow.

| Flavor | Is | `BuildConfig.IS_LAUNCHER` |
|---|---|---|
| `launcher` | the tablet's Home (HOME intent filter); Back never leaves it; Grace's own Wi-Fi settings (upstream `ElizaWiFi`, with Wi-Fi permissions) | `true` |
| `standalone` | an ordinary app; Wi-Fi is the system's, with no Wi-Fi permission | `false` |

The website is ElizaSurfaceManager's `below-host` surface, a WebView under the transparent bridge
WebView. Android Back is dispatched to the web UI as a cancelable `hardware-back` event; unconsumed,
the launcher dispatches `launcher-home` and the standalone app leaves.

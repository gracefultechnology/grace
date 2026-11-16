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
otherwise `<flavor>-release-unsigned.apk`. `artifacts/apk-manifest.json` lists each APK this build produced
with its size, its SHA-256 and the signer the newest installed build-tools' `apksigner` verified; a debug
build removes release APKs left by an earlier `--release` run. The build fails if an APK carries an
on-device model or local inference: a `.gguf`, `.onnx`, `.ort`, `.tflite`, `.safetensors`, `.pte` or
`.task` file, a native library under `lib/` named for llama, ggml, onnxruntime, sherpa, whisper, piper,
executorch, `elizainference` or `omnivoice`, or a `tts/`, `asr/`, `model/` or `models/` directory. Both flavors' `versionCode` is `package.json`'s
version, MAJOR·10⁶ + MINOR·10³ + PATCH, so raise the version for each release.

### On the emulator

```sh
pnpm --filter @repo/app android --emulator <avd> --exercise home
```

builds, then attaches to the named AVD or boots it without a window and with host graphics (`-gpu host`; its log in
`artifacts/emulator-<avd>.log`), waits for `sys.boot_completed` and for the emulator image's own set-up to mark the device provisioned, installs the launcher debug APK, makes Grace
Home (`cmd package set-home-activity`), starts Home and fails unless Grace is what Home opens, her WebView
shows the Home screen (the rail's Home is current) and `dumpsys window` shows no "Application Not
Responding". It prints the emulator's WebView package and version, and leaves the emulator running. Every
`adb` call has a time limit (the boot 15 minutes, the install 5) and is killed when the command exits,
and an emulator that exits before it boots fails the command with its log. `--install emulator-<port>` does the same
on an emulator that is already running; it refuses any serial that is not an emulator's, so a tablet
on USB is never touched.

`--exercise <name>` then walks `test/device/<name>.json` in Grace's WebView over its debugging socket: an
array of steps, each `{ "tap": "<accessible name>" }`, `{ "type": "<text>", "into": "<accessible name>" }`, `{ "press": "Enter" }`
or `{ "expect": "<text on screen>" }`, each given two minutes; a step with any other key is refused before the build, and a tap fails when no visible thing or more
than one has that name. Each feature adds its own file;
`home.json` walks Home.

The command has been run on `grace-tablet-2` (API 35, 1280x800). The tablet's panel is 2560x1600 at
320 dpi, which an API 36 `google_apis` arm64-v8a AVD with 4 GB matches; that AVD has not been run with
the command yet.

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

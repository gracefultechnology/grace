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

Run `git submodule update --init vendor/eliza` from the repository root. Grace uses the Android
consumer host, APK checks, WebView surface and Wi-Fi bridge from the pinned Eliza Vibestack OS package.
The Android build generates the Eliza Core and Agent owners from the pinned checkout and builds
the device entry and its verified bundle in `vendor/eliza/packages/agent/dist/bundle`. The build
downloads each target's pinned Node runtime from Eliza's public Android Node prerelease when the
executable and build manifest are absent in `vendor/eliza/packages/os/dist/android/<abi>`. The
runtime lock is Eliza's `packages/os/aosp/runtime/node.lock.json`. The OS stager checks the runtime digest,
ELF ABI and Android interpreter, then inventories the bundle, PGlite assets and native executable
in `artifacts/agent-runtime/<pinned-commit>/<abi>`.

`pnpm android` (Node 26,
JDK 21, Android SDK platform 36 with build-tools 36.0.0; `ANDROID_HOME` and `JAVA_HOME`, or their
usual install paths) writes `artifacts/{launcher,standalone}-debug.apk` for one processor type,
`--abi arm64-v8a` (the default: the tablet and an Apple silicon emulator) or `--abi x86_64`.
`--release` adds each flavor's release APK: `<flavor>-release.apk`, signed, when `GRACE_KEYSTORE`
(absolute, or relative to the directory you ran the command from: `INIT_CWD` under pnpm, otherwise
the working directory), `GRACE_KEYSTORE_PASSWORD`,
`GRACE_KEY_ALIAS` and `GRACE_KEY_PASSWORD` are all set (`signing` in `android/host.json`; Gradle
refuses a partial set, and the build fails if they are set and a release comes out unsigned),
otherwise `<flavor>-release-unsigned.apk`. `artifacts/apk-manifest.json` lists each APK this build
produced with its processor type, size, SHA-256 and the signer the newest installed build-tools'
`apksigner` verified; a debug build removes release APKs left by an earlier `--release` run. The build
fails unless an APK carries the agent (`assets/agent/agent.mjs`, `libeliza_node.so` for exactly
one processor type, `assets/agent/inventory.json` and every file that inventory lists, which the
service unpacks before it starts), and if it carries an on-device model or local
inference: a `.gguf`, `.onnx`, `.ort`, `.tflite`,
`.safetensors`, `.pte` or `.task` file, a native library in any directory named for llama, ggml,
mtmd, onnxruntime, sherpa, whisper, piper, executorch, `elizainference` or `omnivoice`, a
`llama-server` or `llama-omnivoice-server`, or a `tts/`, `asr/`, `model/` or `models/` directory under
`assets/` outside the web UI's `assets/public/`. Upstream's payload still carries
`assets/agent/llama-kernel-diagnostic.mjs`, a 3 KB script that only lists which llama.cpp files and
kernels a directory holds; it loads no model or library, and the check lets it pass. Both flavors'
`versionCode` is `package.json`'s version, MAJOR·10⁶ + MINOR·10³ + PATCH, so raise the version for each release.

### On the emulator

```sh
sdkmanager "system-images;android-36;google_apis;arm64-v8a"
avdmanager create avd -n <avd> -k "system-images;android-36;google_apis;arm64-v8a" -d pixel_tablet
sed -i '' -e 's/^hw.gpu.enabled=.*/hw.gpu.enabled=yes/' -e 's/^hw.ramSize=.*/hw.ramSize=4096/' \
  ~/.android/avd/<avd>.avd/config.ini
pnpm --filter @repo/app android --emulator <avd> --exercise home
```

On an x86_64 host add `--abi x86_64` to that last line, or the arm64 APK will not install.

makes a fresh tablet AVD (2560×1600 at 320 dpi, host graphics, 4 GB) on an Apple silicon Mac (an
x86_64 host takes the `x86_64` image, and GNU `sed` takes `-i` without `''`), then builds, attaches
to the named AVD or boots it without a window and with host graphics (`-gpu host`; its log in
`artifacts/emulator-<avd>.log`), waits for `sys.boot_completed`, installs the launcher debug APK,
makes Grace Home (`cmd package set-home-activity`), waits up to 10 minutes for the HOME intent to
resolve to her (an image's first-boot set-up, such as `google_apis`'s `googlesdksetup`, holds Home
at a higher priority until it has run), starts Home and fails unless Grace is what Home opens, her
WebView shows the Home screen (the rail's Home is current) and no `am_anr` event since the install
began names her or one of her processes. Whatever fails after the boot, her events are named first
when there are any, with that failure as their cause. Other processes' are counted, not failed: on a
busy host the image's own (the phone, Google Play services, the launcher, SystemUI) keep timing out
for minutes after boot. It prints the emulator's WebView package and version. Every `adb` call has a
time limit (the boot 15 minutes, the install 5) and is killed when the command exits, and an
emulator that exits before it boots fails the command with its log. An emulator the command booted
is stopped when the command fails or is interrupted, and left running when it succeeds, for the next
`--install`; stop it with `adb -s emulator-<port> emu kill`. `--install emulator-<port>` does the
same on an emulator that is already running and never stops it; it refuses any serial that is not an
emulator's, so a tablet on USB is never touched.

`--exercise <name>` then walks `test/device/<name>.json` in Grace's WebView over its debugging
socket: an array of steps, each `{ "tap": "<accessible name>" }`, `{ "type": "<text>", "into":
"<accessible name>" }`, `{ "press": "Enter" }` or `{ "expect": "<text on screen>" }`, each given two
minutes; a step with any other key or an empty name is refused before the build, and a tap fails
when no visible thing or more than one has that name. Three steps check the agent: `{ "agent": {
"state": "<state>", "failure": "<cause>" } }` waits up to five minutes for the `EmbeddedAgent`
bridge's status to have that state (and cause), and fails at once when the status is `failed` with
another cause; the state is one of upstream's `unavailable`, `stopped`, `starting`, `running` and
`failed`, the cause one of `payload`, `storage`, `config`, `credential`, `agent`, `crashed` and
`runtime`, and any other is refused before the build; `{ "service": "<class>" }` waits up to two minutes
for `dumpsys activity services` to show that service of Grace's in the foreground; `{ "leaveFor":
"android.settings.<ACTION>" }` opens that Android settings page over Grace, asks Android to kill her
background processes (`am kill`), fails unless her process is the same one, and opens her again. A
failed wait or step names the page's address, visibility, current rail item, opening text and the
agent's status, and fails at once when Grace's WebView has closed its debugging socket. Each feature
adds its own file; `home.json` walks `spec/app/shell.md`, "Story: Reach everyday tasks from Home",
and `agent.json` the agent service below.

A run of `develop` at `c8849b1` with this check, on an AVD made as above on a host with a load
average between 140 and 370: both debug APKs passed the content check at 11,203,659 and 11,203,523
bytes, the cold boot took 5 minutes, the WebView was `com.google.android.webview` 133.0.6943.137,
all 19 steps of `home.json` passed, and it ended `Grace is Home and responding; other processes
raised 32 am_anr events since the install` and exited 0 in 14 minutes. Booted again with the current
script, the same AVD passed in 7 minutes with 5 other events. With `--install`, Grace stopped
(`run-as technology.graceful.grace kill -STOP`) and tapped failed the command in under a minute,
naming her `Input dispatching timed out` event with the step that could not finish as its cause;
Grace killed between two steps failed it in 19 seconds, the next step saying her WebView closed its
debugging socket. Interrupted with SIGTERM while booting, the command exited 143 and stopped the
emulator it had started; a plain build has no handler and dies on the signal.

`scripts/android.ts` generates the Gradle host in `android/generated/` (git-ignored) from
`android/host.json` with upstream Eliza's `generateAndroidConsumerHost` (`vendor/eliza`, Gradle and
AGP 8.13), then upstream's `buildAndroidConsumer` builds the web UI with Vite, copies it in with
`cap copy android`, runs Gradle and copies the APKs out. The host's inputs are in `android/`: the
manifests, `MainActivity.java`, `GraceAgentService.java`, `agent.json` and `res/`. Both flavors may
ask for location and the camera, for a website, after the person's Allow.

| Flavor | Is | `BuildConfig.IS_LAUNCHER` |
|---|---|---|
| `launcher` | the tablet's Home (HOME intent filter); Back never leaves it; Grace's own Wi-Fi settings (upstream `ElizaWiFi`, with Wi-Fi permissions) | `true` |
| `standalone` | an ordinary app; Wi-Fi is the system's, with no Wi-Fi permission | `false` |

The website is ElizaSurfaceManager's `below-host` surface, a WebView under the transparent bridge
WebView. Android Back is dispatched to the web UI as a cancelable `hardware-back` event; unconsumed,
the launcher dispatches `launcher-home` and the standalone app leaves.

### The agent

The Android host starts Eliza OS's `EmbeddedAgentService` as a `specialUse` foreground service.
`GraceAgentService` supplies the product notification and the signed-in device credential.
`EmbeddedAgent` admits only the method and path combinations in `android/agent.json` and reaches the
agent over an authenticated private Unix socket. The native service publishes a private launch document and writes
the child credential and loopback token on stdin. Startup waits for an authenticated health response
with the current launch epoch.

Grace opens the hosted account page in the system browser. After explicit device approval, the
Android App Link returns to `https://app.graceforseniors.com/android/auth/callback`. Android uses
the stored PKCE verifier to exchange the one-time code with
`https://api.graceforseniors.com/api/auth/device/exchange`. The device token and account IDs stay in
Android's encrypted, no-backup store. A Cloud acknowledgement activates the token before
Grace puts it into use. The app bridge reports only whether the device is signed in.
Signing out stops the device agent, removes the credential and requests revocation. The hosted app
must publish Android Digital Asset Links for the release signer to validate the callback.

`android/agent.json` names the Grace Cloud origin and admitted agent routes, `agent/character.json`
supplies the character, and `agent/policy.json` owns the action allowlist. The upstream agent
provides storage, Cloud models and the message service. The APK check rejects
declared actions outside the allowed or refused list and rejects bundled on-device inference models.

### Why the host is as it is

- The web UI is Capacitor's bridge WebView drawn over the website, which ElizaSurfaceManager keeps
  in a WebView below it (`below-host`). `ElizaBridgeActivity` owns the WebView lifecycle: no mixed
  content, renderer-death recovery and the stopped-page pause. The bridge WebView and every view up
  to the content frame are transparent; paper (`color.light.background` in
  `packages/design-system/tokens.json`, the window background) is painted beneath both WebViews, so
  the frame between a website resize and the next draw shows no dark window.
- The keyboard overlays the interface, which keeps its full height so the rail stays whole
  (`SystemBars` `insetsHandling: "disable"` in `capacitor.config.ts`); the web UI lifts its windows by
  the height ElizaSurfaceManager reports. Only the bars and a cutout inset the content. The bars stay
  hidden until a swipe from the edge shows them briefly; Android can restore them when focus returns.
  On API 29 the window draws under a cutout on a short edge; from API 30 under every cutout, since a
  tablet in landscape has it on a long edge.
- The transparent host is blended over the page every frame the page draws, so a website's endless
  animation redraws the window at the display's full rate: about 1.4 cores at 90 Hz on a 3.9 GB
  tablet. Where the display has a 60 Hz mode at its current resolution the window asks for it, again
  after a configuration change; elsewhere it clears its request.
- `RECORD_AUDIO` is for spoken replies and Talk, asked for at first use. A website's camera and
  location are asked for after the person's Allow and Android's own prompt
  (`spec/app/websiteRequests.md`); the launcher's Wi-Fi scan needs location too. Grace opts out of
  Android's camera compatibility rotation, which turned the display to portrait when a website opened
  the camera. `CHANGE_NETWORK_STATE`, which `ElizaWiFi`'s library manifest asks for, is removed:
  nothing in Grace requests a network; the standalone flavor removes its Wi-Fi permissions too, and
  `android.hardware.wifi` is not required (without it Grace's Wi-Fi settings say Wi-Fi is unavailable).
- The `<queries>` list the apps `openExternalLink` can resolve on API 30+: mail and text compose, the
  dial pad, maps, the store and apps with an https link filter; any other app is refused as
  `EXTERNAL_APP_UNAVAILABLE`.
- `app_icon.xml` is the logotype's G on a paper tile, 60 of 108 tall so the splash screen's circular
  crop keeps the whole letter.

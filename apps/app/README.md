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
| `scripts/android.ts`, `scripts/aosp.ts` | the Android and AOSP runners, checked by `pnpm typecheck` against upstream's Android tools read from their source. That needs `allowJs`, which also lets `src/` and `test/` import untyped JavaScript with loosely inferred types. `scripts/build-consumer.ts` derives the options of `buildAndroidConsumer` from `build-consumer.mjs` and retypes the five whose defaults infer `any`, `null` or `never[]`, so a renamed or removed export or option fails the typecheck. `toolchain.ts` leaves its parameters untyped, so `scripts/toolchain.d.ts` declares its two functions by hand, and a change to them shows only when a runner runs |

| Command | Does |
|---|---|
| `pnpm dev` | the app, with Vite |
| `pnpm typecheck`, `pnpm build` | Check types or build `dist/` from the current Grace model and design tokens. The Android and Cloud releases use this same web build. |
| `pnpm test`, `pnpm test:browser` | the tests in Node, with the derived property tests; the browser tests in Chromium |

## Browser qualification

Dispatch the CI workflow with BillWorld enabled to run the Fleet cohorts and
the released statement task. Fleet runs four deterministic shards against the
same pinned 100-biller cohort. The aggregate requires all 100 distinct
browser receipts. For a local Fleet run, set `GRACE_BILLWORLD_DIR` to the
pinned checkout used by CI. Set `GRACE_BILLWORLD_SHARD` to `1` through `4`
for a 25-biller run, or omit it to run the full cohort. Fleet requires Python 3
for its result-directory lock and an unmodified tracked Grace checkout.

To resume locally, set `GRACE_BILLWORLD_RESUME_DIR` to the existing
`fleet-*` directory containing `cohort.json`. Keep the same Grace commit,
BillWorld checkout, and shard setting. Use the browser command with
`--passWithNoTests` so an already complete shard can validate without
opening pages. To resume in CI, dispatch on the original Grace commit and
supply its workflow run ID in `billworld_resume_run`. Each shard must have
uploaded its receipt directory in that run.

Fleet preserves the initial cohort manifest and every completed receipt,
including failed grades. It runs only billers without a receipt and
rebuilds scores from the receipts. A stopped writer releases the directory
lock when its process exits. A score without a final receipt is rerun.
The final aggregate still requires 100 successful receipts from the
declared cohort at the same Grace commit.

The released case is `task_md9`, mapped upstream to `malden-view-bill-v1`.
CI checks out the public BillWorld revision
`8320228bccf0759f375b9633592612e0e570a526` and prepares the three public
WVU Medicine PDFs required to boot its shared host. The versioned CI cache
holds the original bytes. Preparation verifies the size and SHA-256 of each
file on both cache hits and fresh public downloads against the pinned
[upstream document manifest](https://github.com/gracefultechnology/billworld/blob/8320228bccf0759f375b9633592612e0e570a526/billworld/research/wvu-documents.json).
The Malden journey uses the shipped portal routes.

The simulated person uses the fixture account to sign in, opens the utility
account and current bill, and presents that statement to Grace. They submit
the released read-only question, review and start its read plan, and select
**Read statement**. The planner reply is scripted at the test boundary.
Grace reads the real fixture document and the upstream grader checks her
visible answer. The job requires a rejected zero-action control and all six
checks on the completed trial, including unchanged protected state and
credentials. CI uploads asset provenance and both grader receipts as
`billworld-released-task-md9`.

The standard verification job exercises Google sign-in and cross-app tasks in
Chromium. A resettable loopback provider serves OAuth consent, Gmail messages
and Calendar events for synthetic accounts. In **Gmail signup to Calendar**,
the person opens a clinic email and approves the appointment. The test reads
the saved event from that account’s calendar. A second journey checks a named browser page, two
appointment emails with the same subject, and a saved calendar event.
Rereading the first email leaves the second email step open. A third journey
checks that approving the plan and approving the calendar write are separate
decisions. The native chat journey checks that the person sees a browser plan
for review before starting it.

In GitHub Actions, dispatch `ci` with `cross_app_only` enabled to run these
four journeys with the usual Linux setup. CI uses the repository variable
`GRACE_CROSS_APP_RUNNER` as the runner label when set and otherwise uses
`ubuntu-latest`. This mode skips the benchmarks, repository-wide verification,
and verification cache and artifact uploads. The journeys use the local
provider and require no real accounts or hosted inference key.

After `pnpm gen`, run the same journeys locally with the following command.

```sh
pnpm --filter @repo/app test:browser test/mail.browser.test.tsx test/app.browser.test.tsx \
  -t 'Gmail signup to Calendar|Follow one reviewed plan across apps|Save a separately approved email appointment|Open a control from the agent reply'
```

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
Choose the cloud deployment at build time with `--cloud-profile`. The default
is `standalone-production` for Grace Cloud. `shared-production` uses Eliza Cloud
production. `shared-staging` uses Eliza Cloud staging and builds debug APKs only.
The choice applies to both flavors and fixes the account registration and callback,
the web bundle's cloud origins, and the embedded agent's inference endpoint.
Shared builds write their APKs, verification manifest and intermediate files under
`artifacts/cloud-profiles/<profile>/`. Use the same `--cloud-profile` with `--verify`.

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
`assets/` outside the web UI's `assets/public/`. It also lists classes in the APK's dex, rejects local inference classes and checks the native Grace account and speech bridge. Both flavors'
`versionCode` is `package.json`'s version, MAJOR·10⁶ + MINOR·10³ + PATCH, so raise the version for each release.

Every machine and CI sign debug builds with one key, `android/debug.keystore`, so a debug APK built
anywhere installs over one built elsewhere and the Google sign-in registration can name one
certificate. It is a throwaway debug key made for this with `keytool -genkeypair -keystore
android/debug.keystore -storepass android -keypass android -alias androiddebugkey -keyalg RSA
-keysize 2048 -validity 18250 -dname "CN=Grace Debug, O=Grace, C=US"`, never a release key and
never a copy of a developer's own `~/.android/debug.keystore`; its SHA-1 is
`18:C2:91:5A:D3:61:87:10:A5:7F:A3:94:D9:F4:82:4B:5E:6F:4F:58` and its SHA-256
`41:C2:73:72:4A:EA:BA:69:3F:1B:B0:91:A0:8B:E7:60:7E:75:AD:D8:A4:C4:19:9B:AF:69:50:0C:3A:89:C0:64`. The
build copies it into `android/generated/android-user/` and points Gradle's `ANDROID_USER_HOME` there.
Anyone holding the repository can sign a debug build with it, which is why no production registration
may list it.

User QA receives the release-signed APK. R8 shrinks the release build, Capacitor preserves its
plugin methods, and the content check enforces `debuggable=false`. The Grace release key for
`technology.graceful.grace` is held outside this repository. Supply the established key through
the four signing variables above. The [production App Links document](https://app.graceforseniors.com/.well-known/assetlinks.json)
publishes the certificate SHA-256. The SHA-1 for Android Google client registration is
`7D:9D:BF:44:E3:E5:D6:29:16:D3:DE:95:24:97:4A:A1:F6:10:D4:02`.

The ARM64 launcher and standalone APKs built from Grace `ace4d8e` and Eliza `3423598` are each
135,640,693 bytes. Both passed release certificate, package, agent payload, Node runtime and
16 KiB alignment checks. Only the launcher registers as Android Home.
[Release source](https://github.com/gracefultechnology/grace-new/pull/90)

### On the tablet

User QA runs the launcher release APK on the Lenovo TB336FU's own Android, which has Google Play
services and Chrome: the native Google account picker signs her in, and a website's own Google
sign-in opens in Chrome. The Grace image (`aosp/README.md`) is staged, not built. The person
preparing the tablet does this by hand; Grace's scripts refuse any serial that is not an emulator's.

1. In Android's Settings, About tablet, tap Build number seven times; in System, Developer options,
   turn on USB debugging, connect the tablet and allow the computer.
2. `adb -s <serial> install -r artifacts/launcher-release.apk`, with the serial `adb devices` lists. A
   tablet holding Grace signed by another key refuses it: `adb -s <serial> uninstall
   technology.graceful.grace` first, which deletes her data.
3. Make Grace Home: press Home and choose Grace, Always, or Settings, Apps, Default apps, Home app,
   Grace. A sideloaded launcher never asks to be Home, and only the Grace image makes her Home by
   itself. The stock launcher stays installed as the way back.
4. Android asks for the microphone at her first Talk; Settings, Apps, Grace, Permissions, Microphone
   grants or removes it.
5. Turn USB debugging off.

No model runs on the tablet, so the old minimums sized for models no longer apply: Grace needs what
her process and her agent hold (about 270 MB and 170 MB resident, measured below) and the storage
for the APK and what it unpacks (the ARM64 release APK above and its unpacked agent payload); a 4 GB tablet such as the TB336FU has room.

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
emulator's, so a tablet on USB is never touched. With `--release` the signed launcher release APK is
installed instead and the walk ends once Grace's process is running as Home; it needs the four
signing variables, and `--exercise` is refused, since a release build's page has no debugging
socket. An emulator holding Grace signed by another key (debug after release, or the reverse) has
her uninstalled, data and all, before the install.

`--exercise <name>` then walks `test/device/<name>.json` in Grace's WebView over its debugging
socket: an array of steps, each `{ "tap": "<accessible name>" }`, `{ "type": "<text>", "into":
"<accessible name>" }`, `{ "press": "Enter" }` or `{ "expect": "<text on screen>" }`, each given two
minutes; a step with any other key or an empty name is refused before the build, and a tap fails
when no visible thing or more than one has that name. `{ "call": "<Plugin>.<method>", "with": {
… }, "returns": { … } }` calls that native plugin's method in the page and fails unless it resolves
with a value holding everything `returns` names (nested objects compared the same way, other values
exactly); with `"refuses": "<message>"` in place of `returns` it fails unless the call rejects with
that message. `{ "key": "VOLUME_UP" }` or `"VOLUME_DOWN"` presses that hardware key (`input
keyevent`). Three steps check the agent: `{ "agent": {
"state": "<state>", "failure": "<cause>" } }` waits up to five minutes for the `EmbeddedAgent`
bridge's status to have that state (and cause), and fails at once when the status is `failed` with
another cause; the state is one of upstream's `unavailable`, `stopped`, `starting`, `running` and
`failed`, the cause one of `payload`, `storage`, `config`, `credential`, `agent`, `crashed` and
`runtime`, and any other is refused before the build; `{ "signIn": { "signedIn": <bool>, "google":
<bool> } }` reads the dedicated Grace account status and native Google configuration, rejects unexpected account fields, and checks the signed-in and Google-availability booleans; `{ "service": "<class>" }` waits up to two minutes
for `dumpsys activity services` to show that service of Grace's in the foreground; `{ "leaveFor":
"android.settings.<ACTION>" }` opens that Android settings page over Grace, asks Android to kill her
background processes (`am kill`), fails unless her process is the same one, and opens her again.
Seven steps reach the host directly: `{ "evaluate": "<expression>", "returns": <JSON> }` awaits the
expression in Grace's page and fails unless its value is that JSON, and `{ "evaluate": "<expression>",
"rejects": "<code>" }` unless it rejects with that code; `{ "grant": "android.permission.<NAME>" }`
grants Grace that permission, as the person's Allow would; `{ "forget": "<SSID>" }` forgets that
saved Wi-Fi network (`cmd wifi forget-network`); `{ "approve": "<label>" }` waits up to three
minutes for a button with that label outside Grace, such as Save in Android's "Save this network?"
dialog, and taps it, as the person would; `{ "notification": "<title>" }` opens
Android's settings over Grace, waits up to five minutes for a notification of hers with that title, and
opens her again; `{ "restart": "force-stop" }` force-stops Grace, opens Home and walks on in her new
process. A
failed wait or step names the page's address, visibility, current rail item, opening text and the
agent's status, and fails at once when Grace's WebView has closed its debugging socket. Each feature
adds its own file; `home.json` walks `spec/app/shell.md`, "Story: Reach everyday tasks from Home",
`agent.json` walks the agent service, `device-controls.json` speech and the device controls, `signin-status.json` sign-in, `wifi.json` the Wi-Fi page joining an open and a WPA2 network, and `records.json` the record store, reminders and signed-out Files refusal. On a disposable emulator signed in to its own QA account, `files.json` saves a PDF, reopens it after a process restart, renders its page and removes the file by its returned ID.

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

`scripts/android.ts` generates the standalone Grace Cloud Gradle host in `android/generated/`
and shared Eliza Cloud Gradle hosts in `artifacts/cloud-profiles/<profile>/gradle/` from
`android/host.json` with upstream Eliza's `generateAndroidConsumerHost` (`vendor/eliza`, Gradle and
AGP 8.13), then upstream's `buildAndroidConsumer` builds the web UI with Vite, copies it in with
`cap copy android`, runs Gradle and copies the APKs out. The host's inputs are in `android/`: the
manifests, `MainActivity.java`, `GraceAgentService.java`, `GraceSpeechPlugin.java`,
`GraceDevicePlugin.java`, `agent.json` and `res/`. Both flavors may
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

On standalone Grace Cloud devices with Google Play services and native Google enabled, Grace opens the
Android Google account picker. Cloud issues a one-time nonce tied to the device PKCE challenge.
Android sends the Google result directly to Cloud and exchanges the returned device code. The
Google ID token and PKCE verifier stay in the Android host.

Register an Android OAuth client for `technology.graceful.grace` with release certificate SHA-1
`7D:9D:BF:44:E3:E5:D6:29:16:D3:DE:95:24:97:4A:A1:F6:10:D4:02` in the same Google project as
Grace’s Web OAuth client. Credential Manager and Cloud token verification both use that Web
client ID. Enable native Google for this app in the Cloud registry after registration.

Grace uses the hosted account page in the system browser when the native picker is unavailable
or the person chooses browser sign-in. After explicit device approval, the
Android App Link returns to `https://app.graceforseniors.com/android/auth/callback`. Android uses
the stored PKCE verifier to exchange the one-time code with
`https://api.graceforseniors.com/api/auth/device/exchange`. The device token and account IDs stay in
Android's encrypted, no-backup store. A Cloud acknowledgement activates the token before
Grace puts it into use. The app bridge reports only whether the device is signed in.
Signing out stops the device agent, removes the credential and requests revocation. The hosted app
must publish Android Digital Asset Links for the release signer to validate the callback. Device
sessions expire after seven days, when the person signs in again. Standalone
password recovery uses a fresh approval on Grace Cloud's registered browser page.

Shared Eliza Cloud uses the selected deployment's registered App Link at
`/auth/grace/callback`. Password backup and recovery ask for fresh native Google
verification through Steward and a separate native choice for the action.
Each deployment accepts grants for its own acknowledged account and request.
Shared profiles compile Eliza’s shared Android authentication client from
`packages/auth/android`. It exchanges a fresh Steward session at
`POST /api/v1/app-auth/mobile/password-backup` and checks the returned account
and organization before recovery. The standalone profile uses Grace Cloud’s
browser approval and the native secure-store client. Each APK registers one
`GraceAccount` implementation.

`android/agent.json` names the admitted agent routes, `agent/character.json`
supplies the character, and `agent/policy.json` owns the action allowlist. The upstream agent
provides storage, the selected Cloud deployment's models and the message service. The APK check rejects
declared actions outside the allowed or refused list and rejects bundled on-device inference models.

### Records, reminders and files

Three bridges of Grace's own keep what must outlive her page and her process, in her app-private
storage (`no backup`, as `res/xml/data_extraction_rules.xml` says), registered by `MainActivity`:

| Bridge | Class | Keeps |
|---|---|---|
| `GraceRecords` | `GraceRecordStorePlugin` | the named durable records: `commitments`, `preferences`, `setup`, `memory` and `calendar`, each one file under `files/records/` |
| `GraceReminders` | `GraceRemindersPlugin` | upstream's reminder engine (`plugin-native-reminders`, the `eliza-reminders` module) |
| `GraceFiles` | `GraceFiles` | the signed-in account’s library of photos and PDFs under `no_backup/grace-files/` |

`GraceRecords.read({ name })` gives `{ revision, value }` (revision 0 and no value before the first
write). `write({ name, revision, value })` commits only when the record is still at the revision the
caller read, under a lock on the record's file that holds across processes, and rejects with `stale`
otherwise, so a late or concurrent write never replaces a newer one; the commit is Android's
`AtomicFile`, synced to disk before the rename, so a record is whole after a crash and readable
whatever happens to the WebView. This is the storage `spec/app/payment.md`, "A durable unresolved
window exists before either submission route is enabled", asks for. The page's own storage is not
used for any of them; the workspace itself stays in memory.

`GraceReminders` posts a reminder at its time on its own `grace-reminders-due` channel with Grace's
G, while her page, or her whole process, is gone. It holds `USE_EXACT_ALARM` (calendar reminders),
so Android 13 and later ring it on time; on Android 12 it asks for `SCHEDULE_EXACT_ALARM`, and without
it the engine falls back to an inexact alarm. Its receiver re-arms every reminder after a boot, an
update, or a change of time or time zone, and nothing else; it starts no activity and no agent.
Notifications need `POST_NOTIFICATIONS`, which the engine asks for at the first reminder. The engine
keeps its reminders, with their revisions, in its own preferences file; the routes of notification
taps, which upstream asks a host to keep in its own storage, go to `files/reminders/` through the same
atomic file write.

Every file operation requires a lease from `GraceFiles.open()` for the signed-in device account. `list({ lease })` returns entries with an opaque ID, display name, kind, saved time and PDF page count. `save({ lease, name, data })` stores a bounded, validated email attachment; `preview({ lease, id, page })` renders an image; `remove({ lease, id })` removes that entry from this account. `pick` and `capture` stage a file for the person to approve with `commit`. A sign-out or account switch invalidates the lease. The records device exercise needs a signed-in test account to write its PDF.

Upstream's camera, media and filesystem modules are not used: the camera module is an in-app CameraX
recorder and the media module a 13,000-line library with Media3 video editing, both far beyond
taking one photo and keeping a few files; the filesystem module is the agent's FILE action, with no
Android library. Upstream's notifications module mirrors other apps' and mail notices, which Grace
does not do. There is no printing: the product has none.

Grace starts with the tablet as Home: on the launcher flavor Android opens her at boot and
`MainActivity` starts the agent service, so no boot receiver starts anything. The standalone flavor
starts only when opened.

### Speech and the device

Grace requests a short-lived speech session through the signed-in GraceAccount bridge and streams audio to Grace Cloud. The microphone permission is requested only when the person chooses to speak.

`GraceDevice` (`GraceDevicePlugin`) changes the tablet itself, with no permission:

| Call or event | Does |
|---|---|
| `getDevice()` | `{ volume: { step, min, max }, brightness: { percent }, battery: { percent, charging }, screenOn }`; `brightness.percent` is absent until Grace sets it, and `battery.percent` when Android does not report it |
| `setVolume({ step })` | sets media volume to that step of the device's own (`min` to `max`, typically 0 to 15 or 25), with no Android volume panel, and resolves with the volume read back |
| `setBrightness({ percent })` | sets the brightness of Grace's window (0 to 100, applied while her window shows), no system setting, and resolves with it read back |
| `volume` event | the volume read back after a hardware volume key, which `MainActivity` turns into one step with no volume panel, and on every resume |
| `screen` event | `{ on }` when the screen sleeps or wakes |

Speech plays with the assistant usage, which AOSP maps to the media volume. Mapping the percent the
Settings show to a device step is the page's work.

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
- `RECORD_AUDIO` is for Talk, asked for natively through `GraceSpeech`. A website's camera and
  location are asked for after the person's Allow and Android's own prompt
  (`spec/app/websiteRequests.md`); the launcher's Wi-Fi scan needs location too. Grace opts out of
  Android's camera compatibility rotation, which turned the display to portrait when a website opened
  the camera. Grace's own Take a photo needs `CAMERA` granted too, since Android refuses its camera app
  to an app that declares the permission and lacks it. `CHANGE_NETWORK_STATE`, which `ElizaWiFi`'s library manifest asks for, is removed:
  nothing in Grace requests a network; the standalone flavor removes its Wi-Fi permissions too, and
  `android.hardware.wifi` is not required (without it Grace's Wi-Fi settings say Wi-Fi is unavailable).
- The `<queries>` list the apps `openExternalLink` can resolve on API 30+: mail and text compose, the
  dial pad, maps, the store and apps with an https link filter; any other app is refused as
  `EXTERNAL_APP_UNAVAILABLE`. The camera app (`IMAGE_CAPTURE`) is listed for Take a photo.
- `app_icon.xml` is the logotype's G on a paper tile, 60 of 108 tall so the splash screen's circular
  crop keeps the whole letter.

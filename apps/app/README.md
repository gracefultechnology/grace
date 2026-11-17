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

Start with `git submodule update --init vendor/eliza`: the build uses upstream Eliza's Android scripts
and builds the agent from it. `vendor/eliza` is pinned to elizaOS/eliza's `grace/integration` branch
(`9bd888f`): the previous pin `ca8823de` with the three Grace branches merged in, each still a draft
pull request upstream: `grace/eliza-embedded-runtime` (#39795, the cloud-only agent service and its
bridge), `grace/eliza-google-signin` (#39789) and `grace/eliza-cloud-speech-bridge` (#39784). One
pushed branch holds all three so anyone can build Grace before they land; the Google sign-in path in
it has never run with a real Google account.

Bun is used only to build that vendored payload, never for Grace's own packages: with Bun 1.4.2 on
`PATH`, run `bun install --frozen-lockfile` in `vendor/eliza` once per pin (the `android` workflow
does both only when its cache holds no payload for the pinned commit and `scripts/android.ts`).
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
fails unless an APK carries the agent (`assets/agent/agent-bundle.js`, `libeliza_bun.so` for exactly
one processor type, `assets/agent-runtime.inventory` and every file that inventory lists, which the
service unpacks before it starts), and if it carries an on-device model or local
inference: a `.gguf`, `.onnx`, `.ort`, `.tflite`,
`.safetensors`, `.pte` or `.task` file, a native library in any directory named for llama, ggml,
mtmd, onnxruntime, sherpa, whisper, piper, executorch, `elizainference` or `omnivoice`, a
`llama-server` or `llama-omnivoice-server`, or a `tts/`, `asr/`, `model/` or `models/` directory under
`assets/` outside the web UI's `assets/public/`. Upstream's payload still carries
`assets/agent/llama-kernel-diagnostic.mjs`, a 3 KB script that only lists which llama.cpp files and
kernels a directory holds; it loads no model or library, and the check lets it pass. Both flavors'
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
`runtime`, and any other is refused before the build; `{ "signIn": { "signedIn": <bool>, "google":
<bool> } }` asks the `GraceSignIn` bridge for its production status (re-measuring a negative answer)
and saved identity, prints the status, and fails when either differs or when the answer holds an
`eliza_mobile_` key; `{ "service": "<class>" }` waits up to two minutes
for `dumpsys activity services` to show that service of Grace's in the foreground; `{ "leaveFor":
"android.settings.<ACTION>" }` opens that Android settings page over Grace, asks Android to kill her
background processes (`am kill`), fails unless her process is the same one, and opens her again. A
failed wait or step names the page's address, visibility, current rail item, opening text and the
agent's status, and fails at once when Grace's WebView has closed its debugging socket. Each feature
adds its own file; `home.json` walks `spec/app/shell.md`, "Story: Reach everyday tasks from Home",
`agent.json` the agent service below and `signin-status.json` the sign-in below.

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

The agent runs on the tablet in upstream's cloud-only `EmbeddedAgentService` (`plugin-native-agent`):
its text and embeddings go to Eliza Cloud and it registers no local model handler. `host.json`'s
`embeddedAgent` entry makes the generator compile it as the `eliza-embedded-agent` module and declare
the service with its `specialUse` foreground type (a `dataSync` service is ended by Android 15 after
six hours a day) and its permissions. `GraceAgentService` is Grace's subclass, which only gives the
notification her monochrome G (`res/drawable/notification_icon.xml`; a full-colour icon shows as a
white square), shown once Grace holds `POST_NOTIFICATIONS`; without it the service still runs in the
foreground and Android lists it only under its active apps. `MainActivity` starts it in `onCreate`,
before the first WebView frame, and registers its bridge, `EmbeddedAgent`, which reaches the agent over its loopback socket, so the page keeps
refusing cleartext and never holds a key. The service needs the signed-in Eliza Cloud credential,
which `cloudCredential()` reads from the sign-in's store (below); signed out, the agent unpacks its
payload, then stops at status `failed` with `credential`, and no Google account has yet signed in on
it.

A run of commit `b0ce38b` with `--emulator <avd>` and `--exercise agent` on a fresh API 36 tablet AVD, on a host
with a load average near 290: both debug APKs passed that commit's content check at 113,487,977 bytes; on a
fresh install the service was in the foreground 9 seconds after Home showed and the agent had
unpacked its payload and reported `credential` 20 seconds after; it was the same process after Grace
was left for Android's settings, and Grace raised no `am_anr` event. A run of `0f2a9c3` with
`DISCOVER_ACTIONS` let past the action check by hand, at a load average near 320, built both APKs at
113,483,881 bytes and passed the same walk.

The agent has not reached `running`. Built once with `cloudCredential()` returning a placeholder line
(never committed), the service unpacked the payload and launched Bun under its musl loader
(`libeliza_ld_musl_aarch64_real.so`), which loaded the bundle and exited before readiness: status
`failed` with `agent`, "Native child exited before readiness". `no_backup/embedded-agent/agent.log`
names the cause, `NATIVE_CLOUD_ROUTING_UNAVAILABLE` from `startNativeManagedGoogleHost`: on Android,
with `ELIZAOS_CLOUD_USE_INFERENCE`, which `EmbeddedAgentConfig.agentEnvironment` always sets, the
agent requires an admitted native runtime module (`ELIZA_NATIVE_GOOGLE_HOST_MODULE` under
`ELIZA_SMTHRS_RUNTIME_DIR`) that neither the payload nor the embedded service provides. Upstream's
embedded service has to change before any credential can bring it to `running`. On a warm start Bun
started 9 seconds after Grace's process and exited 6 seconds later at a peak of 170 MB resident; Grace's
own process held 270 MB.

Its data files: `agent/character.json` as it is; `artifacts/agent/host.json`, which is
`android/agent.json` (the service, the notification's words, Eliza Cloud's production API and the
five routes the page may call: the agent's own `/api` routes, the streamed turn as one `stream: true`
route the bridge relays, since the payload carries no gateway) with `agent/policy.json`'s `model` as
both cloud models; and
`artifacts/agent/policy.json`, which allows `policy.json`'s `actions.upstream.allow` (the agent's
`ELIZA_ACTION_ALLOWLIST`, which refuses every other action at its gate), refuses
`actions.upstream.refuse` and denies the plugins it refuses. The `GRACE_*` actions are not allowed
yet: no plugin in the payload registers them, and a name the agent does not register fails its boot. The
route allowlist the APK ships is `android/agent.json`'s; nothing reads `agent/routes.json`, whose
`stream/start`, `stream/pull` and `stream/cancel` routes are upstream's gateway's, not the embedded
bridge's.
`--verify` parses the agent bundle out of each APK (Vite's `parseAst`) and fails when an object
literal with `similes`, `handler` or `validate` has a `name` that is neither allowed (with `GRACE_*`)
nor refused, by name or under a `refusedSubactionsOf` umbrella. A name is seen when it is an
upper-case string or a variable only ever given such strings, in any declarator or assignment; a name
computed at run time (a parameter, a member, a call, or a variable also given other values) is not,
nor is an action object with no `name` of its own, such as one a factory fills in, the `DEVICE_*`
names spread onto one action, and promoted `<UMBRELLA>_<SUB>` subactions: in the bundle of `9bd888f`
it sees 68 actions and many more go unseen. The agent's `ELIZA_ACTION_ALLOWLIST` gate is what refuses
those at run time.

The payload (Bun for Android with its musl loader, the agent bundle, its database files and the
inventory) is built by upstream's `buildConsumerAndroidRuntime` with no embedding model and no
gateway, without the packages `stubPlugins` in `scripts/android.ts` names (`@elizaos` plugins
`policy.json` refuses, which the build checks, and libraries only they use), into
`artifacts/agent-runtime/<abi>-<key>`, keyed by the `vendor/eliza` commit, the processor type and that
list, and reused by every later build. It refuses a `vendor/eliza` with local changes. Bun and its
libraries go in as native libraries only: the inventory leaves out the payload's `agent/<abi>/`
copy, which the generated host drops from the assets.

### Sign-in

One Google sign-in gives Grace her Eliza Cloud account and, in the same step, connects that Google
account's Gmail, Calendar and contacts to it. Upstream's native client does the protocol
(`packages/auth/android`, `ai.eliza.auth.cloud`, the `eliza-auth-cloud` module): Steward's Google
challenge, Cloud's `POST /api/v1/app-auth/mobile/google`, the acknowledgement, renewal and revocation
of replaced keys. The key is kept in Keystore-encrypted slots from
`plugin-native-secure-store/android-nativeonly`, never its sibling Capacitor plugin, which would let
the page read it.

- `GraceSignInPlugin` is the bridge `GraceSignIn`: App Auth client `technology.graceful.grace`,
  product "Grace", device "Grace tablet", Steward app client `grace`, production
  (`cloud.eliza.app`, tenant `elizacloud`) and in debug builds staging (`cloud-staging.eliza.app`,
  `elizacloud-staging`), return path `/auth/grace/callback`. Where Google Play services is installed
  and enabled it uses the native account picker and then one Google permission sheet for `email`,
  `gmail.modify`, `gmail.send`, `calendar.events` and `contacts.readonly`; elsewhere it uses the
  browser route, which asks Google for no scopes, so Gmail is connected afterwards, and which needs a
  browser and the verified App Link both manifests share.
- `GraceCredentials` is the one binding of those slots (`no_backup/grace-signin`). The sign-in plugin
  writes through it; a change to the production key or its pending acknowledgement first stops
  `GraceAgentService` and waits up to 15 seconds for it to be gone, then commits, then starts it
  again, and a read while a change is under way is refused. `GraceCredentials.cloudKey` is the only
  reader: the production key while unexpired and acknowledged, which `cloudCredential()` hands the
  agent and which a native Cloud transport for speech and mail is to read too. Staging keys never
  reach the agent, whose `agent.json` names production Cloud.

What the page sees, for the account connector to call (the plugin's methods are upstream's):

| Call | Answers |
|---|---|
| `status({ environment?, refreshNegative? })` | `{ active, kind?, activationPending?, google, email, phone, inApp, methodsKnown, googleScopes }`: whether Cloud admits each method for Grace now |
| `startGoogle({ environment: "production", requestId? })` | `{ status: "authenticated", environment, credentialId, expiresAt, accountCreated, google }`, where `google` is `{ connected: true, email, scopes }` or `{ connected: false, reason }`; a refusal or cancel rejects with its code |
| `cancel()`, `signOut({ environment })` | the attempt ends; signing out retires the agent before the key goes |
| `credentialIdentity({ environment })` | `{ environment, credentialId }`, an opaque id or `null` when signed out |
| events | `signInCompleted`, `signInIncomplete`, `signInRenewed`, `signInReadinessChanged` |

No answer or event carries the key. For a provider sheet the account's address is `google.email`, and
mail, calendar and contacts are granted when `google.scopes` holds a `gmail.`, `calendar.` or
`contacts.` scope.

Sign-in works only once these match this build. They are the owner's or an operator's to make, and
none can be checked from the repository:

1. A Google Cloud Android OAuth client for `technology.graceful.grace` with each signing key's SHA-1:
   the debug key above, the release key, and the platform key if a launcher image signs Grace.
2. Steward's app client `grace` for native Google in `elizacloud` and `elizacloud-staging`, with
   `STEWARD_GOOGLE_NATIVE_CLIENT_IDS` listing that Android client under it.
3. Cloud's mobile App Auth client `technology.graceful.grace` with callback
   `https://cloud.eliza.app/auth/grace/callback` (and the staging host's), and for the browser route a
   Digital Asset Links file on each callback host naming the package and each certificate's SHA-256.
4. Cloud's `GOOGLE_CLIENT_ID` being the web client Steward verifies, with the Gmail scopes approved:
   `gmail.modify` is restricted and `gmail.send` sensitive, so production needs Google's verification
   before real people can grant them.
5. The agent's Cloud (`api.eliza.app` in `agent.json`) accepting keys minted through `cloud.eliza.app`.

Three reads check them: `GET /api/v1/app-auth/mobile/config` on the Cloud host lists the client,
`GET /steward/auth/providers` shows `googleNative`, and `GET /api/v1/app-auth/mobile/google` answers
`configured: true` with a `serverClientId` and the scopes.

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

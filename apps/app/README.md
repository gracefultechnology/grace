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

`pnpm android` (Node 26, JDK 21, Android SDK platform 36 with build-tools 36.0.0; `ANDROID_HOME` and
`JAVA_HOME`, or their usual install paths) writes `artifacts/{launcher,standalone}-debug.apk`.
`--release` adds each flavor's release APK: `<flavor>-release.apk`, signed, when `GRACE_KEYSTORE`
(absolute, or relative to the directory you ran the command from: `INIT_CWD` under pnpm, otherwise
the working directory), `GRACE_KEYSTORE_PASSWORD`,
`GRACE_KEY_ALIAS` and `GRACE_KEY_PASSWORD` are all set (`signing` in `android/host.json`; Gradle
refuses a partial set, and the build fails if they are set and a release comes out unsigned),
otherwise `<flavor>-release-unsigned.apk`. `artifacts/apk-manifest.json` lists each APK this build produced
with its SHA-256 and the signer the newest installed build-tools' `apksigner` verified; a debug
build removes release APKs left by an earlier `--release` run. `--install` installs the launcher
debug APK on the device adb picks and starts it. Both flavors' `versionCode` is `package.json`'s
version, MAJOR·10⁶ + MINOR·10³ + PATCH, so raise the version for each release.

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

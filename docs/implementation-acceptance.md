# Acceptance for the MVP

This is the one list that says what "all MVP requirements" means. Grace is
done and ready for user QA when every row below is `met`, `superseded`, `n/a`
or `user QA`, and no row is `open`. Each row names its story, the rule that
meets it, the journey or driver that proves it through the real shell, and
the device exercise that walks it on the tablet emulator.

The rows cover the owner's directions of November 2026 (DIR) and every id of
the PRD's build plan and requirements reference
([prototype/prd.md](../prototype/prd.md), lines 1776 to 2215). A PRD id the
new direction replaces is `superseded`, with what replaces it. The
[requirements coverage](requirements-coverage.md) maps the specs to these
ids in more detail.

## Eliza integration inventory

The deployed Grace release `56fbef12050ab598e069cdf0d517ab3976f628e8`
pins official Eliza Vibestack at `427ffd9e993cd2a1cb76620c6dac6990342c102e`.
It uses four Eliza packages. The signed ARM64 launcher and standalone
contain the same eight web assets served by Grace's Cloudflare Worker
`9edad6d9-9c57-4dba-80c5-c755546cfb7e`. The Worker uses Grace's dedicated
Railway PostgreSQL database through Hyperdrive. A read-only production
check verified the Grace database identity over TLS and matched all 51
migration ledger entries, including one historical migration.
[Grace release source](https://github.com/gracefultechnology/grace/tree/56fbef12050ab598e069cdf0d517ab3976f628e8)
· [Eliza source](https://github.com/elizaOS/eliza/tree/427ffd9e993cd2a1cb76620c6dac6990342c102e)

| Eliza package | Grace consumer |
| --- | --- |
| `@elizaos/cloud` | Grace Cloud wraps `/worker` and imports `/store` for migration. The tablet's browser guide uses `/clef-decisions`. Account enrollment, billing, managed Google data and attachment handoff use the scoped HTTPS routes. |
| `@elizaos/os` | The app imports the public browser-address and Passwords bridge contracts. Android consumes the public host, runtime and APK tooling, and AOSP uses the launcher-overlay export. The host uses OS browser, passwords, Wi-Fi and reminders modules, with secure storage and the embedded-agent bridge. |
| `@elizaos/agent` | The Android build compiles and stages the device bundle from the pinned checkout. Grace uses the authenticated local socket for status, turns, streaming and cancellation. |
| `@elizaos/core` | The Android build compiles Core for the Agent bundle. Cloud and OS also depend on Core upstream. |

The shared Eliza Cloud Android profiles source native sign-in, secure storage,
Agent service and runtime files from Eliza OS. Grace removed its copied
Steward Android SDK in #229. Standalone Grace Cloud uses the OS device
account and the protected browser approval page.

The eleven modules that the embedded device Agent registers from
`@elizaos/agent` are `approvals`, `basic-actions`, `cloud`, `notifications`, `reply-draft`,
`scheduled-tasks`, `storage`, `surface`, `tasks`, `triggers` and `views`.
Grace's Android host registers its native Capacitor bridges. Grace owns its
React screens, components and design tokens in `apps/app`, `@repo/ui` and
`@repo/design-system`.

Google sign-in and Gmail acceptance for this release used fixtures only.
The Chromium journeys exercised owned Gmail, saving attachments to Files
and creating a Calendar appointment from email. Email-code sign-in was
exercised in the bundled Worker fixture and SMS is disabled. The Grace Plus
plan costs USD 30 per month. Production Stripe ingress accepted a signed
synthetic event and rejected an invalid signature. No customer was charged.
Physical acceptance on the exact signed Lenovo build is tracked separately.

### Migration history and earlier release evidence

An earlier Grace release pinned `grace/integration` at `9bd888f`.
That commit included the embedded service, Google sign-in and speech changes
from Eliza PRs #39795, #39789 and #39784. Eliza’s v4 branch changes package
ownership and the mobile runtime. A portable Gradle host alone does not
establish that an agent can start or complete a turn.

| Grace caller | Previous source | Owner on Eliza vibestack | Evidence required for release |
| --- | --- | --- | --- |
| Browser URL entry and native page bridge | Eliza app internals and browser plugin definitions | OS address and native bridge contracts | Navigate and restore an actual tablet tab |
| Launcher Wi-Fi and web surface | Legacy native Wi-Fi and browser-surface plugin Android directories | OS Android Wi-Fi and browser-surface modules | Install launcher, join a network, interact with a page |
| APK and AOSP build | Legacy app build scripts, agent inventory and overlay tooling | OS Android consumer tooling and AOSP overlay | Build both flavors, inspect their payload, boot the launcher |
| Ask Grace | Embedded agent service, assistant, Eliza Cloud and SQL plugins | Device-owned agent on core with bounded Grace actions, dedicated cloud inference and local conversation storage | Cold start, stream a reply, cancel, resume, sign out |
| Sign-in and paid access | Integration branch Google enrollment and external pilot funding | Cloud identity, device grants, checkout, portal and current entitlement | Email-code session, fixture Google sign-in, SMS disabled, and Stripe checkout and revocation evidence scoped to its environment |
| Managed Gmail and Calendar | Managed Google routes and the connector prototype | Cloud provider grants associated with the authenticated owner | Separate consent, owned mailbox/calendar, disconnect and expiry |
| Voice | Legacy speech bridge and cloud relay | OS audio and cloud speech with account-bound admission | Renew or revoke a real speech session and hear a reply |
| Grace screens | Grace React app, design system and UI library | Grace | Build the production Vite entry without an Eliza UI import |

The old pin loaded three runtime plugins. Each has a replacement in the
four shared packages.

| Previously loaded plugin | Current implementation | Grace integration |
| --- | --- | --- |
| `@elizaos/plugin-assistant` | `packages/agent/src/conversation` dispatches owner messages through Core. | The tablet submits turns over the native socket. Grace decodes proposed actions and applies its own rules. |
| `@elizaos/plugin-elizacloud` | `packages/agent/src/host/cloud-model.vibe` uses the native device credential. The `@elizaos/cloud/worker` entry point authenticates the caller, reserves funding and settles usage. | `apps/app/android/agent.json` selects the Grace API. The device keeps its bearer in Android-protected storage. |
| `@elizaos/plugin-sql` | `packages/agent/src/storage` supplies Core's database adapter with an owner-bound PGlite store. | The device host initializes its own store. The hosted accounts and billing ledger use a separate Grace PostgreSQL database. |

An independent comparison of Eliza `origin/develop` at `68d3069434` with
Grace's shipped launcher paths found these ownership boundaries. A plugin's
presence in the upstream tree is evidence of an available implementation to
review. Release evidence still comes from the Grace entry point.

| Grace control | Relevant Eliza develop capability | Grace runtime coverage and launch gaps |
| --- | --- | --- |
| Home, Settings and preferences | Core turns supply the model reply. OS owns the device surfaces. | Grace owns the launcher, Settings, and exact-turn action controls. Tapped text-size, in-app dimming, and voice changes reuse the workspace preferences. A Chromium journey observed a failed native-record write, a successful retry and the saved text size after recreating the workspace. Device-wide brightness and signed-tablet persistence still need device evidence. |
| Browser navigation and pointing | `plugin-browser` and `plugin-computeruse` can directly operate pages or the desktop. | Grace owns the browser and its controls. Eliza Cloud selects among bounded candidates for the current account. The Grace browser checks the target against the current document before highlighting it. The person taps the link. Chromium exercised the visible ring and tap. Signed-tablet evidence is tracked below. |
| Gmail | `plugin-inbox` and `plugin-google-workspace` reach provider data. | Grace Cloud owns Gmail grants and provider operations. Hosted Grace supports Inbox previews, reviewed drafts and threaded replies, and Trash with Undo. Search from a model reply resolves a unique result on the currently loaded Inbox page. The release source previews selected text, PDF, PNG, JPEG and WebP attachments. For PDFs and these image formats, Save to Files passes an account-bound ticket to the Android app. Live Google consent and a signed tablet saving and reopening the original still need acceptance evidence. Folder-wide search, forwarding and permanent deletion remain open. |
| Calendar and reminders | `plugin-calendar` and `plugin-personal-assistant` provide calendar and reminder tools. | Hosted Grace supports reviewed creation of one-time, weekly and monthly appointments and confirmed owned occurrence or whole-series edits and removals. The owner can select a reminder one hour or one day before a timed appointment. The device reconciles reminders for its enrolled account. Live Google consent and completing a review from Home remain open. |
| Files | `plugin-files` provides managed files, revision-bound selections and durable receipts. | Grace owns a device library partitioned by the signed-in account. Its Android picker, camera, catalog and bounded previews feed the Files screen. The Files viewer confirms deletion of the selected photo and retries a failed write. Chromium checked both paths against the device-library boundary. Device acceptance, sharing and printing remain open. |
| Bill payment, booking and fill | `plugin-form`, `plugin-browser` and `plugin-computeruse` provide general form and website tools. | Grace has workspace rules for observed contexts and explicit payment approval. Live task review, verified form fill, bill submission and appointment booking are not mounted in the launcher. These need Grace-owned actuation and provider evidence. |

Chromium exercised a structured reply through the actual Grace app with a
fixture at the EmbeddedAgent boundary. The window stayed on Home until the
person tapped Open Calendar. A model-only confirmation offered no write
approval. Separate Google route checks used PostgreSQL and a simulated Google
transport; the hosted journey checked explicit review and provider receipts.
Those checks leave live model behavior, signed-device acceptance and live
Google consent and writes open.

The APK build previously called scripts in Eliza's app and native-agent
plugin. It now imports Android and AOSP tooling through the public
`@elizaos/os/android/*` and `@elizaos/os/aosp/*` exports. Native sources
come from the pinned checkout. The browser address parser uses
`@elizaos/os/browser/address`, and Wi-Fi and browser bridge types use
`@elizaos/os/bridges/definitions/*`. Grace renders the browser controls, account settings,
managed data and voice controls from its own React app. The old policy's
refusal list records disallowed capabilities from the legacy plugin stack.

The signed launcher consumes OS’s Android consumer host and APK distribution
tools. The overlay stages that APK for the stock Cuttlefish product through
`@elizaos/os/aosp/stage-launcher-overlay.ts`. At Eliza `febdeaf`, full OS
model generation succeeds. The aggregate OS package build still reports
absent image assembly, owned Chromium, update publication, signing and OTA
operator modules, and enum-set type errors in the generated APK model.
Those modules are outside the launcher's imported dependency graph. A
complete custom OS image or OTA service needs separate implementation.
The current Eliza Cloud Worker has no Maps service; Grace’s launcher and
account services make no Maps requests.

The compiled Node 26 device CLI completed a turn through the private socket,
Eliza Core, an owner-bound PGlite database and the Grace Worker with a real
Cloudflare Qwen response. A local Cloudflare Worker with the remote Workers
AI binding also answered a metered chat and returned a 768-value embedding.
The normal production bundle built from fresh tracked sources and frozen
installs. Stripe and Google used network fixtures. The speech relay also
used the real Cartesia service from a local Worker. Julia – Gentle Guide
synthesized “Welcome to Grace.” The Worker streamed 46,080 bytes of PCM
back through transcription, which recognized “Grace.” PostgreSQL recorded
765 microdollars for synthesis and 419 for transcription. The later release checks below cover Android installation and Stripe sandbox checkout. Live Google consent, production checkout and a device microphone session still need provider or device evidence.

On November 17, 2026 the Grace Worker went live on
[the app host](https://app.graceforseniors.com) and
[the API host](https://api.graceforseniors.com/health).
The public readiness check reached Grace’s production PostgreSQL database
through Hyperdrive. An authorized sign-in email reached the recipient’s Gmail
inbox. The first challenge expired. On November 18 the owner-authorized second code was redeemed through the hosted Grace account screen. The account remained signed in after a browser restart. The Worker and a
real PostgreSQL instance also exercised browser-bound Blooio SMS codes with
simulated delivery, concurrent redemption and previously issued Twilio
challenges. Live SMS awaits an approved Grace sender.

Grace selected the existing Eliza OAuth client for both sign-in and managed
Google access. The two callbacks need registration on that client. The legacy
Grace repository has an established release certificate for
`technology.graceful.grace`. The production Android registry uses its SHA-256
fingerprint. The release signing material stays in its existing custody.

Worker version `7d179df3-c254-4e3d-bb2b-bfd0b8fc2590` deployed Grace
`3de43c1` with Eliza `7b4da95`. The production migration created the
native Google challenge table. The runtime role can read, insert and
delete challenges. Native discovery confirmed the seven-day
credential lifetime that the Android host accepts. Chromium loaded the hosted UI and its
production assets, read the signed-out session across the API origin, and
received HTTP 401 on an unauthenticated inference request. Native discovery
returned the registered callback and S256. The public
[Android App Links document](https://app.graceforseniors.com/.well-known/assetlinks.json)
contains the established package and release certificate. The
[Eliza Google client](https://console.cloud.google.com/auth/clients?project=721050741977)
was identified from the live Eliza sign-in redirect to Google. Production
provider discovery currently offers email sign-in. Google callback registration
and the approved Blooio SMS workspace remain open. Grace Plus uses the USD 30
monthly plan in Eliza Labs. Its active Stripe product and default monthly
price are registered. Live checkout awaits its credential and webhook.
The deployed Worker has its Grace-specific Cartesia
standard key, stock English voice and metering configuration.

### Release checks after the standalone integration

Grace [PR 52](https://github.com/gracefultechnology/grace-new/pull/52)
merged the standalone cloud and private Passwords integration. Production
Worker `33d5c152-b89d-43a3-a7f4-74d5edc67b50` served Grace
`5b0a744` with published Eliza `787916c`. That pin includes the shared
credit repair, the Android Passwords test host and the image-verification
model used by the device Agent build. The generated device bundle started,
reported its three actions and verified its manifest. The hosted application
and its assets loaded in Chromium, the database reported ready and the
API returned 401 for unauthenticated inference. The production migrations
installed the encrypted backup tables. The runtime role could use backup
approvals and could neither change the database identity nor record migrations.
[Grace release pin](https://github.com/gracefultechnology/grace-new/pull/79)
· [Published Eliza revision](https://github.com/elizaOS/eliza/commit/787916c4f07fa4a80998a7cc3b40f4ac682ae2da)

Production Worker `ae690881-d6c6-4b67-996e-4cc31fc6750d` deployed
Grace `6fdd155` with Eliza `3c79e57` to both hosts. Chromium loaded
the app and its assets and received a ready database status. The public
guidance route required authentication. Its CORS preflight allowed the
Grace app origin and the account header and rejected an unrelated origin.
[Grace guidance release](https://github.com/gracefultechnology/grace-new/pull/83)
· [Eliza guidance revision](https://github.com/elizaOS/eliza/commit/3c79e5783167e5696378f3c5a1ae799c30b49d73)

Worker `56286445-040c-4660-9418-81df3b0b4ef8` deployed Grace
`76fb6fb` and Eliza `0fd4a74` on both production hosts. The dedicated
Railway database advanced from 17 to 31 migrations. A fresh staging
installation and a direct upgrade from the former release matched on tables,
columns, constraints and indexes. Retrying the production migration applied
zero changes. Chromium loaded the hosted app and account screen, and the API
required authentication for inference and device reminders. [Grace reminder release](https://github.com/gracefultechnology/grace-new/pull/90)

At this pin, a local Grace Worker redeemed a staged Android PKCE grant,
required device acknowledgment, returned only the owner's reminders, and
refused a revoked device. The Stripe sandbox exercised USD 30 monthly
billing through Workerd. A replayed invoice preserved a single allowance,
the owner opened the portal, and cancellation stopped funded inference.
The same Cloud Worker entry point runs in production and under Wrangler.

Worker `4840f124-da1a-4e18-b6a6-a61815bcf548` deployed Grace `ace4d8e` and
Eliza `3423598` to both production hosts. The hosted browser loaded the release,
and the existing email-verified account could read its session, subscription status
and managed Google status after the upgrade. Anonymous inference and device reminders
required authentication. Production provider discovery offered email sign-in.

On the local Worker, one staged Android account completed device enrollment, received
its allowance through a paid Stripe sandbox invoice, used Workers AI for chat and used
Cartesia for speech synthesis and transcription. Cancellation removed funded access and
device revocation invalidated the credential. A separate account signed in to the normal
Grace UI against the local Worker and opened Subscribe. Chrome submitted Stripe’s sandbox
card through hosted Checkout. Stripe signed the events and recorded a paid USD 30 invoice.
Checkout returned to the same Grace account, which immediately displayed Active and Manage
subscription. The test subscription was canceled.

Both signed ARM64 APKs contained the verified Node.js 26.13.1 runtime and the same
device agent. Android installed the exact launcher APK on an API 35 tablet emulator and
launched its MainActivity. The agent bundle booted and reported its three registered
actions through its child process. Both x86_64 debug APKs passed their inventory checks.
The Cuttlefish overlay staged its launcher and pinned Chromium after checking Chromium’s
package, version, signer and SHA-256. The released BillWorld statement journey passed
its independent grader. Grace read the amount and due date, left the account unchanged
and stayed within its action budget. The grader rejected a run with zero actions.
[Grace Android CI](https://github.com/gracefultechnology/grace-new/pull/91)
· [Eliza runtime inputs](https://github.com/elizaOS/eliza/commit/3423598f92e1b87072ed991689d9e906902c4431)

Grace builds its browser client, Worker, device Agent and OS modules through
their own package entry points. The separate Eliza Node server still has
incomplete models for native device keys and speech sessions, a missing
grant-code service, and compile errors in its identity, Calendar and speech
adapters. Those modules are outside the Grace deployment dependency graph.

| Area | Observed result | Remaining launch work |
| --- | --- | --- |
| Browser guidance | Grace imports `@elizaos/cloud/clef-decisions` from its pinned Eliza checkout. The copied SDK was removed. A local Worker with real PostgreSQL and the real Workers AI binding returned 401 for an anonymous caller, 403 for an account mismatch, and selected the expected library-hours link for the signed-in account. The same signed-in account selected the expected link through the public production API after email verification. Chromium exercised account changes and stale page targets. The browser qualification also exercises the upstream staging API. [Browser qualification](specification-plan.md#release-qualification-and-remaining-work) | Exercise the signed tablet’s native credential, page highlight and manual tap together through the deployed Grace Worker. |
| Account credits | Real PostgreSQL recorded one credit across an initial credit, an exact replay, a replay with a different amount and an invalid amount. [Worker funding decision](https://github.com/elizaOS/eliza/commit/dd0632672a9f2365ee66132d83d9252242266ca3) In the isolated Grace Stripe sandbox the Worker opened a USD 30/month Checkout session. Stripe's test payment method paid the subscription through its API. Signed webhooks granted the allowance once and revoked access after cancellation. On Grace `ace4d8e`, a signed-in test user opened the Stripe-hosted card form from Grace and submitted a sandbox payment. Stripe reported a completed checkout and paid invoice. Grace returned the user to the same account with the subscription active. The test subscription was then cancelled. | Production checkout, subscription events and the portal need the live Grace credential, webhook and portal configuration in Eliza Labs. |
| Android Node | Eliza published Node.js 26.13.1 for arm64-v8a and x86_64. Both downloaded archives matched their producer digests. Verification checked the original license, signed Node.js source checksum, binary hash, Android interpreter, system libraries and 16 KiB load alignment. The published runtime lock in `56d0508` was used to build and verify launcher and standalone debug APKs on both architectures. The ARM64 executable returned `v26.13.1` and `android/arm64` on an API 36 emulator. Grace built both release-signed ARM64 flavors. On the `d270a80` Eliza pin both packages contained the verified Node executable and agent bundle. On Grace `34bdf07` and the `21fac1f` Eliza pin, the launcher debug and release APKs built for arm64-v8a and x86_64 and each passed the content check; their sizes and SHA-256 are in the [app README](../apps/app/README.md#android). Android recorded the signed standalone app’s first draw on an API 37.2 emulator. Its signed launcher rendered Home on an API 36 tablet emulator and Android verified the Grace App Link. The Android process-owner repair let the official Node runtime open its private PGlite database and answer authenticated local requests. [Runtime release](https://github.com/elizaOS/eliza/releases/tag/android-node-v26.13.1-ndk-29.0.14206865) · [Grace release pin](https://github.com/gracefultechnology/grace-new/pull/84) · [Upstream lock](https://github.com/elizaOS/eliza/pull/39874) · [Android process owner](https://github.com/gracefultechnology/grace-new/pull/88) | Complete account sign-in, native browser pointing and microphone operation on the signed release. |
| Full Grace check | Six simulations hit the 60-minute limit on the launch checkout. They cover Assistant, Execution, Workspace, Website Requests, Email and Setup. The run also reported pending spec and contract reviews. | Complete the simulations on the integrated source and reconcile the reviews for owner acceptance. |

## Decisions and their defaults

The plan that finishes the MVP applies these defaults until the owner says
otherwise.

1. Upstream vibestack cache work: merge the two committed branches upstream
   with selftest green and re-sync Grace; copy the uncommitted set only when
   the owner says it is finished.
2. Grace pins a published commit of Eliza’s `vibestack` branch. Upstream
   changes go to that branch before the Grace gitlink advances.
3. Grace owns the tablet UI, the cloud deployment, its PostgreSQL database,
   provider credentials and product policy. Eliza owns the device agent,
   core, native OS services and shared cloud implementation.
4. What "all MVP requirements" includes: this delivery ends at a green full
   check, the release APK, every screen walked on the emulator against the
   test site and the staging cloud, and one run against the real model. A real
   biller on the real tablet follows as user QA.
5. "Hey Grace": the November 16 decision to omit the wake phrase was superseded
   November 23. After set-up in Grace’s voice settings, an on-device keyword
   detector listens for the phrase while Grace is in the foreground, including
   Grace’s sleep screen. The tablet processes and discards pre-wake audio in
   memory. The existing cloud speech service handles the voice exchange after
   wake. The detector is idle outside Grace.
6. No internet: nothing asks the agent or the speech service. Ask Grace shows
   one sentence; Fix Wi-Fi is a fixed written list of steps, with no voice.
7. Tablet and sign-in route: the launcher APK on the stock Android of the
   Lenovo TB336FU, with Google Play services and Chrome. Sign-in is the native
   Google account picker plus one permission sheet; the browser route is the
   fallback. The AOSP proof is one recorded Cuttlefish build and boot of the
   image; no image goes on the Lenovo tablet for the MVP.
8. The permission sheet: Gmail (read, send, move to Trash) and Google Calendar
   (read and change events). The calendar is her Google Calendar, cached on
   the tablet.
9. Pilot accounts can be funded outside the app. An unfunded account cannot
   use inference. The account owner can open hosted subscription checkout or
   manage an existing subscription from Grace’s account settings.
10. Set-up: Wi-Fi, Sign in with Google (with "Not now"), her name, speaking
    pace and text size with a live preview, one sentence on what Grace does,
    practise Talk, Type, Close and reopen, then "What would you like to do?".
    English, one voice and no language picker. People set up “Hey Grace” from
    Settings.
11. Conversation capture starts with Talk or an enabled “Hey Grace” wake
    and lasts for one exchange. Wake detection uses the microphone locally
    after set-up and Android permission.
12. The final tap: her own tap on the website always works, and a spoken,
    tapped or typed yes at the exact review lets Grace submit.
13. The fixed task shape: every kind has the same steps. Booking starts from
    the clinic's email, on signed-in portals only; a deposit is explained and
    left to her; the calendar entry is offered at the end. A third-party
    Android app is a hand-off she completes.
14. No Tasks screen: one task at a time, shown at its source with its
    outcome.
15. Workspace goals the simulator cannot reach: five may move to the
    commitment spec with a law and a recorded journey, only after the smaller
    model is tried, and each named to the owner first.
16. Restart: unresolved and finished commitments, settings, set-up
    completion, saved details and the calendar cache are kept. The
    conversation, drafts and open pages are not. A rebuilt screen is a
    restart, with one sentence saying the conversation was cleared.
17. Email from any screen: Grace may read, search, open and bring Email
    forward, draft a new message or reply for her to send, move the open
    message to Trash with Undo and pick a folder. She never sends and never
    opens a link or attachment by herself.
18. A change of screen: website steps and payment approval still pause when
    their page leaves view; the conversation and an action in another app
    survive.
19. Calendar and Settings changes on request: add, change and delete one named
    event or its series after a read-back and a yes; dismiss a reminder; no
    snooze. Volume, text size, brightness, pace and voice on or off, each with
    Undo.
20. Page actions need the compact window; expanded, Grace offers "watch me?"
    and becomes compact first.
21. Browser details: offline shows "Needs the internet"; Reload stays; no Stop
    and no zoom control, websites follow Text size; a website's Google sign-in
    goes to Chrome; a mailto link opens Grace's Email.
22. Wi-Fi: Grace joins open and password networks in her own screen; company
    networks and hotel sign-in pages go to Android's panel. The password is
    never stored or shown to Grace.
23. Saved details: name, phone and address, saved only with her approval,
    listed in Settings with delete, used for the greeting and booking forms.
24. Unused components and the prototype's rejected try-outs are deleted, the
    list shown in the PR first.
25. The chat's Attach button is left out, a listed departure from the
    prototype.
26. No comments applies to Grace's own code, tests, scripts and proofs, not to
    `vibestack/` or `vendor/`. Click-only story tests are removed only with
    the owner's word.
27. The tablet: Grace is the Home app and starts with it; the stock launcher
    stays reachable for support; no screen lock on the pilot tablet.
28. Sign out and "Run set-up again" ship; erasing the tablet does not;
    account deletion goes through support.
29. The agent acts only through typed actions the app applies through its
    checked rules; upstream's direct-acting plugins are not registered.
30. Validation: while hosted CI is blocked by billing, a PR is validated by
    its verify output pasted into its body.
31. Google, Steward and Cloud registrations for the package name and signing
    keys are made by the owner or an operator from the app's README checklist.
32. Each feature keeps its journey in its own test file until the last wave
    moves them into one file per runner.
33. Grace's own wallpaper may keep a clear area where the website shows. It
    is not a cut in either WebView, `surface.md` records it, and it is
    derived from the same measurement that places the page, in the same
    frame.
34. The hosted web app shows websites as an iframe under Grace's UI, the same
    model as the tablet. The build that draws websites above the UI with holes
    is not deployed.
35. Upstream draws the link guide inside the page, so it stays put when the
    page scrolls, with Grace's lilac ring and label as its options.
    `surface.md` says so, and Grace's unused guide components are deleted.
36. A website's fullscreen video may cover Grace. Back leaves fullscreen, and
    Grace speaking or a tap on Ask Grace ends it first.
37. No kiosk: the tablet is not locked to Grace. Home always brings her back
    and the stock launcher stays as a way to recover (decision 27);
    `deviceKeys.md` says so.
38. The launcher APK is the only Android build; the standalone APK flavor
    and its build flag are dropped. Standalone Grace, the dedicated Grace
    Cloud deployment and account, stays.
39. Hosted CI: GitHub billing is restored and every job runs on
    `ubuntu-24.04`. Until then decision 30 applies.
40. The benchmark harness (BillWorld, WebArena, their variables, Python and
    hosted key) moves out of the app into its own package that imports Grace.
41. Sign-in on debug builds: one shared debug signing key is registered as a
    development sign-in client, so emulator walks can sign in. The image
    stays signed out until it is signed by a release signer.
42. The microphone is asked for at first use, matching decision 11. The
    image grants nothing at first boot.

### Gates that follow this delivery

GATE 01 and GATE 08 need a real biller on the real tablet. Under decision 4
they follow this delivery as user QA, with the measured voice latency of
GATE 09 and the success rates of TEST 01, unless the owner says otherwise.
No agent touches a physical device or makes a real payment.

## How to read a row

- **Story** is a story heading in `spec/app/<file>`, or a spec a package of
  the plan adds ("planned").
- **Rule** is the heading of the rule that meets the requirement, in that file
  unless another is named. "Not met" means no rule says it yet; "n/a" means it
  is not something a rule can state (wording, tone, process, measurement).
- **Journey** `x` is `apps/app/test/x.browser.test.tsx` until the last wave
  merges the journeys into one file per runner; `app.test.vibe` is the Node
  journey; `eval` is the run against the real cloud model. Today only
  `app.browser.test.tsx` exists, with the one journey "Use the website under
  Grace's controls", so no other row's journey exists yet, `app` included;
  `app.test.vibe` arrives with shell-foundation and the rest with the
  packages named in Status.
- **Exercise** `y` is `apps/app/test/device/y.json`, walked on the
  `grace-tablet-2` emulator by the exercise mode of the app's `android`
  script. None exists yet.
- **Status** is `met` (rule, journey and exercise all pass), `open` (with the
  packages that close it; each package key `k` is the branch `grace/k` and
  its pull request), `superseded` (with what replaces it), `n/a`,
  or `user QA` (follows this delivery on the real tablet, decision 4).

## Owner directions

| ID | Direction | Story | Rule | Journey | Exercise | Status |
|---|---|---|---|---|---|---|
| DIR 00 | Fast cached checks: a small edit reruns only what it touches | n/a (tooling) | n/a | `pnpm selftest` cache cases | n/a | open: Grace PR #22 merged; upstream cache commits wait on decision 1 (vibestack-cache-sync); a full `pnpm check` has never finished (ws-health, ws-goals-witness, full-check-and-tools) |
| DIR 01 | Bill pay is one kind of a general Task; appointment booking is next | planned `task.md`, `billKind.md`, `bookingKind.md`; today `commitment.md` "Review and authorize the exact payment" | planned task rules; today `commitment.md` and `prep.md` | `task` | `bill`, `booking` | open (task-vocabulary, task-ledger-generalize, task-bill-kind, task-retire-fill-gate, task-booking-kind, task-sources-handoffs, task-sources-email, task-sources-calendar-record, task-shell-bill, task-shell-booking) |
| DIR 02 | The agent does every calendar, email and browser action, one while inside another | planned `agentActions.md`, `request.md`; `workspace.md` "Leave and return without hidden work"; Grace's routes into the stories of DIR 03, DIR 09a, DIR 09b and DIR 09d | planned; today `email.md` forbids reading from another screen (decision 17) | `actions`, `mail`, `calendar`, `files` | `actions`, `mail`, `mail-write`, `calendar`, `files` | open (request-consent-spec, email-grace-routes-spec, calendar-grace-routes-spec, files-grace-routes-spec, ws-grace-routes, agent-actions-spec, agent-actions-shell, ws-task-anywhere) |
| DIR 03 | A working browser | `browser.md` "Browse and return to the page I left", "Adjust the page without stale assistance"; `browserControls.md` "Use every browser control without bypassing Grace's interruption boundary"; `surface.md` "Use the website under Grace's controls" | `browser.md` "Recent websites can be removed individually or cleared after one confirmation" and its other rules; `browserControls.md` "Controls reuse the browser's guards and update its one stored state"; `surface.md` rules; no zoom control (decision 21) | `app` | `browser`, `page` | open (browser-shell-structure, browser-rules-spec, browser-shell-bugs, browser-shell-rules, page-actuation-shell) |
| DIR 03a | What a website asks: questions, downloads, file choice, other apps, staying signed in | `websiteRequests.md` "Answer what a website asks of me", "Save a file a website offers", "Choose a file to send to a website", "Decide what a website may use", "Call, email or find a place from a website", "Sign in with Google or Facebook on a website", "Stay signed in to my websites" | "A website message is answered once with OK, Cancel or typed text"; "A download is saved with a visible status or visibly not saved"; "The file picker opens only after my tap and my choice to choose a file"; "Another app opens only after my tap and my confirmation"; "A refused sign-in is explained with the option to continue in the phone's browser" (a website's Google sign-in goes to Chrome, decision 21); "Website sign-ins last across tabs and Close browser until browsing data is cleared after one confirmation"; a mailto link opens Grace's Email (decision 21) | `app` | `browser`, `page` | open (browser-rules-spec, browser-shell-rules, android-records-files-host) |
| DIR 04 | One Google sign-in for the inbox and the Eliza Cloud account | planned `account.md`; `email.md` "Connect the mailbox I choose" | planned | `account` | `signin-status`, `signin` | open (account-spec, android-account-host, account-shell; eliza-google-signin waits on decision 2) |
| DIR 05 | The whole set-up flow | planned `setup.md` | planned | `setup` | `setup` | open (setup-spec, ui-setup-steps, setup-shell) |
| DIR 06 | Cartesia speech through the cloud and on-device “Hey Grace” keyword detection | `conversation.md` "Talk or type without losing the conversation"; `wake.md` (decision 5) | `conversation.md` rules; `wake.md` "Only a current human wake detection can start the interaction" | `speech` | `speech`; verify the Android APK's local keyword detector and its wake-to-conversation path | open (emulator and tablet acceptance) |
| DIR 07 | The agent runs on the device in the background, and free chat works | `interaction.md` "Use the same conversation through every input and window control" | `interaction.md`, `conversation.md` rules | `chat` | `agent`, `chat` | open (eliza-embedded-runtime, android-agent-host, agent-persona-and-policy, chat-shell, availability-and-failures-shell) |
| DIR 08 | Every setting and every button works | `preferences.md` "Adjust Grace without losing my choices"; `network.md` "Join the network I choose"; `shell.md` "Reach everyday tasks from Home"; `deviceKeys.md` "Return to Home from the launcher" | `preferences.md`, `network.md`, `shell.md` rules; `deviceKeys.md` "After launcher Home only Grace's own window is left for Back" | `settings`, `wifi`, `home`; Bombadil reaches every control | `settings`, `settings-restart`, `device-controls`, `wifi`, `home` | open (settings-pages-shell, wifi-shell, settings-persistence-shell, system-screens-shell, home-shell, explore-and-drivers) |
| DIR 09 | Everything in the prototype is implemented and looks like it: each app has its own row, DIR 03, DIR 03a, DIR 05, DIR 08 and DIR 09a to DIR 09e; this row is the likeness | the product contract in `spec/app/index.md` | n/a (design review against `prototype/Grace Prototype.html`) | every journey; Bombadil on every page | every exercise | open (ui-prototype-variants, ui-hooks-and-text-scale, prototype-likeness-pass, device-validation) |
| DIR 09a | The prototype's Email works with her Gmail | `email.md` "Read an email and its original attachment", "Write or reply and confirm before sending"; `emailItem.md` "Find and open the email I intend", "Delete a message and recover it safely" | `email.md` "Each search or content read needs current access and the user's choice", "Only the current approved draft may dispatch and an unknown send cannot retry"; `emailItem.md` "Only an authorized current selection can begin a provider mutation" | `mail` | `mail`, `mail-write` | open (email-grace-routes-spec, mail-read-shell, mail-write-shell, task-sources-email) |
| DIR 09b | The prototype's Calendar works with her Google Calendar | `calendar.md` "Add and correct an appointment or bill reminder", "Keep repeating entries distinct", "Browse my calendar and select the right occurrence"; `calendarView.md` "Browse my calendar and open an exact occurrence", "Delete this occurrence or the whole repeating event" | `calendar.md` "Saving requires the current complete draft and explicit confirmation", "Recurrence creates another occurrence rather than changing an existing identity"; `calendarView.md` "Saving a repeating event updates its whole series through the same form", "The deletion question binds its selected occurrence and explicit scope" | `calendar` | `calendar` | open (calendar-grace-routes-spec, calendar-shell, android-records-files-host, task-sources-calendar-record) |
| DIR 09c | Reminders and notices: a due reminder is seen and opens its event; toasts and banners never cover each other | `calendar.md` "See a reminder and choose what to do"; `calendarView.md` "Edit the selected occurrence and receive its reminders"; planned `notices.md` | `calendar.md` "Time only makes an enabled reminder eligible and never executes the task" (her own snooze and dismiss stay); `calendarView.md` "Owned occurrence actions preserve one identity and one reminder lifecycle"; planned notices rules | `reminders`, `notices` | `reminders` | open (notices-spec, notices-shell, reminders-shell, android-records-files-host) |
| DIR 09d | The prototype's Files works: browse, open, save, share, print and delete | `files.md` "Find and open something I saved", "Save, share, print and remove the chosen file"; `handoffs.md` "Share the photo I am viewing through my chosen mailbox" | `files.md` "Opening a file verifies that exact content before presenting a preview", "Saving one attachment or all selected photos is one acknowledged local transaction", "Printing reports actual printer acceptance and preserves an uncertain request"; `handoffs.md` "Files closes the preview only when Email accepts that exact photo into a new draft" | `files` | `files` | open (files-grace-routes-spec, files-shell, android-records-files-host) |
| DIR 09e | Moving between apps opens the same thing from wherever she found it | `handoffs.md` "Open the same task from any surface" | `handoffs.md` "One task subject resolves to exactly one commitment record across all entry points" | `task`, `mail`, `calendar` | `bill`, `records` | open (handoffs-decouple, handoffs-compose-spec, task-sources-handoffs, task-sources-email, task-sources-calendar-record) |
| DIR 10 | Built the vibestack way: no code comments, no useless tests, nothing sloppy from the old app | n/a | `pnpm check` citations and lint | the `tests` stage of `pnpm check` | n/a | open (ui-comment-sweep, lint-gates, ui-prune-and-account-copy, ui-stories-readiness, journeys-into-one-file) |
| DIR 11 | Draft PRs as the work goes, merged when validated | n/a | n/a | verify output in each PR body (decision 30) | n/a | open until the last package's PR merges |
| DIR 12 | Manage saved logins in Passwords and use them privately in the browser | `spec/app/index.md` and the browser and bill-pay specs | Android retains secret custody during editing, guidance and filling | Create, find, edit, reveal, copy, fill and delete a synthetic login | Installed Grace, emulator without a screen lock and local BillWorld HTTPS episode | open until the installed journey and account-isolated cloud restore both pass |

### Passwords delivery and acceptance

A person can ask Grace where a saved login lives, open Passwords, search by service, and use the native controls to add, edit, reveal, copy or remove a login. Spoken requests for private operations guide her to the control. Only her interaction with the trusted UI authorizes the operation. The account name, clipboard, password, vault key, login page contents and session cookies stay outside agent observations, speech, logs and traces. Recovery and MFA challenges belong to the person. A successful login supplies no authorization to pay.

| Boundary | Acceptance evidence |
| --- | --- |
| Tablet | Test a device with a screen lock and one without. Exercise cancel, expiry, background, shared tablet/account change, duplicate names, stale edits and deletion. Open Passwords directly on both devices. Verify one-time authorization for an existing credential-bound vault. Test focus order, screen magnification, text size and accessible action names. |
| Browser | Open an isolated private sign-in surface. On a committed HTTPS origin, the OS verifies per-field origin, offers the matching login for the person to choose. Verify mismatched port, iframe, redirect, background and unavailable engine all refuse filling. Verify the private tab cannot be captured, inspected or driven by the agent and that closing it discards the session. Clipboard expiry is best effort. |
| BillWorld | Use an episode-specific loopback HTTPS origin and a synthetic registered account. The supervisor gives the trusted test person the login and private entry URL. The agent receives only the sign-in instruction. Verify the simulator's login-only grade, unchanged billing state and lack of secrets in agent-visible inputs. The fixture's raw task prompt and persona may themselves contain passwords. Scope temporary trust and seed data to an isolated test environment. |
| Cloud | A fresh device must restore an opted-in backup using separately held recovery material. Exercise account/product isolation, revoked enrollment, stale writes, interrupted backup, oversized input, corrupt ciphertext and recovery-key loss. A cloud access token alone cannot enroll, overwrite, delete or decrypt a backup. Check restore against known synthetic entries before offering it to customers. |
| Standalone Grace | Exercise independent auth issuer, OAuth callback and signing registration, inference quota, subscription lifecycle, database and vault namespace. Use a synthetic account across sign-in, backup and restored sign-in, then check production deployment and rollback against the same version. |

Grace develop pins Eliza's native password manager. It already supplies an Android Keystore-backed vault, native editor, protected reveal, sensitive clipboard handling and an Android Autofill provider. Its default vault key requires device authentication and cannot be exported. Copying its encrypted device file to Railway would leave a replacement tablet unable to restore it. Grace uses those native components for secret handling. The two Eliza branches have different native source layouts and must exercise the same behavior independently. [Pinned native client and host contract](https://github.com/elizaOS/eliza/tree/9bd888f474c57af03a8cdf99698189504e4b7796/plugins/plugin-native-passwords) · [Android Autofill](https://developer.android.com/identity/autofill/autofill-services)

Bitwarden Agent Access returns requested credentials to the calling client. Giving that client to the language model would disclose the password. Bitwarden's clients and server provide a separate vault ecosystem. Adopting it would require an account-link, enrollment, recovery and import design, supported clients, an operating owner for upgrades and tested backups, and review of the chosen distribution's license. Hosting the server alone supplies none of the Grace-native editor or browser controls. [Agent Access](https://github.com/bitwarden/agent-access) · [Clients](https://github.com/bitwarden/clients) · [Server licensing](https://github.com/bitwarden/server/blob/main/LICENSE_FAQ.md) · [Encrypted exports](https://bitwarden.com/help/encrypted-export/)

Eliza Cloud's existing API is deployed on Cloudflare and uses Railway-backed services. A standalone Grace deployment needs product-scoped identities, account and billing data, device grants and recovery. Railway volume snapshots restore in the original project and environment, so standalone recovery requires an independent restore rehearsal. Multi-device merge, passkeys, delegated caregiver access, OTP retrieval and browser-extension support need separate product decisions. [Eliza product deployment](https://github.com/elizaOS/eliza/pull/39439) · [Railway backup and restore](https://docs.railway.com/volumes/backups)

The chosen website receives the password when the person fills its sign-in form. Origin matching cannot protect a password from a compromised site at that same origin. A person who copies a password also places it on the Android clipboard for pasting. Grace marks the clip sensitive and clears its own clip on expiry or account retirement when Android allows access. Android exposes separate clipboard read and clear operations. A compromised operating system, privileged debugger or user-authorized service with access to revealed text lies outside the tablet vault’s protection. Qualify a release-signed tablet before enrolling customer credentials. [Android clipboard guidance](https://developer.android.com/develop/ui/views/touch-and-input/copy-paste#sensitive-content) · [Android clipboard API](https://developer.android.com/reference/android/content/ClipboardManager)

Grace opens the native vault while the tablet is awake and Grace is in the foreground. Someone holding an unlocked tablet can use Passwords, including Show and Copy. The editor stays available during slow entry. Existing vaults protected by the older timed key need Android authorization once to migrate. Include slow entry in tablet usability testing. Android 14 and later also restrict accessibility access to controls that filter obscured touches. The native fields and Save button use that protection. Verify their labels with a supported screen reader and keep test credentials inside the disposable test app. [Android sensitive accessibility data](https://developer.android.com/reference/android/view/View#ACCESSIBILITY_DATA_SENSITIVE_AUTO) [Native unlock window](https://github.com/elizaOS/eliza/blob/d270a806a01bbe82d7c7752aac6d96c4af97d0d3/packages/os/android/passwords/src/main/java/ai/eliza/plugins/passwords/PasswordVaultAccess.java) · [Editor expiry](https://github.com/elizaOS/eliza/blob/d270a806a01bbe82d7c7752aac6d96c4af97d0d3/packages/os/android/passwords/src/main/java/ai/eliza/plugins/passwords/PasswordEditor.java)

### Passwords qualification

The Grace develop candidate uses the existing Android password plugin. Its native host compares the current credential generation and deployment environment before admitting a vault. On credential retirement it cancels open private operations and discards the renderer’s saved-login list and guidance. A person using the active tablet profile can choose a matching saved login for Android to fill. An explicit bill-login request binds to the selected browser tab, its revision and the active task’s origin. The person handles MFA and submits the website form. The private tab retains the authenticated session until it closes. [Grace implementation](https://github.com/gracefultechnology/grace-new/pull/64) · [Pinned upstream implementation](https://github.com/elizaOS/eliza/commit/9d9299c09574a8ecda825961f00a0c2edfa50702)

BillWorld provisions a fresh synthetic account and HTTPS origin for each episode. Chromium submitted the Batavia sign-in form and each of the Greater Minnesota Gas, ONSWC, Inframark and Lockwood forms. Their login-only grades changed from false to true after submission, with zero payments. For those four billers, an explicitly labeled BillWorld form uses the simulator’s own authentication and account API when the original capture is missing. A restored capture takes precedence. The Android journey runs with `pnpm -C apps/app android --billworld-passwords <billworld-checkout> --emulator <grace-billworld-avd>`. It needs a disposable emulator without a screen lock and a WebView that supports `WEB_MESSAGE_LISTENER` and `JS_INJECTION_IN_FRAME_AND_WORLD`. The runner installs the signed Grace APK with trust scoped to the episode and connects its temporary HTTPS services through ADB reverse. The person saves the synthetic login in Passwords, selects it in Android’s Autofill chooser, and submits the form. The grade requires a successful login and zero payments. [Synthetic account fixture](https://github.com/gracefultechnology/billworld/pull/11) · [Origin-bound entry](https://github.com/gracefultechnology/billworld/pull/12) · [Synthetic browser journeys](https://github.com/gracefultechnology/billworld/pull/13)

On November 22, merged Grace build `496f77139` passed the Batavia login episode on an ARM64 Android 36 emulator with Chromium WebView 160 and no screen lock. The emulator test opened Passwords from Home, saved the synthetic login, used the ordinary Ask Grace input to open the private sign-in tab, selected the login in the Android picker and pressed the website’s Sign in button. The released BillWorld grader recorded no authenticated session before submission, then one authenticated session, one login, one account view and zero payments. The fixture closed as completed and removed its Android packages and transport bindings. [Grace no-screen-lock change](https://github.com/gracefultechnology/grace-new/pull/137) · [Installed Android Autofill fix](https://github.com/gracefultechnology/grace-new/pull/225) · [Eliza Vibestack vault fixture](https://github.com/elizaOS/eliza/pull/39931)

On November 23, the stock Lenovo TB361FU running Android 16 passed 20 Passwords cases in a disposable profile after installation of signed Grace build `855e1808`. A separate isolated run on the same tablet passed four Vibestack cases at `0c9167a2` and ten Classic cases at `5bc4dcb9` with a test-only overlay. Those cases opened the vault without a screen lock, preserved entry bindings, and refused stale or cancelled Autofill work. The Classic case for a configured screen credential was skipped because the tablet had none. Both isolated packages were removed. The installer and device checks confirmed that the signed Grace package and Home launcher were preserved. The replay of the full BillWorld sign-in on `c215eb7d` timed out during emulator startup, before login.

On that Lenovo's unlocked owner profile, the Classic pre-change vault asked for an Android screen lock. The isolated Classic candidate opened the vault through Capacitor without a screen lock, returned entry metadata, retired the grant when the host went into the background, and issued a fresh grant on resume. The official Classic Quint check passed all ten scenarios and exhausted 644 states for foreground custody. A separate Browser fixture on Android WebView 157 passed the private-profile isolation case. Its callback probe confirmed that the private WebView returned empty generic Autofill structure and discarded generic values. The fixtures were removed and the installed Grace package and Home launcher were verified. Classic service-driven sign-in and the new native confirmation probe still need device qualification.

A stock Android 37.2 emulator with WebView 149 passed the secure origin-attestation and private-surface bridge instrumentation. An older WebView without isolated execution worlds refused private sign-in. The installed native vault preserved entry ownership and revisions. A cold backup and restore across process death and fresh enrollment passed using Android Keystore, a local Worker and a separately held synthetic recovery key. The device-registration fixture uses the same seven-day lifetime as the native client. [Portable native implementation](https://github.com/elizaOS/eliza/pull/39861) · [Standalone Grace qualification](https://github.com/gracefultechnology/grace-new/pull/67)

The five Grace models passed their complete Dafny checks. Passwords verified 56 obligations, Browser 170, Browser Controls 5, account setup 249 and bill pay 162. In Chromium, a user created, edited, copied and deleted a login. An Android change between opening and confirming deletion preserved the newer record and refreshed its details. A second confirmation removed that revision. The native plugin also checks the active owner when it delivers a secret or commits a deletion. [Grace revision-protection journey](https://github.com/gracefultechnology/grace-new/commit/3b5b80f1b1136eeafa48567d5687ccb86211c36a) · [Native owner check](https://github.com/elizaOS/eliza/commit/9d9299c09574a8ecda825961f00a0c2edfa50702)

On the current Eliza develop candidate, the generated HTTP router and production authentication middleware exercised native approval and snapshot operations against PGlite. The route and repository suites passed 50 assertions, including replay, stale revision, tenant isolation and revocation during a streamed write. A write uses a single-use approval plus the expected revision. Restore requires the recovery key and an empty device vault. Operators and support staff cannot reconstruct a lost recovery key. The test used synthetic identities. Staging qualification requires the approved deployment, a registered disposable account and a restore on a second device. [Tested Eliza revision](https://github.com/elizaOS/eliza/commit/bbdbfe4d4230cf8d0027681416fc533591f5ba7a) · [Upstream product scope review](https://github.com/elizaOS/eliza/pull/39852)

The standalone Grace candidate integrates the same tablet experience with the new Eliza worker. Its local consent test traversed the authenticated Worker and database through device approval, callback and encrypted backup. The standalone Chromium suite exercised Passwords, private sign-in and first-party web consent. Recovery is scoped to the deployment origin, registered client, organization and account. An independently deployed Grace Cloud needs its own OAuth redirect, Android App Link and signing registration, database migrations, and live inference and subscription credentials. [Standalone Grace candidate](https://github.com/gracefultechnology/grace-new/tree/codex/grace-passwords-standalone) · [Eliza Vibestack worker](https://github.com/elizaOS/eliza/tree/codex/eliza-passwords-vibestack)

The maintainer approved private passwords and backup for the Eliza MVP. Both the scope and the implementation merged into develop through the normal checks. The protected staging promotion is tracked separately. On the implementation PR’s `6703443` head, the generated router check passed all 802 routes. Native password policy passed 15 tests, browser policy passed 16, the browser client passed eight and Android sign-in passed 17. [Approved Eliza scope](https://github.com/elizaOS/eliza/pull/39852) · [Eliza develop implementation](https://github.com/elizaOS/eliza/pull/39859) · [Staging promotion](https://github.com/elizaOS/eliza/pull/39863)

On a stock Android emulator with WebView 149, the installed browser instrumentation opened a private sign-in surface beside an ordinary tab and verified that the browser tools and capture could not access the private surface. A separate installed Android test saved a synthetic vault through the standalone Cloud Worker to PGlite, stopped the app process, enrolled again and restored the entry into a fresh vault with its recovery key. The fixture used the seven-day credential lifetime advertised by Grace’s production registration. Both native phases passed. The run used synthetic accounts and a disposable database. A restore across two physical tablets and a shared-staging restore remain open. [Android browser packaging fix](https://github.com/elizaOS/eliza/commit/3952845ad9fa7bd5b13282176f2de205eda86f5d) · [Recovery fixture and registration check](https://github.com/elizaOS/eliza/commit/bcbe161cc07b7e493cddadfa9f7585dff0f9794d)

The standalone approval page now offers the email or SMS code methods enabled by the deployment. The email-only journey verified the active account before asking for backup approval. Chromium exercised the consent screen, and the Worker tested an email code, stale-session refusal and a fresh native approval against PGlite with synthetic email delivery. [Standalone consent implementation](https://github.com/gracefultechnology/grace-new/commit/0d24c86c49efed78d59707b30b7976b05fb7a2fb)

The private vault and encrypted-backup implementation merged into both Eliza develop and Vibestack. The standalone Grace Worker passed a local account journey against a disposable PostgreSQL-compatible database. A person signed in through email verification, read the account’s subscription status, and signed out. The inference endpoint refused an unfunded account, served a funded test request, and recorded one usage entry when the caller retried the same request. The same Worker advertised encrypted backup and returned first-party consent with framing, cache and referrer protections. The test supplied synthetic email delivery, model responses and credits. [Eliza develop](https://github.com/elizaOS/eliza/pull/39859) · [Eliza Vibestack](https://github.com/elizaOS/eliza/pull/39861) · [Grace standalone integration](https://github.com/gracefultechnology/grace-new/pull/67)

Seven focused Chromium journeys on the reviewed runtime pin exercised vault management, local voice guidance, private sign-in and first-party backup consent. In a separate standalone Worker run against a disposable database, a signed test invoice funded inference. Cancellation revoked the allowance, and replaying the original invoice left it revoked. The Worker refused an invalid signature, live-mode events in the test tenant and a duplicate checkout. The test supplied external Stripe responses at the network boundary.

Local tests of Grace `4051d20f` with Eliza `1619f202` ran the compiled standalone Worker against disposable PostgreSQL with synthetic model and Stripe responses. Two device fixtures for the same account enrolled independently. An approved save returned HTTP 204, an approved read returned the same ciphertext and revision, and reusing the read grant returned HTTP 401. An unfunded inference request returned HTTP 402. After funding, the Worker served one request and settled it once. Reusing its request ID returned HTTP 409. Repeating checkout created one synthetic checkout, and replaying its signed webhook preserved the active entitlement. The billing portal returned a synthetic URL for the account’s own customer. The backup test verified encrypted transfer at the Worker boundary. Second-device decryption remains a device qualification. [Grace test revision](https://github.com/gracefultechnology/grace-new/commit/4051d20fff39f3d26638dea819d19dc62bd29372) · [Paired Eliza pin](https://github.com/elizaOS/eliza/commit/1619f20203b47241d3acb5d00856c988e2fea396)

Eliza Cloud staging deployed revision `36f2576` through its protected Cloud workflow. The existing staging service and the standalone Grace production service each returned HTTP 204 for their own registered Grace backup client. Shared staging refused anonymous reads, writes and deletes, and withheld cross-origin access from a foreign origin. A live encrypted transfer with a disposable Google account requires the person’s native sign-in and backup approval. [Eliza staging deployment](https://github.com/elizaOS/eliza/actions/runs/44231960640) · [Grace production revision and database qualification](https://github.com/gracefultechnology/grace-new/pull/79)

On November 18, the installed Android clipboard suite passed both cases on Eliza `d270a80`. With the test app in the foreground, retiring the owner cleared its copied password and preserved a replacement clip. The signed launcher and standalone manifests each required Android’s Autofill binding permission, kept the fill and save activities private, and disabled Android app backup and cleartext traffic. [Clipboard journey](https://github.com/elizaOS/eliza/blob/d270a806a01bbe82d7c7752aac6d96c4af97d0d3/packages/os/android/passwords/src/androidTest/java/ai/eliza/plugins/passwords/PasswordRetirementInstrumentedTest.java) · [Grace signed build](https://github.com/gracefultechnology/grace-new/pull/88)

The full check on Grace `126600e` reached its one-hour search limit for the bill-review handoff. A separate deterministic Quint run exercised eight authorized transitions from the initial state, including private sign-in, a verified account, confirmed facts and the person declining payment-form filling. The generated TypeScript replay matched all nine states and every output. The only output was a request for payment review. The full randomized run still timed out. [Bill preparation model](https://github.com/gracefultechnology/grace-new/blob/126600ecd1aa6f312584823ac615c623b2892276/spec/app/billpay.md)

### Shared Eliza and standalone Grace password accounts

The Android build selects the account issuer. Standalone Grace uses its own Worker and account. The shared staging build returns to `https://cloud-staging.eliza.app/auth/grace/callback`. Shared backup requires a fresh approval for the same account, organization, client, environment and operation. Recovery is offered to an acknowledged account with an Android screen credential when the selected service supplies the version 2 readiness header and Steward reports native Google readiness for Grace’s exact registered client. The Cloud proxy bypasses its aggregate provider cache for that client-specific check. The check creates no sign-in challenge. [Shared approval contract](https://github.com/elizaOS/eliza/pull/39912) · [Grace readiness](https://github.com/gracefultechnology/grace-new/pull/167) · [Steward and Cloud proxy readiness](https://github.com/elizaOS/eliza/pull/39991)

Three registrations participate in shared native sign-in. Android App Links lists the package and signing certificate for the exact callback host. Google registers the same package and certificate as an Android OAuth client. Steward enables the `grace` app client for the staging tenant, allows its exact callback and maps the app client to the public Android OAuth client ID. The web OAuth audience serves a different purpose in the Google token. Tenant callback and app-client changes use Steward’s authenticated owner or administrator interface and its MFA policy. [Staging App Links](https://cloud-staging.eliza.app/.well-known/assetlinks.json) · [Steward tenant configuration](https://github.com/elizaOS/eliza/blob/382f1239ec464aa629bd2c9e1210c72eaf111efb/packages/auth/src/server/api/routes/tenant-config.ts) · [Native Google verifier](https://github.com/elizaOS/eliza/blob/382f1239ec464aa629bd2c9e1210c72eaf111efb/packages/auth/src/server/auth/google-native.ts)

On November 18, Google web sign-in on shared staging returned to the Eliza app. Steward still reported the Grace native client as missing or disabled. A staging Login Worker binding edit activated an inactive configuration and briefly interrupted sign-in. Restoring the prior active version returned both the Login Worker and the Cloud sign-in proxy to HTTP 200. For a future change, base the candidate on the version serving traffic, compare its bindings and runtime with that version, and verify web sign-in and the Grace native challenge separately. Cloudflare can inherit bindings from a specific Worker version. Its default is the most recently uploaded version. [Worker version settings](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/script_and_version_settings/) · [Staging provider discovery](https://login-staging.eliza.app/auth/providers?tenantId=elizacloud-staging)

On November 20, both shared staging origins served `944b688` and returned HTTP 204 with `X-Password-Backup-Version: 2` for the registered Grace client. The staging deployment and validation passed. The `elizacloud-staging` Steward tenant reported `googleNative=false`, returned HTTP 404 for Grace’s native challenge and rejected its browser callback with HTTP 400. An authenticated backup and restore on shared staging still need that tenant registration. [Staging deployment](https://github.com/elizaOS/eliza/actions/runs/44778304229) · [Staging validation](https://github.com/elizaOS/eliza/actions/runs/44778209475)

On November 21, both shared staging origins served `8b61c980`, returned HTTP 204 with backup version 2, and served the Grace-specific provider request with `Cache-Control: no-store`. Login staging reported native Google disabled and omitted Grace’s app-specific readiness. The separate Login deployment and Grace tenant enrollment remain open. The protected renderer run passed its origin check, then received HTTP 403 when minting a session for the release fixture. The diagnostic found an active matching identity with no eligible allowlisted key, user or organization. That release fixture is separate from the Grace Android client. Shared production returned HTTP 404 for backup readiness. [Staging deployment and protected browser run](https://github.com/elizaOS/eliza/actions/runs/44892347374) · [Protected identity diagnostic](https://github.com/elizaOS/eliza/actions/runs/44898195365)

The next shared staging candidate, `2703c497`, deployed its API Worker and Pages and passed routing verification. Both staging origins served backup readiness version 2. Protected browser session minting returned HTTP 403 `subject_not_eligible`, and the release workflow skipped certification. A fresh diagnostic confirmed the intended fixture owner and found no allowlisted key, user or organization for that fixture. Grace’s native Google client still needs separate Steward enrollment. Production promotion remains pending. [Staging rollout](https://github.com/elizaOS/eliza/actions/runs/44962314592) · [Protected renderer job](https://github.com/elizaOS/eliza/actions/runs/44962314592/job/137028179475) · [Fixture diagnostic](https://github.com/elizaOS/eliza/actions/runs/44973857440) · [Production promotion](https://github.com/elizaOS/eliza/pull/39915)

The standalone Grace API returned HTTP 204 for the registered Android client and `environment=production`. On the signed shared-staging APK, Android refused cloud recovery without a screen credential. A disposable native fixture opened the ordinary vault without one. Android stalled before the secure confirmation and legacy migration cases could finish. The local cold restore described above remains the verified credential transfer. A live restore into a second signed-in device still needs qualification. [Standalone recovery registration](https://github.com/gracefultechnology/grace-new/pull/79) · [Shared signed Android build](https://github.com/gracefultechnology/grace-new/pull/104)

On November 22, the shared Eliza Cloud web and API origins in staging and production each returned HTTP 204, Password Backup protocol version 2 and `Cache-Control: no-store` for the Grace Android client. The tenant-scoped Steward response omitted the Grace native Google registration in both environments. Native Google sign-in for Grace still needs tenant enrollment. A shared-cloud restore onto a second signed-in device still needs a live test. [Shared Eliza production rollout](https://github.com/elizaOS/eliza/actions/runs/45009112234)

A local repin of Grace (`38e34b6b`) to Eliza `c232f953` built the ARM64 launcher and standalone debug APKs with the standalone-production Cloud profile. Its shared-staging build stopped when the Android packager could not find the legacy Cloud authentication module. Grace #219 retained that module for shared deployments. Grace #223 prepared migration of existing credentials to the canonical Android sign-in client. On November 22, shared staging’s public configuration still lacked the sign-in methods and Google settings that client expects. [Eliza native sign-in migration](https://github.com/elizaOS/eliza/commit/d3411e511ee90cb9b19aed1be6284a4c2b40ff91) · [Shared adapter](https://github.com/gracefultechnology/grace-new/pull/219) · [Canonical client preparation](https://github.com/gracefultechnology/grace-new/pull/223)

Grace #240 switched shared Android backup approval to the official Eliza native API. The ARM64 and x86-64 builds passed. The Eliza Cloud backport verified that a v3 Android request can recover an existing encrypted v2 snapshot in a disposable database. The test exercised the real Cloud and Steward handlers with signed synthetic Google responses. [Grace client](https://github.com/gracefultechnology/grace/pull/240) · [Android builds](https://github.com/gracefultechnology/grace/actions/runs/45065935050) · [Eliza native approval](https://github.com/elizaOS/eliza/pull/40056) · [Eliza Cloud compatibility](https://github.com/elizaOS/eliza/pull/40088)

On November 23, Eliza Cloud staging passed full validation and released `74cda431`. Both staging origins served that revision. Legacy backup readiness for the registered Grace app returned HTTP 204 with protocol v2. The exact native Google readiness request returned HTTP 503 `password_backup_unavailable` on both origins. Steward reported `googleNative=false` for Grace, and its protected inventory found the native Google client binding absent. Native backup approval and a signed-device restore through shared Cloud still require the matching Login release and enrollment of Grace’s signed native Google client. [Staging backport](https://github.com/elizaOS/eliza/pull/40302) · [Exact staging validation](https://github.com/elizaOS/eliza/actions/runs/45192454938) · [Certified staging release](https://github.com/elizaOS/eliza/actions/runs/45197336264) · [Login inventory](https://github.com/elizaOS/eliza/actions/runs/45187059318)

## PRD requirements

### Always-applicable rules

| ID | Requirement | Story | Rule | Journey | Exercise | Status |
|---|---|---|---|---|---|---|
| INV 00 | Scope decisions block the affected action | n/a (how agents work) | n/a | n/a | n/a | n/a: applied by the decisions above |
| INV 01 | Verified site and account before personal data | `execution.md` "Get help on the website I chose" | "Every operation belongs to the selected owner, task and origin"; `memory.md` "A scoped fact cannot be saved until its exact destination is verified" | `task` | `bill` | open (task-shell-bill) |
| INV 02 | One meaningful question; silence is not agreement | `conversation.md` "Talk or type without losing the conversation" | "Silence ends listening without creating an answer" | `chat` | `chat` | open (chat-shell) |
| INV 03 | Secrets stay out of the model, memory and logs | `conversation.md` "Talk or type without losing the conversation" | "Detected private content is removed before the conversation continues"; `execution.md` "Observation is fresh, origin-bound and privacy-filtered" | `chat`, `app` | `page` | open (private-text-contract, page-actuation-shell) |
| INV 04 | Stop and correction cancel stale queued actions | `actuation.md` "Stop old website actions before they reach the page" | "The actuator must still have the exact current browser command"; `execution.md` "Stop revokes queued work and resume requests a new observation" | `app` | `page` | open (page-actuation-shell) |
| INV 05 | Act on current page evidence and verify values | `execution.md` "Interrupt or navigate without stale actions" | `workspace.md` "Dispatch checks the context again and readback establishes the result" | `app` | `page` | open (execution-observation-spec, page-actuation-shell) |
| INV 06 | The person controls final submission | `commitment.md` "Review and authorize the exact payment" | "Explicit approval binds to the complete current proposal and is consumed once"; `workspace.md` "A fully classified spoken approval is recorded and authorized atomically" | `task` | `bill` | open (task-shell-bill); real biller: user QA |
| INV 07 | Report only observed outcomes; no duplicate | `commitment.md` "Stop, resume and investigate without paying twice" | "Only matching authoritative evidence can resolve an existing attempt" | `task` | `bill` | open (task-ledger-generalize, task-shell-bill) |
| INV 08 | Memory, task state and provider records are distinct | `memory.md` "Choose what Grace remembers and correct or forget it" | "Forgetting retains a tombstone and invalidates every older fill and approval"; `handoffs.md` "Canceling a handoff does not delete a commitment record" | `memory` | `records` | open (memory-spec, memory-shell) |
| INV 09 | An honest stop is not completion | `assistant.md` "Keep control of one task across windows and pauses" | "Completion is a verified domain endpoint, never Close, silence or a click" | `task` | `bill` | open (task-shell-bill) |

### The bill payment journey

Under DIR 01 these steps are the bill kind of a task; the booking kind follows
the same steps (decision 13). On the test site in this delivery, on a real
biller in user QA.

| ID | Requirement | Story | Rule | Journey | Exercise | Status |
|---|---|---|---|---|---|---|
| JOURNEY 01 | Understand the goal before assuming payment | `assistant.md` "Keep control of one task across windows and pauses"; planned `request.md` | "One task has one context and one current step" | `task`, `eval` | `bill` | open (request-consent-spec, task-shell-bill, model-eval-run) |
| JOURNEY 02 | Open the browser with Grace still available | `shell.md` "Reach everyday tasks from Home" | `workspace.md` "Starting and changing pages use the browser's real navigation state" | `task` | `bill` | open (task-shell-bill) |
| JOURNEY 03 | Find and open the verified website | `execution.md` "Get help on the website I chose" | "Starting work requires an explicit owner and task with a verified destination" | `task` | `bill` | open (task-shell-bill) |
| JOURNEY 04 | Guide the account sign-in | `prep.md` "Understand the bill before deciding how to pay" | "Opening a selected bill requests private sign-in without assuming account access" | `task` | `bill` | open (task-bill-kind, task-shell-bill); real biller: user QA |
| JOURNEY 05 | Check the selected account | `workspace.md` "Preserve payment authorization and uncertainty across surfaces" | "The active bill is bound to the observed owner and origin once" | `task` | `bill` | open (task-shell-bill) |
| JOURNEY 06 | Explain the bill | `prep.md` "Understand the bill before deciding how to pay" | "Current bill facts distinguish payment choices, no payment due and an existing payment" | `task` | `bill` | open (task-bill-kind, task-shell-bill) |
| JOURNEY 07 | Resolve the payment choice with one question | `prep.md` "Understand the bill before deciding how to pay" | "Choosing an amount, date and funding method is separate from approving submission" | `task` | `bill` | open (task-shell-bill) |
| JOURNEY 08 | Fill and check one step at a time; accept a correction | `prep.md` "Correct the website form and review consequences" | "The final form must match every chosen value before consequential review" | `task` | `bill` | open (task-retire-fill-gate, task-shell-bill) |
| JOURNEY 09 | Review the consequences; nothing submitted yet | `taskBridge.md` "Review the payment I actually chose" | `commitment.md` "The current terms are presented before voice approval" | `task` | `bill` | open (task-shell-bill) |
| JOURNEY 10 | Submission by her tap or her explicit yes | `commitment.md` "Review and authorize the exact payment" | "An observed website tap starts outcome checking without an agent submission"; `workspace.md` "Final submission checks the current workspace and consumes one payment authorization" | `task` | `bill` | open (task-shell-bill); real biller: user QA |
| JOURNEY 11 | Verify and explain the actual result | `handoffs.md` "Return to the task and see its actual result" | `workspace.md` "Verified provider outcomes finish the task while storage retains the payment record" | `task` | `bill` | open (task-shell-bill); real biller: user QA |

### Grace interaction and navigation

| ID | Requirement | Story | Rule | Journey | Exercise | Status |
|---|---|---|---|---|---|---|
| INT 01 | Open Grace | `assistant.md` "Keep voice and typing available in either Grace window" | "Opening and resizing reveal the same conversation without activating it" | `chat` | `chat` | open (chat-shell) |
| INT 02 | Move from chat to the website | `surface.md` "Keep the page still while Grace covers it" | "The page shows only on the ready browser surface while Grace is not expanded" | `app` | `page` | open (page-actuation-shell) |
| INT 03 | Answer without taking over | `assistant.md` "Dismiss guidance without stopping the task" | "Guidance belongs to the current instruction and never grants action authority" | `chat` | `chat` | open (chat-shell) |
| INT 04 | Close Grace hides and pauses | `assistant.md` "Keep control of one task across windows and pauses" | "Close hides Grace and fences unfinished work without reporting completion" | `chat` | `chat` | open (chat-shell) |
| INT 05 | Reopen and resume deliberately | `workspace.md` "Resume against the current website" | `assistant.md` "Resume first reconciles current evidence and never replays an old queue" | `task` | `bill` | open (task-shell-bill) |
| INT 06 | Leaving or closing the browser | `browser.md` "Browse and return to the page I left" | "Closing the last tab creates a fresh blank tab and Close browser clears every tab"; `workspace.md` "Home, native controls and Close have explicit interruption semantics" | `app` | `browser` | open (browser-shell-bugs) |
| INT 07 | Finishing or abandoning work | `assistant.md` "Keep control of one task across windows and pauses" | `workspace.md` "An ordinary website goal finishes only on an observation quoting its fact" | `task` | `bill` | open (task-retire-fill-gate, task-shell-bill) |
| INT 08 | Voice and typing are one conversation | `interaction.md` "Use the same conversation through every input and window control" | "Each interaction uses the existing guarded assistant operation" | `chat` | `chat` | open (chat-shell) |
| INT 09 | Turn states and interruption | `conversation.md` "Talk or type without losing the conversation" | "Type and Stop listening end capture and prevent automatic reopening" | `speech` | `speech` | open (speech-shell) |
| INT 10 | Typing and sending | `conversation.md` "Talk or type without losing the conversation" | "Send consumes one exact draft once and never submits a website form" | `chat` | `chat` | open (chat-shell) |
| INT 11 | Conversation continuity and reading | `conversation.md` "Talk or type without losing the conversation" | "New messages do not pull the reader away from earlier messages" | `chat` | `chat` | open (chat-shell) |
| INT 12 | Guidance beside its target | `assistant.md` "Dismiss guidance without stopping the task" | "Dismiss hides only the label and Show restores only a still-current target" | `app` | `page` | open (page-actuation-shell) |
| INT 13 | Keyboard and readable layout | `assistant.md` "Keep voice and typing available in either Grace window" | `workspace.md` "Conversation input and geometry use the same owned assistant state" | `keyboard` | `keyboard` | open (keyboard-caption-shell) |
| INT 14 | No needless keyboard and window changes | `interaction.md` "Use the same conversation through every input and window control" | "The workspace can distinguish new requests, changed geometry and local reading" | `keyboard` | `keyboard` | open (keyboard-caption-shell) |
| INT 15 | One task; a new request asks first | `assistant.md` "Keep control of one task across windows and pauses" | "A new task cannot silently replace unfinished assistance" | `task` | `bill` | open (ws-task-anywhere, task-shell-bill) |

### What Grace must do

| ID | Requirement | Story | Rule | Journey | Exercise | Status |
|---|---|---|---|---|---|---|
| HELP 01 | Reason from the goal | planned `request.md` | `assistant.md` "One task has one context and one current step" | `task`, `eval` | `bill` | open (request-consent-spec, agent-persona-and-policy, model-eval-run) |
| HELP 02 | Observe before acting | `execution.md` "Get help on the website I chose" | "Observation is fresh, origin-bound and privacy-filtered" | `app` | `page` | open (execution-observation-spec, page-actuation-shell) |
| HELP 03 | Fill accurately; interpret the whole utterance | `prep.md` "Correct the website form and review consequences" | "The final form must match every chosen value before consequential review" | `task` | `bill` | open (task-shell-bill) |
| HELP 04 | One step at a time | `assistant.md` "Keep control of one task across windows and pauses" | "Only the current task and operation can advance a meaningful step" | `task` | `bill` | open (task-shell-bill) |
| HELP 05 | User control over voice, touch and late callbacks | `execution.md` "Interrupt or navigate without stale actions" | "Stop revokes queued work and resume requests a new observation" | `app` | `page` | open (page-actuation-shell) |
| HELP 06 | Secrets and access limits | `network.md` "Join the network I choose" | "Private entry remains in the OS and Show never shares it with Grace"; `conversation.md` "Detected private content is removed before the conversation continues" | `task` | `bill` | open (private-text-contract, task-shell-bill) |
| HELP 07 | Review before commitment | `commitment.md` "Review and authorize the exact payment"; planned `bookingKind.md` | "Only a fresh matching review can replace the current proposal" | `task` | `bill`, `booking` | open (task-booking-kind, task-shell-booking) |
| HELP 08 | Verified outcomes | `commitment.md` "Stop, resume and investigate without paying twice" | "Only matching authoritative evidence can resolve an existing attempt" | `task` | `bill` | open (task-shell-bill) |
| HELP 09 | One task context through detours | `assistant.md` "Keep control of one task across windows and pauses" | "One task has one context and one current step" | `task` | `bill` | open (task-shell-bill) |
| HELP 10 | Personal memory through restart | `memory.md` "Reuse only a relevant current approved fact" | "A fill is bound to a current fact, task and verified destination" | `memory` | `records` | open (memory-spec, memory-shell) |
| HELP 11 | Launch and navigate to the destination | `execution.md` "Get help on the website I chose" | "Starting work requires an explicit owner and task with a verified destination" | `task` | `bill` | open (task-shell-bill) |
| HELP 12 | Assist the website sign-in | `prep.md` "Understand the bill before deciding how to pay" | `prep.md` "Opening a selected bill requests private sign-in without assuming account access"; `websiteRequests.md` "A refused sign-in is explained with the option to continue in the phone's browser" | `task` | `bill` | open (task-shell-bill); real biller: user QA |

### Core screens and browser

| ID | Requirement | Story | Rule | Journey | Exercise | Status |
|---|---|---|---|---|---|---|
| MVP 01 | Loading reaches Home or a clear failure | `shell.md` "Reach everyday tasks from Home" | "Startup distinguishes a usable shell from a recoverable startup failure" | `app.test.vibe` | `home` | open (shell-foundation, system-screens-shell) |
| MVP 02 | Home | `shell.md` "Reach everyday tasks from Home" | "Home cards open their named surface without activating a microphone or controller" | `home` | `home` | open (home-shell) |
| MVP 03 | The browser opens the real site and exposes its state | `browser.md` "Enter a website and understand loading or failure" | `browser.md` rules | `app` | `browser` | superseded in part: custom Chromium on the AOSP fork becomes Grace's browser on the stock tablet (decision 7); open (browser-shell-rules); real site: user QA |
| MVP 04 | Internet settings through native settings only | `network.md` "Join the network I choose" | "A selected network has one current join attempt" | `wifi` | `wifi` | superseded by decision 22: Grace joins open and password networks herself; open (surface-and-network-spec, wifi-shell) |
| MVP 05 | Grace chat | `conversation.md` "Talk or type without losing the conversation" | `conversation.md` rules | `chat` | `chat` | open (chat-shell) |
| MVP 06 | Assistance beside a website, keyboard included | `surface.md` "Use the website under Grace's controls" | "A touch reaches the website only on the shown page and outside every routed control" | `app`, `keyboard` | `keyboard` | open (keyboard-caption-shell) |
| BROWSER 01 | Familiar senior-focused shell, usable without Grace | `browser.md` "Browse and return to the page I left" | "A browser starts with one empty tab and retains each tab's independent page" | `app` | `browser` | open (browser-shell-structure); the page zoom control is superseded by decision 21 |
| BROWSER 02 | Recognizable navigation, tabs and Close browser | `browser.md` "Keep every tab reachable when the window changes" | "Overflow retains the selected tab and the most recently used other tabs in opening order" | `app` | `browser` | open (browser-shell-bugs) |

### Voice and responses

The RESP and UI rows are walked against the specs on develop: "Not met" means
no rule states it.

| ID | Requirement | Story | Rule | Journey | Exercise | Status |
|---|---|---|---|---|---|---|
| RESP 01 | Lead with relevant information | n/a | not met: wording is the agent's persona data, not a rule | `eval` | `chat` | open (agent-persona-and-policy, model-eval-run) |
| RESP 02 | One clear question | `conversation.md` "Talk or type without losing the conversation" | not met for Grace's own replies (persona data); met for silence and website questions by "Silence ends listening without creating an answer" and `websiteRequests.md` "Only the first request of the selected tab is presented, while the browser is shown" | `eval`, `chat` | `chat` | open (agent-persona-and-policy) |
| RESP 03 | Brief progress at meaningful steps | `assistant.md` "Keep control of one task across windows and pauses" | met: "One task has one context and one current step" | `task` | `bill` | open (task-shell-bill); DEC 10's one-second feedback is measured on the device |
| RESP 04 | Correction without blame | `prep.md` "Correct the website form and review consequences" | met for the correction by "The final form must match every chosen value before consequential review"; tone is n/a | `task`, `eval` | `bill` | open (task-shell-bill, agent-persona-and-policy) |
| RESP 05 | Accurate certainty and outcome | `commitment.md` "Stop, resume and investigate without paying twice" | met: "Only matching authoritative evidence can resolve an existing attempt"; `assistant.md` "Completion is a verified domain endpoint, never Close, silence or a click" | `task` | `bill` | open (task-shell-bill) |
| RESP 06 | Respectful, consistent presentation | n/a | n/a: design review against the prototype | every journey | every exercise | open (ui-task-components, prototype-likeness-pass) |
| VOICE 01 | Voice exchange and microphone | `conversation.md` "Talk or type without losing the conversation" | "Talk or an enabled human wake phrase explicitly starts a voice exchange" | `speech` | `speech` | open (conversation-speech-spec, speech-shell); wake: decision 5 |
| VOICE 02 | Barge-in and audio ownership | `conversation.md` "Talk or type without losing the conversation" | "Responses have a written equivalent and only current callbacks change the turn" | `speech` | `speech` | open (speech-shell) |
| VOICE 03 | Thinking time, Repeat, pace | `preferences.md` "Adjust Grace without losing my choices" | `conversation.md` "Repeat reads the latest Grace response without turning on a muted microphone"; `preferences.md` "Output voice, pace and text size have one local source of truth" | `speech`, `settings` | `speech`, `settings` | open (speech-shell, settings-pages-shell) |
| VOICE 04 | Typed exchange and the Type exit | `conversation.md` "Talk or type without losing the conversation" | "Type and Stop listening end capture and prevent automatic reopening" | `speech` | `speech` | open (speech-shell) |
| VOICE 05 | Unusable speech: one retry, then off | `conversation.md` "Talk or type without losing the conversation" | "Unusable speech gets one repeat request and then stops listening" | `speech` | `speech` | open (speech-shell) |

### Senior experience and shared interface

| ID | Requirement | Story | Rule | Journey | Exercise | Status |
|---|---|---|---|---|---|---|
| UI 01 | Turn ownership and legibility | `assistant.md` "Keep control of one task across windows and pauses" | met for the state: "Hidden assistance is quiet and every task status has its necessary context"; showing it is design | `task` | `bill` | open (ui-task-components, task-shell-bill) |
| UI 02 | Shared message, question, review and outcome formats; Grace-owned controls never fail silently and prevent duplicate actions | n/a | the formats are shared components, not a rule; duplicate actions: `commitment.md` "Explicit approval binds to the complete current proposal and is consumed once" and `deviceKeys.md` "Each Back action is one event its guard allows"; silent failure: not met, no rule yet | every journey | every exercise | open (ui-task-components, availability-and-failures-shell) |
| UI 03 | Readable text, contrast, touch targets, volume | `preferences.md` "Adjust Grace without losing my choices" | met for the settings: "Output voice, pace and text size have one local source of truth"; readability is design | `settings` | `settings`, `device-controls` | open (ui-hooks-and-text-scale, settings-pages-shell, prototype-likeness-pass) |
| UI 04 | Phase 1 minimal surfaces, Phase 2 full depth | n/a | n/a | n/a | n/a | superseded by DIR 09: the whole prototype is the MVP |
| SEN 01 | Understand the current situation | `assistant.md` "Keep control of one task across windows and pauses" | met: "One task has one context and one current step" | `task` | `bill` | open (task-shell-bill); senior walkthrough: user QA |
| SEN 02 | Avoid memorizing instructions | `assistant.md` "Keep control of one task across windows and pauses" | met: "Only the current task and operation can advance a meaningful step" | `task` | `bill` | open (task-shell-bill); senior walkthrough: user QA |
| SEN 03 | Have thinking time | `conversation.md` "Talk or type without losing the conversation" | met: "Silence ends listening without creating an answer" | `speech` | `speech` | open (speech-shell); senior walkthrough: user QA |
| SEN 04 | Correct without starting over | `prep.md` "Correct the website form and review consequences" | met: "The final form must match every chosen value before consequential review"; `commitment.md` "Only a fresh matching review can replace the current proposal" | `task` | `bill` | open (task-shell-bill); senior walkthrough: user QA |
| SEN 05 | Stay in control | `execution.md` "Interrupt or navigate without stale actions" | met: "Stop revokes queued work and resume requests a new observation"; `conversation.md` "Repeat reads the latest Grace response without turning on a muted microphone" | `app`, `speech` | `page` | open (page-actuation-shell, speech-shell); senior walkthrough: user QA |
| SEN 06 | Know what happened | `handoffs.md` "Return to the task and see its actual result" | met: `commitment.md` "Only matching authoritative evidence can resolve an existing attempt"; `handoffs.md` "Every source displays only the result of its matching commitment" | `task` | `bill` | open (task-shell-bill); senior walkthrough: user QA |

### When the task does not go to plan

| ID | Requirement | Story | Rule | Journey | Exercise | Status |
|---|---|---|---|---|---|---|
| U01 | Unclear biller or mismatched account | `workspace.md` "Preserve payment authorization and uncertainty across surfaces" | "The active bill is bound to the observed owner and origin once" | `task` | `bill` | open (task-shell-bill) |
| U02 | Login failure, expired session or code | `prep.md` "Understand the bill before deciding how to pay" | "Opening a selected bill requests private sign-in without assuming account access" | `task` | `bill` | open (task-shell-bill) |
| U03 | Misheard or outdated information | `memory.md` "Choose what Grace remembers and correct or forget it" | "A fresh user choice proposes a fact without silently saving it"; `prep.md` "The final form must match every chosen value before consequential review" | `task`, `memory` | `bill` | open (task-shell-bill, memory-shell) |
| U04 | Pause, explanation or changed choice | `workspace.md` "Resume against the current website" | `assistant.md` "Resume first reconciles current evidence and never replays an old queue" | `task` | `bill` | open (task-shell-bill) |
| U05 | Already paid or scheduled | `commitment.md` "Stop, resume and investigate without paying twice" | "An attempt made outside Grace is reconciled before new guidance" | `task` | `bill` | open (task-shell-bill) |
| U06 | Changed amount, fee or date | `prep.md` "Correct the website form and review consequences" | "Pausing or changed context discards a prepared form but keeps the selected bill" | `task` | `bill` | open (task-shell-bill) |
| U07 | Invalid field or changed page | `execution.md` "Interrupt or navigate without stale actions" | "Actual readback establishes completion and a mismatch establishes a visible block" | `task` | `bill` | open (task-shell-bill) |
| U08 | Missing method or decline | `prep.md` "Understand the bill before deciding how to pay" | "Current bill facts distinguish payment choices, no payment due and an existing payment" | `task` | `bill` | open (task-shell-bill) |
| U09 | Connection or service fails before Pay | `shell.md` "Keep control through interruptions" | "Network and service failures remain distinct from a failed device shell" | `chat` | `wifi` | open (availability-and-failures-shell, wifi-shell) |
| U10 | No confirmation after Pay | `commitment.md` "Stop, resume and investigate without paying twice" | "Only matching authoritative evidence can resolve an existing attempt" | `task` | `bill` | open (task-shell-bill) |
| U11 | Manual activity or Stop after Pay | `commitment.md` "Stop, resume and investigate without paying twice" | "Stop and changed context invalidate authorization without erasing the attempt" | `task` | `bill` | open (task-shell-bill) |
| U12 | Correct or delete memory | `memory.md` "Choose what Grace remembers and correct or forget it" | "Forgetting retains a tombstone and invalidates every older fill and approval" | `memory` | `records` | open (memory-shell) |

### Android integration

| ID | Requirement | Story | Rule | Journey | Exercise | Status |
|---|---|---|---|---|---|---|
| ANDROID 01 | System navigation and return Home | `deviceKeys.md` "Step back inside Grace before leaving" | "Back closes the nearest open thing first and leaves only from a resting Home" | `app` | `home` | open (home-shell, emulator-command) |
| ANDROID 02 | Keyboard, focus and text editing | `assistant.md` "Keep voice and typing available in either Grace window" | `workspace.md` "Conversation input and geometry use the same owned assistant state" | `keyboard` | `keyboard` | open (keyboard-caption-shell) |
| ANDROID 03 | Microphone permission | `shell.md` "Keep control through interruptions" | "Permission availability is separate from active recording or observation" | `speech` | `device-controls` | open (android-speech-device-host, speech-shell) |
| ANDROID 04 | Show reading only while observing, with Stop | `shell.md` "Keep control through interruptions" | "Permission availability is separate from active recording or observation" | `app` | `page` | open (page-actuation-shell) |
| ANDROID 05 | Status and device controls in the rail | `shell.md` "Reach everyday tasks from Home" | "Settings and rail popovers preserve the surface underneath" | `app`, `home` | `device-controls` | open (home-shell, android-speech-device-host) |
| ANDROID 06 | Sleep, wake and lock | `shell.md` "Keep control through interruptions" | "Sleep and restart invalidate the prior device context" | `app.test.vibe` | `sleep` | open (ws-device-availability, system-screens-shell); no lock screen (decision 27) |
| ANDROID 07 | Security warnings and permission prompts stay visible | `websiteRequests.md` "Decide what a website may use" | "Allow asks Android, and a website gets a device only when Android allows it too" | `app` | `browser` | open (browser-shell-rules) |
| ANDROID 08 | Connectivity or service failure | `shell.md` "Keep control through interruptions" | "Network and service failures remain distinct from a failed device shell" | `chat` | `wifi` | open (availability-and-failures-shell, wifi-shell); offline: decision 6 |
| ANDROID 09 | Crash, restart and recovery | `commitment.md` "Stop, resume and investigate without paying twice" | "Restart restores the last durable result and revokes transient permission"; `preferences.md` "Restart restores confirmed preferences and invalidates pending acknowledgements" | `settings`, `task` | `settings-restart`, `records` | open (android-records-files-host, settings-persistence-shell); what is kept: decision 16 |
| ANDROID 10 | Reuse native Android controls | n/a | n/a | n/a | every exercise | superseded in part: saved details live in Settings (decision 23) and Wi-Fi joins in Grace (decision 22); the rest holds, open (device-validation) |

### Memory and task context

| ID | Requirement | Story | Rule | Journey | Exercise | Status |
|---|---|---|---|---|---|---|
| MEM 01 | Useful details persist through restart and are reused | `memory.md` "Reuse only a relevant current approved fact" | met: "A saved fact has a stable key, a supported type and a durable revision"; "A fill is bound to a current fact, task and verified destination" | `memory` | `records` | open (memory-spec, android-records-files-host, memory-shell) |
| MEM 02 | Review, correct and delete, with a saved details view | `memory.md` "Choose what Grace remembers and correct or forget it" | met for approval: "Only explicit approval of the current proposal commits a remembered value"; not met for the view, which decision 23 puts in Settings | `memory` | `records` | open (memory-spec, memory-shell) |
| MEM 03 | Deletion and stale context | `memoryActuation.md` "Forget or correct a detail before a queued fill reaches the website" | met: `memory.md` "Memory never retrieves deleted facts or emits an unapproved stale value"; `memoryActuation.md` "Correction and deletion revoke the old command without changing Workspace" | `memory` | `records` | open (memory-shell) |
| MEM 04 | The initial facts | `memory.md` "Choose what Grace remembers and correct or forget it" | met: "A saved fact has a stable key, a supported type and a durable revision" (name, email, phone, address, biller, sign-in identifier) | `memory` | `records` | open (memory-shell); the MVP set is name, phone and address (decision 23) |
| CTX 01 | One task's working context through pause | `assistant.md` "Keep control of one task across windows and pauses" | "One task has one context and one current step"; `workspace.md` "Reconciliation binds the current page and device versions to the one task" | `task` | `bill` | open (task-shell-bill); restart: decision 16 |

### Engineering and private data

| ID | Requirement | Story | Rule | Journey | Exercise | Status |
|---|---|---|---|---|---|---|
| ENG 01 | AOSP fork, launcher and custom Chromium | n/a | n/a | n/a | `agent` | superseded by decisions 3 and 7: the launcher APK on stock Android with the embedded Eliza runtime; the AOSP proof is one recorded Cuttlefish build and boot, and no image goes on the Lenovo tablet for the MVP (android-release-and-image) |
| ENG 02 | The shell works without inference | `shell.md` "Keep control through interruptions" | "Network and service failures remain distinct from a failed device shell" | `home`, `chat` | `wifi` | open (ws-device-availability, availability-and-failures-shell); offline: decision 6 |
| ENG 03 | Staff-provisioned services without customer accounts | n/a | n/a | n/a | n/a | superseded by DIR 04 and decision 9: she signs in to her own Grace account and can subscribe through account settings. External pilot funding is also supported. Provider registrations are in decision 31 |
| ENG 04 | Policy enforced outside the model | planned `agentActions.md` | `execution.md` "The effect boundary checks both generations and dispatches a prepared operation once" | `actions` | `actions` | open (agent-actions-spec, agent-actions-shell); typed actions only (decision 29) |
| ENG 05 | Redacted, correlated diagnostics | n/a | not met: no rule and no package of the plan | n/a | n/a | open: no package owns it; the owner decides whether it is in the MVP, and until then this list cannot read done |
| DATA 01 | Private capture and accidental dictation | `conversation.md` "Talk or type without losing the conversation" | "Detected private content is removed before the conversation continues"; `execution.md` "Observation is fresh, origin-bound and privacy-filtered" | `chat`, `app` | `page` | open (private-text-contract, page-actuation-shell) |

### Payment submission boundaries

| ID | Requirement | Story | Rule | Journey | Exercise | Status |
|---|---|---|---|---|---|---|
| TXN 01 | A durable unresolved window before final submission | `commitment.md` "Review and authorize the exact payment" | met: "A durable unresolved window exists before either submission route is enabled"; `workspace.md` "Review readback and durable journaling precede explicit approval" | `task` | `bill` | open (task-ledger-generalize, android-records-files-host, task-shell-bill) |
| TXN 02 | Payment result and retry | `commitment.md` "Stop, resume and investigate without paying twice" | met: "A new attempt requires a person's retry after verified failure or return and a new review"; "Only matching authoritative evidence can resolve an existing attempt" | `task` | `bill` | open (task-shell-bill); real biller: user QA |

### Live demonstration and test operations

| ID | Requirement | Story | Rule | Journey | Exercise | Status |
|---|---|---|---|---|---|---|
| DEMO 01 | Evidence from the real provider website | n/a | n/a: the test site is never live proof | n/a | n/a | user QA (decision 4) |
| DEMO 02 | Phase 1 completes one real Chase journey | n/a | n/a | n/a | n/a | superseded by DIR 01 and decision 4: the delivery ends on the test site; a real biller is user QA |
| TEST 01 | Separate preparation, payment and failure rates | n/a | n/a: a measurement | n/a | n/a | user QA (decision 4) |
| TEST 02 | Prototype and pilot participants | n/a | n/a | n/a | n/a | user QA (decision 4) |
| TEST 03 | One identity at a time; clear the former owner first | planned `account.md` | not met: no sign-out rule yet; owner changes are met by `handoffs.md` "Owner changes cancel pending handoffs but preserve references to unresolved commitments" and `files.md` "A library belongs to one owner and identifies files independently of their names" | `account` | `signin` | open (account-spec, account-shell); sign out ships (decision 28) |
| TEST 04 | Pitch preparation | n/a | n/a | n/a | n/a | superseded by the owner's direction: an MVP ready for user QA replaces the pitch |

### Build index, scope, gates and dependencies

| ID | Requirement | Story | Rule | Journey | Exercise | Status |
|---|---|---|---|---|---|---|
| BUILD 01 | Fork and minimal surfaces | n/a | n/a | n/a | n/a | superseded: the plan's waves order the work; its ids keep their own rows |
| BUILD 02 | Clarify the spoken goal from Home | n/a | n/a | n/a | n/a | superseded: the plan's waves order the work; its ids keep their own rows |
| BUILD 03 | Open the browser and verified destination | n/a | n/a | n/a | n/a | superseded: the plan's waves order the work; its ids keep their own rows |
| BUILD 04 | Assist the signed-out login | n/a | n/a | n/a | n/a | superseded: the plan's waves order the work; its ids keep their own rows |
| BUILD 05 | Read the bill and resolve choices | n/a | n/a | n/a | n/a | superseded: the plan's waves order the work; its ids keep their own rows |
| BUILD 06 | Fill, verify and correct | n/a | n/a | n/a | n/a | superseded: the plan's waves order the work; its ids keep their own rows |
| BUILD 07 | Voice, one step, Repeat, pause and Stop | n/a | n/a | n/a | n/a | superseded: the plan's waves order the work; its ids keep their own rows |
| BUILD 08 | Persistent approved facts | n/a | n/a | n/a | n/a | superseded: the plan's waves order the work; its ids keep their own rows |
| BUILD 09 | Approved payment and verified outcome | n/a | n/a | n/a | n/a | superseded: the plan's waves order the work; its ids keep their own rows |
| BUILD 10 | Technical enforcement and diagnosis | n/a | n/a | n/a | n/a | superseded: the plan's waves order the work; its ids keep their own rows |
| BUILD 11 | Live proof, reset and test boundaries | n/a | n/a | n/a | n/a | superseded: the plan's waves order the work; its ids keep their own rows |
| SCOPE 01 | Delivery exclusions | n/a | n/a | n/a | n/a | superseded in part. Now in: onboarding and set-up (DIR 05), cloud login (DIR 04), email, attachments and connectors (DIR 02, DIR 09a), calendar (DIR 09b), reminders and notices (DIR 09c), Files and file pickers (DIR 09d, DIR 03a), Grace's own Settings (DIR 08), general tasks (DIR 01), Passwords (DIR 12), “Hey Grace” while Grace is in the foreground (DIR 06). Still out: system-wide wake, automatic codes, creating a biller or provider account, new cards or banks, autopay, third-party app control, OCR, rich history, cellular and SIM, Bluetooth pairing, proactive tasks, companion app, caregiver access, multiuser memory, parallel tasks, a workflow builder, broad website claims, offline assistance |
| SCOPE 02 | Phase 1 and Phase 2 boundaries | n/a | n/a | n/a | n/a | superseded by decision 4: one delivery for user QA |
| GATE 01 | Preparation and payment on a real biller | `commitment.md` "Review and authorize the exact payment" | the JOURNEY rows | `task` | `bill` | user QA on the real tablet (decision 4); the test-site run is open (task-shell-bill) |
| GATE 02 | Reasoning without prerecorded actions | planned `request.md` | `execution.md` "Only classified ordinary operations use the generic dispatch path" | `eval`, `task` | `bill` | open (model-eval-run, task-shell-bill); on a real site: user QA |
| GATE 03 | Voice and accuracy, with explicit voice approval | `commitment.md` "Review and authorize the exact payment" | `workspace.md` "A fully classified spoken approval is recorded and authorized atomically" | `speech`, `task` | `speech`, `bill` | open (speech-shell, task-shell-bill) |
| GATE 04 | Senior interaction | `assistant.md` "Keep control of one task across windows and pauses" | the SEN rows | `task` | `bill` | open (task-shell-bill); senior walkthrough: user QA |
| GATE 05 | Memory survives restart and is reviewable | `memory.md` "Reuse only a relevant current approved fact" | the MEM rows | `memory` | `records`, `settings-restart` | open (memory-shell, android-records-files-host) |
| GATE 06 | Unhappy paths with duplicate prevention | `commitment.md` "Stop, resume and investigate without paying twice" | the U and TXN rows | `task` on the test site's failure pages | `bill` | open (test-site-and-cloud-fake, task-shell-bill) |
| GATE 07 | Safe rehearsal and reset | planned `account.md`, `setup.md` | not met: sign out and "Run set-up again" arrive with account-spec and setup-spec | `account`, `setup` | `signin`, `setup` | open (account-spec, setup-spec, account-shell, setup-shell) |
| GATE 08 | Every surface and a real biller on the selected hardware | n/a | n/a | every journey | every exercise | user QA on the real tablet (decision 4); the emulator walk is open (device-validation) |
| GATE 09 | Pitch operation and a measured voice latency | n/a | n/a | n/a | n/a | superseded by the owner's direction (an MVP ready for user QA, not a pitch); the voice latency budget is measured in user QA (decision 4) |
| DEP 01 | Manual browser baseline on the fork | n/a | n/a | n/a | n/a | superseded by decision 7; observing a real biller's sign-in is user QA |
| DEP 02 | Observation, responsive layout and control on Chase | n/a | n/a | n/a | n/a | superseded by decision 7 and the test site (test-site-and-cloud-fake); real layouts: user QA |
| DEP 03 | The assisted loop on the real site | n/a | n/a | n/a | n/a | superseded by the plan's waves; the real site is user QA |
| DEP 04 | Scheduling and failure | n/a | n/a | n/a | n/a | superseded by the plan's waves and decision 4 |

### Decisions of the PRD

| ID | Decision | Story | Rule | Journey | Exercise | Status |
|---|---|---|---|---|---|---|
| DEC 00 | Ownership of scope, design and engineering | n/a | n/a | n/a | n/a | n/a: who decides, not what Grace does |
| DEC 01 | Chase is the build and pitch site | n/a | n/a | n/a | n/a | superseded by DIR 01 and decision 4 |
| DEC 02 | Repeated real payments for testing | n/a | n/a | n/a | n/a | superseded by decision 4: no agent makes a real payment |
| DEC 03 | Familiar Chrome appearance | `browser.md` "Browse and return to the page I left" | `browser.md` rules | `app` | `browser` | open (browser-shell-structure, prototype-likeness-pass) |
| DEC 04 | Payment by her tap or her explicit voice | `commitment.md` "Review and authorize the exact payment" | "Explicit approval binds to the complete current proposal and is consumed once" | `task` | `bill` | open (task-shell-bill); a tapped or typed yes counts the same (decision 12) |
| DEC 05 | A browser alternative to the custom fork | n/a | n/a | n/a | n/a | superseded by decision 7 |
| DEC 06 | The Lenovo Idea Tab 11-inch | n/a | n/a | n/a | every exercise on the `grace-tablet-2` emulator | open (emulator-command, device-validation); the tablet itself: user QA |
| DEC 07 | Approval of the browser shell frames | n/a | n/a | n/a | n/a | superseded by DIR 09: the prototype is the design |
| DEC 08 | Chase push sign-in | n/a | n/a | n/a | n/a | user QA (decision 4) |
| DEC 09 | Browser proof date | n/a | n/a | n/a | n/a | superseded by the plan's waves |
| DEC 10 | Success-rate floors; two-second pause; one-second feedback | `conversation.md` "Talk or type without losing the conversation" | n/a: wall-clock timing is measured, not modelled | `speech` | `speech` | open (speech-shell) for the pause and the feedback; rate floors: user QA |
| DEC 11 | Requirement load test against the Google Doc | n/a | n/a | n/a | n/a | superseded: this repository's spec is the source |
| DEC 12 | Split into five layers | n/a | n/a | n/a | n/a | superseded by DEC 13 |
| DEC 13 | One consolidated PRD | n/a | n/a | n/a | n/a | n/a: applied by this list |
| DEC 14 | Interaction requirements INT 01 to 15 | n/a | the INT rows | n/a | n/a | n/a: applied through the INT rows |
| DEC 15 | Sign-in codes, voice state map, one valid payment | n/a | the VOICE and HELP 12 rows | n/a | n/a | n/a: applied through those rows |
| DEC 16 | The browser shell decisions | `browser.md` "Keep every tab reachable when the window changes" | "Overflow retains the selected tab and the most recently used other tabs in opening order" | `app` | `browser` | open (browser-shell-bugs); page zoom superseded by decision 21 |
| DEC 17 | Bill reading separate from the payment choice | n/a | the JOURNEY 06 and 07 rows | n/a | n/a | n/a: applied through those rows |
| DEC 18 | One repeat for unusable speech | n/a | the VOICE 05 row | n/a | n/a | n/a: applied through that row |
| DEC 19 | Exchange, typed mode and unusable speech separated | n/a | the VOICE 01, 04 and 05 rows | n/a | n/a | n/a: applied through those rows |
| DEC 20 | Browser shell fixes: Go, tab switching, Recent websites | `browser.md` "Enter a website and understand loading or failure" | "Address entry preserves a draft and empty Go gives a visible explanation" | `app` | `browser` | open (browser-shell-bugs) |

## Evidence each journey must show

The journeys above prove the rows through the real shell. Each must also show
the evidence below for its area. Tests extend the owning journey through real
services, cite the spec rule and assert no markup, wording or screenshots.

| Area | Required evidence |
|---|---|
| Generated boundary | Every external input uses generated decoding and the owning authenticated actor. Persisted states are validated. Planner/page text cannot forge a person, connector, browser host or durable-store caller. |
| Cross-surface lifecycle | Home retains tabs, Close browser replaces them with one blank tab and goes Home, Close Grace hides and pauses. Files Close calls its owning `closeFiles` before Home; Settings Close goes Home rather than the prior application. Sleep, native settings, revocation, source/account changes and manual navigation fence capture and queued actions. Reopening alone never resumes. Verify that sleeping retains the paused task, transcript and chat draft, while Restart clears that transient session and starts Home with a new blank tab. |
| Composed conversation | Route typed/voice input, responses, reading controls and keyboard/layout changes through the owning workspace without a second child-state store. New input fences old targets and wake timers. A plain website action's success is not task completion; an explicit current endpoint is required. Exercise exact spoken payment approval atomically with its transcript update, and route corrections through invalidation instead. |
| Email | Use a provider test account and actual auth/capabilities. Search, open a returned message/attachment, reconnect/cancel/expire/revoke, compose/reply/forward with To/Cc/Bcc and attachments, save/reopen/discard drafts, Trash/undo/restore/permanent deletion, send once, lose the response, restart and reconcile. Capture bill selection from the question the person actually sees. Replace a verified bill candidate before responding and reject confirmation for the earlier candidate. Open the intended canonical record only after a matching confirmation. Verify actual provider folder semantics and retention policy rather than assuming the prototype's fixed behavior. An accepted message is not proof of delivery or reading. |
| Calendar | Create/edit/cancel/delete and durably reload; week/month selection, Today and previous/next intervals, location/notes and owner selection; duplicate source import; recurrence across timezone/DST/month boundaries; one-occurrence versus whole-series deletion, reminders with her own snooze and dismiss (Grace dismisses on request and never snoozes, decision 19). From Home, ask Grace to propose an appointment, change its details, and confirm the current proposal by speech or chip without opening Calendar. Exercise a stale question, a correction, Close, duplicate delivery and storage failure. Check that a preview in an open Calendar uses the same unsaved proposal. Open the same invoice from multiple entries and Email and confirm the same payment record. Delay a canonical lookup, then leave or change its source by closing Calendar, changing the selected occurrence, switching mailboxes or trashing the message. The result may save the same mapping but must not navigate. A current selection must still open the intended bill exactly once. |
| Files | Save one/all email attachments with stable source and content identity; repeated saves deduplicate without conflating same-named files. Browse Photos/Documents, previous/next photo, document pages, select/cancel attachments, share into an unsent email draft, delete and recover from storage failures. Actual print submission/acknowledgment must precede any printed/sent-to-printer claim. |
| Website generality | Exercise more than one independently structured website and multiple layouts. Resolve verified destination and selected account, re-find targets after page/tab/viewport changes and reject ambiguous controls. Dismiss the target label/ring while retaining the panel instruction and task; Show restores only the current target. After page/app layout changes, old Show/publication callbacks must fail until the host locates a new target. A passing sample does not certify every website. |
| Browser effects | Use the generated actuation guard with the canonical Workspace and the exact pending effect immediately before writing to Chromium. Exercise tampered payloads, repeated consumption, wrong actuator, Stop, page changes, account switches and restart between model emission and host consumption. Consume each trusted outbox entry once. Rejected payment effects retain their durable attempt for reconciliation. |
| Browser observation | The VibeLang browser service owns each bounded read. Bind it to the current owner, task, device context, tab/document revision and execution generation. Show “Grace is reading this page” and Stop when acquisition starts. Permission and retained evidence alone never show active reading. Stop, Close, navigation, account changes, Sleep, revocation and unsafe redaction invalidate the generation and cancel the read. Recheck the generation before collecting a frame, transmitting it or delivering its result. Drop stale work and show the actual paused/ended state. Verify the indicator and Stop against real capture, including a cancellation still settling and a late callback after Resume. |
| Bill preparation | Signed-out private login, manual verification/push/CAPTCHA handling, current bill reading, statement/current/minimum distinction, zero/credit due, existing pending/scheduled payment, missing/multiple methods, fee/date correction and readback. Convert the verified preparation into the existing Workspace review using its captured payment tokens. Verify stale preparation, changed amount or fee, mismatched account, changed browser context and duplicate delivery. Use the provider’s actual values and available controls. |
| Payment | Persist unresolved window before guiding final submission; exercise her own tap on the website and a spoken, tapped or typed yes at the exact review (decision 12) separately; correction invalidates approval; duplicate tap/late callback/current-version tests. Report the same opaque account reference in current browser evidence and the bill key. Invalidate the old observation before activating a different authenticated account, including a switch within the same page and origin. Derive the review key from the authenticated account and invoice. Switch between two accounts on one origin and verify that the old observation, review and outcome cannot advance the other account’s payment. Verify scheduled/accepted/completed/pending/unknown/failure/returned from actual correlated evidence. |
| Crash and storage | Crash before/after durable window, dispatch, provider response and result save. Failed receipt save retains the running session's observed outcome; restart restores the durable guard, including Unknown when that observation was not saved. Restart clears the old assistance task, transient conversation/draft/guidance and queued website work without clearing saved email drafts, Files, Calendar, memory or payment records. Verify old audio, guidance, load, task and operation callbacks cannot attach to the new session; Resume cannot revive the cleared task. Start a new request for the same bill and reconcile its retained attempt rather than creating another. Preserve durable failure, returned and positive outcomes as well as uncertainty. Native browser cookies or restored authentication require fresh evidence; do not infer sign-in from browser restoration. Never deliberately create destructive live failures; use clearly labeled resettable fixtures for those branches. |
| Memory | Approve/reject/review/correct/delete/clear permitted facts; reload after restart; verify origin-scoped identifiers and tombstones. Old chat cannot restore a deleted fact; stale queued fills fail; deleting memory or a calendar entry cannot erase transaction evidence. |
| Saved-value actuation | Resolve each owner-scoped valueRef immutably to the original receipt for one accepted command and classified field. Use `memoryActuation.currentSavedEffect` with the canonical fact and Workspace immediately before filling. On the actual browser host, verify that a matching field readback publishes the saved-use explanation in the task checkpoint, without the field value or website text. A mismatch, stale callback or replay must produce no new explanation. Race correction/deletion/Clear all against physical dispatch in both orders; reject a stale receipt without substituting its newer value, and review already-filled unsent fields with the person. Verify storage failure and preserve payment evidence. For non-fill plans, including navigation from a saved biller, retain original owner/key/revision dependencies and require `currentFactRevision` before dispatch; stale dependencies pause or invalidate the owning Workspace without inventing fill consent. |
| Voice | Exercise Talk and the “Hey Grace” wake phrase through the same cloud conversation. Confirm Settings set-up and permission, wake from Grace’s sleep screen, the chime and mute, and the return after silence. Turn wake off while Settings saves and verify that detection stops. Check that denying or revoking permission, leaving Grace, nearby non-wake speech and device playback do not start a conversation. Touch wakes the screen without opening a voice exchange. Inspect outbound traffic for the absence of pre-wake audio and verify that the APK’s on-device speech processing is limited to keyword detection. The pilot tablet has no screen lock (decision 27). Exercise question/statement endings, Type/mute precedence, silence, two unusable utterances, interruption, captions, draft retention, one IME send, Repeat, pace/volume, the daily voice allowance running out and speech-service failure on the emulator, then on the tablet in user QA. |
| Privacy and diagnosis | Inspect redacted browser/audio/error traces and actual outbound payloads. Password/code/payment secrets are excluded before vision/model transmission or capture pauses. Accidental speech-secret handling makes no retroactive privacy promise. Correlate task, operation and source without logging secret values. |
| Visual comparison | Compare every implemented Home carousel, Email, Calendar, Files, settings, browser, compact/expanded Grace and website-keyboard/caption state against `prototype/Grace Prototype.html`. Follow its selected default carousel/header treatment, not its hidden comparison controls. Inspect every supported text size, actual keyboard insets, focus, contrast, labels and touch controls; no screenshot-comparison tests. |
| Connectivity and settings | Exercise actual Wi-Fi scanning, joining open and password networks in Grace's own screen, rejected credentials and the hand-off of company networks and captive portals to Android's panel (decision 22), plus Disconnect and Forget saved network; closing/reopening cannot invent connectivity. Verify brightness, volume/mute, text size and settings persistence against OS acknowledgment. With no internet nothing asks the agent or the speech service; Fix Wi-Fi shows written steps (decision 6). |
| Device and independence | Validate the launcher APK, Home role, Google sign-in and provisioning on the stock Android tablet in user QA (decision 7); the delivery walks every exercise on the `grace-tablet-2` emulator. Collect distinct preparation, payment completion and correct-failure rates in user QA. Formal models and controlled fixtures do not establish independent senior use, support reduction or pilot readiness. |
| Set-up and account | Walk set-up from a wiped tablet: Wi-Fi, Sign in with Google and "Not now", her name, pace and text size with the live preview, the practice steps and the first question (decision 10). One Google sign-in opens her Gmail and Calendar and her Eliza Cloud account; an unfunded account shows "your account needs attention" (decision 9). Sign out and "Run set-up again" clear the former owner first (decision 28). |
| Tasks and booking | Run a bill and a booking through the same task steps (decision 13). Booking starts from the clinic's email on a signed-in portal, explains a deposit and leaves it to her, and offers the calendar entry at the end. One task at a time, shown at its source with its outcome (decision 14). |
| Agent actions and free chat | Grace does a calendar, email and browser action while the person is inside another app, only through typed actions the checked rules apply (decision 29), and the person's screen survives (decision 18). Free chat answers ordinary questions with the agent running on the tablet in the background; with no internet nothing asks the agent (decision 6). |

Keep real-provider outcomes, controlled-test outcomes, local proofs, hosted CI, deployment and device acceptance separately labeled. Use participating owners' authorized accounts for any later financial testing. No agent makes a payment, changes a real account or sends a real message during this delivery (decision 4).

The PRD's DEC 10 timing checks remain explicit: a two-second pause within an
utterance must not end it, and working feedback appears within one second of
entering thinking or acting. These are separate from the prototype's eight-second
unanswered wake timeout. Measure actual capture/render timing; the formal model
does not establish wall-clock latency. Agree representative conditions and
preparation/payment success-rate floors in user QA before any independent-use claim;
the historical three-pass smoke check is not that floor.

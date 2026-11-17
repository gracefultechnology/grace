# MVP requirements and evidence map

What "all MVP requirements" means, and so when Grace is ready for user QA, is
the [acceptance list](implementation-acceptance.md): one row for each of the
owner's directions and each PRD id, met, open, superseded or left to user QA.
This file is the coverage index behind it, mapping the specs to those ids. The executable source is the linked spec, not this table. “Modeled” means a state, transition, guard, invariant, law or reachability obligation represents the requirement. It does not mean the external integration or user interface is implemented. Verification results are reported separately after the complete pipeline runs.

The [model review](model-review.md) records the concrete corrections and
discovered rules from the second pass over these requirements. The
[owned-control inventory](owned-ui-coverage.md) maps every nested UI operation
to its coordinated workspace route.

## Current scope and full journeys

The scope is the owner's directions, the DIR rows of the
[acceptance list](implementation-acceptance.md#owner-directions). Bill payment
is no longer the scope: it is the first kind of a general task, with
appointment booking next. `task` names both kinds; turning the payment ledger
into one ledger for every kind is still in flight. The journeys below are the
ones the specs on develop model today. These decisions change them, and the
acceptance list holds the planned state:

- No wake detector is installed, because no model runs on the tablet; the wake
  rules stay (decision 5). Speech goes through Eliza Cloud, and the
  conversation spec that says so is still in flight.
- The browser has no zoom control (decision 21).
- Grace dismisses a reminder on request but never snoozes one, while her own
  snooze stays (decision 19).
- Grace joins open and password networks in her own screen; company networks
  and hotel sign-in pages go to Android's panel (decision 22). `network` on
  develop still models them, and its change is in flight.
- Saved details are her name, phone and address, saved only with her approval
  and deleted in Settings (decision 23). The `memory` change that names them is
  in flight.
- The email and calendar build, not yet merged, makes accounts one per
  provider and removes Print from Files.

| Journey | Required path and recovery | Owning specifications |
|---|---|---|
| Email | Home → select/authorize the intended provider account → Inbox/Sent/Drafts/Trash → capability-scoped search → open a returned message/attachment → confirm a sourced bill or compose/reply/forward → approve the visible draft or assisted review → single dispatch → provider acceptance, verified failure or uncertainty. To/Cc/Bcc, atomic attachment manifests, revision-bound attachment selection, saved/reopened/discarded drafts, Trash/Undo/Restore/Delete forever and stale callbacks preserve identity. | `shell`, `email`, `emailItem`, `files`, `conversation`, `handoffs` |
| Calendar | Home → Week/Month/Today and selected day → create or edit an appointment/bill occurrence → approve and durably save → reminder/show/snooze/dismiss → open the linked canonical bill. Location/participants/notes, one-occurrence versus entire-series deletion, recurrence identity, coordinated whole-series edits, duplicate import and timezone boundaries are explicit. Close preserves submitted saves/deletions and cancels an unsubmitted form. Deleting an entry does not delete a payment. | `shell`, `calendar`, `calendarView`, `handoffs` |
| Files | Second Home page or Email Save → load the local library → Photos/Documents → exact photo/document → browse, share into an unsent email, print, or delete a photo. Single/batch saves use immutable source identity, acknowledged storage and retry; duplicate names never merge distinct files. Search distinguishes no match and ambiguity, and stale results cannot reopen a closed view. | `shell`, `files`, `email`, `handoffs`, `conversation` |
| Browser | Home → ordinary address/search navigation → current page or explicit loading/security failure → tabs/back/forward/zoom/history → Home retaining pages or Close discarding tabs. Grace opening, hiding, keyboard changes and manual navigation invalidate dependent observation without making browser use depend on inference. | `shell`, `browser`, `assistant`, `conversation`, `execution`, `workspace` |
| A task: bill payment, the first kind, from Calendar, Email or Grace | Select canonical bill → verify site/account → private sign-in if needed → inspect current facts and existing payment → choose amount/date/funding → populate/read back → exact review → durable unresolved window → website tap or fresh voice approval → one submission → observed outcome → save evidence. Pause, correction, restart, prior manual payment, mismatched identity and uncertain outcomes cannot create a blind retry. | `task`, `handoffs`, `billpay`, `execution`, `payment`, `assistant`, `workspace` |
| Set-up | Wi-Fi → Sign in with Google or Not now → her name → speaking pace and text size with a live preview → one sentence on what Grace does → practise Talk, Type, Close and reopen → "What would you like to do?". Resumes at the step it reached after a restart (decision 10). | `setup`, `shell`, `preferences` |
| Settings and connectivity | Rail popovers retain the current app; Settings selects its intended pane. Text size, voice pace/output, device volume/mute, brightness and night dimming preserve current choices and Undo. Wi-Fi joins use current OS results and private password entry; on develop the model also has enterprise entry, certificate decisions and captive-portal consent, which decision 22 hands to Android's panel. | `shell`, `preferences`, `network`, `workspace` |

The replacement `prototype/Grace Prototype.html` now supplies actual Email, Calendar and Files screens as well as Home, settings, the browser shell and bill-payment presentation. Its application flows supersede the former placeholder assessment and are mapped in [the email/calendar requirements](email-calendar-requirements.md), [Files audit](new-prototype-files-audit.md) and executable models. Calendar-launched bill payment remains required by this request even though the prototype calendar demonstrates appointments.

## Current PRD requirements

Source: the “Grace MVP PRD” and current decisions in `prototype/prd.md`, beginning at line 1640. Earlier chapters are historical inputs. Ranges below include every ID in the named range; distinctions that are not model-checkable are recorded in the last column.

| Requirement IDs | Specification and represented contract | Implementation acceptance still required |
|---|---|---|
| INV 00, INV 09 | `billpay`, `execution`: unsupported, mismatched and ambiguous cases block with a reason; blocked is not complete. Current user scope supersedes the old Chase-only exclusion. | Correct recognition of unsupported real-world conditions and useful explanation. |
| INV 01 | `execution`, `workspace`, `billpay`, `email`, `memory`, `handoffs`: owner/account/source binding, verified destination, scoped data use and stale request rejection. Workspace requires the same opaque account in the current browser observation and the canonical bill identity. | Trusted browser/connector provenance and origin validation, including a same-page switch between accounts. Page text supplies no authority. |
| INV 02 | `conversation`, `payment`, `calendar`, `email`: current question/revision, explicit approvals, no silence approval. | One semantic question in generated language, understandable choices and complete utterance interpretation. |
| INV 03, DATA 01 | `memory`, `conversation`, `assistant`, `execution`, `email`, `workspace`: permitted fact types, excluded private operations, privacy readiness, removal of detected private text and cancellation of dependent work; no secret-credential fields in payment state. | Redact actual browser/vision data before transmission; pause if redaction is uncertain; detect accidental secrets reliably and remove them from actual downstream context/log stores. No claim of undoing prior speech-provider transmission. |
| INV 04 | `assistant`, `conversation`, `execution`, `payment`, `workspace`, `actuation`: interruption, generation fences, deliberate resume, unchanged durable outcome evidence and a current-state check for delayed command consumption. | Fence at the actual actuator, cancel capture and queued operations, explain any already-dispatched effect. |
| INV 05 | `browser`, `execution`, `billpay`, `payment`, `workspace`: navigation/viewport epochs, current targets, current review and outcome tokens, value readback and correlated expected page progress without unnecessary manual resume. | Observe real fields and responsive layouts rather than fixed selectors/playback. |
| INV 06 | `payment`: exact proposal review, completed readback for voice approval, correction rejection, one-use authorization; observed manual submit is separate. | Both real submission routes, full utterance parsing and current target enforcement. |
| INV 07, TXN 01–02 | `payment`, `handoffs`: one durable record per bill across a multi-bill workspace; unknown/pending block new attempts; positive outcome distinctions and later authoritative returns; durably recorded failure/return and a fresh user decision before retry; initial journal and later result-save failures. | Atomic durable writes, reliable provider outcome correlation, crash-at-write and lost-response journeys. |
| INV 08 | `memory`, `calendar`, `payment`, `handoffs`: separate lifecycles, tombstones, immutable bill identity and retained mapping. | Storage isolation, deletion of actual saved values, redacted diagnostics and no stale retrieval. |
| JOURNEY 01–05, HELP 01–02, HELP 06, HELP 11–12 | `assistant`, `billpay`, `execution`: retain goal, resolve source, open verified origin, private login/challenge and account matching. | Actual sign-in, push/manual code handling, login timeout and native browser integration. |
| JOURNEY 06–08, HELP 03 | `billpay`, `execution`: known/unknown balances and fees, provider-confirmed no-due versus unavailable, contradictory minimum rejection, existing-payment conflict, complete choice only with an observed fee, arbitrary valid values, correction/version invalidation and actual form readback. | Accurate website interpretation, calendar-date resolution, choice-dependent fees, validation and no inferred affordability. |
| JOURNEY 09–11, HELP 07–08 | `payment`: review, both authorization routes, outcome verification and minimal evidence. | Real provider acceptance and settlement evidence; a test fixture is not live proof. |
| HELP 04–05, HELP 09 | `conversation`, `assistant`, `execution`: questions/detours, readable current instruction, Stop, repeat, current guidance and recovery. | Grounded explanations, physical pointer placement and useful unsupported-case copy. |
| HELP 10, MEM 01–04 | `memory`, `memoryActuation`: saved details are her name, phone and address, used for the greeting and booking forms (decision 23; the `memory` change that names them and keys her name once is in flight). Approved non-secret fact types, scoped identifiers, proposal/review/save/reject, correction, individual and collection-wide deletion, and queued-fill revocation. The stateless Memory/Workspace join rechecks the exact original saved-value receipt against the current fact at physical dispatch; non-fill plans recheck their original fact revision dependencies. | Immutable owner-scoped valueRef-to-receipt resolution; serialization of correction/deletion/Clear all with outbox claim and physical fill; durable storage across device restart; conversational and touch saved-details views; explicit confirmation on persistence failures. |
| INT 01–03 | `assistant`, `workspace`: explicit open, compact/expanded view, same conversation, no automatic microphone/task resume. New bottom-window geometry supersedes old sidebar geometry. | Home/browser entries, automatic presentation of the intended website, clear return destination and correct keyboard focus. |
| INT 04–07 | `assistant`, `browser`, `workspace`, `payment`: Close/pause, explicit resume/reobserve, Home versus Close browser, endpoint/abandonment without a persistent End task control. | Actual host cancellation and provider-state preservation, including manual progress while hidden. |
| INT 08–11 | `conversation`, `assistant`: shared draft/transcript, typed mic-off exchange, one send, scroll/reading continuity, explicit new conversation. | Native IME/focus, screen-reader labels, long-composer scrolling, partial caption delivery and readable new-response affordance. |
| INT 12–15 | `browser`, `assistant`, `execution`, `workspace`: current target publication as Look (a ring), Tap (a label on the control she uses next) or Done (the green check, only after a verified completed outcome); page actions only in the compact window (decision 20); label/ring Dismiss and Show without task cancellation, target invalidation, keyboard owner and context, no control of private input, settings/source boundaries. | Reanchor or hide the pointer, avoid covering site controls, measure keyboard insets, retain native security dialogs. |
| MVP 01–06 | `shell`, `browser`, `assistant`, `conversation`: startup/failed/retry, Home, independent browsing, native Internet controls and assistance. Current MVP additionally makes Email/Calendar entries real. | React implementation on the specified stack, native integration and device layout. |
| BROWSER 01–02, DEC 03, DEC 16, DEC 20 | `browser`, `shell`, `workspace`: uncapped retained tabs, stable opening order and LRU overflow, selected tab visible, same-page selection, empty address feedback, recent removal/confirmed clearing, zoom, last-tab blank and Close/Home distinction. | Chromium security warnings/site permissions; readable toolbar and overflow; Go/Enter equivalence; zoom without restyling; full-size toolbar with keyboard. Hidden optional Chrome features remain excluded. |
| VOICE 01–05 and approved prototype wake feature | `conversation`, `assistant`, `wake`, `preferences`, `workspace`: Talk or an enabled human wake phrase, question/statement endings, mute/Type precedence, interruption, own-audio exclusion, repeat, one unusable retry then mic off, distinct silence/failure. The wake rules stay, but no detector is installed in the MVP because no model runs on the device ([acceptance list](implementation-acceptance.md#decisions-and-their-defaults), decision 5). Wake from sleep preserves the surface, pauses old work, and uses generation-bound silence/return timers. Touch wake does not listen. | Settings shows Hey Grace as not available and the sleep screen says to touch the screen. Speech recognition and Cartesia voice run through Eliza Cloud, with no model on the tablet, and nothing asks the speech service offline (decision 6). Microphone permission at first Talk; playback rejection; capture, recognition and speech cancellation and timing on the real cloud path; captions, voice speed and volume controls. |
| RESP 01–06, UI 01–03 | `conversation`, `assistant`, `billpay`, `payment`: current turn, current instruction, question/review/outcome state and evidence certainty. | Respectful adult language, concise response, accessible contrast and targets, stable shared components, readable default/enlarged text. These qualities are design review, not string or screenshot tests. |
| CTX 01 | `assistant`, `execution`, `payment`, `workspace`: ordinary interruptions retain the goal/checkpoint and durable records, invalidate old actions and require deliberate reconciliation. Restart follows ANDROID 09's transient-session reset while preserving durable records. | Restore the actual application/website state; do not promise unsent fields or authentication survived. |
| ENG 01–03, ANDROID 01–10 | `shell`, `workspace`: ready/sleep/restart/permissions/network versus inference, native control return, explicit lifecycle invalidation. Sleep retains paused assistance; ANDROID 09 Restart clears the active task, transient chat/draft/guidance and browser page session with successor callback versions. Canonical payment keys, attempts and durable outcomes survive; volatile outcomes restore from durable evidence. | The launcher APK on the tablet's stock Android, with the AOSP image staged but not built (decision 7); staff provisioning/revocation, native lock/authentication and process lifecycle, real hardware/keyboard/insets. Wake cannot bypass native unlock. The browser service owns actual capture and its active/paused/ended display (ANDROID 04). Verify cancellation and payload fencing at that boundary; native cookie/session restoration is not proof of sign-in. |
| ENG 04–05 | `execution`, `payment`, `handoffs`: correlated owner/task/operation/generation, policy separation and opaque evidence references. | Enforce policy outside the LLM and collect redacted correlated diagnostics. No full telemetry product is implied. |
| U01–03 | `billpay`, `execution`, `memory`: mismatched identity, login/challenge/expiry, ambiguous or corrected fields and distinct memory save. | Provider-specific challenge recognition and complete spoken-number/date interpretation. |
| U04, U09, U11 | `conversation`, `assistant`, `execution`, `payment`, `workspace`: Stop/pause/interrupt, voice failure, explicit resume and unknown outcome protection. | Cancellation races at the real browser/audio boundary. |
| U05–08 | `billpay`, `execution`, `payment`: no payment due, existing payment, missing method/unsupported controls, revalidation and at most one retry of the same failed semantic approach. | Real no-due, multiple-method, overlay and validation cases; never create accounts/funding instruments implicitly. |
| U10, U12 | `payment`, `memory`: actual outcome/persistence separation and saved-data controls. | Receipt-save/storage failure and deletion/restart integration journeys. |
| GATE 01–09, DEP 01–04, DEMO 01–02, TEST 01–04 | [Acceptance list](implementation-acceptance.md#build-index-scope-gates-and-dependencies) for GATE and DEP, and [its live demonstration rows](implementation-acceptance.md#live-demonstration-and-test-operations) for DEMO and TEST: each id's row. GATE 01 and 08 need a real biller on the real tablet and follow this delivery as user QA. No fake live evidence or senior-independence claim is made by these models. | Real hardware/provider runs, both payment routes, signed-out access, measured preparation/completion/failure rates, safe rehearsal and participant approval. Old pitch date/site exclusivity are superseded by current rebuild scope. |
| BUILD 01–11 | These are delivery groupings of the requirements above, not additional state: 01 shell/native/browser; 02 conversation/goal; 03 navigation; 04 private sign-in; 05 bill facts/choices; 06 preparation/readback; 07 voice/Stop/Repeat; 08 memory; 09 payment; 10 host enforcement; 11 real acceptance. | Complete their referenced runtime journeys when application code is implemented; model generation is not completion of the build checklist. |
| SEN 01–06, UI 04 | Human review lenses over `assistant`, `conversation`, `memory`, `billpay`, `payment` and `workspace`: current step, retained choices, thinking time, correction, control and truthful outcome. Shared presentation/state belongs to one spec tree, not separate phase-specific products. | Readable shared components, one meaningful question, no silence approval, independent senior walkthrough and the complete prototype comparison. |
| SCOPE 01–02 | The owner's directions replace the exclusions of onboarding, cloud login, Email/attachments, Calendar/reminders, Files/pickers, general tasks, generic websites and the demonstrated settings; the [acceptance list](implementation-acceptance.md#build-index-scope-gates-and-dependencies) names what stays excluded. The wake word stays out of the MVP (decision 5). Native/offline help is capability-based; no general offline model is invented. Remaining exclusions are below. | No claim that all external sites work. Declare tested capabilities and stop safely at unsupported ones. |
| DEC 00–20 | Decisions are applied through their owning rules. 01–02 single-site/pitch scheduling is superseded; 03/16/20 browser conventions retained under the new design; 04 both payment approvals retained; 05–10 native feasibility, hardware, design, sign-in and timing stay implementation gates; 11–13 old document-loading workflow is replaced by this authorized repository specification; 14–19 control, voice and recovery are represented above, with later navigation decisions taking precedence. | Do not invent a delivery date, success-rate floor or hardware acceptance. DEC 10 requires a two-second pause within an utterance not to cut it off and visible working feedback within one second; verify those on the real speech/UI path. |

## Legacy requirements and exclusions

The [legacy migration inventory](legacy-model-migration.md) classifies every Quint source and the reusable ONB, SUR, CON, TURN, HLP, ACT, ACC, DATA, BILL/PAY, HIS/SHC and REC requirements. Cross-cutting privacy, control, continuity and recovery are retained. Email connector capability and bill provenance requirements are reinstated by the current request. Calendar is newly specified rather than claimed to exist in the old MVP.

The older `design/sources/on-screen-helper-prd.md` REC-04 (line 225 of the
legacy repository at the pinned snapshot) restores a paused checkpoint after process restart. Current ANDROID 09
and the replacement prototype supersede that crash-restoration clause. Sleep,
ordinary reload/navigation and manual pauses retain their checkpoint continuity;
restart retains canonical payment evidence and uncertainty, not the executable
assistance session.

The latest PRD still defers a companion app, caregiver delegation, password/payment vault, automatic OTP retrieval, multiuser cloud sync, app-store/arbitrary-app control, parallel assistance tasks and broad workflow building. Its wake-word exclusion holds for the MVP because no model runs on the device; continuous cloud recording is not implied. OTA and subscription payment models are infrastructure for later implementation, not part of personal bill payment. Set-up is in scope under the owner's directions (DIR 05); multilingual/specialist certification is not inferred from the older vision. Basic readable text, pace/volume controls, approved preferences, manual credentials and email connection remain required.

## State ownership and minimality

| Owner | State that belongs here | State deliberately derived or owned elsewhere |
|---|---|---|
| `shell` / `network` | Device readiness, app surface, actual connectivity / one private network-join attempt. | A completed join is not a second permanent online flag. No passwords or certificate trust inferred from a name. |
| `browser` | Ordered tabs, selected tab, page history/load/version, recent destinations and zoom. | No provider-specific page state or automation step number. |
| `conversation` / `assistant` | Transcript, draft and active voice turn / window, keyboard and one task. | Compact/expanded windows share the same conversation. Hidden does not mean completed. |
| `wake` / `preferences` | One wake timer and prior window / one persisted set of display, sound and wake choices. | Wake detection is separate from an active conversation microphone, and no detector is installed in the MVP. Timer expiry is not user intent. |
| `email` / `emailItem` | Account access, current folder/query/content and composer / each stable message's folder, read and mutation status. | No separate mailbox-view machine or duplicated unread counter. Counts and lists are projections. |
| `calendar` / `calendarView` | Calendar defines one occurrence's lifecycle; CalendarView owns the actual occurrence collection, canonical versioned series definitions, editing, atomic series saves, reminders and scoped deletion. | Committed fields drive previews and bill links. No second live occurrence store or calendar-owned paid flag. |
| `files` | One source-bound local catalog, selection, content request and pending operation. | Photos/Documents are projections; filenames are not identity. Print, still modeled on develop, is being removed. |
| `memory` | Proposed, approved and deleted non-secret facts with revisions. | Chat history is not permanent permission to reuse deleted facts. |
| `execution` | One current semantic operation, observation and bounded failed-approach memory. | No fixed URL/selector script, stored click queue or final-payment operation. |
| `task` | A task's kind, its subject and the terms she chose. | The kinds share one shape; nothing else reads a kind's own fields. |
| `billpay` / `payment` | Current provider facts and chosen preparation / exact review, durable attempt and observed provider outcome. | Preparation is not submission. Scheduled/accepted/completed/returned remain distinct facts. |
| `handoffs` / `workspace` | Canonical bill-to-record references / actual composed active states and retained payment records. | No second copy of payment status, no new bill identity per entry point and no independent task scheduler. |

Empty, pending, failed and unknown states are distinct only where the user or
adapter has a different permitted next action. Failure requires evidence when
retrying could duplicate an external operation. UI-only design-comparison
switches, fixture limits and simulated-success timers are not product state.

The `interaction` and `browserControls` modules are stateless dispatchers over
`assistant` and `browser`, used by `workspace` for controls and callbacks. They
do not introduce a second machine or stored copy of those states. Email's UI revision, durable
draft version and storage-request serial serve different boundaries: approval,
stale restored content and reordered acknowledgments respectively. A known
provider send result is separate from whether that result has been saved.

## Review criteria

For every model, review state ownership and sources, initial state, all enabled transitions, all rejected boundary inputs, terminal and recovery reachability, identity and revision fences, effects, persistence assumptions and the prose/Quint pair. No product guard may contain a simulation-only count cap. Verify generated TypeScript against Quint, then verify all Dafny obligations. A model proof is not a substitute for any implementation acceptance item above.

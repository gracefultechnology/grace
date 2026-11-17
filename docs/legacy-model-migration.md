# Grace legacy research and migration evidence

Research date: November 13, 2026, during the models-only phase. The provenance below still holds; where its scope differs from the owner's directions in the [acceptance list](implementation-acceptance.md#owner-directions), the directions win.

## Sources and authority

- The user-provided local checkout of the legacy repository exists, but its working branch is `shaw/updates`, at `48b43b9ca6ade7b72c6488f92bee6d4a3ddcf154`; this checkout lacks `design/` and contains TLA+ rather than Quint. It was not modified.
- `git ls-remote origin refs/heads/main` and `git rev-parse origin/main` both gave **c6e3fbbc38028ccb53ce05817e06c671d9e21642**, current main at research time, merge of PR #335 recovering Quint. Its relevant immutable tree was extracted to `/tmp/grace-legacy-source` using `git archive` for review. All legacy references below mean this commit, not the stale working branch.
- GitHub connector `github.fetch` was advertised but returned Unknown tool; Git read operations provided the fallback. Source links: [legacy product sources](https://github.com/gracefultechnology/grace/tree/c6e3fbbc38028ccb53ce05817e06c671d9e21642/design/sources) and [formal models](https://github.com/gracefultechnology/grace/tree/c6e3fbbc38028ccb53ce05817e06c671d9e21642/apps/app/formal).
- Explicit current user scope won at the time: email, calendar, browser and billpay in calendar; generic websites, models only. The owner's later directions widen it: bill payment is one kind of a general task, and set-up, one Google sign-in and cloud speech are in scope. New `prototype/Grace Prototype.html` wins for new appearance and demonstrated interactions. The latest dated MVP/DEC requirements within `prototype/prd.md` win over its earlier documents where consistent with current scope. Legacy PRD fills gaps only.
- The first audit used the now-removed bill-pay-only HTML. The replacement `Grace Prototype.html` includes actual Email, Calendar, Files and settings flows; it supersedes the former placeholder finding. Its current application behavior is now the design reference, while the immutable legacy sources below remain useful for provenance and safety requirements.

## Critical supersessions to retain explicitly

1. Legacy `design/sources/on-screen-helper-prd.md` prohibited agent activation of all submit/sign-in/payment controls and required consent for every navigation/read/fill. Latest `prototype/prd.md` INV 06 (line 1850), approval brief (1702–1716), and TXN 01–02 (2099–2102) permit **payment via website tap or explicit voice authorization** after current amount, payment date and funding account readback. Whole-utterance corrections invalidate the old proposal. Do not port `NoAgentCommit_Truth` unchanged as the new payment policy.
2. Legacy PRD excluded calendars/reminders and initially required Gmail plus one electricity provider. Latest embedded Phase 1 excluded email/connectors and fixed Chase. The present user explicitly requires both flows and generic websites. Those old scope exclusions and brand whitelists are superseded; safe unsupported-site fallback remains.
3. Latest DEC 16/20 in `prototype/prd.md` lines 2207–2211: **Close browser closes all tabs and returns Home**, next browser open creates one new tab; **system Home hides browser and preserves tabs/page**. Conversation persists unchanged in both. Older close-to-chat or retaining tabs on Close is obsolete.
4. New prototype is a bottom Grace window rather than the legacy fixed right 400dp panel. Legacy geometry/Atkinson defaults must not silently replace the current prototype's design. Semantic accessibility and current-state visibility requirements remain.
5. Latest Phase 1 excludes password retention and automatic OTP fetching, whereas earlier PRD permits a credential provider and approved code retrieval. Expanded email scope alone does not authorize secret retention or automatic code capture. Keep private manual credentials/codes and no secret model context unless product explicitly broadens this.

## Reusable product rules

Legacy PRD anchors: source `design/sources/on-screen-helper-prd.md`, sections 3–13, IDs below.

- **Onboarding/profile (ONB 01–03)**: confirmed name/language/pace/text preferences, no email prerequisite, preview immediately, persist confirmed choices, learn Close/reopen. Set-up is back in scope under the owner's directions and has its own spec, `setup`, with the order of acceptance list decision 10; the Google sign-in step can be put off.
- **Continuity (SUR 01–03, REC 04–07; current INT)**. One conversation spans surfaces. Close, sleep and browser reload pause work and retain its checkpoint. Explicit Resume requires current evidence. Current ANDROID 09 and the replacement prototype reset the active task on process or device restart. Durable payment evidence survives, and no interruption replays a write. The provider effect and local receipt storage are separate facts.
- **Conversation (CON 01–03, TURN 01–09)**: at most one meaningful question; answer belongs to newest visible question; tap/typed/voice committed input share logical semantics; reading scroll does not jump; draft survives mode switches. Busy reasoning is distinct from external work. Type suppresses automatic mic reopening. Two unusable utterances end listening; silence/ambiguous consent is not agreement. Own audio cannot become consent.
- **Observation/actuation (HLP 01–07, ACT 01–05)**: versioned origin/page/target/viewport evidence; current targets; one guidance target; hide stale guidance during motion; personal input invalidates conflicting fill offer. Exact proposal binding; one operation in flight; pause revokes queued work; unknown writes are investigated before retry. Website/email content is data, never authority.
- **Email/connectors (ACC 01–06)**: provider chosen, official auth, verify account/callback/capability before connected; distinguish cancel/failure/expiry/revocation/insufficient scope; selected account fixed for a read; read/search/open capabilities separate from action consent; metadata search does not imply body access; reconnect never silently switches account. Multi-account behavior must not reuse another account's data. Current expanded email send requires a separate send capability and current reviewed draft authorization, never inferred from read authorization.
- **Memory (DATA 01–04; current MEM 01–04, INV 08)**: explicit save, source and account association, candidate versus confirmed facts; view/correct/delete; deletion invalidates queued reuse; old chat cannot resurrect deleted values; separate memory/task/provider records. Masked references only for sensitive payment identity.
- **Bill/payment (BILL, PAY; current INV 06–07/TXN 01–02)**: verify bill/account/amount/date, check existing scheduled/pending payments, explicit choice of funding method. Persist unresolved attempt window *before* possible submission. Touch and voice use the same authoritative attempt ledger. Outcomes confirmed/pending/verified failure/unknown; missing confirmation is not failure. Retry only after proven nonexecution/failure and fresh approval. Receipt save failure does not undo confirmed payment.
- **History/shortcuts (HIS, SHC)**: durable evidence-based receipt, retrieve later, personal memory deletion independent of outcome ledger, optional deduplicated shortcuts with independent lifecycle and no implicit new permissions.
- **Recovery (REC 01–07)**: unsupported provider/site/challenge is a truthful manual fallback; timeout may mean unknown; no automatic ambiguous write retry; wrong account/amount suspends old plan; preserve useful facts without misreporting success.
- **Accessibility/privacy (sections 11–13; current UI/ENG/DATA)**: labels and text states as well as visual cues; readable controls/actual keyboard insets; no secret model/log exposure; no disabled silent controls; retain shell/settings usefulness if inference fails. Device usability and private capture efficacy require later integration evidence, not a pure model proof.

## All legacy Quint files and disposition

The tree has **32 `.qnt` files**. They are diagnostic models of old implementations, with alternative fixes and intentionally failing scenarios. Their `var/action/init/step`, model-instance parameters, temporal operators and diagnostic flags cannot be dropped directly into Vibestack `pure def` blocks. Reuse desired safety properties and state distinctions; remove legacy migration switches, bounded counters and duplicated implementation layers. Every reconstructed pure transition must be checked again.

| Legacy file (under apps/app/formal) | Reuse/disposition |
|---|---|
| `account/AccountKeyCustody.qnt` | Account isolation, authentic identity before data access, explicit expiry vs revocation and deletion semantics. Native key wrapping/adoption mechanisms remain implementation-stage infrastructure. |
| `account/AndroidProcessEnv.qnt` | Reuse callback retirement and truthful runtime availability after process death. Current ANDROID 09 clears the active session on restart and retains durable evidence. Android service restart and trust-follow machinery remain implementation work. |
| `account/CrashFile.qnt` | Durable-before-ack contract for attempt/receipt persistence. Filesystem fsync modeling deferred to actual storage shell. |
| `account/KeyAdoptDurability.qnt` | Never lose readable data during key adoption; detailed Keystore/two durability-domain protocol deferred. |
| `account/NativeEnrollment.qnt` | Connector auth completes only after valid acknowledgment; cancel/late callback fence. Grace cloud enrollment machinery deferred. |
| `account/SetupSignInCancel.qnt` | Cancel current login without disconnecting an unrelated established account; distinguish busy from unavailable. |
| `guide-bill/BillAttempt.qnt` | Preserve attempt across task replacement/restart; no second payment guidance while unresolved; confirmed evidence distinct from saved receipt; failure branch reachable. Generalize one bill to stable bill/occurrence identity. |
| `guide-bill/BillerEnv.qnt` | External submit can commit with response lost; pending can later fail/return; history may lag; no provider liveness promise. Environment assumptions, not claimed universal site truth. |
| `guide-bill/ControlOracle.qnt` | Actual consequence is different from visible label. Unknown/ambiguous control classification must refuse or seek manual handling. No keyword-only universal safety claim. Old no-agent-commit policy superseded by latest voice approval. |
| `guide-bill/ControlOracleLive.qnt` | Generated diagnostic table of finite labels; not portable code or universal classifier. Keep as source evidence, do not migrate table. |
| `guide-bill/GuideConsent.qnt` | One-shot consent bound to exact current proposal/context/value and whole heard question; no stale/early yes. Replace old blanket no-agent-commit invariant with exact approved-submit rule. |
| `guide-bill/GuideStopFence.qnt` | Local stop fences queued work, current epoch checked at actual effect boundary; no claim that stop reverses in-flight effect. |
| `guide-bill/MoneyEffect.qnt` | Shared cross-entry attempt ledger, durable record before submission, no repay prompt across calendar/email/browser paths; receipt-saving separated from effect. |
| `guide-bill/StandingQuestion.qnt` | One newest visible question; old/hidden question cannot consume yes; answer route independent of input mode. |
| `money-cloud/CloudStripeIntake.qnt` | Grace subscription webhook/security mechanics deferred; generic idempotence/evidence principles already covered by operation model. Not website billpay. |
| `money-cloud/PlanCheckout.qnt` | Grace paid-plan checkout/card checks deferred; do not import as senior bill-payment requirement. |
| `money-cloud/SubscriptionCommand.qnt` | Grace subscription changes deferred; unknown remote outcome principle reused in generic operation model. |
| `task-kernel/GatewayTurnFence.qnt` | Owner/epoch-bound callbacks; no stale answer shown after account switch; stop acknowledgment honest. Network gateway mechanics deferred. |
| `task-kernel/InteractiveTask.qnt` | Active/prepared/dispatched/unknown/terminal distinctions, one operation, unknown blocks new work, explicit restart/resume and re-observation. |
| `task-kernel/TaskActuatorDispatch.qnt` | At-most-one local dispatch, current observation consumed, success requires evidence, late effect unknown; no false global at-most-once promise for arbitrary websites. |
| `task-kernel/TaskBindingFence.qnt` | Rebind/expiry/revoke invalidate previous authority and cannot revive stale epoch. Browser peer database details deferred. |
| `task-kernel/TaskFence.qnt` | Fresh current observation/task generation, monotone epoch, old proposal invalidated after rebind; reconstruct minimal unbounded pure model. |
| `task-kernel/TaskLifecycleClient.qnt` | Start own goal, pause/resume truth, lost responses preserve uncertainty, last intent/epoch wins; avoid seven parallel frontend/host states. |
| `task-kernel/TaskOwnerFence.qnt` | No cross-owner creates, actions, revocations or response delivery; selected provider account binding. |
| `updater/OtaFreshAdmission.qnt` | OTA release admission/rollback/revocation is release infrastructure, deferred; no app-state dependency. |
| `updater/OtaInstallJournal.qnt` | OTA journal/recovery infrastructure deferred; durable attempt pattern reused only where product relevant. |
| `voice/HookCaptureGuarantee.qnt` | Listening always has active capture; capture-ended updates logical state. React hook graph refinement belongs to later implementation. |
| `voice/SpeechCancel.qnt` | Request-scoped cancellation; no stale cancel hitting later speech; honest stopped/cancelled result. Native ABI/thread choreography deferred. |
| `voice/TurnProtocol.qnt` | Compact mic/listening/held/completed turn protocol and no orphan listening. |
| `voice/TurnTaking.qnt` | Stop invalidates timers/verdict; no auto-send invalid/held input; proper countdown/capture fact. Use current PRD speech policy, not obsolete timer implementation. |
| `voice/VoiceTurn.qnt` | No capture hidden/unmounted or own audio; draft never lost; no autonomous send over newer turn; visible state matches capture. |
| `voice/graphs/HookCaptureGraph.qnt` | Generated graph of old source (474 lines); retain provenance only, never migrate as new source model. |

## Known model pitfalls to fix instead of reproducing

- `BillAttempt.qnt` lines 32–56: original ReadFailure's redundant UNCHANGED guard made the readable failure branch unreachable. `attemptLost` is never assigned and `said` is not reset by StartTask. Do not retain unused state. Old M1 storage keyed per task misses a second uncertain payment in the same task; shared stable bill identity is needed across all entry points.
- `MoneyEffect.qnt` header and checks `pin.NoRepayPrompt`, `pinBothPaths.NoRepayPrompt`: guide and bill path stores are separate; hidden consequential control has no row; cross-path repeated guidance occurs. One authoritative attempt record replaces these duplicate stores.
- `ControlOracle.qnt` explicitly hand-assigns truth to a finite label table: correct label recognition is an assumption, never proved for arbitrary websites. Generic browser model accepts vetted semantic operation and current evidence, otherwise manual fallback.
- `StandingQuestion.qnt` header: BesideVisible assumes every standing question is visibly presented; implementation still had hidden-thread corner cases. Model visibility explicitly and consume only current visible question.
- `InteractiveTask` pinned failures: FreshObservationPerEffect and ObservationVersionMonotonic. A new action must not reuse an old observation generation after rebind/restart.
- `TaskActuatorDispatch` `pin-strict-authority`: cancellation cannot erase an already dispatched external action. Distinguish local fence from unknown remote result.
- `TaskLifecycleClient` pinned failures: CancelNotRefusedByPlanner, CancelNeverFails, CancelHonest, ResumeHonest, NoSilentPauseLoss, ViewMatchesHostAtRest. Avoid optimistic paused/completed claims before owning authoritative state.
- `TaskOwnerFence` pinned failures: NeverCreateDuringReset, ResponseFenced; `GatewayTurnFence`: NoOrphanAfterSignOut. Scope asynchronous replies to owner and generation.
- `AccountKeyCustody` pin failures: RevocationReachesAllAccountData, RevokedUnreadable, NoFalseRevocation, SignOutKeeps, NoStrandedData. Do not promise erased/readable data based solely on auth UI state.
- `VoiceTurn` pin failures: AutoSendVisible, NoHeldExtension, DraftNeverHidden, ReplyNotSuppressed, NoAutoListenDuringTurn. `SpeechCancel` pin-effective also fails. A pure model cannot inherit production correctness from these tables.

The checks JSON files contain recorded status/counts, not new verification in this research session. No legacy tests, device runs, account access, payment actions or code migration were performed.

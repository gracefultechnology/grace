# Owned UI operation inventory

`Workspace` owns the actual Shell, Browser, Assistant/Conversation, Preferences,
Wake, Execution and payment states. A component must dispatch through that
owning aggregate rather than instantiate a second child machine. The two
stateless interaction libraries call child guards and transitions on those
same stored values. This inventory concerns specified routes, not which of
them the React/VibeLang interface already wires, nor hardware acceptance.

Files, Email and Calendar retain their own canonical state. The stateless
`Handoffs.trySharePhoto` operation updates Files and the chosen mailbox together;
its returned pair replaces those owners' values and is not another store.

| Owned state and operation | Canonical route |
|---|---|
| Startup success/failure/retry, sleep, touch wake, restart | `changeLifecycle`; Sleep retains paused task/chat/draft, while Restart clears that transient session, retires execution, resets browser tabs and restores durable preferences/payment records with fresh callback versions |
| Connectivity, reasoning route, microphone permission, observation permission | `setAvailability` with actual host evidence |
| Home, Calendar, Email, Internet, Files, Settings, return to application | `visit`, `returnToApplication` |
| Home carousel, Settings page, Wi-Fi/Volume popover toggle and dismissal | `chooseHomePage`, `chooseSettingsPage`, `togglePopover`, `dismissPopover` |
| New/select/close tab, address typing, empty Go, dismiss address keyboard, navigate/back/forward/reload | Typed `changePage` through `browserControls`; Close browser remains `closeBrowser` because it also returns Home |
| Measured tab capacity, current scroll/page-panel state, zoom and manual page/form/account changes | Typed `changePage`; host reports name the current browser revision, with selected-tab identity for page changes |
| Recent shortcut removal, Clear question and answer | Typed `changePage`; these update Browser history UI without changing the website or interrupting its task |
| Website load, expected authorized progress, unexpected navigation | `receiveLoad`, `receiveProgress`, `unexpectedPage`; these are separate authenticated host routes, with unexpected navigation bound to the selected tab and revision |
| Open/Close Grace, Stop, Talk, privacy removal | `openGrace`, `closeGrace`, `stop`, `talk`, `purgePrivate` |
| Type/edit/send, answer chip, heard human utterance, service reply/error/silence/unusable speech, speech completion | `interact` through `interaction`; callback generation and audio provenance remain checked |
| Publish/reanchor or retire a current target; Dismiss label/ring and Show guidance | `publishGuidance` / `invalidateGuidance` for authenticated host evidence; `interact` Dismiss/Show for the person. Guidance visibility is bound to current device/page/task/conversation revisions, with the instruction retained in Grace. |
| Resize Grace, Show chat, website keyboard focus/dismissal, read history/latest, Repeat, stop output voice | `interact`; keyboard/geometry changes invalidate targets while preserving an explicit wait for the person's answer |
| Task begin, pause/resume, replacement/keep/confirm, Continue, abandon, new conversation | `begin`, `stop`, `resume`, `requestReplacement`, `keepTask`, `replaceTask`, `continueTask`, `abandonTask`, `newConversation` |
| Reconciliation, ordinary step, website waiting, verified endpoint | `observe`, `prepare`, `dispatch`, `verify`, `completeOrdinary`; payment waiting/completion use the payment routes |
| Text size, brightness/night dimming, speech pace/output, system volume/mute, wake preference | `changePreferences`; validated setting values come from the existing Preferences helpers |
| Undo, automatic save/retry, success/failure acknowledgement, voice/system sound sample | `undoPreferences`, `savePreferences`, `preferencesSaved`, `samplePreferences`; samples carry the current preference revision |
| Enabled wake detection, silence notice, return to prior window, cancellation | `detectWake`, `wakeNoSpeech`, `wakeReturn`, `cancelWake`; no detector is installed in the MVP (acceptance list, decision 5), so only touch wakes the tablet |
| Share the current readable Files photo into a chosen mailbox | `Handoffs.trySharePhoto`; preflight the current file and mailbox before clearing preview, then create an unsent draft with that exact photo |
| Close Calendar or Email | Calendar `closeCalendar`, or Email `preserveDraft` / explicit `discardDraft`, precedes workspace `visit(Home)`; pending operations remain owned and recoverable |
| Close Files | Files `closeFiles` precedes workspace `visit(Home)`; previews and reads close, while the catalog, chosen tab and dispatched storage/print operations remain owned |
| Close Settings | Workspace `visit(Home)` follows the prototype's app-header Close; `returnToApplication` is the separate return from native settings to the prior application, not this Close action |

Address-keyboard changes, text-size changes and native/browser geometry use the
same target invalidation contract. Volume, pace and recent-shortcut edits do
not imply a changed webpage. Generic task observation, preparation and completion
wait for pending reasoning and unanswered questions. A fully classified spoken
payment approval has its separate atomic transcript-and-authorization route;
website taps use the actual browser-host report. Neither path creates a second
payment ledger or a second conversation.

The native host reports lock as a lifecycle interruption and preserves its own
authentication screen. It supplies `WakeDevice` or a ready wake-detection context
only when the OS permits Grace to be shown. Voice or touch wake is never an
unlock credential; successful unlock alone does not resume a paused task.

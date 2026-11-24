# Grace MVP product contract

The current request includes email, calendar, Files, browser and bill payment launched from calendar. Older single-site or pitch-only exclusions do not limit this rebuild. The replacement `prototype/Grace Prototype.html` provides the design and application flows for Home, the rail, Email, Calendar, Files, settings, browser and compact/expanded Grace. Its actual application flows supersede the earlier bill-pay-only prototype; mock provider and storage success are replaced with explicit integration outcomes.

The visual direction is the prototype's Figtree typography, soft gradient frame, glass surfaces, lilac conversation and familiar browser. Keep the calendar, email and internet previews, persistent labeled Ask Grace entry, compact bottom assistance, expanded chat, website keyboard state and caption strip. No provider page is restyled. Layout dimensions are responsive to measured usable space and native keyboard insets; prototype canvas dimensions are references, not fixed runtime assumptions. Exact tokens, visual comparison, accessible labels and hardware readability are implementation acceptance criteria.

- [Device readiness, Home and native settings](./shell.md)
- [Set-up of a new tablet, resumable across restarts](./setup.md)
- [Wi-Fi selection, private sign-in and connection recovery](./network.md)
- [Browser tabs, navigation and current-page state](./browser.md)
- [Browser controls and current host observations](./browserControls.md)
- [The website drawn under Grace and touch routing](./surface.md)
- [Website messages, downloads, file choices, site permissions and sign-ins](./websiteRequests.md)
- [Android Back and launcher Home keys](./deviceKeys.md)
- [Conversation, voice, typed input and reading continuity](./conversation.md)
- [Hey Grace, sleep wake and unanswered listening](./wake.md)
- [One assistance task, compact and expanded presentation](./assistant.md)
- [Shared conversation controls and service-result routing](./interaction.md)
- [Toasts, banners and Android notifications](./notices.md)
- [Approved personal memory and deletion](./memory.md)
- [Saved details: the list she approves, sees and deletes](./savedDetails.md)
- [Voice output, pace and readable text preferences](./preferences.md)
- [Turn requests, consent used once and who may act](./request.md)
- [Email accounts, provider sign-in, uses and removal](./accounts.md)
- [Email connection, reading, attachments and reviewed sending](./email.md)
- [Message folders, read status, Trash and restoration](./emailItem.md)
- [Calendar occurrences, recurrence and reminders](./calendar.md)
- [Week and month views, current occurrences and recurring deletion](./calendarView.md)
- [The calendar question Grace is waiting on and her yes](./proposal.md)
- [All inboxes, Outbox, account banners and the From address](./mailboxes.md)
- [Calendars together, tags, the connect banner and an appointment from an email](./calendars.md)
- [What Grace may do with email and the calendar, each action routed to its guarded event](./agentActions.md)
- [Saved photos, documents and Email sharing](./files.md)
- [The vocabulary of a task: its kind, subject and terms](./task.md)
- [The task kinds: what each needs, its facts and its fill](./taskKinds.md)
- [A bill as a task kind: its facts and fitting payment](./billKind.md)
- [A visit as a task kind: its facts and fitting booking](./bookingKind.md)
- [Generic evidence-grounded website operations](./execution.md)
- [Bill discovery, choices and verified preparation](./prep.md)
- [Join a task's preparation to its review, its fills and its view](./taskBridge.md)
- [Commitment authorization, durable attempts and provider outcomes](./commitment.md)
- [One canonical bill across Email, Calendar and browser entry points](./handoffs.md)
- [Composed navigation, interruption and execution](./workspace.md)
- [Actuator checks for emitted browser and payment commands](./actuation.md)
- [Current saved-value authority for queued website fills](./memoryActuation.md)

Personal memory, task state and provider records have distinct lifecycles. Deleting a calendar item or remembered fact never cancels a payment or removes unresolved evidence. New sessions and different surfaces cannot create a new identity for the same provider bill. Scheduled and accepted are not settlement. Unsupported sites, missing evidence, unavailable sign-in challenges and privacy failures stop with an explanation and a usable manual path.

The application in `apps/app` is a Capacitor Android application. The MVP ships the Home launcher APK, built on the shared Android host, browser surface and AOSP staging of the pinned `vendor/eliza`. The formal checks establish these models and their generated contracts; storage durability, provider integrations, speech capture, visual fidelity and senior usability still need the acceptance exercises on the device, listed in the checklist in `docs/implementation-acceptance.md`.

## Story: Manage my saved passwords privately

> I can open Passwords from the last Home page, beside Files, and immediately find,
> add, change or delete a saved sign-in, even if my tablet has no screen lock.
> I can tap to show or copy a password. When I ask Grace to sign in on a website,
> Android lets me choose a matching account. Grace can point to these controls
> without receiving a password.

### Passwords displays sign-in details only while the vault is available

Android keeps passwords encrypted and owns the editor, generator and protected
view for showing a password. Copy uses Android’s sensitive clipboard with
best-effort expiration. Opening Passwords in the foreground shows sign-in
names for the admitted tablet owner. Leaving Passwords, backgrounding Grace
or changing owners clears those details. An older vault encrypted with a
credential-bound key requires its owner's authorization to migrate. Web
previews describe unavailability. Vault summaries stay out of transcripts,
agent tools and cloud requests.

~~~quint
type VaultActor = PasswordsPerson | PasswordsHost
type LoginBinding = { kind: str, facet: str, display: str }
type LoginSummary = { id: str, label: str, username: str, bindings: List[LoginBinding], revision: int }
type VaultIssue = LegacyAuthorization | UnsupportedVault | LostVaultKey | VaultClosed
type VaultNotice = QuietVault | CancelledVaultAction | FailedVaultAction | SavedLogin | DeletedLogin | ChangedLogin | BackupUnavailable
type VaultMode = ClosedPasswords | CheckingVault | LockedVault | UnavailableVault({ reason: VaultIssue })
  | OpenVault({ entries: List[LoginSummary], selected: str })
type PasswordGuide = NoPasswordGuide | OpenPasswordGuide | FindPasswordGuide | ShowPasswordGuide | CopyPasswordGuide | FillPasswordGuide
type GuideMic = GuideMicIdle | GuideMicListening | GuideMicUnavailable | GuideMicNoMatch
type PasswordView = { vault: VaultMode, generation: int, notice: VaultNotice, guide: PasswordGuide, backupReady: bool, guideMic: GuideMic, guideMicEpoch: int }

pure val initial: PasswordView = { vault: ClosedPasswords, generation: 0, notice: QuietVault, guide: NoPasswordGuide, backupReady: false, guideMic: GuideMicIdle, guideMicEpoch: 0 }
pure def canOpenPasswords(v: PasswordView, by: VaultActor): bool =
  by == PasswordsHost and not(isCheckingVault(v.vault)) and not(isOpenVault(v.vault))
pure def openPasswords(v: PasswordView, by: VaultActor): PasswordView =
  { ...v, vault: CheckingVault, generation: v.generation + 1, notice: QuietVault }
pure def canClosePasswords(v: PasswordView, by: VaultActor): bool =
  by == PasswordsHost and not(isClosedVault(v.vault))
pure def closePasswords(v: PasswordView, by: VaultActor): PasswordView =
  { ...v, vault: ClosedPasswords, generation: v.generation + 1, notice: QuietVault, guide: NoPasswordGuide, backupReady: false }
pure def canLockPasswords(v: PasswordView, by: VaultActor): bool =
  by == PasswordsHost and not(isClosedVault(v.vault)) and not(isLockedVault(v.vault))
pure def lockPasswords(v: PasswordView, by: VaultActor): PasswordView =
  { ...v, vault: LockedVault, generation: v.generation + 1, notice: QuietVault }
pure def canReportUnavailable(v: PasswordView, generation: int, by: VaultActor): bool =
  by == PasswordsHost and generation == v.generation and not(isClosedVault(v.vault))
pure def reportUnavailable(v: PasswordView, generation: int, reason: VaultIssue, by: VaultActor): PasswordView =
  { ...v, vault: UnavailableVault({ reason: reason }), notice: QuietVault }
pure def needsLegacyAuthorization(reason: VaultIssue): bool =
  match reason { | LegacyAuthorization => true | _ => false }
pure def canUnlockPasswords(v: PasswordView, by: VaultActor): bool =
  val vault = v.vault
  by == PasswordsPerson and (match vault {
    | UnavailableVault(unavailable) => needsLegacyAuthorization(unavailable.reason)
    | _ => false
  })
pure def unlockPasswords(v: PasswordView, by: VaultActor): PasswordView =
  { ...v, vault: CheckingVault, generation: v.generation + 1, notice: QuietVault }
pure def validSelection(entries: List[LoginSummary], selected: str): bool =
  selected == "" or entries.some(e => e.id == selected)
pure def selectedLogin(mode: VaultMode): str =
  match mode { | OpenVault(opened) => opened.selected | _ => "" }
pure def canReportLogins(v: PasswordView, generation: int, by: VaultActor): bool =
  by == PasswordsHost and generation == v.generation and
    (isCheckingVault(v.vault) or isOpenVault(v.vault))
pure def reportLogins(v: PasswordView, generation: int, entries: List[LoginSummary], notice: VaultNotice, by: VaultActor): PasswordView =
  val selected = selectedLogin(v.vault)
  { ...v, vault: OpenVault({ entries: entries, selected:
      if (notice != DeletedLogin and validSelection(entries, selected)) selected else "" }), notice: notice }
pure def isClosedVault(mode: VaultMode): bool =
  match mode { | ClosedPasswords => true | _ => false }
pure def isLockedVault(mode: VaultMode): bool =
  match mode { | LockedVault => true | _ => false }
pure def isCheckingVault(mode: VaultMode): bool =
  match mode { | CheckingVault => true | _ => false }
pure def isOpenVault(mode: VaultMode): bool =
  match mode { | OpenVault(_) => true | _ => false }
pure def canSelectLogin(v: PasswordView, id: str, by: VaultActor): bool =
  val vault = v.vault
  by == PasswordsPerson and (match vault {
    | OpenVault(opened) => validSelection(opened.entries, id)
    | _ => false
  })
pure def selectLogin(v: PasswordView, id: str, by: VaultActor): PasswordView =
  val vault = v.vault
  match vault {
    | OpenVault(opened) => { ...v, vault: OpenVault({ entries: opened.entries, selected: id }), notice: QuietVault }
    | _ => v
  }
pure def canReportVaultNotice(v: PasswordView, generation: int, by: VaultActor): bool =
  by == PasswordsHost and generation == v.generation and not(isClosedVault(v.vault))
pure def reportVaultNotice(v: PasswordView, generation: int, notice: VaultNotice, by: VaultActor): PasswordView =
  { ...v, notice: notice }
pure def alwaysSelectionIsVisible(v: PasswordView): bool =
  val vault = v.vault
  match vault {
    | OpenVault(opened) => validSelection(opened.entries, opened.selected)
    | _ => true
  }
pure def lawForegroundHostCanOpenPasswords(entries: List[LoginSummary]): bool = {
  val checking = openPasswords(initial, PasswordsHost)
  canOpenPasswords(initial, PasswordsHost) and canReportLogins(checking, checking.generation, PasswordsHost) and
    isOpenVault(reportLogins(checking, checking.generation, entries, QuietVault, PasswordsHost).vault)
}
pure def sometimesPasswordsUnlock(v: PasswordView): bool = isOpenVault(v.vault)
pure def sometimesSavedLoginIsSelected(v: PasswordView): bool = selectedLogin(v.vault) == "saved"
pure val exampleLogin: LoginSummary = {
  id: "saved", label: "Example", username: "Pat", revision: 1,
  bindings: List({ kind: "web", facet: "https://utility.example", display: "utility.example" })
}
pure val entriesValues = Set(List(), List(exampleLogin))
pure val reasonValues = Set(LegacyAuthorization, UnsupportedVault, LostVaultKey, VaultClosed)
pure val idValues = Set("", "saved", "unknown")
~~~

### Showing, copying and deleting a sign-in use the revision the person chose

If another native action updates the sign-in first, Passwords shows the
current details and asks the person to choose again. Cancel keeps the entry.

~~~quint
pure def mayUseChosenLogin(chosen: LoginSummary, latest: LoginSummary): bool =
  chosen.id == latest.id and chosen.revision == latest.revision
pure def lawChangedLoginNeedsANewChoice(chosen: LoginSummary, latest: LoginSummary): bool =
  chosen.revision != latest.revision implies not(mayUseChosenLogin(chosen, latest))
pure val chosenValues = Set(exampleLogin, { ...exampleLogin, revision: 2 })
pure val latestValues = Set(exampleLogin, { ...exampleLogin, revision: 2 })
~~~

### Grace can describe private sign-in without operating the vault

The regular Ask Grace field and microphone accept requests for password help.
Grace uses the current typed request or a complete human utterance to point
to a control. Guidance receives no vault state, account data or website form
values.
Typed commands work when Cloud speech or Cloud reasoning is unavailable. Known commands select
the general Passwords screen or Browser and a cue for the named control.
Guidance never chooses or reveals an entry, copies a
password, opens a private page or presses a website button. An explicit
sign-in command has a separate [browser admission rule](./browserControls.md).

During a voice conversation, a recognized password request goes
directly from the final human utterance to password guidance. The request
stays out of the conversation history and the reasoning agent.

On the Passwords Home card the person may type a local command or explicitly
start Cloud speech under their signed-in Grace account. The person sees the
disclosure before first use. Cloud speech receives the microphone audio for a
single command. Only the current complete utterance can select a known guide
command. An unmatched or retired utterance is discarded. Neither the recording
nor its transcript is added to the chat or sent to the reasoning agent. Leaving
the card, changing accounts, typing, going offline or hiding Grace retires
capture. Entering or leaving this card clears the unsent draft. When speech is
unavailable the person can still type. The private Passwords screen keeps its microphone off.
Password guidance recognizes a short list of spoken or typed phrases, such
as “Open Passwords,” “Where can I find my saved passwords?”, “Show my password,”
“Copy my password,” and “Use a saved password.” The person chooses the
saved sign-in and uses the highlighted control.

~~~quint
pure def passwordGuide(words: str): PasswordGuide =
  if (words == "open passwords" or words == "open saved passwords" or words == "can you open my passwords") OpenPasswordGuide
  else if (words == "find a password" or words == "find a saved password" or words == "where are my passwords" or words == "where can i find my saved passwords") FindPasswordGuide
  else if (words == "show my password" or words == "how do i show a password") ShowPasswordGuide
  else if (words == "copy my password" or words == "how do i copy a password") CopyPasswordGuide
  else if (words == "fill my password" or words == "use a saved password" or words == "how do i fill a saved password") FillPasswordGuide
  else NoPasswordGuide
pure def canSetPasswordGuide(v: PasswordView, guide: PasswordGuide, by: VaultActor): bool =
  by == PasswordsHost and guide != v.guide
pure def setPasswordGuide(v: PasswordView, guide: PasswordGuide, by: VaultActor): PasswordView =
  { ...v, guide: guide }
pure def lawGuidanceIsIndependentOfVault(v: PasswordView, other: PasswordView, guide: PasswordGuide): bool =
  setPasswordGuide(v, guide, PasswordsHost).guide == setPasswordGuide(other, guide, PasswordsHost).guide
pure def stepGuidanceNeverChangesVault(before: PasswordView, via: str, after: PasswordView): bool =
  via == "setPasswordGuide" implies before.vault == after.vault
pure def sometimesPasswordsGuideToCopy(v: PasswordView): bool = v.guide == CopyPasswordGuide
pure def canStartGuideMic(v: PasswordView, by: VaultActor): bool =
  by == PasswordsPerson and v.guideMic != GuideMicListening
pure def startGuideMic(v: PasswordView, by: VaultActor): PasswordView =
  { ...v, guideMic: GuideMicListening, guideMicEpoch: v.guideMicEpoch + 1 }
pure def canFinishGuideMic(v: PasswordView, ticket: int, result: GuideMic, by: VaultActor): bool =
  by == PasswordsHost and v.guideMic == GuideMicListening and ticket == v.guideMicEpoch and result != GuideMicListening
pure def finishGuideMic(v: PasswordView, ticket: int, result: GuideMic, by: VaultActor): PasswordView =
  { ...v, guideMic: result }
pure def sometimesGuideMicListens(v: PasswordView): bool = v.guideMic == GuideMicListening
pure def lawOldGuideMicResultIsIgnored(v: PasswordView, ticket: int, result: GuideMic): bool =
  ticket != v.guideMicEpoch implies not(canFinishGuideMic(v, ticket, result, PasswordsHost))
pure val wordsValues = Set("open passwords", "find a password", "show my password", "copy my password", "fill my password", "show password example")
~~~


### A change of account discards the previous Passwords view

When the host reports a change of account, Passwords, if it is showing,
checks the vault again for the new account, and the guide and backup
readiness are cleared. Which account may open the vault, and linking
passwords kept on the tablet to a verified account, are
[set-up's password rules](./setup.md#story-keep-my-passwords-private-when-the-tablet-account-changes).

```quint
pure def canPasswordOwnerChanged(v: PasswordView, by: VaultActor): bool =
  by == PasswordsHost
pure def passwordOwnerChanged(v: PasswordView, by: VaultActor): PasswordView =
  { ...v,
    vault: if (isClosedVault(v.vault)) ClosedPasswords else CheckingVault,
    generation: v.generation + 1, guide: NoPasswordGuide, notice: QuietVault, guideMic: GuideMicIdle, backupReady: false }
pure def stepAccountChangeDiscardsPriorPasswordView(before: PasswordView, via: str, after: PasswordView): bool =
  via == "passwordOwnerChanged" implies not(isOpenVault(after.vault)) and after.guide == NoPasswordGuide and not(after.backupReady)
```


### A closed Passwords screen offers no backup action

The host reports whether Backup and recovery is ready for the current
Passwords screen. A report for an earlier screen, or while Passwords is
closed, is refused, and closing Passwords withdraws the offer. Who is offered
Backup and recovery, its fresh approval and restoring only into an empty
vault are [set-up's backup rules](./setup.md#story-back-up-and-recover-my-saved-passwords).

```quint
pure def canReportBackupReady(v: PasswordView, generation: int, ready: bool, by: VaultActor): bool =
  by == PasswordsHost and generation == v.generation and not(isClosedVault(v.vault)) and ready != v.backupReady
pure def reportBackupReady(v: PasswordView, generation: int, ready: bool, by: VaultActor): PasswordView =
  { ...v, backupReady: ready }
pure def alwaysClosedVaultHasNoBackupAction(v: PasswordView): bool =
  isClosedVault(v.vault) implies not(v.backupReady)
```

### Passwords offers cloud recovery only after the native host confirms readiness

The protected recovery menu can be offered while the local vault is locked,
once the host reports it ready. Grace's view holds only whether it is ready.

~~~quint
pure def sometimesBackupAndRecoveryIsAvailable(v: PasswordView): bool =
  isLockedVault(v.vault) and v.backupReady
~~~

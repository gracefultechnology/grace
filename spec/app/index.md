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
- [Generic evidence-grounded website operations](./execution.md)
- [Bill discovery, choices and verified preparation](./billpay.md)
- [Verified preparation to the current payment review](./preparationReview.md)
- [Commitment authorization, durable attempts and provider outcomes](./commitment.md)
- [One canonical bill across Email, Calendar and browser entry points](./handoffs.md)
- [Composed navigation, interruption and execution](./workspace.md)
- [Actuator checks for emitted browser and payment commands](./actuation.md)
- [Current saved-value authority for queued website fills](./memoryActuation.md)

Personal memory, task state and provider records have distinct lifecycles. Deleting a calendar item or remembered fact never cancels a payment or removes unresolved evidence. New sessions and different surfaces cannot create a new identity for the same provider bill. Scheduled and accepted are not settlement. Unsupported sites, missing evidence, unavailable sign-in challenges and privacy failures stop with an explanation and a usable manual path.

The application in `apps/app` is a Capacitor Android APK, in a launcher (Home) and a standalone flavor, built on the shared Android host, browser surface and AOSP staging of the pinned `vendor/eliza`. The formal checks establish these models and their generated contracts; storage durability, provider integrations, speech capture, visual fidelity and senior usability still need the acceptance exercises on the device, listed in `docs/implementation-acceptance.md`.

## Story: Manage my saved passwords privately

> I can open Passwords from the second Home page and use my tablet screen
> lock to see my saved sign-ins. I can add, edit, show, copy or delete a sign-in,
> and use a matching saved sign-in on a website after Android asks me to
> unlock and choose. I can ask Grace for instructions without sharing
> credentials.

### Passwords displays sign-in details only while the vault is available

Android owns the encrypted vault, authentication, password editor, generator
and the protected view for showing a password. Copy uses Android’s sensitive
clipboard, with best-effort expiration. Grace displays a list of
sign-in names and account names for the active unlocked view. Leaving
Passwords, backgrounding Grace, or expiration drops those details. Web
previews describe unavailability. The vault and its summaries are excluded
from the transcript, memory, cloud and agent tools.

~~~quint
type VaultActor = PasswordsPerson | PasswordsHost
type LoginBinding = { kind: str, facet: str, display: str }
type LoginSummary = { id: str, label: str, username: str, bindings: List[LoginBinding], revision: int }
type VaultIssue = NoDeviceLock | UnsupportedVault | LostVaultKey | VaultClosed
type VaultNotice = QuietVault | CancelledVaultAction | FailedVaultAction | SpokenHelpUnavailable | SavedLogin | DeletedLogin | ChangedLogin | BackupUnavailable
type VaultMode = ClosedPasswords | CheckingVault | LockedVault | UnavailableVault({ reason: VaultIssue })
  | OpenVault({ entries: List[LoginSummary], selected: str })
type PasswordGuide = NoPasswordGuide | OpenPasswordGuide | FindPasswordGuide | ShowPasswordGuide | CopyPasswordGuide | FillPasswordGuide
type GuideMic = GuideMicIdle | GuideMicListening | GuideMicUnavailable | GuideMicNoMatch
type PasswordView = { vault: VaultMode, generation: int, notice: VaultNotice, guide: PasswordGuide, backupReady: bool, guideMic: GuideMic, guideMicEpoch: int }

pure val initial: PasswordView = { vault: ClosedPasswords, generation: 0, notice: QuietVault, guide: NoPasswordGuide, backupReady: false, guideMic: GuideMicIdle, guideMicEpoch: 0 }
pure def canOpenPasswords(v: PasswordView, by: VaultActor): bool =
  by == PasswordsHost and isClosedVault(v.vault)
pure def openPasswords(v: PasswordView, by: VaultActor): PasswordView =
  { ...v, vault: CheckingVault, generation: v.generation + 1, notice: QuietVault }
pure def canClosePasswords(v: PasswordView, by: VaultActor): bool =
  by == PasswordsHost and not(isClosedVault(v.vault))
pure def closePasswords(v: PasswordView, by: VaultActor): PasswordView =
  { ...v, vault: ClosedPasswords, generation: v.generation + 1, notice: QuietVault, guide: NoPasswordGuide, backupReady: false }
pure def canLockPasswords(v: PasswordView, by: VaultActor): bool =
  not(isClosedVault(v.vault)) and not(isLockedVault(v.vault))
pure def lockPasswords(v: PasswordView, by: VaultActor): PasswordView =
  { ...v, vault: LockedVault, generation: v.generation + 1, notice: QuietVault }
pure def canReportUnavailable(v: PasswordView, generation: int, by: VaultActor): bool =
  by == PasswordsHost and generation == v.generation and not(isClosedVault(v.vault))
pure def reportUnavailable(v: PasswordView, generation: int, reason: VaultIssue, by: VaultActor): PasswordView =
  { ...v, vault: UnavailableVault({ reason: reason }), notice: QuietVault }
pure def canUnlockPasswords(v: PasswordView, by: VaultActor): bool =
  by == PasswordsPerson and isLockedVault(v.vault)
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
pure def sometimesPasswordsUnlock(v: PasswordView): bool = isOpenVault(v.vault)
pure def sometimesSavedLoginIsSelected(v: PasswordView): bool = selectedLogin(v.vault) == "saved"
pure val exampleLogin: LoginSummary = {
  id: "saved", label: "Example", username: "Pat", revision: 1,
  bindings: List({ kind: "web", facet: "https://utility.example", display: "utility.example" })
}
pure val entriesValues = Set(List(), List(exampleLogin))
pure val reasonValues = Set(NoDeviceLock, UnsupportedVault, LostVaultKey, VaultClosed)
pure val idValues = Set("", "saved", "unknown")
~~~

### Showing, copying and deleting a sign-in use the revision the person chose

If another native action updates the sign-in first, Passwords shows the
current details and asks the person to choose again. Cancel keeps the entry.

~~~quint
pure def mayUseChosenLogin(chosen: LoginSummary, current: LoginSummary): bool =
  chosen.id == current.id and chosen.revision == current.revision
pure def lawChangedLoginNeedsANewChoice(chosen: LoginSummary, current: LoginSummary): bool =
  chosen.revision != current.revision implies not(mayUseChosenLogin(chosen, current))
pure val chosenValues = Set(exampleLogin, { ...exampleLogin, revision: 2 })
pure val currentValues = Set(exampleLogin, { ...exampleLogin, revision: 2 })
~~~

### Grace can describe private sign-in without operating the vault

Help uses fixed instructions to open Passwords, follow Android's unlock
prompt and choose a saved login. The same action can speak these instructions
when voice is available. It receives no vault state, account text or website
form values and has no authority over the editor or browser. Recognized
requests from the current typed draft or a current complete human utterance
work while Cloud reasoning is unavailable. They select only the general Passwords screen or Browser and a cue for the
named control. Guidance never chooses or reveals an entry, copies a
password, opens a private page or presses a website button. An explicit
sign-in command has a separate [browser admission rule](./browserControls.md).

A tap on the microphone starts one local Android recognition request. A
current complete result is used for guidance only. Unmatched speech is
discarded. Leaving Grace, typing, opening a protected surface or cancelling
stops the request. An unavailable local recognizer leaves Type available.
Password guidance recognizes a short list of spoken or typed phrases, such
as “Open Passwords,” “Find a saved password,” “Show my password,”
“Copy my password,” and “Use a saved password.” The person chooses the
saved sign-in and uses the highlighted control.

~~~quint
pure def passwordsHelpText(guide: PasswordGuide): str = "Open Passwords from the second Home page to manage your saved sign-ins. Choose a sign-in to find Show password and Copy password. To fill one, open Private sign-in on a secure website and tap the password field. If Android offers Grace Passwords, unlock your tablet and choose the sign-in you want. Then use the website’s sign-in button."
pure def lawHelpDoesNotReadTheVault(v: PasswordView, other: PasswordView): bool =
  helpForPasswords(v) == helpForPasswords(other)
pure def helpForPasswords(v: PasswordView): str = passwordsHelpText(v.guide)
pure def passwordGuide(words: str): PasswordGuide =
  if (words == "open passwords" or words == "open saved passwords") OpenPasswordGuide
  else if (words == "find a password" or words == "find a saved password" or words == "where are my passwords") FindPasswordGuide
  else if (words == "show my password" or words == "how do i show a password") ShowPasswordGuide
  else if (words == "copy my password" or words == "how do i copy a password") CopyPasswordGuide
  else if (words == "fill my password" or words == "use a saved password" or words == "how do i fill a saved password") FillPasswordGuide
  else NoPasswordGuide
pure def canSetPasswordGuide(v: PasswordView, guide: PasswordGuide, by: VaultActor): bool =
  by == PasswordsHost and guide != v.guide
pure def setPasswordGuide(v: PasswordView, guide: PasswordGuide, by: VaultActor): PasswordView =
  { ...v, guide: guide }
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

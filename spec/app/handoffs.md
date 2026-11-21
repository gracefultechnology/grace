# Handoffs between Files, Email, Calendar and the browser

This registry maps a canonical bill to its one durable [payment](./commitment.md) aggregate. It owns references, not a second copy of payment status. Calendar occurrence IDs, email message IDs, chat IDs and browser tabs are source locations; none changes payment identity. The bill reference identifies the provider's unique obligation or invoice cycle, not merely a recurring merchant relationship.

The shell constructs sources through the projections below from decoded domain state, then authenticates the person's selection separately from planner output. Storage resolves the registry atomically with aggregate creation; a competing creation returns the existing mapping. Selecting a source never sends money. This integrates the previously separate legacy guide and bill stores identified in `MoneyEffect` and `BillAttempt`.

The photo handoff below is a stateless operation over the actual Files and
chosen mailbox states. An accepted result replaces those two states atomically;
a declined result supplies no replacement. It is not another Files or Email store.
Close is the same kind of operation over the device and the app on screen,
and so is opening an email's link over the device, Email and the Browser.

## Story: Open the same bill from any surface

> As a person finding a bill in email or my calendar, I want to return to its existing payment and outcome instead of accidentally starting another attempt.

### Domain projections retain the same provider bill identity

Only a confirmed bill from the selected connected mailbox or a saved bill occurrence is a usable source. The mailbox resolves selection against its current owned message record, so Trash, purge or a stale reference cannot retain source authority. Calendar callers resolve the selected occurrence through the current collection, so a deleted entry or series cannot supply an old cached bill. The calendar must be open and outside its deletion flow; a hidden selection retained for a pending deletion is not an actionable bill. Email text and calendar titles are not destination authority. The browser still verifies origin and account through the preparation model before using personal data.

```quint
import commitment as CM from "./commitment"
import task as T from "./task"
import email as E from "./email"
import files as F from "./files"
import emailItem as I from "./emailItem"
import calendar as C from "./calendar"
import calendarView as V from "./calendarView"
import shell as S from "./shell"
import browser as B from "./browser"
type SourceKind = EmailSource | CalendarSource | BrowserSource
type BillSource = { key: T::Subject, kind: SourceKind, reference: str }
type Binding = { key: T::Subject, recordRef: str }
type SourceLocation = NoLocation
  | MailLocation({ selection: E::BillSelection })
  | CalendarLocation({ owner: str, calendarId: str, occurrenceId: str, generation: int, revision: int })
  | BrowserLocation({ owner: str, tab: int, revision: int })
type NavigationContext = { deviceVersion: int, location: SourceLocation }
type BillOpening = { source: BillSource, context: NavigationContext }
type RegistryActor = RegistryUser | RegistryStore
type Registry = {
  owner: str, bindings: List[Binding], pending: BillOpening,
  waiting: bool, requestVersion: int, selected: str, resolutionError: bool
}
type HandoffEffect = ResolvedBill({ key: T::Subject, recordRef: str, source: BillSource, requestVersion: int, context: NavigationContext })
type HandoffResult = { state: Registry, out: List[HandoffEffect] }
pure val noSource: BillSource = { key: T::emptyKey, kind: BrowserSource, reference: "" }
pure val noContext: NavigationContext = { deviceVersion: -1, location: NoLocation }
pure val noOpening: BillOpening = { source: noSource, context: noContext }
pure val noBinding: Binding = { key: T::emptyKey, recordRef: "" }
pure val initial: Registry = {
  owner: "", bindings: List(), pending: noOpening, waiting: false, requestVersion: 0, selected: "", resolutionError: false
}
pure def emailSource(mail: E::Mailbox): BillSource = {
  key: if (E::billReady(mail)) { kind: T::BillPay, owner: mail.owner, origin: mail.bill.origin, account: mail.bill.account, ref: mail.bill.ref } else T::emptyKey,
  kind: EmailSource, reference: if (E::billReady(mail)) mail.messageRef else ""
}
pure def calendarSource(entry: C::Calendar): BillSource = {
  key: if (C::billAvailable(entry)) { kind: T::BillPay, owner: entry.identity.owner, origin: entry.identity.billOrigin, account: entry.identity.billAccount, ref: entry.identity.billRef } else T::emptyKey,
  kind: CalendarSource, reference: if (C::billAvailable(entry)) entry.identity.occurrenceId else ""
}
pure def currentCalendarSource(calendar: V::CalendarView): BillSource =
  if (calendar.opened and calendar.deletion == V::NoDeletion) calendarSource(V::selectedOccurrence(calendar)) else noSource
pure def usableSource(source: BillSource): bool = T::validKey(source.key) and source.reference != ""
pure def lawAbsentCalendarBillHasNoSource(calendar: V::CalendarView): bool =
  not(C::billAvailable(V::selectedOccurrence(calendar))) implies not(usableSource(currentCalendarSource(calendar)))
pure def lawHiddenCalendarSelectionHasNoSource(calendar: V::CalendarView): bool =
  (not(calendar.opened) or calendar.deletion != V::NoDeletion) implies not(usableSource(currentCalendarSource(calendar)))
pure def lawUnavailableMessageHasNoSource(mail: E::Mailbox): bool =
  not(E::selectedMessageIsCurrent(mail)) implies not(usableSource(emailSource(mail)))
pure def bindingFor(r: Registry, key: T::Subject): Binding =
  r.bindings.foldl(noBinding, (found, row) => if (row.key == key) row else found)
pure def accessibleRecord(r: Registry, key: T::Subject): str =
  if (r.owner != "" and key.owner == r.owner) bindingFor(r, key).recordRef else ""
pure def emailOpening(mail: E::Mailbox, device: S::Shell): BillOpening = {
  source: emailSource(mail),
  context: if (device.readiness == S::Ready and device.surface == S::Email and E::billReady(mail))
    { deviceVersion: device.contextVersion, location: MailLocation({ selection: E::billSelection(mail) }) } else noContext
}
pure def calendarOpening(calendar: V::CalendarView, device: S::Shell): BillOpening = {
  source: currentCalendarSource(calendar),
  context: if (device.readiness == S::Ready and device.surface == S::Calendar and usableSource(currentCalendarSource(calendar)))
    { deviceVersion: device.contextVersion, location: CalendarLocation({ owner: calendar.owner, calendarId: calendar.calendarId,
      occurrenceId: calendar.selectedId, generation: calendar.generation, revision: V::selectedOccurrence(calendar).revision }) } else noContext
}
pure def browserOpening(source: BillSource, browser: B::Browser, device: S::Shell): BillOpening = {
  source: source,
  context: if (device.readiness == S::Ready and device.surface == S::Browser and source.kind == BrowserSource and usableSource(source))
    { deviceVersion: device.contextVersion, location: BrowserLocation({ owner: source.key.owner, tab: browser.selected, revision: browser.revision }) } else noContext
}
pure def validOpening(opening: BillOpening): bool =
  val location = opening.context.location
  usableSource(opening.source) and opening.context.deviceVersion >= 0 and
  (match location {
    | NoLocation => false
    | MailLocation(data) => opening.source.kind == EmailSource and I::validIdentity(data.selection.source) and
        data.selection.generation >= 0 and data.selection.source.owner == opening.source.key.owner and
        data.selection.source.ref == opening.source.reference and data.selection.billRef == opening.source.key.ref and
        data.selection.origin == opening.source.key.origin and data.selection.account == opening.source.key.account
    | CalendarLocation(data) => opening.source.kind == CalendarSource and data.owner == opening.source.key.owner and
        data.calendarId != "" and data.occurrenceId == opening.source.reference and data.generation >= 0 and data.revision >= 0
    | BrowserLocation(data) => opening.source.kind == BrowserSource and data.owner == opening.source.key.owner and
        data.tab >= 0 and data.revision >= 0
  })
pure val sourceValues = Set(
  { key: { kind: T::BillPay, owner: "owner", origin: "https://utility.example", account: "account", ref: "bill" }, kind: EmailSource, reference: "message" },
  { key: { kind: T::BillPay, owner: "owner", origin: "https://utility.example", account: "account", ref: "bill" }, kind: CalendarSource, reference: "calendar-entry" },
  { key: { kind: T::BillPay, owner: "owner", origin: "https://credit.example", account: "account", ref: "other-bill" }, kind: BrowserSource, reference: "page" },
  noSource
)
pure val photoMailbox: E::Mailbox = { ...E::initial, owner: "owner", provider: "mail-provider", account: "mail-account" }
pure val mailValues = Set(E::initial, photoMailbox,
  E::startDraft(photoMailbox, false, E::MailUser),
  E::preserveDraft(E::startDraft(photoMailbox, false, E::MailUser), "photo-draft", E::MailUser),
  { ...E::initial, owner: "owner", provider: "mail-provider", account: "mail-account", connection: E::Connected, canRead: true,
    messages: List(I::loadMessage(I::initial,
      { identity: { owner: "owner", provider: "mail-provider", account: "mail-account", ref: "message" },
        folder: I::InboxFolder, unread: false, answered: false }, I::MessageProvider)),
    view: E::Message, messageRef: "message", messageRefs: Set("message"),
    bill: { ref: "bill", origin: "https://utility.example", account: "account", confirmed: true } })
pure val entryValues = Set(C::initial,
  { ...C::initial, phase: C::Saved, hasSaved: true,
    identity: { owner: "owner", calendarId: "calendar", occurrenceId: "calendar-entry", sourceRef: "message", sourceAccount: 0,
      kind: C::Bill, billRef: "bill", billOrigin: "https://utility.example", billAccount: "account" },
    committed: { ...C::noDetails, title: "Bill", startAt: 1, endAt: 2, timezone: "UTC" } })
pure val openingValues = Set(
  { source: { key: { kind: T::BillPay, owner: "owner", origin: "https://utility.example", account: "account", ref: "bill" }, kind: EmailSource, reference: "message" },
    context: { deviceVersion: 3, location: MailLocation({ selection: { source: { owner: "owner", provider: "mail-provider", account: "mail-account", ref: "message" },
      generation: 0, billRef: "bill", origin: "https://utility.example", account: "account" } }) } },
  { source: { key: { kind: T::BillPay, owner: "owner", origin: "https://utility.example", account: "account", ref: "bill" }, kind: CalendarSource, reference: "calendar-entry" },
    context: { deviceVersion: 3, location: CalendarLocation({ owner: "owner", calendarId: "calendar", occurrenceId: "calendar-entry", generation: 0, revision: 0 }) } },
  { source: { key: { kind: T::BillPay, owner: "owner", origin: "https://credit.example", account: "account", ref: "other-bill" }, kind: BrowserSource, reference: "page" },
    context: { deviceVersion: 3, location: BrowserLocation({ owner: "owner", tab: B::initial.selected, revision: B::initial.revision }) } },
  { source: noSource, context: noContext }
)
pure val liveValues = openingValues
pure val deviceValues = Set(S::initial, { ...S::initial, readiness: S::Ready, surface: S::Email, contextVersion: 3 },
  { ...S::initial, readiness: S::Ready, surface: S::Calendar, contextVersion: 3 },
  { ...S::initial, readiness: S::Ready, surface: S::Browser, contextVersion: 3 },
  { ...S::initial, readiness: S::Ready, surface: S::Files, contextVersion: 3 })
pure val browserValues = Set(B::initial)
pure val resolvedValues = openingValues.map(opening => ResolvedBill({ key: opening.source.key, recordRef: "record-1",
  source: opening.source, requestVersion: 2, context: opening.context }))
pure val afterVisitValues = openingValues.map(opening => { ...opening, context: { ...opening.context, deviceVersion: opening.context.deviceVersion + 1 } })
pure val firstValues = sourceValues
pure val secondValues = sourceValues
pure val ownerValues = Set("owner", "other", "")
pure val recordRefValues = Set("record-1", "record-2", "")
pure val expectedVersionValues = Set(0, 1, 2, 3, 4, 5, 6)
pure val calendarValues = Set(V::initial)
```

### Owner changes cancel pending handoffs but preserve unresolved-payment references

The surrounding application clears the former owner's browser session and personal memory before completing an identity change. Registry evidence is retained for reconciliation, not exposed as the next owner's history. A callback for the previous owner/request is invalidated.

```quint
pure def canChooseOwner(r: Registry, by: RegistryActor): bool = by == RegistryUser
pure def chooseOwner(r: Registry, owner: str, by: RegistryActor): Registry =
  { ...r, owner: owner, pending: noOpening, waiting: false, selected: "", resolutionError: false, requestVersion: r.requestVersion + 1 }
pure def lawOtherOwnerHasNoAccessibleRecord(r: Registry, key: T::Subject): bool =
  key.owner != r.owner implies accessibleRecord(r, key) == ""
```

### Selecting a bill records its source and waits for the canonical durable mapping

Repeated or changed selections replace the pending request, not the payment record. The opening includes the independently derived current source and device context; it stays pending until the canonical mapping resolves and the host commits navigation in that same context. Calendar preview, reminder delivery and mere email receipt do not trigger this event; the person chooses Open bill or asks for help with that selected bill.

```quint
pure def canRequestOpen(r: Registry, opening: BillOpening, by: RegistryActor): bool =
  validOpening(opening) and r.owner != "" and opening.source.key.owner == r.owner and by == RegistryUser
pure def requestOpen(r: Registry, opening: BillOpening, by: RegistryActor): Registry =
  { ...r, pending: opening, waiting: true, selected: "", resolutionError: false, requestVersion: r.requestVersion + 1 }
pure def alwaysPendingBelongsToOwner(r: Registry): bool =
  r.waiting implies validOpening(r.pending) and r.pending.source.key.owner == r.owner and r.owner != ""
pure def alwaysRequestVersion(r: Registry): bool = r.requestVersion >= 0
```

### One provider bill resolves to exactly one payment record across all entry points

If the bill already has a mapping, storage must return that record. A different bill cannot reuse its record reference. Failure to save or resolve records a visible error and leaves the request pending for retry without any payment effect. Retrying the same selection creates a new request revision; failure callbacks for an earlier selection are refused. A stale callback cannot replace the current request. Resolution only produces a candidate for the host navigation boundary below; it cannot itself open a source.

```quint
pure def canResolve(r: Registry, expectedVersion: int, recordRef: str, by: RegistryActor): bool =
  r.waiting and expectedVersion == r.requestVersion and recordRef != "" and by == RegistryStore and
  (bindingFor(r, r.pending.source.key).recordRef == "" or bindingFor(r, r.pending.source.key).recordRef == recordRef) and
  r.bindings.every(row => row.recordRef != recordRef or row.key == r.pending.source.key)
pure def resolve(r: Registry, expectedVersion: int, recordRef: str, by: RegistryActor): HandoffResult = {
  state: {
    ...r, waiting: false, selected: recordRef, resolutionError: false,
    bindings: if (bindingFor(r, r.pending.source.key).recordRef == "") r.bindings.append({ key: r.pending.source.key, recordRef: recordRef }) else r.bindings
  },
  out: List(ResolvedBill({ key: r.pending.source.key, recordRef: recordRef, source: r.pending.source, requestVersion: r.requestVersion, context: r.pending.context }))
}
pure def canResolutionFailed(r: Registry, expectedVersion: int, by: RegistryActor): bool =
  r.waiting and expectedVersion == r.requestVersion and by == RegistryStore
pure def resolutionFailed(r: Registry, expectedVersion: int, by: RegistryActor): Registry = { ...r, resolutionError: true }
pure def alwaysResolutionError(r: Registry): bool = r.resolutionError implies r.waiting
pure def sometimesResolutionFailed(r: Registry): bool = r.resolutionError
pure def alwaysMappingsAreValid(r: Registry): bool =
  r.bindings.every(row => T::validKey(row.key) and row.recordRef != "")
pure def alwaysOneRecordPerBill(r: Registry): bool =
  r.bindings.every(row => r.bindings.select(other => other.key == row.key).length() == 1)
pure def alwaysOneBillPerRecord(r: Registry): bool =
  r.bindings.every(row => r.bindings.select(other => other.recordRef == row.recordRef).length() == 1)
pure def alwaysSelectedBelongsToOwner(r: Registry): bool =
  r.selected == "" or r.bindings.some(row => row.recordRef == r.selected and row.key.owner == r.owner)
pure def stepMappingsAreRetained(before: Registry, after: Registry): bool =
  before.bindings.every(row => after.bindings.includes(row))
pure def stepResolutionCarriesCapturedRequest(before: Registry, after: Registry, out: List[HandoffEffect]): bool =
  out.every(effect => match effect {
    | ResolvedBill(data) => before.waiting and not(after.waiting) and data.recordRef == after.selected and data.recordRef != "" and
        data.key == before.pending.source.key and data.source == before.pending.source and
        data.context == before.pending.context and data.requestVersion == before.requestVersion
  })
pure def lawSameBillHasSameRecord(r: Registry, first: BillSource, second: BillSource): bool =
  first.key == second.key implies accessibleRecord(r, first.key) == accessibleRecord(r, second.key)
pure def sometimesBillResolved(r: Registry): bool = r.selected != ""
pure def sometimesMoreThanOneBill(r: Registry): bool = r.bindings.length() >= 2
pure def sometimesCalendarHandoff(r: Registry): bool = r.selected != "" and r.pending.source.kind == CalendarSource
```

### A resolved bill is presented only in the still-current source context

Discovered by a guarded trace: Calendar Close, Back or deletion and Email Back
or Trash could invalidate the selected bill while an earlier registry lookup
still emitted navigation. A source reference alone also confused two mailboxes
with the same message ID. The request now captures the exact source identity,
source generation and device context together with the person's selection.

The application constructs `opening` from its actual owned states through the
projections above. Storage receives only the bill key and request revision; it
returns the canonical record reference and cannot supply current UI evidence.
`ResolvedBill` is a candidate, not an instruction to navigate. At the eventual
navigation boundary the host independently rebuilds `live` from its actual
states and checks `navigationAllowed`. Neither a stored callback nor website
content may supply that live value or overwrite the captured request context.

The host checks the predicate and commits workspace `visit(Browser)` plus
any destination navigation through the existing browser control synchronously,
without an await or queued page change between them. `visit(Browser)` advances
the device context even when Browser was already selected, consuming this
candidate once. Check the source before this transition hides Calendar or
Email; the consumed receipt cannot authorize a later page change. A Browser
source must contain verified bill identity for the actual current tab, never
identity asserted by arbitrary page text.

This handoff needs no new approval, starts no task by itself, and grants no
personal-data access or payment authorization. Existing task replacement rules
still apply before starting new assisted work.

Existing Close, Back (including Back followed by reselecting the same bill), Trash/deletion, explicit Stop, source/account replacement
and user navigation cancel the pending/resolved navigation intent before leaving
or changing that context. A closed-and-reopened source is a new context, even
if its visible bill is identical. Cancel preserves the canonical mappings and
all independently owned payment evidence. It is not a new product button.

```quint
pure def navigationAllowed(r: Registry, resolved: HandoffEffect, live: BillOpening): bool = match resolved {
  | ResolvedBill(data) => not(r.waiting) and r.selected != "" and data.requestVersion == r.requestVersion and
      data.key == r.pending.source.key and data.recordRef == r.selected and data.source == r.pending.source and
      data.context == r.pending.context and bindingFor(r, data.key).recordRef == data.recordRef and
      validOpening(live) and live.source == data.source and live.context == data.context
}
pure def lawCurrentResolutionCanNavigate(r: Registry, expectedVersion: int, recordRef: str, by: RegistryActor): bool =
  val resolved = resolve(r, expectedVersion, recordRef, by)
  (canResolve(r, expectedVersion, recordRef, by) and validOpening(r.pending)) implies
    (resolved.out.length() == 1 and resolved.out.every(effect => navigationAllowed(resolved.state, effect, r.pending)))
pure def lawDifferentLiveContextCannotNavigate(r: Registry, resolved: HandoffEffect, live: BillOpening): bool = match resolved {
  | ResolvedBill(data) => live.context != data.context implies not(navigationAllowed(r, resolved, live))
}
pure def lawDifferentLiveSourceCannotNavigate(r: Registry, resolved: HandoffEffect, live: BillOpening): bool = match resolved {
  | ResolvedBill(data) => live.source != data.source implies not(navigationAllowed(r, resolved, live))
}
pure def lawConsumedDeviceContextCannotNavigate(r: Registry, resolved: HandoffEffect, live: BillOpening, afterVisit: BillOpening): bool =
  (navigationAllowed(r, resolved, live) and live.context.deviceVersion != afterVisit.context.deviceVersion) implies
    not(navigationAllowed(r, resolved, afterVisit))
pure def lawUnresolvedRequestCannotNavigate(r: Registry, resolved: HandoffEffect, live: BillOpening): bool =
  r.waiting implies not(navigationAllowed(r, resolved, live))
```

### Canceling a handoff does not delete a payment record

```quint
pure def canCancel(r: Registry, by: RegistryActor): bool = (r.waiting or r.selected != "") and by == RegistryUser
pure def cancel(r: Registry, by: RegistryActor): Registry =
  { ...r, waiting: false, pending: noOpening, selected: "", resolutionError: false, requestVersion: r.requestVersion + 1 }
pure def lawCanceledNavigationIsRejected(r: Registry, resolved: HandoffEffect, live: BillOpening, by: RegistryActor): bool =
  canCancel(r, by) implies not(navigationAllowed(cancel(r, by), resolved, live))
```

## Story: Return to the bill and see its actual result

> As a person returning to Calendar or Email after paying, I want the same observed status and receipt, without the calendar inventing a separate paid flag.

### Every source displays only the result of its matching payment aggregate

An unavailable or mismatched aggregate is Unknown, not unpaid, failed or completed. Scheduled and Accepted remain distinct from Completed; a later verified Returned result replaces historical success. Closing the browser or deleting the source entry cannot alter the payment. A positive reference can be retrieved later from the canonical record, even after the originating conversation has ended.

```quint
pure def sourceMatchesCommitment(source: BillSource, commitment: CM::Commitment): bool =
  usableSource(source) and source.key == commitment.key
pure def visibleOutcome(source: BillSource, commitment: CM::Commitment): CM::Outcome =
  if (sourceMatchesCommitment(source, commitment)) commitment.result else CM::Unknown
pure def visibleReceipt(source: BillSource, commitment: CM::Commitment): str =
  if (sourceMatchesCommitment(source, commitment) and CM::positiveOutcome(commitment.result)) commitment.reference else ""
pure def lawAnotherBillHasNoReceipt(source: BillSource, commitment: CM::Commitment): bool =
  source.key != commitment.key implies visibleReceipt(source, commitment) == ""
pure def lawCompletedLabelRequiresCompletedEvidence(source: BillSource, commitment: CM::Commitment): bool =
  visibleOutcome(source, commitment) == CM::Completed implies sourceMatchesCommitment(source, commitment) and commitment.result == CM::Completed
pure val commitmentValues = Set(CM::initial,
  { ...CM::initial, key: CM::exampleKey, proposal: CM::exampleTerms, stage: CM::Resolved, result: CM::Completed, reference: "receipt" },
  { ...CM::initial, key: CM::exampleKey, proposal: CM::exampleTerms, stage: CM::Checking, result: CM::Unknown })
```

## Story: Share the photo I am viewing through my chosen mailbox

> As a person viewing a saved photo, I can choose Share, choose a recipient in
> Email, and review the draft before deciding whether to send it.

### Files closes the preview only when Email accepts that exact photo into a new draft

The selected photo, Files generation, mailbox identity, mailbox generation and
mailbox revision must still match when the person chooses Share. The operation
first checks that Email can create a draft and accept the selected attachment.
Only then does it consume Files' Share result and install the new Email draft.
The subject starts as “A photo”, as in the prototype, and the recipient remains
empty; choosing Share never approves or sends mail.

If another composer is open, save or explicitly discard it through Email's
existing controls, then return to the unchanged photo and choose Share again.
A draft-save or discard request must finish before it can be replaced. A failed
save leaves the recoverable composer intact. An unresolved send must be
reconciled through Email before starting another draft. A disconnected but
already identified mailbox can still create the local draft under Email's
existing rules. Changing either source or destination invalidates the old Share
request; no attachment is silently redirected into a different draft or account.
An accepted handoff preserves every Files and Email state invariant, including
their catalog, message, draft, persistence and send-recovery rules.

```quint
type PhotoShareRequest = {
  id: str, fileGeneration: int, owner: str, provider: str, account: str,
  mailGeneration: int, mailRevision: int
}
type PhotoHandoff = ShareDeclined | SharedPhoto({ files: F::Files, mail: E::Mailbox })
pure def photoDraft(mail: E::Mailbox): E::Mailbox =
  E::editDraft(E::startDraft(mail, false, E::MailUser), { ...E::emptyContent, subject: "A photo" }, E::MailUser)
pure def maySharePhoto(files: F::Files, mail: E::Mailbox, photoRequest: PhotoShareRequest, by: RegistryActor): bool =
  val draft = photoDraft(mail)
  by == RegistryUser and files.owner == mail.owner and photoRequest.owner == mail.owner and
  photoRequest.provider == mail.provider and photoRequest.account == mail.account and
  photoRequest.mailGeneration == mail.generation and photoRequest.mailRevision == mail.revision and
  F::canSharePhoto(files, photoRequest.id, photoRequest.fileGeneration, F::FileUser) and
  E::canStartDraft(mail, false, E::MailUser) and
  E::canEditDraft(E::startDraft(mail, false, E::MailUser), E::MailUser) and
  E::canAttachAsset(draft, files.owner, F::fileAt(files, files.selected), draft.revision, true, E::MailHost)
pure def trySharePhoto(files: F::Files, mail: E::Mailbox, photoRequest: PhotoShareRequest, by: RegistryActor): PhotoHandoff =
  val draft = photoDraft(mail)
  if (maySharePhoto(files, mail, photoRequest, by)) SharedPhoto({
    files: F::sharePhoto(files, photoRequest.id, photoRequest.fileGeneration, F::FileUser).state,
    mail: E::attachAsset(draft, files.owner, F::fileAt(files, files.selected), draft.revision, true, E::MailHost)
  }) else ShareDeclined
pure def lawRejectedShareKeepsBoth(files: F::Files, mail: E::Mailbox, photoRequest: PhotoShareRequest, by: RegistryActor): bool =
  val handoff = trySharePhoto(files, mail, photoRequest, by)
  not(maySharePhoto(files, mail, photoRequest, by)) implies (match handoff {
    | ShareDeclined => true
    | SharedPhoto(_) => false
  })
pure def lawShareUsesTheSelectedPhoto(files: F::Files, mail: E::Mailbox, photoRequest: PhotoShareRequest, by: RegistryActor): bool =
  val handoff = trySharePhoto(files, mail, photoRequest, by)
  maySharePhoto(files, mail, photoRequest, by) implies (match handoff {
    | ShareDeclined => false
    | SharedPhoto(result) => result.files.selected == "" and not(result.files.contentReady) and
        result.mail.draftAttachments == List(F::fileAt(files, files.selected)) and
        result.mail.draft.to == "" and result.mail.draft.subject == "A photo" and
        result.mail.composeVisible and result.mail.sendStatus == E::Composing
  })
pure def lawStaleShareCannotSwitchDestination(files: F::Files, mail: E::Mailbox, photoRequest: PhotoShareRequest, by: RegistryActor): bool =
  (photoRequest.id != files.selected or photoRequest.fileGeneration != files.generation or
    photoRequest.owner != mail.owner or photoRequest.provider != mail.provider or photoRequest.account != mail.account or
    photoRequest.mailGeneration != mail.generation or photoRequest.mailRevision != mail.revision) implies
    not(maySharePhoto(files, mail, photoRequest, by))
pure def lawShareNeverSends(files: F::Files, mail: E::Mailbox, photoRequest: PhotoShareRequest, by: RegistryActor): bool =
  val handoff = trySharePhoto(files, mail, photoRequest, by)
  match handoff {
    | ShareDeclined => true
    | SharedPhoto(result) => result.mail.issuedSends.subseteq(mail.issuedSends) and
        mail.issuedSends.subseteq(result.mail.issuedSends) and result.mail.sendStatus == E::Composing
  }
pure def lawShareKeepsSavedFiles(files: F::Files, mail: E::Mailbox, photoRequest: PhotoShareRequest, by: RegistryActor): bool =
  val handoff = trySharePhoto(files, mail, photoRequest, by)
  match handoff {
    | ShareDeclined => true
    | SharedPhoto(result) => result.files.entries == files.entries
  }
pure def lawSharePreservesOwnedState(files: F::Files, mail: E::Mailbox, photoRequest: PhotoShareRequest, by: RegistryActor): bool =
  val handoff = trySharePhoto(files, mail, photoRequest, by)
  F::validFiles(files) and E::validMailbox(mail) implies (match handoff {
    | ShareDeclined => true
    | SharedPhoto(result) => F::validFiles(result.files) and E::validMailbox(result.mail)
  })
pure val filesValues = Set(F::initial,
  { ...F::initial, owner: "owner", opened: true, loaded: true, entries: List(F::samplePhoto),
    selected: "photo", contentReady: true, generation: 3 })
pure val photoRequestValues = Set(
  { id: "photo", fileGeneration: 3, owner: "owner", provider: "mail-provider", account: "mail-account", mailGeneration: 0, mailRevision: 0 },
  { id: "photo", fileGeneration: 2, owner: "owner", provider: "mail-provider", account: "mail-account", mailGeneration: 0, mailRevision: 0 },
  { id: "photo", fileGeneration: 3, owner: "other", provider: "mail-provider", account: "mail-account", mailGeneration: 0, mailRevision: 0 },
  { id: "photo", fileGeneration: 3, owner: "owner", provider: "mail-provider", account: "mail-account", mailGeneration: 0, mailRevision: 1 })
```

## Story: Open a link from an email in my browser

> As a person reading an email, I can tap a link in it and see that page in
> Grace's Browser, while a link Grace warned me about opens only after I
> confirm it.

### A link Email released opens in a new Browser tab, and no other link does

Email decides when a tapped link may leave the message: a link in an
unflagged message is released at once, and one behind a scam warning only
after the person confirms that same link (`spec/app/email.md`, "A scam
warning needs current evidence and holds that message's links"). The host
then hands that one released link to the Browser while the device is ready
and the message it came from is still the one on screen in Email. Email marks the link opened, the
Browser opens it in a new tab after the others, selected and loading, and the
device shows the Browser. The pages already open stay in their tabs. A held
link, an empty link, a link Email did not release, a different link, a message no longer
on screen, or a message covered by a composer opens nothing and leaves all three as they were. If the browser’s next tab identifier is already in use, the handoff also declines. Opening a link
never sends mail and leaves the messages and the outbox as they were. With a ready device and a fresh browser, a person reading a flagged message can tap its link, confirm the warning and open that link.

```quint
type LinkHandoff = LinkDeclined | OpenedLink({ device: S::Shell, mail: E::Mailbox, browser: B::Browser })
pure def mayOpenEmailLink(device: S::Shell, reader: E::Mailbox, browser: B::Browser, link: str): bool =
  device.surface == S::Email and S::canOpenSurface(device, S::Browser) and
  reader.view == E::Message and not(reader.composeVisible) and reader.link.ref == reader.messageRef and
  E::canLinkOpened(reader, link, E::MailHost) and E::selectedMessageIsCurrent(reader) and
  not(B::hasTab(browser, browser.nextId)) and B::canNavigate(browser, link)
pure def openEmailLink(device: S::Shell, reader: E::Mailbox, browser: B::Browser, link: str): LinkHandoff =
  if (mayOpenEmailLink(device, reader, browser, link)) OpenedLink({
    device: S::openSurface(device, S::Browser),
    mail: E::linkOpened(reader, link, E::MailHost),
    browser: B::navigate(B::openTab(browser), link)
  }) else LinkDeclined
pure def lawOnlyAReleasedLinkOpens(device: S::Shell, reader: E::Mailbox, browser: B::Browser, link: str): bool =
  val handoff = openEmailLink(device, reader, browser, link)
  (reader.link.status != E::LinkReleased or reader.link.link != link or reader.view != E::Message or
    reader.composeVisible or reader.link.ref != reader.messageRef) implies (match handoff {
    | LinkDeclined => true
    | OpenedLink(_) => false
  })
pure def lawAReleasedLinkOpensInANewBrowserTab(device: S::Shell, reader: E::Mailbox, browser: B::Browser, link: str): bool =
  val handoff = openEmailLink(device, reader, browser, link)
  mayOpenEmailLink(device, reader, browser, link) implies (match handoff {
    | LinkDeclined => false
    | OpenedLink(result) => result.device.surface == S::Browser and result.mail.link == E::noLink and
        result.browser.selected == browser.nextId and result.browser.tabs.length() == browser.tabs.length() + 1 and
        browser.tabs.every(t => result.browser.tabs.includes(t)) and
        B::tabUrl(B::activeTab(result.browser)) == link and B::activeTab(result.browser).load == B::Loading
  })
pure def lawOpeningALinkNeverSends(device: S::Shell, reader: E::Mailbox, browser: B::Browser, link: str): bool =
  val handoff = openEmailLink(device, reader, browser, link)
  match handoff {
    | LinkDeclined => true
    | OpenedLink(result) => result.mail.issuedSends.subseteq(reader.issuedSends) and reader.issuedSends.subseteq(result.mail.issuedSends) and
        result.mail.sendStatus == reader.sendStatus and result.mail.messages == reader.messages and result.mail.outbox.length() == reader.outbox.length()
  }
pure val readerMailbox: E::Mailbox = { ...photoMailbox, connection: E::Connected, canRead: true,
  messages: List(I::loadMessage(I::initial,
    { identity: { owner: "owner", provider: "mail-provider", account: "mail-account", ref: "message" },
      folder: I::InboxFolder, unread: false, answered: false }, I::MessageProvider)),
  view: E::Message, messageRef: "message", messageRefs: Set("message") }
pure val flaggedMailbox: E::Mailbox = { ...readerMailbox, warning: { ref: "message", generation: 0, evidence: "classifierScam" } }
pure def lawConfirmingAFlaggedMessageLinkCanReachTheBrowser(link: str): bool =
  val device = { ...S::initial, readiness: S::Ready, surface: S::Email }
  val held = E::openLink(flaggedMailbox, link, E::MailUser)
  val confirmed = E::confirmLink(held, link, true, E::MailUser)
  link != "" implies (
    E::canOpenLink(flaggedMailbox, link, E::MailUser) and
    not(mayOpenEmailLink(device, held, B::initial, link)) and
    E::canConfirmLink(held, link, true, E::MailUser) and
    mayOpenEmailLink(device, confirmed, B::initial, link))
pure val emailLink: str = "https://utility.example/statement"
pure val readerValues = Set(readerMailbox,
  E::openLink(readerMailbox, emailLink, E::MailUser),
  E::openLink(flaggedMailbox, emailLink, E::MailUser),
  E::confirmLink(E::openLink(flaggedMailbox, emailLink, E::MailUser), emailLink, true, E::MailUser),
  { ...E::openLink(readerMailbox, emailLink, E::MailUser), view: E::Inbox },
  { ...E::openLink(readerMailbox, emailLink, E::MailUser), view: E::Attachment },
  { ...E::openLink(readerMailbox, emailLink, E::MailUser), composeVisible: true })
pure val linkValues = Set(emailLink, "https://elsewhere.example", "")
```

## Story: Close an app without losing what I was doing

> As a person in Calendar, Email or Files, I can tap Close and go Home knowing
> that an unfinished form or message is kept or safely put away, and that
> closing never sends, saves or deletes anything on my behalf.

### Close lets the visible app put its own state away before going Home

The prototype's Close (`prototype/Grace Prototype.html`, line 2156) saves a
composer that has something in it as a draft, clears the Files preview and the
Calendar detail and form, and goes Home in one step. Here the app on screen
puts its state away first, through its own operation, and only then does the
device open Home. Close is allowed only when the app is on screen and the
device can open Home. The host commits it as the workspace's `visit(Home)`,
whose own rule pauses assistance without deleting mail or calendar state. If
the app's own operation is not allowed, Close does nothing.

Calendar Close uses Calendar's `closeCalendar`, which cancels an unsubmitted
form. Submitted save and deletion targets remain owned while hidden until
acknowledged; ordinary detail selection clears. Close does not fabricate a
saved occurrence. Files Close uses `closeFiles`, which clears the preview and
cancels reads while keeping the tab and the saved library.

Email Close uses `preserveDraft` for an editable composer that holds anything:
a recipient, subject, text or attachment, or an earlier save. The host supplies
the draft's ID. An editable composer that holds nothing is put away with
`discardDraft` and nothing is stored, as the prototype drops an empty composer.
A save may finish after the composer hides, but failure reopens that same
recoverable editor and the host brings the failed save to the person's
attention. Pending or uncertain sends remain in their original mailbox for
reconciliation. Discarding a draft with something in it stays the person's
explicit Discard in Email.

Closing the window is never an implicit Send, save success, discard of a draft
with content, or payment outcome. Close keeps the composer's content and never
retires a draft.

```quint
type AppClose = CloseDeclined | ClosedApp({ device: S::Shell, calendar: V::CalendarView, mail: E::Mailbox, files: F::Files })
pure def emptyComposer(mailbox: E::Mailbox): bool =
  mailbox.draftId == "" and mailbox.draft.to == "" and mailbox.draft.cc.size() == 0 and mailbox.draft.bcc.size() == 0 and
  mailbox.draft.subject == "" and mailbox.draft.body == "" and mailbox.draftAttachments == List()
pure def mayCloseMailbox(mailbox: E::Mailbox, draftId: str): bool =
  not(E::canEditDraft(mailbox, E::MailUser)) or
  (if (emptyComposer(mailbox)) E::canDiscardDraft(mailbox, true, E::MailUser) else E::canPreserveDraft(mailbox, draftId, E::MailUser))
pure def closeMailbox(mailbox: E::Mailbox, draftId: str): E::Mailbox =
  if (not(E::canEditDraft(mailbox, E::MailUser))) mailbox
  else if (emptyComposer(mailbox)) E::discardDraft(mailbox, true, E::MailUser)
  else E::preserveDraft(mailbox, draftId, E::MailUser)
pure def mayCloseApp(device: S::Shell, calendarView: V::CalendarView, mailbox: E::Mailbox, files: F::Files,
    app: S::Surface, draftId: str, by: RegistryActor): bool =
  by == RegistryUser and device.surface == app and S::canOpenSurface(device, S::Home) and
  (if (app == S::Calendar) V::canCloseCalendar(calendarView, V::ViewUser)
    else if (app == S::Files) F::canCloseFiles(files, F::FileUser)
    else if (app == S::Email) mayCloseMailbox(mailbox, draftId)
    else false)
pure def closeApp(device: S::Shell, calendarView: V::CalendarView, mailbox: E::Mailbox, files: F::Files,
    app: S::Surface, draftId: str, by: RegistryActor): AppClose =
  if (mayCloseApp(device, calendarView, mailbox, files, app, draftId, by)) ClosedApp({
    device: S::openSurface(device, S::Home),
    calendar: if (app == S::Calendar) V::closeCalendar(calendarView, V::ViewUser) else calendarView,
    mail: if (app == S::Email) closeMailbox(mailbox, draftId) else mailbox,
    files: if (app == S::Files) F::closeFiles(files, F::FileUser) else files
  }) else CloseDeclined
pure def lawCloseGoesHomeOnlyAfterTheAppCloses(device: S::Shell, calendarView: V::CalendarView, mailbox: E::Mailbox,
    files: F::Files, app: S::Surface, draftId: str, by: RegistryActor): bool =
  val closed = closeApp(device, calendarView, mailbox, files, app, draftId, by)
  match closed {
    | CloseDeclined => true
    | ClosedApp(result) => result.device.surface == S::Home and
        (app == S::Calendar implies not(result.calendar.opened)) and
        (app == S::Files implies not(result.files.opened)) and
        ((app == S::Email and E::canEditDraft(mailbox, E::MailUser)) implies not(result.mail.composeVisible))
  }
pure def lawCloseNeverSendsOrRetiresADraft(device: S::Shell, calendarView: V::CalendarView, mailbox: E::Mailbox,
    files: F::Files, app: S::Surface, draftId: str, by: RegistryActor): bool =
  val closed = closeApp(device, calendarView, mailbox, files, app, draftId, by)
  match closed {
    | CloseDeclined => true
    | ClosedApp(result) => result.mail.issuedSends.subseteq(mailbox.issuedSends) and
        mailbox.issuedSends.subseteq(result.mail.issuedSends) and result.mail.retiredDrafts == mailbox.retiredDrafts and
        (result.mail.sendStatus == E::Sending implies mailbox.sendStatus == E::Sending)
  }
pure def lawCloseKeepsTheComposerContent(device: S::Shell, calendarView: V::CalendarView, mailbox: E::Mailbox,
    files: F::Files, app: S::Surface, draftId: str, by: RegistryActor): bool =
  val closed = closeApp(device, calendarView, mailbox, files, app, draftId, by)
  match closed {
    | CloseDeclined => true
    | ClosedApp(result) => result.mail.draft.to == mailbox.draft.to and result.mail.draft.subject == mailbox.draft.subject and
        result.mail.draft.body == mailbox.draft.body and result.mail.draftAttachments == mailbox.draftAttachments and
        result.mail.draft.cc.subseteq(mailbox.draft.cc) and mailbox.draft.cc.subseteq(result.mail.draft.cc) and
        result.mail.draft.bcc.subseteq(mailbox.draft.bcc) and mailbox.draft.bcc.subseteq(result.mail.draft.bcc) and
        ((app == S::Email and E::canEditDraft(mailbox, E::MailUser) and not(emptyComposer(mailbox))) implies
          result.mail.draftStorage == E::DraftSaving)
  }
pure val calendarViewValues = Set(V::initial, { ...V::initial, owner: "owner", calendarId: "calendar", opened: true })
pure val mailboxValues = Set(photoMailbox,
  E::startDraft(photoMailbox, false, E::MailUser),
  E::editDraft(E::startDraft(photoMailbox, false, E::MailUser), { ...E::emptyContent, body: "See you Tuesday" }, E::MailUser),
  E::preserveDraft(E::startDraft(photoMailbox, false, E::MailUser), "photo-draft", E::MailUser))
pure val draftIdValues = Set("photo-draft", "")
```

# Handoffs between Files, Email, Calendar and the browser

This registry maps the subject of a task to its one durable [commitment](./commitment.md). A bill to pay is the first kind of task and a visit to book the next; the registry treats every kind alike. It owns references, not a second copy of the commitment's status. Calendar occurrence IDs, email message IDs, saved file IDs, conversation turns and browser tabs are source locations; none changes the subject. The subject's reference identifies the provider's unique obligation, such as one invoice cycle of a bill or one requested visit, not merely a recurring relationship with the provider.

The shell constructs sources through the projections below from decoded domain state, then authenticates the person's selection separately from planner output. Storage resolves the registry atomically with aggregate creation; a competing creation returns the existing mapping. Selecting a source never submits anything: it neither pays a bill nor books a visit. This integrates the previously separate legacy guide and bill stores identified in `MoneyEffect` and `BillAttempt`.

The photo handoff below is a stateless operation over the actual Files and
chosen mailbox states. An accepted result replaces those two states atomically;
a declined result supplies no replacement. It is not another Files or Email store.
Close is the same kind of operation over the device and the app on screen,
and so is opening an email's link over the device, Email and the Browser.

## Story: Open the same task from any surface

> As a person finding a task in email, my calendar, my files or my conversation with Grace, such as a bill to pay or a visit to book, I want to return to its existing commitment and outcome instead of accidentally starting another attempt.

### Domain projections retain the same task subject

Only a confirmed bill from the selected connected mailbox or a saved bill occurrence is a usable source from Email or Calendar. The mailbox resolves selection against its current owned message record, so Trash, purge or a stale reference cannot retain source authority. Calendar callers resolve the selected occurrence through the current collection, so a deleted entry or series cannot supply an old cached bill. The calendar must be open and outside its deletion flow; a hidden selection retained for a pending deletion is not an actionable bill. Email text and calendar titles are not destination authority. The browser still verifies origin and account through the preparation model before using personal data. A Browser tab, the saved file open in Files, or a request the person made to Grace in the conversation is a source only with a subject the host verified for that tab, file or request; page text, file names, document text and spoken words are not subject authority. A Files source stays tied to the file on screen and the library generation it was opened in, and a conversation source to the turn that asked.

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
type SourceKind = EmailSource | CalendarSource | BrowserSource | FilesSource | ConversationSource
type TaskSource = { key: T::Subject, kind: SourceKind, reference: str }
type Binding = { key: T::Subject, recordRef: str }
type SourceLocation = NoLocation
  | MailLocation({ selection: E::BillSelection })
  | CalendarLocation({ owner: str, calendarId: str, occurrenceId: str, generation: int, revision: int })
  | BrowserLocation({ owner: str, tab: int, revision: int })
  | FilesLocation({ owner: str, fileId: str, generation: int })
  | ConversationLocation({ owner: str, turn: str })
type NavigationContext = { deviceVersion: int, location: SourceLocation }
type TaskOpening = { source: TaskSource, context: NavigationContext }
type RegistryActor = RegistryUser | RegistryStore
type Registry = {
  owner: str, bindings: List[Binding], pending: TaskOpening,
  waiting: bool, requestVersion: int, selected: str, resolutionError: bool
}
type HandoffEffect = ResolvedTask({ key: T::Subject, recordRef: str, source: TaskSource, requestVersion: int, context: NavigationContext })
type HandoffResult = { state: Registry, out: List[HandoffEffect] }
pure val noSource: TaskSource = { key: T::emptyKey, kind: BrowserSource, reference: "" }
pure val noContext: NavigationContext = { deviceVersion: -1, location: NoLocation }
pure val noOpening: TaskOpening = { source: noSource, context: noContext }
pure val noBinding: Binding = { key: T::emptyKey, recordRef: "" }
pure val initial: Registry = {
  owner: "", bindings: List(), pending: noOpening, waiting: false, requestVersion: 0, selected: "", resolutionError: false
}
pure def emailSource(mail: E::Mailbox): TaskSource = {
  key: if (E::billReady(mail)) { kind: T::BillPay, owner: mail.owner, origin: mail.bill.origin, account: mail.bill.account, ref: mail.bill.ref } else T::emptyKey,
  kind: EmailSource, reference: if (E::billReady(mail)) mail.bill.sourceRef else ""
}
pure def calendarSource(entry: C::Calendar): TaskSource = {
  key: if (C::billAvailable(entry)) { kind: T::BillPay, owner: entry.identity.owner, origin: entry.identity.billOrigin, account: entry.identity.billAccount, ref: entry.identity.billRef } else T::emptyKey,
  kind: CalendarSource, reference: if (C::billAvailable(entry)) entry.identity.occurrenceId else ""
}
pure def currentCalendarSource(calendar: V::CalendarView): TaskSource =
  if (calendar.opened and calendar.deletion == V::NoDeletion) calendarSource(V::selectedOccurrence(calendar)) else noSource
pure def usableSource(source: TaskSource): bool = T::validKey(source.key) and source.reference != ""
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
pure def emailOpening(mail: E::Mailbox, device: S::Shell): TaskOpening = {
  source: emailSource(mail),
  context: if (device.readiness == S::Ready and device.surface == S::Email and E::billReady(mail))
    { deviceVersion: device.contextVersion, location: MailLocation({ selection: E::billSelection(mail) }) } else noContext
}
pure def calendarOpening(calendar: V::CalendarView, device: S::Shell): TaskOpening = {
  source: currentCalendarSource(calendar),
  context: if (device.readiness == S::Ready and device.surface == S::Calendar and usableSource(currentCalendarSource(calendar)))
    { deviceVersion: device.contextVersion, location: CalendarLocation({ owner: calendar.owner, calendarId: calendar.calendarId,
      occurrenceId: calendar.selectedId, generation: calendar.generation, revision: V::selectedOccurrence(calendar).revision }) } else noContext
}
pure def browserOpening(source: TaskSource, browser: B::Browser, device: S::Shell): TaskOpening = {
  source: source,
  context: if (device.readiness == S::Ready and device.surface == S::Browser and source.kind == BrowserSource and usableSource(source))
    { deviceVersion: device.contextVersion, location: BrowserLocation({ owner: source.key.owner, tab: browser.selected, revision: browser.revision }) } else noContext
}
pure def filesOpening(source: TaskSource, files: F::Files, device: S::Shell): TaskOpening = {
  source: source,
  context: if (device.readiness == S::Ready and device.surface == S::Files and source.kind == FilesSource and usableSource(source) and
      files.opened and files.owner == source.key.owner and files.selected == source.reference)
    { deviceVersion: device.contextVersion, location: FilesLocation({ owner: files.owner, fileId: files.selected, generation: files.generation }) } else noContext
}
pure def conversationOpening(source: TaskSource, device: S::Shell): TaskOpening = {
  source: source,
  context: if (device.readiness == S::Ready and source.kind == ConversationSource and usableSource(source))
    { deviceVersion: device.contextVersion, location: ConversationLocation({ owner: source.key.owner, turn: source.reference }) } else noContext
}
pure def validOpening(opening: TaskOpening): bool =
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
    | FilesLocation(data) => opening.source.kind == FilesSource and data.owner == opening.source.key.owner and
        data.fileId == opening.source.reference and data.generation >= 0
    | ConversationLocation(data) => opening.source.kind == ConversationSource and data.owner == opening.source.key.owner and
        data.turn == opening.source.reference
  })
pure def lawFilesSourceIsTheFileOnScreen(source: TaskSource, files: F::Files, device: S::Shell): bool =
  validOpening(filesOpening(source, files, device)) implies
    (device.surface == S::Files and files.opened and files.selected == source.reference and files.owner == source.key.owner)
pure val sourceValues = Set(
  { key: { kind: T::BillPay, owner: "owner", origin: "https://utility.example", account: "account", ref: "bill" }, kind: EmailSource, reference: "message" },
  { key: { kind: T::BillPay, owner: "owner", origin: "https://utility.example", account: "account", ref: "bill" }, kind: CalendarSource, reference: "calendar-entry" },
  { key: { kind: T::BillPay, owner: "owner", origin: "https://credit.example", account: "account", ref: "other-bill" }, kind: BrowserSource, reference: "page" },
  { key: { kind: T::BillPay, owner: "owner", origin: "https://utility.example", account: "account", ref: "bill" }, kind: FilesSource, reference: "photo" },
  { key: CM::bookingKey, kind: ConversationSource, reference: "turn" },
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
    bill: { ref: "bill", sourceRef: "message", origin: "https://utility.example", account: "account", confirmed: true } })
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
  { source: { key: { kind: T::BillPay, owner: "owner", origin: "https://utility.example", account: "account", ref: "bill" }, kind: FilesSource, reference: "photo" },
    context: { deviceVersion: 3, location: FilesLocation({ owner: "owner", fileId: "photo", generation: 3 }) } },
  { source: { key: CM::bookingKey, kind: ConversationSource, reference: "turn" },
    context: { deviceVersion: 3, location: ConversationLocation({ owner: "owner", turn: "turn" }) } },
  { source: noSource, context: noContext }
)
pure val liveValues = openingValues
pure val deviceValues = Set(S::initial, { ...S::initial, readiness: S::Ready, surface: S::Email, contextVersion: 3 },
  { ...S::initial, readiness: S::Ready, surface: S::Calendar, contextVersion: 3 },
  { ...S::initial, readiness: S::Ready, surface: S::Browser, contextVersion: 3 },
  { ...S::initial, readiness: S::Ready, surface: S::Files, contextVersion: 3 },
  { ...S::initial, readiness: S::Ready, surface: S::Home, contextVersion: 3 })
pure val browserValues = Set(B::initial)
pure val resolvedValues = openingValues.map(opening => ResolvedTask({ key: opening.source.key, recordRef: "record-1",
  source: opening.source, requestVersion: 2, context: opening.context }))
pure val afterVisitValues = openingValues.map(opening => { ...opening, context: { ...opening.context, deviceVersion: opening.context.deviceVersion + 1 } })
pure val firstValues = sourceValues
pure val secondValues = sourceValues
pure val ownerValues = Set("owner", "other", "")
pure val recordRefValues = Set("record-1", "record-2", "")
pure val expectedVersionValues = Set(0, 1, 2, 3, 4, 5, 6)
pure val calendarValues = Set(V::initial)
```

### Owner changes cancel pending handoffs but preserve references to unresolved commitments

The surrounding application clears the former owner's browser session and personal memory before completing an identity change. Registry evidence is retained for reconciliation, not exposed as the next owner's history. A callback for the previous owner/request is invalidated.

```quint
pure def canChooseOwner(r: Registry, by: RegistryActor): bool = by == RegistryUser
pure def chooseOwner(r: Registry, owner: str, by: RegistryActor): Registry =
  { ...r, owner: owner, pending: noOpening, waiting: false, selected: "", resolutionError: false, requestVersion: r.requestVersion + 1 }
pure def lawOtherOwnerHasNoAccessibleRecord(r: Registry, key: T::Subject): bool =
  key.owner != r.owner implies accessibleRecord(r, key) == ""
```

### Selecting a task records its source and waits for the canonical durable mapping

Repeated or changed selections replace the pending request, not the commitment record. The opening includes the independently derived current source and device context; it stays pending until the canonical mapping resolves and the host commits navigation in that same context. Calendar preview, reminder delivery and mere email receipt do not trigger this event; the person chooses to open that task, such as Open bill, or asks for help with it.

```quint
pure def canRequestOpen(r: Registry, opening: TaskOpening, by: RegistryActor): bool =
  validOpening(opening) and r.owner != "" and opening.source.key.owner == r.owner and by == RegistryUser
pure def requestOpen(r: Registry, opening: TaskOpening, by: RegistryActor): Registry =
  { ...r, pending: opening, waiting: true, selected: "", resolutionError: false, requestVersion: r.requestVersion + 1 }
pure def alwaysPendingBelongsToOwner(r: Registry): bool =
  r.waiting implies validOpening(r.pending) and r.pending.source.key.owner == r.owner and r.owner != ""
pure def alwaysRequestVersion(r: Registry): bool = r.requestVersion >= 0
```

### One task subject resolves to exactly one commitment record across all entry points

If the subject already has a mapping, storage must return that record. A different subject cannot reuse its record reference. A visit to book resolves exactly as a bill does. Failure to save or resolve records a visible error and leaves the request pending for retry without any payment or booking effect. Retrying the same selection creates a new request revision; failure callbacks for an earlier selection are refused. A stale callback cannot replace the current request. Resolution only produces a candidate for the host navigation boundary below; it cannot itself open a source.

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
  out: List(ResolvedTask({ key: r.pending.source.key, recordRef: recordRef, source: r.pending.source, requestVersion: r.requestVersion, context: r.pending.context }))
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
    | ResolvedTask(data) => before.waiting and not(after.waiting) and data.recordRef == after.selected and data.recordRef != "" and
        data.key == before.pending.source.key and data.source == before.pending.source and
        data.context == before.pending.context and data.requestVersion == before.requestVersion
  })
pure def lawSameBillHasSameRecord(r: Registry, first: TaskSource, second: TaskSource): bool =
  first.key == second.key implies accessibleRecord(r, first.key) == accessibleRecord(r, second.key)
pure def sometimesBillResolved(r: Registry): bool = r.selected != ""
pure def sometimesMoreThanOneBill(r: Registry): bool = r.bindings.length() >= 2
pure def sometimesBookingResolved(r: Registry): bool = r.selected != "" and r.pending.source.key.kind == T::AppointmentBooking
pure def sometimesCalendarHandoff(r: Registry): bool = r.selected != "" and r.pending.source.kind == CalendarSource
```

### A resolved task is presented only in the still-current source context

Discovered by a guarded trace: Calendar Close, Back or deletion and Email Back
or Trash could invalidate the selected task while an earlier registry lookup
still emitted navigation. A source reference alone also confused two mailboxes
with the same message ID. The request now captures the exact source identity,
source generation and device context together with the person's selection.

The application constructs `opening` from its actual owned states through the
projections above. Storage receives only the subject and request revision; it
returns the canonical record reference and cannot supply current UI evidence.
`ResolvedTask` is a candidate, not an instruction to navigate. At the eventual
navigation boundary the host independently rebuilds `live` from its actual
states and checks `navigationAllowed`. Neither a stored callback nor website
content may supply that live value or overwrite the captured request context.

The host checks the predicate and commits workspace `visit(Browser)` plus
any destination navigation through the existing browser control synchronously,
without an await or queued page change between them. `visit(Browser)` advances
the device context even when Browser was already selected, consuming this
candidate once. Check the source before this transition hides Calendar or
Email; the consumed receipt cannot authorize a later page change. A Browser
source must contain a verified subject for the actual current tab, never
identity asserted by arbitrary page text.

This handoff needs no new approval, starts no task by itself, and grants no
personal-data access or authorization to pay or book. Existing task replacement rules
still apply before starting new assisted work.

Existing Close, Back (including Back followed by reselecting the same task), Trash/deletion, explicit Stop, source/account replacement
and user navigation cancel the pending/resolved navigation intent before leaving
or changing that context. A closed-and-reopened source is a new context, even
if its visible task is identical. Cancel preserves the canonical mappings and
all independently owned commitment evidence. It is not a new product button.

```quint
pure def navigationAllowed(r: Registry, resolved: HandoffEffect, live: TaskOpening): bool = match resolved {
  | ResolvedTask(data) => not(r.waiting) and r.selected != "" and data.requestVersion == r.requestVersion and
      data.key == r.pending.source.key and data.recordRef == r.selected and data.source == r.pending.source and
      data.context == r.pending.context and bindingFor(r, data.key).recordRef == data.recordRef and
      validOpening(live) and live.source == data.source and live.context == data.context
}
pure def lawCurrentResolutionCanNavigate(r: Registry, expectedVersion: int, recordRef: str, by: RegistryActor): bool =
  val resolved = resolve(r, expectedVersion, recordRef, by)
  (canResolve(r, expectedVersion, recordRef, by) and validOpening(r.pending)) implies
    (resolved.out.length() == 1 and resolved.out.every(effect => navigationAllowed(resolved.state, effect, r.pending)))
pure def lawDifferentLiveContextCannotNavigate(r: Registry, resolved: HandoffEffect, live: TaskOpening): bool = match resolved {
  | ResolvedTask(data) => live.context != data.context implies not(navigationAllowed(r, resolved, live))
}
pure def lawDifferentLiveSourceCannotNavigate(r: Registry, resolved: HandoffEffect, live: TaskOpening): bool = match resolved {
  | ResolvedTask(data) => live.source != data.source implies not(navigationAllowed(r, resolved, live))
}
pure def lawConsumedDeviceContextCannotNavigate(r: Registry, resolved: HandoffEffect, live: TaskOpening, afterVisit: TaskOpening): bool =
  (navigationAllowed(r, resolved, live) and live.context.deviceVersion != afterVisit.context.deviceVersion) implies
    not(navigationAllowed(r, resolved, afterVisit))
pure def lawUnresolvedRequestCannotNavigate(r: Registry, resolved: HandoffEffect, live: TaskOpening): bool =
  r.waiting implies not(navigationAllowed(r, resolved, live))
```

### Canceling a handoff does not delete a commitment record

```quint
pure def canCancel(r: Registry, by: RegistryActor): bool = (r.waiting or r.selected != "") and by == RegistryUser
pure def cancel(r: Registry, by: RegistryActor): Registry =
  { ...r, waiting: false, pending: noOpening, selected: "", resolutionError: false, requestVersion: r.requestVersion + 1 }
pure def lawCanceledNavigationIsRejected(r: Registry, resolved: HandoffEffect, live: TaskOpening, by: RegistryActor): bool =
  canCancel(r, by) implies not(navigationAllowed(cancel(r, by), resolved, live))
```

## Story: Return to the task and see its actual result

> As a person returning to Calendar or Email after paying a bill or booking a visit, I want the same observed status and receipt, without the calendar inventing a separate paid or booked flag.

### Every source displays only the result of its matching commitment

An unavailable or mismatched aggregate is Unknown, not unpaid, failed or completed. Scheduled and Accepted remain distinct from Completed; a later verified Returned result replaces historical success. Closing the browser or deleting the source entry cannot alter the commitment. A positive reference can be retrieved later from the canonical record, even after the originating conversation has ended.

```quint
pure def sourceMatchesCommitment(source: TaskSource, commitment: CM::Commitment): bool =
  usableSource(source) and source.key == commitment.key
pure def visibleOutcome(source: TaskSource, commitment: CM::Commitment): CM::Outcome =
  if (sourceMatchesCommitment(source, commitment)) commitment.result else CM::Unknown
pure def visibleReceipt(source: TaskSource, commitment: CM::Commitment): str =
  if (sourceMatchesCommitment(source, commitment) and CM::positiveOutcome(commitment.result)) commitment.reference else ""
pure def lawAnotherBillHasNoReceipt(source: TaskSource, commitment: CM::Commitment): bool =
  source.key != commitment.key implies visibleReceipt(source, commitment) == ""
pure def lawCompletedLabelRequiresCompletedEvidence(source: TaskSource, commitment: CM::Commitment): bool =
  visibleOutcome(source, commitment) == CM::Completed implies sourceMatchesCommitment(source, commitment) and commitment.result == CM::Completed
pure val commitmentValues = Set(CM::initial,
  { ...CM::initial, key: CM::exampleKey, proposal: CM::exampleTerms, stage: CM::Resolved, result: CM::Completed, reference: "receipt" },
  { ...CM::initial, key: CM::exampleKey, proposal: CM::exampleTerms, stage: CM::Checking, result: CM::Unknown },
  { ...CM::initial, key: CM::bookingKey, proposal: CM::bookingTerms, stage: CM::Resolved, result: CM::Scheduled, reference: "confirmation" })
```

### Every entry point of one subject reaches the one commitment kept for it, and no other subject shares its record

The registry and the commitments agree on one record per subject. Two
usable sources of the same subject, such as a bill's email and its calendar
entry, or a booking request in the conversation and the clinic's page, find
the same record and show the same outcome and receipt from the one commitment
kept for that subject. A subject with a record never shares it with another
subject, whatever kind either is.

```quint
pure def commitmentFor(commitments: List[CM::Commitment], key: T::Subject): CM::Commitment =
  commitments.foldl(CM::initial, (found, c) => if (c.key == key) c else found)
pure def lawOneRecordPerSubject(r: Registry, first: TaskSource, second: TaskSource, commitments: List[CM::Commitment]): bool =
  val firstRecord = accessibleRecord(r, first.key)
  val secondRecord = accessibleRecord(r, second.key)
  (alwaysMappingsAreValid(r) and alwaysOneBillPerRecord(r) and usableSource(first) and usableSource(second)) implies
    ((first.key == second.key implies (firstRecord == secondRecord and
      visibleOutcome(first, commitmentFor(commitments, first.key)) == visibleOutcome(second, commitmentFor(commitments, second.key)) and
      visibleReceipt(first, commitmentFor(commitments, first.key)) == visibleReceipt(second, commitmentFor(commitments, second.key)))) and
    ((first.key != second.key and firstRecord != "") implies firstRecord != secondRecord))
pure val commitmentsValues = Set(List(),
  List({ ...CM::initial, key: CM::exampleKey, proposal: CM::exampleTerms, stage: CM::Resolved, result: CM::Completed, reference: "receipt" },
    { ...CM::initial, key: CM::bookingKey, proposal: CM::bookingTerms, stage: CM::Resolved, result: CM::Scheduled, reference: "confirmation" }))
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
type EmailDestination = { device: S::Shell, browser: B::Browser }
pure def mayShowEmailDestination(device: S::Shell, browser: B::Browser, link: str): bool =
  device.surface == S::Email and S::canOpenSurface(device, S::Browser) and
  not(B::hasTab(browser, browser.nextId)) and B::canNavigate(browser, link)
pure def showEmailDestination(device: S::Shell, browser: B::Browser, link: str): EmailDestination = {
  device: S::openSurface(device, S::Browser), browser: B::navigate(B::openTab(browser), link)
}
pure def mayOpenEmailLink(device: S::Shell, reader: E::Mailbox, browser: B::Browser, link: str): bool =
  mayShowEmailDestination(device, browser, link) and
  reader.view == E::Message and not(reader.composeVisible) and reader.link.ref == reader.messageRef and
  E::canLinkOpened(reader, link, E::MailHost) and E::selectedMessageIsCurrent(reader)
pure def openEmailLink(device: S::Shell, reader: E::Mailbox, browser: B::Browser, link: str): LinkHandoff =
  val target = showEmailDestination(device, browser, link)
  if (mayOpenEmailLink(device, reader, browser, link))
    OpenedLink({ device: target.device, mail: E::linkOpened(reader, link, E::MailHost), browser: target.browser })
  else LinkDeclined
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

## Story: Open an event from Home

> As a person looking at an event on Home, I can tap it and see that same
> event in Calendar, or nothing changes if it is no longer there.

### A Home event row opens its own occurrence in Calendar, and a stale row opens nothing

A Home event row names the calendar's owner, the calendar, the occurrence, its
revision and the calendar generation it was drawn from. Tapping it while the
device is ready and on Home opens Calendar with that occurrence selected,
through Calendar's own `openCalendar` and `openOccurrence`, and the device shows
Calendar. A row for another owner or calendar, from an older generation, for an
occurrence that is gone, unsaved or at another revision, or one tapped while
Calendar has a form open or a deletion under way opens nothing and leaves the
device and Calendar as they were. Opening an event keeps every event and series;
like Calendar's own open, it only marks a change made elsewhere as seen.

```quint
type EventRow = { owner: str, calendarId: str, occurrenceId: str, revision: int, generation: int }
type EventHandoff = EventDeclined | OpenedEvent({ device: S::Shell, calendar: V::CalendarView })
pure def shownCalendar(calendarView: V::CalendarView): V::CalendarView =
  V::openCalendar(calendarView, calendarView.owner, calendarView.calendarId, calendarView.timezone, V::ViewUser)
pure def mayOpenHomeEvent(device: S::Shell, calendarView: V::CalendarView, eventRow: EventRow, by: RegistryActor): bool =
  by == RegistryUser and device.surface == S::Home and S::canOpenSurface(device, S::Calendar) and
  eventRow.owner == calendarView.owner and eventRow.calendarId == calendarView.calendarId and
  eventRow.generation == calendarView.generation and calendarView.deletion == V::NoDeletion and
  V::canOpenCalendar(calendarView, calendarView.owner, calendarView.calendarId, calendarView.timezone, V::ViewUser) and
  V::entryAt(calendarView, eventRow.occurrenceId).revision == eventRow.revision and
  V::canOpenOccurrence(shownCalendar(calendarView), eventRow.occurrenceId, V::ViewUser)
pure def openHomeEvent(device: S::Shell, calendarView: V::CalendarView, eventRow: EventRow, by: RegistryActor): EventHandoff =
  if (mayOpenHomeEvent(device, calendarView, eventRow, by)) OpenedEvent({
    device: S::openSurface(device, S::Calendar),
    calendar: V::openOccurrence(shownCalendar(calendarView), eventRow.occurrenceId, V::ViewUser)
  }) else EventDeclined
pure def lawHomeRowOpensItsOwnOccurrence(device: S::Shell, calendarView: V::CalendarView, eventRow: EventRow, by: RegistryActor): bool =
  val handoff = openHomeEvent(device, calendarView, eventRow, by)
  mayOpenHomeEvent(device, calendarView, eventRow, by) implies (match handoff {
    | EventDeclined => false
    | OpenedEvent(result) => result.device.surface == S::Calendar and result.calendar.opened and
        result.calendar.selectedId == eventRow.occurrenceId and result.calendar.owner == eventRow.owner and
        result.calendar.calendarId == eventRow.calendarId and result.calendar.generation == eventRow.generation
  })
pure def lawStaleHomeRowOpensNothing(device: S::Shell, calendarView: V::CalendarView, eventRow: EventRow, by: RegistryActor): bool =
  val handoff = openHomeEvent(device, calendarView, eventRow, by)
  (eventRow.owner != calendarView.owner or eventRow.calendarId != calendarView.calendarId or
    eventRow.generation != calendarView.generation or
    V::entryAt(calendarView, eventRow.occurrenceId).revision != eventRow.revision or
    not(V::entryAt(calendarView, eventRow.occurrenceId).hasSaved)) implies (match handoff {
    | EventDeclined => true
    | OpenedEvent(_) => false
  })
pure def lawOpeningAnEventKeepsTheEvents(device: S::Shell, calendarView: V::CalendarView, eventRow: EventRow, by: RegistryActor): bool =
  val handoff = openHomeEvent(device, calendarView, eventRow, by)
  match handoff {
    | EventDeclined => true
    | OpenedEvent(result) => result.calendar.entries.length() == calendarView.entries.length() and
        result.calendar.series == calendarView.series and result.calendar.deletedSeries == calendarView.deletedSeries
  }
pure val savedEventView: V::CalendarView = { ...V::initial, owner: "owner", calendarId: "calendar", timezone: "UTC",
  entries: List({ ...C::initial, phase: C::Saved, hasSaved: true,
    identity: { ...C::noIdentity, owner: "owner", calendarId: "calendar", occurrenceId: "calendar-entry" },
    committed: { ...C::noDetails, title: "Visit", startAt: 1, endAt: 2, timezone: "UTC" } }) }
pure val eventRowValues = Set(
  { owner: "owner", calendarId: "calendar", occurrenceId: "calendar-entry", revision: 0, generation: 0 },
  { owner: "owner", calendarId: "calendar", occurrenceId: "calendar-entry", revision: 1, generation: 0 },
  { owner: "owner", calendarId: "calendar", occurrenceId: "calendar-entry", revision: 0, generation: 1 },
  { owner: "other", calendarId: "calendar", occurrenceId: "calendar-entry", revision: 0, generation: 0 },
  { owner: "owner", calendarId: "calendar", occurrenceId: "missing", revision: 0, generation: 0 })
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

Email Close follows Email’s Back and Close rule. A previously stored draft,
a body, an attachment or a subject the person typed is kept with
`preserveDraft` and the host-supplied draft ID. A new composer with only
recipients or an automatic subject closes through `closeEmptyComposer`.
A save may finish after the composer hides, but failure reopens that same
recoverable editor and the host brings the failed save to the person's
attention. Pending or uncertain sends remain in their original mailbox for
reconciliation. Discarding a draft with something in it stays the person's
explicit Discard in Email.

Closing the window is never an implicit Send, save success, discard of a draft
worth preserving, or payment outcome. Close keeps a preserved composer’s
content and never retires a draft.

```quint
type AppClose = CloseDeclined | ClosedApp({ device: S::Shell, calendar: V::CalendarView, mail: E::Mailbox, files: F::Files })
pure def mayCloseMailbox(mailbox: E::Mailbox, draftId: str): bool =
  not(E::canEditDraft(mailbox, E::MailUser)) or E::canCloseEmptyComposer(mailbox, E::MailUser) or
  E::canPreserveDraft(mailbox, draftId, E::MailUser)
pure def closeMailbox(mailbox: E::Mailbox, draftId: str): E::Mailbox =
  if (not(E::canEditDraft(mailbox, E::MailUser))) mailbox
  else if (E::canCloseEmptyComposer(mailbox, E::MailUser)) E::closeEmptyComposer(mailbox, E::MailUser)
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
  val empty = app == S::Email and E::canCloseEmptyComposer(mailbox, E::MailUser)
  val expected = if (empty) E::closeEmptyComposer(mailbox, E::MailUser) else mailbox
  match closed {
    | CloseDeclined => true
    | ClosedApp(result) =>
        result.mail.draft.to == expected.draft.to and result.mail.draft.subject == expected.draft.subject and
        result.mail.draft.body == expected.draft.body and result.mail.draftAttachments == expected.draftAttachments and
        result.mail.draft.cc.subseteq(expected.draft.cc) and expected.draft.cc.subseteq(result.mail.draft.cc) and
        result.mail.draft.bcc.subseteq(expected.draft.bcc) and expected.draft.bcc.subseteq(result.mail.draft.bcc) and
        (empty implies (result.mail.sendStatus == E::NoDraft and result.mail.draftStorage == E::DraftUnstored)) and
        ((app == S::Email and E::canEditDraft(mailbox, E::MailUser) and not(empty)) implies result.mail.draftStorage == E::DraftSaving)
  }
pure val calendarViewValues = Set(V::initial, { ...V::initial, owner: "owner", calendarId: "calendar", opened: true }, savedEventView)
pure val mailboxValues = Set(photoMailbox,
  E::startDraft(photoMailbox, false, E::MailUser),
  E::editDraft(E::startDraft(photoMailbox, false, E::MailUser), { ...E::emptyContent, body: "See you Tuesday" }, E::MailUser),
  E::preserveDraft(E::startDraft(photoMailbox, false, E::MailUser), "photo-draft", E::MailUser))
pure val draftIdValues = Set("photo-draft", "")
```

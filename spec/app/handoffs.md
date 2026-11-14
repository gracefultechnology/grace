# One bill across Email, Calendar and the browser

This registry maps a canonical bill to its one durable [payment](./payment.md) aggregate. It owns references, not a second copy of payment status. Calendar occurrence IDs, email message IDs, chat IDs and browser tabs are source locations; none changes payment identity. The bill reference identifies the provider's unique obligation or invoice cycle, not merely a recurring merchant relationship.

The shell constructs sources through the projections below from decoded domain state, then authenticates the person's selection separately from planner output. Storage resolves the registry atomically with aggregate creation; a competing creation returns the existing mapping. Selecting a source never sends money. This integrates the previously separate legacy guide and bill stores identified in `MoneyEffect` and `BillAttempt`.

## Story: Open the same bill from any surface

> As a person finding a bill in email or my calendar, I want to return to its existing payment and outcome instead of accidentally starting another attempt.

### Domain projections retain the same provider bill identity

Only a confirmed bill from the selected connected mailbox or a saved bill occurrence is a usable source. The mailbox resolves selection against its current owned message record, so Trash, purge or a stale reference cannot retain source authority. Calendar callers resolve the selected occurrence through the current collection, so a deleted entry or series cannot supply an old cached bill. Email text and calendar titles are not destination authority. The browser still verifies origin and account through the preparation model before using personal data.

```quint
import payment as P from "./payment"
import email as E from "./email"
import files as F from "./files"
import emailItem as I from "./emailItem"
import calendar as C from "./calendar"
import calendarView as V from "./calendarView"
type SourceKind = EmailSource | CalendarSource | BrowserSource
type BillSource = { key: P::BillKey, kind: SourceKind, reference: str }
type Binding = { key: P::BillKey, recordRef: str }
type RegistryActor = RegistryUser | RegistryStore
type Registry = {
  owner: str, bindings: List[Binding], pending: BillSource,
  waiting: bool, requestVersion: int, selected: str, resolutionError: bool
}
type HandoffEffect = OpenBill({ key: P::BillKey, recordRef: str, source: BillSource })
type HandoffResult = { state: Registry, out: List[HandoffEffect] }
pure val noSource: BillSource = { key: P::emptyKey, kind: BrowserSource, reference: "" }
pure val noBinding: Binding = { key: P::emptyKey, recordRef: "" }
pure val initial: Registry = {
  owner: "", bindings: List(), pending: noSource, waiting: false, requestVersion: 0, selected: "", resolutionError: false
}
pure def emailSource(mail: E::Mailbox): BillSource = {
  key: if (E::billReady(mail)) { owner: mail.owner, origin: mail.billOrigin, account: mail.billAccount, bill: mail.billRef } else P::emptyKey,
  kind: EmailSource, reference: if (E::billReady(mail)) mail.messageRef else ""
}
pure def calendarSource(entry: C::Calendar): BillSource = {
  key: if (C::billAvailable(entry)) { owner: entry.identity.owner, origin: entry.identity.billOrigin, account: entry.identity.billAccount, bill: entry.identity.billRef } else P::emptyKey,
  kind: CalendarSource, reference: if (C::billAvailable(entry)) entry.identity.occurrenceId else ""
}
pure def currentCalendarSource(calendar: V::CalendarView): BillSource =
  calendarSource(V::selectedOccurrence(calendar))
pure def usableSource(source: BillSource): bool = P::validKey(source.key) and source.reference != ""
pure def lawAbsentCalendarBillHasNoSource(calendar: V::CalendarView): bool =
  not(C::billAvailable(V::selectedOccurrence(calendar))) implies not(usableSource(currentCalendarSource(calendar)))
pure def lawUnavailableMessageHasNoSource(mail: E::Mailbox): bool =
  not(E::selectedMessageIsCurrent(mail)) implies not(usableSource(emailSource(mail)))
pure def bindingFor(r: Registry, key: P::BillKey): Binding =
  r.bindings.foldl(noBinding, (found, row) => if (row.key == key) row else found)
pure def accessibleRecord(r: Registry, key: P::BillKey): str =
  if (r.owner != "" and key.owner == r.owner) bindingFor(r, key).recordRef else ""
pure val sourceValues = Set(
  { key: { owner: "owner", origin: "https://utility.example", account: "account", bill: "bill" }, kind: EmailSource, reference: "message" },
  { key: { owner: "owner", origin: "https://utility.example", account: "account", bill: "bill" }, kind: CalendarSource, reference: "calendar-entry" },
  { key: { owner: "owner", origin: "https://credit.example", account: "account", bill: "other-bill" }, kind: BrowserSource, reference: "page" },
  noSource
)
pure val mailValues = Set(E::initial,
  { ...E::initial, owner: "owner", provider: "mail-provider", account: "mail-account", connection: E::Connected, canRead: true,
    messages: List(I::loadMessage(I::initial,
      { identity: { owner: "owner", provider: "mail-provider", account: "mail-account", ref: "message" },
        folder: I::InboxFolder, unread: false }, I::MessageProvider)),
    view: E::Message, messageRef: "message", messageRefs: Set("message"), billRef: "bill", billOrigin: "https://utility.example",
    billAccount: "account", billSourceRef: "message", billConfirmed: true })
pure val entryValues = Set(C::initial,
  { ...C::initial, phase: C::Saved, hasSaved: true,
    identity: { owner: "owner", calendarId: "calendar", occurrenceId: "calendar-entry", sourceRef: "message",
      kind: C::Bill, billRef: "bill", billOrigin: "https://utility.example", billAccount: "account" },
    committed: { ...C::noDetails, title: "Bill", startAt: 1, endAt: 2, timezone: "UTC" } })
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
  { ...r, owner: owner, pending: noSource, waiting: false, selected: "", resolutionError: false, requestVersion: r.requestVersion + 1 }
pure def lawOtherOwnerHasNoAccessibleRecord(r: Registry, key: P::BillKey): bool =
  key.owner != r.owner implies accessibleRecord(r, key) == ""
```

### Selecting a bill records its source and waits for the canonical durable mapping

Repeated or changed selections replace the pending request, not the payment record. Calendar preview, reminder delivery and mere email receipt do not trigger this event; the person chooses Open bill or asks for help with that selected bill.

```quint
pure def canRequestOpen(r: Registry, source: BillSource, by: RegistryActor): bool =
  usableSource(source) and r.owner != "" and source.key.owner == r.owner and by == RegistryUser
pure def requestOpen(r: Registry, source: BillSource, by: RegistryActor): Registry =
  { ...r, pending: source, waiting: true, selected: "", resolutionError: false, requestVersion: r.requestVersion + 1 }
pure def alwaysPendingBelongsToOwner(r: Registry): bool =
  r.waiting implies usableSource(r.pending) and r.pending.key.owner == r.owner and r.owner != ""
pure def alwaysRequestVersion(r: Registry): bool = r.requestVersion >= 0
```

### One provider bill resolves to exactly one payment record across all entry points

If the bill already has a mapping, storage must return that record. A different bill cannot reuse its record reference. Failure to save or resolve records a visible error and leaves the request pending for retry without any payment effect. Retrying the same selection creates a new request revision; failure callbacks for an earlier selection are refused. A stale callback cannot open an old source.

```quint
pure def canResolve(r: Registry, expectedVersion: int, recordRef: str, by: RegistryActor): bool =
  r.waiting and expectedVersion == r.requestVersion and recordRef != "" and by == RegistryStore and
  (bindingFor(r, r.pending.key).recordRef == "" or bindingFor(r, r.pending.key).recordRef == recordRef) and
  r.bindings.every(row => row.recordRef != recordRef or row.key == r.pending.key)
pure def resolve(r: Registry, expectedVersion: int, recordRef: str, by: RegistryActor): HandoffResult = {
  state: {
    ...r, waiting: false, selected: recordRef, resolutionError: false,
    bindings: if (bindingFor(r, r.pending.key).recordRef == "") r.bindings.append({ key: r.pending.key, recordRef: recordRef }) else r.bindings
  },
  out: List(OpenBill({ key: r.pending.key, recordRef: recordRef, source: r.pending }))
}
pure def canResolutionFailed(r: Registry, expectedVersion: int, by: RegistryActor): bool =
  r.waiting and expectedVersion == r.requestVersion and by == RegistryStore
pure def resolutionFailed(r: Registry, expectedVersion: int, by: RegistryActor): Registry = { ...r, resolutionError: true }
pure def alwaysResolutionError(r: Registry): bool = r.resolutionError implies r.waiting
pure def sometimesResolutionFailed(r: Registry): bool = r.resolutionError
pure def alwaysMappingsAreValid(r: Registry): bool =
  r.bindings.every(row => P::validKey(row.key) and row.recordRef != "")
pure def alwaysOneRecordPerBill(r: Registry): bool =
  r.bindings.every(row => r.bindings.select(other => other.key == row.key).length() == 1)
pure def alwaysOneBillPerRecord(r: Registry): bool =
  r.bindings.every(row => r.bindings.select(other => other.recordRef == row.recordRef).length() == 1)
pure def alwaysSelectedBelongsToOwner(r: Registry): bool =
  r.selected == "" or r.bindings.some(row => row.recordRef == r.selected and row.key.owner == r.owner)
pure def stepMappingsAreRetained(before: Registry, after: Registry): bool =
  before.bindings.every(row => after.bindings.includes(row))
pure def stepHandoffIsOnlyNavigation(before: Registry, after: Registry, out: List[HandoffEffect]): bool =
  out.length() > 0 implies before.waiting and not(after.waiting) and after.selected != ""
pure def lawSameBillHasSameRecord(r: Registry, first: BillSource, second: BillSource): bool =
  first.key == second.key implies accessibleRecord(r, first.key) == accessibleRecord(r, second.key)
pure def sometimesBillOpened(r: Registry): bool = r.selected != ""
pure def sometimesMoreThanOneBill(r: Registry): bool = r.bindings.length() >= 2
pure def sometimesCalendarHandoff(r: Registry): bool = r.selected != "" and r.pending.kind == CalendarSource
```

### Canceling a handoff does not delete a payment record

```quint
pure def canCancel(r: Registry, by: RegistryActor): bool = r.waiting and by == RegistryUser
pure def cancel(r: Registry, by: RegistryActor): Registry =
  { ...r, waiting: false, pending: noSource, selected: "", resolutionError: false, requestVersion: r.requestVersion + 1 }
```

## Story: Return to the bill and see its actual result

> As a person returning to Calendar or Email after paying, I want the same observed status and receipt, without the calendar inventing a separate paid flag.

### Every source displays only the result of its matching payment aggregate

An unavailable or mismatched aggregate is Unknown, not unpaid, failed or completed. Scheduled and Accepted remain distinct from Completed; a later verified Returned result replaces historical success. Closing the browser or deleting the source entry cannot alter the payment. A positive reference can be retrieved later from the canonical record, even after the originating conversation has ended.

```quint
pure def sourceMatchesPayment(source: BillSource, payment: P::Payment): bool =
  usableSource(source) and source.key == payment.key
pure def visibleOutcome(source: BillSource, payment: P::Payment): P::PaymentOutcome =
  if (sourceMatchesPayment(source, payment)) payment.result else P::Unknown
pure def visibleReceipt(source: BillSource, payment: P::Payment): str =
  if (sourceMatchesPayment(source, payment) and P::positiveOutcome(payment.result)) payment.reference else ""
pure def lawAnotherBillHasNoReceipt(source: BillSource, payment: P::Payment): bool =
  source.key != payment.key implies visibleReceipt(source, payment) == ""
pure def lawCompletedLabelRequiresCompletedEvidence(source: BillSource, payment: P::Payment): bool =
  visibleOutcome(source, payment) == P::Completed implies sourceMatchesPayment(source, payment) and payment.result == P::Completed
pure val paymentValues = Set(P::initial,
  { ...P::initial, key: P::exampleKey, proposal: P::exampleProposal, stage: P::Resolved, result: P::Completed, reference: "receipt" },
  { ...P::initial, key: P::exampleKey, proposal: P::exampleProposal, stage: P::Checking, result: P::Unknown })
```

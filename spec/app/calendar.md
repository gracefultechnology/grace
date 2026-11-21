# Calendar

`prototype/Grace Prototype.html:1893–1931,2157–2176` supplies Calendar's
Week/Month views, Today, selected day, event detail, add/edit forms, reminders
and one/all recurring deletion. [Calendar view](./calendarView.md) owns navigation
and series deletion. Calendar-to-bill handoff is the user's explicit MVP extension;
the prototype itself contains no calendar payment action. Dates, recurrence and reminders organize the
user's work; they never authorize a browser action or submit a payment.

This module defines one calendar occurrence's lifecycle. Calendar view owns
the actual occurrence values and routes these transitions to them; the runtime
does not create a second live occurrence store. It retains past occurrences by
owner/calendar/occurrence identity. Timed entries carry a named timezone and exact instants; all-day
entries carry calendar-local date boundaries. Adapters validate timezone and
calendar-date conversions, including daylight-saving gaps and overlaps, before
supplying the validated instants used here. The model does not substitute a
fixed day length for calendar arithmetic.

A bill occurrence refers to the shared payment aggregate by owner, provider
origin, provider account and unique provider invoice/cycle reference. The
calendar occurrence ID is a view identity, not a second payment key. There is no duplicate
paid/pending flag here: the UI obtains those labels from that aggregate.
The host authenticates the user, persistence service and clock as `CalendarUser`,
`CalendarStore` and `CalendarClock`; `by` never comes from an untrusted event.
A user approves a revision; only its durable storage acknowledgment saves it.

## Story: Add and correct an appointment or bill reminder

> As a user, I want to add, review, correct and remove calendar entries, with
> a clear time and source, without changing the bill or payment they refer to.

### A new occurrence has no saved entry or scheduled reminder

An appointment made from an email retains the source mailbox's registry ID and
the provider's message reference, including when it is saved to the tablet's
calendar. Zero records an occurrence without an identified source mailbox.

```quint
type CalendarActor = CalendarUser | CalendarStore | CalendarClock
type EntryKind = Appointment | Bill
type CalendarPhase = Empty | Editing | Saved | DeleteReview | DeleteApproved | Deleted
type Recurrence = Once | Weekly | Monthly
type StorageError = NoStorageError | SaveFailure | DeleteFailure
type ReminderStatus = ReminderOff | ReminderWaiting | ReminderShown | ReminderDismissed
type EntryIdentity = {
  owner: str, calendarId: str, occurrenceId: str, sourceRef: str, sourceAccount: int,
  kind: EntryKind, billRef: str, billOrigin: str, billAccount: str
}
type EntryDetails = {
  title: str, location: str, participant: str, notes: str, startAt: int, endAt: int, timezone: str, allDay: bool,
  seriesId: str, recurrence: Recurrence, reminderEnabled: bool, leadTime: int, important: bool
}
type Calendar = {
  phase: CalendarPhase, identity: EntryIdentity,
  committed: EntryDetails, draft: EntryDetails, hasSaved: bool,
  revision: int, approvedRevision: int, storageError: StorageError, clock: int, reminder: ReminderStatus, remindAt: int
}
pure val noIdentity: EntryIdentity = {
  owner: "", calendarId: "", occurrenceId: "", sourceRef: "", sourceAccount: 0,
  kind: Appointment, billRef: "", billOrigin: "", billAccount: ""
}
pure val noDetails: EntryDetails = {
  title: "", location: "", participant: "", notes: "", startAt: 0, endAt: 0, timezone: "", allDay: false,
  seriesId: "", recurrence: Once, reminderEnabled: false, leadTime: 0, important: false
}
pure val initial: Calendar = {
  phase: Empty, identity: noIdentity, committed: noDetails, draft: noDetails,
  hasSaved: false, revision: 0, approvedRevision: -1, storageError: NoStorageError, clock: 0, reminder: ReminderOff, remindAt: 0
}
pure def validIdentity(identity: EntryIdentity): bool =
  identity.owner != "" and identity.calendarId != "" and identity.occurrenceId != "" and identity.sourceAccount >= 0 and
  (identity.sourceAccount > 0 implies (identity.kind == Appointment and identity.sourceRef != "")) and
  (identity.kind == Bill implies (identity.sourceRef != "" and identity.billRef != "" and
    identity.billOrigin != "" and identity.billAccount != "")) and
  (identity.kind == Appointment implies
    (identity.billRef == "" and identity.billOrigin == "" and identity.billAccount == ""))
pure def validDetails(details: EntryDetails): bool =
  details.title != "" and details.timezone != "" and
  details.endAt > details.startAt and details.leadTime >= 0 and
  (details.recurrence == Once or details.seriesId != "")
```

### Creation binds a unique occurrence and editing changes only its draft

The registry admits a fresh occurrence ID once; importing the same source
occurrence again selects its existing machine instead of duplicating it.
A bill's immutable source reference points to the email/provider evidence, not
a sample biller. Editing a title or reminder cannot change its payment identity.
Incomplete drafts remain editable and cannot be saved. The form edits title, day,
start time, location, repeat and reminder; detail also displays the imported
participant and notes. `edit` replaces the draft with what it is given; Calendar
view gives it the form applied by `formDetails` (next rule), so imported fields
survive edits. The prototype's hour-long
new appointment is a default; existing duration and real calendar dates are not
restricted to its sample 21-day picker or half-hour daytime options. Repeat UI
choices are Never, Every week and Every month. Reminder UI choices are No, Day
before and 1 hour before, interpreted in the occurrence timezone. An entry
marked important by its source, such as the clinic appointment that came from
the clinic's email, draws the red bar, red month label and red Home day label
(`Grace Prototype.html:1800,1876,1895,1908`). The form has no control for it,
so Calendar view refuses a new entry marked important, `formDetails` keeps
the draft's mark on every edit, and Calendar view keeps each member's own mark
when a repeating event is edited and saved as a series.

```quint
pure def canCreate(c: Calendar, identity: EntryIdentity, by: CalendarActor): bool =
  by == CalendarUser and c.phase == Empty and not(c.hasSaved) and validIdentity(identity)
pure def create(c: Calendar, identity: EntryIdentity, details: EntryDetails, by: CalendarActor): Calendar =
  { ...c, phase: Editing, identity: identity, draft: details, revision: c.revision + 1, approvedRevision: -1, storageError: NoStorageError }
pure def canBeginEdit(c: Calendar, by: CalendarActor): bool = by == CalendarUser and c.phase == Saved
pure def beginEdit(c: Calendar, by: CalendarActor): Calendar =
  { ...c, phase: Editing, draft: c.committed, revision: c.revision + 1, approvedRevision: -1, storageError: NoStorageError }
pure def canEdit(c: Calendar, by: CalendarActor): bool = by == CalendarUser and c.phase == Editing
pure def edit(c: Calendar, details: EntryDetails, by: CalendarActor): Calendar =
  { ...c, draft: details, revision: c.revision + 1, approvedRevision: -1, storageError: NoStorageError }
pure def canCancelEdit(c: Calendar, by: CalendarActor): bool = by == CalendarUser and c.phase == Editing
pure def cancelEdit(c: Calendar, by: CalendarActor): Calendar =
  { ...c, phase: if (c.hasSaved) Saved else Empty,
    identity: if (c.hasSaved) c.identity else noIdentity,
    draft: c.committed, approvedRevision: -1, storageError: NoStorageError }
```

### Changing the start keeps the event's length

The form has a start time and no end time. Choosing another day or time moves
the whole event: `formDetails` takes the form's start and keeps the draft's
length, so the end follows the start by that duration. The form shows "start to
end" from the draft. This deliberately departs from the prototype, whose form
always shows the start to one hour later (`Grace Prototype.html:1926`) and sets
the end to one hour after the start on every save (`Grace Prototype.html:2171`),
which silently shortens the 90-minute "Lunch with Susan"
(`Grace Prototype.html:1801`); the model keeps the duration. Only a new
appointment's seed carries the one-hour default length. `formDetails` takes the
title, location, repeat (with its series ID) and reminder from the form; the
fields it has no control for, the participant, notes, important mark, timezone
and all-day flag, stay as they are in the draft.

```quint
pure def withStart(details: EntryDetails, startAt: int): EntryDetails =
  { ...details, startAt: startAt, endAt: startAt + (details.endAt - details.startAt) }
pure def formDetails(draft: EntryDetails, form: EntryDetails): EntryDetails =
  { ...withStart(draft, form.startAt), title: form.title, location: form.location, seriesId: form.seriesId,
    recurrence: form.recurrence, reminderEnabled: form.reminderEnabled, leadTime: form.leadTime }
pure def lawChangingStartKeepsDuration(details: EntryDetails, startAt: int): bool =
  val shifted = withStart(details, startAt)
  shifted.startAt == startAt and shifted.endAt - shifted.startAt == details.endAt - details.startAt and
    (validDetails(details) implies validDetails(shifted))
pure def lawFormKeepsLengthAndImportedFields(draft: EntryDetails, form: EntryDetails): bool =
  val applied = formDetails(draft, form)
  applied.startAt == form.startAt and applied.endAt - applied.startAt == draft.endAt - draft.startAt and
    applied.participant == draft.participant and applied.notes == draft.notes and
    applied.important == draft.important and applied.timezone == draft.timezone and applied.allDay == draft.allDay
```

### Saving requires the current complete draft and explicit confirmation

The visible form Save button approves the exact displayed revision; the model
does not add a second confirmation dialog. Assisted creation remains a visible
unsaved draft until the user approves it. Confirmation names that draft revision. A changed draft
cannot consume an old approval. The storage adapter commits durably before
publishing this transition; failed storage leaves the draft visible and retryable
with an explicit SaveFailure result. Retrying requires another user approval.
Discovered by retry review: a failed write retires its revision. Without that
fence, another Save of the same draft could accept a delayed acknowledgment
from the failed attempt. Retrying the unchanged draft uses the new revision.
Calendar provider synchronization, when present, may report pending or failure
separately and never turns a local save into a claimed remote acknowledgment.

```quint
pure def canApproveSave(c: Calendar, revision: int, by: CalendarActor): bool =
  by == CalendarUser and c.phase == Editing and validDetails(c.draft) and revision == c.revision
pure def approveSave(c: Calendar, revision: int, by: CalendarActor): Calendar =
  { ...c, approvedRevision: revision, storageError: NoStorageError }
pure def canSave(c: Calendar, revision: int, persisted: bool, by: CalendarActor): bool =
  by == CalendarStore and c.phase == Editing and validDetails(c.draft) and revision == c.revision and
  c.approvedRevision == revision and persisted
pure def save(c: Calendar, revision: int, persisted: bool, by: CalendarActor): Calendar =
  { ...c, phase: Saved, committed: c.draft, hasSaved: true, approvedRevision: -1, storageError: NoStorageError,
    reminder: if (c.draft.reminderEnabled) ReminderWaiting else ReminderOff,
    remindAt: if (c.draft.reminderEnabled) c.draft.startAt - c.draft.leadTime else 0 }
pure def canSaveFailed(c: Calendar, revision: int, by: CalendarActor): bool =
  by == CalendarStore and c.phase == Editing and revision == c.revision and c.approvedRevision == revision
pure def saveFailed(c: Calendar, revision: int, by: CalendarActor): Calendar =
  { ...c, revision: c.revision + 1, approvedRevision: -1, storageError: SaveFailure }
pure def lawSaveFailureRetiresRevision(c: Calendar, revision: int, by: CalendarActor): bool =
  val failed = saveFailed(c, revision, by)
  val retried = approveSave(failed, failed.revision, CalendarUser)
  canSaveFailed(c, revision, by) implies
    failed.draft == c.draft and failed.committed == c.committed and failed.hasSaved == c.hasSaved and
    failed.revision == c.revision + 1 and failed.approvedRevision == -1 and
    not(canSave(retried, revision, true, CalendarStore)) and
    not(canSaveFailed(retried, revision, CalendarStore))
pure def sometimesSaveFailure(c: Calendar): bool = c.storageError == SaveFailure
pure def alwaysIdentityIsBound(c: Calendar): bool =
  c.phase != Empty implies validIdentity(c.identity)
pure def alwaysSavedEntryIsComplete(c: Calendar): bool =
  c.hasSaved implies validDetails(c.committed)
pure def alwaysSavedPhaseHasEntry(c: Calendar): bool =
  (c.phase == Saved or c.phase == DeleteReview or c.phase == DeleteApproved or c.phase == Deleted) implies c.hasSaved
pure def alwaysEmptyHasNoSavedEntry(c: Calendar): bool =
  c.phase == Empty implies not(c.hasSaved)
pure def alwaysCalendarCounters(c: Calendar): bool =
  c.revision >= 0 and c.clock >= 0 and c.approvedRevision >= -1
pure def alwaysStorageErrorHasContext(c: Calendar): bool =
  (c.storageError == SaveFailure implies c.phase == Editing) and
  (c.storageError == DeleteFailure implies c.phase == DeleteReview)
pure def alwaysSaveApprovalIsCurrent(c: Calendar): bool =
  c.approvedRevision != -1 implies (c.phase == Editing and c.approvedRevision == c.revision)
pure def sometimesAppointmentSaved(c: Calendar): bool =
  c.phase == Saved and c.identity.kind == Appointment
pure def sometimesBillSaved(c: Calendar): bool =
  c.phase == Saved and c.identity.kind == Bill
```

### Deleting an occurrence requires confirmation and leaves payment records alone

The user can cancel the deletion question. A DeleteFailure returns to that
question with the saved entry intact, so retry needs renewed approval.
Deletion stops future reminders and
removes this occurrence from calendar lists, while retaining its identity as a
tombstone against duplicate imports. Deleting a recurring occurrence affects
only that occurrence. The prototype's recurring deletion question offers only this occurrence or
every occurrence. Calendar view records a series tombstone for the latter so
future recurrence materialization cannot resurrect the series. Choosing a scope
in that question is the single deletion approval; there is no second question.

```quint
pure def canRequestDelete(c: Calendar, by: CalendarActor): bool = by == CalendarUser and c.phase == Saved
pure def requestDelete(c: Calendar, by: CalendarActor): Calendar = { ...c, phase: DeleteReview, storageError: NoStorageError }
pure def canCancelDelete(c: Calendar, by: CalendarActor): bool = by == CalendarUser and (c.phase == DeleteReview or c.phase == DeleteApproved)
pure def cancelDelete(c: Calendar, by: CalendarActor): Calendar = { ...c, phase: Saved, storageError: NoStorageError }
pure def canApproveDelete(c: Calendar, by: CalendarActor): bool =
  by == CalendarUser and c.phase == DeleteReview
pure def approveDelete(c: Calendar, by: CalendarActor): Calendar = { ...c, phase: DeleteApproved, storageError: NoStorageError }
pure def canConfirmDelete(c: Calendar, persisted: bool, by: CalendarActor): bool =
  by == CalendarStore and c.phase == DeleteApproved and persisted
pure def confirmDelete(c: Calendar, persisted: bool, by: CalendarActor): Calendar =
  { ...c, phase: Deleted, reminder: ReminderOff, revision: c.revision + 1, storageError: NoStorageError }
pure def canDeleteFailed(c: Calendar, by: CalendarActor): bool = by == CalendarStore and c.phase == DeleteApproved
pure def deleteFailed(c: Calendar, by: CalendarActor): Calendar =
  { ...c, phase: DeleteReview, storageError: DeleteFailure }
pure def sometimesDeleteFailure(c: Calendar): bool = c.storageError == DeleteFailure
pure def stepSavedIdentityNeverChanges(before: Calendar, after: Calendar): bool =
  before.hasSaved implies after.identity == before.identity
pure def alwaysDeletedHasNoReminder(c: Calendar): bool =
  c.phase == Deleted implies c.reminder == ReminderOff
pure def sometimesDeleted(c: Calendar): bool = c.phase == Deleted
```

## Story: See a reminder and choose what to do

> As a user, I want a due reminder that I can dismiss or snooze, and I want
> opening a bill to take me to its details without paying it automatically.

The prototype's reminder offers See details and Dismiss only
(`Grace Prototype.html:1870`). Snooze is kept from the user's reminder
requirement (CAL-05): it is offered in the open occurrence's detail beside
Dismiss while its reminder is shown, never on the Home banner.

### Time only makes an enabled reminder eligible and never executes the task

Clock updates do not change entries, approvals or payment state. A reminder is
shown once while waiting; a snooze explicitly schedules another display. Editing
an entry retains its existing reminder until the new draft is saved. Closing a
calendar view does not delete an entry or dismiss its reminder.

```quint
pure def canAdvanceTime(c: Calendar, now: int, by: CalendarActor): bool = by == CalendarClock and now >= c.clock
pure def advanceTime(c: Calendar, now: int, by: CalendarActor): Calendar = { ...c, clock: now }
pure def canShowReminder(c: Calendar, by: CalendarActor): bool =
  by == CalendarClock and c.hasSaved and c.phase != Deleted and c.reminder == ReminderWaiting and c.clock >= c.remindAt
pure def showReminder(c: Calendar, by: CalendarActor): Calendar = { ...c, reminder: ReminderShown }
pure def canSnooze(c: Calendar, until: int, by: CalendarActor): bool = by == CalendarUser and c.reminder == ReminderShown and until > c.clock
pure def snooze(c: Calendar, until: int, by: CalendarActor): Calendar =
  { ...c, reminder: ReminderWaiting, remindAt: until }
pure def canDismissReminder(c: Calendar, by: CalendarActor): bool = by == CalendarUser and c.reminder == ReminderShown
pure def dismissReminder(c: Calendar, by: CalendarActor): Calendar = { ...c, reminder: ReminderDismissed }
pure def alwaysReminderHasEntry(c: Calendar): bool =
  c.reminder != ReminderOff implies
    (c.hasSaved and c.committed.reminderEnabled and c.phase != Deleted)
pure def sometimesReminderShown(c: Calendar): bool = c.reminder == ReminderShown
pure def sometimesReminderDismissed(c: Calendar): bool = c.reminder == ReminderDismissed
```

### A bill handoff names the saved occurrence and carries no approval

Only saved, undeleted bill occurrences can start a bill-details handoff. The
caller resolves the canonical payment record and its current outcome before
presenting a next step. Due date, notification display and calendar presence are
not payment authorization. All-day and timed views use the same occurrence ID.

```quint
pure def billAvailable(c: Calendar): bool =
  c.hasSaved and c.phase != Deleted and c.identity.kind == Bill
pure def occurrenceBill(c: Calendar): str = if (billAvailable(c)) c.identity.billRef else ""
pure def lawEmptyCalendarCannotOpenBill(c: Calendar): bool =
  c.phase == Empty and not(c.hasSaved) implies occurrenceBill(c) == ""
```

## Story: Keep repeating entries distinct

> As a user, I want recurring appointments and bills to appear as distinct
> occurrences so that finishing this month's task does not finish next month's.

### Recurrence creates another occurrence rather than changing an existing identity

A recurring series has a stable series ID and an explicit recurrence rule.
Deleting one occurrence leaves its series rule available for later dates;
Calendar view's deleted-series tombstone alone blocks materializing an entire
canceled series. The calendar adapter computes the next valid local date in the named timezone,
then supplies its validated instants. Monthly recurrence preserves the original local day of the month and skips
months that do not contain that day, matching the prototype's `evOn` predicate
at line 1894. January 31 therefore next occurs March 31; it does not clamp to
February's last day or roll into March. Use calendar arithmetic, never a fixed
number of seconds. Weekly recurrence preserves the local weekday and wall time.
An invalid or ambiguous local time requires an explicit validated resolution
before an occurrence is materialized; the adapter cannot silently choose one. The registry creates a new machine after checking that the
new occurrence ID is unused; the prior occurrence, receipt and reminder remain
independent. A following bill requires a distinct verified invoice/cycle reference
and source evidence before it becomes payable: Calendar view's publishing
checks `followingAllowed` against every live saved member of the bill's series,
so a series' bills are materialized in date order. Its amount and provider evidence
are fetched for that bill, never copied from the last payment. Two calendar
entries for the same invoice still resolve the same payment ledger entry.

```quint
pure def followingAllowed(c: Calendar, nextId: str, nextBillRef: str, nextSourceRef: str, details: EntryDetails): bool =
  c.hasSaved and c.committed.recurrence != Once and
  nextId != "" and nextId != c.identity.occurrenceId and validDetails(details) and
  details.startAt > c.committed.startAt and details.seriesId == c.committed.seriesId and
  details.recurrence == c.committed.recurrence and details.timezone == c.committed.timezone and
  (c.identity.kind == Appointment implies nextBillRef == "") and
  (c.identity.kind == Bill implies (nextBillRef != "" and nextBillRef != c.identity.billRef and nextSourceRef != ""))
pure def followingIdentity(identity: EntryIdentity, nextId: str, nextBillRef: str, nextSourceRef: str): EntryIdentity =
  { ...identity, occurrenceId: nextId, billRef: nextBillRef, sourceRef: nextSourceRef }
pure def lawFollowingKeepsAccount(identity: EntryIdentity, nextId: str, nextBillRef: str, nextSourceRef: str): bool =
  val following = followingIdentity(identity, nextId, nextBillRef, nextSourceRef)
  following.owner == identity.owner and following.calendarId == identity.calendarId and
  following.billOrigin == identity.billOrigin and following.billAccount == identity.billAccount and
  following.occurrenceId == nextId and following.billRef == nextBillRef and following.sourceRef == nextSourceRef
pure def sometimesRecurring(c: Calendar): bool = c.hasSaved and c.committed.recurrence != Once
```

### Simulation includes appointments, bills, incomplete drafts and recurring dates

Sample instants have no production meaning. The model places no fixed limit on
calendar entries, users, providers, duration or recurrence count.

```quint
pure val appointmentIdentity: EntryIdentity = {
  owner: "ownerA", calendarId: "calendarA", occurrenceId: "visitA", sourceRef: "manual", sourceAccount: 0,
  kind: Appointment, billRef: "", billOrigin: "", billAccount: ""
}
pure val billIdentity: EntryIdentity = {
  owner: "ownerA", calendarId: "calendarA", occurrenceId: "periodA", sourceRef: "messageA", sourceAccount: 0,
  kind: Bill, billRef: "billA", billOrigin: "https://biller.example", billAccount: "billerAccount"
}
pure val timedDetails: EntryDetails = {
  title: "Appointment", location: "Clinic", participant: "", notes: "", startAt: 3, endAt: 4, timezone: "America/New_York", allDay: false,
  seriesId: "", recurrence: Once, reminderEnabled: true, leadTime: 1, important: false
}
pure val repeatingDetails: EntryDetails = {
  title: "Bill due", location: "", participant: "", notes: "", startAt: 5, endAt: 6, timezone: "America/New_York", allDay: true,
  seriesId: "seriesA", recurrence: Monthly, reminderEnabled: true, leadTime: 2, important: false
}
pure val identityValues = Set(noIdentity, appointmentIdentity, billIdentity)
pure val detailsValues = Set(noDetails, timedDetails, repeatingDetails, { ...timedDetails, recurrence: Weekly, seriesId: "weeklySeries" })
pure val draftValues = detailsValues
pure val formValues = detailsValues
pure val nextIdValues = Set("", "periodA", "periodB")
pure val nextBillRefValues = Set("", "billA", "billB")
pure val nextSourceRefValues = Set("", "messageA", "messageB")
pure val weight_save = 5
pure val weight_showReminder = 5
pure val weight_confirmDelete = 3
```

## Story: Browse my calendar and select the right occurrence

> As a user, I want a day, week or month view of my own calendar, with each
> occurrence shown once and the selected occurrence opening its own details.

### A calendar view filters by owner, calendar and an explicit time interval

The UI computes its day/week/month interval in the chosen timezone and passes
that interval here. An entry is visible when its interval overlaps the view;
ending exactly at the view's start or starting at its end is excluded. Deleted
entries are hidden. Editing a saved entry keeps its committed occurrence visible
until Save. The returned order is registry order; presentation sorts by the
committed start time without changing identities.

```quint
pure def inView(c: Calendar, owner: str, calendarId: str, fromTime: int, untilTime: int): bool =
  c.hasSaved and c.phase != Deleted and c.identity.owner == owner and
  c.identity.calendarId == calendarId and fromTime < untilTime and
  c.committed.startAt < untilTime and c.committed.endAt > fromTime
pure def visibleEntries(entries: List[Calendar], owner: str, calendarId: str, fromTime: int, untilTime: int): List[Calendar] =
  entries.select(c => inView(c, owner, calendarId, fromTime, untilTime))
type ViewQuery = { owner: str, calendarId: str, fromTime: int, untilTime: int }
pure def lawViewExcludesAnotherOwner(c: Calendar, query: ViewQuery): bool =
  c.identity.owner != query.owner implies not(inView(c, query.owner, query.calendarId, query.fromTime, query.untilTime))
pure def lawEmptyIntervalHasNoEntry(c: Calendar, query: ViewQuery): bool =
  query.fromTime >= query.untilTime implies not(inView(c, query.owner, query.calendarId, query.fromTime, query.untilTime))
pure def lawDeletedEntryIsHidden(c: Calendar, query: ViewQuery): bool =
  c.phase == Deleted implies not(inView(c, query.owner, query.calendarId, query.fromTime, query.untilTime))
pure val queryValues = Set(
  { owner: "ownerA", calendarId: "calendarA", fromTime: 0, untilTime: 6 },
  { owner: "ownerB", calendarId: "calendarA", fromTime: 0, untilTime: 6 },
  { owner: "ownerA", calendarId: "calendarB", fromTime: 0, untilTime: 6 },
  { owner: "ownerA", calendarId: "calendarA", fromTime: 6, untilTime: 0 })
```

### Registering an occurrence replaces its own identity instead of adding a duplicate

The registry includes deletion tombstones. Upsert removes every prior row with
that owner/calendar/occurrence key, then appends exactly the current occurrence.
It never replaces another owner's or another calendar's same-named occurrence.
An empty or unbound occurrence cannot be registered. Every imported value
satisfies the complete occurrence invariants. Older or conflicting same-
revision snapshots are refused, and a deleted occurrence cannot be resurrected
by a late import or callback. The complete identity of an existing occurrence
must match, including its source and bill reference; a higher content revision
does not authorize retargeting the bill. This import boundary does not handle
live reminder updates: Calendar view routes them to its actual stored row.
Calendar view's selection returns no entry for a missing or ambiguous key,
rather than displaying somebody else's entry.

```quint
pure def sameOccurrence(left: Calendar, right: Calendar): bool =
  left.identity.owner == right.identity.owner and left.identity.calendarId == right.identity.calendarId and
  left.identity.occurrenceId == right.identity.occurrenceId
pure def validState(c: Calendar): bool =
  alwaysIdentityIsBound(c) and alwaysSavedEntryIsComplete(c) and alwaysSavedPhaseHasEntry(c) and
  alwaysEmptyHasNoSavedEntry(c) and alwaysCalendarCounters(c) and alwaysStorageErrorHasContext(c) and
  alwaysSaveApprovalIsCurrent(c) and alwaysDeletedHasNoReminder(c) and alwaysReminderHasEntry(c)
pure def admissibleOccurrence(entries: List[Calendar], incoming: Calendar): bool =
  validState(incoming) and validIdentity(incoming.identity) and incoming.hasSaved and
  (incoming.phase == Saved or incoming.phase == Deleted) and
  entries.every(c => not(sameOccurrence(c, incoming)) or
    (c.identity == incoming.identity and (c == incoming or (c.phase != Deleted and incoming.revision > c.revision))))
pure def upsertOccurrence(entries: List[Calendar], incoming: Calendar): List[Calendar] =
  if (admissibleOccurrence(entries, incoming))
    entries.select(c => not(sameOccurrence(c, incoming))).append(incoming)
  else entries
pure def lawOccurrenceIdentityIsSymmetric(left: Calendar, right: Calendar): bool =
  sameOccurrence(left, right) == sameOccurrence(right, left)
pure def lawDistinctOwnersAreDistinctOccurrences(left: Calendar, right: Calendar): bool =
  left.identity.owner != right.identity.owner implies not(sameOccurrence(left, right))
pure def lawImportCannotChangeIdentity(entries: List[Calendar], incoming: Calendar): bool =
  admissibleOccurrence(entries, incoming) implies
    entries.every(c => sameOccurrence(c, incoming) implies c.identity == incoming.identity)
```

### An admitted upsert leaves one current row and refused updates preserve the registry

```quint
pure def lawUpsertLeavesOne(entries: List[Calendar], incoming: Calendar): bool =
  admissibleOccurrence(entries, incoming) implies
    upsertOccurrence(entries, incoming).select(c => sameOccurrence(c, incoming)).length() == 1
pure def lawRefusedUpsertPreservesEntries(entries: List[Calendar], incoming: Calendar): bool =
  not(admissibleOccurrence(entries, incoming)) implies upsertOccurrence(entries, incoming) == entries
pure val incomingValues = Set(initial,
  approveSave(create(initial, appointmentIdentity, timedDetails, CalendarUser), 1, CalendarUser),
  save(approveSave(create(initial, appointmentIdentity, timedDetails, CalendarUser), 1, CalendarUser), 1, true, CalendarStore),
  save(approveSave(create(initial, billIdentity, repeatingDetails, CalendarUser), 1, CalendarUser), 1, true, CalendarStore))
pure val leftValues = incomingValues
pure val rightValues = incomingValues
pure val entriesValues = Set(List(initial),
  List(save(approveSave(create(initial, appointmentIdentity, timedDetails, CalendarUser), 1, CalendarUser), 1, true, CalendarStore)),
  List(save(approveSave(create(initial, billIdentity, repeatingDetails, CalendarUser), 1, CalendarUser), 1, true, CalendarStore),
    save(approveSave(create(initial, billIdentity, repeatingDetails, CalendarUser), 1, CalendarUser), 1, true, CalendarStore)))
pure val ownerValues = Set("", "ownerA", "ownerB")
pure val calendarIdValues = Set("", "calendarA", "calendarB")
```

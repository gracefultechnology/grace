# Calendar views and recurring deletion

`prototype/Grace Prototype.html:1893–1931,2157–2176` defines Week/Month, Today,
previous/next period, selected-day rows, upcoming previews, event detail and
Delete only this one / Delete every one / Keep it. This module owns the current
view and the only live collection of [occurrences](./calendar.md), including
their drafts and reminder state. Calendar defines the lifecycle; this aggregate
routes user, store and clock operations to the actual stored values. The runtime
must not instantiate a second live Calendar machine for those same entries.
The display timezone
need not equal an event's timezone: absolute intervals select visible events,
while each recurring event retains its own timezone. Publishing is only for
validated durable import/refresh; ordinary edits and reminder progress use the
owned occurrence route. Consumers resolve current rows here,
including before a calendar bill handoff; a remembered UI snapshot is not a
fresh source.

Date conversion is performed by a timezone-aware calendar adapter. A period has
real local calendar boundaries: months are not 30 days and weeks across DST are
not necessarily 168 hours. Grid rows cover every date in the displayed month.
The prototype's five-row grid, 21-day picker and fixed sample date do not limit
this model. UI sorts each day's rows by start time and shows their occurrence IDs.

## Story: Browse my calendar and open an exact occurrence

> As a user, I want to move through weeks and months, select a day, return to
> today and open the right saved event while drafts remain clearly unsaved.

### A calendar collection binds one owner and validates published occurrences

Discovered by the proof: publishing a persisted row requires the collection's
owner, calendar and display timezone to be bound first. An event's own timezone
cannot establish the collection's independently chosen display timezone.

```quint
import calendar as C from "./calendar"

type ViewActor = ViewUser | ViewStore | ViewClock
type ViewMode = WeekView | MonthView
type Navigation = Today | Earlier | Later | SelectDay | SwitchMode
type ViewWindow = { mode: ViewMode, anchorDay: int, selectedDay: int, fromTime: int, untilTime: int }
type NavigationReport = { window: ViewWindow, kind: Navigation, verified: bool }
type DeleteScope = ThisOccurrence | EntireSeries
type DeleteStatus = NoDeletion | DeletionQuestion | DeletionPending | DeletionFailed
type SeriesDefinition = { version: int, details: C::EntryDetails }
type CalendarView = {
  owner: str, calendarId: str, timezone: str, opened: bool, window: ViewWindow,
  entries: List[C::Calendar], selectedId: str, deletedSeries: Set[str], cancelledIds: Set[str],
  series: List[SeriesDefinition],
  deletion: DeleteStatus, scope: DeleteScope, generation: int, evidence: str
}
pure val emptyWindow: ViewWindow = { mode: WeekView, anchorDay: 0, selectedDay: 0, fromTime: 0, untilTime: 1 }
pure val initial: CalendarView = {
  owner: "", calendarId: "", timezone: "", opened: false, window: emptyWindow,
  entries: List(), selectedId: "", deletedSeries: Set(), cancelledIds: Set(), series: List(), deletion: NoDeletion,
  scope: ThisOccurrence, generation: 0, evidence: ""
}
pure def validWindow(window: ViewWindow): bool = window.fromTime < window.untilTime
pure def validStored(c: C::Calendar): bool =
  C::validState(c) and C::validIdentity(c.identity) and
  (c.phase == C::Editing or c.phase == C::Saved or c.phase == C::Deleted)
pure def entryAt(v: CalendarView, id: str): C::Calendar =
  val matches = v.entries.select(c => c.identity.owner == v.owner and c.identity.calendarId == v.calendarId and
    c.identity.occurrenceId == id and c.phase != C::Deleted)
  if (matches.length() == 1) matches.nthOr(0, C::initial) else C::initial
pure def hasEditing(v: CalendarView): bool = v.entries.some(c => c.phase == C::Editing)
pure val noSeries: SeriesDefinition = { version: -1, details: C::noDetails }
pure def sameSeriesFields(a: C::EntryDetails, b: C::EntryDetails): bool =
  a.title == b.title and a.location == b.location and a.participant == b.participant and a.notes == b.notes and
  a.timezone == b.timezone and a.allDay == b.allDay and a.seriesId == b.seriesId and a.recurrence == b.recurrence and
  a.reminderEnabled == b.reminderEnabled and a.leadTime == b.leadTime
pure def seriesAt(v: CalendarView, id: str): SeriesDefinition =
  v.series.select(s => s.details.seriesId == id).nthOr(0, noSeries)
pure def putSeries(definitions: List[SeriesDefinition], definition: SeriesDefinition): List[SeriesDefinition] =
  definitions.select(s => s.details.seriesId != definition.details.seriesId).append(definition)
pure def canOpenCalendar(v: CalendarView, owner: str, calendarId: str, timezone: str, by: ViewActor): bool =
  by == ViewUser and owner != "" and calendarId != "" and timezone != "" and (not(hasEditing(v)) or not(v.opened)) and
  (v.owner == "" or (v.owner == owner and v.calendarId == calendarId and v.timezone == timezone))
pure def openCalendar(v: CalendarView, owner: str, calendarId: str, timezone: str, by: ViewActor): CalendarView =
  { ...v, owner: owner, calendarId: calendarId, timezone: timezone, opened: true,
    selectedId: if (hasEditing(v) or v.deletion == DeletionPending or v.deletion == DeletionFailed) v.selectedId else "",
    deletion: if (v.deletion == DeletionPending or v.deletion == DeletionFailed) v.deletion else NoDeletion }
pure def canPublishOccurrence(v: CalendarView, incoming: C::Calendar, seriesVersion: int, scheduleVerified: bool, by: ViewActor): bool =
  by == ViewStore and v.owner != "" and v.calendarId != "" and v.timezone != "" and
  v.deletion != DeletionPending and not(hasEditing(v)) and validStored(incoming) and
  incoming.identity.owner == v.owner and incoming.identity.calendarId == v.calendarId and
  not(v.cancelledIds.contains(incoming.identity.occurrenceId)) and
  C::admissibleOccurrence(v.entries, incoming) and scheduleVerified and
  (incoming.committed.seriesId == "" or
    (if (seriesAt(v, incoming.committed.seriesId).version == -1) seriesVersion == 0
     else seriesVersion == seriesAt(v, incoming.committed.seriesId).version and
       sameSeriesFields(incoming.committed, seriesAt(v, incoming.committed.seriesId).details) and
       (incoming.phase == C::Deleted or seriesAt(v, incoming.committed.seriesId).details.recurrence != C::Once or
         (incoming.committed.startAt == seriesAt(v, incoming.committed.seriesId).details.startAt and
          v.entries.every(c => c.phase == C::Deleted or c.committed.seriesId != incoming.committed.seriesId or
            c.identity.occurrenceId == incoming.identity.occurrenceId))))) and
  (incoming.phase == C::Deleted or not(v.deletedSeries.contains(incoming.committed.seriesId)))
pure def publishOccurrence(v: CalendarView, incoming: C::Calendar, seriesVersion: int, scheduleVerified: bool, by: ViewActor): CalendarView =
  val targetChanged = v.selectedId == incoming.identity.occurrenceId and entryAt(v, v.selectedId) != incoming
  { ...v, entries: C::upsertOccurrence(v.entries, incoming),
    series: if (incoming.committed.seriesId != "" and seriesAt(v, incoming.committed.seriesId).version == -1)
      putSeries(v.series, { version: 0, details: incoming.committed }) else v.series,
    selectedId: if (targetChanged and (incoming.phase == C::Deleted or not(v.opened))) "" else v.selectedId,
    deletion: if (targetChanged) NoDeletion else v.deletion }
pure def alwaysViewIdentity(v: CalendarView): bool =
  (v.opened or v.entries.length() > 0 or v.series.length() > 0) implies (v.owner != "" and v.calendarId != "" and v.timezone != "")
pure def alwaysViewWindow(v: CalendarView): bool = validWindow(v.window) and v.generation >= 0
pure def alwaysEntriesBelongToCalendar(v: CalendarView): bool =
  v.entries.every(c => validStored(c) and c.identity.owner == v.owner and c.identity.calendarId == v.calendarId)
pure def alwaysOccurrenceIsUnique(v: CalendarView): bool =
  v.entries.every(c => v.entries.select(other => C::sameOccurrence(c, other)).length() == 1)
pure def alwaysEditingIsSelected(v: CalendarView): bool =
  v.entries.every(c => c.phase == C::Editing implies
    ((v.opened or c.approvedRevision != -1 or c.storageError == C::SaveFailure) and
      c.identity.occurrenceId == v.selectedId and v.deletion == NoDeletion))
pure def alwaysCancelledIdsAreAbsent(v: CalendarView): bool =
  v.entries.every(c => not(v.cancelledIds.contains(c.identity.occurrenceId)))
pure def alwaysSeriesDefinitions(v: CalendarView): bool =
  v.series.every(s => s.version >= 0 and s.details.seriesId != "" and C::validDetails(s.details) and
    v.series.select(other => other.details.seriesId == s.details.seriesId).length() == 1)
pure def alwaysEntriesUseSeries(v: CalendarView): bool =
  v.entries.every(c => (c.hasSaved and c.phase != C::Deleted and c.committed.seriesId != "") implies
    (seriesAt(v, c.committed.seriesId).version >= 0 and sameSeriesFields(c.committed, seriesAt(v, c.committed.seriesId).details)))
pure def stepOccurrenceIdentityIsFixed(before: CalendarView, after: CalendarView): bool =
  before.entries.every(prior => after.entries.every(laterEntry =>
    C::sameOccurrence(prior, laterEntry) implies prior.identity == laterEntry.identity))
pure def sometimesCalendarOpen(v: CalendarView): bool = v.opened
pure def lawUnrelatedImportKeepsSelection(v: CalendarView, incoming: C::Calendar, seriesVersion: int, scheduleVerified: bool, by: ViewActor): bool =
  incoming.identity.occurrenceId != v.selectedId implies
    (publishOccurrence(v, incoming, seriesVersion, scheduleVerified, by).selectedId == v.selectedId and
      publishOccurrence(v, incoming, seriesVersion, scheduleVerified, by).deletion == v.deletion)
```

### Navigation clears detail and only accepts a validated calendar interval

Selecting a day from Month opens its Week, as in the prototype. Today selects
the adapter's current local day. Moving a week preserves weekday selection;
moving a month preserves the selected day until the user chooses another date.
These calendar calculations arrive as validated reports; the host derives
`verified`, never the planner or untrusted page. Navigation does not modify
entries, reminders, bill identity or payment state.

```quint
pure def canNavigate(v: CalendarView, report: NavigationReport, by: ViewActor): bool =
  by == ViewUser and v.opened and v.deletion != DeletionPending and not(hasEditing(v)) and report.verified and validWindow(report.window) and
  ((report.kind == Earlier and report.window.mode == v.window.mode and report.window.anchorDay < v.window.anchorDay) or
    (report.kind == Later and report.window.mode == v.window.mode and report.window.anchorDay > v.window.anchorDay) or
    (report.kind == SelectDay and report.window.mode == WeekView and report.window.anchorDay == report.window.selectedDay) or
    (report.kind == Today and report.window.anchorDay == report.window.selectedDay) or
    (report.kind == SwitchMode and report.window.mode != v.window.mode and report.window.selectedDay == v.window.selectedDay))
pure def navigate(v: CalendarView, report: NavigationReport, by: ViewActor): CalendarView =
  { ...v, window: report.window, selectedId: "", deletion: NoDeletion }
pure def canOpenOccurrence(v: CalendarView, id: str, by: ViewActor): bool =
  by == ViewUser and v.opened and v.deletion != DeletionPending and not(hasEditing(v)) and entryAt(v, id).hasSaved
pure def openOccurrence(v: CalendarView, id: str, by: ViewActor): CalendarView =
  { ...v, selectedId: id, deletion: NoDeletion }
pure def canBackToCalendar(v: CalendarView, by: ViewActor): bool =
  by == ViewUser and v.opened and v.selectedId != "" and v.deletion != DeletionPending and not(hasEditing(v))
pure def backToCalendar(v: CalendarView, by: ViewActor): CalendarView =
  { ...v, selectedId: "", deletion: NoDeletion }
pure def visibleOccurrences(v: CalendarView): List[C::Calendar] =
  C::visibleEntries(v.entries, v.owner, v.calendarId, v.window.fromTime, v.window.untilTime)
pure def selectedOccurrence(v: CalendarView): C::Calendar = entryAt(v, v.selectedId)
pure def alwaysSelectionIsCurrent(v: CalendarView): bool =
  v.selectedId != "" implies
    ((v.opened or v.deletion == DeletionPending or v.deletion == DeletionFailed or
      (selectedOccurrence(v).phase == C::Editing and
        (selectedOccurrence(v).approvedRevision != -1 or selectedOccurrence(v).storageError == C::SaveFailure))) and
      selectedOccurrence(v).phase != C::Empty)
pure def sometimesMonth(v: CalendarView): bool = v.window.mode == MonthView
pure def sometimesDetail(v: CalendarView): bool = v.selectedId != ""
```

## Story: Edit the selected occurrence and receive its reminders

> As a user, I want the event I edit, save, snooze or dismiss to be the same
> event I see in my calendar, without a second stale copy continuing its work.

### Owned occurrence actions preserve one identity and one reminder lifecycle

Discovered by ownership review: publishing complete snapshots could not carry
same-revision reminder progress, while keeping a separate occurrence machine
would leave reminders alive after collection deletion. All live occurrence
changes now apply to the collection's actual row. Only validated durable
imports use publishing, which preserves the complete established identity,
including a bill's source and invoice reference.

The selected form owns the one active edit. Save and Cancel finish that edit
before navigation or another form can replace it; the UI's Back from a form
uses Cancel. Saved committed fields remain visible in previews while editing.
New unsaved entries disappear on Cancel and retire their occurrence IDs, so an
old save callback cannot target a new draft with the same ID. Store acknowledgments name the current
approved revision, and clock events target the canonical occurrence ID rather
than a captured state. Reminder changes need no artificial content revision.

```quint
type EntrySeed = { identity: C::EntryIdentity, details: C::EntryDetails }
type OccurrenceAction = BeginEditing | ChangeDetails({ details: C::EntryDetails }) | CancelEditing |
  ApproveEntry({ revision: int }) | EntryStored({ revision: int, succeeded: bool }) |
  AdvanceClock({ now: int }) | ShowDueReminder | SnoozeReminder({ until: int }) | DismissReminder
pure def mayChangeEntry(c: C::Calendar, command: OccurrenceAction, by: ViewActor): bool = match command {
  | BeginEditing => by == ViewUser and C::canBeginEdit(c, C::CalendarUser)
  | ChangeDetails(_) => by == ViewUser and C::canEdit(c, C::CalendarUser)
  | CancelEditing => by == ViewUser and C::canCancelEdit(c, C::CalendarUser)
  | ApproveEntry(request) => by == ViewUser and C::canApproveSave(c, request.revision, C::CalendarUser)
  | EntryStored(report) => by == ViewStore and
      (if (report.succeeded) C::canSave(c, report.revision, true, C::CalendarStore)
       else C::canSaveFailed(c, report.revision, C::CalendarStore))
  | AdvanceClock(request) => by == ViewClock and C::canAdvanceTime(c, request.now, C::CalendarClock)
  | ShowDueReminder => by == ViewClock and C::canShowReminder(c, C::CalendarClock)
  | SnoozeReminder(request) => by == ViewUser and C::canSnooze(c, request.until, C::CalendarUser)
  | DismissReminder => by == ViewUser and C::canDismissReminder(c, C::CalendarUser)
}
pure def changeEntry(c: C::Calendar, command: OccurrenceAction): C::Calendar = match command {
  | BeginEditing => C::beginEdit(c, C::CalendarUser)
  | ChangeDetails(request) => C::edit(c, request.details, C::CalendarUser)
  | CancelEditing => C::cancelEdit(c, C::CalendarUser)
  | ApproveEntry(request) => C::approveSave(c, request.revision, C::CalendarUser)
  | EntryStored(report) => if (report.succeeded) C::save(c, report.revision, true, C::CalendarStore)
      else C::saveFailed(c, report.revision, C::CalendarStore)
  | AdvanceClock(request) => C::advanceTime(c, request.now, C::CalendarClock)
  | ShowDueReminder => C::showReminder(c, C::CalendarClock)
  | SnoozeReminder(request) => C::snooze(c, request.until, C::CalendarUser)
  | DismissReminder => C::dismissReminder(c, C::CalendarUser)
}
pure def ownedEntryResult(v: CalendarView, c: C::Calendar, command: OccurrenceAction): C::Calendar =
  match command {
    | BeginEditing => if (c.committed.seriesId != "")
        { ...C::beginEdit(c, C::CalendarUser), draft: seriesAt(v, c.committed.seriesId).details }
      else C::beginEdit(c, C::CalendarUser)
    | _ => changeEntry(c, command)
  }
pure def canCreateOccurrence(v: CalendarView, entry: EntrySeed, by: ViewActor): bool =
  by == ViewUser and v.opened and v.deletion == NoDeletion and not(hasEditing(v)) and
  C::canCreate(C::initial, entry.identity, C::CalendarUser) and
  entry.identity.owner == v.owner and entry.identity.calendarId == v.calendarId and
  not(v.cancelledIds.contains(entry.identity.occurrenceId)) and
  v.entries.every(c => c.identity.occurrenceId != entry.identity.occurrenceId) and
  (entry.details.seriesId == "" or seriesAt(v, entry.details.seriesId).version == -1) and
  not(v.deletedSeries.contains(entry.details.seriesId))
pure def createOccurrence(v: CalendarView, entry: EntrySeed, by: ViewActor): CalendarView =
  { ...v, entries: v.entries.append(C::create(C::initial, entry.identity, entry.details, C::CalendarUser)),
    selectedId: entry.identity.occurrenceId }
pure def canChangeOccurrence(v: CalendarView, id: str, command: OccurrenceAction, by: ViewActor): bool =
  val c = entryAt(v, id)
  c.phase != C::Empty and v.deletion == NoDeletion and
  (by != ViewUser or (v.opened and v.selectedId == id and c.approvedRevision == -1)) and mayChangeEntry(c, command, by) and
  (match command {
    | ChangeDetails(request) => not(v.deletedSeries.contains(request.details.seriesId)) and
        (if (c.hasSaved and c.committed.seriesId != "") request.details.seriesId == c.committed.seriesId
         else request.details.seriesId == "" or seriesAt(v, request.details.seriesId).version == -1)
    | EntryStored(_) => c.committed.seriesId == "" and c.draft.seriesId == "" and c.draft.recurrence == C::Once
    | _ => true
  })
pure def changeOccurrence(v: CalendarView, id: str, command: OccurrenceAction, by: ViewActor): CalendarView =
  val updated = ownedEntryResult(v, entryAt(v, id), command)
  { ...v, entries: if (updated.phase == C::Empty) v.entries.select(c => c.identity.occurrenceId != id)
      else v.entries.listMap(c => if (c.identity.occurrenceId == id) updated else c),
    cancelledIds: if (updated.phase == C::Empty) v.cancelledIds.union(Set(id)) else v.cancelledIds,
    selectedId: if (v.selectedId == id and (updated.phase == C::Empty or
      (not(v.opened) and updated.phase != C::Editing))) "" else v.selectedId }
pure def sometimesEntryEditing(v: CalendarView): bool = hasEditing(v)
pure def sometimesUnsavedEntryCancelled(v: CalendarView): bool = v.cancelledIds.size() > 0
pure def sometimesEntrySaveFailed(v: CalendarView): bool = v.entries.some(c => c.storageError == C::SaveFailure)
pure def sometimesOwnedReminderShown(v: CalendarView): bool = v.entries.some(c => c.reminder == C::ReminderShown)
pure def sometimesOwnedReminderDismissed(v: CalendarView): bool = v.entries.some(c => c.reminder == C::ReminderDismissed)
```

### Saving a repeating event updates its whole series through the same form

The prototype edits the recurring event, not an isolated repetition
(`Grace Prototype.html:1894,2165,2171`). The one form and one Save choice apply
to the series without an added scope question. Each series has one versioned
definition. Opening Edit uses that definition's original anchor date and
settings, as the prototype does, rather than silently moving the anchor to
the clicked repetition. Its title, location, notes, participant, timezone, repeat and
reminder settings project into every live occurrence. Each occurrence retains
its own immutable identity, invoice source and deletion tombstone. Saving an
updated occurrence resets its reminder from the newly committed schedule.

The calendar adapter expands the changed definition into a complete schedule
for all materialized live members. Its validated report identifies every such
member exactly once, including those removed by changed dates or repetition.
The selected occurrence remains and matches the form's instants. Choosing Never
retains only that selected occurrence; other repetitions become tombstones.
Real local dates, skipped short months and DST resolution use the same calendar
rules described in Calendar; they are not calculated by adding fixed seconds.

A storage transaction commits the definition and all members together. Its
receipt binds the selected occurrence ID, draft revision and previous series version.
Failure changes no committed definition or other member and leaves the form
recoverable. A stale or partial receipt cannot apply. Future materialization
must carry the current definition version, matching shared fields and validated
instants; an older schedule cannot recreate a removed occurrence.

```quint
type OccurrenceSchedule = { id: str, include: bool, startAt: int, endAt: int }
type SeriesReceipt = {
  occurrenceId: str, revision: int, definitionVersion: int, schedules: List[OccurrenceSchedule], verified: bool, persisted: bool
}
pure val noSchedule: OccurrenceSchedule = { id: "", include: false, startAt: 0, endAt: 0 }
pure def scheduleFor(schedules: List[OccurrenceSchedule], id: str): OccurrenceSchedule =
  schedules.select(s => s.id == id).nthOr(0, noSchedule)
pure def seriesTarget(v: CalendarView): str = selectedOccurrence(v).draft.seriesId
pure def seriesMemberAffected(v: CalendarView, c: C::Calendar): bool =
  c.phase != C::Deleted and
  (c.identity.occurrenceId == v.selectedId or
    (c.hasSaved and c.committed.seriesId == seriesTarget(v)))
pure def validSeriesSchedule(v: CalendarView, receipt: SeriesReceipt): bool =
  receipt.verified and receipt.schedules.every(s => s.id != "" and
    receipt.schedules.select(other => other.id == s.id).length() == 1 and
    v.entries.some(c => c.identity.occurrenceId == s.id and seriesMemberAffected(v, c)) and
    (s.include implies s.endAt > s.startAt) and
    ((selectedOccurrence(v).draft.recurrence == C::Once and s.id != v.selectedId) implies not(s.include))) and
  v.entries.every(c => seriesMemberAffected(v, c) implies
    receipt.schedules.some(s => s.id == c.identity.occurrenceId)) and
  scheduleFor(receipt.schedules, v.selectedId).include and
  scheduleFor(receipt.schedules, v.selectedId).startAt == selectedOccurrence(v).draft.startAt and
  scheduleFor(receipt.schedules, v.selectedId).endAt == selectedOccurrence(v).draft.endAt
pure def seriesMemberResult(v: CalendarView, c: C::Calendar, receipt: SeriesReceipt): C::Calendar =
  val schedule = scheduleFor(receipt.schedules, c.identity.occurrenceId)
  val details = { ...selectedOccurrence(v).draft, startAt: schedule.startAt, endAt: schedule.endAt }
  val editing = C::edit(C::beginEdit(c, C::CalendarUser), details, C::CalendarUser)
  if (not(seriesMemberAffected(v, c))) c
  else if (not(receipt.persisted))
    (if (c.identity.occurrenceId == v.selectedId) C::saveFailed(c, receipt.revision, C::CalendarStore) else c)
  else if (not(scheduleFor(receipt.schedules, c.identity.occurrenceId).include)) deletedOccurrence(c)
  else if (c.identity.occurrenceId == v.selectedId) C::save(c, receipt.revision, true, C::CalendarStore)
  else C::save(C::approveSave(editing, editing.revision, C::CalendarUser), editing.revision, true, C::CalendarStore)
pure def canSaveSeries(v: CalendarView, receipt: SeriesReceipt, by: ViewActor): bool =
  by == ViewStore and v.deletion == NoDeletion and v.selectedId != "" and receipt.occurrenceId == v.selectedId and
  seriesTarget(v) != "" and not(v.deletedSeries.contains(seriesTarget(v))) and
  C::canSaveFailed(selectedOccurrence(v), receipt.revision, C::CalendarStore) and
  C::validDetails(selectedOccurrence(v).draft) and
  receipt.definitionVersion == seriesAt(v, seriesTarget(v)).version and
  (not(receipt.persisted) or validSeriesSchedule(v, receipt))
pure def saveSeries(v: CalendarView, receipt: SeriesReceipt, by: ViewActor): CalendarView = {
  ...v, entries: v.entries.listMap(c => seriesMemberResult(v, c, receipt)),
  selectedId: if (not(v.opened) and receipt.persisted) "" else v.selectedId,
  series: if (receipt.persisted) putSeries(v.series,
    { version: receipt.definitionVersion + 1, details: selectedOccurrence(v).draft }) else v.series
}
pure def lawStaleSeriesReceiptCannotSave(v: CalendarView, receipt: SeriesReceipt, by: ViewActor): bool =
  (receipt.occurrenceId != v.selectedId or receipt.definitionVersion != seriesAt(v, seriesTarget(v)).version) implies
    not(canSaveSeries(v, receipt, by))
pure def lawPartialSeriesReceiptCannotSave(v: CalendarView, receipt: SeriesReceipt, by: ViewActor): bool =
  receipt.persisted and not(validSeriesSchedule(v, receipt)) implies not(canSaveSeries(v, receipt, by))
pure def sometimesSeriesEdited(v: CalendarView): bool = v.series.some(s => s.version > 0)
pure def sometimesSeriesStopped(v: CalendarView): bool = v.series.some(s => s.details.recurrence == C::Once)
```

### Closing Calendar cancels unsubmitted edits and retains submitted writes

Close follows the prototype's existing behavior (`Grace Prototype.html:2156`):
cancel an unapproved form, clear detail and the deletion question, and return Home.
A never-saved occurrence is removed and its ID retired; an existing occurrence
keeps its committed data. This is the owning Calendar route the shell invokes
before leaving the app. Close hides a pending deletion while retaining its
target, generation and status for the real acknowledgment. A failed result can
be shown when the calendar reopens; closing never pretends cancellation or
requires the person to wait for storage. An approved save likewise retains its
exact selected revision while hidden; editing, cancellation and duplicate Save
are disabled until its result arrives. A hidden successful save clears detail;
a failed save retains its draft and error for reopening. Approval is the point
where the host submits the durable write, so Close cannot pretend to undo it.

```quint
pure def canCloseCalendar(v: CalendarView, by: ViewActor): bool =
  by == ViewUser and v.opened
pure def closeCalendar(v: CalendarView, by: ViewActor): CalendarView =
  val submitted = selectedOccurrence(v).phase == C::Editing and selectedOccurrence(v).approvedRevision != -1
  val cancelled = if (hasEditing(v) and not(submitted)) changeOccurrence(v, v.selectedId, CancelEditing, by) else v
  { ...cancelled, opened: false,
    selectedId: if (submitted or v.deletion == DeletionPending) v.selectedId else "",
    deletion: if (v.deletion == DeletionPending) DeletionPending else NoDeletion }
pure def lawClosingKeepsSubmittedSave(v: CalendarView, by: ViewActor): bool =
  (selectedOccurrence(v).phase == C::Editing and selectedOccurrence(v).approvedRevision != -1) implies
    (closeCalendar(v, by).entries == v.entries and closeCalendar(v, by).selectedId == v.selectedId)
pure def sometimesHiddenSave(v: CalendarView): bool =
  not(v.opened) and selectedOccurrence(v).phase == C::Editing and selectedOccurrence(v).approvedRevision != -1
pure def sometimesCalendarClosed(v: CalendarView): bool = not(v.opened) and v.owner != ""
```

## Story: Delete this occurrence or the whole repeating event

> As a user, I want Keep it to do nothing, Delete only this one to preserve the
> rest of the series and Delete every one to stop the series from coming back.

### The deletion question binds its selected occurrence and explicit scope

The first Delete opens the prototype's question. Choosing one or all is the
single final approval. Nonrepeating entries offer only this occurrence. The
store persists the exact request generation before success is displayed; failed
storage retains the selected entry and lets the user choose again. Navigating
or publishing another row cannot change a pending target.
Discovered by the proof: a pending or failed whole-series deletion retains a
recurring selected event. Without that fact an arbitrary pending state could
treat a nonrepeating event's empty series ID as a deleted series.

```quint
pure def canRequestDeletion(v: CalendarView, by: ViewActor): bool =
  by == ViewUser and v.opened and v.selectedId != "" and v.deletion == NoDeletion and not(hasEditing(v))
pure def requestDeletion(v: CalendarView, by: ViewActor): CalendarView =
  { ...v, deletion: DeletionQuestion, scope: ThisOccurrence, evidence: "" }
pure def canKeepOccurrence(v: CalendarView, by: ViewActor): bool =
  by == ViewUser and v.opened and (v.deletion == DeletionQuestion or v.deletion == DeletionFailed)
pure def keepOccurrence(v: CalendarView, by: ViewActor): CalendarView = { ...v, deletion: NoDeletion }
pure def canApproveDeletion(v: CalendarView, scope: DeleteScope, by: ViewActor): bool =
  by == ViewUser and v.opened and (v.deletion == DeletionQuestion or v.deletion == DeletionFailed) and
  (scope == ThisOccurrence or selectedOccurrence(v).committed.recurrence != C::Once)
pure def approveDeletion(v: CalendarView, scope: DeleteScope, by: ViewActor): CalendarView =
  { ...v, deletion: DeletionPending, scope: scope, generation: v.generation + 1, evidence: "" }
pure def deleteMatches(v: CalendarView, c: C::Calendar): bool =
  c.identity.occurrenceId == v.selectedId or
    (v.scope == EntireSeries and c.committed.seriesId == selectedOccurrence(v).committed.seriesId)
pure def deletedOccurrence(c: C::Calendar): C::Calendar =
  if (c.phase == C::Deleted) c else
    C::confirmDelete(C::approveDelete(C::requestDelete(c, C::CalendarUser), C::CalendarUser), true, C::CalendarStore)
pure def canDeletionResult(v: CalendarView, generation: int, evidence: str, by: ViewActor): bool =
  by == ViewStore and v.deletion == DeletionPending and generation == v.generation and evidence != ""
pure def deletionResult(v: CalendarView, generation: int, succeeded: bool, evidence: str, by: ViewActor): CalendarView =
  { ...v, entries: if (succeeded) v.entries.listMap(c => if (deleteMatches(v, c)) deletedOccurrence(c) else c) else v.entries,
    deletedSeries: if (succeeded and v.scope == EntireSeries)
      v.deletedSeries.union(Set(selectedOccurrence(v).committed.seriesId)) else v.deletedSeries,
    selectedId: if (succeeded) "" else v.selectedId,
    deletion: if (succeeded) NoDeletion else DeletionFailed, evidence: evidence }
pure def alwaysDeletionHasSelection(v: CalendarView): bool =
  v.deletion != NoDeletion implies v.selectedId != ""
pure def alwaysSeriesDeletionIsRecurring(v: CalendarView): bool =
  (v.deletion != NoDeletion and v.scope == EntireSeries) implies
    selectedOccurrence(v).committed.recurrence != C::Once
pure def alwaysDeletedSeriesStayDeleted(v: CalendarView): bool =
  v.entries.every(c => v.deletedSeries.contains(c.committed.seriesId) implies c.phase == C::Deleted)
pure def alwaysDeletedSeriesIdsAreNonempty(v: CalendarView): bool =
  not(v.deletedSeries.contains(""))
pure def lawOneDeletionLeavesOtherOccurrences(v: CalendarView, c: C::Calendar): bool =
  v.scope == ThisOccurrence and c.identity.occurrenceId != v.selectedId implies not(deleteMatches(v, c))
pure def sometimesSeriesDeleted(v: CalendarView): bool = v.deletedSeries.size() > 0
pure def sometimesDeletionFailed(v: CalendarView): bool = v.deletion == DeletionFailed
```

### Samples exercise ordinary and recurring entries without limiting real dates

```quint
pure val ownerValues = Set("", "ownerA", "ownerB")
pure val calendarIdValues = Set("", "calendarA")
pure val timezoneValues = Set("", "America/New_York")
pure val idValues = Set("", "visitA", "periodA", "seriesA", "missing")
pure val incomingValues = C::cValues
pure val reportValues = Set(
  { window: { ...emptyWindow, anchorDay: 7, selectedDay: 7, fromTime: 0, untilTime: 10 }, kind: Later, verified: true },
  { window: { ...emptyWindow, anchorDay: -7, selectedDay: -7, fromTime: -10, untilTime: 0 }, kind: Earlier, verified: true },
  { window: emptyWindow, kind: Today, verified: true },
  { window: { ...emptyWindow, mode: MonthView }, kind: SwitchMode, verified: true },
  { window: { ...emptyWindow, anchorDay: 3, selectedDay: 3 }, kind: SelectDay, verified: true },
  { window: emptyWindow, kind: Today, verified: false })
pure val evidenceValues = Set("", "storeReceipt")
pure val vValues = Set(initial)
pure val cValues = C::cValues
pure val entryValues = Set(
  { identity: C::appointmentIdentity, details: C::timedDetails },
  { identity: C::billIdentity, details: C::repeatingDetails })
pure val commandValues = Set(BeginEditing, ChangeDetails({ details: C::timedDetails }), ChangeDetails({ details: C::repeatingDetails }), CancelEditing,
  ChangeDetails({ details: { ...C::repeatingDetails, recurrence: C::Once } }),
  ApproveEntry({ revision: 1 }), ApproveEntry({ revision: 2 }), ApproveEntry({ revision: 3 }), ApproveEntry({ revision: 4 }),
  EntryStored({ revision: 1, succeeded: true }), EntryStored({ revision: 2, succeeded: true }),
  EntryStored({ revision: 3, succeeded: true }), EntryStored({ revision: 4, succeeded: true }),
  EntryStored({ revision: 1, succeeded: false }), EntryStored({ revision: 2, succeeded: false }),
  AdvanceClock({ now: 3 }), AdvanceClock({ now: 5 }), AdvanceClock({ now: 8 }), ShowDueReminder, SnoozeReminder({ until: 7 }), DismissReminder)
pure val seriesVersionValues = Set(-1, 0, 1, 2)
pure val receiptValues = Set(
  { occurrenceId: "periodA", revision: 1, definitionVersion: -1, schedules: List({ id: "periodA", include: true, startAt: 5, endAt: 6 }), verified: true, persisted: true },
  { occurrenceId: "periodA", revision: 2, definitionVersion: 0, schedules: List({ id: "periodA", include: true, startAt: 5, endAt: 6 }), verified: true, persisted: true },
  { occurrenceId: "periodA", revision: 3, definitionVersion: 0, schedules: List({ id: "periodA", include: true, startAt: 5, endAt: 6 }), verified: true, persisted: true },
  { occurrenceId: "periodA", revision: 2, definitionVersion: 0, schedules: List({ id: "periodA", include: true, startAt: 5, endAt: 6 }, { id: "visitA", include: true, startAt: 5, endAt: 6 }), verified: true, persisted: true },
  { occurrenceId: "periodA", revision: 3, definitionVersion: 0, schedules: List({ id: "periodA", include: true, startAt: 5, endAt: 6 }, { id: "visitA", include: false, startAt: 5, endAt: 6 }), verified: true, persisted: true },
  { occurrenceId: "periodA", revision: 4, definitionVersion: 1, schedules: List({ id: "periodA", include: true, startAt: 5, endAt: 6 }), verified: true, persisted: true },
  { occurrenceId: "visitA", revision: 1, definitionVersion: -1, schedules: List({ id: "visitA", include: true, startAt: 5, endAt: 6 }), verified: true, persisted: true },
  { occurrenceId: "visitA", revision: 3, definitionVersion: -1, schedules: List({ id: "visitA", include: true, startAt: 5, endAt: 6 }), verified: true, persisted: true },
  { occurrenceId: "periodA", revision: 1, definitionVersion: -1, schedules: List(), verified: false, persisted: false },
  { occurrenceId: "periodA", revision: 2, definitionVersion: 0, schedules: List(), verified: false, persisted: false },
  { occurrenceId: "periodA", revision: 1, definitionVersion: -1, schedules: List(), verified: true, persisted: true })
pure val weight_publishOccurrence = 5
pure val weight_openOccurrence = 5
pure val weight_deletionResult = 5
pure val weight_requestDeletion = 5
pure val weight_keepOccurrence = 5
pure val weight_approveDeletion = 5
pure val weight_changeOccurrence = 8
pure val weight_saveSeries = 6
```

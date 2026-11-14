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
type CalendarView = {
  owner: str, calendarId: str, timezone: str, opened: bool, window: ViewWindow,
  entries: List[C::Calendar], selectedId: str, deletedSeries: Set[str], cancelledIds: Set[str],
  deletion: DeleteStatus, scope: DeleteScope, generation: int, evidence: str
}
pure val emptyWindow: ViewWindow = { mode: WeekView, anchorDay: 0, selectedDay: 0, fromTime: 0, untilTime: 1 }
pure val initial: CalendarView = {
  owner: "", calendarId: "", timezone: "", opened: false, window: emptyWindow,
  entries: List(), selectedId: "", deletedSeries: Set(), cancelledIds: Set(), deletion: NoDeletion,
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
pure def canOpenCalendar(v: CalendarView, owner: str, calendarId: str, timezone: str, by: ViewActor): bool =
  by == ViewUser and owner != "" and calendarId != "" and timezone != "" and v.deletion != DeletionPending and not(hasEditing(v)) and
  (v.owner == "" or (v.owner == owner and v.calendarId == calendarId and v.timezone == timezone))
pure def openCalendar(v: CalendarView, owner: str, calendarId: str, timezone: str, by: ViewActor): CalendarView =
  { ...v, owner: owner, calendarId: calendarId, timezone: timezone, opened: true,
    selectedId: "", deletion: NoDeletion }
pure def canPublishOccurrence(v: CalendarView, incoming: C::Calendar, by: ViewActor): bool =
  by == ViewStore and v.owner != "" and v.calendarId != "" and v.timezone != "" and
  v.deletion != DeletionPending and not(hasEditing(v)) and validStored(incoming) and
  incoming.identity.owner == v.owner and incoming.identity.calendarId == v.calendarId and
  not(v.cancelledIds.contains(incoming.identity.occurrenceId)) and
  C::admissibleOccurrence(v.entries, incoming) and
  (incoming.phase == C::Deleted or not(v.deletedSeries.contains(incoming.committed.seriesId)))
pure def publishOccurrence(v: CalendarView, incoming: C::Calendar, by: ViewActor): CalendarView =
  val targetChanged = v.selectedId == incoming.identity.occurrenceId and entryAt(v, v.selectedId) != incoming
  { ...v, entries: C::upsertOccurrence(v.entries, incoming),
    selectedId: if (targetChanged and incoming.phase == C::Deleted) "" else v.selectedId,
    deletion: if (targetChanged) NoDeletion else v.deletion }
pure def alwaysViewIdentity(v: CalendarView): bool =
  (v.opened or v.entries.length() > 0) implies (v.owner != "" and v.calendarId != "" and v.timezone != "")
pure def alwaysViewWindow(v: CalendarView): bool = validWindow(v.window) and v.generation >= 0
pure def alwaysEntriesBelongToCalendar(v: CalendarView): bool =
  v.entries.every(c => validStored(c) and c.identity.owner == v.owner and c.identity.calendarId == v.calendarId)
pure def alwaysOccurrenceIsUnique(v: CalendarView): bool =
  v.entries.every(c => v.entries.select(other => C::sameOccurrence(c, other)).length() == 1)
pure def alwaysEditingIsSelected(v: CalendarView): bool =
  v.entries.every(c => c.phase == C::Editing implies
    (v.opened and c.identity.occurrenceId == v.selectedId and v.deletion == NoDeletion))
pure def alwaysCancelledIdsAreAbsent(v: CalendarView): bool =
  v.entries.every(c => not(v.cancelledIds.contains(c.identity.occurrenceId)))
pure def stepOccurrenceIdentityIsFixed(before: CalendarView, after: CalendarView): bool =
  before.entries.every(prior => after.entries.every(laterEntry =>
    C::sameOccurrence(prior, laterEntry) implies prior.identity == laterEntry.identity))
pure def sometimesCalendarOpen(v: CalendarView): bool = v.opened
pure def lawUnrelatedImportKeepsSelection(v: CalendarView, incoming: C::Calendar, by: ViewActor): bool =
  incoming.identity.occurrenceId != v.selectedId implies
    (publishOccurrence(v, incoming, by).selectedId == v.selectedId and
      publishOccurrence(v, incoming, by).deletion == v.deletion)
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
  v.selectedId != "" implies (v.opened and selectedOccurrence(v).phase != C::Empty)
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
pure def canCreateOccurrence(v: CalendarView, entry: EntrySeed, by: ViewActor): bool =
  by == ViewUser and v.opened and v.deletion == NoDeletion and not(hasEditing(v)) and
  C::canCreate(C::initial, entry.identity, C::CalendarUser) and
  entry.identity.owner == v.owner and entry.identity.calendarId == v.calendarId and
  not(v.cancelledIds.contains(entry.identity.occurrenceId)) and
  v.entries.every(c => c.identity.occurrenceId != entry.identity.occurrenceId) and
  not(v.deletedSeries.contains(entry.details.seriesId))
pure def createOccurrence(v: CalendarView, entry: EntrySeed, by: ViewActor): CalendarView =
  { ...v, entries: v.entries.append(C::create(C::initial, entry.identity, entry.details, C::CalendarUser)),
    selectedId: entry.identity.occurrenceId }
pure def canChangeOccurrence(v: CalendarView, id: str, command: OccurrenceAction, by: ViewActor): bool =
  val c = entryAt(v, id)
  c.phase != C::Empty and v.deletion == NoDeletion and
  (by != ViewUser or (v.opened and v.selectedId == id)) and mayChangeEntry(c, command, by) and
  (match command {
    | ChangeDetails(request) => not(v.deletedSeries.contains(request.details.seriesId))
    | EntryStored(_) => not(v.deletedSeries.contains(c.draft.seriesId))
    | _ => true
  })
pure def changeOccurrence(v: CalendarView, id: str, command: OccurrenceAction, by: ViewActor): CalendarView =
  val updated = changeEntry(entryAt(v, id), command)
  { ...v, entries: if (updated.phase == C::Empty) v.entries.select(c => c.identity.occurrenceId != id)
      else v.entries.listMap(c => if (c.identity.occurrenceId == id) updated else c),
    cancelledIds: if (updated.phase == C::Empty) v.cancelledIds.union(Set(id)) else v.cancelledIds,
    selectedId: if (updated.phase == C::Empty and v.selectedId == id) "" else v.selectedId }
pure def sometimesEntryEditing(v: CalendarView): bool = hasEditing(v)
pure def sometimesUnsavedEntryCancelled(v: CalendarView): bool = v.cancelledIds.size() > 0
pure def sometimesEntrySaveFailed(v: CalendarView): bool = v.entries.some(c => c.storageError == C::SaveFailure)
pure def sometimesOwnedReminderShown(v: CalendarView): bool = v.entries.some(c => c.reminder == C::ReminderShown)
pure def sometimesOwnedReminderDismissed(v: CalendarView): bool = v.entries.some(c => c.reminder == C::ReminderDismissed)
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

```quint
pure def canRequestDeletion(v: CalendarView, by: ViewActor): bool =
  by == ViewUser and v.opened and v.selectedId != "" and v.deletion == NoDeletion and not(hasEditing(v))
pure def requestDeletion(v: CalendarView, by: ViewActor): CalendarView =
  { ...v, deletion: DeletionQuestion, scope: ThisOccurrence, evidence: "" }
pure def canKeepOccurrence(v: CalendarView, by: ViewActor): bool =
  by == ViewUser and (v.deletion == DeletionQuestion or v.deletion == DeletionFailed)
pure def keepOccurrence(v: CalendarView, by: ViewActor): CalendarView = { ...v, deletion: NoDeletion }
pure def canApproveDeletion(v: CalendarView, scope: DeleteScope, by: ViewActor): bool =
  by == ViewUser and (v.deletion == DeletionQuestion or v.deletion == DeletionFailed) and
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
pure def alwaysDeletedSeriesStayDeleted(v: CalendarView): bool =
  v.entries.every(c => v.deletedSeries.contains(c.committed.seriesId) implies c.phase == C::Deleted)
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
pure val idValues = Set("", "visitA", "periodA", "missing")
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
  ApproveEntry({ revision: 1 }), ApproveEntry({ revision: 2 }), ApproveEntry({ revision: 3 }), ApproveEntry({ revision: 4 }),
  EntryStored({ revision: 1, succeeded: true }), EntryStored({ revision: 2, succeeded: true }),
  EntryStored({ revision: 3, succeeded: true }), EntryStored({ revision: 4, succeeded: true }),
  EntryStored({ revision: 1, succeeded: false }), EntryStored({ revision: 2, succeeded: false }),
  AdvanceClock({ now: 3 }), AdvanceClock({ now: 5 }), AdvanceClock({ now: 8 }), ShowDueReminder, SnoozeReminder({ until: 7 }), DismissReminder)
pure val weight_publishOccurrence = 5
pure val weight_openOccurrence = 5
pure val weight_deletionResult = 5
pure val weight_changeOccurrence = 8
```

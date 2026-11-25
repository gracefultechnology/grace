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
this model: the form's Day and Time lists are the prototype's 21 days from
today and half hours from 7 am to 7 pm, plus the appointment's own day and
time, so a form never moves an appointment she did not move. Likewise Remind
me offers No, Day before and 1 hour before, plus the appointment's own
reminder when it is another, such as the 30 minutes before its company sent,
so saving never changes a reminder she did not change. UI sorts each day's rows by start time and shows their occurrence IDs.

## Story: Browse my calendar and open an exact occurrence

> As a user, I want to move through weeks and months, select a day, return to
> today and open the right saved event while drafts remain clearly unsaved.

### A calendar collection binds one owner and validates published occurrences

Discovered by the proof: publishing a persisted row requires the collection's
owner, calendar and display timezone to be bound first. An event's own timezone
cannot establish the collection's independently chosen display timezone.
A needs-sign-in report also requires a bound provider collection.

A new bill occurrence published into a series that already has live saved
members must pass Calendar's `followingAllowed` against each of them: it comes
later, keeps the series' settings, carries its own invoice reference and names
a source reference, so a recurring bill never reuses last month's invoice. Only
the invoice must differ; two months may cite the same source evidence.

A publish may add a new appointment row or refresh any row already present, but
it never adds a bill the calendar does not have: a new bill enters only through
the verified import below, which applies the same publishing checks.

```quint
import calendar as C from "./calendar"

type ViewActor = ViewUser | ViewStore | ViewClock | ViewConsent
type ViewMode = WeekView | MonthView
type Navigation = Today | Earlier | Later | SelectDay | SwitchMode
type ViewWindow = { mode: ViewMode, anchorDay: int, selectedDay: int, fromTime: int, untilTime: int }
type NavigationReport = { window: ViewWindow, kind: Navigation, verified: bool }
type DeleteScope = ThisOccurrence | EntireSeries
type DeleteStatus = NoDeletion | DeletionQuestion | DeletionPending | DeletionFailed
type SeriesDefinition = { version: int, details: C::EntryDetails }
type FormPicker = NoPicker | DayPicker | TimePicker
type CalendarView = {
  owner: str, calendarId: str, timezone: str, opened: bool, window: ViewWindow,
  entries: List[C::Calendar], selectedId: str, deletedSeries: Set[str], cancelledIds: Set[str],
  series: List[SeriesDefinition],
  deletion: DeleteStatus, scope: DeleteScope, generation: int, picker: FormPicker, feedNeedsSignIn: bool
}
pure val emptyWindow: ViewWindow = { mode: WeekView, anchorDay: 0, selectedDay: 0, fromTime: 0, untilTime: 1 }
pure val initial: CalendarView = {
  owner: "", calendarId: "", timezone: "", opened: false, window: emptyWindow,
  entries: List(), selectedId: "", deletedSeries: Set(), cancelledIds: Set(), series: List(), deletion: NoDeletion,
  scope: ThisOccurrence, generation: 0, picker: NoPicker, feedNeedsSignIn: false
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
  a.reminderEnabled == b.reminderEnabled and a.leadTime == b.leadTime and a.important == b.important
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
  publishAllowed(v, incoming, seriesVersion, scheduleVerified, by) and
  (incoming.identity.kind != C::Bill or v.entries.some(c => C::sameOccurrence(c, incoming)))
pure def publishAllowed(v: CalendarView, incoming: C::Calendar, seriesVersion: int, scheduleVerified: bool, by: ViewActor): bool =
  by == ViewStore and v.owner != "" and v.calendarId != "" and v.timezone != "" and
  v.deletion != DeletionPending and not(hasEditing(v)) and validStored(incoming) and
  incoming.identity.owner == v.owner and incoming.identity.calendarId == v.calendarId and
  not(v.cancelledIds.contains(incoming.identity.occurrenceId)) and
  C::admissibleOccurrence(v.entries, incoming) and scheduleVerified and followsSeries(v, incoming) and
  (incoming.committed.seriesId == "" or
    (if (seriesAt(v, incoming.committed.seriesId).version == -1) seriesVersion == 0
     else seriesVersion == seriesAt(v, incoming.committed.seriesId).version and
       sameSeriesFields(incoming.committed, seriesAt(v, incoming.committed.seriesId).details) and
       (incoming.phase == C::Deleted or seriesAt(v, incoming.committed.seriesId).details.recurrence != C::Once or
         (incoming.committed.startAt == seriesAt(v, incoming.committed.seriesId).details.startAt and
          v.entries.every(c => c.phase == C::Deleted or c.committed.seriesId != incoming.committed.seriesId or
            c.identity.occurrenceId == incoming.identity.occurrenceId))))) and
  (incoming.phase == C::Deleted or not(v.deletedSeries.contains(incoming.committed.seriesId)))
pure def followsSeries(v: CalendarView, incoming: C::Calendar): bool =
  incoming.identity.kind != C::Bill or incoming.phase == C::Deleted or incoming.committed.seriesId == "" or
  v.entries.some(c => C::sameOccurrence(c, incoming)) or
  v.entries.every(c => not(c.hasSaved) or c.phase == C::Deleted or c.committed.seriesId != incoming.committed.seriesId or
    C::followingAllowed(c, incoming.identity.occurrenceId, incoming.identity.billRef, incoming.identity.sourceRef, incoming.committed))
pure def publishOccurrence(v: CalendarView, incoming: C::Calendar, seriesVersion: int, scheduleVerified: bool, by: ViewActor): CalendarView =
  val targetChanged = v.selectedId == incoming.identity.occurrenceId and entryAt(v, v.selectedId) != incoming
  { ...v, entries: C::upsertOccurrence(v.entries, incoming),
    series: if (incoming.committed.seriesId != "" and seriesAt(v, incoming.committed.seriesId).version == -1)
      putSeries(v.series, { version: 0, details: incoming.committed }) else v.series,
    selectedId: if (targetChanged and (incoming.phase == C::Deleted or not(v.opened))) "" else v.selectedId,
    deletion: if (targetChanged) NoDeletion else v.deletion }
pure def alwaysViewIdentity(v: CalendarView): bool =
  ((v.opened or v.entries.length() > 0 or v.series.length() > 0) implies (v.owner != "" and v.calendarId != "" and v.timezone != "")) and
  (v.feedNeedsSignIn implies hasProviderFeed(v))
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
pure def lawPublishAddsNoBill(v: CalendarView, incoming: C::Calendar, seriesVersion: int, scheduleVerified: bool, by: ViewActor): bool =
  (incoming.identity.kind == C::Bill and not(v.entries.some(c => C::sameOccurrence(c, incoming)))) implies
    not(canPublishOccurrence(v, incoming, seriesVersion, scheduleVerified, by))
pure def lawUnrelatedImportKeepsSelection(v: CalendarView, incoming: C::Calendar, seriesVersion: int, scheduleVerified: bool, by: ViewActor): bool =
  incoming.identity.occurrenceId != v.selectedId implies
    (publishOccurrence(v, incoming, seriesVersion, scheduleVerified, by).selectedId == v.selectedId and
      publishOccurrence(v, incoming, seriesVersion, scheduleVerified, by).deletion == v.deletion)
```

### An account's calendar is bound by its store before Calendar opens

Each connected email account has its own calendar collection, beside the one
kept on the tablet. When the account is connected, its store binds the
collection to that account's owner, calendar and display timezone, so its
appointments are published, reach Home and Grace, and can receive an
appointment she agreed to before she ever opens Calendar. Binding opens
nothing and changes no row, selection or question. A collection is bound
once and never moves to another owner, calendar or timezone; after a restart
the store may bind it again with the same values, which changes nothing.

```quint
pure def canBindCalendar(v: CalendarView, owner: str, calendarId: str, timezone: str, by: ViewActor): bool =
  by == ViewStore and owner != "" and calendarId != "" and timezone != "" and
  (v.owner == "" or (v.owner == owner and v.calendarId == calendarId and v.timezone == timezone))
pure def bindCalendar(v: CalendarView, owner: str, calendarId: str, timezone: str, by: ViewActor): CalendarView =
  { ...v, owner: owner, calendarId: calendarId, timezone: timezone }
pure def lawBindingLeavesCalendarAsItWas(v: CalendarView, owner: str, calendarId: str, timezone: str, by: ViewActor): bool =
  val after = bindCalendar(v, owner, calendarId, timezone, by)
  after.opened == v.opened and after.window == v.window and after.entries == v.entries and
    after.selectedId == v.selectedId and after.deletion == v.deletion and after.generation == v.generation
pure def lawBoundCalendarStaysBound(v: CalendarView, owner: str, calendarId: str, timezone: str, by: ViewActor): bool =
  (v.owner != "" and canBindCalendar(v, owner, calendarId, timezone, by)) implies
    (owner == v.owner and calendarId == v.calendarId and timezone == v.timezone)
pure def sometimesSavedWhileClosed(v: CalendarView): bool = not(v.opened) and v.entries.some(c => c.hasSaved)
```

### A provider calendar remembers when its feed needs sign-in

The store records when the bound provider calendar's feed reports that its
account needs sign-in. A successful feed read clears that report, even if no
appointments came back. An outage or other failure leaves the report as it
was. The report does not change any appointment or authorize an account, and
the tablet's own calendar never needs sign-in. The store reports only the
result of a fetch for the same account and sign-in attempt while Calendar is
still enabled.

```quint
pure def hasProviderFeed(v: CalendarView): bool =
  v.owner != "" and v.calendarId != "" and v.timezone != "" and v.calendarId != tabletCalendarId
pure def canReportFeedSignIn(v: CalendarView, needsSignIn: bool, by: ViewActor): bool =
  by == ViewStore and hasProviderFeed(v) and needsSignIn != v.feedNeedsSignIn
pure def reportFeedSignIn(v: CalendarView, needsSignIn: bool, by: ViewActor): CalendarView =
  { ...v, feedNeedsSignIn: needsSignIn }
pure def sometimesFeedNeedsSignIn(v: CalendarView): bool = v.feedNeedsSignIn
```

### Navigation clears detail and only accepts a validated calendar interval

Selecting a day from Month opens its Week, as in the prototype. Today selects
the adapter's current local day. Moving a week preserves weekday selection;
moving a month preserves the selected day until the user chooses another date.
These calendar calculations arrive as validated reports; the host derives
`verified`, never the planner or untrusted page. Navigation does not modify
entries, reminders, bill identity or payment state, except that opening an
occurrence clears its note that its company had changed it (Calendar,
`ChangedElsewhere`), so the note shows only on the detail she was taken back
to when her change was not made. A store-verified save can align the day
without clearing a selected appointment. This report is only a Week day
selection and cannot change a form or a deletion in progress.

```quint
pure def canNavigate(v: CalendarView, report: NavigationReport, by: ViewActor): bool =
  (by == ViewUser or (by == ViewStore and v.deletion == NoDeletion and report.kind == SelectDay)) and
  v.opened and v.deletion != DeletionPending and not(hasEditing(v)) and report.verified and validWindow(report.window) and
  ((report.kind == Earlier and report.window.mode == v.window.mode and report.window.anchorDay < v.window.anchorDay) or
    (report.kind == Later and report.window.mode == v.window.mode and report.window.anchorDay > v.window.anchorDay) or
    (report.kind == SelectDay and report.window.mode == WeekView and report.window.anchorDay == report.window.selectedDay) or
    (report.kind == Today and report.window.anchorDay == report.window.selectedDay) or
    (report.kind == SwitchMode and report.window.mode != v.window.mode and report.window.selectedDay == v.window.selectedDay))
pure def navigate(v: CalendarView, report: NavigationReport, by: ViewActor): CalendarView =
  { ...v, window: report.window, selectedId: if (by == ViewStore) v.selectedId else "", deletion: NoDeletion }
pure def lawStoreDayKeepsSelection(v: CalendarView, report: NavigationReport): bool =
  navigate(v, report, ViewStore).selectedId == v.selectedId
pure def canOpenOccurrence(v: CalendarView, id: str, by: ViewActor): bool =
  by == ViewUser and v.opened and v.deletion != DeletionPending and not(hasEditing(v)) and entryAt(v, id).hasSaved
pure def openOccurrence(v: CalendarView, id: str, by: ViewActor): CalendarView =
  { ...v, selectedId: id, deletion: NoDeletion,
    entries: v.entries.listMap(c => if (c.identity.occurrenceId == id) C::noticed(c) else c) }
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

### Coming up lists saved events after the selected day

Below the selected day, Week shows Coming up (`Grace Prototype.html:1914–1916`):
the events of the following days, across the week boundary. The adapter gives
the interval from the end of the selected day to 14 days later; the UI shows
the first four by start time. Those 14 days and four rows are the prototype's
presentation choices. Like the week, it shows only saved, undeleted events of
this calendar, with the committed fields of an event being edited.

```quint
pure def upcomingOccurrences(v: CalendarView, fromTime: int, untilTime: int): List[C::Calendar] =
  C::visibleEntries(v.entries, v.owner, v.calendarId, fromTime, untilTime)
pure def lawComingUpShowsSavedEvents(v: CalendarView, query: C::ViewQuery): bool =
  upcomingOccurrences(v, query.fromTime, query.untilTime).every(c =>
    c.hasSaved and c.phase != C::Deleted and c.identity.owner == v.owner and c.identity.calendarId == v.calendarId)
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
The Add form makes a New appointment only (`Grace Prototype.html:1918`); the
person cannot make up a bill's identity. A bill occurrence enters only by a
verified import. A new entry, from Add or from Grace's confirmed proposal, may
be marked important, by the form's Important switch or by the proposal she
agreed to, and has a positive length, the prototype's one hour by default (`Grace Prototype.html:2172`),
which edits then keep. A form change applies through Calendar's `formDetails`.
The important mark belongs to the whole repeating event, as the prototype
draws every repetition of a marked event red (its `red` is a field of the
event, which repeats on every matching day): editing a repeating event starts
from its series' settings, mark included, and a series save marks or unmarks
every member.

Dismiss on the Home banner or the reminder toast reaches the row whether or not
Calendar is open or that event is selected, and even while a Save of that event
awaits its storage result: dismissing changes only the reminder, and that save
then schedules the reminder afresh from what it commits. Like every change to a
row, Dismiss waits while a deletion question is open, a deletion is being
stored or a failed deletion is still showing. Every other change by the person
needs the event's own open form or detail, with no approved Save awaiting its
result.

```quint
type EntrySeed = { identity: C::EntryIdentity, details: C::EntryDetails }
type OccurrenceAction = BeginEditing | ChangeDetails({ details: C::EntryDetails }) | CancelEditing |
  ApproveEntry({ revision: int }) | EntryStored({ revision: int, succeeded: bool }) |
  EntryOutdated({ revision: int, latest: C::EntryDetails, version: str }) |
  AdvanceClock({ now: int }) | ShowDueReminder | SnoozeReminder({ until: int }) | DismissReminder
pure def mayChangeEntry(c: C::Calendar, command: OccurrenceAction, by: ViewActor): bool = match command {
  | BeginEditing => by == ViewUser and C::canBeginEdit(c, C::CalendarUser)
  | ChangeDetails(_) => by == ViewUser and C::canEdit(c, C::CalendarUser)
  | CancelEditing => by == ViewUser and C::canCancelEdit(c, C::CalendarUser)
  | ApproveEntry(request) => by == ViewUser and C::canApproveSave(c, request.revision, C::CalendarUser)
  | EntryStored(report) => by == ViewStore and
      (if (report.succeeded) C::canSave(c, report.revision, true, C::CalendarStore)
       else C::canSaveFailed(c, report.revision, C::CalendarStore))
  | EntryOutdated(report) => by == ViewStore and C::canSaveOutdated(c, report.revision, report.latest, report.version, C::CalendarStore)
  | AdvanceClock(request) => by == ViewClock and C::canAdvanceTime(c, request.now, C::CalendarClock)
  | ShowDueReminder => by == ViewClock and C::canShowReminder(c, C::CalendarClock)
  | SnoozeReminder(request) => by == ViewUser and C::canSnooze(c, request.until, C::CalendarUser)
  | DismissReminder => by == ViewUser and C::canDismissReminder(c, C::CalendarUser)
}
pure def changeEntry(c: C::Calendar, command: OccurrenceAction): C::Calendar = match command {
  | BeginEditing => C::beginEdit(c, C::CalendarUser)
  | ChangeDetails(request) => C::edit(c, C::formDetails(c.draft, request.details), C::CalendarUser)
  | CancelEditing => C::cancelEdit(c, C::CalendarUser)
  | ApproveEntry(request) => C::approveSave(c, request.revision, C::CalendarUser)
  | EntryStored(report) => if (report.succeeded) C::save(c, report.revision, true, C::CalendarStore)
      else C::saveFailed(c, report.revision, C::CalendarStore)
  | EntryOutdated(report) => C::saveOutdated(c, report.revision, report.latest, report.version, C::CalendarStore)
  | AdvanceClock(request) => C::advanceTime(c, request.now, C::CalendarClock)
  | ShowDueReminder => C::showReminder(c, C::CalendarClock)
  | SnoozeReminder(request) => C::snooze(c, request.until, C::CalendarUser)
  | DismissReminder => C::dismissReminder(c, C::CalendarUser)
}
pure def ownedEntryResult(v: CalendarView, c: C::Calendar, command: OccurrenceAction): C::Calendar =
  match command {
    | BeginEditing => if (c.committed.seriesId != "")
        { ...C::beginEdit(c, C::CalendarUser),
          draft: seriesAt(v, c.committed.seriesId).details }
      else C::beginEdit(c, C::CalendarUser)
    | _ => changeEntry(c, command)
  }
pure def lawEditingShowsTheSeriesMark(v: CalendarView, c: C::Calendar): bool =
  c.committed.seriesId != "" implies
    ownedEntryResult(v, c, BeginEditing).draft.important == seriesAt(v, c.committed.seriesId).details.important
pure def freshEntryAllowed(v: CalendarView, entry: EntrySeed): bool =
  v.deletion == NoDeletion and not(hasEditing(v)) and
  C::canCreate(C::initial, entry.identity, C::CalendarUser) and entry.details.endAt > entry.details.startAt and
  entry.identity.owner == v.owner and entry.identity.calendarId == v.calendarId and
  not(v.cancelledIds.contains(entry.identity.occurrenceId)) and
  v.entries.every(c => c.identity.occurrenceId != entry.identity.occurrenceId) and
  (entry.details.seriesId == "" or seriesAt(v, entry.details.seriesId).version == -1) and
  not(v.deletedSeries.contains(entry.details.seriesId)) and repetitionAllowed(v, C::initial, entry.details)
pure def canCreateOccurrence(v: CalendarView, entry: EntrySeed, by: ViewActor): bool =
  by == ViewUser and v.opened and entry.identity.kind == C::Appointment and freshEntryAllowed(v, entry)
pure def createOccurrence(v: CalendarView, entry: EntrySeed, by: ViewActor): CalendarView =
  { ...v, entries: v.entries.append(C::create(C::initial, entry.identity, entry.details, C::CalendarUser)),
    selectedId: entry.identity.occurrenceId, picker: NoPicker }
pure def dismisses(command: OccurrenceAction): bool = match command {
  | DismissReminder => true
  | _ => false
}
pure def canChangeOccurrence(v: CalendarView, id: str, command: OccurrenceAction, by: ViewActor): bool =
  val c = entryAt(v, id)
  c.phase != C::Empty and v.deletion == NoDeletion and
  (by != ViewUser or dismisses(command) or (v.opened and v.selectedId == id and c.approvedRevision == -1)) and
  mayChangeEntry(c, command, by) and
  (match command {
    | ChangeDetails(request) => not(v.deletedSeries.contains(request.details.seriesId)) and
        repetitionAllowed(v, c, request.details) and
        (if (c.hasSaved and c.committed.seriesId != "") request.details.seriesId == c.committed.seriesId
         else request.details.seriesId == "" or seriesAt(v, request.details.seriesId).version == -1)
    | EntryStored(_) => c.committed.seriesId == "" and c.draft.seriesId == "" and c.draft.recurrence == C::Once
    | EntryOutdated(report) => c.committed.seriesId == "" and c.draft.seriesId == "" and c.draft.recurrence == C::Once and
        report.latest.seriesId == "" and report.latest.recurrence == C::Once
    | _ => true
  })
pure def changeOccurrence(v: CalendarView, id: str, command: OccurrenceAction, by: ViewActor): CalendarView =
  val updated = ownedEntryResult(v, entryAt(v, id), command)
  { ...v, entries: if (updated.phase == C::Empty) v.entries.select(c => c.identity.occurrenceId != id)
      else v.entries.listMap(c => if (c.identity.owner == v.owner and c.identity.calendarId == v.calendarId and c.identity.occurrenceId == id and c.phase != C::Deleted) updated else c),
    cancelledIds: if (updated.phase == C::Empty) v.cancelledIds.union(Set(id)) else v.cancelledIds,
    selectedId: if (v.selectedId == id and (updated.phase == C::Empty or
      (not(v.opened) and updated.phase != C::Editing))) "" else v.selectedId,
    picker: if (closesPicker(command)) NoPicker else v.picker }
pure def closesPicker(command: OccurrenceAction): bool = match command {
  | BeginEditing => true
  | CancelEditing => true
  | ApproveEntry(_) => true
  | _ => false
}
pure def sometimesEntryEditing(v: CalendarView): bool = hasEditing(v)
pure def sometimesUnsavedEntryCancelled(v: CalendarView): bool = v.cancelledIds.size() > 0
pure def sometimesEntrySaveFailed(v: CalendarView): bool = v.entries.some(c => c.storageError == C::SaveFailure)
pure def sometimesEntryChangedElsewhere(v: CalendarView): bool = v.entries.some(c => c.storageError == C::ChangedElsewhere)
pure def sometimesOwnedReminderShown(v: CalendarView): bool = v.entries.some(c => c.reminder == C::ReminderShown)
pure def sometimesOwnedReminderDismissed(v: CalendarView): bool = v.entries.some(c => c.reminder == C::ReminderDismissed)
```

### An email account's calendar is asked to keep only what its company keeps

Eliza Cloud's calendar route sends the company an appointment's title, place,
notes, day and time, and refuses a repetition rule or a reminder with
`400 invalid_request` (`spec/cloud/services/google/calendar.md`, "A create
needs an Idempotency-Key, a change or deletion one exact If-Match revision,
and none takes a recurrence rule"; a reminder is a field its create and
change bodies do not take). So the tablet never claims a repetition the
company does not hold: on an email account's calendar a new appointment, hers
or one Grace proposes, does not repeat, and a saved one keeps the repetition
its company sent, which is all the form's Repeats offers for it. Only the
tablet's own calendar, the collection bound to the calendar `tablet`, makes,
changes or stops a repetition. A reminder on any calendar is the tablet's
own: the tablet reminds her, and the company keeps whatever reminders it
had, and so is the important mark, which the company never receives.

Eliza Cloud's feed sends a repeating appointment as its single occurrences,
each with its own ID and revision and its event's ID (Google's
`singleEvents`), never the repetition rule. The tablet shows those
occurrences as one repeating appointment: those of one event that share its
title, place, notes, timezone and time of day and fall on the same weekday a
week apart repeat every week, or on the same date a month apart every month.
An occurrence that fits neither, such as one moved or retitled at the company,
or the only one in reach, shows as an appointment of its own. Since the company
sends every occurrence, an email account's calendar makes no repetition of its
own. A change to the repeating appointment is made to the company's event, at
the event's revision, by its ID.

```quint
pure val tabletCalendarId: str = "tablet"
pure def keepsRepetition(v: CalendarView): bool = v.calendarId == tabletCalendarId
pure def repetitionAllowed(v: CalendarView, c: C::Calendar, details: C::EntryDetails): bool =
  keepsRepetition(v) or details.recurrence == (if (c.hasSaved) c.committed.recurrence else C::Once)
pure def lawAccountCalendarStartsNoRepetition(v: CalendarView, entry: EntrySeed): bool =
  (not(keepsRepetition(v)) and freshEntryAllowed(v, entry)) implies entry.details.recurrence == C::Once
pure def lawAccountCalendarKeepsItsRepetition(v: CalendarView, c: C::Calendar, details: C::EntryDetails): bool =
  (not(keepsRepetition(v)) and c.hasSaved and repetitionAllowed(v, c, details)) implies
    details.recurrence == c.committed.recurrence
```

### A change at the company names the revision it read and never overwrites a newer one

A change or deletion at an email account's company names, as its one exact
If-Match, the event's revision the tablet last read (Calendar's `version`),
so neither overwrites a change made elsewhere since. When the company refuses
one for that reason (`412`), the tablet reads the event again and shows it as
it is now, saying her change was not made: `EntryOutdated` answers the save
of one appointment, and a refused deletion is answered by publishing
Calendar's `withCurrent` of the saved entry, which closes the deletion
question. It asks the company again only when she does. A repeating
appointment's change refused this way stays a failed save, which she can
cancel; the next read shows the company's version.

When the tablet has no revision for an appointment, as after a create it
recovered without the company's answer, or when the company refuses the one
it named, it reads the appointment again first: if the company still holds
what she saw, the change or deletion goes ahead at the revision just read,
and only otherwise is it refused as above. It never sends an empty revision,
which the company refuses.

```quint
pure def lawOutdatedChangeShowsTheCompanysVersion(v: CalendarView, id: str, revision: int, latest: C::EntryDetails, version: str): bool =
  val command = EntryOutdated({ revision: revision, latest: latest, version: version })
  val after = entryAt(changeOccurrence(v, id, command, ViewStore), id)
  canChangeOccurrence(v, id, command, ViewStore) implies
    (after.phase == C::Saved and after.committed == latest and after.version == version and
      after.storageError == C::ChangedElsewhere and after.identity == entryAt(v, id).identity)
```

### The form opens its Day or its Time list, one at a time

On the form, Change Day and Change Time each open their list, as in the
prototype’s form (`calForm`, its `pick`): opening one closes the other, and
choosing a day or a time, or tapping the opened one again, closes it. Closing
a list closes only that list, so closing one that another has already
replaced leaves the other open. A form
opens with both lists closed, and Save and Back close them. A list shows only
while the form she can still change is showing, never on the detail, while a
Save awaits its result or while Calendar is closed.

```quint
pure def formOpen(v: CalendarView): bool =
  v.opened and v.deletion == NoDeletion and selectedOccurrence(v).phase == C::Editing and
    selectedOccurrence(v).approvedRevision == -1
pure def canShowPicker(v: CalendarView, picker: FormPicker, by: ViewActor): bool =
  by == ViewUser and formOpen(v) and picker != NoPicker
pure def showPicker(v: CalendarView, picker: FormPicker, by: ViewActor): CalendarView =
  { ...v, picker: picker }
pure def canHidePicker(v: CalendarView, picker: FormPicker, by: ViewActor): bool =
  by == ViewUser and formOpen(v) and picker != NoPicker and v.picker == picker
pure def hidePicker(v: CalendarView, picker: FormPicker, by: ViewActor): CalendarView =
  { ...v, picker: NoPicker }
pure def shownPicker(v: CalendarView): FormPicker = if (formOpen(v)) v.picker else NoPicker
pure def lawAFormOpensWithItsListsClosed(v: CalendarView, id: str, entry: EntrySeed): bool =
  shownPicker(changeOccurrence(v, id, BeginEditing, ViewUser)) == NoPicker and
    shownPicker(createOccurrence(v, entry, ViewUser)) == NoPicker and
    shownPicker(changeOccurrence(v, id, ApproveEntry({ revision: entryAt(v, id).revision }), ViewUser)) == NoPicker
pure def lawAListShowsOnlyOnTheForm(v: CalendarView): bool =
  shownPicker(v) != NoPicker implies formOpen(v)
pure def lawClosingOneListKeepsTheOther(v: CalendarView, picker: FormPicker): bool =
  v.picker != picker implies not(canHidePicker(v, picker, ViewUser))
pure def sometimesPickerShown(v: CalendarView): bool = shownPicker(v) != NoPicker
```

### A provider's create receipt names the saved occurrence

The store binds the approved revision of one new appointment to the occurrence
ID returned by that calendar’s create request. In one save the provider ID
takes the place of the local draft ID, carrying its source and details. An
open selection follows that same appointment. For a repeating appointment,
the returned ID identifies the provider’s first event and its series keeps
the same ID for all subsequent occurrences. A different account, calendar,
revision, occupied ID or repeated receipt cannot replace an entry.

If the create reply is lost, Grace keeps the original request. Under the
same account grant, approving the same details again or reopening the
calendar lets Grace ask Google for that request’s receipt. A provider
without that guarantee leaves the appointment pending. Changed details or
a replacement grant also leave it pending. Other provider appointments
can still appear with their own details while recovery is unavailable.

```quint
type CreatedReceipt = { owner: str, calendarId: str, localId: str, providerId: str, revision: int }
pure def withProviderId(localId: str, saved: CalendarView, providerId: str): CalendarView =
  { ...saved,
    entries: saved.entries.listMap(c => if (c.identity.occurrenceId == localId)
      { ...c, identity: { ...c.identity, occurrenceId: providerId } } else c),
    selectedId: if (saved.selectedId == localId) providerId else saved.selectedId,
    cancelledIds: if (providerId == localId) saved.cancelledIds else saved.cancelledIds.union(Set(localId)) }
pure def unusedProviderId(v: CalendarView, localId: str, providerId: str): bool =
  providerId != "" and not(v.cancelledIds.contains(providerId)) and
  (providerId == localId or v.entries.every(e => e.identity.occurrenceId != providerId))
pure def canStoreCreated(v: CalendarView, created: CreatedReceipt, by: ViewActor): bool =
  val c = entryAt(v, created.localId)
  canChangeOccurrence(v, created.localId, EntryStored({ revision: created.revision, succeeded: true }), by) and
  not(c.hasSaved) and c.identity.kind == C::Appointment and
  created.owner == v.owner and created.calendarId == v.calendarId and
  unusedProviderId(v, created.localId, created.providerId)
pure def storeCreated(v: CalendarView, created: CreatedReceipt, by: ViewActor): CalendarView =
  val saved = changeOccurrence(v, created.localId, EntryStored({ revision: created.revision, succeeded: true }), by)
  withProviderId(created.localId, saved, created.providerId)
pure def lawCreatedReceiptIsSpent(v: CalendarView, created: CreatedReceipt): bool =
  canStoreCreated(v, created, ViewStore) implies not(canStoreCreated(storeCreated(v, created, ViewStore), created, ViewStore))
pure val createdValues = Set(
  { owner: "ownerA", calendarId: "calendarA", localId: "visitA", providerId: "providerA", revision: 1 },
  { owner: "ownerB", calendarId: "calendarA", localId: "visitA", providerId: "periodA", revision: 2 })
```

### An exact confirmed appointment enters the calendar without opening it

Grace can propose an appointment while the person stays on Home or another
screen (`Grace Prototype.html:2105–2106,2133–2137`). The displayed question
owns one immutable proposal until it is confirmed, corrected or cancelled.
An open Calendar may show that proposal as an unsaved preview. It has no
scheduled reminder and cannot start a write.

The trusted adapter supplies `ViewConsent` only for the person's complete
approval of the current exact question. It checks the conversation generation,
work version and visibility before processing voice, a chip or a typed answer.
Correction, Close, cancellation and a superseding question retire that review.
The adapter consumes spoken intent against the pre-utterance question before
recording the answer. The renderer and approval adapter use the same proposal.

The calendar checks equality with the reviewed identity and details and consumes
the review's calendar generation. A repeated approval cannot create a second
occurrence. A first confirmed appointment binds the chosen calendar and display
timezone without changing the current screen. One approved draft enters the
owned collection. Calendar's existing acknowledgment records the durable result
and schedules reminders. Failure preserves the draft and requires renewed
approval at a new revision.

```quint
type AppointmentReview = {
  entry: EntrySeed, calendarGeneration: int, displayTimezone: str
}
type ConfirmedAppointment = { entry: EntrySeed, review: AppointmentReview }
pure def canConfirmAppointment(v: CalendarView, request: ConfirmedAppointment, by: ViewActor): bool =
  val bound = { ...v, owner: request.entry.identity.owner, calendarId: request.entry.identity.calendarId,
    timezone: request.review.displayTimezone }
  by == ViewConsent and request.entry == request.review.entry and
  request.review.calendarGeneration == v.generation and request.review.displayTimezone != "" and
  request.entry.identity.kind == C::Appointment and C::validDetails(request.entry.details) and
  (v.owner == "" or (v.owner == bound.owner and v.calendarId == bound.calendarId and v.timezone == bound.timezone)) and
  freshEntryAllowed(bound, request.entry)
pure def confirmAppointment(v: CalendarView, request: ConfirmedAppointment, by: ViewActor): CalendarView =
  val created = C::create(C::initial, request.entry.identity, request.entry.details, C::CalendarUser)
  val approved = C::approveSave(created, created.revision, C::CalendarUser)
  { ...v, owner: request.entry.identity.owner, calendarId: request.entry.identity.calendarId,
    timezone: request.review.displayTimezone, generation: v.generation + 1,
    entries: v.entries.append(approved), selectedId: request.entry.identity.occurrenceId }
pure def lawChangedAppointmentCannotConfirm(v: CalendarView, request: ConfirmedAppointment, by: ViewActor): bool =
  request.entry != request.review.entry implies not(canConfirmAppointment(v, request, by))
pure def lawStaleAppointmentReviewCannotConfirm(v: CalendarView, request: ConfirmedAppointment, by: ViewActor): bool =
  request.review.calendarGeneration != v.generation implies not(canConfirmAppointment(v, request, by))
pure def lawAppointmentReviewIsConsumedOnce(v: CalendarView, request: ConfirmedAppointment, again: ConfirmedAppointment, by: ViewActor): bool =
  canConfirmAppointment(v, request, by) and again.review.calendarGeneration == request.review.calendarGeneration implies
    not(canConfirmAppointment(confirmAppointment(v, request, by), again, by))
pure def lawConfirmedAppointmentKeepsCalendarView(v: CalendarView, request: ConfirmedAppointment, by: ViewActor): bool =
  confirmAppointment(v, request, by).opened == v.opened and confirmAppointment(v, request, by).window == v.window
pure def lawConfirmedAppointmentStillNeedsStorage(v: CalendarView, request: ConfirmedAppointment, by: ViewActor): bool =
  val after = confirmAppointment(v, request, by)
  val entry = after.entries.nthOr(v.entries.length(), C::initial)
  canConfirmAppointment(v, request, by) implies
    entry.phase == C::Editing and not(entry.hasSaved) and entry.draft == request.review.entry.details and
    entry.approvedRevision == entry.revision
pure val reviewedAppointment: ConfirmedAppointment = {
  entry: { identity: C::appointmentIdentity, details: C::timedDetails },
  review: { entry: { identity: C::appointmentIdentity, details: C::timedDetails },
    calendarGeneration: 0, displayTimezone: "America/New_York" }
}
pure val requestValues = Set(
  reviewedAppointment,
  { ...reviewedAppointment, review: { ...reviewedAppointment.review, calendarGeneration: 1 } },
  { ...reviewedAppointment, entry: { ...reviewedAppointment.entry,
    details: { ...C::timedDetails, title: "Changed appointment" } } },
  { ...reviewedAppointment, entry: { ...reviewedAppointment.entry,
    identity: { ...C::appointmentIdentity, occurrenceId: "different-visit" } } })
pure val againValues = requestValues
```

### Grace's change takes effect only for the exact change the person agreed to

Grace may suggest changing a saved appointment, from any screen. As with a new
appointment, the trusted adapter supplies `ViewConsent` only for the person's
yes to that exact question. The review names the occurrence, its complete new
details, the revision of the saved appointment she was shown and the calendar
generation. The change applies only while that occurrence is still a saved
appointment of this calendar at that revision, with the reviewed details,
valid, with the series rules of the person's own form, and with the important
mark it proposes, which she agrees to with the rest; while no form is being edited and no deletion question is open; and
while an open Calendar shows the week or that same event, never another. A
refresh from the store or a form she opened and closed moves the revision and
voids the yes.

The agreed change enters as the approved edit of that occurrence, selected,
without opening Calendar. The store's acknowledgment commits it as for the
person's own Save, and a repeating appointment's change is committed by the
series save; failure keeps the draft and needs a new approval. The calendar
generation moves on, so one yes changes the calendar once.

```quint
type ChangeReview = { id: str, details: C::EntryDetails, committedRevision: int, calendarGeneration: int }
type ConfirmedChange = { id: str, details: C::EntryDetails, review: ChangeReview }
pure def canConfirmChange(v: CalendarView, changeRequest: ConfirmedChange, by: ViewActor): bool =
  val c = entryAt(v, changeRequest.id)
  val details = changeRequest.details
  by == ViewConsent and changeRequest.review.id == changeRequest.id and changeRequest.review.details == details and
  changeRequest.review.calendarGeneration == v.generation and changeRequest.review.committedRevision == c.revision and
  c.hasSaved and c.identity.kind == C::Appointment and C::canBeginEdit(c, C::CalendarUser) and
  v.deletion == NoDeletion and not(hasEditing(v)) and
  (not(v.opened) or v.selectedId == "" or v.selectedId == changeRequest.id) and
  C::validDetails(details) and not(v.deletedSeries.contains(details.seriesId)) and repetitionAllowed(v, c, details) and
  (if (c.committed.seriesId != "") details.seriesId == c.committed.seriesId
   else details.seriesId == "" or seriesAt(v, details.seriesId).version == -1)
pure def changedEntry(c: C::Calendar, details: C::EntryDetails): C::Calendar =
  val editing = C::edit(C::beginEdit(c, C::CalendarUser), details, C::CalendarUser)
  C::approveSave(editing, editing.revision, C::CalendarUser)
pure def confirmChange(v: CalendarView, changeRequest: ConfirmedChange, by: ViewActor): CalendarView =
  val approved = changedEntry(entryAt(v, changeRequest.id), changeRequest.details)
  { ...v, generation: v.generation + 1, selectedId: changeRequest.id,
    entries: v.entries.listMap(c => if (c.identity.occurrenceId == changeRequest.id) approved else c) }
pure def lawChangedChangeCannotConfirm(v: CalendarView, changeRequest: ConfirmedChange, by: ViewActor): bool =
  (changeRequest.details != changeRequest.review.details or changeRequest.id != changeRequest.review.id) implies
    not(canConfirmChange(v, changeRequest, by))
pure def lawStaleChangeCannotConfirm(v: CalendarView, changeRequest: ConfirmedChange, by: ViewActor): bool =
  (changeRequest.review.calendarGeneration != v.generation or
    changeRequest.review.committedRevision != entryAt(v, changeRequest.id).revision) implies
    not(canConfirmChange(v, changeRequest, by))
pure def lawChangeIsConsumedOnce(v: CalendarView, changeRequest: ConfirmedChange, nextChange: ConfirmedChange, by: ViewActor): bool =
  canConfirmChange(v, changeRequest, by) implies not(canConfirmChange(confirmChange(v, changeRequest, by), nextChange, by))
pure def lawConfirmedChangeKeepsCalendarView(v: CalendarView, changeRequest: ConfirmedChange, by: ViewActor): bool =
  confirmChange(v, changeRequest, by).opened == v.opened and confirmChange(v, changeRequest, by).window == v.window
pure def lawConfirmedChangeStillNeedsStorage(v: CalendarView, changeRequest: ConfirmedChange, by: ViewActor): bool =
  val before = entryAt(v, changeRequest.id)
  canConfirmChange(v, changeRequest, by) implies
    confirmChange(v, changeRequest, by).entries.every(c => c.identity.occurrenceId == changeRequest.id implies
      (c.phase == C::Editing and c.committed == before.committed and c.draft == changeRequest.review.details and
        c.approvedRevision == c.revision and c.identity == before.identity))
pure def sometimesAgreedChangeAwaitsStorage(v: CalendarView): bool =
  not(v.opened) and v.entries.some(c => c.phase == C::Editing and c.hasSaved and c.approvedRevision != -1)
pure val movedDetails: C::EntryDetails = { ...C::timedDetails, title: "Moved appointment", startAt: 5, endAt: 6 }
pure val agreedChange: ConfirmedChange = {
  id: "visitA", details: movedDetails,
  review: { id: "visitA", details: movedDetails, committedRevision: 1, calendarGeneration: 0 }
}
pure val changeRequestValues = Set(
  agreedChange,
  { ...agreedChange, review: { ...agreedChange.review, calendarGeneration: 1 } },
  { ...agreedChange, review: { ...agreedChange.review, committedRevision: 3 } },
  { ...agreedChange, details: { ...movedDetails, important: true },
    review: { ...agreedChange.review, details: { ...movedDetails, important: true } } },
  { ...agreedChange, review: { ...agreedChange.review, details: C::timedDetails } })
pure val nextChangeValues = changeRequestValues
```

### A bill occurrence enters only from verified bill evidence

Calendar Add makes appointments only. A bill reaches the calendar when the
store imports it from a verified provider bill or a confirmed email bill. The
host derives `verified`; email text and calendar titles never supply it. The
occurrence's owner, provider origin, provider account and invoice reference
equal the evidence's bill key, the payment aggregate's key, and its source
reference names that evidence. The evidence carries the payment aggregate's
key fields (owner, origin, account and bill) with its source reference. The
import is a publish of the saved row, so every publishing check applies to it,
including the store's verification of the occurrence's local time and a
following bill's distinct invoice; it is the only way a new bill
row is added, since an ordinary publish refuses one. It neither opens Calendar nor changes the selection.

```quint
type BillEvidence = { owner: str, origin: str, account: str, bill: str, sourceRef: str, verified: bool }
pure def provesBill(identity: C::EntryIdentity, billEvidence: BillEvidence): bool =
  identity.kind == C::Bill and identity.owner == billEvidence.owner and identity.billOrigin == billEvidence.origin and
  identity.billAccount == billEvidence.account and identity.billRef == billEvidence.bill and
  identity.sourceRef == billEvidence.sourceRef
pure def importedBill(entry: EntrySeed): C::Calendar =
  val created = C::create(C::initial, entry.identity, entry.details, C::CalendarUser)
  C::save(C::approveSave(created, created.revision, C::CalendarUser), created.revision, true, C::CalendarStore)
pure def importVersion(v: CalendarView, entry: EntrySeed): int =
  if (seriesAt(v, entry.details.seriesId).version == -1) 0 else seriesAt(v, entry.details.seriesId).version
pure def canImportBillOccurrence(v: CalendarView, entry: EntrySeed, billEvidence: BillEvidence, scheduleVerified: bool, by: ViewActor): bool =
  by == ViewStore and billEvidence.verified and provesBill(entry.identity, billEvidence) and
  v.entries.every(c => c.identity.occurrenceId != entry.identity.occurrenceId) and
  publishAllowed(v, importedBill(entry), importVersion(v, entry), scheduleVerified, by)
pure def importBillOccurrence(v: CalendarView, entry: EntrySeed, billEvidence: BillEvidence, scheduleVerified: bool, by: ViewActor): CalendarView =
  publishOccurrence(v, importedBill(entry), importVersion(v, entry), scheduleVerified, by)
pure def lawImportedBillHasVerifiedKey(v: CalendarView, entry: EntrySeed, billEvidence: BillEvidence, scheduleVerified: bool, by: ViewActor): bool =
  canImportBillOccurrence(v, entry, billEvidence, scheduleVerified, by) implies
    (billEvidence.verified and C::billAvailable(importedBill(entry)) and provesBill(importedBill(entry).identity, billEvidence))
```

### Saving a repeating event updates its whole series through the same form

The prototype edits the recurring event, not an isolated repetition
(`Grace Prototype.html:1894,2165,2171`). The one form and one Save choice apply
to the series without an added scope question. Each series has one versioned
definition. Opening Edit uses that definition's original anchor date and
settings, as the prototype does, rather than silently moving the anchor to
the clicked repetition. Its title, location, notes, participant, timezone, repeat,
reminder settings and important mark project into every live occurrence. Each
occurrence retains its own immutable identity, invoice source and deletion
tombstone. Saving an
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
pure def canStoreCreatedSeries(v: CalendarView, receipt: SeriesReceipt, providerId: str, by: ViewActor): bool =
  receipt.persisted and canSaveSeries(v, receipt, by) and not(selectedOccurrence(v).hasSaved) and
  selectedOccurrence(v).identity.kind == C::Appointment and unusedProviderId(v, receipt.occurrenceId, providerId)
pure def storeCreatedSeries(v: CalendarView, receipt: SeriesReceipt, providerId: str, by: ViewActor): CalendarView =
  withProviderId(receipt.occurrenceId, saveSeries(v, receipt, by), providerId)
pure def lawCreatedSeriesReceiptIsSpent(v: CalendarView, receipt: SeriesReceipt, providerId: str): bool =
  canStoreCreatedSeries(v, receipt, providerId, ViewStore) implies
    not(canStoreCreatedSeries(storeCreatedSeries(v, receipt, providerId, ViewStore), receipt, providerId, ViewStore))
pure val providerIdValues = Set("", "visitA", "periodA", "providerA")
pure def lawPartialSeriesReceiptCannotSave(v: CalendarView, receipt: SeriesReceipt, by: ViewActor): bool =
  receipt.persisted and not(validSeriesSchedule(v, receipt)) implies not(canSaveSeries(v, receipt, by))
pure def lawSeriesSaveMarksEveryMember(v: CalendarView, c: C::Calendar, receipt: SeriesReceipt): bool =
  (receipt.persisted and seriesMemberAffected(v, c) and scheduleFor(receipt.schedules, c.identity.occurrenceId).include and
    c.identity.occurrenceId != v.selectedId) implies
    seriesMemberResult(v, c, receipt).committed.important == selectedOccurrence(v).draft.important
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

## Story: See a due reminder and open its event

> As a user, I want a due reminder to tell me what is coming wherever I am, and
> See details to take me straight to that event without dismissing it.

### A shown reminder appears on Home or as a toast and See details opens its event

On Home, a shown reminder is the banner with the bell, the event's title, its
day, time and place, See details and Dismiss
(`Grace Prototype.html:1865–1871`). The banner is hidden while Grace is
expanded or the tablet sleeps. On any other screen it arrives as the toast
"Reminder: " followed by the title, the day in lower case, "at" and the time,
with no comma (`Grace Prototype.html:2275`). See details opens
Calendar on that exact occurrence's detail (`Grace Prototype.html:2228`). It is
refused while a form is being edited or a deletion is being stored, so it never
discards an edit. It leaves the reminder shown (clearing only any
`ChangedElsewhere` note on that occurrence, like `openOccurrence`); Dismiss on
the banner, toast or detail dismisses it, and Snooze in the detail hides it and
shows it again ten minutes later. This deliberately departs from the prototype,
whose See details also clears the banner (`X.banner=null`,
`Grace Prototype.html:2228`): the story asks that opening the event not dismiss
its reminder, so the banner is back on Home until the person dismisses it. The
detail is the ordinary one, so Back returns to the calendar.

```quint
pure def shownReminders(v: CalendarView): List[C::Calendar] = v.entries.select(c => c.reminder == C::ReminderShown)
pure def canOpenReminder(v: CalendarView, id: str, owner: str, calendarId: str, timezone: str, by: ViewActor): bool =
  canOpenCalendar(v, owner, calendarId, timezone, by) and not(hasEditing(v)) and v.deletion != DeletionPending and
  entryAt(v, id).reminder == C::ReminderShown and canOpenOccurrence(openCalendar(v, owner, calendarId, timezone, by), id, by)
pure def openReminder(v: CalendarView, id: str, owner: str, calendarId: str, timezone: str, by: ViewActor): CalendarView =
  openOccurrence(openCalendar(v, owner, calendarId, timezone, by), id, by)
pure def lawSeeDetailsKeepsReminder(v: CalendarView, id: str, owner: str, calendarId: str, timezone: str, by: ViewActor): bool =
  val after = openReminder(v, id, owner, calendarId, timezone, by)
  canOpenReminder(v, id, owner, calendarId, timezone, by) implies
    (after.entries == v.entries.listMap(c => if (c.identity.occurrenceId == id) C::noticed(c) else c) and
      after.entries.listMap(c => c.reminder) == v.entries.listMap(c => c.reminder) and
      after.selectedId == id and
      after.opened)
pure def sometimesReminderOpened(v: CalendarView): bool =
  v.opened and selectedOccurrence(v).reminder == C::ReminderShown
```

## Story: Open the bill behind a calendar entry

> As a user, I want a bill's calendar entry to take me to that bill and show
> whether it is paid, without paying it.

### A saved bill's detail offers Open bill with its payment status

The prototype has no bill in Calendar, so this follows its event detail: Open
bill sits in the detail's action row beside Edit and Delete
(`Grace Prototype.html:1903`), and the status line shows the payment
aggregate's visible outcome from the handoff registry, Unknown when that record
is unavailable. Open bill asks the handoff registry to open the bill; it never
pays, schedules or approves anything. It is offered only for the open, selected,
saved and undeleted bill while no form is being edited and no deletion question
is open. The handoff registry accepts the selection as a source whenever
Calendar is open with no deletion question, form or not; offering Open bill
only without a form is this view's stricter choice, so opening the bill never
leaves an edit behind.

```quint
pure def openBillOffered(v: CalendarView): bool =
  v.opened and v.deletion == NoDeletion and not(hasEditing(v)) and C::billAvailable(selectedOccurrence(v))
pure def sometimesOpenBillOffered(v: CalendarView): bool = openBillOffered(v)
```

## Story: Delete this occurrence or the whole repeating event

> As a user, I want Keep it to do nothing, Delete only this one to preserve the
> rest of the series and Delete every one to stop the series from coming back.

### The deletion question binds its selected occurrence and explicit scope

The first Delete opens the prototype's question. Choosing one or all is the
single final approval. Nonrepeating entries offer only this occurrence. The
store persists the exact request generation before success is displayed; failed
storage retains the selected entry and lets the user choose again. Navigating
or publishing another row cannot change a pending target. The store's result
names its receipt evidence; the view keeps only the result, not the receipt.
On an email account's calendar, Delete only this one of a repeating
appointment deletes that one occurrence at its company, by the company's own
ID for it and at its own revision, as Eliza Cloud's deletion of an instance ID
removes one occurrence; the rest of the series stays there and here. Delete
every one deletes the company's event by its ID, at the event's revision read
just before, and with it the series.
Discovered by the proof: a pending or failed whole-series deletion retains a
recurring selected event. Without that fact an arbitrary pending state could
treat a nonrepeating event's empty series ID as a deleted series.

```quint
pure def canRequestDeletion(v: CalendarView, by: ViewActor): bool =
  by == ViewUser and v.opened and v.selectedId != "" and v.deletion == NoDeletion and not(hasEditing(v))
pure def requestDeletion(v: CalendarView, by: ViewActor): CalendarView =
  { ...v, deletion: DeletionQuestion, scope: ThisOccurrence }
pure def canKeepOccurrence(v: CalendarView, by: ViewActor): bool =
  by == ViewUser and v.opened and (v.deletion == DeletionQuestion or v.deletion == DeletionFailed)
pure def keepOccurrence(v: CalendarView, by: ViewActor): CalendarView = { ...v, deletion: NoDeletion }
pure def canApproveDeletion(v: CalendarView, scope: DeleteScope, by: ViewActor): bool =
  by == ViewUser and v.opened and (v.deletion == DeletionQuestion or v.deletion == DeletionFailed) and
  (scope == ThisOccurrence or selectedOccurrence(v).committed.recurrence != C::Once)
pure def approveDeletion(v: CalendarView, scope: DeleteScope, by: ViewActor): CalendarView =
  { ...v, deletion: DeletionPending, scope: scope, generation: v.generation + 1 }
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
    deletion: if (succeeded) NoDeletion else DeletionFailed }
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

### Grace's deletion takes effect only for the occurrence and scope the person agreed to

Grace may suggest removing a saved appointment, this one or every one of a
repeating appointment, from any screen. The trusted adapter supplies
`ViewConsent` only for the person's yes to that exact question, whose review
names the occurrence, the scope, the revision of the saved appointment she was
shown and the calendar generation. Her yes is the deletion's single final
approval, as choosing one or all is in the person's own question, and it is
taken only while that occurrence is still a saved appointment of this calendar
at that revision; while the scope is the reviewed one and every one is chosen
only for a repeating appointment; while no form is being edited and no
deletion question is open; and while an open Calendar shows the week or that
same event, never another. The deletion then waits for the store's result
exactly as the person's own does, without opening Calendar, and nothing is
removed before that result. The calendar generation moves on, so one yes
deletes once.

```quint
type DeletionReview = { id: str, scope: DeleteScope, committedRevision: int, calendarGeneration: int }
type ConfirmedDeletion = { id: str, scope: DeleteScope, review: DeletionReview }
pure def canConfirmDeletion(v: CalendarView, deletionRequest: ConfirmedDeletion, by: ViewActor): bool =
  val c = entryAt(v, deletionRequest.id)
  by == ViewConsent and deletionRequest.review.id == deletionRequest.id and
  deletionRequest.review.scope == deletionRequest.scope and
  deletionRequest.review.calendarGeneration == v.generation and deletionRequest.review.committedRevision == c.revision and
  c.hasSaved and c.phase == C::Saved and c.identity.kind == C::Appointment and
  v.deletion == NoDeletion and not(hasEditing(v)) and
  (not(v.opened) or v.selectedId == "" or v.selectedId == deletionRequest.id) and
  (deletionRequest.scope == ThisOccurrence or c.committed.recurrence != C::Once)
pure def confirmDeletion(v: CalendarView, deletionRequest: ConfirmedDeletion, by: ViewActor): CalendarView =
  { ...v, selectedId: deletionRequest.id, deletion: DeletionPending, scope: deletionRequest.scope,
    generation: v.generation + 1 }
pure def lawChangedDeletionCannotConfirm(v: CalendarView, deletionRequest: ConfirmedDeletion, by: ViewActor): bool =
  (deletionRequest.scope != deletionRequest.review.scope or deletionRequest.id != deletionRequest.review.id) implies
    not(canConfirmDeletion(v, deletionRequest, by))
pure def lawStaleDeletionCannotConfirm(v: CalendarView, deletionRequest: ConfirmedDeletion, by: ViewActor): bool =
  (deletionRequest.review.calendarGeneration != v.generation or
    deletionRequest.review.committedRevision != entryAt(v, deletionRequest.id).revision) implies
    not(canConfirmDeletion(v, deletionRequest, by))
pure def lawDeletionIsConsumedOnce(v: CalendarView, deletionRequest: ConfirmedDeletion, nextDeletion: ConfirmedDeletion, by: ViewActor): bool =
  canConfirmDeletion(v, deletionRequest, by) implies not(canConfirmDeletion(confirmDeletion(v, deletionRequest, by), nextDeletion, by))
pure def lawConfirmedDeletionWaitsForTheStore(v: CalendarView, deletionRequest: ConfirmedDeletion, by: ViewActor): bool =
  val after = confirmDeletion(v, deletionRequest, by)
  after.entries == v.entries and after.opened == v.opened and after.window == v.window and
    after.deletion == DeletionPending and after.scope == deletionRequest.scope
pure def sometimesAgreedDeletionWhileClosed(v: CalendarView): bool = not(v.opened) and v.deletion == DeletionPending
pure val agreedDeletion: ConfirmedDeletion = {
  id: "visitA", scope: ThisOccurrence,
  review: { id: "visitA", scope: ThisOccurrence, committedRevision: 1, calendarGeneration: 0 }
}
pure val deletionRequestValues = Set(
  agreedDeletion,
  { ...agreedDeletion, review: { ...agreedDeletion.review, calendarGeneration: 1 } },
  { ...agreedDeletion, scope: EntireSeries, review: { ...agreedDeletion.review, scope: EntireSeries } },
  { ...agreedDeletion, scope: EntireSeries },
  { id: "seriesA", scope: EntireSeries,
    review: { id: "seriesA", scope: EntireSeries, committedRevision: 1, calendarGeneration: 0 } },
  { id: "seriesA", scope: EntireSeries,
    review: { id: "seriesA", scope: EntireSeries, committedRevision: 1, calendarGeneration: 1 } })
pure val nextDeletionValues = deletionRequestValues
```

### Samples exercise ordinary and recurring entries without limiting real dates

```quint
pure val ownerValues = Set("", "ownerA", "ownerB")
pure val calendarIdValues = Set("", "calendarA")
pure val timezoneValues = Set("", "America/New_York")
pure val idValues = Set("", "visitA", "periodA", "seriesA", "missing")
pure val weeklyVisit: C::Calendar = C::save(C::approveSave(
  C::create(C::initial, { ...C::appointmentIdentity, occurrenceId: "seriesA" },
    { ...C::timedDetails, recurrence: C::Weekly, seriesId: "weeklySeries" }, C::CalendarUser),
  1, C::CalendarUser), 1, true, C::CalendarStore)
pure val incomingValues = C::incomingValues.union(Set(weeklyVisit))
pure val reportValues = Set(
  { window: { ...emptyWindow, anchorDay: 7, selectedDay: 7, fromTime: 0, untilTime: 10 }, kind: Later, verified: true },
  { window: { ...emptyWindow, anchorDay: -7, selectedDay: -7, fromTime: -10, untilTime: 0 }, kind: Earlier, verified: true },
  { window: emptyWindow, kind: Today, verified: true },
  { window: { ...emptyWindow, mode: MonthView }, kind: SwitchMode, verified: true },
  { window: { ...emptyWindow, anchorDay: 3, selectedDay: 3 }, kind: SelectDay, verified: true },
  { window: emptyWindow, kind: Today, verified: false })
pure val evidenceValues = Set("", "storeReceipt")
pure val cValues = C::incomingValues
pure val billEvidenceValues = Set(
  { owner: "ownerA", origin: "https://biller.example", account: "billerAccount", bill: "billA", sourceRef: "messageA", verified: true },
  { owner: "ownerA", origin: "https://biller.example", account: "billerAccount", bill: "billA", sourceRef: "messageA", verified: false },
  { owner: "ownerA", origin: "https://biller.example", account: "billerAccount", bill: "billB", sourceRef: "messageA", verified: true })
pure val entryValues = Set(
  { identity: C::appointmentIdentity, details: C::timedDetails },
  { identity: C::billIdentity, details: C::repeatingDetails })
pure val commandValues = Set(BeginEditing, ChangeDetails({ details: C::timedDetails }), ChangeDetails({ details: C::repeatingDetails }), CancelEditing,
  ChangeDetails({ details: { ...C::repeatingDetails, recurrence: C::Once } }),
  ApproveEntry({ revision: 1 }), ApproveEntry({ revision: 2 }), ApproveEntry({ revision: 3 }), ApproveEntry({ revision: 4 }),
  EntryStored({ revision: 1, succeeded: true }), EntryStored({ revision: 2, succeeded: true }),
  EntryStored({ revision: 3, succeeded: true }), EntryStored({ revision: 4, succeeded: true }),
  EntryStored({ revision: 1, succeeded: false }), EntryStored({ revision: 2, succeeded: false }),
  EntryOutdated({ revision: 2, latest: { ...C::timedDetails, title: "Changed elsewhere" }, version: "v2" }),
  AdvanceClock({ now: 3 }), AdvanceClock({ now: 5 }), AdvanceClock({ now: 8 }), ShowDueReminder, SnoozeReminder({ until: 7 }), DismissReminder)
pure val seriesVersionValues = Set(-1, 0, 1, 2)
pure val latestValues = C::latestValues
pure val versionValues = C::versionValues
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
  { occurrenceId: "periodA", revision: 2, definitionVersion: -1, schedules: List({ id: "periodA", include: true, startAt: 5, endAt: 6 }), verified: true, persisted: true },
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

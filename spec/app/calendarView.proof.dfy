lemma CalendarUniqueView(v: CalendarView)
  ensures alwaysOccurrenceIsUnique(v) == (forall c :: c in v.entries ==>
    |ProofLib.Filter((other: app__calendar_Calendar) => app__calendar_sameOccurrence(c, other), v.entries)| == 1)
{
}

lemma CalendarUniqueDistinct(v: CalendarView)
  requires alwaysOccurrenceIsUnique(v)
  ensures ProofLib.DistinctBy(v.entries, (c: app__calendar_Calendar) => (c.identity.owner, c.identity.calendarId, c.identity.occurrenceId))
{
  CalendarUniqueView(v);
  forall i, j | 0 <= i < |v.entries| && 0 <= j < |v.entries| && i != j
    ensures (v.entries[i].identity.owner, v.entries[i].identity.calendarId, v.entries[i].identity.occurrenceId) !=
      (v.entries[j].identity.owner, v.entries[j].identity.calendarId, v.entries[j].identity.occurrenceId)
  {
    var c := v.entries[i];
    assert c in v.entries;
    assert |ProofLib.Filter((other: app__calendar_Calendar) => app__calendar_sameOccurrence(c, other), v.entries)| == 1;
    if app__calendar_sameOccurrence(c, v.entries[j]) {
      ProofLib.FilterTwo((other: app__calendar_Calendar) => app__calendar_sameOccurrence(c, other), v.entries, i, j);
    }
  }
}

lemma CalendarSameKey(v: CalendarView, first: app__calendar_Calendar, second: app__calendar_Calendar)
  requires alwaysOccurrenceIsUnique(v)
  requires first in v.entries && second in v.entries
  requires app__calendar_sameOccurrence(first, second)
  ensures first == second
{
  CalendarUniqueDistinct(v);
  var i :| 0 <= i < |v.entries| && v.entries[i] == first;
  var j :| 0 <= j < |v.entries| && v.entries[j] == second;
  assert i == j;
}

lemma CalendarSameEntries(before: CalendarView, after: CalendarView)
  requires alwaysOccurrenceIsUnique(before)
  requires after.entries == before.entries
  ensures stepOccurrenceIdentityIsFixed(before, after)
{
  forall prior, laterEntry | prior in before.entries && laterEntry in after.entries && app__calendar_sameOccurrence(prior, laterEntry)
    ensures prior.identity == laterEntry.identity
  {
    CalendarSameKey(before, prior, laterEntry);
  }
}

lemma CalendarEntryAtView(v: CalendarView, id: string)
  ensures entryAt(v, id) ==
    (if |ProofLib.Filter((c: app__calendar_Calendar) => ((((c.identity.owner == v.owner) && (c.identity.calendarId == v.calendarId)) && (c.identity.occurrenceId == id)) && (!c.phase.Deleted?)), v.entries)| == 1
     then ProofLib.Filter((c: app__calendar_Calendar) => ((((c.identity.owner == v.owner) && (c.identity.calendarId == v.calendarId)) && (c.identity.occurrenceId == id)) && (!c.phase.Deleted?)), v.entries)[0]
     else app__calendar_initial)
{
}

lemma CalendarEntryMember(v: CalendarView, id: string)
  requires alwaysEntriesBelongToCalendar(v)
  requires entryAt(v, id).hasSaved || !entryAt(v, id).phase.Empty?
  ensures entryAt(v, id) in v.entries
  ensures entryAt(v, id).identity.occurrenceId == id
  ensures !entryAt(v, id).phase.Deleted?
  ensures !entryAt(v, id).phase.Empty?
  ensures validStored(entryAt(v, id))
{
  CalendarEntryAtView(v, id);
  var matches := ProofLib.Filter((c: app__calendar_Calendar) => ((((c.identity.owner == v.owner) && (c.identity.calendarId == v.calendarId)) && (c.identity.occurrenceId == id)) && (!c.phase.Deleted?)), v.entries);
  assert |matches| == 1;
  assert entryAt(v, id) == matches[0];
  ProofLib.FilterMember((c: app__calendar_Calendar) => ((((c.identity.owner == v.owner) && (c.identity.calendarId == v.calendarId)) && (c.identity.occurrenceId == id)) && (!c.phase.Deleted?)), v.entries, entryAt(v, id));
}

lemma CalendarEntryFind(v: CalendarView, target: app__calendar_Calendar)
  requires alwaysEntriesBelongToCalendar(v) && alwaysOccurrenceIsUnique(v)
  requires target in v.entries && !target.phase.Deleted?
  ensures entryAt(v, target.identity.occurrenceId) == target
{
  var id := target.identity.occurrenceId;
  CalendarEntryAtView(v, id);
  var i :| 0 <= i < |v.entries| && v.entries[i] == target;
  forall j | 0 <= j < |v.entries| && j != i
    ensures !((((v.entries[j].identity.owner == v.owner) && (v.entries[j].identity.calendarId == v.calendarId)) && (v.entries[j].identity.occurrenceId == id)) && (!v.entries[j].phase.Deleted?))
  {
    if v.entries[j].identity.occurrenceId == id {
      CalendarSameKey(v, target, v.entries[j]);
      CalendarUniqueDistinct(v);
    }
  }
  ProofLib.FilterOne((c: app__calendar_Calendar) => ((((c.identity.owner == v.owner) && (c.identity.calendarId == v.calendarId)) && (c.identity.occurrenceId == id)) && (!c.phase.Deleted?)), v.entries, i);
  ProofLib.FilterMember((c: app__calendar_Calendar) => ((((c.identity.owner == v.owner) && (c.identity.calendarId == v.calendarId)) && (c.identity.occurrenceId == id)) && (!c.phase.Deleted?)), v.entries, target);
}

lemma CalendarChanged(c: app__calendar_Calendar, command: OccurrenceAction, by_: ViewActor)
  requires validStored(c) && !c.phase.Deleted?
  requires mayChangeEntry(c, command, by_)
  ensures app__calendar_validState(changeEntry(c, command))
  ensures changeEntry(c, command).phase.Empty? || validStored(changeEntry(c, command))
  ensures !changeEntry(c, command).phase.Deleted?
  ensures !changeEntry(c, command).phase.Empty? ==> changeEntry(c, command).identity == c.identity
  ensures changeEntry(c, command).phase.Empty? ==> command.CancelEditing? && !c.hasSaved
{
  assert app__calendar_inv(c);
  match command {
    case BeginEditing => app__calendar_beginEdit_ensures(c, app__calendar_CalendarActor.CalendarUser);
    case ChangeDetails(details) => app__calendar_edit_ensures(c, app__calendar_formDetails(c.draft, details), app__calendar_CalendarActor.CalendarUser);
    case CancelEditing => app__calendar_cancelEdit_ensures(c, app__calendar_CalendarActor.CalendarUser);
    case ApproveEntry(revision) => app__calendar_approveSave_ensures(c, revision, app__calendar_CalendarActor.CalendarUser);
    case EntryStored(revision, succeeded) =>
      if succeeded { app__calendar_save_ensures(c, revision, true, app__calendar_CalendarActor.CalendarStore); }
      else { app__calendar_saveFailed_ensures(c, revision, app__calendar_CalendarActor.CalendarStore); }
    case AdvanceClock(now) => app__calendar_advanceTime_ensures(c, now, app__calendar_CalendarActor.CalendarClock);
    case ShowDueReminder => app__calendar_showReminder_ensures(c, app__calendar_CalendarActor.CalendarClock);
    case SnoozeReminder(until) => app__calendar_snooze_ensures(c, until, app__calendar_CalendarActor.CalendarUser);
    case DismissReminder => app__calendar_dismissReminder_ensures(c, app__calendar_CalendarActor.CalendarUser);
  }
}

lemma CalendarCancelledView(v: CalendarView, id: string, command: OccurrenceAction, by_: ViewActor)
  requires ownedEntryResult(v, entryAt(v, id), command).phase.Empty?
  ensures changeOccurrence(v, id, command, by_).entries ==
    ProofLib.Filter((c: app__calendar_Calendar) => (c.identity.occurrenceId != id), v.entries)
  ensures changeOccurrence(v, id, command, by_).cancelledIds ==
    v.cancelledIds + ProofLib.Filter((set_x: string) => !((set_x in v.cancelledIds)), [id])
{
}

lemma CalendarOwned(v: CalendarView, c: app__calendar_Calendar, command: OccurrenceAction, by_: ViewActor)
  requires validStored(c) && !c.phase.Deleted?
  requires mayChangeEntry(c, command, by_)
  ensures app__calendar_validState(ownedEntryResult(v, c, command))
  ensures ownedEntryResult(v, c, command).phase.Empty? || validStored(ownedEntryResult(v, c, command))
  ensures !ownedEntryResult(v, c, command).phase.Deleted?
  ensures !ownedEntryResult(v, c, command).phase.Empty? ==> ownedEntryResult(v, c, command).identity == c.identity
  ensures ownedEntryResult(v, c, command).phase.Empty? ==> command.CancelEditing? && !c.hasSaved
{
  CalendarChanged(c, command, by_);
}

lemma SeriesUniqueView(v: CalendarView)
  requires alwaysSeriesDefinitions(v)
  ensures forall s :: s in v.series ==>
    |ProofLib.Filter((other: SeriesDefinition) => (other.details.seriesId == s.details.seriesId), v.series)| == 1
{
}

lemma SeriesDefinitionView(v: CalendarView)
  ensures alwaysSeriesDefinitions(v) == (forall s :: s in v.series ==>
    s.version >= 0 && s.details.seriesId != "" && app__calendar_validDetails(s.details) &&
    |ProofLib.Filter((other: SeriesDefinition) => (other.details.seriesId == s.details.seriesId), v.series)| == 1)
{
}

lemma SeriesUniqueDistinct(v: CalendarView)
  requires alwaysSeriesDefinitions(v)
  ensures ProofLib.DistinctBy(v.series, (s: SeriesDefinition) => s.details.seriesId)
{
  SeriesUniqueView(v);
  forall i, j | 0 <= i < |v.series| && 0 <= j < |v.series| && i != j
    ensures v.series[i].details.seriesId != v.series[j].details.seriesId
  {
    var s := v.series[i];
    if s.details.seriesId == v.series[j].details.seriesId {
      ProofLib.FilterTwo((other: SeriesDefinition) => (other.details.seriesId == s.details.seriesId), v.series, i, j);
    }
  }
}

lemma SeriesAtView(v: CalendarView, id: string)
  ensures seriesAt(v, id) ==
    (if |ProofLib.Filter((s: SeriesDefinition) => (s.details.seriesId == id), v.series)| > 0
     then ProofLib.Filter((s: SeriesDefinition) => (s.details.seriesId == id), v.series)[0] else noSeries)
{
}

lemma SeriesLookup(v: CalendarView, id: string)
  requires alwaysSeriesDefinitions(v)
  ensures seriesAt(v, id) == noSeries || (seriesAt(v, id) in v.series && seriesAt(v, id).version >= 0 && seriesAt(v, id).details.seriesId == id)
{
  SeriesAtView(v, id);
  if |ProofLib.Filter((s: SeriesDefinition) => (s.details.seriesId == id), v.series)| > 0 {
    assert seriesAt(v, id) in ProofLib.Filter((s: SeriesDefinition) => (s.details.seriesId == id), v.series);
    ProofLib.FilterMember((s: SeriesDefinition) => (s.details.seriesId == id), v.series, seriesAt(v, id));
  }
}

lemma SeriesAtMember(v: CalendarView, id: string)
  requires seriesAt(v, id).version >= 0
  ensures seriesAt(v, id) in v.series
  ensures seriesAt(v, id).details.seriesId == id
{
  SeriesAtView(v, id);
  assert seriesAt(v, id) in ProofLib.Filter((s: SeriesDefinition) => (s.details.seriesId == id), v.series);
  ProofLib.FilterMember((s: SeriesDefinition) => (s.details.seriesId == id), v.series, seriesAt(v, id));
}

lemma SeriesFind(v: CalendarView, definition: SeriesDefinition)
  requires alwaysSeriesDefinitions(v) && definition in v.series
  ensures seriesAt(v, definition.details.seriesId) == definition
{
  SeriesUniqueDistinct(v);
  var id := definition.details.seriesId;
  var i :| 0 <= i < |v.series| && v.series[i] == definition;
  SeriesAtView(v, id);
  ProofLib.FilterOne((s: SeriesDefinition) => (s.details.seriesId == id), v.series, i);
  ProofLib.FilterMember((s: SeriesDefinition) => (s.details.seriesId == id), v.series, definition);
}

lemma SeriesDistinctValid(v: CalendarView)
  requires ProofLib.DistinctBy(v.series, (s: SeriesDefinition) => s.details.seriesId)
  requires forall s :: s in v.series ==> s.version >= 0 && s.details.seriesId != "" && app__calendar_validDetails(s.details)
  ensures alwaysSeriesDefinitions(v)
{
  SeriesDefinitionView(v);
  forall s | s in v.series
    ensures |ProofLib.Filter((other: SeriesDefinition) => (other.details.seriesId == s.details.seriesId), v.series)| == 1
  {
    var i :| 0 <= i < |v.series| && v.series[i] == s;
    ProofLib.FilterOne((other: SeriesDefinition) => (other.details.seriesId == s.details.seriesId), v.series, i);
  }
}

lemma ScheduleView(schedules: seq<OccurrenceSchedule>, id: string)
  ensures scheduleFor(schedules, id) ==
    (if |ProofLib.Filter((s: OccurrenceSchedule) => (s.id == id), schedules)| > 0
     then ProofLib.Filter((s: OccurrenceSchedule) => (s.id == id), schedules)[0] else noSchedule)
{
}

lemma ScheduleMember(schedules: seq<OccurrenceSchedule>, id: string)
  requires exists s :: s in schedules && s.id == id
  requires forall s :: s in schedules && s.include_ ==> s.endAt > s.startAt
  ensures scheduleFor(schedules, id) in schedules
  ensures scheduleFor(schedules, id).id == id
  ensures scheduleFor(schedules, id).include_ ==> scheduleFor(schedules, id).endAt > scheduleFor(schedules, id).startAt
{
  var found :| found in schedules && found.id == id;
  ScheduleView(schedules, id);
  ProofLib.FilterMember((s: OccurrenceSchedule) => (s.id == id), schedules, found);
  assert |ProofLib.Filter((s: OccurrenceSchedule) => (s.id == id), schedules)| > 0;
  assert scheduleFor(schedules, id) in ProofLib.Filter((s: OccurrenceSchedule) => (s.id == id), schedules);
  ProofLib.FilterMember((s: OccurrenceSchedule) => (s.id == id), schedules, scheduleFor(schedules, id));
}

lemma SeriesMember(v: CalendarView, receipt: SeriesReceipt, by_: ViewActor, c: app__calendar_Calendar)
  requires inv(v) && canSaveSeries(v, receipt, by_) && c in v.entries
  ensures validStored(seriesMemberResult(v, c, receipt))
  ensures seriesMemberResult(v, c, receipt).identity == c.identity
  ensures seriesMemberResult(v, c, receipt).phase.Editing? ==> c.identity.occurrenceId == v.selectedId
{
  CalendarEntryMember(v, v.selectedId);
  var selected := selectedOccurrence(v);
  if seriesMemberAffected(v, c) {
    if c.identity.occurrenceId == v.selectedId {
      CalendarSameKey(v, c, selected);
      if receipt.persisted {
        app__calendar_save_ensures(c, receipt.revision, true, app__calendar_CalendarActor.CalendarStore);
      } else {
        app__calendar_saveFailed_ensures(c, receipt.revision, app__calendar_CalendarActor.CalendarStore);
      }
    } else if receipt.persisted {
      assert c.phase.Saved?;
      ScheduleMember(receipt.schedules, c.identity.occurrenceId);
      var schedule := scheduleFor(receipt.schedules, c.identity.occurrenceId);
      if !schedule.include_ {
        app__calendar_requestDelete_ensures(c, app__calendar_CalendarActor.CalendarUser);
        var asking := app__calendar_requestDelete(c, app__calendar_CalendarActor.CalendarUser);
        app__calendar_approveDelete_ensures(asking, app__calendar_CalendarActor.CalendarUser);
        var approved := app__calendar_approveDelete(asking, app__calendar_CalendarActor.CalendarUser);
        app__calendar_confirmDelete_ensures(approved, true, app__calendar_CalendarActor.CalendarStore);
      } else {
        var details := selected.draft.(startAt := schedule.startAt, endAt := schedule.endAt);
        assert app__calendar_validDetails(details);
        app__calendar_beginEdit_ensures(c, app__calendar_CalendarActor.CalendarUser);
        var began := app__calendar_beginEdit(c, app__calendar_CalendarActor.CalendarUser);
        app__calendar_edit_ensures(began, details, app__calendar_CalendarActor.CalendarUser);
        var edited := app__calendar_edit(began, details, app__calendar_CalendarActor.CalendarUser);
        app__calendar_approveSave_ensures(edited, edited.revision, app__calendar_CalendarActor.CalendarUser);
        var approved := app__calendar_approveSave(edited, edited.revision, app__calendar_CalendarActor.CalendarUser);
        app__calendar_save_ensures(approved, approved.revision, true, app__calendar_CalendarActor.CalendarStore);
      }
    }
  }
}

lemma SeriesPutView(definitions: seq<SeriesDefinition>, definition: SeriesDefinition)
  ensures putSeries(definitions, definition) ==
    ProofLib.Filter((s: SeriesDefinition) => (s.details.seriesId != definition.details.seriesId), definitions) + [definition]
{
}

lemma SeriesPut(before: CalendarView, after: CalendarView, definition: SeriesDefinition)
  requires alwaysSeriesDefinitions(before)
  requires definition.version >= 0 && definition.details.seriesId != "" && app__calendar_validDetails(definition.details)
  requires after.series == putSeries(before.series, definition)
  ensures alwaysSeriesDefinitions(after)
  ensures seriesAt(after, definition.details.seriesId) == definition
  ensures forall s :: s in before.series && s.details.seriesId != definition.details.seriesId ==>
    seriesAt(after, s.details.seriesId) == s
{
  SeriesPutView(before.series, definition);
  SeriesUniqueDistinct(before);
  var remaining := ProofLib.Filter((s: SeriesDefinition) => (s.details.seriesId != definition.details.seriesId), before.series);
  ProofLib.FilterSubset((s: SeriesDefinition) => (s.details.seriesId != definition.details.seriesId), before.series);
  ProofLib.FilterKeepsDistinctBy((s: SeriesDefinition) => (s.details.seriesId != definition.details.seriesId), before.series,
    (s: SeriesDefinition) => s.details.seriesId);
  forall s | s in remaining
    ensures s.details.seriesId != definition.details.seriesId
  {
    ProofLib.FilterMember((s: SeriesDefinition) => (s.details.seriesId != definition.details.seriesId), before.series, s);
  }
  ProofLib.DistinctByConcat(remaining, [definition], (s: SeriesDefinition) => s.details.seriesId);
  SeriesDistinctValid(after);
  SeriesFind(after, definition);
  forall s | s in before.series && s.details.seriesId != definition.details.seriesId
    ensures seriesAt(after, s.details.seriesId) == s
  {
    ProofLib.FilterMember((s: SeriesDefinition) => (s.details.seriesId != definition.details.seriesId), before.series, s);
    SeriesFind(after, s);
  }
}

lemma CalendarDistinctUnique(v: CalendarView)
  requires ProofLib.DistinctBy(v.entries, (c: app__calendar_Calendar) => (c.identity.owner, c.identity.calendarId, c.identity.occurrenceId))
  ensures alwaysOccurrenceIsUnique(v)
{
  CalendarUniqueView(v);
  forall c | c in v.entries
    ensures |ProofLib.Filter((other: app__calendar_Calendar) => app__calendar_sameOccurrence(c, other), v.entries)| == 1
  {
    var i :| 0 <= i < |v.entries| && v.entries[i] == c;
    ProofLib.FilterOne((other: app__calendar_Calendar) => app__calendar_sameOccurrence(c, other), v.entries, i);
  }
}

lemma CalendarPublishedView(v: CalendarView, incoming: app__calendar_Calendar, seriesVersion: int, scheduleVerified: bool, by_: ViewActor)
  requires publishAllowed(v, incoming, seriesVersion, scheduleVerified, by_)
  ensures publishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_).entries ==
    ProofLib.Filter((c: app__calendar_Calendar) => !(app__calendar_sameOccurrence(c, incoming)), v.entries) + [incoming]
{
}

lemma CalendarDeletedSeriesView(v: CalendarView, generation: int, succeeded: bool, evidence: string, by_: ViewActor)
  ensures deletionResult(v, generation, succeeded, evidence, by_).deletedSeries ==
    (if succeeded && v.scope.EntireSeries? then
      v.deletedSeries + ProofLib.Filter((set_x: string) => !((set_x in v.deletedSeries)), [selectedOccurrence(v).committed.seriesId])
    else v.deletedSeries)
{
}

lemma PublishAllowedEnsures(v: CalendarView, incoming: app__calendar_Calendar, seriesVersion: int, scheduleVerified: bool, by_: ViewActor)
  ensures (inv(v) ==> publishAllowed(v, incoming, seriesVersion, scheduleVerified, by_) ==> alwaysViewIdentity(publishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_)))
  ensures (inv(v) ==> publishAllowed(v, incoming, seriesVersion, scheduleVerified, by_) ==> alwaysViewWindow(publishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_)))
  ensures (inv(v) ==> publishAllowed(v, incoming, seriesVersion, scheduleVerified, by_) ==> alwaysEntriesBelongToCalendar(publishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_)))
  ensures (inv(v) ==> publishAllowed(v, incoming, seriesVersion, scheduleVerified, by_) ==> alwaysOccurrenceIsUnique(publishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_)))
  ensures (inv(v) ==> publishAllowed(v, incoming, seriesVersion, scheduleVerified, by_) ==> alwaysEditingIsSelected(publishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_)))
  ensures (inv(v) ==> publishAllowed(v, incoming, seriesVersion, scheduleVerified, by_) ==> alwaysCancelledIdsAreAbsent(publishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_)))
  ensures (inv(v) ==> publishAllowed(v, incoming, seriesVersion, scheduleVerified, by_) ==> alwaysSeriesDefinitions(publishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_)))
  ensures (inv(v) ==> publishAllowed(v, incoming, seriesVersion, scheduleVerified, by_) ==> alwaysEntriesUseSeries(publishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_)))
  ensures (inv(v) ==> publishAllowed(v, incoming, seriesVersion, scheduleVerified, by_) ==> alwaysSelectionIsCurrent(publishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_)))
  ensures (inv(v) ==> publishAllowed(v, incoming, seriesVersion, scheduleVerified, by_) ==> alwaysDeletionHasSelection(publishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_)))
  ensures (inv(v) ==> publishAllowed(v, incoming, seriesVersion, scheduleVerified, by_) ==> alwaysDeletedSeriesStayDeleted(publishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_)))
  ensures (inv(v) ==> publishAllowed(v, incoming, seriesVersion, scheduleVerified, by_) ==> alwaysDeletedSeriesIdsAreNonempty(publishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_)))
  ensures (inv(v) ==> publishAllowed(v, incoming, seriesVersion, scheduleVerified, by_) ==> alwaysSeriesDeletionIsRecurring(publishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_)))
  ensures (inv(v) ==> publishAllowed(v, incoming, seriesVersion, scheduleVerified, by_) ==> stepOccurrenceIdentityIsFixed(v, publishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_)))
{
  if inv(v) && publishAllowed(v, incoming, seriesVersion, scheduleVerified, by_) {
    CalendarUniqueDistinct(v);
    CalendarPublishedView(v, incoming, seriesVersion, scheduleVerified, by_);
    var remaining := ProofLib.Filter((c: app__calendar_Calendar) => !(app__calendar_sameOccurrence(c, incoming)), v.entries);
    ProofLib.FilterKeepsDistinctBy((c: app__calendar_Calendar) => !(app__calendar_sameOccurrence(c, incoming)), v.entries,
      (c: app__calendar_Calendar) => (c.identity.owner, c.identity.calendarId, c.identity.occurrenceId));
    ProofLib.FilterSubset((c: app__calendar_Calendar) => !(app__calendar_sameOccurrence(c, incoming)), v.entries);
    forall c | c in remaining
      ensures (c.identity.owner, c.identity.calendarId, c.identity.occurrenceId) !=
        (incoming.identity.owner, incoming.identity.calendarId, incoming.identity.occurrenceId)
    {
      ProofLib.FilterMember((c: app__calendar_Calendar) => !(app__calendar_sameOccurrence(c, incoming)), v.entries, c);
    }
    ProofLib.DistinctByConcat(remaining, [incoming],
      (c: app__calendar_Calendar) => (c.identity.owner, c.identity.calendarId, c.identity.occurrenceId));
    var after := publishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_);
    CalendarDistinctUnique(after);
    assert alwaysEntriesBelongToCalendar(after);
    if incoming.committed.seriesId != "" && seriesAt(v, incoming.committed.seriesId).version == -1 {
      SeriesPut(v, after, SeriesDefinition(0, incoming.committed));
      forall c | c in after.entries && c.hasSaved && !c.phase.Deleted? && c.committed.seriesId != ""
        ensures seriesAt(after, c.committed.seriesId).version >= 0 && sameSeriesFields(c.committed, seriesAt(after, c.committed.seriesId).details)
      {
        if c != incoming {
          ProofLib.FilterMember((c: app__calendar_Calendar) => !(app__calendar_sameOccurrence(c, incoming)), v.entries, c);
          SeriesAtMember(v, c.committed.seriesId);
          assert c.committed.seriesId != incoming.committed.seriesId;
          assert seriesAt(after, c.committed.seriesId) == seriesAt(v, c.committed.seriesId);
        }
      }
    } else {
      assert after.series == v.series;
      forall c | c in after.entries && c.hasSaved && !c.phase.Deleted? && c.committed.seriesId != ""
        ensures seriesAt(after, c.committed.seriesId).version >= 0 && sameSeriesFields(c.committed, seriesAt(after, c.committed.seriesId).details)
      {
        if c == incoming {
          SeriesLookup(v, incoming.committed.seriesId);
        } else {
          ProofLib.FilterMember((c: app__calendar_Calendar) => !(app__calendar_sameOccurrence(c, incoming)), v.entries, c);
        }
      }
    }
    if after.selectedId != "" {
      if incoming.identity.occurrenceId == v.selectedId {
        CalendarEntryFind(after, incoming);
      } else {
        var selected := entryAt(v, v.selectedId);
        CalendarEntryMember(v, v.selectedId);
        ProofLib.FilterMember((c: app__calendar_Calendar) => !(app__calendar_sameOccurrence(c, incoming)), v.entries, selected);
        CalendarEntryFind(after, selected);
      }
    }
  }
}

lemma publishOccurrence_ensures(v: CalendarView, incoming: app__calendar_Calendar, seriesVersion: int, scheduleVerified: bool, by_: ViewActor)
  ensures (inv(v) ==> canPublishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_) ==> alwaysViewIdentity(publishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_)))
  ensures (inv(v) ==> canPublishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_) ==> alwaysViewWindow(publishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_)))
  ensures (inv(v) ==> canPublishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_) ==> alwaysEntriesBelongToCalendar(publishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_)))
  ensures (inv(v) ==> canPublishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_) ==> alwaysOccurrenceIsUnique(publishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_)))
  ensures (inv(v) ==> canPublishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_) ==> alwaysEditingIsSelected(publishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_)))
  ensures (inv(v) ==> canPublishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_) ==> alwaysCancelledIdsAreAbsent(publishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_)))
  ensures (inv(v) ==> canPublishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_) ==> alwaysSeriesDefinitions(publishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_)))
  ensures (inv(v) ==> canPublishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_) ==> alwaysEntriesUseSeries(publishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_)))
  ensures (inv(v) ==> canPublishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_) ==> alwaysSelectionIsCurrent(publishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_)))
  ensures (inv(v) ==> canPublishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_) ==> alwaysDeletionHasSelection(publishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_)))
  ensures (inv(v) ==> canPublishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_) ==> alwaysDeletedSeriesStayDeleted(publishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_)))
  ensures (inv(v) ==> canPublishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_) ==> alwaysDeletedSeriesIdsAreNonempty(publishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_)))
  ensures (inv(v) ==> canPublishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_) ==> alwaysSeriesDeletionIsRecurring(publishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_)))
  ensures (inv(v) ==> canPublishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_) ==> stepOccurrenceIdentityIsFixed(v, publishOccurrence(v, incoming, seriesVersion, scheduleVerified, by_)))
{
  PublishAllowedEnsures(v, incoming, seriesVersion, scheduleVerified, by_);
}

lemma deletionResult_ensures(v: CalendarView, generation: int, succeeded: bool, evidence: string, by_: ViewActor)
  ensures (inv(v) ==> canDeletionResult(v, generation, evidence, by_) ==> alwaysViewIdentity(deletionResult(v, generation, succeeded, evidence, by_)))
  ensures (inv(v) ==> canDeletionResult(v, generation, evidence, by_) ==> alwaysViewWindow(deletionResult(v, generation, succeeded, evidence, by_)))
  ensures (inv(v) ==> canDeletionResult(v, generation, evidence, by_) ==> alwaysEntriesBelongToCalendar(deletionResult(v, generation, succeeded, evidence, by_)))
  ensures (inv(v) ==> canDeletionResult(v, generation, evidence, by_) ==> alwaysOccurrenceIsUnique(deletionResult(v, generation, succeeded, evidence, by_)))
  ensures (inv(v) ==> canDeletionResult(v, generation, evidence, by_) ==> alwaysEditingIsSelected(deletionResult(v, generation, succeeded, evidence, by_)))
  ensures (inv(v) ==> canDeletionResult(v, generation, evidence, by_) ==> alwaysCancelledIdsAreAbsent(deletionResult(v, generation, succeeded, evidence, by_)))
  ensures (inv(v) ==> canDeletionResult(v, generation, evidence, by_) ==> alwaysSeriesDefinitions(deletionResult(v, generation, succeeded, evidence, by_)))
  ensures (inv(v) ==> canDeletionResult(v, generation, evidence, by_) ==> alwaysEntriesUseSeries(deletionResult(v, generation, succeeded, evidence, by_)))
  ensures (inv(v) ==> canDeletionResult(v, generation, evidence, by_) ==> alwaysSelectionIsCurrent(deletionResult(v, generation, succeeded, evidence, by_)))
  ensures (inv(v) ==> canDeletionResult(v, generation, evidence, by_) ==> alwaysDeletionHasSelection(deletionResult(v, generation, succeeded, evidence, by_)))
  ensures (inv(v) ==> canDeletionResult(v, generation, evidence, by_) ==> alwaysDeletedSeriesStayDeleted(deletionResult(v, generation, succeeded, evidence, by_)))
  ensures (inv(v) ==> canDeletionResult(v, generation, evidence, by_) ==> alwaysDeletedSeriesIdsAreNonempty(deletionResult(v, generation, succeeded, evidence, by_)))
  ensures (inv(v) ==> canDeletionResult(v, generation, evidence, by_) ==> alwaysSeriesDeletionIsRecurring(deletionResult(v, generation, succeeded, evidence, by_)))
  ensures (inv(v) ==> canDeletionResult(v, generation, evidence, by_) ==> stepOccurrenceIdentityIsFixed(v, deletionResult(v, generation, succeeded, evidence, by_)))
{
  if inv(v) && canDeletionResult(v, generation, evidence, by_) && succeeded {
    var after := deletionResult(v, generation, succeeded, evidence, by_);
    CalendarEntryMember(v, v.selectedId);
    CalendarUniqueDistinct(v);
    forall i, j | 0 <= i < |after.entries| && 0 <= j < |after.entries| && i != j
      ensures (after.entries[i].identity.owner, after.entries[i].identity.calendarId, after.entries[i].identity.occurrenceId) !=
        (after.entries[j].identity.owner, after.entries[j].identity.calendarId, after.entries[j].identity.occurrenceId)
    {
      assert after.entries[i].identity == v.entries[i].identity;
      assert after.entries[j].identity == v.entries[j].identity;
    }
    CalendarDistinctUnique(after);
    CalendarDeletedSeriesView(v, generation, succeeded, evidence, by_);
    if v.scope.EntireSeries? {
      assert selectedOccurrence(v).hasSaved;
      assert app__calendar_validDetails(selectedOccurrence(v).committed);
      assert selectedOccurrence(v).committed.seriesId != "";
      ProofLib.FilterMember((set_x: string) => !((set_x in v.deletedSeries)), [selectedOccurrence(v).committed.seriesId], "");
    }
    forall prior, laterEntry | prior in v.entries && laterEntry in after.entries && app__calendar_sameOccurrence(prior, laterEntry)
      ensures prior.identity == laterEntry.identity
    {
      var at :| 0 <= at < |after.entries| && after.entries[at] == laterEntry;
      assert laterEntry.identity == v.entries[at].identity;
      CalendarSameKey(v, prior, v.entries[at]);
    }
    forall c | c in after.entries
      ensures validStored(c) && c.identity.owner == v.owner && c.identity.calendarId == v.calendarId
      ensures c.committed.seriesId in after.deletedSeries ==> c.phase.Deleted?
    {
      var i :| 0 <= i < |after.entries| && after.entries[i] == c;
      var prior := v.entries[i];
      assert c == (if deleteMatches(v, prior) then deletedOccurrence(prior) else prior);
      if c.committed.seriesId in after.deletedSeries && !(c.committed.seriesId in v.deletedSeries) {
        ProofLib.FilterMember((set_x: string) => !((set_x in v.deletedSeries)), [selectedOccurrence(v).committed.seriesId], c.committed.seriesId);
      }
    }
  } else if inv(v) && canDeletionResult(v, generation, evidence, by_) {
    CalendarSameEntries(v, deletionResult(v, generation, succeeded, evidence, by_));
  }
}

lemma openCalendar_ensures(v: CalendarView, owner: string, calendarId: string, timezone: string, by_: ViewActor)
  ensures (inv(v) ==> canOpenCalendar(v, owner, calendarId, timezone, by_) ==> alwaysViewIdentity(openCalendar(v, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canOpenCalendar(v, owner, calendarId, timezone, by_) ==> alwaysViewWindow(openCalendar(v, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canOpenCalendar(v, owner, calendarId, timezone, by_) ==> alwaysEntriesBelongToCalendar(openCalendar(v, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canOpenCalendar(v, owner, calendarId, timezone, by_) ==> alwaysOccurrenceIsUnique(openCalendar(v, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canOpenCalendar(v, owner, calendarId, timezone, by_) ==> alwaysEditingIsSelected(openCalendar(v, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canOpenCalendar(v, owner, calendarId, timezone, by_) ==> alwaysCancelledIdsAreAbsent(openCalendar(v, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canOpenCalendar(v, owner, calendarId, timezone, by_) ==> alwaysSeriesDefinitions(openCalendar(v, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canOpenCalendar(v, owner, calendarId, timezone, by_) ==> alwaysEntriesUseSeries(openCalendar(v, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canOpenCalendar(v, owner, calendarId, timezone, by_) ==> alwaysSelectionIsCurrent(openCalendar(v, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canOpenCalendar(v, owner, calendarId, timezone, by_) ==> alwaysDeletionHasSelection(openCalendar(v, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canOpenCalendar(v, owner, calendarId, timezone, by_) ==> alwaysDeletedSeriesStayDeleted(openCalendar(v, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canOpenCalendar(v, owner, calendarId, timezone, by_) ==> alwaysDeletedSeriesIdsAreNonempty(openCalendar(v, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canOpenCalendar(v, owner, calendarId, timezone, by_) ==> alwaysSeriesDeletionIsRecurring(openCalendar(v, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canOpenCalendar(v, owner, calendarId, timezone, by_) ==> stepOccurrenceIdentityIsFixed(v, openCalendar(v, owner, calendarId, timezone, by_)))
{
  if inv(v) && canOpenCalendar(v, owner, calendarId, timezone, by_) {
    CalendarSameEntries(v, openCalendar(v, owner, calendarId, timezone, by_));
  }
}

lemma navigate_ensures(v: CalendarView, report: NavigationReport, by_: ViewActor)
  ensures (inv(v) ==> canNavigate(v, report, by_) ==> alwaysViewIdentity(navigate(v, report, by_)))
  ensures (inv(v) ==> canNavigate(v, report, by_) ==> alwaysViewWindow(navigate(v, report, by_)))
  ensures (inv(v) ==> canNavigate(v, report, by_) ==> alwaysEntriesBelongToCalendar(navigate(v, report, by_)))
  ensures (inv(v) ==> canNavigate(v, report, by_) ==> alwaysOccurrenceIsUnique(navigate(v, report, by_)))
  ensures (inv(v) ==> canNavigate(v, report, by_) ==> alwaysEditingIsSelected(navigate(v, report, by_)))
  ensures (inv(v) ==> canNavigate(v, report, by_) ==> alwaysCancelledIdsAreAbsent(navigate(v, report, by_)))
  ensures (inv(v) ==> canNavigate(v, report, by_) ==> alwaysSeriesDefinitions(navigate(v, report, by_)))
  ensures (inv(v) ==> canNavigate(v, report, by_) ==> alwaysEntriesUseSeries(navigate(v, report, by_)))
  ensures (inv(v) ==> canNavigate(v, report, by_) ==> alwaysSelectionIsCurrent(navigate(v, report, by_)))
  ensures (inv(v) ==> canNavigate(v, report, by_) ==> alwaysDeletionHasSelection(navigate(v, report, by_)))
  ensures (inv(v) ==> canNavigate(v, report, by_) ==> alwaysDeletedSeriesStayDeleted(navigate(v, report, by_)))
  ensures (inv(v) ==> canNavigate(v, report, by_) ==> alwaysDeletedSeriesIdsAreNonempty(navigate(v, report, by_)))
  ensures (inv(v) ==> canNavigate(v, report, by_) ==> alwaysSeriesDeletionIsRecurring(navigate(v, report, by_)))
  ensures (inv(v) ==> canNavigate(v, report, by_) ==> stepOccurrenceIdentityIsFixed(v, navigate(v, report, by_)))
{
  if inv(v) && canNavigate(v, report, by_) {
    CalendarSameEntries(v, navigate(v, report, by_));
  }
}

lemma openOccurrence_ensures(v: CalendarView, id: string, by_: ViewActor)
  ensures (inv(v) ==> canOpenOccurrence(v, id, by_) ==> alwaysViewIdentity(openOccurrence(v, id, by_)))
  ensures (inv(v) ==> canOpenOccurrence(v, id, by_) ==> alwaysViewWindow(openOccurrence(v, id, by_)))
  ensures (inv(v) ==> canOpenOccurrence(v, id, by_) ==> alwaysEntriesBelongToCalendar(openOccurrence(v, id, by_)))
  ensures (inv(v) ==> canOpenOccurrence(v, id, by_) ==> alwaysOccurrenceIsUnique(openOccurrence(v, id, by_)))
  ensures (inv(v) ==> canOpenOccurrence(v, id, by_) ==> alwaysEditingIsSelected(openOccurrence(v, id, by_)))
  ensures (inv(v) ==> canOpenOccurrence(v, id, by_) ==> alwaysCancelledIdsAreAbsent(openOccurrence(v, id, by_)))
  ensures (inv(v) ==> canOpenOccurrence(v, id, by_) ==> alwaysSeriesDefinitions(openOccurrence(v, id, by_)))
  ensures (inv(v) ==> canOpenOccurrence(v, id, by_) ==> alwaysEntriesUseSeries(openOccurrence(v, id, by_)))
  ensures (inv(v) ==> canOpenOccurrence(v, id, by_) ==> alwaysSelectionIsCurrent(openOccurrence(v, id, by_)))
  ensures (inv(v) ==> canOpenOccurrence(v, id, by_) ==> alwaysDeletionHasSelection(openOccurrence(v, id, by_)))
  ensures (inv(v) ==> canOpenOccurrence(v, id, by_) ==> alwaysDeletedSeriesStayDeleted(openOccurrence(v, id, by_)))
  ensures (inv(v) ==> canOpenOccurrence(v, id, by_) ==> alwaysDeletedSeriesIdsAreNonempty(openOccurrence(v, id, by_)))
  ensures (inv(v) ==> canOpenOccurrence(v, id, by_) ==> alwaysSeriesDeletionIsRecurring(openOccurrence(v, id, by_)))
  ensures (inv(v) ==> canOpenOccurrence(v, id, by_) ==> stepOccurrenceIdentityIsFixed(v, openOccurrence(v, id, by_)))
{
  if inv(v) && canOpenOccurrence(v, id, by_) {
    CalendarSameEntries(v, openOccurrence(v, id, by_));
    CalendarEntryMember(v, id);
    CalendarEntryFind(openOccurrence(v, id, by_), entryAt(v, id));
  }
}

lemma backToCalendar_ensures(v: CalendarView, by_: ViewActor)
  ensures (inv(v) ==> canBackToCalendar(v, by_) ==> alwaysViewIdentity(backToCalendar(v, by_)))
  ensures (inv(v) ==> canBackToCalendar(v, by_) ==> alwaysViewWindow(backToCalendar(v, by_)))
  ensures (inv(v) ==> canBackToCalendar(v, by_) ==> alwaysEntriesBelongToCalendar(backToCalendar(v, by_)))
  ensures (inv(v) ==> canBackToCalendar(v, by_) ==> alwaysOccurrenceIsUnique(backToCalendar(v, by_)))
  ensures (inv(v) ==> canBackToCalendar(v, by_) ==> alwaysEditingIsSelected(backToCalendar(v, by_)))
  ensures (inv(v) ==> canBackToCalendar(v, by_) ==> alwaysCancelledIdsAreAbsent(backToCalendar(v, by_)))
  ensures (inv(v) ==> canBackToCalendar(v, by_) ==> alwaysSeriesDefinitions(backToCalendar(v, by_)))
  ensures (inv(v) ==> canBackToCalendar(v, by_) ==> alwaysEntriesUseSeries(backToCalendar(v, by_)))
  ensures (inv(v) ==> canBackToCalendar(v, by_) ==> alwaysSelectionIsCurrent(backToCalendar(v, by_)))
  ensures (inv(v) ==> canBackToCalendar(v, by_) ==> alwaysDeletionHasSelection(backToCalendar(v, by_)))
  ensures (inv(v) ==> canBackToCalendar(v, by_) ==> alwaysDeletedSeriesStayDeleted(backToCalendar(v, by_)))
  ensures (inv(v) ==> canBackToCalendar(v, by_) ==> alwaysDeletedSeriesIdsAreNonempty(backToCalendar(v, by_)))
  ensures (inv(v) ==> canBackToCalendar(v, by_) ==> alwaysSeriesDeletionIsRecurring(backToCalendar(v, by_)))
  ensures (inv(v) ==> canBackToCalendar(v, by_) ==> stepOccurrenceIdentityIsFixed(v, backToCalendar(v, by_)))
{
  if inv(v) && canBackToCalendar(v, by_) {
    CalendarSameEntries(v, backToCalendar(v, by_));
  }
}

lemma requestDeletion_ensures(v: CalendarView, by_: ViewActor)
  ensures (inv(v) ==> canRequestDeletion(v, by_) ==> alwaysViewIdentity(requestDeletion(v, by_)))
  ensures (inv(v) ==> canRequestDeletion(v, by_) ==> alwaysViewWindow(requestDeletion(v, by_)))
  ensures (inv(v) ==> canRequestDeletion(v, by_) ==> alwaysEntriesBelongToCalendar(requestDeletion(v, by_)))
  ensures (inv(v) ==> canRequestDeletion(v, by_) ==> alwaysOccurrenceIsUnique(requestDeletion(v, by_)))
  ensures (inv(v) ==> canRequestDeletion(v, by_) ==> alwaysEditingIsSelected(requestDeletion(v, by_)))
  ensures (inv(v) ==> canRequestDeletion(v, by_) ==> alwaysCancelledIdsAreAbsent(requestDeletion(v, by_)))
  ensures (inv(v) ==> canRequestDeletion(v, by_) ==> alwaysSeriesDefinitions(requestDeletion(v, by_)))
  ensures (inv(v) ==> canRequestDeletion(v, by_) ==> alwaysEntriesUseSeries(requestDeletion(v, by_)))
  ensures (inv(v) ==> canRequestDeletion(v, by_) ==> alwaysSelectionIsCurrent(requestDeletion(v, by_)))
  ensures (inv(v) ==> canRequestDeletion(v, by_) ==> alwaysDeletionHasSelection(requestDeletion(v, by_)))
  ensures (inv(v) ==> canRequestDeletion(v, by_) ==> alwaysDeletedSeriesStayDeleted(requestDeletion(v, by_)))
  ensures (inv(v) ==> canRequestDeletion(v, by_) ==> alwaysDeletedSeriesIdsAreNonempty(requestDeletion(v, by_)))
  ensures (inv(v) ==> canRequestDeletion(v, by_) ==> alwaysSeriesDeletionIsRecurring(requestDeletion(v, by_)))
  ensures (inv(v) ==> canRequestDeletion(v, by_) ==> stepOccurrenceIdentityIsFixed(v, requestDeletion(v, by_)))
{
  if inv(v) && canRequestDeletion(v, by_) {
    CalendarSameEntries(v, requestDeletion(v, by_));
  }
}

lemma keepOccurrence_ensures(v: CalendarView, by_: ViewActor)
  ensures (inv(v) ==> canKeepOccurrence(v, by_) ==> alwaysViewIdentity(keepOccurrence(v, by_)))
  ensures (inv(v) ==> canKeepOccurrence(v, by_) ==> alwaysViewWindow(keepOccurrence(v, by_)))
  ensures (inv(v) ==> canKeepOccurrence(v, by_) ==> alwaysEntriesBelongToCalendar(keepOccurrence(v, by_)))
  ensures (inv(v) ==> canKeepOccurrence(v, by_) ==> alwaysOccurrenceIsUnique(keepOccurrence(v, by_)))
  ensures (inv(v) ==> canKeepOccurrence(v, by_) ==> alwaysEditingIsSelected(keepOccurrence(v, by_)))
  ensures (inv(v) ==> canKeepOccurrence(v, by_) ==> alwaysCancelledIdsAreAbsent(keepOccurrence(v, by_)))
  ensures (inv(v) ==> canKeepOccurrence(v, by_) ==> alwaysSeriesDefinitions(keepOccurrence(v, by_)))
  ensures (inv(v) ==> canKeepOccurrence(v, by_) ==> alwaysEntriesUseSeries(keepOccurrence(v, by_)))
  ensures (inv(v) ==> canKeepOccurrence(v, by_) ==> alwaysSelectionIsCurrent(keepOccurrence(v, by_)))
  ensures (inv(v) ==> canKeepOccurrence(v, by_) ==> alwaysDeletionHasSelection(keepOccurrence(v, by_)))
  ensures (inv(v) ==> canKeepOccurrence(v, by_) ==> alwaysDeletedSeriesStayDeleted(keepOccurrence(v, by_)))
  ensures (inv(v) ==> canKeepOccurrence(v, by_) ==> alwaysDeletedSeriesIdsAreNonempty(keepOccurrence(v, by_)))
  ensures (inv(v) ==> canKeepOccurrence(v, by_) ==> alwaysSeriesDeletionIsRecurring(keepOccurrence(v, by_)))
  ensures (inv(v) ==> canKeepOccurrence(v, by_) ==> stepOccurrenceIdentityIsFixed(v, keepOccurrence(v, by_)))
{
  if inv(v) && canKeepOccurrence(v, by_) {
    CalendarSameEntries(v, keepOccurrence(v, by_));
  }
}

lemma approveDeletion_ensures(v: CalendarView, scope: DeleteScope, by_: ViewActor)
  ensures (inv(v) ==> canApproveDeletion(v, scope, by_) ==> alwaysViewIdentity(approveDeletion(v, scope, by_)))
  ensures (inv(v) ==> canApproveDeletion(v, scope, by_) ==> alwaysViewWindow(approveDeletion(v, scope, by_)))
  ensures (inv(v) ==> canApproveDeletion(v, scope, by_) ==> alwaysEntriesBelongToCalendar(approveDeletion(v, scope, by_)))
  ensures (inv(v) ==> canApproveDeletion(v, scope, by_) ==> alwaysOccurrenceIsUnique(approveDeletion(v, scope, by_)))
  ensures (inv(v) ==> canApproveDeletion(v, scope, by_) ==> alwaysEditingIsSelected(approveDeletion(v, scope, by_)))
  ensures (inv(v) ==> canApproveDeletion(v, scope, by_) ==> alwaysCancelledIdsAreAbsent(approveDeletion(v, scope, by_)))
  ensures (inv(v) ==> canApproveDeletion(v, scope, by_) ==> alwaysSeriesDefinitions(approveDeletion(v, scope, by_)))
  ensures (inv(v) ==> canApproveDeletion(v, scope, by_) ==> alwaysEntriesUseSeries(approveDeletion(v, scope, by_)))
  ensures (inv(v) ==> canApproveDeletion(v, scope, by_) ==> alwaysSelectionIsCurrent(approveDeletion(v, scope, by_)))
  ensures (inv(v) ==> canApproveDeletion(v, scope, by_) ==> alwaysDeletionHasSelection(approveDeletion(v, scope, by_)))
  ensures (inv(v) ==> canApproveDeletion(v, scope, by_) ==> alwaysDeletedSeriesStayDeleted(approveDeletion(v, scope, by_)))
  ensures (inv(v) ==> canApproveDeletion(v, scope, by_) ==> alwaysDeletedSeriesIdsAreNonempty(approveDeletion(v, scope, by_)))
  ensures (inv(v) ==> canApproveDeletion(v, scope, by_) ==> alwaysSeriesDeletionIsRecurring(approveDeletion(v, scope, by_)))
  ensures (inv(v) ==> canApproveDeletion(v, scope, by_) ==> stepOccurrenceIdentityIsFixed(v, approveDeletion(v, scope, by_)))
{
  if inv(v) && canApproveDeletion(v, scope, by_) {
    CalendarSameEntries(v, approveDeletion(v, scope, by_));
  }
}

lemma createOccurrence_ensures(v: CalendarView, entry: EntrySeed, by_: ViewActor)
  ensures (inv(v) ==> canCreateOccurrence(v, entry, by_) ==> alwaysViewIdentity(createOccurrence(v, entry, by_)))
  ensures (inv(v) ==> canCreateOccurrence(v, entry, by_) ==> alwaysViewWindow(createOccurrence(v, entry, by_)))
  ensures (inv(v) ==> canCreateOccurrence(v, entry, by_) ==> alwaysEntriesBelongToCalendar(createOccurrence(v, entry, by_)))
  ensures (inv(v) ==> canCreateOccurrence(v, entry, by_) ==> alwaysOccurrenceIsUnique(createOccurrence(v, entry, by_)))
  ensures (inv(v) ==> canCreateOccurrence(v, entry, by_) ==> alwaysEditingIsSelected(createOccurrence(v, entry, by_)))
  ensures (inv(v) ==> canCreateOccurrence(v, entry, by_) ==> alwaysCancelledIdsAreAbsent(createOccurrence(v, entry, by_)))
  ensures (inv(v) ==> canCreateOccurrence(v, entry, by_) ==> alwaysSeriesDefinitions(createOccurrence(v, entry, by_)))
  ensures (inv(v) ==> canCreateOccurrence(v, entry, by_) ==> alwaysEntriesUseSeries(createOccurrence(v, entry, by_)))
  ensures (inv(v) ==> canCreateOccurrence(v, entry, by_) ==> alwaysSelectionIsCurrent(createOccurrence(v, entry, by_)))
  ensures (inv(v) ==> canCreateOccurrence(v, entry, by_) ==> alwaysDeletionHasSelection(createOccurrence(v, entry, by_)))
  ensures (inv(v) ==> canCreateOccurrence(v, entry, by_) ==> alwaysDeletedSeriesStayDeleted(createOccurrence(v, entry, by_)))
  ensures (inv(v) ==> canCreateOccurrence(v, entry, by_) ==> alwaysDeletedSeriesIdsAreNonempty(createOccurrence(v, entry, by_)))
  ensures (inv(v) ==> canCreateOccurrence(v, entry, by_) ==> alwaysSeriesDeletionIsRecurring(createOccurrence(v, entry, by_)))
  ensures (inv(v) ==> canCreateOccurrence(v, entry, by_) ==> stepOccurrenceIdentityIsFixed(v, createOccurrence(v, entry, by_)))
{
  if inv(v) && canCreateOccurrence(v, entry, by_) {
    var created := app__calendar_create(app__calendar_initial, entry.identity, entry.details, app__calendar_CalendarActor.CalendarUser);
    var after := createOccurrence(v, entry, by_);
    app__calendar_initialHolds_ensures();
    app__calendar_create_ensures(app__calendar_initial, entry.identity, entry.details, app__calendar_CalendarActor.CalendarUser);
    CalendarUniqueDistinct(v);
    ProofLib.DistinctByConcat(v.entries, [created], (c: app__calendar_Calendar) => (c.identity.owner, c.identity.calendarId, c.identity.occurrenceId));
    CalendarDistinctUnique(after);
    assert alwaysEntriesBelongToCalendar(after);
    CalendarEntryFind(after, created);
    forall prior, laterEntry | prior in v.entries && laterEntry in after.entries && app__calendar_sameOccurrence(prior, laterEntry)
      ensures prior.identity == laterEntry.identity
    {
      assert laterEntry != created;
      assert laterEntry in v.entries;
      CalendarSameKey(v, prior, laterEntry);
    }
  }
}

lemma changeOccurrence_ensures(v: CalendarView, id: string, command: OccurrenceAction, by_: ViewActor)
  ensures (inv(v) ==> canChangeOccurrence(v, id, command, by_) ==> alwaysViewIdentity(changeOccurrence(v, id, command, by_)))
  ensures (inv(v) ==> canChangeOccurrence(v, id, command, by_) ==> alwaysViewWindow(changeOccurrence(v, id, command, by_)))
  ensures (inv(v) ==> canChangeOccurrence(v, id, command, by_) ==> alwaysEntriesBelongToCalendar(changeOccurrence(v, id, command, by_)))
  ensures (inv(v) ==> canChangeOccurrence(v, id, command, by_) ==> alwaysOccurrenceIsUnique(changeOccurrence(v, id, command, by_)))
  ensures (inv(v) ==> canChangeOccurrence(v, id, command, by_) ==> alwaysEditingIsSelected(changeOccurrence(v, id, command, by_)))
  ensures (inv(v) ==> canChangeOccurrence(v, id, command, by_) ==> alwaysCancelledIdsAreAbsent(changeOccurrence(v, id, command, by_)))
  ensures (inv(v) ==> canChangeOccurrence(v, id, command, by_) ==> alwaysSeriesDefinitions(changeOccurrence(v, id, command, by_)))
  ensures (inv(v) ==> canChangeOccurrence(v, id, command, by_) ==> alwaysEntriesUseSeries(changeOccurrence(v, id, command, by_)))
  ensures (inv(v) ==> canChangeOccurrence(v, id, command, by_) ==> alwaysSelectionIsCurrent(changeOccurrence(v, id, command, by_)))
  ensures (inv(v) ==> canChangeOccurrence(v, id, command, by_) ==> alwaysDeletionHasSelection(changeOccurrence(v, id, command, by_)))
  ensures (inv(v) ==> canChangeOccurrence(v, id, command, by_) ==> alwaysDeletedSeriesStayDeleted(changeOccurrence(v, id, command, by_)))
  ensures (inv(v) ==> canChangeOccurrence(v, id, command, by_) ==> alwaysDeletedSeriesIdsAreNonempty(changeOccurrence(v, id, command, by_)))
  ensures (inv(v) ==> canChangeOccurrence(v, id, command, by_) ==> alwaysSeriesDeletionIsRecurring(changeOccurrence(v, id, command, by_)))
  ensures (inv(v) ==> canChangeOccurrence(v, id, command, by_) ==> stepOccurrenceIdentityIsFixed(v, changeOccurrence(v, id, command, by_)))
{
  if inv(v) && canChangeOccurrence(v, id, command, by_) {
    var before := entryAt(v, id);
    CalendarEntryMember(v, id);
    CalendarOwned(v, before, command, by_);
    CalendarUniqueDistinct(v);
    var updated := ownedEntryResult(v, before, command);
    var after := changeOccurrence(v, id, command, by_);
    if updated.phase.Empty? {
      assert v.selectedId == id;
      CalendarCancelledView(v, id, command, by_);
      ProofLib.FilterSubset((c: app__calendar_Calendar) => (c.identity.occurrenceId != id), v.entries);
      ProofLib.FilterKeepsDistinctBy((c: app__calendar_Calendar) => (c.identity.occurrenceId != id), v.entries,
        (c: app__calendar_Calendar) => (c.identity.owner, c.identity.calendarId, c.identity.occurrenceId));
      CalendarDistinctUnique(after);
      forall c | c in after.entries
        ensures c in v.entries && c.identity.occurrenceId != id
        ensures !(c.identity.occurrenceId in after.cancelledIds)
      {
        ProofLib.FilterMember((c: app__calendar_Calendar) => (c.identity.occurrenceId != id), v.entries, c);
        if c.identity.occurrenceId in after.cancelledIds && !(c.identity.occurrenceId in v.cancelledIds) {
          ProofLib.FilterMember((set_x: string) => !((set_x in v.cancelledIds)), [id], c.identity.occurrenceId);
        }
      }
      forall prior, laterEntry | prior in v.entries && laterEntry in after.entries && app__calendar_sameOccurrence(prior, laterEntry)
        ensures prior.identity == laterEntry.identity
      {
        CalendarSameKey(v, prior, laterEntry);
      }
    } else {
      forall i | 0 <= i < |v.entries|
        ensures after.entries[i].identity == v.entries[i].identity
        ensures validStored(after.entries[i])
        ensures after.entries[i].phase.Editing? ==>
          (v.opened_ || after.entries[i].approvedRevision != -1 || after.entries[i].storageError.SaveFailure?) &&
          after.entries[i].identity.occurrenceId == v.selectedId
        ensures after.entries[i].committed.seriesId in v.deletedSeries ==> after.entries[i].phase.Deleted?
      {
        var prior := v.entries[i];
        if prior.identity.occurrenceId == id {
          CalendarSameKey(v, before, prior);
          assert after.entries[i] == updated;
        } else { assert after.entries[i] == prior; }
      }
      forall i, j | 0 <= i < |after.entries| && 0 <= j < |after.entries| && i != j
        ensures (after.entries[i].identity.owner, after.entries[i].identity.calendarId, after.entries[i].identity.occurrenceId) !=
          (after.entries[j].identity.owner, after.entries[j].identity.calendarId, after.entries[j].identity.occurrenceId)
      {
      }
      CalendarDistinctUnique(after);
      assert alwaysEntriesBelongToCalendar(after);
      if after.selectedId != "" {
        var selected := entryAt(v, v.selectedId);
        CalendarEntryMember(v, v.selectedId);
        var at :| 0 <= at < |v.entries| && v.entries[at] == selected;
        CalendarEntryFind(after, after.entries[at]);
      }
      forall prior, laterEntry | prior in v.entries && laterEntry in after.entries && app__calendar_sameOccurrence(prior, laterEntry)
        ensures prior.identity == laterEntry.identity
      {
        var at :| 0 <= at < |after.entries| && after.entries[at] == laterEntry;
        CalendarSameKey(v, prior, v.entries[at]);
      }
    }
  }
}

lemma saveSeries_ensures(v: CalendarView, receipt: SeriesReceipt, by_: ViewActor)
  ensures (inv(v) ==> canSaveSeries(v, receipt, by_) ==> alwaysViewIdentity(saveSeries(v, receipt, by_)))
  ensures (inv(v) ==> canSaveSeries(v, receipt, by_) ==> alwaysViewWindow(saveSeries(v, receipt, by_)))
  ensures (inv(v) ==> canSaveSeries(v, receipt, by_) ==> alwaysEntriesBelongToCalendar(saveSeries(v, receipt, by_)))
  ensures (inv(v) ==> canSaveSeries(v, receipt, by_) ==> alwaysOccurrenceIsUnique(saveSeries(v, receipt, by_)))
  ensures (inv(v) ==> canSaveSeries(v, receipt, by_) ==> alwaysEditingIsSelected(saveSeries(v, receipt, by_)))
  ensures (inv(v) ==> canSaveSeries(v, receipt, by_) ==> alwaysCancelledIdsAreAbsent(saveSeries(v, receipt, by_)))
  ensures (inv(v) ==> canSaveSeries(v, receipt, by_) ==> alwaysSeriesDefinitions(saveSeries(v, receipt, by_)))
  ensures (inv(v) ==> canSaveSeries(v, receipt, by_) ==> alwaysEntriesUseSeries(saveSeries(v, receipt, by_)))
  ensures (inv(v) ==> canSaveSeries(v, receipt, by_) ==> alwaysSelectionIsCurrent(saveSeries(v, receipt, by_)))
  ensures (inv(v) ==> canSaveSeries(v, receipt, by_) ==> alwaysDeletionHasSelection(saveSeries(v, receipt, by_)))
  ensures (inv(v) ==> canSaveSeries(v, receipt, by_) ==> alwaysDeletedSeriesStayDeleted(saveSeries(v, receipt, by_)))
  ensures (inv(v) ==> canSaveSeries(v, receipt, by_) ==> alwaysDeletedSeriesIdsAreNonempty(saveSeries(v, receipt, by_)))
  ensures (inv(v) ==> canSaveSeries(v, receipt, by_) ==> alwaysSeriesDeletionIsRecurring(saveSeries(v, receipt, by_)))
  ensures (inv(v) ==> canSaveSeries(v, receipt, by_) ==> stepOccurrenceIdentityIsFixed(v, saveSeries(v, receipt, by_)))
{
  if inv(v) && canSaveSeries(v, receipt, by_) {
    CalendarEntryMember(v, v.selectedId);
    var selected := selectedOccurrence(v);
    var after := saveSeries(v, receipt, by_);
    if receipt.persisted {
      var definition := SeriesDefinition(receipt.definitionVersion + 1, selected.draft);
      SeriesLookup(v, seriesTarget(v));
      if seriesAt(v, seriesTarget(v)).version != -1 {
        SeriesAtMember(v, seriesTarget(v));
      }
      SeriesPut(v, after, definition);
    }
    CalendarUniqueDistinct(v);
    forall i | 0 <= i < |v.entries|
      ensures after.entries[i].identity == v.entries[i].identity
      ensures validStored(after.entries[i])
    {
      SeriesMember(v, receipt, by_, v.entries[i]);
    }
    forall i, j | 0 <= i < |after.entries| && 0 <= j < |after.entries| && i != j
      ensures (after.entries[i].identity.owner, after.entries[i].identity.calendarId, after.entries[i].identity.occurrenceId) !=
        (after.entries[j].identity.owner, after.entries[j].identity.calendarId, after.entries[j].identity.occurrenceId)
    {
    }
    CalendarDistinctUnique(after);
    assert alwaysEntriesBelongToCalendar(after);
    var at :| 0 <= at < |v.entries| && v.entries[at] == selected;
    CalendarEntryFind(after, after.entries[at]);
    forall prior, laterEntry | prior in v.entries && laterEntry in after.entries && app__calendar_sameOccurrence(prior, laterEntry)
      ensures prior.identity == laterEntry.identity
    {
      var at :| 0 <= at < |after.entries| && after.entries[at] == laterEntry;
      CalendarSameKey(v, prior, v.entries[at]);
    }
    forall c | c in after.entries
      ensures c.phase.Editing? ==> c.identity.occurrenceId == v.selectedId
      ensures c.committed.seriesId in v.deletedSeries ==> c.phase.Deleted?
      ensures c.hasSaved && !c.phase.Deleted? && c.committed.seriesId != "" ==>
        seriesAt(after, c.committed.seriesId).version >= 0 && sameSeriesFields(c.committed, seriesAt(after, c.committed.seriesId).details)
    {
      var i :| 0 <= i < |after.entries| && after.entries[i] == c;
      var prior := v.entries[i];
      SeriesMember(v, receipt, by_, prior);
      if receipt.persisted && seriesMemberAffected(v, prior) {
        ScheduleMember(receipt.schedules, prior.identity.occurrenceId);
      } else if prior.hasSaved && !prior.phase.Deleted? && prior.committed.seriesId != "" {
        SeriesAtMember(v, prior.committed.seriesId);
        var definition := seriesAt(v, prior.committed.seriesId);
        if receipt.persisted {
          assert definition.details.seriesId != seriesTarget(v);
          assert seriesAt(after, prior.committed.seriesId) == definition;
        }
      }
    }
  }
}

lemma closeCalendar_ensures(v: CalendarView, by_: ViewActor)
  ensures (inv(v) ==> canCloseCalendar(v, by_) ==> alwaysViewIdentity(closeCalendar(v, by_)))
  ensures (inv(v) ==> canCloseCalendar(v, by_) ==> alwaysViewWindow(closeCalendar(v, by_)))
  ensures (inv(v) ==> canCloseCalendar(v, by_) ==> alwaysEntriesBelongToCalendar(closeCalendar(v, by_)))
  ensures (inv(v) ==> canCloseCalendar(v, by_) ==> alwaysOccurrenceIsUnique(closeCalendar(v, by_)))
  ensures (inv(v) ==> canCloseCalendar(v, by_) ==> alwaysEditingIsSelected(closeCalendar(v, by_)))
  ensures (inv(v) ==> canCloseCalendar(v, by_) ==> alwaysCancelledIdsAreAbsent(closeCalendar(v, by_)))
  ensures (inv(v) ==> canCloseCalendar(v, by_) ==> alwaysSeriesDefinitions(closeCalendar(v, by_)))
  ensures (inv(v) ==> canCloseCalendar(v, by_) ==> alwaysEntriesUseSeries(closeCalendar(v, by_)))
  ensures (inv(v) ==> canCloseCalendar(v, by_) ==> alwaysSelectionIsCurrent(closeCalendar(v, by_)))
  ensures (inv(v) ==> canCloseCalendar(v, by_) ==> alwaysDeletionHasSelection(closeCalendar(v, by_)))
  ensures (inv(v) ==> canCloseCalendar(v, by_) ==> alwaysDeletedSeriesStayDeleted(closeCalendar(v, by_)))
  ensures (inv(v) ==> canCloseCalendar(v, by_) ==> alwaysDeletedSeriesIdsAreNonempty(closeCalendar(v, by_)))
  ensures (inv(v) ==> canCloseCalendar(v, by_) ==> alwaysSeriesDeletionIsRecurring(closeCalendar(v, by_)))
  ensures (inv(v) ==> canCloseCalendar(v, by_) ==> stepOccurrenceIdentityIsFixed(v, closeCalendar(v, by_)))
{
  if inv(v) && canCloseCalendar(v, by_) {
    if hasEditing(v) {
      var editing :| editing in v.entries && editing.phase.Editing?;
      CalendarEntryFind(v, editing);
      if editing.approvedRevision == -1 {
        assert canChangeOccurrence(v, v.selectedId, OccurrenceAction.CancelEditing, by_);
        changeOccurrence_ensures(v, v.selectedId, OccurrenceAction.CancelEditing, by_);
        var cancelled := changeOccurrence(v, v.selectedId, OccurrenceAction.CancelEditing, by_);
        assert !hasEditing(cancelled);
      } else {
        CalendarSameEntries(v, closeCalendar(v, by_));
        forall c | c in v.entries && c.phase.Editing?
          ensures c == editing
        {
          CalendarSameKey(v, c, editing);
        }
      }
    } else {
      CalendarSameEntries(v, closeCalendar(v, by_));
    }
  }
}

lemma confirmAppointment_ensures(v: CalendarView, request: ConfirmedAppointment, by_: ViewActor)
  ensures (inv(v) ==> canConfirmAppointment(v, request, by_) ==> alwaysViewIdentity(confirmAppointment(v, request, by_)))
  ensures (inv(v) ==> canConfirmAppointment(v, request, by_) ==> alwaysViewWindow(confirmAppointment(v, request, by_)))
  ensures (inv(v) ==> canConfirmAppointment(v, request, by_) ==> alwaysEntriesBelongToCalendar(confirmAppointment(v, request, by_)))
  ensures (inv(v) ==> canConfirmAppointment(v, request, by_) ==> alwaysOccurrenceIsUnique(confirmAppointment(v, request, by_)))
  ensures (inv(v) ==> canConfirmAppointment(v, request, by_) ==> alwaysEditingIsSelected(confirmAppointment(v, request, by_)))
  ensures (inv(v) ==> canConfirmAppointment(v, request, by_) ==> alwaysCancelledIdsAreAbsent(confirmAppointment(v, request, by_)))
  ensures (inv(v) ==> canConfirmAppointment(v, request, by_) ==> alwaysSeriesDefinitions(confirmAppointment(v, request, by_)))
  ensures (inv(v) ==> canConfirmAppointment(v, request, by_) ==> alwaysEntriesUseSeries(confirmAppointment(v, request, by_)))
  ensures (inv(v) ==> canConfirmAppointment(v, request, by_) ==> alwaysSelectionIsCurrent(confirmAppointment(v, request, by_)))
  ensures (inv(v) ==> canConfirmAppointment(v, request, by_) ==> alwaysDeletionHasSelection(confirmAppointment(v, request, by_)))
  ensures (inv(v) ==> canConfirmAppointment(v, request, by_) ==> alwaysDeletedSeriesStayDeleted(confirmAppointment(v, request, by_)))
  ensures (inv(v) ==> canConfirmAppointment(v, request, by_) ==> alwaysDeletedSeriesIdsAreNonempty(confirmAppointment(v, request, by_)))
  ensures (inv(v) ==> canConfirmAppointment(v, request, by_) ==> alwaysSeriesDeletionIsRecurring(confirmAppointment(v, request, by_)))
  ensures (inv(v) ==> canConfirmAppointment(v, request, by_) ==> stepOccurrenceIdentityIsFixed(v, confirmAppointment(v, request, by_)))
{
  if inv(v) && canConfirmAppointment(v, request, by_) {
    var created := app__calendar_create(app__calendar_initial, request.entry.identity, request.entry.details, app__calendar_CalendarActor.CalendarUser);
    var approved := app__calendar_approveSave(created, created.revision, app__calendar_CalendarActor.CalendarUser);
    var after := confirmAppointment(v, request, by_);
    app__calendar_initialHolds_ensures();
    app__calendar_create_ensures(app__calendar_initial, request.entry.identity, request.entry.details, app__calendar_CalendarActor.CalendarUser);
    app__calendar_approveSave_ensures(created, created.revision, app__calendar_CalendarActor.CalendarUser);
    CalendarUniqueDistinct(v);
    ProofLib.DistinctByConcat(v.entries, [approved], (c: app__calendar_Calendar) => (c.identity.owner, c.identity.calendarId, c.identity.occurrenceId));
    CalendarDistinctUnique(after);
    assert alwaysEntriesBelongToCalendar(after);
    CalendarEntryFind(after, approved);
    forall prior, laterEntry | prior in v.entries && laterEntry in after.entries && app__calendar_sameOccurrence(prior, laterEntry)
      ensures prior.identity == laterEntry.identity
    {
      assert laterEntry != approved;
      assert laterEntry in v.entries;
      CalendarSameKey(v, prior, laterEntry);
    }
  }
}

lemma importBillOccurrence_ensures(v: CalendarView, entry: EntrySeed, billEvidence: BillEvidence, scheduleVerified: bool, by_: ViewActor)
  ensures (inv(v) ==> canImportBillOccurrence(v, entry, billEvidence, scheduleVerified, by_) ==> alwaysViewIdentity(importBillOccurrence(v, entry, billEvidence, scheduleVerified, by_)))
  ensures (inv(v) ==> canImportBillOccurrence(v, entry, billEvidence, scheduleVerified, by_) ==> alwaysViewWindow(importBillOccurrence(v, entry, billEvidence, scheduleVerified, by_)))
  ensures (inv(v) ==> canImportBillOccurrence(v, entry, billEvidence, scheduleVerified, by_) ==> alwaysEntriesBelongToCalendar(importBillOccurrence(v, entry, billEvidence, scheduleVerified, by_)))
  ensures (inv(v) ==> canImportBillOccurrence(v, entry, billEvidence, scheduleVerified, by_) ==> alwaysOccurrenceIsUnique(importBillOccurrence(v, entry, billEvidence, scheduleVerified, by_)))
  ensures (inv(v) ==> canImportBillOccurrence(v, entry, billEvidence, scheduleVerified, by_) ==> alwaysEditingIsSelected(importBillOccurrence(v, entry, billEvidence, scheduleVerified, by_)))
  ensures (inv(v) ==> canImportBillOccurrence(v, entry, billEvidence, scheduleVerified, by_) ==> alwaysCancelledIdsAreAbsent(importBillOccurrence(v, entry, billEvidence, scheduleVerified, by_)))
  ensures (inv(v) ==> canImportBillOccurrence(v, entry, billEvidence, scheduleVerified, by_) ==> alwaysSeriesDefinitions(importBillOccurrence(v, entry, billEvidence, scheduleVerified, by_)))
  ensures (inv(v) ==> canImportBillOccurrence(v, entry, billEvidence, scheduleVerified, by_) ==> alwaysEntriesUseSeries(importBillOccurrence(v, entry, billEvidence, scheduleVerified, by_)))
  ensures (inv(v) ==> canImportBillOccurrence(v, entry, billEvidence, scheduleVerified, by_) ==> alwaysSelectionIsCurrent(importBillOccurrence(v, entry, billEvidence, scheduleVerified, by_)))
  ensures (inv(v) ==> canImportBillOccurrence(v, entry, billEvidence, scheduleVerified, by_) ==> alwaysDeletionHasSelection(importBillOccurrence(v, entry, billEvidence, scheduleVerified, by_)))
  ensures (inv(v) ==> canImportBillOccurrence(v, entry, billEvidence, scheduleVerified, by_) ==> alwaysDeletedSeriesStayDeleted(importBillOccurrence(v, entry, billEvidence, scheduleVerified, by_)))
  ensures (inv(v) ==> canImportBillOccurrence(v, entry, billEvidence, scheduleVerified, by_) ==> alwaysDeletedSeriesIdsAreNonempty(importBillOccurrence(v, entry, billEvidence, scheduleVerified, by_)))
  ensures (inv(v) ==> canImportBillOccurrence(v, entry, billEvidence, scheduleVerified, by_) ==> alwaysSeriesDeletionIsRecurring(importBillOccurrence(v, entry, billEvidence, scheduleVerified, by_)))
  ensures (inv(v) ==> canImportBillOccurrence(v, entry, billEvidence, scheduleVerified, by_) ==> stepOccurrenceIdentityIsFixed(v, importBillOccurrence(v, entry, billEvidence, scheduleVerified, by_)))
{
  if inv(v) && canImportBillOccurrence(v, entry, billEvidence, scheduleVerified, by_) {
    PublishAllowedEnsures(v, importedBill(entry), importVersion(v, entry), scheduleVerified, by_);
  }
}

lemma openReminder_ensures(v: CalendarView, id: string, owner: string, calendarId: string, timezone: string, by_: ViewActor)
  ensures (inv(v) ==> canOpenReminder(v, id, owner, calendarId, timezone, by_) ==> alwaysViewIdentity(openReminder(v, id, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canOpenReminder(v, id, owner, calendarId, timezone, by_) ==> alwaysViewWindow(openReminder(v, id, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canOpenReminder(v, id, owner, calendarId, timezone, by_) ==> alwaysEntriesBelongToCalendar(openReminder(v, id, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canOpenReminder(v, id, owner, calendarId, timezone, by_) ==> alwaysOccurrenceIsUnique(openReminder(v, id, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canOpenReminder(v, id, owner, calendarId, timezone, by_) ==> alwaysEditingIsSelected(openReminder(v, id, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canOpenReminder(v, id, owner, calendarId, timezone, by_) ==> alwaysCancelledIdsAreAbsent(openReminder(v, id, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canOpenReminder(v, id, owner, calendarId, timezone, by_) ==> alwaysSeriesDefinitions(openReminder(v, id, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canOpenReminder(v, id, owner, calendarId, timezone, by_) ==> alwaysEntriesUseSeries(openReminder(v, id, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canOpenReminder(v, id, owner, calendarId, timezone, by_) ==> alwaysSelectionIsCurrent(openReminder(v, id, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canOpenReminder(v, id, owner, calendarId, timezone, by_) ==> alwaysDeletionHasSelection(openReminder(v, id, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canOpenReminder(v, id, owner, calendarId, timezone, by_) ==> alwaysDeletedSeriesStayDeleted(openReminder(v, id, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canOpenReminder(v, id, owner, calendarId, timezone, by_) ==> alwaysDeletedSeriesIdsAreNonempty(openReminder(v, id, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canOpenReminder(v, id, owner, calendarId, timezone, by_) ==> alwaysSeriesDeletionIsRecurring(openReminder(v, id, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canOpenReminder(v, id, owner, calendarId, timezone, by_) ==> stepOccurrenceIdentityIsFixed(v, openReminder(v, id, owner, calendarId, timezone, by_)))
{
  if inv(v) && canOpenReminder(v, id, owner, calendarId, timezone, by_) {
    var shown := openCalendar(v, owner, calendarId, timezone, by_);
    openCalendar_ensures(v, owner, calendarId, timezone, by_);
    assert inv(shown);
    openOccurrence_ensures(shown, id, by_);
    CalendarSameEntries(v, openReminder(v, id, owner, calendarId, timezone, by_));
  }
}

lemma lawComingUpShowsSavedEvents_ensures(v: CalendarView, query: app__calendar_ViewQuery)
  ensures (lawComingUpShowsSavedEvents(v, query) == true)
{
  forall c | c in upcomingOccurrences(v, query.fromTime, query.untilTime)
    ensures c.hasSaved && !c.phase.Deleted? && c.identity.owner == v.owner && c.identity.calendarId == v.calendarId
  {
    ProofLib.FilterMember((c: app__calendar_Calendar) => app__calendar_inView(c, v.owner, v.calendarId, query.fromTime, query.untilTime), v.entries, c);
  }
}

lemma CalendarUnboundIsEmpty(v: CalendarView)
  requires alwaysViewIdentity(v) && alwaysSelectionIsCurrent(v) && alwaysDeletionHasSelection(v)
  requires v.owner == ""
  ensures |v.entries| == 0 && |v.series| == 0 && v.selectedId == "" && v.deletion.NoDeletion?
{
  if v.selectedId != "" {
    CalendarEntryAtView(v, v.selectedId);
    assert ProofLib.Filter((c: app__calendar_Calendar) => ((((c.identity.owner == v.owner) && (c.identity.calendarId == v.calendarId)) && (c.identity.occurrenceId == v.selectedId)) && (!c.phase.Deleted?)), v.entries) == [];
  }
}

lemma bindCalendar_ensures(v: CalendarView, owner: string, calendarId: string, timezone: string, by_: ViewActor)
  ensures (inv(v) ==> canBindCalendar(v, owner, calendarId, timezone, by_) ==> alwaysViewIdentity(bindCalendar(v, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canBindCalendar(v, owner, calendarId, timezone, by_) ==> alwaysViewWindow(bindCalendar(v, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canBindCalendar(v, owner, calendarId, timezone, by_) ==> alwaysEntriesBelongToCalendar(bindCalendar(v, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canBindCalendar(v, owner, calendarId, timezone, by_) ==> alwaysOccurrenceIsUnique(bindCalendar(v, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canBindCalendar(v, owner, calendarId, timezone, by_) ==> alwaysEditingIsSelected(bindCalendar(v, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canBindCalendar(v, owner, calendarId, timezone, by_) ==> alwaysCancelledIdsAreAbsent(bindCalendar(v, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canBindCalendar(v, owner, calendarId, timezone, by_) ==> alwaysSeriesDefinitions(bindCalendar(v, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canBindCalendar(v, owner, calendarId, timezone, by_) ==> alwaysEntriesUseSeries(bindCalendar(v, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canBindCalendar(v, owner, calendarId, timezone, by_) ==> alwaysSelectionIsCurrent(bindCalendar(v, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canBindCalendar(v, owner, calendarId, timezone, by_) ==> alwaysDeletionHasSelection(bindCalendar(v, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canBindCalendar(v, owner, calendarId, timezone, by_) ==> alwaysDeletedSeriesStayDeleted(bindCalendar(v, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canBindCalendar(v, owner, calendarId, timezone, by_) ==> alwaysDeletedSeriesIdsAreNonempty(bindCalendar(v, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canBindCalendar(v, owner, calendarId, timezone, by_) ==> alwaysSeriesDeletionIsRecurring(bindCalendar(v, owner, calendarId, timezone, by_)))
  ensures (inv(v) ==> canBindCalendar(v, owner, calendarId, timezone, by_) ==> stepOccurrenceIdentityIsFixed(v, bindCalendar(v, owner, calendarId, timezone, by_)))
{
  if inv(v) && canBindCalendar(v, owner, calendarId, timezone, by_) {
    var after := bindCalendar(v, owner, calendarId, timezone, by_);
    if v.owner == "" {
      CalendarUnboundIsEmpty(v);
      CalendarEntryAtView(after, after.selectedId);
    } else {
      assert after == v;
    }
    CalendarSameEntries(v, after);
  }
}

lemma CalendarChangedEntry(c: app__calendar_Calendar, details: app__calendar_EntryDetails)
  requires validStored(c) && c.phase.Saved? && app__calendar_validDetails(details)
  ensures validStored(changedEntry(c, details))
  ensures changedEntry(c, details).phase.Editing?
  ensures changedEntry(c, details).identity == c.identity
  ensures changedEntry(c, details).committed == c.committed
  ensures changedEntry(c, details).hasSaved == c.hasSaved
  ensures changedEntry(c, details).draft == details
  ensures changedEntry(c, details).approvedRevision == changedEntry(c, details).revision
  ensures changedEntry(c, details).approvedRevision != -1
{
  assert app__calendar_inv(c);
  var opened := app__calendar_beginEdit(c, app__calendar_CalendarActor.CalendarUser);
  app__calendar_beginEdit_ensures(c, app__calendar_CalendarActor.CalendarUser);
  assert app__calendar_inv(opened);
  var editing := app__calendar_edit(opened, details, app__calendar_CalendarActor.CalendarUser);
  app__calendar_edit_ensures(opened, details, app__calendar_CalendarActor.CalendarUser);
  assert app__calendar_inv(editing);
  app__calendar_approveSave_ensures(editing, editing.revision, app__calendar_CalendarActor.CalendarUser);
}

lemma confirmChange_ensures(v: CalendarView, changeRequest: ConfirmedChange, by_: ViewActor)
  ensures (inv(v) ==> canConfirmChange(v, changeRequest, by_) ==> alwaysViewIdentity(confirmChange(v, changeRequest, by_)))
  ensures (inv(v) ==> canConfirmChange(v, changeRequest, by_) ==> alwaysViewWindow(confirmChange(v, changeRequest, by_)))
  ensures (inv(v) ==> canConfirmChange(v, changeRequest, by_) ==> alwaysEntriesBelongToCalendar(confirmChange(v, changeRequest, by_)))
  ensures (inv(v) ==> canConfirmChange(v, changeRequest, by_) ==> alwaysOccurrenceIsUnique(confirmChange(v, changeRequest, by_)))
  ensures (inv(v) ==> canConfirmChange(v, changeRequest, by_) ==> alwaysEditingIsSelected(confirmChange(v, changeRequest, by_)))
  ensures (inv(v) ==> canConfirmChange(v, changeRequest, by_) ==> alwaysCancelledIdsAreAbsent(confirmChange(v, changeRequest, by_)))
  ensures (inv(v) ==> canConfirmChange(v, changeRequest, by_) ==> alwaysSeriesDefinitions(confirmChange(v, changeRequest, by_)))
  ensures (inv(v) ==> canConfirmChange(v, changeRequest, by_) ==> alwaysEntriesUseSeries(confirmChange(v, changeRequest, by_)))
  ensures (inv(v) ==> canConfirmChange(v, changeRequest, by_) ==> alwaysSelectionIsCurrent(confirmChange(v, changeRequest, by_)))
  ensures (inv(v) ==> canConfirmChange(v, changeRequest, by_) ==> alwaysDeletionHasSelection(confirmChange(v, changeRequest, by_)))
  ensures (inv(v) ==> canConfirmChange(v, changeRequest, by_) ==> alwaysDeletedSeriesStayDeleted(confirmChange(v, changeRequest, by_)))
  ensures (inv(v) ==> canConfirmChange(v, changeRequest, by_) ==> alwaysDeletedSeriesIdsAreNonempty(confirmChange(v, changeRequest, by_)))
  ensures (inv(v) ==> canConfirmChange(v, changeRequest, by_) ==> alwaysSeriesDeletionIsRecurring(confirmChange(v, changeRequest, by_)))
  ensures (inv(v) ==> canConfirmChange(v, changeRequest, by_) ==> stepOccurrenceIdentityIsFixed(v, confirmChange(v, changeRequest, by_)))
{
  if inv(v) && canConfirmChange(v, changeRequest, by_) {
    var id := changeRequest.id;
    var before := entryAt(v, id);
    CalendarEntryMember(v, id);
    CalendarChangedEntry(before, changeRequest.details);
    CalendarUniqueDistinct(v);
    var approved := changedEntry(before, changeRequest.details);
    var after := confirmChange(v, changeRequest, by_);
    forall i | 0 <= i < |v.entries|
      ensures after.entries[i].identity == v.entries[i].identity
      ensures validStored(after.entries[i])
      ensures after.entries[i].committed == v.entries[i].committed
      ensures after.entries[i].hasSaved == v.entries[i].hasSaved
      ensures after.entries[i].phase.Deleted? == v.entries[i].phase.Deleted?
      ensures after.entries[i].phase.Editing? ==> after.entries[i] == approved
    {
      if v.entries[i].identity.occurrenceId == id {
        CalendarSameKey(v, before, v.entries[i]);
        assert after.entries[i] == approved;
      } else {
        assert after.entries[i] == v.entries[i];
      }
    }
    forall i, j | 0 <= i < |after.entries| && 0 <= j < |after.entries| && i != j
      ensures (after.entries[i].identity.owner, after.entries[i].identity.calendarId, after.entries[i].identity.occurrenceId) !=
        (after.entries[j].identity.owner, after.entries[j].identity.calendarId, after.entries[j].identity.occurrenceId)
    {
    }
    CalendarDistinctUnique(after);
    assert alwaysEntriesBelongToCalendar(after);
    var at :| 0 <= at < |v.entries| && v.entries[at] == before;
    assert after.entries[at] == approved;
    CalendarEntryFind(after, after.entries[at]);
    forall prior, laterEntry | prior in v.entries && laterEntry in after.entries && app__calendar_sameOccurrence(prior, laterEntry)
      ensures prior.identity == laterEntry.identity
    {
      var k :| 0 <= k < |after.entries| && after.entries[k] == laterEntry;
      CalendarSameKey(v, prior, v.entries[k]);
    }
  }
}

lemma confirmDeletion_ensures(v: CalendarView, deletionRequest: ConfirmedDeletion, by_: ViewActor)
  ensures (inv(v) ==> canConfirmDeletion(v, deletionRequest, by_) ==> alwaysViewIdentity(confirmDeletion(v, deletionRequest, by_)))
  ensures (inv(v) ==> canConfirmDeletion(v, deletionRequest, by_) ==> alwaysViewWindow(confirmDeletion(v, deletionRequest, by_)))
  ensures (inv(v) ==> canConfirmDeletion(v, deletionRequest, by_) ==> alwaysEntriesBelongToCalendar(confirmDeletion(v, deletionRequest, by_)))
  ensures (inv(v) ==> canConfirmDeletion(v, deletionRequest, by_) ==> alwaysOccurrenceIsUnique(confirmDeletion(v, deletionRequest, by_)))
  ensures (inv(v) ==> canConfirmDeletion(v, deletionRequest, by_) ==> alwaysEditingIsSelected(confirmDeletion(v, deletionRequest, by_)))
  ensures (inv(v) ==> canConfirmDeletion(v, deletionRequest, by_) ==> alwaysCancelledIdsAreAbsent(confirmDeletion(v, deletionRequest, by_)))
  ensures (inv(v) ==> canConfirmDeletion(v, deletionRequest, by_) ==> alwaysSeriesDefinitions(confirmDeletion(v, deletionRequest, by_)))
  ensures (inv(v) ==> canConfirmDeletion(v, deletionRequest, by_) ==> alwaysEntriesUseSeries(confirmDeletion(v, deletionRequest, by_)))
  ensures (inv(v) ==> canConfirmDeletion(v, deletionRequest, by_) ==> alwaysSelectionIsCurrent(confirmDeletion(v, deletionRequest, by_)))
  ensures (inv(v) ==> canConfirmDeletion(v, deletionRequest, by_) ==> alwaysDeletionHasSelection(confirmDeletion(v, deletionRequest, by_)))
  ensures (inv(v) ==> canConfirmDeletion(v, deletionRequest, by_) ==> alwaysDeletedSeriesStayDeleted(confirmDeletion(v, deletionRequest, by_)))
  ensures (inv(v) ==> canConfirmDeletion(v, deletionRequest, by_) ==> alwaysDeletedSeriesIdsAreNonempty(confirmDeletion(v, deletionRequest, by_)))
  ensures (inv(v) ==> canConfirmDeletion(v, deletionRequest, by_) ==> alwaysSeriesDeletionIsRecurring(confirmDeletion(v, deletionRequest, by_)))
  ensures (inv(v) ==> canConfirmDeletion(v, deletionRequest, by_) ==> stepOccurrenceIdentityIsFixed(v, confirmDeletion(v, deletionRequest, by_)))
{
  if inv(v) && canConfirmDeletion(v, deletionRequest, by_) {
    var after := confirmDeletion(v, deletionRequest, by_);
    CalendarEntryMember(v, deletionRequest.id);
    CalendarEntryAtView(v, deletionRequest.id);
    CalendarEntryAtView(after, deletionRequest.id);
    assert entryAt(after, deletionRequest.id) == entryAt(v, deletionRequest.id);
    CalendarSameEntries(v, after);
  }
}

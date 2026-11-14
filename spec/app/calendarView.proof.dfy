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

lemma CalendarPublishedView(v: CalendarView, incoming: app__calendar_Calendar, by_: ViewActor)
  requires canPublishOccurrence(v, incoming, by_)
  ensures publishOccurrence(v, incoming, by_).entries ==
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

lemma publishOccurrence_ensures(v: CalendarView, incoming: app__calendar_Calendar, by_: ViewActor)
  ensures (inv(v) ==> canPublishOccurrence(v, incoming, by_) ==> alwaysViewIdentity(publishOccurrence(v, incoming, by_)))
  ensures (inv(v) ==> canPublishOccurrence(v, incoming, by_) ==> alwaysViewWindow(publishOccurrence(v, incoming, by_)))
  ensures (inv(v) ==> canPublishOccurrence(v, incoming, by_) ==> alwaysEntriesBelongToCalendar(publishOccurrence(v, incoming, by_)))
  ensures (inv(v) ==> canPublishOccurrence(v, incoming, by_) ==> alwaysOccurrenceIsUnique(publishOccurrence(v, incoming, by_)))
  ensures (inv(v) ==> canPublishOccurrence(v, incoming, by_) ==> alwaysDeletionHasSelection(publishOccurrence(v, incoming, by_)))
  ensures (inv(v) ==> canPublishOccurrence(v, incoming, by_) ==> alwaysDeletedSeriesStayDeleted(publishOccurrence(v, incoming, by_)))
  ensures (inv(v) ==> canPublishOccurrence(v, incoming, by_) ==> alwaysSelectionIsCurrent(publishOccurrence(v, incoming, by_)))
{
  if inv(v) && canPublishOccurrence(v, incoming, by_) {
    CalendarUniqueDistinct(v);
    CalendarPublishedView(v, incoming, by_);
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
    CalendarDistinctUnique(publishOccurrence(v, incoming, by_));
  }
}

lemma deletionResult_ensures(v: CalendarView, generation: int, succeeded: bool, evidence: string, by_: ViewActor)
  ensures (inv(v) ==> canDeletionResult(v, generation, evidence, by_) ==> alwaysViewIdentity(deletionResult(v, generation, succeeded, evidence, by_)))
  ensures (inv(v) ==> canDeletionResult(v, generation, evidence, by_) ==> alwaysViewWindow(deletionResult(v, generation, succeeded, evidence, by_)))
  ensures (inv(v) ==> canDeletionResult(v, generation, evidence, by_) ==> alwaysEntriesBelongToCalendar(deletionResult(v, generation, succeeded, evidence, by_)))
  ensures (inv(v) ==> canDeletionResult(v, generation, evidence, by_) ==> alwaysOccurrenceIsUnique(deletionResult(v, generation, succeeded, evidence, by_)))
  ensures (inv(v) ==> canDeletionResult(v, generation, evidence, by_) ==> alwaysDeletionHasSelection(deletionResult(v, generation, succeeded, evidence, by_)))
  ensures (inv(v) ==> canDeletionResult(v, generation, evidence, by_) ==> alwaysDeletedSeriesStayDeleted(deletionResult(v, generation, succeeded, evidence, by_)))
  ensures (inv(v) ==> canDeletionResult(v, generation, evidence, by_) ==> alwaysSelectionIsCurrent(deletionResult(v, generation, succeeded, evidence, by_)))
{
  if inv(v) && canDeletionResult(v, generation, evidence, by_) && succeeded {
    var after := deletionResult(v, generation, succeeded, evidence, by_);
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
  }
}

lemma lawSavedRowsAreSavedAppointments_ensures(registry: app__accounts_Accounts, calendars: seq<CalendarSource>, fromTime: int, untilTime: int)
  ensures (lawSavedRowsAreSavedAppointments(registry, calendars, fromTime, untilTime) == true)
{
  forall r | r in calendarContext(registry, calendars, fromTime, untilTime)
    ensures !r.draft && exists s :: s in calendars && s.key == r.key && exists c :: c in s.view.entries && c.identity == r.identity && c.hasSaved && !c.phase.Deleted?
  {
    ContextMember(registry, calendars, fromTime, untilTime, r);
  }
}

lemma lawRowsUseOneWindow_ensures(registry: app__accounts_Accounts, calendars: seq<CalendarSource>, pending: app__proposal_Pending)
  ensures (lawRowsUseOneWindow(registry, calendars, pending) == true)
{
  var days := chosenDays(calendars);
  var saved := calendarContext(registry, calendars, days.fromTime, days.untilTime);
  forall r | r in dayRows(registry, calendars, pending)
    ensures overlaps(r.details, days.fromTime, days.untilTime)
  {
    if r in saved {
      ContextMember(registry, calendars, days.fromTime, days.untilTime, r);
    } else {
      assert r in askedRows(registry, pending, days.fromTime, days.untilTime, saved);
    }
  }
}

lemma lawNextAppointmentsAreSavedAndFuture_ensures(registry: app__accounts_Accounts, calendars: seq<CalendarSource>, fromTime: int, untilTime: int)
  ensures (lawNextAppointmentsAreSavedAndFuture(registry, calendars, fromTime, untilTime) == true)
{
  forall r | r in upcoming(registry, calendars, fromTime, untilTime)
    ensures !r.draft && r.details.startAt >= fromTime && showsCalendar(registry, r.key) &&
      exists s :: s in calendars && s.key == r.key && exists c :: c in s.view.entries && c.identity == r.identity && c.hasSaved && !c.phase.Deleted?
  {
    UpcomingMember(registry, calendars, fromTime, untilTime, r);
    ContextMember(registry, calendars, fromTime, untilTime, r);
  }
}

lemma lawHiddenCalendarShowsNothing_ensures(registry: app__accounts_Accounts, calendars: seq<CalendarSource>, pending: app__proposal_Pending, fromTime: int, untilTime: int, key: int)
  ensures (lawHiddenCalendarShowsNothing(registry, calendars, pending, fromTime, untilTime, key) == true)
{
  if key != noCalendar.key && !showsCalendar(registry, key) {
    var saved := calendarContext(registry, calendars, fromTime, untilTime);
    forall r | r in saved
      ensures r.key != key
    {
      ContextMember(registry, calendars, fromTime, untilTime, r);
    }
    var days := chosenDays(calendars);
    var shown := calendarContext(registry, calendars, days.fromTime, days.untilTime);
    forall r | r in dayRows(registry, calendars, pending)
      ensures r.key != key
    {
      if r in shown {
        ContextMember(registry, calendars, days.fromTime, days.untilTime, r);
      } else {
        assert r in askedRows(registry, pending, days.fromTime, days.untilTime, shown);
      }
    }
    forall r | r in upcoming(registry, calendars, fromTime, untilTime)
      ensures r.key != key
    {
      UpcomingMember(registry, calendars, fromTime, untilTime, r);
    }
    forall r | r in shownReminders(registry, calendars)
      ensures r.key != key
    {
      ReminderMember(registry, calendars, r);
    }
    OpenSelectedShows(registry, calendars);
  }
}

lemma lawCalendarToldIsDerived_ensures(key: int, view: app__calendarView_CalendarView)
  ensures (lawCalendarToldIsDerived(key, view) == true)
{
  ToldQuiet(key, view, view);
}

lemma lawToldNamesWhatChanged_ensures(key: int, before: app__calendarView_CalendarView, after: app__calendarView_CalendarView)
  ensures (lawToldNamesWhatChanged(key, before, after) == true)
{
  var added := ProofLib.Filter((c: app__calendar_Calendar) => storedFrom(before, c, false), after.entries);
  var changed := ProofLib.Filter((c: app__calendar_Calendar) => storedFrom(before, c, true), after.entries);
  var deleted := ProofLib.Filter((c: app__calendar_Calendar) => (((c.phase.Deleted? && !((c in before.entries))) && before.deletion.DeletionPending?) && (exists b :: b in before.entries && (app__calendar_sameOccurrence(b, c) && (!b.phase.Deleted?)))), after.entries);
  if |added| > 0 {
    assert added[0] in added;
    ProofLib.FilterMember((c: app__calendar_Calendar) => storedFrom(before, c, false), after.entries, added[0]);
  } else if |changed| > 0 {
    assert changed[0] in changed;
    ProofLib.FilterMember((c: app__calendar_Calendar) => storedFrom(before, c, true), after.entries, changed[0]);
  } else if |deleted| > 0 {
    assert deleted[0] in deleted;
    ProofLib.FilterMember((c: app__calendar_Calendar) => (((c.phase.Deleted? && !((c in before.entries))) && before.deletion.DeletionPending?) && (exists b :: b in before.entries && (app__calendar_sameOccurrence(b, c) && (!b.phase.Deleted?)))), after.entries, deleted[0]);
  }
}

lemma lawDraftRowIsTheQuestion_ensures(registry: app__accounts_Accounts, calendars: seq<CalendarSource>, pending: app__proposal_Pending)
  ensures (lawDraftRowIsTheQuestion(registry, calendars, pending) == true)
{
  var days := chosenDays(calendars);
  var saved := calendarContext(registry, calendars, days.fromTime, days.untilTime);
  forall r | r in dayRows(registry, calendars, pending) && r.draft
    ensures pending.ask.AddAsk? && r.key == pending.ask.target && r.identity == pending.ask.review_AddAsk.entry.identity && r.details == pending.ask.review_AddAsk.entry.details
  {
    if r in saved {
      ContextMember(registry, calendars, days.fromTime, days.untilTime, r);
    }
    assert r in askedRows(registry, pending, days.fromTime, days.untilTime, saved);
  }
}

lemma VisibleMember(entries: seq<app__calendar_Calendar>, owner: string, calendarId: string, fromTime: int, untilTime: int, c: app__calendar_Calendar)
  requires c in app__calendar_visibleEntries(entries, owner, calendarId, fromTime, untilTime)
  ensures c in entries && app__calendar_inView(c, owner, calendarId, fromTime, untilTime)
{
  ProofLib.FilterMember((c: app__calendar_Calendar) => app__calendar_inView(c, owner, calendarId, fromTime, untilTime), entries, c);
}

lemma SourceRowMember(registry: app__accounts_Accounts, s: CalendarSource, fromTime: int, untilTime: int, r: CalRow)
  requires r in sourceRows(registry, s, fromTime, untilTime)
  ensures !r.draft && r.key == s.key && showsCalendar(registry, s.key) && overlaps(r.details, fromTime, untilTime)
  ensures exists c :: c in s.view.entries && c.identity == r.identity && c.hasSaved && !c.phase.Deleted?
{
  var shown := app__calendar_visibleEntries(s.view.entries, s.view.owner, s.view.calendarId, fromTime, untilTime);
  assert showsCalendar(registry, s.key);
  var j :| 0 <= j < |shown| && r == savedRow(s.key, shown[j]);
  assert shown[j] in shown;
  VisibleMember(s.view.entries, s.view.owner, s.view.calendarId, fromTime, untilTime, shown[j]);
}

lemma ContextMember(registry: app__accounts_Accounts, calendars: seq<CalendarSource>, fromTime: int, untilTime: int, r: CalRow)
  requires r in calendarContext(registry, calendars, fromTime, untilTime)
  ensures !r.draft && showsCalendar(registry, r.key) && overlaps(r.details, fromTime, untilTime)
  ensures exists s :: s in calendars && s.key == r.key && exists c :: c in s.view.entries && c.identity == r.identity && c.hasSaved && !c.phase.Deleted?
{
  ProofLib.FoldLeftConcatMember((rows: seq<CalRow>, s: CalendarSource) => (rows + sourceRows(registry, s, fromTime, untilTime)), (s: CalendarSource) => sourceRows(registry, s, fromTime, untilTime), [], calendars, r);
  var i :| 0 <= i < |calendars| && r in sourceRows(registry, calendars[i], fromTime, untilTime);
  SourceRowMember(registry, calendars[i], fromTime, untilTime, r);
}

lemma UpcomingMember(registry: app__accounts_Accounts, calendars: seq<CalendarSource>, fromTime: int, untilTime: int, r: CalRow)
  requires r in upcoming(registry, calendars, fromTime, untilTime)
  ensures r in calendarContext(registry, calendars, fromTime, untilTime) && r.details.startAt >= fromTime
  ensures !r.draft && showsCalendar(registry, r.key)
{
  ProofLib.FilterMember((r: CalRow) => (r.details.startAt >= fromTime), calendarContext(registry, calendars, fromTime, untilTime), r);
  ContextMember(registry, calendars, fromTime, untilTime, r);
}

lemma ReminderMember(registry: app__accounts_Accounts, calendars: seq<CalendarSource>, r: CalRow)
  requires r in shownReminders(registry, calendars)
  ensures showsCalendar(registry, r.key)
{
  ProofLib.FoldLeftConcatMember((rows: seq<CalRow>, s: CalendarSource) => (rows + sourceReminders(registry, s)), (s: CalendarSource) => sourceReminders(registry, s), [], calendars, r);
  var i :| 0 <= i < |calendars| && r in sourceReminders(registry, calendars[i]);
  var s := calendars[i];
  assert showsCalendar(registry, s.key);
  var rows := sourceReminders(registry, s);
  var k :| 0 <= k < |rows| && rows[k] == r;
  assert rows[k].key == s.key;
}

lemma OpenSelectedShows(registry: app__accounts_Accounts, calendars: seq<CalendarSource>)
  ensures openSelected(registry, calendars) == noCalendar.key || showsCalendar(registry, openSelected(registry, calendars))
{
  var open := ProofLib.Filter((s: CalendarSource) => ((showsCalendar(registry, s.key) && s.view.opened_) && (s.view.selectedId != "")), calendars);
  if |open| > 0 {
    assert open[0] in open;
    ProofLib.FilterMember((s: CalendarSource) => ((showsCalendar(registry, s.key) && s.view.opened_) && (s.view.selectedId != "")), calendars, open[0]);
  }
}

lemma ToldQuiet(key: int, before: app__calendarView_CalendarView, after: app__calendarView_CalendarView)
  requires forall c :: c in after.entries && !(c in before.entries) ==>
    !storedFrom(before, c, false) && !storedFrom(before, c, true) && (c.phase.Deleted? ==> !before.deletion.DeletionPending?)
  ensures told(key, before, after).news.NoCalendarNews?
{
  ProofLib.FilterNone((c: app__calendar_Calendar) => storedFrom(before, c, false), after.entries);
  ProofLib.FilterNone((c: app__calendar_Calendar) => storedFrom(before, c, true), after.entries);
  ProofLib.FilterNone((c: app__calendar_Calendar) => (((c.phase.Deleted? && !((c in before.entries))) && before.deletion.DeletionPending?) && (exists b :: b in before.entries && (app__calendar_sameOccurrence(b, c) && (!b.phase.Deleted?)))), after.entries);
}

lemma CancelledEntry(v: app__calendarView_CalendarView, id: string, c: app__calendar_Calendar)
  requires c in app__calendarView_changeOccurrence(v, id, app__calendarView_OccurrenceAction.CancelEditing, app__calendarView_ViewActor.ViewUser).entries
  requires !(c in v.entries)
  ensures c == app__calendar_cancelEdit(app__calendarView_entryAt(v, id), app__calendar_CalendarActor.CalendarUser) && c.hasSaved
{
  var updated := app__calendarView_ownedEntryResult(v, app__calendarView_entryAt(v, id), app__calendarView_OccurrenceAction.CancelEditing);
  var after := app__calendarView_changeOccurrence(v, id, app__calendarView_OccurrenceAction.CancelEditing, app__calendarView_ViewActor.ViewUser).entries;
  if updated.phase.Empty? {
    ProofLib.FilterMember((c: app__calendar_Calendar) => (c.identity.occurrenceId != id), v.entries, c);
  } else {
    var i :| 0 <= i < |after| && after[i] == c;
  }
}

lemma CancelStoresNothing(v: app__calendarView_CalendarView, id: string)
  requires !(app__calendarView_entryAt(v, id).phase.Editing? && app__calendarView_entryAt(v, id).approvedRevision >= 0)
  ensures forall c :: c in app__calendarView_changeOccurrence(v, id, app__calendarView_OccurrenceAction.CancelEditing, app__calendarView_ViewActor.ViewUser).entries && !(c in v.entries) ==>
    !storedFrom(v, c, false) && !storedFrom(v, c, true) && !c.phase.Deleted?
{
  var c0 := app__calendarView_entryAt(v, id);
  var p := (c: app__calendar_Calendar) => ((((c.identity.owner == v.owner) && (c.identity.calendarId == v.calendarId)) && (c.identity.occurrenceId == id)) && (!c.phase.Deleted?));
  forall c | c in app__calendarView_changeOccurrence(v, id, app__calendarView_OccurrenceAction.CancelEditing, app__calendarView_ViewActor.ViewUser).entries && !(c in v.entries)
    ensures !storedFrom(v, c, false) && !storedFrom(v, c, true) && !c.phase.Deleted?
  {
    CancelledEntry(v, id, c);
    var f := ProofLib.Filter(p, v.entries);
    assert |f| == 1 && c0 == f[0];
    ProofLib.FilterMember(p, v.entries, c0);
    forall b | b in v.entries && app__calendar_sameOccurrence(b, c) && b.phase.Editing?
      ensures b == c0
    {
      ProofLib.FilterMember(p, v.entries, b);
    }
  }
}

lemma lawOnlyTheStoreIsNews_ensures(key: int, view: app__calendarView_CalendarView, id: string, published: app__calendar_Calendar)
  ensures (lawOnlyTheStoreIsNews(key, view, id, published) == true)
{
  if app__calendarView_canChangeOccurrence(view, id, app__calendarView_OccurrenceAction.CancelEditing, app__calendarView_ViewActor.ViewUser) {
    CancelStoresNothing(view, id);
    ToldQuiet(key, view, app__calendarView_changeOccurrence(view, id, app__calendarView_OccurrenceAction.CancelEditing, app__calendarView_ViewActor.ViewUser));
  }
  var selected := app__calendarView_selectedOccurrence(view);
  var closed := app__calendarView_closeCalendar(view, app__calendarView_ViewActor.ViewUser);
  if app__calendarView_hasEditing(view) && !(selected.phase.Editing? && selected.approvedRevision != -1) {
    CancelStoresNothing(view, view.selectedId);
    assert closed.entries == app__calendarView_changeOccurrence(view, view.selectedId, app__calendarView_OccurrenceAction.CancelEditing, app__calendarView_ViewActor.ViewUser).entries;
  } else {
    assert closed.entries == view.entries;
  }
  ToldQuiet(key, view, closed);
  if app__calendarView_canPublishOccurrence(view, published, view.generation, true, app__calendarView_ViewActor.ViewStore) {
    ToldQuiet(key, view, app__calendarView_publishOccurrence(view, published, view.generation, true, app__calendarView_ViewActor.ViewStore));
  }
}

lemma lawRingMarksAJustSavedAppointment_ensures(key: int, before: app__calendarView_CalendarView, after: app__calendarView_CalendarView)
  ensures (lawRingMarksAJustSavedAppointment(key, before, after) == true)
{
  lawToldNamesWhatChanged_ensures(key, before, after);
}

lemma SourceAtIsASource(calendars: seq<CalendarSource>, key: int)
  ensures sourceAt(calendars, key) == noCalendar || sourceAt(calendars, key) in calendars
{
  var found := ProofLib.Filter((s: CalendarSource) => (s.key == key), calendars);
  if |found| > 0 {
    assert found[0] in found;
    ProofLib.FilterMember((s: CalendarSource) => (s.key == key), calendars, found[0]);
  }
}

lemma lawCalendarSelectsTheStartDay_ensures(registry: app__accounts_Accounts, calendars: seq<CalendarSource>, earlier: app__proposal_Pending, pending: app__proposal_Pending, news: CalendarTold, report: app__calendarView_NavigationReport)
  ensures (lawCalendarSelectsTheStartDay(registry, calendars, earlier, pending, news, report) == true)
{
  if showsDay(report, askedDay(registry, calendars, earlier, pending)) || showsDay(report, savedDay(registry, calendars, news)) {
    assert calendarFree(calendars);
    SourceAtIsASource(calendars, tabletKey);
    assert lead(calendars) in calendars;
    assert !app__calendarView_hasEditing(lead(calendars).view);
    assert lead(calendars).view.deletion.NoDeletion?;
  }
}

lemma lawSavedDayIsTheRingedAppointment_ensures(registry: app__accounts_Accounts, calendars: seq<CalendarSource>, news: CalendarTold)
  ensures (lawSavedDayIsTheRingedAppointment(registry, calendars, news) == true)
{
  var v := sourceAt(calendars, news.key).view;
  var saved := app__calendarView_entryAt(v, news.id);
  if savedDay(registry, calendars, news).show {
    var p := (c: app__calendar_Calendar) => ((((c.identity.owner == v.owner) && (c.identity.calendarId == v.calendarId)) && (c.identity.occurrenceId == news.id)) && (!c.phase.Deleted?));
    var matches := ProofLib.Filter(p, v.entries);
    assert |matches| == 1 && saved == matches[0];
    assert saved in matches;
    ProofLib.FilterMember(p, v.entries, saved);
  }
}

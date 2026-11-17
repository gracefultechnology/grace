lemma WithoutReminderMembers(subject: string, n: Notices)
  ensures forall r :: r in withoutReminder(subject, n).reminders <==> r in n.reminders && r != subject
  ensures forall r :: r in withoutReminder(subject, n).androidNotifications <==> r in n.androidNotifications && r != subject
  ensures forall x :: x in withoutReminder(subject, n).waiting <==> x in n.waiting && !(x.source.Calendar? && x.subject == subject)
  ensures withoutReminder(subject, n).shown == n.shown
  ensures withoutReminder(subject, n).place == n.place
{
  var after := withoutReminder(subject, n);
  assert after.reminders == ProofLib.Filter((r: string) => (r != subject), n.reminders);
  assert after.androidNotifications == ProofLib.Filter((r: string) => (r != subject), n.androidNotifications);
  assert after.waiting == ProofLib.Filter((x: Notice) => !((x.source.Calendar? && (x.subject == subject))), n.waiting);
  forall r: string
    ensures r in after.reminders <==> r in n.reminders && r != subject
    ensures r in after.androidNotifications <==> r in n.androidNotifications && r != subject
  {
    ProofLib.FilterMember((r: string) => (r != subject), n.reminders, r);
    ProofLib.FilterMember((r: string) => (r != subject), n.androidNotifications, r);
  }
  forall x: Notice
    ensures x in after.waiting <==> x in n.waiting && !(x.source.Calendar? && x.subject == subject)
  {
    ProofLib.FilterMember((x: Notice) => !((x.source.Calendar? && (x.subject == subject))), n.waiting, x);
  }
}

lemma ClosingKeepsTheLine(m: Notices)
  ensures forall x :: x in queued(withShown([], m)) ==> x in m.waiting
  ensures withShown([], m).reminders == m.reminders
  ensures withShown([], m).androidNotifications == m.androidNotifications
{
  assert queued(withShown([], m)) == m.waiting;
}

lemma closeToast_ensures(n: Notices, id: int, by_: NoticeActor)
  ensures (inv(n) ==> canCloseToast(n, id, by_) ==> alwaysOneToastAtATime(closeToast(n, id, by_)))
  ensures (inv(n) ==> canCloseToast(n, id, by_) ==> alwaysAWaitingToastShowsWhenItCan(closeToast(n, id, by_)))
  ensures (inv(n) ==> canCloseToast(n, id, by_) ==> alwaysEachActionFitsItsSource(closeToast(n, id, by_)))
  ensures (inv(n) ==> canCloseToast(n, id, by_) ==> alwaysNothingCoversADecision(closeToast(n, id, by_)))
  ensures (inv(n) ==> canCloseToast(n, id, by_) ==> alwaysOfflineComesFirst(closeToast(n, id, by_)))
  ensures (inv(n) ==> canCloseToast(n, id, by_) ==> alwaysNotificationsAreDueReminders(closeToast(n, id, by_)))
  ensures (inv(n) ==> canCloseToast(n, id, by_) ==> alwaysReminderToastsAreDue(closeToast(n, id, by_)))
  ensures (inv(n) ==> canCloseToast(n, id, by_) ==> alwaysNoToastInTheBackground(closeToast(n, id, by_)))
  ensures (inv(n) ==> canCloseToast(n, id, by_) ==> stepBackOnlineIsToldOnce(n, "closeToast", closeToast(n, id, by_)))
  ensures (inv(n) ==> canCloseToast(n, id, by_) ==> stepAndroidOnlyInTheBackground(n, closeToast(n, id, by_)))
  ensures (inv(n) ==> canCloseToast(n, id, by_) ==> stepGraceSpeaksOnlyWhenAsked(n, "closeToast", closeToast(n, id, by_)))
{
  if inv(n) && canCloseToast(n, id, by_) {
    assert forall x :: x in n.waiting ==> x in queued(n);
    if |n.shown| > 0 && n.shown[0].source.Calendar? {
      var subject := n.shown[0].subject;
      WithoutReminderMembers(subject, n);
      ClosingKeepsTheLine(withoutReminder(subject, n));
    } else {
      ClosingKeepsTheLine(n);
    }
  }
}

lemma openAndroidNotification_ensures(n: Notices, subject: string, by_: NoticeActor)
  ensures (inv(n) ==> canOpenAndroidNotification(n, subject, by_) ==> alwaysOneToastAtATime(openAndroidNotification(n, subject, by_)))
  ensures (inv(n) ==> canOpenAndroidNotification(n, subject, by_) ==> alwaysAWaitingToastShowsWhenItCan(openAndroidNotification(n, subject, by_)))
  ensures (inv(n) ==> canOpenAndroidNotification(n, subject, by_) ==> alwaysEachActionFitsItsSource(openAndroidNotification(n, subject, by_)))
  ensures (inv(n) ==> canOpenAndroidNotification(n, subject, by_) ==> alwaysNothingCoversADecision(openAndroidNotification(n, subject, by_)))
  ensures (inv(n) ==> canOpenAndroidNotification(n, subject, by_) ==> alwaysOfflineComesFirst(openAndroidNotification(n, subject, by_)))
  ensures (inv(n) ==> canOpenAndroidNotification(n, subject, by_) ==> alwaysNotificationsAreDueReminders(openAndroidNotification(n, subject, by_)))
  ensures (inv(n) ==> canOpenAndroidNotification(n, subject, by_) ==> alwaysReminderToastsAreDue(openAndroidNotification(n, subject, by_)))
  ensures (inv(n) ==> canOpenAndroidNotification(n, subject, by_) ==> alwaysNoToastInTheBackground(openAndroidNotification(n, subject, by_)))
  ensures (inv(n) ==> canOpenAndroidNotification(n, subject, by_) ==> stepBackOnlineIsToldOnce(n, "openAndroidNotification", openAndroidNotification(n, subject, by_)))
  ensures (inv(n) ==> canOpenAndroidNotification(n, subject, by_) ==> stepAndroidOnlyInTheBackground(n, openAndroidNotification(n, subject, by_)))
  ensures (inv(n) ==> canOpenAndroidNotification(n, subject, by_) ==> stepGraceSpeaksOnlyWhenAsked(n, "openAndroidNotification", openAndroidNotification(n, subject, by_)))
{
  if inv(n) && canOpenAndroidNotification(n, subject, by_) {
    var after := openAndroidNotification(n, subject, by_);
    assert after.androidNotifications == ProofLib.Filter((r: string) => (r != subject), n.androidNotifications);
    forall r: string
      ensures r in after.androidNotifications ==> r in n.androidNotifications
    {
      ProofLib.FilterMember((r: string) => (r != subject), n.androidNotifications, r);
    }
  }
}

lemma dismissReminder_ensures(n: Notices, subject: string, by_: NoticeActor)
  ensures (inv(n) ==> canDismissReminder(n, subject, by_) ==> alwaysOneToastAtATime(dismissReminder(n, subject, by_)))
  ensures (inv(n) ==> canDismissReminder(n, subject, by_) ==> alwaysAWaitingToastShowsWhenItCan(dismissReminder(n, subject, by_)))
  ensures (inv(n) ==> canDismissReminder(n, subject, by_) ==> alwaysEachActionFitsItsSource(dismissReminder(n, subject, by_)))
  ensures (inv(n) ==> canDismissReminder(n, subject, by_) ==> alwaysNothingCoversADecision(dismissReminder(n, subject, by_)))
  ensures (inv(n) ==> canDismissReminder(n, subject, by_) ==> alwaysOfflineComesFirst(dismissReminder(n, subject, by_)))
  ensures (inv(n) ==> canDismissReminder(n, subject, by_) ==> alwaysNotificationsAreDueReminders(dismissReminder(n, subject, by_)))
  ensures (inv(n) ==> canDismissReminder(n, subject, by_) ==> alwaysReminderToastsAreDue(dismissReminder(n, subject, by_)))
  ensures (inv(n) ==> canDismissReminder(n, subject, by_) ==> alwaysNoToastInTheBackground(dismissReminder(n, subject, by_)))
  ensures (inv(n) ==> canDismissReminder(n, subject, by_) ==> stepBackOnlineIsToldOnce(n, "dismissReminder", dismissReminder(n, subject, by_)))
  ensures (inv(n) ==> canDismissReminder(n, subject, by_) ==> stepAndroidOnlyInTheBackground(n, dismissReminder(n, subject, by_)))
  ensures (inv(n) ==> canDismissReminder(n, subject, by_) ==> stepGraceSpeaksOnlyWhenAsked(n, "dismissReminder", dismissReminder(n, subject, by_)))
{
  if inv(n) && canDismissReminder(n, subject, by_) {
    assert forall x :: x in n.waiting ==> x in queued(n);
    WithoutReminderMembers(subject, n);
    ClosingKeepsTheLine(withoutReminder(subject, n));
  }
}

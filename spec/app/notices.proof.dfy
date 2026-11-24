lemma raise_ensures(n: Notices, source: Source, offer: Offer, subject: string, by_: NoticeActor)
  ensures (inv(n) ==> canRaise(n, source, offer, subject, by_) ==> alwaysOneToastAtATime(raise(n, source, offer, subject, by_)))
  ensures (inv(n) ==> canRaise(n, source, offer, subject, by_) ==> alwaysAWaitingToastShowsWhenItCan(raise(n, source, offer, subject, by_)))
  ensures (inv(n) ==> canRaise(n, source, offer, subject, by_) ==> alwaysEachActionFitsItsSource(raise(n, source, offer, subject, by_)))
  ensures (inv(n) ==> canRaise(n, source, offer, subject, by_) ==> alwaysEachNoticeHasItsOwnNumber(raise(n, source, offer, subject, by_)))
  ensures (inv(n) ==> canRaise(n, source, offer, subject, by_) ==> alwaysNothingCoversADecision(raise(n, source, offer, subject, by_)))
  ensures (inv(n) ==> canRaise(n, source, offer, subject, by_) ==> alwaysOneCauseInOrder(raise(n, source, offer, subject, by_)))
  ensures (inv(n) ==> canRaise(n, source, offer, subject, by_) ==> alwaysNotificationsAreDueReminders(raise(n, source, offer, subject, by_)))
  ensures (inv(n) ==> canRaise(n, source, offer, subject, by_) ==> alwaysReminderToastsAreDue(raise(n, source, offer, subject, by_)))
  ensures (inv(n) ==> canRaise(n, source, offer, subject, by_) ==> alwaysEveryDueReminderReachesAndroidInTheBackground(raise(n, source, offer, subject, by_)))
  ensures (inv(n) ==> canRaise(n, source, offer, subject, by_) ==> alwaysNoToastInTheBackground(raise(n, source, offer, subject, by_)))
  ensures (inv(n) ==> canRaise(n, source, offer, subject, by_) ==> stepBackOnlineIsToldOnce(n, "raise", raise(n, source, offer, subject, by_)))
  ensures (inv(n) ==> canRaise(n, source, offer, subject, by_) ==> stepOnlyReconnectingSaysBackOnline(n, "raise", raise(n, source, offer, subject, by_)))
  ensures (inv(n) ==> canRaise(n, source, offer, subject, by_) ==> stepAndroidOnlyInTheBackground(n, raise(n, source, offer, subject, by_)))
  ensures (inv(n) ==> canRaise(n, source, offer, subject, by_) ==> stepGraceSpeaksOnlyWhenAsked(n, "raise", raise(n, source, offer, subject, by_)))
{
  if inv(n) && canRaise(n, source, offer, subject, by_) && !n.place.Background? {
    lawANewNoticeJoinsTheEndOfTheLine_ensures(source, offer, subject, n);
    NumbersKeptAppend(n, raise(n, source, offer, subject, by_), Notice(n.nextId, source, offer, subject));
  }
}

lemma expire_ensures(n: Notices, id: int, elapsed: int, by_: NoticeActor)
  ensures (inv(n) ==> canExpire(n, id, elapsed, by_) ==> alwaysOneToastAtATime(expire(n, id, elapsed, by_)))
  ensures (inv(n) ==> canExpire(n, id, elapsed, by_) ==> alwaysAWaitingToastShowsWhenItCan(expire(n, id, elapsed, by_)))
  ensures (inv(n) ==> canExpire(n, id, elapsed, by_) ==> alwaysEachActionFitsItsSource(expire(n, id, elapsed, by_)))
  ensures (inv(n) ==> canExpire(n, id, elapsed, by_) ==> alwaysEachNoticeHasItsOwnNumber(expire(n, id, elapsed, by_)))
  ensures (inv(n) ==> canExpire(n, id, elapsed, by_) ==> alwaysNothingCoversADecision(expire(n, id, elapsed, by_)))
  ensures (inv(n) ==> canExpire(n, id, elapsed, by_) ==> alwaysOneCauseInOrder(expire(n, id, elapsed, by_)))
  ensures (inv(n) ==> canExpire(n, id, elapsed, by_) ==> alwaysNotificationsAreDueReminders(expire(n, id, elapsed, by_)))
  ensures (inv(n) ==> canExpire(n, id, elapsed, by_) ==> alwaysReminderToastsAreDue(expire(n, id, elapsed, by_)))
  ensures (inv(n) ==> canExpire(n, id, elapsed, by_) ==> alwaysEveryDueReminderReachesAndroidInTheBackground(expire(n, id, elapsed, by_)))
  ensures (inv(n) ==> canExpire(n, id, elapsed, by_) ==> alwaysNoToastInTheBackground(expire(n, id, elapsed, by_)))
  ensures (inv(n) ==> canExpire(n, id, elapsed, by_) ==> stepBackOnlineIsToldOnce(n, "expire", expire(n, id, elapsed, by_)))
  ensures (inv(n) ==> canExpire(n, id, elapsed, by_) ==> stepOnlyReconnectingSaysBackOnline(n, "expire", expire(n, id, elapsed, by_)))
  ensures (inv(n) ==> canExpire(n, id, elapsed, by_) ==> stepAndroidOnlyInTheBackground(n, expire(n, id, elapsed, by_)))
  ensures (inv(n) ==> canExpire(n, id, elapsed, by_) ==> stepGraceSpeaksOnlyWhenAsked(n, "expire", expire(n, id, elapsed, by_)))
{
  if inv(n) && canExpire(n, id, elapsed, by_) {
    lawClosingLeavesTheRestInOrder_ensures(n);
    NumbersKeptSuffix(n, expire(n, id, elapsed, by_));
  }
}

lemma act_ensures(n: Notices, id: int, by_: NoticeActor)
  ensures (inv(n) ==> canAct(n, id, by_) ==> alwaysOneToastAtATime(act(n, id, by_)))
  ensures (inv(n) ==> canAct(n, id, by_) ==> alwaysAWaitingToastShowsWhenItCan(act(n, id, by_)))
  ensures (inv(n) ==> canAct(n, id, by_) ==> alwaysEachActionFitsItsSource(act(n, id, by_)))
  ensures (inv(n) ==> canAct(n, id, by_) ==> alwaysEachNoticeHasItsOwnNumber(act(n, id, by_)))
  ensures (inv(n) ==> canAct(n, id, by_) ==> alwaysNothingCoversADecision(act(n, id, by_)))
  ensures (inv(n) ==> canAct(n, id, by_) ==> alwaysOneCauseInOrder(act(n, id, by_)))
  ensures (inv(n) ==> canAct(n, id, by_) ==> alwaysNotificationsAreDueReminders(act(n, id, by_)))
  ensures (inv(n) ==> canAct(n, id, by_) ==> alwaysReminderToastsAreDue(act(n, id, by_)))
  ensures (inv(n) ==> canAct(n, id, by_) ==> alwaysEveryDueReminderReachesAndroidInTheBackground(act(n, id, by_)))
  ensures (inv(n) ==> canAct(n, id, by_) ==> alwaysNoToastInTheBackground(act(n, id, by_)))
  ensures (inv(n) ==> canAct(n, id, by_) ==> stepBackOnlineIsToldOnce(n, "act", act(n, id, by_)))
  ensures (inv(n) ==> canAct(n, id, by_) ==> stepOnlyReconnectingSaysBackOnline(n, "act", act(n, id, by_)))
  ensures (inv(n) ==> canAct(n, id, by_) ==> stepAndroidOnlyInTheBackground(n, act(n, id, by_)))
  ensures (inv(n) ==> canAct(n, id, by_) ==> stepGraceSpeaksOnlyWhenAsked(n, "act", act(n, id, by_)))
{
  if inv(n) && canAct(n, id, by_) {
    lawClosingLeavesTheRestInOrder_ensures(n);
    NumbersKeptSuffix(n, act(n, id, by_));
  }
}

lemma closeToast_ensures(n: Notices, id: int, by_: NoticeActor)
  ensures (inv(n) ==> canCloseToast(n, id, by_) ==> alwaysOneToastAtATime(closeToast(n, id, by_)))
  ensures (inv(n) ==> canCloseToast(n, id, by_) ==> alwaysAWaitingToastShowsWhenItCan(closeToast(n, id, by_)))
  ensures (inv(n) ==> canCloseToast(n, id, by_) ==> alwaysEachActionFitsItsSource(closeToast(n, id, by_)))
  ensures (inv(n) ==> canCloseToast(n, id, by_) ==> alwaysEachNoticeHasItsOwnNumber(closeToast(n, id, by_)))
  ensures (inv(n) ==> canCloseToast(n, id, by_) ==> alwaysNothingCoversADecision(closeToast(n, id, by_)))
  ensures (inv(n) ==> canCloseToast(n, id, by_) ==> alwaysOneCauseInOrder(closeToast(n, id, by_)))
  ensures (inv(n) ==> canCloseToast(n, id, by_) ==> alwaysNotificationsAreDueReminders(closeToast(n, id, by_)))
  ensures (inv(n) ==> canCloseToast(n, id, by_) ==> alwaysReminderToastsAreDue(closeToast(n, id, by_)))
  ensures (inv(n) ==> canCloseToast(n, id, by_) ==> alwaysEveryDueReminderReachesAndroidInTheBackground(closeToast(n, id, by_)))
  ensures (inv(n) ==> canCloseToast(n, id, by_) ==> alwaysNoToastInTheBackground(closeToast(n, id, by_)))
  ensures (inv(n) ==> canCloseToast(n, id, by_) ==> stepBackOnlineIsToldOnce(n, "closeToast", closeToast(n, id, by_)))
  ensures (inv(n) ==> canCloseToast(n, id, by_) ==> stepOnlyReconnectingSaysBackOnline(n, "closeToast", closeToast(n, id, by_)))
  ensures (inv(n) ==> canCloseToast(n, id, by_) ==> stepAndroidOnlyInTheBackground(n, closeToast(n, id, by_)))
  ensures (inv(n) ==> canCloseToast(n, id, by_) ==> stepGraceSpeaksOnlyWhenAsked(n, "closeToast", closeToast(n, id, by_)))
{
  if inv(n) && canCloseToast(n, id, by_) {
    lawClosingLeavesTheRestInOrder_ensures(n);
    NumbersKeptSuffix(n, closeToast(n, id, by_));
  }
}

lemma withdraw_ensures(n: Notices, id: int, by_: NoticeActor)
  ensures (inv(n) ==> canWithdraw(n, id, by_) ==> alwaysOneToastAtATime(withdraw(n, id, by_)))
  ensures (inv(n) ==> canWithdraw(n, id, by_) ==> alwaysAWaitingToastShowsWhenItCan(withdraw(n, id, by_)))
  ensures (inv(n) ==> canWithdraw(n, id, by_) ==> alwaysEachActionFitsItsSource(withdraw(n, id, by_)))
  ensures (inv(n) ==> canWithdraw(n, id, by_) ==> alwaysEachNoticeHasItsOwnNumber(withdraw(n, id, by_)))
  ensures (inv(n) ==> canWithdraw(n, id, by_) ==> alwaysNothingCoversADecision(withdraw(n, id, by_)))
  ensures (inv(n) ==> canWithdraw(n, id, by_) ==> alwaysOneCauseInOrder(withdraw(n, id, by_)))
  ensures (inv(n) ==> canWithdraw(n, id, by_) ==> alwaysNotificationsAreDueReminders(withdraw(n, id, by_)))
  ensures (inv(n) ==> canWithdraw(n, id, by_) ==> alwaysReminderToastsAreDue(withdraw(n, id, by_)))
  ensures (inv(n) ==> canWithdraw(n, id, by_) ==> alwaysEveryDueReminderReachesAndroidInTheBackground(withdraw(n, id, by_)))
  ensures (inv(n) ==> canWithdraw(n, id, by_) ==> alwaysNoToastInTheBackground(withdraw(n, id, by_)))
  ensures (inv(n) ==> canWithdraw(n, id, by_) ==> stepBackOnlineIsToldOnce(n, "withdraw", withdraw(n, id, by_)))
  ensures (inv(n) ==> canWithdraw(n, id, by_) ==> stepOnlyReconnectingSaysBackOnline(n, "withdraw", withdraw(n, id, by_)))
  ensures (inv(n) ==> canWithdraw(n, id, by_) ==> stepAndroidOnlyInTheBackground(n, withdraw(n, id, by_)))
  ensures (inv(n) ==> canWithdraw(n, id, by_) ==> stepGraceSpeaksOnlyWhenAsked(n, "withdraw", withdraw(n, id, by_)))
{
  if inv(n) && canWithdraw(n, id, by_) {
    lawRemovingLeavesTheRestInOrder_ensures(id, "", n);
    NumbersKeptFilter(n, withdraw(n, id, by_), (x: Notice) => leaves(x, id, ""));
    ShownFilter((x: Notice) => leaves(x, id, ""), n.shown);
  }
}

lemma cover_ensures(n: Notices, blocked: bool, by_: NoticeActor)
  ensures (inv(n) ==> canCover(n, blocked, by_) ==> alwaysOneToastAtATime(cover(n, blocked, by_)))
  ensures (inv(n) ==> canCover(n, blocked, by_) ==> alwaysAWaitingToastShowsWhenItCan(cover(n, blocked, by_)))
  ensures (inv(n) ==> canCover(n, blocked, by_) ==> alwaysEachActionFitsItsSource(cover(n, blocked, by_)))
  ensures (inv(n) ==> canCover(n, blocked, by_) ==> alwaysEachNoticeHasItsOwnNumber(cover(n, blocked, by_)))
  ensures (inv(n) ==> canCover(n, blocked, by_) ==> alwaysNothingCoversADecision(cover(n, blocked, by_)))
  ensures (inv(n) ==> canCover(n, blocked, by_) ==> alwaysOneCauseInOrder(cover(n, blocked, by_)))
  ensures (inv(n) ==> canCover(n, blocked, by_) ==> alwaysNotificationsAreDueReminders(cover(n, blocked, by_)))
  ensures (inv(n) ==> canCover(n, blocked, by_) ==> alwaysReminderToastsAreDue(cover(n, blocked, by_)))
  ensures (inv(n) ==> canCover(n, blocked, by_) ==> alwaysEveryDueReminderReachesAndroidInTheBackground(cover(n, blocked, by_)))
  ensures (inv(n) ==> canCover(n, blocked, by_) ==> alwaysNoToastInTheBackground(cover(n, blocked, by_)))
  ensures (inv(n) ==> canCover(n, blocked, by_) ==> stepBackOnlineIsToldOnce(n, "cover", cover(n, blocked, by_)))
  ensures (inv(n) ==> canCover(n, blocked, by_) ==> stepOnlyReconnectingSaysBackOnline(n, "cover", cover(n, blocked, by_)))
  ensures (inv(n) ==> canCover(n, blocked, by_) ==> stepAndroidOnlyInTheBackground(n, cover(n, blocked, by_)))
  ensures (inv(n) ==> canCover(n, blocked, by_) ==> stepGraceSpeaksOnlyWhenAsked(n, "cover", cover(n, blocked, by_)))
{
  if inv(n) && canCover(n, blocked, by_) {
    lawCoveringKeepsTheLine_ensures(n, blocked, by_);
    NumbersKeptSame(n, cover(n, blocked, by_));
  }
}

lemma observeConnection_ensures(n: Notices, online: bool, by_: NoticeActor)
  ensures (inv(n) ==> canObserveConnection(n, online, by_) ==> alwaysOneToastAtATime(observeConnection(n, online, by_)))
  ensures (inv(n) ==> canObserveConnection(n, online, by_) ==> alwaysAWaitingToastShowsWhenItCan(observeConnection(n, online, by_)))
  ensures (inv(n) ==> canObserveConnection(n, online, by_) ==> alwaysEachActionFitsItsSource(observeConnection(n, online, by_)))
  ensures (inv(n) ==> canObserveConnection(n, online, by_) ==> alwaysEachNoticeHasItsOwnNumber(observeConnection(n, online, by_)))
  ensures (inv(n) ==> canObserveConnection(n, online, by_) ==> alwaysNothingCoversADecision(observeConnection(n, online, by_)))
  ensures (inv(n) ==> canObserveConnection(n, online, by_) ==> alwaysOneCauseInOrder(observeConnection(n, online, by_)))
  ensures (inv(n) ==> canObserveConnection(n, online, by_) ==> alwaysNotificationsAreDueReminders(observeConnection(n, online, by_)))
  ensures (inv(n) ==> canObserveConnection(n, online, by_) ==> alwaysReminderToastsAreDue(observeConnection(n, online, by_)))
  ensures (inv(n) ==> canObserveConnection(n, online, by_) ==> alwaysEveryDueReminderReachesAndroidInTheBackground(observeConnection(n, online, by_)))
  ensures (inv(n) ==> canObserveConnection(n, online, by_) ==> alwaysNoToastInTheBackground(observeConnection(n, online, by_)))
  ensures (inv(n) ==> canObserveConnection(n, online, by_) ==> stepBackOnlineIsToldOnce(n, "observeConnection", observeConnection(n, online, by_)))
  ensures (inv(n) ==> canObserveConnection(n, online, by_) ==> stepOnlyReconnectingSaysBackOnline(n, "observeConnection", observeConnection(n, online, by_)))
  ensures (inv(n) ==> canObserveConnection(n, online, by_) ==> stepAndroidOnlyInTheBackground(n, observeConnection(n, online, by_)))
  ensures (inv(n) ==> canObserveConnection(n, online, by_) ==> stepGraceSpeaksOnlyWhenAsked(n, "observeConnection", observeConnection(n, online, by_)))
{
  if inv(n) && canObserveConnection(n, online, by_) {
    var m := n.(online := true);
    if online && !n.online && !n.place.Background? {
      lawANewNoticeJoinsTheEndOfTheLine_ensures(Connectivity, NoOffer, "online", m);
      NumbersKeptAppend(n, observeConnection(n, online, by_), Notice(n.nextId, Connectivity, NoOffer, "online"));
    }
  }
}

lemma openAndroidNotification_ensures(n: Notices, subject: string, by_: NoticeActor)
  ensures (inv(n) ==> canOpenAndroidNotification(n, subject, by_) ==> alwaysOneToastAtATime(openAndroidNotification(n, subject, by_)))
  ensures (inv(n) ==> canOpenAndroidNotification(n, subject, by_) ==> alwaysAWaitingToastShowsWhenItCan(openAndroidNotification(n, subject, by_)))
  ensures (inv(n) ==> canOpenAndroidNotification(n, subject, by_) ==> alwaysEachActionFitsItsSource(openAndroidNotification(n, subject, by_)))
  ensures (inv(n) ==> canOpenAndroidNotification(n, subject, by_) ==> alwaysEachNoticeHasItsOwnNumber(openAndroidNotification(n, subject, by_)))
  ensures (inv(n) ==> canOpenAndroidNotification(n, subject, by_) ==> alwaysNothingCoversADecision(openAndroidNotification(n, subject, by_)))
  ensures (inv(n) ==> canOpenAndroidNotification(n, subject, by_) ==> alwaysOneCauseInOrder(openAndroidNotification(n, subject, by_)))
  ensures (inv(n) ==> canOpenAndroidNotification(n, subject, by_) ==> alwaysNotificationsAreDueReminders(openAndroidNotification(n, subject, by_)))
  ensures (inv(n) ==> canOpenAndroidNotification(n, subject, by_) ==> alwaysReminderToastsAreDue(openAndroidNotification(n, subject, by_)))
  ensures (inv(n) ==> canOpenAndroidNotification(n, subject, by_) ==> alwaysEveryDueReminderReachesAndroidInTheBackground(openAndroidNotification(n, subject, by_)))
  ensures (inv(n) ==> canOpenAndroidNotification(n, subject, by_) ==> alwaysNoToastInTheBackground(openAndroidNotification(n, subject, by_)))
  ensures (inv(n) ==> canOpenAndroidNotification(n, subject, by_) ==> stepBackOnlineIsToldOnce(n, "openAndroidNotification", openAndroidNotification(n, subject, by_)))
  ensures (inv(n) ==> canOpenAndroidNotification(n, subject, by_) ==> stepOnlyReconnectingSaysBackOnline(n, "openAndroidNotification", openAndroidNotification(n, subject, by_)))
  ensures (inv(n) ==> canOpenAndroidNotification(n, subject, by_) ==> stepAndroidOnlyInTheBackground(n, openAndroidNotification(n, subject, by_)))
  ensures (inv(n) ==> canOpenAndroidNotification(n, subject, by_) ==> stepGraceSpeaksOnlyWhenAsked(n, "openAndroidNotification", openAndroidNotification(n, subject, by_)))
{
  if inv(n) && canOpenAndroidNotification(n, subject, by_) {
    var after := openAndroidNotification(n, subject, by_);
    forall r: string
      ensures r in after.androidNotifications ==> r in n.androidNotifications
    {
      ProofLib.FilterMember((r: string) => (r != subject), n.androidNotifications, r);
    }
  }
}

lemma remind_ensures(n: Notices, subject: string, by_: NoticeActor)
  ensures (inv(n) ==> canRemind(n, subject, by_) ==> alwaysOneToastAtATime(remind(n, subject, by_)))
  ensures (inv(n) ==> canRemind(n, subject, by_) ==> alwaysAWaitingToastShowsWhenItCan(remind(n, subject, by_)))
  ensures (inv(n) ==> canRemind(n, subject, by_) ==> alwaysEachActionFitsItsSource(remind(n, subject, by_)))
  ensures (inv(n) ==> canRemind(n, subject, by_) ==> alwaysEachNoticeHasItsOwnNumber(remind(n, subject, by_)))
  ensures (inv(n) ==> canRemind(n, subject, by_) ==> alwaysNothingCoversADecision(remind(n, subject, by_)))
  ensures (inv(n) ==> canRemind(n, subject, by_) ==> alwaysOneCauseInOrder(remind(n, subject, by_)))
  ensures (inv(n) ==> canRemind(n, subject, by_) ==> alwaysNotificationsAreDueReminders(remind(n, subject, by_)))
  ensures (inv(n) ==> canRemind(n, subject, by_) ==> alwaysReminderToastsAreDue(remind(n, subject, by_)))
  ensures (inv(n) ==> canRemind(n, subject, by_) ==> alwaysEveryDueReminderReachesAndroidInTheBackground(remind(n, subject, by_)))
  ensures (inv(n) ==> canRemind(n, subject, by_) ==> alwaysNoToastInTheBackground(remind(n, subject, by_)))
  ensures (inv(n) ==> canRemind(n, subject, by_) ==> stepBackOnlineIsToldOnce(n, "remind", remind(n, subject, by_)))
  ensures (inv(n) ==> canRemind(n, subject, by_) ==> stepOnlyReconnectingSaysBackOnline(n, "remind", remind(n, subject, by_)))
  ensures (inv(n) ==> canRemind(n, subject, by_) ==> stepAndroidOnlyInTheBackground(n, remind(n, subject, by_)))
  ensures (inv(n) ==> canRemind(n, subject, by_) ==> stepGraceSpeaksOnlyWhenAsked(n, "remind", remind(n, subject, by_)))
{
  if inv(n) && canRemind(n, subject, by_) && n.place.OtherScreen? {
    var due := n.(reminders := (n.reminders + [subject]));
    lawANewNoticeJoinsTheEndOfTheLine_ensures(Calendar, SeeDetails, subject, due);
    NumbersKeptAppend(n, remind(n, subject, by_), Notice(n.nextId, Calendar, SeeDetails, subject));
  }
}

lemma dismissReminder_ensures(n: Notices, subject: string, by_: NoticeActor)
  ensures (inv(n) ==> canDismissReminder(n, subject, by_) ==> alwaysOneToastAtATime(dismissReminder(n, subject, by_)))
  ensures (inv(n) ==> canDismissReminder(n, subject, by_) ==> alwaysAWaitingToastShowsWhenItCan(dismissReminder(n, subject, by_)))
  ensures (inv(n) ==> canDismissReminder(n, subject, by_) ==> alwaysEachActionFitsItsSource(dismissReminder(n, subject, by_)))
  ensures (inv(n) ==> canDismissReminder(n, subject, by_) ==> alwaysEachNoticeHasItsOwnNumber(dismissReminder(n, subject, by_)))
  ensures (inv(n) ==> canDismissReminder(n, subject, by_) ==> alwaysNothingCoversADecision(dismissReminder(n, subject, by_)))
  ensures (inv(n) ==> canDismissReminder(n, subject, by_) ==> alwaysOneCauseInOrder(dismissReminder(n, subject, by_)))
  ensures (inv(n) ==> canDismissReminder(n, subject, by_) ==> alwaysNotificationsAreDueReminders(dismissReminder(n, subject, by_)))
  ensures (inv(n) ==> canDismissReminder(n, subject, by_) ==> alwaysReminderToastsAreDue(dismissReminder(n, subject, by_)))
  ensures (inv(n) ==> canDismissReminder(n, subject, by_) ==> alwaysEveryDueReminderReachesAndroidInTheBackground(dismissReminder(n, subject, by_)))
  ensures (inv(n) ==> canDismissReminder(n, subject, by_) ==> alwaysNoToastInTheBackground(dismissReminder(n, subject, by_)))
  ensures (inv(n) ==> canDismissReminder(n, subject, by_) ==> stepBackOnlineIsToldOnce(n, "dismissReminder", dismissReminder(n, subject, by_)))
  ensures (inv(n) ==> canDismissReminder(n, subject, by_) ==> stepOnlyReconnectingSaysBackOnline(n, "dismissReminder", dismissReminder(n, subject, by_)))
  ensures (inv(n) ==> canDismissReminder(n, subject, by_) ==> stepAndroidOnlyInTheBackground(n, dismissReminder(n, subject, by_)))
  ensures (inv(n) ==> canDismissReminder(n, subject, by_) ==> stepGraceSpeaksOnlyWhenAsked(n, "dismissReminder", dismissReminder(n, subject, by_)))
{
  if inv(n) && canDismissReminder(n, subject, by_) {
    var m := withoutReminder(subject, n);
    var after := dismissReminder(n, subject, by_);
    RemindersFiltered(subject, n);
    NumbersKeptSame(n, m);
    lawRemovingLeavesTheRestInOrder_ensures(n.nextId, subject, m);
    NumbersKeptFilter(m, after, (x: Notice) => leaves(x, n.nextId, subject));
    ShownFilter((x: Notice) => leaves(x, n.nextId, subject), n.shown);
  }
}

lemma move_ensures(n: Notices, place: Place, by_: NoticeActor)
  ensures (inv(n) ==> canMove(n, place, by_) ==> alwaysOneToastAtATime(move(n, place, by_)))
  ensures (inv(n) ==> canMove(n, place, by_) ==> alwaysAWaitingToastShowsWhenItCan(move(n, place, by_)))
  ensures (inv(n) ==> canMove(n, place, by_) ==> alwaysEachActionFitsItsSource(move(n, place, by_)))
  ensures (inv(n) ==> canMove(n, place, by_) ==> alwaysEachNoticeHasItsOwnNumber(move(n, place, by_)))
  ensures (inv(n) ==> canMove(n, place, by_) ==> alwaysNothingCoversADecision(move(n, place, by_)))
  ensures (inv(n) ==> canMove(n, place, by_) ==> alwaysOneCauseInOrder(move(n, place, by_)))
  ensures (inv(n) ==> canMove(n, place, by_) ==> alwaysNotificationsAreDueReminders(move(n, place, by_)))
  ensures (inv(n) ==> canMove(n, place, by_) ==> alwaysReminderToastsAreDue(move(n, place, by_)))
  ensures (inv(n) ==> canMove(n, place, by_) ==> alwaysEveryDueReminderReachesAndroidInTheBackground(move(n, place, by_)))
  ensures (inv(n) ==> canMove(n, place, by_) ==> alwaysNoToastInTheBackground(move(n, place, by_)))
  ensures (inv(n) ==> canMove(n, place, by_) ==> stepBackOnlineIsToldOnce(n, "move", move(n, place, by_)))
  ensures (inv(n) ==> canMove(n, place, by_) ==> stepOnlyReconnectingSaysBackOnline(n, "move", move(n, place, by_)))
  ensures (inv(n) ==> canMove(n, place, by_) ==> stepAndroidOnlyInTheBackground(n, move(n, place, by_)))
  ensures (inv(n) ==> canMove(n, place, by_) ==> stepGraceSpeaksOnlyWhenAsked(n, "move", move(n, place, by_)))
{
  if inv(n) && canMove(n, place, by_) {
    if place.Background? {
      assert everyReminderPosted(n) == n.androidNotifications + ProofLib.Filter((r: string) => !((r in n.androidNotifications)), n.reminders);
      forall r: string
        ensures r in everyReminderPosted(n) <==> r in n.androidNotifications || r in n.reminders
      {
        ProofLib.FilterMember((r: string) => !((r in n.androidNotifications)), n.reminders, r);
      }
    } else {
      lawMovingInFrontKeepsTheLine_ensures(n, place, by_);
      NumbersKeptSame(n, move(n, place, by_));
    }
  }
}

lemma lawRemovingLeavesTheRestInOrder_ensures(id: int, reminder: string, n: Notices)
  ensures (lawRemovingLeavesTheRestInOrder(id, reminder, n) == true)
{
  var p := (x: Notice) => leaves(x, id, reminder);
  FilterConcat(p, n.shown, n.waiting);
  var fw := ProofLib.Filter(p, n.waiting);
  if |fw| > 0 {
    assert [fw[0]] + fw[1..] == fw;
  }
  assert [] + fw == fw;
}

lemma lawAWithdrawnNoticeIsGone_ensures(n: Notices, id: int, by_: NoticeActor)
  ensures (lawAWithdrawnNoticeIsGone(n, id, by_) == true)
{
  lawRemovingLeavesTheRestInOrder_ensures(id, "", n);
  forall x | x in queued(withdraw(n, id, by_))
    ensures x.id != id
  {
    ProofLib.FilterMember((x: Notice) => leaves(x, id, ""), queued(n), x);
  }
}

lemma lawDismissedEverywhere_ensures(n: Notices, subject: string, by_: NoticeActor)
  ensures (lawDismissedEverywhere(n, subject, by_) == true)
{
  if canDismissReminder(n, subject, by_) {
    var m := withoutReminder(subject, n);
    var after := dismissReminder(n, subject, by_);
    lawRemovingLeavesTheRestInOrder_ensures(n.nextId, subject, m);
    RemindersFiltered(subject, n);
    forall x | x in queued(after)
      ensures !(x.offer.SeeDetails? && x.subject == subject)
    {
      ProofLib.FilterMember((x: Notice) => leaves(x, n.nextId, subject), queued(m), x);
    }
  }
}

lemma lawCoveringKeepsTheLine_ensures(n: Notices, blocked: bool, by_: NoticeActor)
  ensures (lawCoveringKeepsTheLine(n, blocked, by_) == true)
{
  if |n.waiting| > 0 {
    assert [n.waiting[0]] + n.waiting[1..] == n.waiting;
  }
}

lemma lawMovingInFrontKeepsTheLine_ensures(n: Notices, place: Place, by_: NoticeActor)
  ensures (lawMovingInFrontKeepsTheLine(n, place, by_) == true)
{
  if |n.waiting| > 0 {
    assert [n.waiting[0]] + n.waiting[1..] == n.waiting;
  }
}

lemma FilterConcat(p: Notice -> bool, a: seq<Notice>, b: seq<Notice>)
  ensures ProofLib.Filter(p, a + b) == ProofLib.Filter(p, a) + ProofLib.Filter(p, b)
  decreases |a|
{
  if |a| == 0 {
    ProofLib.FilterNil(p, a);
    assert a + b == b;
  } else {
    ProofLib.FilterCons(p, a + b);
    ProofLib.FilterCons(p, a);
    assert (a + b)[1..] == a[1..] + b;
    FilterConcat(p, a[1..], b);
  }
}

lemma ShownFilter(p: Notice -> bool, s: seq<Notice>)
  requires |s| <= 1
  ensures |ProofLib.Filter(p, s)| <= 1
  ensures |s| == 0 ==> ProofLib.Filter(p, s) == []
{
  if |s| == 0 {
    ProofLib.FilterNil(p, s);
  } else {
    ProofLib.FilterCons(p, s);
    ProofLib.FilterNil(p, s[1..]);
  }
}

lemma RemindersFiltered(subject: string, n: Notices)
  ensures forall r :: r in withoutReminder(subject, n).reminders <==> r in n.reminders && r != subject
  ensures forall r :: r in withoutReminder(subject, n).androidNotifications <==> r in n.androidNotifications && r != subject
  ensures queued(withoutReminder(subject, n)) == queued(n)
  ensures withoutReminder(subject, n).nextId == n.nextId
{
  var after := withoutReminder(subject, n);
  assert after.reminders == ProofLib.Filter((r: string) => (r != subject), n.reminders);
  assert after.androidNotifications == ProofLib.Filter((r: string) => (r != subject), n.androidNotifications);
  forall r: string
    ensures r in after.reminders <==> r in n.reminders && r != subject
    ensures r in after.androidNotifications <==> r in n.androidNotifications && r != subject
  {
    ProofLib.FilterMember((r: string) => (r != subject), n.reminders, r);
    ProofLib.FilterMember((r: string) => (r != subject), n.androidNotifications, r);
  }
}

lemma OwnNumbers(xs: seq<Notice>)
  ensures (forall x :: x in xs ==> hasItsOwnNumber(xs, x)) <==> ProofLib.DistinctBy(xs, (z: Notice) => z.id)
{
  forall i | 0 <= i < |xs|
    ensures hasItsOwnNumber(xs, xs[i]) <==> (forall j :: 0 <= j < |xs| && j != i ==> xs[j].id != xs[i].id)
  {
    var x := xs[i];
    assert hasItsOwnNumber(xs, x) <==> |ProofLib.Filter((y: Notice) => (y.id == x.id), xs)| == 1;
    ProofLib.FilterCountOneIffUnique((y: Notice) => (y.id == x.id), xs, (z: Notice) => z.id, i);
  }
}

lemma Numbered(n: Notices)
  ensures alwaysEachNoticeHasItsOwnNumber(n) <==>
    (forall x :: x in queued(n) ==> x.id < n.nextId) && ProofLib.DistinctBy(queued(n), (z: Notice) => z.id)
{
  OwnNumbers(queued(n));
}

lemma NumbersKeptSame(n: Notices, m: Notices)
  requires alwaysEachNoticeHasItsOwnNumber(n) && queued(m) == queued(n) && m.nextId == n.nextId
  ensures alwaysEachNoticeHasItsOwnNumber(m)
{
  Numbered(n);
  Numbered(m);
}

lemma NumbersKeptAppend(n: Notices, m: Notices, x: Notice)
  requires alwaysEachNoticeHasItsOwnNumber(n) && queued(m) == queued(n) + [x]
  requires x.id == n.nextId && m.nextId == n.nextId + 1
  ensures alwaysEachNoticeHasItsOwnNumber(m)
  ensures forall y :: y in queued(m) ==> y in queued(n) || y == x
{
  Numbered(n);
  ProofLib.DistinctByConcat(queued(n), [x], (z: Notice) => z.id);
  Numbered(m);
}

lemma NumbersKeptSuffix(n: Notices, m: Notices)
  requires alwaysEachNoticeHasItsOwnNumber(n) && queued(m) == n.waiting && m.nextId == n.nextId
  ensures alwaysEachNoticeHasItsOwnNumber(m)
  ensures forall y :: y in queued(m) ==> y in queued(n)
{
  Numbered(n);
  var q := queued(n);
  var k := |n.shown|;
  assert forall i :: 0 <= i < |n.waiting| ==> n.waiting[i] == q[k + i];
  forall i, j | 0 <= i < |n.waiting| && 0 <= j < |n.waiting| && i != j
    ensures n.waiting[i].id != n.waiting[j].id
  {
    assert n.waiting[i] == q[k + i] && n.waiting[j] == q[k + j];
  }
  Numbered(m);
}

lemma NumbersKeptFilter(n: Notices, m: Notices, p: Notice -> bool)
  requires alwaysEachNoticeHasItsOwnNumber(n) && queued(m) == ProofLib.Filter(p, queued(n)) && m.nextId == n.nextId
  ensures alwaysEachNoticeHasItsOwnNumber(m)
  ensures forall y :: y in queued(m) <==> y in queued(n) && p(y)
{
  Numbered(n);
  ProofLib.FilterKeepsDistinctBy(p, queued(n), (z: Notice) => z.id);
  forall y: Notice
    ensures y in queued(m) <==> y in queued(n) && p(y)
  {
    ProofLib.FilterMember(p, queued(n), y);
  }
  Numbered(m);
}

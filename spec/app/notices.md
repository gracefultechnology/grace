# Toasts, banners and Android notifications

Every short message Grace puts in front of the person comes through this one
owner: the toast at the bottom of the screen ("Moved to Trash" with Undo,
"Saved to Files", "Back online", a due reminder on a screen other than Home),
the banner at the top of Home (not connected to the internet, a due
reminder) and the Android notification for a reminder that comes due while
Grace is not in front. The calendar, Email, Files, Settings and the
connection raise notices here; each still owns what its notice is about.
[The calendar view](./calendarView.md) owns whether a reminder is shown and
alone dismisses one, [Email](./email.md) owns the Undo it offers and
withdraws it when it no longer applies, and [the shell](./shell.md) owns
whether the tablet is online.

The prototype's toasts are all raised here: "Saved to your calendar" and
"Deleted" with the event's title from the calendar
(`prototype/Grace Prototype.html:2173–2176`), "Connected to" with the
network's name from the Wi-Fi page (`:2035`), "The internet isn't connected.
Tap Wi-Fi to fix it." when the person opens the internet while offline
(`:2249–2250`), Email's and Files' own messages, and "Back online" and the
reminder toast below. Email can open offline to show saved mail and keep an
outgoing message in Outbox. Fresh provider reads and sending need a connection. Its
"In the full version…" toasts and the "Hey Grace is off" toast are demo messages with no
counterpart in this delivery.

The prototype's toast replaces whatever toast was showing
(`Grace Prototype.html:1825–1826`), so a second message could wipe an Undo
the person was reaching for. Here notices queue instead and show one at a
time.

Grace does not speak a notice. It is written on the screen, and she reads it
aloud only when the person asks her to.

## Story: See one message at a time, in the order things happened

> As a person using Grace, I want each short message to stay long enough to
> read and act on, and never to be wiped away by the next one.

### One toast shows at a time and the others wait their turn in order

A notice is raised by its source with what it is about (a message, an event,
a file) and at most one action: Undo, from Email or Settings, or See details,
which only a reminder's toast has and only the reminder rule below raises.
"Back online" is raised only by the connection rule below. A new toast joins
the end of the line; while one is showing the others wait, and when it
closes the next in line shows, so toasts show first come, first shown. A
toast waiting shows as soon as nothing stops it. The toast sits 24 pixels
above compact Grace, or above the bottom edge when she is closed or expanded
(`Grace Prototype.html:1826`).

```quint
type NoticeActor = Person | App | Host
type Source = Calendar | Email | Files | Connectivity | Settings
type Offer = NoOffer | Undo | SeeDetails
type Place = Home | OtherScreen | Background
type Notice = { id: int, source: Source, offer: Offer, subject: str }
type Notices = {
  shown: List[Notice], waiting: List[Notice], nextId: int,
  place: Place, expanded: bool, blocked: bool, online: bool,
  reminders: List[str], androidNotifications: List[str], spoken: int
}
pure val initial: Notices = {
  shown: List(), waiting: List(), nextId: 0,
  place: Home, expanded: false, blocked: false, online: true,
  reminders: List(), androidNotifications: List(), spoken: 0
}
pure def offerFits(source: Source, offer: Offer): bool =
  offer == NoOffer or (offer == Undo and (source == Email or source == Settings)) or
    (offer == SeeDetails and source == Calendar)
pure def isBackOnline(x: Notice): bool = x.source == Connectivity and x.subject == "online"
pure def withShown(shown: List[Notice], n: Notices): Notices =
  if (shown.length() == 0 and not(n.blocked) and n.place != Background and n.waiting.length() > 0)
    { ...n, shown: List(n.waiting.head()), waiting: n.waiting.tail() }
  else { ...n, shown: shown }
pure def withNotice(source: Source, offer: Offer, subject: str, n: Notices): Notices =
  if (n.place == Background) n
  else withShown(n.shown, { ...n,
    waiting: n.waiting.append({ id: n.nextId, source: source, offer: offer, subject: subject }),
    nextId: n.nextId + 1 })
pure def canRaise(n: Notices, source: Source, offer: Offer, subject: str, by: NoticeActor): bool =
  by == App and subject != "" and offer != SeeDetails and offerFits(source, offer) and
    not(isBackOnline({ id: n.nextId, source: source, offer: offer, subject: subject }))
pure def raise(n: Notices, source: Source, offer: Offer, subject: str, by: NoticeActor): Notices =
  withNotice(source, offer, subject, n)
pure def queued(n: Notices): List[Notice] = n.shown.concat(n.waiting)
pure def alwaysOneToastAtATime(n: Notices): bool = n.shown.length() <= 1
pure def lawANewNoticeJoinsTheEndOfTheLine(source: Source, offer: Offer, subject: str, n: Notices): bool =
  n.place != Background implies
    queued(withNotice(source, offer, subject, n)) ==
      queued(n).append({ id: n.nextId, source: source, offer: offer, subject: subject })
pure def lawClosingLeavesTheRestInOrder(n: Notices): bool = queued(withShown(List(), n)) == n.waiting
pure def alwaysAWaitingToastShowsWhenItCan(n: Notices): bool =
  (n.waiting.length() > 0 and not(n.blocked) and n.place != Background) implies n.shown.length() == 1
pure def alwaysEachActionFitsItsSource(n: Notices): bool =
  queued(n).every(x => offerFits(x.source, x.offer))
pure def sometimesASecondToastWaitsForTheFirst(n: Notices): bool =
  n.shown.length() == 1 and n.waiting.length() > 0
pure def sometimesUndoShown(n: Notices): bool = n.shown.some(x => x.offer == Undo)
pure val subjectValues = Set("message", "event")
```

### Each notice has its own number, below the next one to be given

Each notice is given a number when it is raised, one higher than the last,
and keeps it while it is showing or waiting. No two notices in the line share
a number, and none has a number not yet given. The host's timer, the
person's buttons and a source taking its notice back name the notice by that
number, so a timer left over from an earlier toast never closes a later one.

```quint
pure def hasItsOwnNumber(line: List[Notice], x: Notice): bool =
  line.select(y => y.id == x.id).length() == 1
pure def alwaysEachNoticeHasItsOwnNumber(n: Notices): bool =
  queued(n).every(x => x.id < n.nextId and hasItsOwnNumber(queued(n), x))
```

### A toast stays its whole lifetime unless the person closes it or acts

A toast without an action stays 2.6 seconds and one with Undo stays 6
seconds, as in the prototype (`Grace Prototype.html:1826`). A reminder's
toast, with See details, also stays 6 seconds; this departs from the
prototype, whose reminder toast has no button and stays 2.6 seconds
(`Grace Prototype.html:2275`), so that the person has time to reach See
details. The host's timer closes only the toast showing now, and never
before that toast's lifetime; the time counts from when it was last shown.
The person may close the toast showing or press its action at any time; the
prototype's toasts have no close control, and this one is added so that a
toast never stands in the person's way. Pressing the action closes the
toast, and the host sends the action to the toast's source: Undo to Email's
or Settings' undo, See details to the calendar view's reminder. Every closed
Undo toast is reported to its source, which then withdraws that Undo.

```quint
pure def lifetimeMs(offer: Offer): int = if (offer == NoOffer) 2600 else 6000
pure def isShown(n: Notices, id: int): bool = n.shown.some(x => x.id == id)
pure def canExpire(n: Notices, id: int, elapsed: int, by: NoticeActor): bool =
  by == Host and isShown(n, id) and n.shown.every(x => elapsed >= lifetimeMs(x.offer))
pure def expire(n: Notices, id: int, elapsed: int, by: NoticeActor): Notices = withShown(List(), n)
pure def canAct(n: Notices, id: int, by: NoticeActor): bool =
  by == Person and n.shown.some(x => x.id == id and x.offer != NoOffer)
pure def act(n: Notices, id: int, by: NoticeActor): Notices = withShown(List(), n)
pure def canCloseToast(n: Notices, id: int, by: NoticeActor): bool = by == Person and isShown(n, id)
pure def closeToast(n: Notices, id: int, by: NoticeActor): Notices = withShown(List(), n)
pure def lawActionsStayLonger(offer: Offer): bool =
  offer != NoOffer implies lifetimeMs(offer) > lifetimeMs(NoOffer)
pure def lawOnlyTheShownToastCloses(n: Notices, id: int, elapsed: int, by: NoticeActor): bool =
  not(isShown(n, id)) implies not(canExpire(n, id, elapsed, by))
pure def lawNoToastClosesEarly(n: Notices, id: int, elapsed: int, by: NoticeActor): bool =
  n.shown.some(x => elapsed < lifetimeMs(x.offer)) implies not(canExpire(n, id, elapsed, by))
pure val idValues = Set(0, 1, 2)
pure val elapsedValues = Set(1000, 2600, 6000)
```

### A source takes back a notice that no longer applies

A source may take back a notice it raised while the notice is showing or
waiting: Email withdraws its Undo at the next listing refresh or another
change to that message, whichever comes before the toast closes. The notice
leaves the line wherever it is, the rest keep their order, and if it was
showing the next in line shows. So an Undo whose message has moved on never
shows.

```quint
pure def leaves(x: Notice, id: int, reminder: str): bool =
  x.id != id and not(x.offer == SeeDetails and x.subject == reminder)
pure def withoutNotices(id: int, reminder: str, n: Notices): Notices =
  withShown(n.shown.select(x => leaves(x, id, reminder)),
    { ...n, waiting: n.waiting.select(x => leaves(x, id, reminder)) })
pure def canWithdraw(n: Notices, id: int, by: NoticeActor): bool =
  by == App and queued(n).some(x => x.id == id)
pure def withdraw(n: Notices, id: int, by: NoticeActor): Notices = withoutNotices(id, "", n)
pure def lawRemovingLeavesTheRestInOrder(id: int, reminder: str, n: Notices): bool =
  queued(withoutNotices(id, reminder, n)) == queued(n).select(x => leaves(x, id, reminder))
pure def lawAWithdrawnNoticeIsGone(n: Notices, id: int, by: NoticeActor): bool =
  not(queued(withdraw(n, id, by)).some(x => x.id == id))
pure val reminderValues = Set("", "event")
```

## Story: Never have a decision covered

> As a person deciding something, I want nothing to cover the question in
> front of me.

### No notice shows over a commitment review or a website's question

While a commitment review (a payment, a sent email, a booking) or a website's
own question is open, no toast and no banner shows. A toast that was showing
goes back to the front of the line and shows again, with its whole lifetime,
once the decision is closed; the others keep waiting behind it.

```quint
pure def canCover(n: Notices, blocked: bool, by: NoticeActor): bool = by == App
pure def cover(n: Notices, blocked: bool, by: NoticeActor): Notices =
  if (blocked) { ...n, blocked: true, shown: List(), waiting: n.shown.concat(n.waiting) }
  else withShown(n.shown, { ...n, blocked: false })
pure def alwaysNothingCoversADecision(n: Notices): bool =
  n.blocked implies (n.shown.length() == 0 and bannerOf(n).kind == NoBanner)
pure def lawCoveringKeepsTheLine(n: Notices, blocked: bool, by: NoticeActor): bool =
  queued(cover(n, blocked, by)) == queued(n)
pure def sometimesAToastWaitsForADecision(n: Notices): bool = n.blocked and n.waiting.length() > 0
```

## Story: See what needs me on Home

> As a person coming back to Home, I want to see at once if the internet is
> down or something is coming up.

### Home shows one banner: the connection first, then the first reminder to come due

The banner sits at the top of Home, hidden while Grace is expanded, while
the tablet sleeps and while a decision is open (`Grace Prototype.html:1865–1871`).
When the tablet is not connected it reads "Not connected to the internet"
over "Grace can help you reconnect.", with Fix Wi-Fi, which opens the
written steps on the Wi-Fi page. Otherwise the reminder that came due first
and is not yet dismissed is the banner, with its event's title, day, time and
place, See details and Dismiss. A banner stays until what it reports ends; it
has no timer.

```quint
type BannerKind = NoBanner | OfflineBanner | ReminderBanner
type Banner = { kind: BannerKind, subject: str }
pure def bannerOf(n: Notices): Banner =
  if (n.place != Home or n.expanded or n.blocked) { kind: NoBanner, subject: "" }
  else if (not(n.online)) { kind: OfflineBanner, subject: "" }
  else if (n.reminders.length() > 0) { kind: ReminderBanner, subject: n.reminders.head() }
  else { kind: NoBanner, subject: "" }
pure def canExpand(n: Notices, expanded: bool, by: NoticeActor): bool = by == Host
pure def expand(n: Notices, expanded: bool, by: NoticeActor): Notices = { ...n, expanded: expanded }
pure def alwaysOfflineComesFirst(n: Notices): bool =
  bannerOf(n).kind == ReminderBanner implies n.online
pure def sometimesOfflineBanner(n: Notices): bool = bannerOf(n).kind == OfflineBanner
pure def sometimesReminderBanner(n: Notices): bool = bannerOf(n).kind == ReminderBanner
```

### Coming back online is told once, in a toast

When the connection returns, the offline banner goes and the toast "Back
online" says so once (`Grace Prototype.html:2132`). Nothing else raises
"Back online". Losing the connection, or hearing again that it is still up
or still down, raises no toast: the banner says it on Home, and Email and
the browser say it where they need it.

```quint
pure def canObserveConnection(n: Notices, online: bool, by: NoticeActor): bool = by == Host
pure def observeConnection(n: Notices, online: bool, by: NoticeActor): Notices =
  if (online and not(n.online)) withNotice(Connectivity, NoOffer, "online", { ...n, online: true })
  else { ...n, online: online }
pure def sometimesBackOnline(n: Notices): bool = n.online and queued(n).some(x => isBackOnline(x))
pure def stepBackOnlineIsToldOnce(before: Notices, via: str, after: Notices): bool =
  (via == "observeConnection" and not(after.online and not(before.online))) implies
    queued(after) == queued(before)
pure def stepOnlyReconnectingSaysBackOnline(before: Notices, via: str, after: Notices): bool =
  queued(after).every(x => (isBackOnline(x) and x.id >= before.nextId) implies
    (via == "observeConnection" and after.online and not(before.online)))
```

## Story: Hear about a reminder wherever I am

> As a person, I want a reminder that comes due to reach me on Home, on any
> other screen and when Grace is not in front, and to dismiss it once.

### A due reminder is a banner on Home, a toast elsewhere and an Android notification in the background

On Home a reminder that comes due is the banner. On any other screen it is
also the toast "Reminder: " with the title, the day and the time
(`Grace Prototype.html:2275`), here with See details, and the banner is
waiting on Home. A reminder's toast already showing when the person comes
back to Home stays out its lifetime while the banner shows the same reminder.
When Grace is not in front, or the tablet sleeps, every reminder that is due
and not dismissed is an Android notification with the same words, whether it
came due there or before Grace left the front, and the banner is waiting on
Home. Tapping the notification brings Grace forward on Home and removes it
from Android.

```quint
pure def canRemind(n: Notices, subject: str, by: NoticeActor): bool =
  by == App and subject != "" and not(n.reminders.includes(subject))
pure def remind(n: Notices, subject: str, by: NoticeActor): Notices = {
  val due = { ...n, reminders: n.reminders.append(subject) }
  if (n.place == Background) { ...due, androidNotifications: n.androidNotifications.append(subject) }
  else if (n.place == OtherScreen) withNotice(Calendar, SeeDetails, subject, due)
  else due
}
pure def canOpenAndroidNotification(n: Notices, subject: str, by: NoticeActor): bool =
  by == Person and n.androidNotifications.includes(subject)
pure def openAndroidNotification(n: Notices, subject: str, by: NoticeActor): Notices =
  { ...n, place: Home, androidNotifications: n.androidNotifications.select(r => r != subject) }
pure def alwaysNotificationsAreDueReminders(n: Notices): bool =
  n.androidNotifications.every(r => n.reminders.includes(r))
pure def alwaysReminderToastsAreDue(n: Notices): bool =
  queued(n).every(x => x.offer == SeeDetails implies n.reminders.includes(x.subject))
pure def alwaysEveryDueReminderReachesAndroidInTheBackground(n: Notices): bool =
  n.place == Background implies n.reminders.every(r => n.androidNotifications.includes(r))
pure def sometimesReminderToast(n: Notices): bool = n.shown.some(x => x.offer == SeeDetails)
pure def sometimesAndroidNotification(n: Notices): bool = n.androidNotifications.length() > 0
```

### Only the calendar dismisses a reminder, and then it is gone everywhere

Closing a reminder's toast, like Dismiss on its banner, on the event or on
the notification, asks the calendar view to dismiss the reminder. The toast
closes either way; the reminder leaves Home and Android only when the
calendar view dismisses it, which it refuses while a deletion question is
open, being stored or failed. Closing or acting on a toast, or its timer
running out, dismisses nothing here. When the calendar view dismisses a
reminder it is gone everywhere at once: from the banner, from Android's
notifications and from the line of toasts.

```quint
pure def canDismissReminder(n: Notices, subject: str, by: NoticeActor): bool =
  by == App and n.reminders.includes(subject)
pure def withoutReminder(subject: str, n: Notices): Notices = { ...n,
  reminders: n.reminders.select(r => r != subject),
  androidNotifications: n.androidNotifications.select(r => r != subject) }
pure def dismissReminder(n: Notices, subject: str, by: NoticeActor): Notices =
  withoutNotices(n.nextId, subject, withoutReminder(subject, n))
pure def reminderGone(n: Notices, subject: str): bool =
  not(n.reminders.includes(subject)) and not(n.androidNotifications.includes(subject)) and
    not(queued(n).some(x => x.offer == SeeDetails and x.subject == subject))
pure def lawDismissedEverywhere(n: Notices, subject: str, by: NoticeActor): bool =
  canDismissReminder(n, subject, by) implies reminderGone(dismissReminder(n, subject, by), subject)
pure def lawOnlyTheCalendarDismisses(n: Notices, id: int, elapsed: int, by: NoticeActor): bool =
  expire(n, id, elapsed, by).reminders == n.reminders and act(n, id, by).reminders == n.reminders and
    closeToast(n, id, by).reminders == n.reminders
```

### Only reminders reach Android, and a new one only while Grace is in the background

Nothing else becomes an Android notification: no new-mail notification in
this delivery. A reminder's notification is posted only while Grace is in
the background, and stays after she comes back to the front until it is
tapped or its reminder is dismissed. A toast raised while Grace is in the
background is not kept for later, because it described a moment that has
passed; leaving the foreground closes the toast showing and the ones
waiting, and each closed Undo is withdrawn by its source. Coming back to
Home or another screen shows the next toast raised from then on.

```quint
pure def everyReminderPosted(n: Notices): List[str] =
  n.androidNotifications.concat(n.reminders.select(r => not(n.androidNotifications.includes(r))))
pure def canMove(n: Notices, place: Place, by: NoticeActor): bool = by == Host
pure def move(n: Notices, place: Place, by: NoticeActor): Notices =
  if (place == Background)
    { ...n, place: Background, shown: List(), waiting: List(), androidNotifications: everyReminderPosted(n) }
  else withShown(n.shown, { ...n, place: place })
pure def lawMovingInFrontKeepsTheLine(n: Notices, place: Place, by: NoticeActor): bool =
  place != Background implies queued(move(n, place, by)) == queued(n)
pure def stepAndroidOnlyInTheBackground(before: Notices, after: Notices): bool =
  after.androidNotifications.every(r => before.androidNotifications.includes(r) or after.place == Background)
pure def alwaysNoToastInTheBackground(n: Notices): bool =
  n.place == Background implies queued(n).length() == 0
```

## Story: Hear a notice when I ask

> As a person, I want Grace to stay quiet about notices unless I ask her to
> read one.

### Grace reads a notice aloud only when the person asks

Grace never speaks a toast, a banner or a notification of her own accord.
When the person asks her to read what is on the screen, she reads the toast
showing, or else the banner, once.

```quint
pure def canReadAloud(n: Notices, by: NoticeActor): bool =
  by == Person and (n.shown.length() == 1 or bannerOf(n).kind != NoBanner)
pure def readAloud(n: Notices, by: NoticeActor): Notices = { ...n, spoken: n.spoken + 1 }
pure def stepGraceSpeaksOnlyWhenAsked(before: Notices, via: str, after: Notices): bool =
  after.spoken > before.spoken implies via == "readAloud"
pure def sometimesReadAloud(n: Notices): bool = n.spoken > 0
```

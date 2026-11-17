# Toasts, banners and Android notifications

Every short message Grace puts in front of the person comes through this one
owner: the toast at the bottom of the screen ("Moved to Trash" with Undo,
"Saved to Files", "Back online", a due reminder on a screen other than Home),
the banner at the top of Home (not connected to the internet, a due
reminder) and the Android notification for a reminder that comes due while
Grace is not in front. The calendar, Email, Files, Settings and the
connection raise notices here; each still owns what its notice is about.
[The calendar view](./calendarView.md) owns whether a reminder is shown,
[Email](./email.md) owns the Undo it offers and withdraws it when its toast
closes, and [the shell](./shell.md) owns whether the tablet is online.

The prototype's toast replaces whatever toast was showing
(`prototype/Grace Prototype.html:1825–1826`), so a second message could wipe
an Undo the person was reaching for. Here notices queue instead and show one
at a time. The prototype's "In the full version…" toasts and the "Hey Grace
is off" toast are demo messages with no counterpart in this delivery.

Grace does not speak a notice. It is written on the screen, and she reads it
aloud only when the person asks her to.

## Story: See one message at a time, in the order things happened

> As a person using Grace, I want each short message to stay long enough to
> read and act on, and never to be wiped away by the next one.

### One toast shows at a time and the others wait their turn in order

A notice is raised by its source with what it is about (a message, an event,
a file) and at most one action: Undo, from Email or Settings, or See details,
on a reminder. A toast that arrives while another is showing waits, and
toasts show first come, first shown. The toast sits 24 pixels above compact
Grace, or above the bottom edge when she is closed or expanded
(`Grace Prototype.html:1826`).

```quint
type NoticeActor = Person | App | Host
type Source = Calendar | Email | Files | Connectivity | Settings
type NoticeAction = NoAction | Undo | SeeDetails
type Place = Home | OtherScreen | Background
type Notice = { id: int, source: Source, action: NoticeAction, subject: str }
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
pure def actionFits(source: Source, action: NoticeAction): bool =
  action == NoAction or (action == Undo and (source == Email or source == Settings))
pure def showNext(n: Notices): Notices =
  if (n.shown.length() == 0 and not(n.blocked) and n.place != Background and n.waiting.length() > 0)
    { ...n, shown: List(n.waiting.head()), waiting: n.waiting.tail() }
  else n
pure def enqueue(n: Notices, source: Source, action: NoticeAction, subject: str): Notices =
  if (n.place == Background) n
  else showNext({ ...n,
    waiting: n.waiting.append({ id: n.nextId, source: source, action: action, subject: subject }),
    nextId: n.nextId + 1 })
pure def canRaise(n: Notices, source: Source, action: NoticeAction, subject: str, by: NoticeActor): bool =
  by == App and subject != "" and actionFits(source, action)
pure def raise(n: Notices, source: Source, action: NoticeAction, subject: str, by: NoticeActor): Notices =
  enqueue(n, source, action, subject)
pure def inOrder(notices: List[Notice]): bool =
  notices.foldl({ last: -1, ordered: true }, (acc, x) => { last: x.id, ordered: acc.ordered and x.id > acc.last }).ordered
pure def queued(n: Notices): List[Notice] = n.shown.concat(n.waiting)
pure def alwaysOneToastAtATime(n: Notices): bool = n.shown.length() <= 1
pure def alwaysFirstComeFirstShown(n: Notices): bool =
  inOrder(queued(n)) and queued(n).every(x => x.id < n.nextId)
pure def alwaysAWaitingToastShowsWhenItCan(n: Notices): bool =
  (n.waiting.length() > 0 and not(n.blocked) and n.place != Background) implies n.shown.length() == 1
pure def alwaysEachActionFitsItsSource(n: Notices): bool =
  queued(n).every(x => actionFits(x.source, x.action) or (x.source == Calendar and x.action == SeeDetails))
pure def sometimesASecondToastWaitsForTheFirst(n: Notices): bool =
  n.shown.length() == 1 and n.waiting.length() > 0
pure def sometimesUndoShown(n: Notices): bool = n.shown.some(x => x.action == Undo)
pure val subjectValues = Set("message", "event")
```

### A toast stays its whole lifetime unless the person closes it or acts

A toast without an action stays 2.6 seconds; one with Undo or See details
stays 6 seconds (`Grace Prototype.html:1826`). The host's timer closes only
the toast showing now, and never before its lifetime; the time counts from
when it was last shown. The person may close it or press its action at any
time. Pressing the action closes the toast, and the host sends the action to
the toast's source: Undo to Email's or Settings' undo, See details to the
calendar view's reminder. Every closed Undo toast is reported to its source,
which then withdraws that Undo.

```quint
pure def lifetimeMs(x: Notice): int = if (x.action == NoAction) 2600 else 6000
pure def isShown(n: Notices, id: int): bool = n.shown.some(x => x.id == id)
pure def close(n: Notices): Notices = showNext({ ...n, shown: List() })
pure def canExpire(n: Notices, id: int, elapsed: int, by: NoticeActor): bool =
  by == Host and isShown(n, id) and n.shown.every(x => elapsed >= lifetimeMs(x))
pure def expire(n: Notices, id: int, elapsed: int, by: NoticeActor): Notices = close(n)
pure def canAct(n: Notices, id: int, by: NoticeActor): bool =
  by == Person and n.shown.some(x => x.id == id and x.action != NoAction)
pure def act(n: Notices, id: int, by: NoticeActor): Notices = close(n)
pure def lawActionsStayLonger(x: Notice): bool =
  x.action != NoAction implies lifetimeMs(x) > lifetimeMs({ ...x, action: NoAction })
pure def lawOnlyTheShownToastCloses(n: Notices, id: int, elapsed: int, by: NoticeActor): bool =
  not(isShown(n, id)) implies not(canExpire(n, id, elapsed, by))
pure def lawNoToastClosesEarly(n: Notices, id: int, elapsed: int, by: NoticeActor): bool =
  elapsed < 2600 implies not(canExpire(n, id, elapsed, by))
pure val idValues = Set(0, 1, 2)
pure val elapsedValues = Set(1000, 2600, 6000)
```

### Closing a reminder's toast dismisses the reminder

Closing an ordinary toast only hides it. Closing the toast of a reminder is
the reminder's Dismiss, as on its banner: the reminder is gone from Home and
from Android's notifications, and its toast waits nowhere. Its timer running
out dismisses nothing, so the banner is back on Home until the person
dismisses it.

```quint
pure def withoutReminder(n: Notices, subject: str): Notices = {
  ...n,
  reminders: n.reminders.select(r => r != subject),
  androidNotifications: n.androidNotifications.select(r => r != subject),
  waiting: n.waiting.select(x => not(x.source == Calendar and x.subject == subject))
}
pure def canDismiss(n: Notices, id: int, by: NoticeActor): bool = by == Person and isShown(n, id)
pure def dismiss(n: Notices, id: int, by: NoticeActor): Notices =
  close(n.shown.foldl(n, (acc, x) => if (x.source == Calendar) withoutReminder(acc, x.subject) else acc))
pure def lawExpiringKeepsTheReminder(n: Notices, id: int, elapsed: int, by: NoticeActor): bool =
  canExpire(n, id, elapsed, by) implies expire(n, id, elapsed, by).reminders == n.reminders
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
  else showNext({ ...n, blocked: false })
pure def alwaysNothingCoversADecision(n: Notices): bool =
  n.blocked implies (n.shown.length() == 0 and bannerOf(n).kind == NoBanner)
pure def sometimesAToastWaitsForADecision(n: Notices): bool = n.blocked and n.waiting.length() > 0
```

## Story: See what needs me on Home

> As a person coming back to Home, I want to see at once if the internet is
> down or something is coming up.

### Home shows one banner: the connection first, then the earliest reminder

The banner sits at the top of Home, hidden while Grace is expanded, while
the tablet sleeps and while a decision is open (`Grace Prototype.html:1865–1871`).
When the tablet is not connected it reads "Not connected to the internet"
with Fix Wi-Fi, which opens the written steps on the Wi-Fi page. Otherwise
the earliest reminder still shown is the banner, with its event's title, day,
time and place, See details and Dismiss. A banner stays until what it reports
ends; it has no timer.

```quint
type BannerKind = NoBanner | OfflineBanner | ReminderBanner
type Banner = { kind: BannerKind, subject: str }
pure def bannerOf(n: Notices): Banner =
  if (n.place != Home or n.expanded or n.blocked) { kind: NoBanner, subject: "" }
  else if (not(n.online)) { kind: OfflineBanner, subject: "" }
  else if (n.reminders.length() > 0) { kind: ReminderBanner, subject: n.reminders.head() }
  else { kind: NoBanner, subject: "" }
pure def canMove(n: Notices, place: Place, by: NoticeActor): bool = by == Host
pure def move(n: Notices, place: Place, by: NoticeActor): Notices =
  if (place == Background) { ...n, place: Background, shown: List(), waiting: List() }
  else showNext({ ...n, place: place })
pure def canExpand(n: Notices, expanded: bool, by: NoticeActor): bool = by == Host
pure def expand(n: Notices, expanded: bool, by: NoticeActor): Notices = { ...n, expanded: expanded }
pure def alwaysOfflineComesFirst(n: Notices): bool =
  bannerOf(n).kind == ReminderBanner implies n.online
pure def sometimesOfflineBanner(n: Notices): bool = bannerOf(n).kind == OfflineBanner
pure def sometimesReminderBanner(n: Notices): bool = bannerOf(n).kind == ReminderBanner
```

### Coming back online is told once, in a toast

When the connection returns, the offline banner goes and the toast "Back
online" says so once (`Grace Prototype.html:2132`). Losing the connection
raises no toast: the banner says it on Home, and Email and the browser say
it where they need it.

```quint
pure def canObserveConnection(n: Notices, online: bool, by: NoticeActor): bool = by == Host
pure def observeConnection(n: Notices, online: bool, by: NoticeActor): Notices =
  if (online and not(n.online)) enqueue({ ...n, online: true }, Connectivity, NoAction, "online")
  else { ...n, online: online }
pure def sometimesBackOnline(n: Notices): bool =
  n.online and queued(n).some(x => x.source == Connectivity)
pure def stepBackOnlineIsToldOnce(before: Notices, via: str, after: Notices): bool =
  (via == "observeConnection" and before.online) implies after.waiting == before.waiting
```

## Story: Hear about a reminder wherever I am

> As a person, I want a reminder that comes due to reach me on Home, on any
> other screen and when Grace is not in front, and to dismiss it once.

### A due reminder is a banner on Home, a toast elsewhere and an Android notification in the background

On Home a reminder that comes due is the banner. On any other screen it is
also the toast "Reminder: " with the title, the day and the time, with See
details (`Grace Prototype.html:2275`), and the banner is waiting on Home.
When Grace is not in front, or the tablet sleeps, it is an Android
notification with the same words, and the banner is waiting on Home.
Tapping the notification brings Grace forward on Home and removes it from
Android. Dismissing a reminder anywhere, on the banner, its toast, the event
or the notification, dismisses it everywhere.

```quint
pure def canRemind(n: Notices, subject: str, by: NoticeActor): bool =
  by == App and subject != "" and not(n.reminders.includes(subject))
pure def remind(n: Notices, subject: str, by: NoticeActor): Notices = {
  val due = { ...n, reminders: n.reminders.append(subject) }
  if (n.place == Background) { ...due, androidNotifications: n.androidNotifications.append(subject) }
  else if (n.place == OtherScreen) enqueue(due, Calendar, SeeDetails, subject)
  else due
}
pure def canDismissReminder(n: Notices, subject: str, by: NoticeActor): bool =
  by != Host and n.reminders.includes(subject)
pure def dismissReminder(n: Notices, subject: str, by: NoticeActor): Notices =
  if (n.shown.some(x => x.source == Calendar and x.subject == subject)) close(withoutReminder(n, subject))
  else withoutReminder(n, subject)
pure def canOpenAndroidNotification(n: Notices, subject: str, by: NoticeActor): bool =
  by == Person and n.androidNotifications.includes(subject)
pure def openAndroidNotification(n: Notices, subject: str, by: NoticeActor): Notices =
  { ...n, place: Home, androidNotifications: n.androidNotifications.select(r => r != subject) }
pure def alwaysNotificationsAreDueReminders(n: Notices): bool =
  n.androidNotifications.every(r => n.reminders.includes(r))
pure def alwaysReminderToastsAreDue(n: Notices): bool =
  queued(n).every(x => x.source == Calendar implies n.reminders.includes(x.subject))
pure def reminderGone(n: Notices, subject: str): bool =
  not(n.reminders.includes(subject)) and not(n.androidNotifications.includes(subject)) and
    not(queued(n).some(x => x.source == Calendar and x.subject == subject))
pure def lawDismissedEverywhere(n: Notices, subject: str, by: NoticeActor): bool =
  canDismissReminder(n, subject, by) implies reminderGone(dismissReminder(n, subject, by), subject)
pure def sometimesReminderToast(n: Notices): bool = n.shown.some(x => x.source == Calendar)
pure def sometimesAndroidNotification(n: Notices): bool = n.androidNotifications.length() > 0
```

### Only reminders reach Android, and only while Grace is in the background

Nothing else becomes an Android notification: no new-mail notification in
this delivery. A toast raised while Grace is in the background is not kept
for later, because it described a moment that has passed; leaving the
foreground closes the toast showing and the ones waiting, and each closed
Undo is withdrawn by its source.

```quint
pure def stepAndroidOnlyInTheBackground(before: Notices, after: Notices): bool =
  after.androidNotifications.every(r => before.androidNotifications.includes(r) or before.place == Background)
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

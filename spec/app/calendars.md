# Calendars across accounts

With an email’s Calendar on, `prototype/Grace Prototype.html` shows one
Calendar holding the appointments of every such email and of the tablet,
each tagged with where it lives ("On this tablet", "Gmail"), a banner that
offers to connect an email while none brings its calendar, the next
appointments on Home and the sleep screen, and an appointment Grace is
asking about shown on its day as not added yet. Reading an email about an
appointment, Margaret can ask Grace to put it in her calendar. This library
derives all of that from the [email accounts](./accounts.md) registry, one
[calendar view](./calendarView.md) per account plus one for the tablet, the
[mailboxes](./mailboxes.md) and the [question Grace is waiting on](./proposal.md).
It holds no state, so what it shows never disagrees with the calendars, and
every calendar keeps its own fences (generation, reviews, storage) unchanged.

A `CalendarSource` is one calendar’s key and its view, as the shell keeps
them: key 0 is "On this tablet", any other key is the number of the email
account whose calendar it is. The shell keeps one source per key, so a
calendar is found by its key. A row carries its calendar’s key and the
appointment as shown; the shell sorts rows by start time and composes every
sentence the person or Grace reads, including an account’s name in a tag and
the note "From Main St Clinic’s email · Visit form attached", which names the sender, because the model
has no string building.

## Story: See every calendar together and know where each appointment lives

> As Margaret, I want my appointments from every email and from the tablet in
> one calendar, each marked with where it lives, and none from an email I
> switched off.

### The tablet’s calendar always shows, and an email’s only while its Calendar is on

An email’s calendar shows while that account is on the tablet with its
Calendar switch on. Switching it off or removing the account hides its
appointments and keeps them where they are; switching it back on shows them
again.

```quint
import accounts as A from "./accounts"
import mailboxes as M from "./mailboxes"
import email as E from "./email"
import emailItem as I from "./emailItem"
import files as F from "./files"
import calendar as C from "./calendar"
import calendarView as V from "./calendarView"
import proposal as P from "./proposal"
import request as R from "./request"

type CalendarSource = { key: int, view: V::CalendarView }
type CalRow = { key: int, identity: C::EntryIdentity, details: C::EntryDetails, draft: bool }
pure val tabletKey: int = 0
pure val noCalendar: CalendarSource = { key: -1, view: V::initial }
pure def showsCalendar(registry: A::Accounts, key: int): bool =
  key == tabletKey or registry.accounts.some(x => x.id == key and x.use.calendar)
pure def sourceAt(calendars: List[CalendarSource], key: int): CalendarSource =
  calendars.select(s => s.key == key).nthOr(0, noCalendar)
pure def savedRow(key: int, c: C::Calendar): CalRow =
  { key: key, identity: c.identity, details: c.committed, draft: false }
pure def lawTabletCalendarAlwaysShows(registry: A::Accounts): bool = showsCalendar(registry, tabletKey)
```

### Week and Month follow the tablet’s calendar, and every shown calendar fills the chosen days

The week or month, the day chosen and moving between them belong to the
tablet’s calendar alone, so navigation is never repeated in each account’s
calendar: Calendar’s days are the tablet calendar’s window, whatever window
an account’s calendar holds. Each shown calendar gives its saved appointments
that fall in those days, with the saved details of one being edited; a
deleted appointment never shows. A row is in the days chosen exactly when it
starts before their end and ends after their start. What Grace is shown and
what Home counts from are not Calendar’s days: the shell gives their times.

```quint
pure def lead(calendars: List[CalendarSource]): CalendarSource = sourceAt(calendars, tabletKey)
pure def chosenDays(calendars: List[CalendarSource]): V::ViewWindow = lead(calendars).view.window
pure def overlaps(details: C::EntryDetails, fromTime: int, untilTime: int): bool =
  fromTime < untilTime and details.startAt < untilTime and details.endAt > fromTime
pure def sourceRows(registry: A::Accounts, s: CalendarSource, fromTime: int, untilTime: int): List[CalRow] =
  if (showsCalendar(registry, s.key))
    C::visibleEntries(s.view.entries, s.view.owner, s.view.calendarId, fromTime, untilTime).listMap(c => savedRow(s.key, c))
  else List()
pure def calendarContext(registry: A::Accounts, calendars: List[CalendarSource], fromTime: int, untilTime: int): List[CalRow] =
  calendars.foldl(List(), (rows, s) => rows.concat(sourceRows(registry, s, fromTime, untilTime)))
pure def lawRowsUseOneWindow(registry: A::Accounts, calendars: List[CalendarSource], pending: P::Pending): bool =
  val days = chosenDays(calendars)
  dayRows(registry, calendars, pending).every(r => overlaps(r.details, days.fromTime, days.untilTime))
pure def lawSavedRowsAreSavedAppointments(registry: A::Accounts, calendars: List[CalendarSource], fromTime: int, untilTime: int): bool =
  calendarContext(registry, calendars, fromTime, untilTime).every(r => not(r.draft) and
    calendars.some(s => s.key == r.key and
      s.view.entries.some(c => c.identity == r.identity and c.hasSaved and c.phase != C::Deleted)))
```

### Tags show only when an email’s calendar is on

While at least one email brings its calendar, every row carries a tag: "On
this tablet" for the tablet’s, the account’s name for an email’s. While none
does, every shown appointment is the tablet’s and rows carry no tag. A tag is
the calendar’s key, or -1 for none; no negative key names a calendar. The
draft row of Grace’s question shows "Not added yet" in place of a tag.

```quint
pure def tagsShown(registry: A::Accounts): bool = registry.accounts.some(x => x.use.calendar)
pure def rowTag(registry: A::Accounts, key: int): int = if (tagsShown(registry)) key else -1
pure def lawTagsNeedACalendarAccount(registry: A::Accounts, key: int): bool =
  (rowTag(registry, key) != -1 implies (tagsShown(registry) and rowTag(registry, key) == key)) and
  (not(tagsShown(registry)) implies rowTag(registry, key) == -1)
```

### The connect banner shows until an email’s calendar is on or she says Not now

Calendar, in Week and Month, offers "Connect your email to keep your
calendar up to date", with the line "Appointments from your email show up
here automatically." and the button "Connect email", while no account brings
its calendar, until she taps its X, "Not now". The banner and the tags never
show together.

```quint
pure def connectBanner(registry: A::Accounts): bool = not(tagsShown(registry)) and not(registry.bannerDismissed)
pure def lawBannerFollowsAccounts(registry: A::Accounts): bool =
  (connectBanner(registry) iff (registry.accounts.every(x => not(x.use.calendar)) and not(registry.bannerDismissed))) and
  not(connectBanner(registry) and tagsShown(registry))
```

### Home and the sleep screen show the next saved appointments

Home’s calendar card and the sleep screen show the appointments of the shown
calendars that are saved and start at or after the time given, never an
appointment earlier today, a draft or Grace’s unanswered question.

```quint
pure def upcoming(registry: A::Accounts, calendars: List[CalendarSource], fromTime: int, untilTime: int): List[CalRow] =
  calendarContext(registry, calendars, fromTime, untilTime).select(r => r.details.startAt >= fromTime)
pure def lawNextAppointmentsAreSavedAndFuture(registry: A::Accounts, calendars: List[CalendarSource], fromTime: int, untilTime: int): bool =
  upcoming(registry, calendars, fromTime, untilTime).every(r => not(r.draft) and r.details.startAt >= fromTime and
    showsCalendar(registry, r.key) and
    calendars.some(s => s.key == r.key and
      s.view.entries.some(c => c.identity == r.identity and c.hasSaved and c.phase != C::Deleted)))
```

### Home’s calendar card says Last updated only while it can’t update, and otherwise what is planned

While the card can’t update, because the tablet is offline while an email’s
calendar shows, or an email whose calendar shows needs her to sign in
again, it keeps the appointments it has and says "Last updated" with when
it last did; Home’s banner says why
([Notices](./notices.md)). Only then does it say "Last updated". Otherwise it
says "Today" when a shown appointment is saved for today, "Nothing today"
when the next is on a later day, and "Nothing planned" when none is coming
(`prototype/Grace Prototype.html:1942–1945`). With nothing planned, faded rows
keep the card’s shape and Grace’s hint under her sparkle reads "Ask Grace to
add an appointment."; the card has no hint while it can’t update, since the
banner speaks for it. The tablet’s own calendar needs no internet, so with
only it showing the card never says "Last updated".

```quint
type HomeCalendarStatus = CalendarLastUpdated | CalendarToday | NothingToday | NothingPlanned
pure def shownProviderCalendars(registry: A::Accounts, calendars: List[CalendarSource]): List[CalendarSource] =
  calendars.select(s => s.key != tabletKey and showsCalendar(registry, s.key))
pure def cantUpdate(registry: A::Accounts, calendars: List[CalendarSource], sources: List[M::MailSource], online: bool): bool =
  val shown = shownProviderCalendars(registry, calendars)
  val signedOut = M::signedOut(registry, sources)
  shown.some(s => not(online) or signedOut.some(mail => mail.account == s.key))
pure def homeCalendarStatus(registry: A::Accounts, calendars: List[CalendarSource], sources: List[M::MailSource], online: bool, fromTime: int, untilTime: int, dayStart: int, dayEnd: int): HomeCalendarStatus =
  if (cantUpdate(registry, calendars, sources, online)) CalendarLastUpdated
  else if (upcoming(registry, calendars, fromTime, untilTime).length() == 0) NothingPlanned
  else if (upcoming(registry, calendars, dayStart, dayEnd).length() > 0) CalendarToday
  else NothingToday
pure def homeCalendarHint(status: HomeCalendarStatus): bool = status == NothingPlanned
pure def lawLastUpdatedOnlyWhileItCantUpdate(registry: A::Accounts, calendars: List[CalendarSource], sources: List[M::MailSource], online: bool, fromTime: int, untilTime: int, dayStart: int, dayEnd: int): bool =
  val status = homeCalendarStatus(registry, calendars, sources, online, fromTime, untilTime, dayStart, dayEnd)
  (status == CalendarLastUpdated iff cantUpdate(registry, calendars, sources, online)) and
  (shownProviderCalendars(registry, calendars).length() == 0 implies status != CalendarLastUpdated) and
  (homeCalendarHint(status) implies upcoming(registry, calendars, fromTime, untilTime).length() == 0)
```

### A switched-off account’s appointments and reminders show nowhere, to her or to Grace

A calendar that does not show has no row in the chosen days, on Home, on
the sleep screen or in what Grace is shown, no due reminder and nothing open
on screen. Grace is shown the saved appointments of the shown calendars only.
The appointment open on screen belongs to the first shown calendar that is
open with one selected; with none, it belongs to no calendar (-1).

```quint
pure def sourceReminders(registry: A::Accounts, s: CalendarSource): List[CalRow] =
  if (showsCalendar(registry, s.key)) V::shownReminders(s.view).select(c => c.hasSaved and c.phase != C::Deleted).listMap(c => savedRow(s.key, c))
  else List()
pure def shownReminders(registry: A::Accounts, calendars: List[CalendarSource]): List[CalRow] =
  calendars.foldl(List(), (rows, s) => rows.concat(sourceReminders(registry, s)))
pure def openSelected(registry: A::Accounts, calendars: List[CalendarSource]): int =
  calendars.select(s => showsCalendar(registry, s.key) and s.view.opened and s.view.selectedId != "").nthOr(0, noCalendar).key
pure def lawHiddenCalendarShowsNothing(registry: A::Accounts, calendars: List[CalendarSource], pending: P::Pending, fromTime: int, untilTime: int, key: int): bool =
  (key != noCalendar.key and not(showsCalendar(registry, key))) implies
    (dayRows(registry, calendars, pending).every(r => r.key != key) and
      upcoming(registry, calendars, fromTime, untilTime).every(r => r.key != key) and
      calendarContext(registry, calendars, fromTime, untilTime).every(r => r.key != key) and
      shownReminders(registry, calendars).every(r => r.key != key) and
      openSelected(registry, calendars) != key)
```

### Grace is told what changed in a calendar, and being told authorizes nothing

What Grace is told of a calendar is derived from it before and after one
event: that an appointment was added, changed or deleted, once the calendar’s
store saved it, whether Margaret did it or it followed her yes to Grace.
Only the store’s own result is news: an edit cancelled, or closed with the
calendar, saved nothing and tells nothing, and an appointment the provider’s
feed changed or removed is shown, not told. Nothing changed tells nothing.
Being told is a turn of the host, never hers: what Grace is told is only the
news, the calendar and the appointment, with no consent in it, so it asks
Grace to do nothing. When the store assigns a different ID to a new
appointment, the host reports the accepted creation receipt's new ID. It
matches the approved draft and the exact saved appointment. A feed update,
failed write or repeated receipt cannot earn that report.

What Margaret sees follows the same news. After an appointment was added or
changed, Calendar raises the toast "Saved to your calendar"; after one was
deleted, it raises "Deleted" followed by the appointment’s title. Both toasts
go through [the notices](./notices.md), which decide when each shows. Only a
newly added appointment’s row gets Grace’s green confirm ring, as in the
prototype: a change she saved leaves her on that appointment’s detail, with
no ring. Nothing else rings a row this way, so a confirm ring always marks an
appointment the calendar has just added.

```quint
type CalendarNews = NoCalendarNews | AddedAppointment | ChangedAppointment | DeletedAppointment
type CalendarTold = { news: CalendarNews, key: int, id: str }
pure def storedFrom(before: V::CalendarView, c: C::Calendar, wasSaved: bool): bool =
  c.phase == C::Saved and not(before.entries.includes(c)) and
    before.entries.some(b => C::sameOccurrence(b, c) and b.phase == C::Editing and b.hasSaved == wasSaved and
      b.approvedRevision >= 0 and b.approvedRevision == b.revision)
pure def told(key: int, before: V::CalendarView, after: V::CalendarView): CalendarTold =
  val quiet = { news: NoCalendarNews, key: key, id: "" }
  val added = after.entries.select(c => storedFrom(before, c, false))
  val changed = after.entries.select(c => storedFrom(before, c, true))
  val deleted = after.entries.select(c => c.phase == C::Deleted and not(before.entries.includes(c)) and
    before.deletion == V::DeletionPending and before.entries.some(b => C::sameOccurrence(b, c) and b.phase != C::Deleted))
  if (added.length() > 0) { ...quiet, news: AddedAppointment, id: added.nthOr(0, C::initial).identity.occurrenceId }
  else if (changed.length() > 0) { ...quiet, news: ChangedAppointment, id: changed.nthOr(0, C::initial).identity.occurrenceId }
  else if (deleted.length() > 0) { ...quiet, news: DeletedAppointment, id: deleted.nthOr(0, C::initial).identity.occurrenceId }
  else quiet
pure def toldCreated(key: int, before: V::CalendarView, after: V::CalendarView, created: V::CreatedReceipt): CalendarTold =
  val approved = V::entryAt(before, created.localId)
  val saved = V::entryAt(after, created.providerId)
  val matched = created.localId != created.providerId and created.owner == before.owner and created.calendarId == before.calendarId and
    created.owner == after.owner and created.calendarId == after.calendarId and
    approved.phase == C::Editing and not(approved.hasSaved) and approved.identity.kind == C::Appointment and
    approved.approvedRevision == created.revision and approved.revision == created.revision and
    V::unusedProviderId(before, created.localId, created.providerId) and not(before.cancelledIds.contains(created.localId)) and
    after.cancelledIds.contains(created.localId) and saved.phase == C::Saved and saved.hasSaved and saved.revision == created.revision and
    saved.identity == { ...approved.identity, occurrenceId: created.providerId } and saved.committed == approved.draft
  { news: if (matched) AddedAppointment else NoCalendarNews, key: key, id: if (matched) created.providerId else "" }
pure def lawCalendarToldIsDerived(key: int, view: V::CalendarView): bool =
  told(key, view, view).news == NoCalendarNews
pure def lawToldNamesWhatChanged(key: int, before: V::CalendarView, after: V::CalendarView): bool =
  val news = told(key, before, after)
  ((news.news == AddedAppointment or news.news == ChangedAppointment) implies
    after.entries.some(c => c.identity.occurrenceId == news.id and c.phase == C::Saved and not(before.entries.includes(c)))) and
  (news.news == DeletedAppointment implies
    after.entries.some(c => c.identity.occurrenceId == news.id and c.phase == C::Deleted and not(before.entries.includes(c))))
pure def lawOnlyTheStoreIsNews(key: int, view: V::CalendarView, id: str, published: C::Calendar): bool =
  val cancelled = V::changeOccurrence(view, id, V::CancelEditing, V::ViewUser)
  val fed = V::publishOccurrence(view, published, view.generation, true, V::ViewStore)
  (V::canChangeOccurrence(view, id, V::CancelEditing, V::ViewUser) implies told(key, view, cancelled).news == NoCalendarNews) and
    told(key, view, V::closeCalendar(view, V::ViewUser)).news == NoCalendarNews and
    (V::canPublishOccurrence(view, published, view.generation, true, V::ViewStore) implies told(key, view, fed).news == NoCalendarNews)
type ConfirmRing = { shown: bool, key: int, id: str }
pure def confirmRing(news: CalendarTold): ConfirmRing =
  { shown: news.news == AddedAppointment, key: news.key, id: news.id }
pure def lawRingMarksAJustSavedAppointment(key: int, before: V::CalendarView, after: V::CalendarView): bool =
  val ring = confirmRing(told(key, before, after))
  ring.shown implies (ring.key == key and
    after.entries.some(c => c.identity.occurrenceId == ring.id and c.phase == C::Saved and not(before.entries.includes(c))))
```

## Story: Ask Grace to put an email’s appointment in my calendar

> As Margaret reading an email about an appointment, I want Grace to suggest
> it, add it once I say yes, and remember which email it came from, without
> adding it twice.

### An appointment from an email goes to that email’s calendar, else to the tablet’s

The calendar an email’s appointment goes to is the calendar of the account
the email came to while that account’s Calendar is on, and "On this tablet"
otherwise. Either way it is a calendar that shows.

```quint
pure def targetCalendar(registry: A::Accounts, account: int): int =
  if (account != tabletKey and registry.accounts.some(x => x.id == account and x.use.calendar)) account else tabletKey
pure def lawTargetCalendarShows(registry: A::Accounts, account: int): bool =
  showsCalendar(registry, targetCalendar(registry, account)) and
    (targetCalendar(registry, account) == account or targetCalendar(registry, account) == tabletKey)
```

### An appointment from an email names that email, goes to its account’s calendar, and is asked once

Grace may ask to add an appointment from an email only while that email is
the one open on screen, in the email of the account Email shows open, and
carries no scam warning; an email left open in an account that is not on
screen does not count. The
appointment names that email as its source, goes to the calendar chosen
above, as that calendar is now, and is exactly one its calendar would take on
her yes: a new appointment, which she may propose marked important, as the
clinic's appointment is in the prototype. Grace does not ask while
any calendar already holds an appointment from that email, while she is
already asking about it, or while Margaret’s yes to an earlier question is
being applied. The source is the pair of the originating mailbox’s registry ID and the provider’s
message reference. Distinct mailboxes can use identical provider references.
A saved or pending appointment matches this pair even when its destination is the
tablet’s calendar.

```quint
pure def matchesEmail(identity: C::EntryIdentity, account: int, ref: str): bool =
  account > 0 and ref != "" and identity.kind == C::Appointment and identity.sourceAccount == account and identity.sourceRef == ref
pure def alreadyFrom(calendars: List[CalendarSource], account: int, ref: str): bool =
  calendars.some(s => s.view.entries.some(c => matchesEmail(c.identity, account, ref) and c.phase != C::Deleted))
pure def pendingFrom(pending: P::Pending, account: int, ref: str): bool =
  val ask = pending.ask
  match ask {
    | AddAsk(x) => matchesEmail(x.review.entry.identity, account, ref)
    | _ => false
  }
pure def openMail(registry: A::Accounts, sources: List[M::MailSource]): M::MailSource =
  M::sourceOf(sources, M::openSource(registry, sources))
pure def fromMessageAllowed(registry: A::Accounts, calendars: List[CalendarSource], sources: List[M::MailSource],
    pending: P::Pending, review: V::AppointmentReview): bool =
  val mail = openMail(registry, sources)
  val box = mail.mailbox
  val target = sourceAt(calendars, targetCalendar(registry, mail.account))
  M::showsMail(registry, mail.account) and box.view == E::Message and E::selectedMessageIsCurrent(box) and
  box.warning.evidence == "" and pending.agreed == 0 and
  review.entry.identity.kind == C::Appointment and
  matchesEmail(review.entry.identity, mail.account, box.messageRef) and target.key >= 0 and target.view.owner != "" and
  review.entry.identity.owner == target.view.owner and review.entry.identity.calendarId == target.view.calendarId and
  V::canConfirmAppointment(target.view, { entry: review.entry, review: review }, V::ViewConsent) and
  not(alreadyFrom(calendars, mail.account, box.messageRef)) and not(pendingFrom(pending, mail.account, box.messageRef))
pure def lawEmailAppointmentNamesItsSource(registry: A::Accounts, calendars: List[CalendarSource], sources: List[M::MailSource],
    pending: P::Pending, review: V::AppointmentReview): bool =
  fromMessageAllowed(registry, calendars, sources, pending, review) implies
    (matchesEmail(review.entry.identity, openMail(registry, sources).account, openMail(registry, sources).mailbox.messageRef) and
      openMail(registry, sources).account == M::openSource(registry, sources))
pure def lawEmailAppointmentGoesToItsAccountsCalendar(registry: A::Accounts, calendars: List[CalendarSource], sources: List[M::MailSource],
    pending: P::Pending, review: V::AppointmentReview): bool =
  val target = sourceAt(calendars, targetCalendar(registry, openMail(registry, sources).account))
  fromMessageAllowed(registry, calendars, sources, pending, review) implies
    (review.entry.identity.calendarId == target.view.calendarId and review.entry.identity.owner == target.view.owner and
      review.calendarGeneration == target.view.generation and showsCalendar(registry, target.key))
pure def lawSameEmailIsNotAskedTwice(registry: A::Accounts, calendars: List[CalendarSource], sources: List[M::MailSource],
    pending: P::Pending, review: V::AppointmentReview): bool =
  (alreadyFrom(calendars, openMail(registry, sources).account, openMail(registry, sources).mailbox.messageRef) or pendingFrom(pending, openMail(registry, sources).account, openMail(registry, sources).mailbox.messageRef) or pending.agreed != 0) implies
    not(fromMessageAllowed(registry, calendars, sources, pending, review))
pure def lawScamEmailMakesNoAppointment(registry: A::Accounts, calendars: List[CalendarSource], sources: List[M::MailSource],
    pending: P::Pending, review: V::AppointmentReview): bool =
  (openMail(registry, sources).mailbox.warning.evidence != "" or not(M::showsMail(registry, openMail(registry, sources).account))) implies
    not(fromMessageAllowed(registry, calendars, sources, pending, review))
pure def lawEmailAppointmentIsOneTheCalendarTakes(registry: A::Accounts, calendars: List[CalendarSource], sources: List[M::MailSource],
    pending: P::Pending, review: V::AppointmentReview): bool =
  val target = sourceAt(calendars, targetCalendar(registry, openMail(registry, sources).account))
  val asked = { ...pending, ask: P::AddAsk({ target: target.key, review: review }) }
  fromMessageAllowed(registry, calendars, sources, pending, review) implies
    V::canConfirmAppointment(target.view, confirmationOf(asked), V::ViewConsent)
```

### While Grace asks, the appointment shows on its day as not added yet

The appointment Grace is asking to add shows in a calendar that shows, on the
days it falls on, as a draft: "Not added yet · Grace is asking you". Once its
calendar has saved it, the saved row takes its place. A change or deletion
she is asking about is not drawn as a row.

```quint
pure def askedRows(registry: A::Accounts, pending: P::Pending, fromTime: int, untilTime: int, saved: List[CalRow]): List[CalRow] =
  val ask = pending.ask
  match ask {
    | AddAsk(x) =>
        if (showsCalendar(registry, x.target) and overlaps(x.review.entry.details, fromTime, untilTime) and
            not(saved.some(r => r.key == x.target and r.identity.occurrenceId == x.review.entry.identity.occurrenceId)))
          List({ key: x.target, identity: x.review.entry.identity, details: x.review.entry.details, draft: true })
        else List()
    | _ => List()
  }
pure def dayRows(registry: A::Accounts, calendars: List[CalendarSource], pending: P::Pending): List[CalRow] =
  val days = chosenDays(calendars)
  val saved = calendarContext(registry, calendars, days.fromTime, days.untilTime)
  saved.concat(askedRows(registry, pending, days.fromTime, days.untilTime, saved))
pure def lawDraftRowIsTheQuestion(registry: A::Accounts, calendars: List[CalendarSource], pending: P::Pending): bool =
  val ask = pending.ask
  dayRows(registry, calendars, pending).every(r => r.draft implies
    (match ask {
      | AddAsk(x) => r.key == x.target and r.identity == x.review.entry.identity and r.details == x.review.entry.details
      | _ => false
    }))
```

### Calendar turns to the day of Grace’s question and of what was just added, but never past an edit

While Calendar is open and no calendar has an appointment being edited or a
deletion asked about, being stored or failed, a new question from Grace to
add an appointment selects the day it starts on, in Week, so its draft row is
in view. Once a calendar has saved an added appointment, whether after her
yes or by her own Save, the day it starts on is selected and its row has
Grace’s confirm ring if the saved appointment is still the current selection.
The first successful provider receipt for an approved appointment from email
keeps that appointment’s detail open under the provider’s ID. Returning to
the week shows its ring on the day it starts while the save confirmation is
still active. A late report for an appointment
that is no longer selected cannot turn the day. A change she saved herself
leaves Calendar where it is, on that appointment’s detail. An appointment being edited, a "Delete?"
awaiting her answer and a failed deletion are never discarded for this: while
one is, Calendar stays where it is, and the question turns it once Calendar is
free, if Grace is still asking it. The host remembers the last question that
turned the day, or that Grace asked while Calendar was closed, and only a
different one turns it again. The host gives two verified reports: the local
day the appointment starts on, with its number and hours, and a chosen day in
Week that selects that same day, so the turn is one Calendar itself would
accept from her.

```quint
type DayToShow = { show: bool, startAt: int }
type StartDay = { startAt: int, day: int, fromTime: int, untilTime: int, verified: bool }
pure val stayOnDay: DayToShow = { show: false, startAt: 0 }
pure def calendarFree(calendars: List[CalendarSource]): bool =
  lead(calendars).view.opened and calendars.every(s => s.view.deletion == V::NoDeletion and not(V::hasEditing(s.view)))
pure def askedDay(registry: A::Accounts, calendars: List[CalendarSource], earlier: P::Pending, pending: P::Pending): DayToShow =
  val ask = pending.ask
  match ask {
    | AddAsk(x) =>
        if (ask != earlier.ask and calendarFree(calendars) and showsCalendar(registry, x.target))
          { show: true, startAt: x.review.entry.details.startAt }
        else stayOnDay
    | _ => stayOnDay
  }
pure def savedDay(registry: A::Accounts, calendars: List[CalendarSource], news: CalendarTold): DayToShow =
  val source = sourceAt(calendars, news.key).view
  val saved = V::entryAt(source, news.id)
  if (news.news == AddedAppointment and calendarFree(calendars) and showsCalendar(registry, news.key) and
      openSelected(registry, calendars) == news.key and source.selectedId == news.id and saved.phase == C::Saved)
    { show: true, startAt: saved.committed.startAt }
  else stayOnDay
pure def preservesCreatedEmailDetail(before: V::CalendarView, after: V::CalendarView, created: V::CreatedReceipt): bool =
  before.opened and before.selectedId == created.localId and after.selectedId == created.providerId and
    created.revision == C::initial.revision + 1 and V::entryAt(before, created.localId).identity.sourceRef != ""
pure def showsDay(report: V::NavigationReport, start: StartDay, day: DayToShow): bool =
  day.show and start.verified and start.startAt == day.startAt and
    start.fromTime <= day.startAt and day.startAt < start.untilTime and
    report.kind == V::SelectDay and report.verified and report.window.mode == V::WeekView and
    report.window.anchorDay == start.day and report.window.selectedDay == start.day and V::validWindow(report.window) and
    report.window.fromTime <= start.fromTime and start.untilTime <= report.window.untilTime
pure def lawCalendarSelectsTheStartDay(registry: A::Accounts, calendars: List[CalendarSource], earlier: P::Pending,
    pending: P::Pending, news: CalendarTold, report: V::NavigationReport, start: StartDay): bool =
  val turned = V::navigate(lead(calendars).view, report, V::ViewUser)
  (showsDay(report, start, askedDay(registry, calendars, earlier, pending)) or showsDay(report, start, savedDay(registry, calendars, news))) implies
    (V::canNavigate(lead(calendars).view, report, V::ViewUser) and turned.window.selectedDay == start.day and
      turned.window.fromTime <= start.startAt and start.startAt < turned.window.untilTime)
pure def lawAnEditIsNeverDiscarded(registry: A::Accounts, calendars: List[CalendarSource], earlier: P::Pending,
    pending: P::Pending, news: CalendarTold): bool =
  calendars.some(s => V::hasEditing(s.view) or s.view.deletion != V::NoDeletion) implies
    (not(askedDay(registry, calendars, earlier, pending).show) and not(savedDay(registry, calendars, news).show))
pure def lawOnlyAnAdditionTurnsTheDay(registry: A::Accounts, calendars: List[CalendarSource], news: CalendarTold): bool =
  news.news != AddedAppointment implies not(savedDay(registry, calendars, news).show)
pure def lawOnlyTheSelectedSaveTurnsTheDay(registry: A::Accounts, calendars: List[CalendarSource], news: CalendarTold): bool =
  (openSelected(registry, calendars) != news.key or sourceAt(calendars, news.key).view.selectedId != news.id) implies
    not(savedDay(registry, calendars, news).show)
pure def lawSavedDayIsTheRingedAppointment(registry: A::Accounts, calendars: List[CalendarSource], news: CalendarTold): bool =
  val day = savedDay(registry, calendars, news)
  day.show implies (confirmRing(news).shown and confirmRing(news).key == news.key and
    sourceAt(calendars, news.key).view.entries.some(c => c.identity.occurrenceId == news.id and c.phase == C::Saved and
      c.committed.startAt == day.startAt))
```

### Her yes is applied as the exact question she was asked

After her yes, the host applies to the question’s target calendar exactly
the appointment, change or deletion she was shown, with the calendar
generation it was reviewed against, so the calendar refuses it if anything
moved since. A yes applies only the kind of question asked: with no such
question, the request built is one every calendar refuses as changed.

```quint
pure val noSeed: V::EntrySeed = { identity: C::noIdentity, details: C::noDetails }
pure val noConfirmation: V::ConfirmedAppointment =
  { entry: noSeed, review: { entry: noSeed, calendarGeneration: -1, displayTimezone: "" } }
pure val noChange: V::ConfirmedChange =
  { id: "", details: C::noDetails, review: { id: "none", details: C::noDetails, committedRevision: -1, calendarGeneration: -1 } }
pure val noDeletionRequest: V::ConfirmedDeletion =
  { id: "", scope: V::ThisOccurrence, review: { id: "", scope: V::EntireSeries, committedRevision: -1, calendarGeneration: -1 } }
pure def confirmationOf(pending: P::Pending): V::ConfirmedAppointment =
  val ask = pending.ask
  match ask {
    | AddAsk(x) => { entry: x.review.entry,
        review: { entry: x.review.entry, calendarGeneration: x.review.calendarGeneration, displayTimezone: x.review.displayTimezone } }
    | _ => noConfirmation
  }
pure def changeOf(pending: P::Pending): V::ConfirmedChange =
  val ask = pending.ask
  match ask {
    | ChangeAsk(x) => { id: x.review.id, details: x.review.details,
        review: { id: x.review.id, details: x.review.details, committedRevision: x.review.committedRevision,
          calendarGeneration: x.review.calendarGeneration } }
    | _ => noChange
  }
pure def deletionOf(pending: P::Pending): V::ConfirmedDeletion =
  val ask = pending.ask
  match ask {
    | DeleteAsk(x) => { id: x.review.id, scope: x.review.scope,
        review: { id: x.review.id, scope: x.review.scope, committedRevision: x.review.committedRevision,
          calendarGeneration: x.review.calendarGeneration } }
    | _ => noDeletionRequest
  }
pure def lawConfirmationIsTheReview(pending: P::Pending): bool =
  val ask = pending.ask
  match ask {
    | AddAsk(x) => confirmationOf(pending).entry == x.review.entry and confirmationOf(pending).review.entry == x.review.entry and
        confirmationOf(pending).review.calendarGeneration == x.review.calendarGeneration and
        confirmationOf(pending).review.displayTimezone == x.review.displayTimezone
    | ChangeAsk(x) => changeOf(pending).id == x.review.id and changeOf(pending).details == x.review.details and
        changeOf(pending).review.id == x.review.id and changeOf(pending).review.details == x.review.details and
        changeOf(pending).review.committedRevision == x.review.committedRevision and
        changeOf(pending).review.calendarGeneration == x.review.calendarGeneration
    | DeleteAsk(x) => deletionOf(pending).id == x.review.id and deletionOf(pending).scope == x.review.scope and
        deletionOf(pending).review.id == x.review.id and deletionOf(pending).review.scope == x.review.scope and
        deletionOf(pending).review.committedRevision == x.review.committedRevision and
        deletionOf(pending).review.calendarGeneration == x.review.calendarGeneration
    | _ => true
  }
pure def lawYesAppliesOnlyWhatWasAsked(pending: P::Pending, view: V::CalendarView): bool =
  val ask = pending.ask
  val adds = V::canConfirmAppointment(view, confirmationOf(pending), V::ViewConsent)
  val changes = V::canConfirmChange(view, changeOf(pending), V::ViewConsent)
  val deletes = V::canConfirmDeletion(view, deletionOf(pending), V::ViewConsent)
  match ask {
    | AddAsk(x) => not(changes) and not(deletes)
    | ChangeAsk(x) => not(adds) and not(deletes)
    | DeleteAsk(x) => not(adds) and not(changes)
    | NoAsk => not(adds) and not(changes) and not(deletes)
  }
```

### Samples are real calendars, mailboxes and questions

The tablet’s calendar with lunch saved and its reminder due; Gmail’s calendar
bound by its store, holding a published garden club, then the clinic
appointment from the email agreed, stored, changed and deleted, and the
garden club open on screen; the tablet’s calendar moved to a week that holds
them all while Gmail’s calendar was moved elsewhere; the clinic email open,
the same email flagged as a scam, and the clinic email left open behind an
Outlook email being written; Grace’s questions asked, agreed and of each
kind; news of each kind; and days chosen for Week or Month, verified or not.

```quint
pure val zone: str = "America/New_York"
pure val lunchIdentity: C::EntryIdentity = {
  owner: "margaret", calendarId: "tablet", occurrenceId: "lunch", sourceRef: "", sourceAccount: 0,
  kind: C::Appointment, billRef: "", billOrigin: "", billAccount: "" }
pure val lunchDetails: C::EntryDetails = { ...C::timedDetails, title: "Lunch with Susan", startAt: 3, endAt: 4, timezone: zone }
pure val gardenIdentity: C::EntryIdentity = { ...lunchIdentity, calendarId: "gmail", occurrenceId: "garden" }
pure val gardenDetails: C::EntryDetails = { ...lunchDetails, title: "Garden club", startAt: 5, endAt: 6 }
pure val movedGarden: C::EntryDetails = { ...gardenDetails, startAt: 6, endAt: 7 }
pure val clinicIdentity: C::EntryIdentity = { ...gardenIdentity, occurrenceId: "clinicVisit", sourceRef: "clinic", sourceAccount: 1 }
pure val clinicDetails: C::EntryDetails =
  { ...lunchDetails, title: "Doctor appointment", location: "Main St clinic", participant: "Dr. Patel", startAt: 4, endAt: 5 }
pure val tabletOpen: V::CalendarView = V::openCalendar(V::initial, "margaret", "tablet", zone, V::ViewUser)
pure val tabletDrafted: V::CalendarView =
  V::createOccurrence(tabletOpen, { identity: lunchIdentity, details: lunchDetails }, V::ViewUser)
pure val tabletApproved: V::CalendarView = V::changeOccurrence(tabletDrafted, "lunch", V::ApproveEntry({ revision: 1 }), V::ViewUser)
pure val tabletSaved: V::CalendarView =
  V::changeOccurrence(tabletApproved, "lunch", V::EntryStored({ revision: 1, succeeded: true }), V::ViewStore)
pure val tabletReminder: V::CalendarView = V::changeOccurrence(
  V::changeOccurrence(tabletSaved, "lunch", V::AdvanceClock({ now: 3 }), V::ViewClock), "lunch", V::ShowDueReminder, V::ViewClock)
pure val gmailBound: V::CalendarView = V::bindCalendar(V::initial, "margaret", "gmail", zone, V::ViewStore)
pure val gardenSaved: C::Calendar = C::save(C::approveSave(
  C::create(C::initial, gardenIdentity, gardenDetails, C::CalendarUser), 1, C::CalendarUser), 1, true, C::CalendarStore)
pure val gmailPublished: V::CalendarView = V::publishOccurrence(gmailBound, gardenSaved, 0, true, V::ViewStore)
pure val clinicReview: V::AppointmentReview =
  { entry: { identity: clinicIdentity, details: clinicDetails }, calendarGeneration: 0, displayTimezone: zone }
pure val tabletClinicReview: V::AppointmentReview =
  { entry: { identity: { ...clinicIdentity, calendarId: "tablet" }, details: clinicDetails }, calendarGeneration: 0, displayTimezone: zone }
pure val gmailConfirmed: V::CalendarView =
  V::confirmAppointment(gmailPublished, { entry: clinicReview.entry, review: clinicReview }, V::ViewConsent)
pure val gmailStored: V::CalendarView =
  V::changeOccurrence(gmailConfirmed, "clinicVisit", V::EntryStored({ revision: 1, succeeded: true }), V::ViewStore)
pure val gardenChange: V::ConfirmedChange =
  { id: "garden", details: movedGarden, review: { id: "garden", details: movedGarden, committedRevision: 1, calendarGeneration: 1 } }
pure val gmailChanging: V::CalendarView = V::confirmChange(gmailStored, gardenChange, V::ViewConsent)
pure val gmailChanged: V::CalendarView =
  V::changeOccurrence(gmailChanging, "garden", V::EntryStored({ revision: 3, succeeded: true }), V::ViewStore)
pure val gardenDeletion: V::ConfirmedDeletion =
  { id: "garden", scope: V::ThisOccurrence, review: { id: "garden", scope: V::ThisOccurrence, committedRevision: 1, calendarGeneration: 1 } }
pure val gmailDeleting: V::CalendarView = V::confirmDeletion(gmailStored, gardenDeletion, V::ViewConsent)
pure val gmailDeleted: V::CalendarView = V::deletionResult(gmailDeleting, 2, true, "storeReceipt", V::ViewStore)
pure val gmailOpened: V::CalendarView =
  V::openOccurrence(V::openCalendar(gmailStored, "margaret", "gmail", zone, V::ViewUser), "garden", V::ViewUser)
pure val gmailEditing: V::CalendarView = V::changeOccurrence(gmailOpened, "garden", V::BeginEditing, V::ViewUser)
pure val gardenFedMoved: C::Calendar = { ...gardenSaved, committed: movedGarden, draft: movedGarden, revision: gardenSaved.revision + 1 }
pure val gardenFedRemoved: C::Calendar = { ...gardenSaved, phase: C::Deleted, reminder: C::ReminderOff, revision: gardenSaved.revision + 1 }
pure val tabletWeek: V::CalendarView = V::navigate(tabletSaved,
  { window: { ...V::emptyWindow, anchorDay: 7, selectedDay: 7, fromTime: 0, untilTime: 10 }, kind: V::Later, verified: true }, V::ViewUser)
pure val gmailElsewhere: V::CalendarView = V::navigate(V::openCalendar(gmailStored, "margaret", "gmail", zone, V::ViewUser),
  { window: { ...V::emptyWindow, anchorDay: 14, selectedDay: 14, fromTime: 20, untilTime: 30 }, kind: V::Later, verified: true }, V::ViewUser)
pure val outlookComposing: E::Mailbox = E::startDraft(M::outlookListed, false, E::MailUser)
pure val gmailFlagged: E::Mailbox =
  E::readResult(E::readMail(M::gmailListed, E::OpenMessage, "clinic", true, E::MailUser),
    { generation: 3, succeeded: true, assets: List(), suspicion: "phishing" }, E::MailConnector)
pure val gmailCalendarOff: A::Accounts =
  A::setUse(M::oneAccount, 1, { mail: true, calendar: false, contacts: true }, A::AccountPerson)
pure val spoken: R::Request = { generation: 1, workVersion: 1, origin: R::Spoken }
pure val pendingClinic: P::Pending =
  P::propose(P::initial, P::AddAsk({ target: 1, review: clinicReview }), spoken, { generation: 1, workVersion: 1 }, P::Grace)
pure val pendingAgreed: P::Pending =
  P::agree(pendingClinic, R::consent({ generation: 2, workVersion: 1, origin: R::Tapped }, 1, P::proposalOf(pendingClinic)),
    { generation: 2, workVersion: 1 }, P::Person)
pure val pendingChange: P::Pending =
  P::propose(P::initial, P::ChangeAsk({ target: 1, review: gardenChange.review }), spoken, { generation: 1, workVersion: 1 }, P::Grace)
pure val pendingDeletion: P::Pending =
  P::propose(P::initial, P::DeleteAsk({ target: 1, review: gardenDeletion.review }), spoken, { generation: 1, workVersion: 1 }, P::Grace)
pure val registryValues = M::registryValues.union(Set(gmailCalendarOff, A::dismissBanner(A::initial, A::AccountPerson)))
pure val viewValues = Set(V::initial, tabletSaved, tabletReminder, gmailPublished, gmailConfirmed, gmailStored,
  gmailChanging, gmailChanged, gmailDeleting, gmailDeleted, gmailOpened, gmailEditing)
pure val idValues = Set("garden", "lunch", "clinicVisit")
pure val publishedValues = Set(gardenSaved, gardenFedMoved, gardenFedRemoved)
pure val beforeValues = Set(tabletApproved, gmailConfirmed, gmailChanging, gmailDeleting, gmailStored)
pure val afterValues = Set(tabletSaved, gmailStored, gmailChanged, gmailDeleted, gmailConfirmed)
pure val calendarsValues = Set(List(),
  List({ key: 0, view: tabletSaved }),
  List({ key: 0, view: tabletSaved }, { key: 1, view: gmailPublished }),
  List({ key: 0, view: tabletReminder }, { key: 1, view: gmailStored }),
  List({ key: 0, view: tabletSaved }, { key: 1, view: gmailConfirmed }),
  List({ key: 1, view: gmailOpened }, { key: 0, view: tabletSaved }),
  List({ key: 0, view: tabletDrafted }, { key: 1, view: gmailDeleted }, { key: 2, view: gmailChanged }),
  List({ key: 0, view: tabletWeek }, { key: 1, view: gmailPublished }),
  List({ key: 0, view: tabletWeek }, { key: 1, view: gmailElsewhere }),
  List({ key: 0, view: tabletWeek }, { key: 1, view: gmailStored }),
  List({ key: 0, view: tabletWeek }, { key: 1, view: gmailEditing }))
pure val sourcesValues = Set(List(), List({ account: 1, mailbox: M::gmailOpen }), List({ account: 1, mailbox: gmailFlagged }),
  List({ account: 1, mailbox: M::gmailListed }), List({ account: 1, mailbox: M::gmailExpired }),
  List({ account: 2, mailbox: M::outlookListed }, { account: 1, mailbox: M::gmailOpen }),
  List({ account: 2, mailbox: outlookComposing }, { account: 1, mailbox: M::gmailOpen }),
  List({ account: 1, mailbox: M::gmailExpired }, { account: 2, mailbox: M::outlookListed }))
pure val reviewValues = Set(clinicReview, tabletClinicReview,
  { ...clinicReview, entry: { ...clinicReview.entry, details: { ...clinicDetails, important: true } } },
  { ...clinicReview, calendarGeneration: 1 },
  { ...clinicReview, entry: { ...clinicReview.entry, identity: { ...clinicIdentity, sourceRef: "susan" } } })
pure val pendingValues = Set(P::initial, pendingClinic, pendingAgreed, pendingChange, pendingDeletion,
  P::propose(P::initial, P::AddAsk({ target: 0, review: tabletClinicReview }), spoken, { generation: 1, workVersion: 1 }, P::Grace))
pure val earlierValues = Set(P::initial, pendingClinic, pendingAgreed)
pure val newsValues = Set({ news: NoCalendarNews, key: 0, id: "" }, { news: AddedAppointment, key: 1, id: "clinicVisit" },
  { news: AddedAppointment, key: 0, id: "lunch" }, { news: ChangedAppointment, key: 1, id: "garden" },
  { news: DeletedAppointment, key: 1, id: "garden" }, { news: AddedAppointment, key: 2, id: "clinicVisit" })
pure val reportValues = Set(
  { window: { ...V::emptyWindow, anchorDay: 4, selectedDay: 4, fromTime: 0, untilTime: 10 }, kind: V::SelectDay, verified: true },
  { window: { ...V::emptyWindow, anchorDay: 5, selectedDay: 5, fromTime: 5, untilTime: 12 }, kind: V::SelectDay, verified: true },
  { window: { ...V::emptyWindow, anchorDay: 4, selectedDay: 4, fromTime: 0, untilTime: 10 }, kind: V::SelectDay, verified: false },
  { window: { ...V::emptyWindow, mode: V::MonthView, anchorDay: 4, selectedDay: 4, fromTime: 0, untilTime: 10 }, kind: V::SelectDay, verified: true },
  { window: { ...V::emptyWindow, anchorDay: 7, selectedDay: 7, fromTime: 0, untilTime: 10 }, kind: V::Later, verified: true })
pure val dayValues = Set(stayOnDay, { show: true, startAt: 4 }, { show: true, startAt: 3 })
pure val startValues = Set({ startAt: 4, day: 4, fromTime: 2, untilTime: 6, verified: true },
  { startAt: 4, day: 4, fromTime: 2, untilTime: 6, verified: false },
  { startAt: 3, day: 5, fromTime: 2, untilTime: 4, verified: true })
pure val keyValues = Set(-1, 0, 1, 2, 3)
pure val accountValues = Set(0, 1, 2, 3)
pure val fromTimeValues = Set(0, 3, 4, 6)
pure val untilTimeValues = Set(0, 4, 5, 10)
pure val dayStartValues = Set(0, 3)
pure val dayEndValues = Set(4, 6)
```

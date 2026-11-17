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
account whose calendar it is. A row carries its calendar’s key and the
appointment as shown; the shell sorts rows by start time and composes every
sentence the person or Grace reads, including an account’s name in a tag and
the note "From the clinic’s email · Visit form attached", because the model
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
calendar. Each shown calendar gives its saved appointments that fall in the
days chosen, with the saved details of one being edited; a deleted
appointment never shows. A row is in the days chosen exactly when it starts
before their end and ends after their start.

```quint
pure def lead(calendars: List[CalendarSource]): CalendarSource = sourceAt(calendars, tabletKey)
pure def overlaps(details: C::EntryDetails, fromTime: int, untilTime: int): bool =
  fromTime < untilTime and details.startAt < untilTime and details.endAt > fromTime
pure def sourceRows(registry: A::Accounts, s: CalendarSource, fromTime: int, untilTime: int): List[CalRow] =
  if (showsCalendar(registry, s.key))
    C::visibleEntries(s.view.entries, s.view.owner, s.view.calendarId, fromTime, untilTime).listMap(c => savedRow(s.key, c))
  else List()
pure def calendarContext(registry: A::Accounts, calendars: List[CalendarSource], fromTime: int, untilTime: int): List[CalRow] =
  calendars.foldl(List(), (rows, s) => rows.concat(sourceRows(registry, s, fromTime, untilTime)))
pure def lawRowsStayInTheChosenDays(registry: A::Accounts, calendars: List[CalendarSource], pending: P::Pending, fromTime: int, untilTime: int): bool =
  dayRows(registry, calendars, pending, fromTime, untilTime).every(r => overlaps(r.details, fromTime, untilTime))
pure def lawSavedRowsAreSavedAppointments(registry: A::Accounts, calendars: List[CalendarSource], fromTime: int, untilTime: int): bool =
  calendarContext(registry, calendars, fromTime, untilTime).every(r => not(r.draft) and
    calendars.some(s => s.key == r.key and
      s.view.entries.some(c => c.identity == r.identity and c.hasSaved and c.phase != C::Deleted)))
```

### Tags show only when an email’s calendar is on

While at least one email brings its calendar, every row carries a tag: "On
this tablet" for the tablet’s, the account’s name for an email’s. While none
does, every appointment is the tablet’s and rows carry no tag. A tag is the
calendar’s key, or -1 for none.

```quint
pure def tagsShown(registry: A::Accounts): bool = registry.accounts.some(x => x.use.calendar)
pure def rowTag(registry: A::Accounts, key: int): int = if (tagsShown(registry)) key else -1
pure def lawTagsNeedACalendarAccount(registry: A::Accounts, key: int): bool =
  (rowTag(registry, key) != -1 implies (tagsShown(registry) and rowTag(registry, key) == key)) and
  (not(tagsShown(registry)) implies rowTag(registry, key) == -1)
```

### The connect banner shows until an email’s calendar is on or she says Not now

Calendar offers "Connect your email to see its calendar here" while no
account brings its calendar, until she taps Not now. The banner and the tags
never show together.

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

### A switched-off account’s appointments and reminders show nowhere, to her or to Grace

A calendar that does not show has no row in the chosen days, on Home, on
the sleep screen or in what Grace is shown, no due reminder and nothing open
on screen. Grace is shown the saved appointments of the shown calendars only.
The appointment open on screen belongs to the first shown calendar that is
open with one selected; with none, it belongs to no calendar (-1).

```quint
pure def sourceReminders(registry: A::Accounts, s: CalendarSource): List[CalRow] =
  if (showsCalendar(registry, s.key)) V::shownReminders(s.view).select(c => c.phase != C::Deleted).listMap(c => savedRow(s.key, c))
  else List()
pure def shownReminders(registry: A::Accounts, calendars: List[CalendarSource]): List[CalRow] =
  calendars.foldl(List(), (rows, s) => rows.concat(sourceReminders(registry, s)))
pure def openSelected(registry: A::Accounts, calendars: List[CalendarSource]): int =
  calendars.select(s => showsCalendar(registry, s.key) and s.view.opened and s.view.selectedId != "").nthOr(0, noCalendar).key
pure def lawHiddenCalendarShowsNothing(registry: A::Accounts, calendars: List[CalendarSource], pending: P::Pending, fromTime: int, untilTime: int, key: int): bool =
  (key != noCalendar.key and not(showsCalendar(registry, key))) implies
    (dayRows(registry, calendars, pending, fromTime, untilTime).every(r => r.key != key) and
      upcoming(registry, calendars, fromTime, untilTime).every(r => r.key != key) and
      calendarContext(registry, calendars, fromTime, untilTime).every(r => r.key != key) and
      shownReminders(registry, calendars).every(r => r.key != key) and
      openSelected(registry, calendars) != key)
```

### Grace is told what changed in a calendar, and being told authorizes nothing

What Grace is told of a calendar is derived from it before and after one
event: that an appointment was added, changed or deleted, once the calendar’s
store saved it, whether Margaret did it or it followed her yes to Grace.
Nothing changed tells nothing. Being told is a turn of the host, never hers,
so it asks Grace to do nothing.

```quint
type CalendarNews = NoCalendarNews | AddedAppointment | ChangedAppointment | DeletedAppointment
type CalendarTold = { news: CalendarNews, key: int, id: str }
pure def settledFrom(before: V::CalendarView, c: C::Calendar, phase: C::CalendarPhase, wasSaved: bool): bool =
  not(before.entries.includes(c)) and
    before.entries.some(b => C::sameOccurrence(b, c) and b.phase == phase and b.hasSaved == wasSaved)
pure def told(key: int, before: V::CalendarView, after: V::CalendarView): CalendarTold =
  val quiet = { news: NoCalendarNews, key: key, id: "" }
  val added = after.entries.select(c => c.phase == C::Saved and settledFrom(before, c, C::Editing, false))
  val changed = after.entries.select(c => c.phase == C::Saved and settledFrom(before, c, C::Editing, true))
  val deleted = after.entries.select(c => c.phase == C::Deleted and not(before.entries.includes(c)) and
    before.entries.some(b => C::sameOccurrence(b, c) and b.phase != C::Deleted))
  if (added.length() > 0) { ...quiet, news: AddedAppointment, id: added.nthOr(0, C::initial).identity.occurrenceId }
  else if (changed.length() > 0) { ...quiet, news: ChangedAppointment, id: changed.nthOr(0, C::initial).identity.occurrenceId }
  else if (deleted.length() > 0) { ...quiet, news: DeletedAppointment, id: deleted.nthOr(0, C::initial).identity.occurrenceId }
  else quiet
pure def lawCalendarToldIsDerived(key: int, view: V::CalendarView): bool =
  told(key, view, view).news == NoCalendarNews
pure def lawToldNamesWhatChanged(key: int, before: V::CalendarView, after: V::CalendarView): bool =
  val news = told(key, before, after)
  (news.news == AddedAppointment or news.news == ChangedAppointment) implies
    after.entries.some(c => c.identity.occurrenceId == news.id and c.phase == C::Saved and not(before.entries.includes(c)))
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
open on screen in a shown account and carries no scam warning. The
appointment names that email as its source, goes to the calendar chosen
above, as that calendar is now, and is exactly one its calendar would take on
her yes: a new appointment, never marked important. Grace does not ask while
any calendar already holds an appointment from that email, while she is
already asking about it, or while Margaret’s yes to an earlier question is
being applied. The email is compared by the provider’s own reference for it.

```quint
pure def alreadyFrom(calendars: List[CalendarSource], ref: str): bool =
  ref != "" and calendars.some(s => s.view.entries.some(c => c.identity.sourceRef == ref and c.phase != C::Deleted))
pure def pendingFrom(pending: P::Pending, ref: str): bool =
  val ask = pending.ask
  match ask {
    | AddAsk(x) => ref != "" and x.review.entry.identity.sourceRef == ref
    | _ => false
  }
pure def fromMessageAllowed(registry: A::Accounts, calendars: List[CalendarSource], mail: M::MailSource,
    pending: P::Pending, review: V::AppointmentReview): bool =
  val box = mail.mailbox
  val target = sourceAt(calendars, targetCalendar(registry, mail.account))
  M::showsMail(registry, mail.account) and box.view == E::Message and E::selectedMessageIsCurrent(box) and
  box.warning.evidence == "" and pending.agreed == 0 and
  review.entry.identity.kind == C::Appointment and not(review.entry.details.important) and
  review.entry.identity.sourceRef == box.messageRef and target.key >= 0 and target.view.owner != "" and
  review.entry.identity.owner == target.view.owner and review.entry.identity.calendarId == target.view.calendarId and
  V::canConfirmAppointment(target.view, { entry: review.entry, review: review }, V::ViewConsent) and
  not(alreadyFrom(calendars, box.messageRef)) and not(pendingFrom(pending, box.messageRef))
pure def lawEmailAppointmentNamesItsSource(registry: A::Accounts, calendars: List[CalendarSource], mail: M::MailSource,
    pending: P::Pending, review: V::AppointmentReview): bool =
  fromMessageAllowed(registry, calendars, mail, pending, review) implies
    (review.entry.identity.sourceRef == mail.mailbox.messageRef and mail.mailbox.messageRef != "")
pure def lawEmailAppointmentGoesToItsAccountsCalendar(registry: A::Accounts, calendars: List[CalendarSource], mail: M::MailSource,
    pending: P::Pending, review: V::AppointmentReview): bool =
  val target = sourceAt(calendars, targetCalendar(registry, mail.account))
  fromMessageAllowed(registry, calendars, mail, pending, review) implies
    (review.entry.identity.calendarId == target.view.calendarId and review.entry.identity.owner == target.view.owner and
      review.calendarGeneration == target.view.generation and showsCalendar(registry, target.key))
pure def lawSameEmailIsNotAskedTwice(registry: A::Accounts, calendars: List[CalendarSource], mail: M::MailSource,
    pending: P::Pending, review: V::AppointmentReview): bool =
  (alreadyFrom(calendars, mail.mailbox.messageRef) or pendingFrom(pending, mail.mailbox.messageRef) or pending.agreed != 0) implies
    not(fromMessageAllowed(registry, calendars, mail, pending, review))
pure def lawScamEmailMakesNoAppointment(registry: A::Accounts, calendars: List[CalendarSource], mail: M::MailSource,
    pending: P::Pending, review: V::AppointmentReview): bool =
  (mail.mailbox.warning.evidence != "" or not(M::showsMail(registry, mail.account))) implies
    not(fromMessageAllowed(registry, calendars, mail, pending, review))
pure def lawEmailAppointmentIsNeverImportant(registry: A::Accounts, calendars: List[CalendarSource], mail: M::MailSource,
    pending: P::Pending, review: V::AppointmentReview): bool =
  review.entry.details.important implies not(fromMessageAllowed(registry, calendars, mail, pending, review))
pure def lawEmailAppointmentIsOneTheCalendarTakes(registry: A::Accounts, calendars: List[CalendarSource], mail: M::MailSource,
    pending: P::Pending, review: V::AppointmentReview): bool =
  val target = sourceAt(calendars, targetCalendar(registry, mail.account))
  val asked = { ...pending, ask: P::AddAsk({ target: target.key, review: review }) }
  fromMessageAllowed(registry, calendars, mail, pending, review) implies
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
pure def dayRows(registry: A::Accounts, calendars: List[CalendarSource], pending: P::Pending, fromTime: int, untilTime: int): List[CalRow] =
  val saved = calendarContext(registry, calendars, fromTime, untilTime)
  saved.concat(askedRows(registry, pending, fromTime, untilTime, saved))
pure def lawDraftRowIsTheQuestion(registry: A::Accounts, calendars: List[CalendarSource], pending: P::Pending, fromTime: int, untilTime: int): bool =
  val ask = pending.ask
  dayRows(registry, calendars, pending, fromTime, untilTime).every(r => r.draft implies
    (match ask {
      | AddAsk(x) => r.key == x.target and r.identity == x.review.entry.identity and r.details == x.review.entry.details
      | _ => false
    }))
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
appointment from the email agreed, stored, changed and deleted; the clinic
email open and the same email flagged as a scam; and Grace’s questions asked,
agreed and of each kind.

```quint
pure val zone: str = "America/New_York"
pure val lunchIdentity: C::EntryIdentity = {
  owner: "margaret", calendarId: "tablet", occurrenceId: "lunch", sourceRef: "",
  kind: C::Appointment, billRef: "", billOrigin: "", billAccount: "" }
pure val lunchDetails: C::EntryDetails = { ...C::timedDetails, title: "Lunch with Susan", startAt: 3, endAt: 4, timezone: zone }
pure val gardenIdentity: C::EntryIdentity = { ...lunchIdentity, calendarId: "gmail", occurrenceId: "garden" }
pure val gardenDetails: C::EntryDetails = { ...lunchDetails, title: "Garden club", startAt: 5, endAt: 6 }
pure val movedGarden: C::EntryDetails = { ...gardenDetails, startAt: 6, endAt: 7 }
pure val clinicIdentity: C::EntryIdentity = { ...gardenIdentity, occurrenceId: "clinicVisit", sourceRef: "clinic" }
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
  gmailChanging, gmailChanged, gmailDeleting, gmailDeleted)
pure val beforeValues = Set(tabletApproved, gmailConfirmed, gmailChanging, gmailDeleting, gmailStored)
pure val afterValues = Set(tabletSaved, gmailStored, gmailChanged, gmailDeleted, gmailConfirmed)
pure val calendarsValues = Set(List(),
  List({ key: 0, view: tabletSaved }),
  List({ key: 0, view: tabletSaved }, { key: 1, view: gmailPublished }),
  List({ key: 0, view: tabletReminder }, { key: 1, view: gmailStored }),
  List({ key: 0, view: tabletSaved }, { key: 1, view: gmailConfirmed }),
  List({ key: 0, view: tabletDrafted }, { key: 1, view: gmailDeleted }, { key: 2, view: gmailChanged }))
pure val mailValues = Set({ account: 1, mailbox: M::gmailOpen }, { account: 1, mailbox: gmailFlagged },
  { account: 1, mailbox: M::gmailListed }, { account: 2, mailbox: M::outlookListed }, { account: 1, mailbox: M::gmailExpired })
pure val reviewValues = Set(clinicReview, tabletClinicReview,
  { ...clinicReview, entry: { ...clinicReview.entry, details: { ...clinicDetails, important: true } } },
  { ...clinicReview, calendarGeneration: 1 },
  { ...clinicReview, entry: { ...clinicReview.entry, identity: { ...clinicIdentity, sourceRef: "susan" } } })
pure val pendingValues = Set(P::initial, pendingClinic, pendingAgreed, pendingChange, pendingDeletion,
  P::propose(P::initial, P::AddAsk({ target: 0, review: tabletClinicReview }), spoken, { generation: 1, workVersion: 1 }, P::Grace))
pure val keyValues = Set(-1, 0, 1, 2, 3)
pure val accountValues = Set(0, 1, 2, 3)
pure val fromTimeValues = Set(0, 3, 4, 6)
pure val untilTimeValues = Set(0, 4, 5, 10)
```

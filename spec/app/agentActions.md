# What Grace may do with email and the calendar

Grace answers a turn with words and, sometimes, actions: open, find or tidy
an email, write one for Margaret to check, change folder or inbox, ask to
add, change or remove an appointment, take Margaret's yes or No to that
question, open a setting, or point at something on the screen. This library
is the one place where such an action becomes an event, and it decides that
from what the tablet holds now: the [email accounts](./accounts.md), one
[mailbox](./email.md) per account, the [calendars](./calendars.md), the
[question Grace is waiting on](./proposal.md) and the targets on the
screen. It holds no state. Every route it gives is an event the owner's own
guard checks again when the shell sends it, so a race shows as a refusal
that Grace is told, never as an action nobody allowed.

What the vocabulary leaves out is the point. No route sends an email,
approves one, deletes one for good, follows a link or writes a calendar:
sending, Delete forever and links stay Margaret's taps, and a calendar
changes only when the host applies a question she said yes to, with
`ViewConsent`, after the [proposal](./proposal.md) is agreed. The shell turns
Grace's reply into an `AgentAction`, resolving a named contact through the
connector and composing the note of an appointment's source, because the
model has no string building.

## Story: Ask Grace to help with my email

> As Margaret, I want Grace to find, read, open and tidy my email, and write
> or answer an email for me to check, while only I ever send it or delete it
> for good.

### Only Margaret's own current turn makes Grace act, on any screen

An action is routed only for a request from Margaret's own turn, typed, said
or tapped, in the conversation's current generation and for the current
work. A turn the host made, from an email, a page, a file, the device or
Grace's own words, is refused whatever it asks, and so is a turn a newer one
has replaced. Grace may act from any screen.

```quint
import request as R from "./request"
import accounts as A from "./accounts"
import email as E from "./email"
import emailItem as I from "./emailItem"
import files as F from "./files"
import mailboxes as M from "./mailboxes"
import calendar as C from "./calendar"
import calendarView as V from "./calendarView"
import proposal as P from "./proposal"
import calendars as K from "./calendars"
import shell as S from "./shell"

type AgentAction =
  Mail({ account: int, assist: E::MailAssist })
  | ChooseFolder({ folder: I::Folder })
  | FilterInbox({ account: int })
  | ProposeAppointment({ key: int, seed: V::EntrySeed })
  | ProposeFromMessage({ account: int, seed: V::EntrySeed })
  | ProposeChange({ key: int, id: str, details: C::EntryDetails })
  | ProposeDeletion({ key: int, id: str, scope: V::DeleteScope })
  | ConfirmProposal
  | CancelProposal
  | ShowSetting({ page: S::SettingsPage })
  | Guide({ target: str })
type Refusal = NotHerTurn | NotShown | OwnerRefused | AlreadyInCalendar | NothingAsked | NotOnScreen
type Route =
  ToMail({ account: int, assist: E::MailAssist })
  | ToFolders({ folder: I::Folder })
  | ToFilter({ account: int })
  | ToProposal({ ask: P::Ask })
  | ToAnswer({ consent: R::Consent })
  | ToWithdraw
  | ToSetting({ page: S::SettingsPage })
  | ToGuide({ target: str })
  | Refused({ why: Refusal })
type World = {
  now: R::Moment, stamp: int, timezone: str, accounts: A::Accounts, mail: List[M::MailSource],
  calendars: List[K::CalendarSource], pending: P::Pending, targets: Set[str]
}

pure def route(w: World, request: R::Request, command: AgentAction): Route =
  if (not(R::mayAct(request, w.now))) Refused({ why: NotHerTurn })
  else match command {
    | Mail(x) => routeMail(w, x.account, x.assist)
    | ChooseFolder(x) => routeFolder(w, x.folder)
    | FilterInbox(x) =>
        if (A::canFilterInbox(w.accounts, x.account, A::AccountPerson)) ToFilter({ account: x.account })
        else Refused({ why: NotShown })
    | ProposeAppointment(x) => routeAppointment(w, request, x.key, x.seed)
    | ProposeFromMessage(x) => routeFromMessage(w, request, x.account, x.seed)
    | ProposeChange(x) => routeChange(w, request, x.key, x.id, x.details)
    | ProposeDeletion(x) => routeDeletion(w, request, x.key, x.id, x.scope)
    | ConfirmProposal =>
        if (P::canAgree(w.pending, answerOf(w, request), w.now, P::Person)) ToAnswer({ consent: answerOf(w, request) })
        else Refused({ why: NothingAsked })
    | CancelProposal =>
        if (P::canWithdraw(w.pending, R::Cancellation, P::Grace)) ToWithdraw else Refused({ why: NothingAsked })
    | ShowSetting(x) => ToSetting({ page: x.page })
    | Guide(x) => if (w.targets.contains(x.target)) ToGuide({ target: x.target }) else Refused({ why: NotOnScreen })
  }

pure def refusedFor(routed: Route, why: Refusal): bool = match routed {
  | Refused(x) => x.why == why
  | _ => false
}
pure def lawOnlyHerCurrentTurnRoutes(w: World, request: R::Request, command: AgentAction): bool =
  val routed = route(w, request, command)
  (refusedFor(routed, NotHerTurn) iff not(R::mayAct(request, w.now))) and
  (not(R::fromPerson(request.origin)) implies refusedFor(routed, NotHerTurn))
```

### Grace's email actions go to that account's mailbox and pass its own guard

An email action names the account whose mailbox it acts on. It is routed
only while that account is on the tablet with its Email on, and only when
that mailbox's own guard for Grace (`E::canAssistMail`) allows it now, which
runs the guard of the same tap Margaret would make. A refused action is told
to Grace with its reason. Whatever she does there approves no email, starts
no send that was not already under way, queues or takes nothing from Outbox,
deletes none for good and opens no link.

```quint
pure def routeMail(w: World, account: int, assist: E::MailAssist): Route =
  if (not(M::showsMail(w.accounts, account))) Refused({ why: NotShown })
  else if (E::canAssistMail(M::sourceOf(w.mail, account).mailbox, assist, true, E::MailAssistant))
    ToMail({ account: account, assist: assist })
  else Refused({ why: OwnerRefused })

pure def lawRoutedMailIsAllowedByItsMailbox(w: World, request: R::Request, command: AgentAction): bool =
  val routed = route(w, request, command)
  match routed {
    | ToMail(r) => M::showsMail(w.accounts, r.account) and
        E::canAssistMail(M::sourceOf(w.mail, r.account).mailbox, r.assist, true, E::MailAssistant)
    | _ => true
  }
pure def keepsSendingHers(source: M::MailSource, assist: E::MailAssist): bool =
  val before = source.mailbox
  val after = E::assistMail(before, assist, true, E::MailAssistant)
  (after.approvedRevision == -1 or after.approvedRevision == before.approvedRevision) and
  (after.sendStatus == E::Sending implies before.sendStatus == E::Sending) and
  after.outbox.listMap(q => q.operationId) == before.outbox.listMap(q => q.operationId) and
  after.outbox.listMap(q => q.status) == before.outbox.listMap(q => q.status) and
  after.issuedSends.subseteq(before.issuedSends) and before.issuedSends.subseteq(after.issuedSends) and
  (after.link == before.link or after.link == E::noLink) and
  after.messages.every(r => r.pending != I::PurgeMessage or
    before.messages.some(o => o.identity == r.identity and o.pending == I::PurgeMessage))
pure def lawRoutedMailNeverSendsOrDeletes(w: World, request: R::Request, command: AgentAction): bool =
  val routed = route(w, request, command)
  match routed {
    | ToMail(r) => keepsSendingHers(M::sourceOf(w.mail, r.account), r.assist)
    | _ => true
  }
```

### Grace changes the folder or the inbox only to one Margaret can see

Choosing Inbox, Sent, Drafts or Trash, or one account's inbox, is the same
navigation as Margaret's tap, and Grace may do it only from her turn. A
folder is chosen only while some email shows on the tablet, never the
folder of mail deleted for good, and an inbox only of an account whose Email
is on, or All inboxes.

```quint
pure def routeFolder(w: World, folder: I::Folder): Route =
  if (folder == I::PurgedFolder or A::mailAccounts(w.accounts).length() == 0) Refused({ why: NotShown })
  else ToFolders({ folder: folder })

pure def lawGraceNavigatesOnlyToWhatShows(w: World, request: R::Request, command: AgentAction): bool =
  val routed = route(w, request, command)
  match routed {
    | ToFolders(x) => x.folder != I::PurgedFolder and A::mailAccounts(w.accounts).length() > 0
    | ToFilter(x) => A::canFilterInbox(w.accounts, x.account, A::AccountPerson)
    | _ => true
  }
```

### Grace opens a setting, and points only at what is on the screen

Grace may open any Settings page, Email & calendar included, as Margaret's
tap on it would. She may point at a target the screen offers now, and at
nothing else: an unknown or stale target is refused, so she never guides
Margaret to something that is not there. A provider's own sign-in page
offers no targets.

```quint
pure def lawGuideStaysOnScreen(w: World, request: R::Request, command: AgentAction): bool =
  val routed = route(w, request, command)
  match routed {
    | ToGuide(g) => w.targets.contains(g.target)
    | _ => true
  }
```

## Story: Ask Grace about my calendar

> As Margaret, I want Grace to tell me what is on, and to suggest adding,
> changing or removing an appointment that happens only when I say yes.

### Grace only asks about a calendar that shows, with a question that calendar would take

Grace never adds, changes or removes an appointment herself: what she routes
is a question for [the proposal](./proposal.md), and her own turn may ask it
only while no yes is being applied. The question names a calendar that
shows, by its key, and is reviewed against that calendar as it is now: its
generation, its display timezone (or the tablet's while it has none yet),
and for a change or a removal the saved revision of that appointment. It is
routed only when that calendar would take it on her yes with `ViewConsent`
as it stands, so a yes to it is never a yes to something it would refuse. A
new appointment Grace suggests on her own names no email as its source.

```quint
pure def viewAt(w: World, key: int): V::CalendarView = K::sourceAt(w.calendars, key).view
pure def calendarShows(w: World, key: int): bool =
  K::showsCalendar(w.accounts, key) and K::sourceAt(w.calendars, key).key >= 0
pure def appointmentReview(w: World, key: int, seed: V::EntrySeed): V::AppointmentReview =
  val view = viewAt(w, key)
  { entry: seed, calendarGeneration: view.generation,
    displayTimezone: if (view.timezone != "") view.timezone else w.timezone }
pure def changeReview(w: World, key: int, id: str, details: C::EntryDetails): V::ChangeReview =
  val view = viewAt(w, key)
  { id: id, details: details, committedRevision: V::entryAt(view, id).revision, calendarGeneration: view.generation }
pure def deletionReview(w: World, key: int, id: str, scope: V::DeleteScope): V::DeletionReview =
  val view = viewAt(w, key)
  { id: id, scope: scope, committedRevision: V::entryAt(view, id).revision, calendarGeneration: view.generation }
pure def routeAsk(w: World, request: R::Request, ask: P::Ask, taken: bool): Route =
  if (taken and P::canPropose(w.pending, ask, request, w.now, P::Grace)) ToProposal({ ask: ask })
  else Refused({ why: OwnerRefused })
pure def routeAppointment(w: World, request: R::Request, key: int, seed: V::EntrySeed): Route =
  val review = appointmentReview(w, key, seed)
  if (not(calendarShows(w, key))) Refused({ why: NotShown })
  else routeAsk(w, request, P::AddAsk({ target: key, review: review }),
    seed.identity.sourceRef == "" and
      V::canConfirmAppointment(viewAt(w, key), { entry: seed, review: review }, V::ViewConsent))
pure def routeChange(w: World, request: R::Request, key: int, id: str, details: C::EntryDetails): Route =
  val review = changeReview(w, key, id, details)
  if (not(calendarShows(w, key))) Refused({ why: NotShown })
  else routeAsk(w, request, P::ChangeAsk({ target: key, review: review }),
    V::canConfirmChange(viewAt(w, key), { id: id, details: details, review: review }, V::ViewConsent))
pure def routeDeletion(w: World, request: R::Request, key: int, id: str, scope: V::DeleteScope): Route =
  val review = deletionReview(w, key, id, scope)
  if (not(calendarShows(w, key))) Refused({ why: NotShown })
  else routeAsk(w, request, P::DeleteAsk({ target: key, review: review }),
    V::canConfirmDeletion(viewAt(w, key), { id: id, scope: scope, review: review }, V::ViewConsent))

pure def lawGraceOnlyAsksAboutAShownCalendar(w: World, request: R::Request, command: AgentAction): bool =
  val routed = route(w, request, command)
  match routed {
    | ToProposal(x) => P::canPropose(w.pending, x.ask, request, w.now, P::Grace) and
        K::showsCalendar(w.accounts, P::targetOf(x.ask)) and w.pending.agreed == 0
    | _ => true
  }
pure def lawAskIsOneTheCalendarTakes(w: World, request: R::Request, command: AgentAction): bool =
  val routed = route(w, request, command)
  val asked = match routed { | ToProposal(x) => true | _ => false }
  asked implies (match command {
    | ProposeAppointment(x) => x.seed.identity.sourceRef == "" and
        V::canConfirmAppointment(viewAt(w, x.key), { entry: x.seed, review: appointmentReview(w, x.key, x.seed) }, V::ViewConsent)
    | ProposeChange(x) =>
        V::canConfirmChange(viewAt(w, x.key), { id: x.id, details: x.details, review: changeReview(w, x.key, x.id, x.details) }, V::ViewConsent)
    | ProposeDeletion(x) =>
        V::canConfirmDeletion(viewAt(w, x.key), { id: x.id, scope: x.scope, review: deletionReview(w, x.key, x.id, x.scope) }, V::ViewConsent)
    | ProposeFromMessage(x) => true
    | _ => false
  })
```

### An appointment from an email is asked only as the calendar rules allow

Asked to put the email being read in the calendar, Grace asks about it only
where [an appointment from an email](./calendars.md) is allowed: the email is
open in a shown account and not flagged, the appointment names it, goes to
that account's calendar or else the tablet's, is not important, and no
calendar holds one from it and no question about it is waiting. When one is
already there or already asked, she is told so.

```quint
pure def routeFromMessage(w: World, request: R::Request, account: int, seed: V::EntrySeed): Route =
  val key = K::targetCalendar(w.accounts, account)
  val review = appointmentReview(w, key, seed)
  val source = M::sourceOf(w.mail, account)
  if (not(M::showsMail(w.accounts, account))) Refused({ why: NotShown })
  else if (K::alreadyFrom(w.calendars, source.account, source.mailbox.messageRef) or K::pendingFrom(w.pending, source.account, source.mailbox.messageRef))
    Refused({ why: AlreadyInCalendar })
  else routeAsk(w, request, P::AddAsk({ target: key, review: review }),
    K::fromMessageAllowed(w.accounts, w.calendars, w.mail, w.pending, review))

pure def lawEmailAppointmentFollowsTheCalendarRules(w: World, request: R::Request, command: AgentAction): bool =
  val routed = route(w, request, command)
  val asked = match routed { | ToProposal(x) => true | _ => false }
  match command {
    | ProposeFromMessage(x) => asked implies
        K::fromMessageAllowed(w.accounts, w.calendars, w.mail, w.pending,
          appointmentReview(w, K::targetCalendar(w.accounts, x.account), x.seed))
    | _ => true
  }
```

### Her yes is taken only for a question waiting on her, and her No drops it

A yes is routed only while Grace is asking and nothing is agreed yet, as the
consent `R::consent` builds from Margaret's own turn, the host's new answer
stamp and the question as it is held now, and only when the proposal would
take it: a turn after the one that asked, in the current generation. Any
other yes is refused as nothing asked. Her No or a cancellation drops a
question she has not agreed to.

```quint
pure def answerOf(w: World, request: R::Request): R::Consent = R::consent(request, w.stamp, P::proposalOf(w.pending))

pure def lawConsentNeedsAWaitingQuestion(w: World, request: R::Request, command: AgentAction): bool =
  val routed = route(w, request, command)
  match routed {
    | ToAnswer(x) => P::asking(w.pending) and w.pending.agreed == 0 and R::fromPerson(x.consent.origin) and
        x.consent == answerOf(w, request) and P::canAgree(w.pending, x.consent, w.now, P::Person)
    | ToWithdraw => P::canWithdraw(w.pending, R::Cancellation, P::Grace)
    | _ => true
  }
```

### Samples are the tablet as Margaret reads, asks, agrees and switches a calendar off

Gmail on the tablet with its calendar, the clinic email open, read,
flagged as a scam or being answered; the tablet's calendar with lunch saved
and Gmail's with the garden club; Grace asking about the clinic visit, then
agreed; and Gmail's calendar switched off. Requests come from Margaret's
turns and from the host's.

```quint
pure val zone: str = K::zone
pure val bothCalendars: List[K::CalendarSource] = List({ key: 0, view: K::tabletSaved }, { key: 1, view: K::gmailPublished })
pure val reading: World = {
  now: { generation: 1, workVersion: 1 }, stamp: 1, timezone: zone, accounts: M::oneAccount,
  mail: List({ account: 1, mailbox: M::gmailOpen }), calendars: bothCalendars, pending: P::initial,
  targets: Set("mbody", "link")
}
pure val asking: World = { ...reading, now: { generation: 2, workVersion: 1 }, stamp: 2, pending: K::pendingClinic }
pure val agreed: World = { ...asking, stamp: 3, pending: K::pendingAgreed,
  calendars: List({ key: 0, view: K::tabletSaved }, { key: 1, view: K::gmailConfirmed }) }
pure val stored: World = { ...reading, calendars: List({ key: 0, view: K::tabletSaved }, { key: 1, view: K::gmailStored }) }
pure val flagged: World = { ...reading, mail: List({ account: 1, mailbox: K::gmailFlagged }) }
pure val answering: World = { ...reading, mail: List({ account: 1, mailbox: M::gmailComposing }), targets: Set("body", "send") }
pure val calendarOff: World = { ...reading, accounts: K::gmailCalendarOff,
  calendars: List({ key: 0, view: K::tabletSaved }, { key: 1, view: K::gmailPublished }) }
pure val tidying: World = { ...reading, mail: List({ account: 1, mailbox: M::gmailRead }) }
pure val empty: World = { ...reading, accounts: A::initial, mail: List(), calendars: List({ key: 0, view: V::initial }),
  targets: Set() }
pure val wValues = Set(reading, asking, agreed, stored, flagged, answering, calendarOff, tidying, empty)
pure val requestValues = Set(
  { generation: 1, workVersion: 1, origin: R::Spoken }, { generation: 2, workVersion: 1, origin: R::Tapped },
  { generation: 1, workVersion: 1, origin: R::FromEmail }, { generation: 2, workVersion: 1, origin: R::FromGrace },
  { generation: 1, workVersion: 2, origin: R::Typed })
pure val teaSeed: V::EntrySeed = { identity: { ...K::lunchIdentity, occurrenceId: "tea" },
  details: { ...K::lunchDetails, title: "Tea with Susan", startAt: 5, endAt: 6 } }
pure val clinicSeed: V::EntrySeed = K::clinicReview.entry
pure val tabletClinicSeed: V::EntrySeed = K::tabletClinicReview.entry
pure val clinicTarget: E::MessageTarget = { ref: "clinic", revision: 1 }
pure val commandValues = Set(
  Mail({ account: 1, assist: E::AssistOpen({ ref: "clinic" }) }), Mail({ account: 1, assist: E::AssistSearch({ query: "" }) }),
  Mail({ account: 1, assist: E::AssistList }), Mail({ account: 2, assist: E::AssistList }),
  Mail({ account: 1, assist: E::AssistTrash({ target: clinicTarget }) }),
  Mail({ account: 1, assist: E::AssistMarkUnread({ target: clinicTarget }) }),
  Mail({ account: 1, assist: E::AssistFill({ body: "Thank you, I will be there." }) }),
  Mail({ account: 1, assist: E::AssistNewEmail({ recipient: E::resolvedRecipient, subject: "Sunday", body: "See you." }) }),
  Mail({ account: 1, assist: E::AssistSaveDraft({ draftId: "draft1" }) }),
  ChooseFolder({ folder: I::TrashFolder }), ChooseFolder({ folder: I::PurgedFolder }),
  FilterInbox({ account: 0 }), FilterInbox({ account: 1 }), FilterInbox({ account: 3 }),
  ProposeAppointment({ key: 0, seed: teaSeed }), ProposeAppointment({ key: 1, seed: clinicSeed }),
  ProposeAppointment({ key: 2, seed: teaSeed }),
  ProposeFromMessage({ account: 1, seed: clinicSeed }), ProposeFromMessage({ account: 1, seed: tabletClinicSeed }),
  ProposeFromMessage({ account: 1, seed: { ...clinicSeed, details: { ...K::clinicDetails, important: true } } }),
  ProposeFromMessage({ account: 2, seed: clinicSeed }),
  ProposeChange({ key: 1, id: "garden", details: K::movedGarden }), ProposeChange({ key: 0, id: "lunch", details: K::movedGarden }),
  ProposeDeletion({ key: 1, id: "garden", scope: V::ThisOccurrence }), ProposeDeletion({ key: 1, id: "garden", scope: V::EntireSeries }),
  ConfirmProposal, CancelProposal, ShowSetting({ page: S::EmailCalendarSettings }),
  Guide({ target: "mbody" }), Guide({ target: "send" }))
```

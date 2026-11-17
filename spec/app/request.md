# Who asked, and what she agreed to

A leaf library with no state of its own. Every surface where Grace can act,
Email, Calendar, Files, the browser, Settings, memory and a task, takes the
same two records: a `Request`, which says which of the person's turns in the
[conversation](./conversation.md) asked for an action and where that turn came
from, and a `Consent`, which says that the person agreed to one revision of one
owner's offer. Neither record carries what is being done: a mail draft, an
appointment or a payment stays with the spec that owns it. Each owner keeps the
revision rule it already has, and that rule is what makes a changed offer
void a consent: Email's `alwaysApprovalIsCurrent`,
`stepSendingNeedsCurrentApproval` and `stepOnlyThePersonApproves`
([email](./email.md)), Calendar's `alwaysSaveApprovalIsCurrent`
([calendar](./calendar.md)) and its whole-entry comparison in
[calendarView](./calendarView.md), payment's `stepOnlyApprovedSubmission`
([payment](./payment.md)), memory's `stepFillUsesCurrentApproval`
([memory](./memory.md)), and the workspace's `lawCorrectedSpeechCannotApprove`
and `lawLateSpeechCannotApprove` ([workspace](./workspace.md)). No shared
pending-request, saving or outcome record is built here.

## Story: Only her own words ask Grace to act

> As a person who lets Grace read my mail and websites for me, I want only what
> I type, say or tap to ask her to do something, so that words in an email, on
> a page or in a file can tell me things but can never make her act.

### A request records her turn, the work it belongs to and where the turn came from

A turn comes from the person when she typed it, said it or tapped an answer.
Words in a page's own sound are the page's, not hers: the conversation's audio
owner decides which. Every other turn is made by the host: from a page, an
email, a file, a device event, or Grace's own words, such as her opening line
or her report of what she did on another surface. A host turn may still be
read and answered.

`herTurn` counts the person's own submitted turns, typed, spoken or tapped,
and also advances on New conversation and Close Grace. Nothing else advances
it: not Grace's reply, Talk, Repeat, a host turn, a visit to another surface
or a rail popover, even though each of those advances the conversation's
`generation`, which fences speech and replies.

```quint
type Origin = Typed | Spoken | Tapped | FromPage | FromEmail | FromFile | FromDevice | FromGrace
type Request = { herTurn: int, workVersion: int, origin: Origin }
type Moment = { herTurn: int, workVersion: int }

pure def fromPerson(origin: Origin): bool = origin == Typed or origin == Spoken or origin == Tapped
```

### Only a current request from the person's own turn may ask for an action on any surface

An action is admitted only for a request from the person's own turn, while
it is still her latest turn and for the current work. A turn the host made
can produce words and guidance, and no action and no consent on any surface.

```quint
pure def mayAct(request: Request, now: Moment): bool =
  fromPerson(request.origin) and request.herTurn == now.herTurn and request.workVersion == now.workVersion
pure def canConsent(request: Request, now: Moment, stamp: int): bool = mayAct(request, now) and stamp > 0

pure def lawHostTurnNeverAuthorizes(request: Request, now: Moment, stamp: int): bool =
  not(fromPerson(request.origin)) implies (not(mayAct(request, now)) and not(canConsent(request, now, stamp)))

pure val requestValues = Set(
  { herTurn: 1, workVersion: 1, origin: Typed }, { herTurn: 1, workVersion: 1, origin: Spoken },
  { herTurn: 1, workVersion: 1, origin: Tapped }, { herTurn: 1, workVersion: 1, origin: FromPage },
  { herTurn: 1, workVersion: 1, origin: FromEmail }, { herTurn: 1, workVersion: 1, origin: FromFile },
  { herTurn: 1, workVersion: 1, origin: FromDevice }, { herTurn: 1, workVersion: 1, origin: FromGrace },
  { herTurn: 0, workVersion: 1, origin: Typed }, { herTurn: 1, workVersion: 2, origin: Spoken })
pure val nowValues = Set({ herTurn: 1, workVersion: 1 }, { herTurn: 2, workVersion: 1 })
pure val stampValues = Set(0, 1, 2)
```

## Story: Each yes counts once, for what she was shown

> As a person who says yes to something Grace proposes, I want that yes to
> count once, for exactly the version I was shown, and to keep counting while
> I look at another app, but not after I say something new.

### An offer is known by its owner, its item and its revision, not by where it is shown

The subject names the owner and the item within it; the revision is the
owner's, and changes whenever what the person would agree to changes. Where
the offer is shown is not part of it, so visiting another surface or opening
a popover from the rail changes neither the offer nor her turn. Correcting
it, New conversation and Close Grace are turns of hers, so they advance her
turn; withdrawing it and proposing something new change the revision the
owner holds.

```quint
type Owner = EmailOwner | CalendarOwner | FilesOwner | BrowserOwner | SettingsOwner | MemoryOwner | TaskOwner
type Subject = { owner: Owner, item: str }
type Offer = { subject: Subject, revision: int }
type Detour = SurfaceVisited | PopoverOpened | Corrected | Withdrawn | Reproposed | ConversationRestarted | GraceClosed

pure def retires(detour: Detour): bool = match detour {
  | SurfaceVisited => false
  | PopoverOpened => false
  | _ => true
}
pure def momentAfter(detour: Detour, now: Moment): Moment = match detour {
  | Corrected => { ...now, herTurn: now.herTurn + 1 }
  | ConversationRestarted => { ...now, herTurn: now.herTurn + 1 }
  | GraceClosed => { ...now, herTurn: now.herTurn + 1 }
  | _ => now
}
```

### A consent names one revision of one offer and the turn that gave it

The stamp numbers her answer: the host gives each answer a new, larger stamp.
The consent keeps her turn that gave it and the subject and revision she was
shown. `consent` only builds the record; an owner takes a yes only where
`agreed` holds, which needs `canConsent` for her turn and `canUse` for the
record built from it, so a host turn never yields a usable consent.

```quint
type Consent = { stamp: int, herTurn: int, subject: Subject, revision: int }

pure def consent(request: Request, stamp: int, offer: Offer): Consent =
  { stamp: stamp, herTurn: request.herTurn, subject: offer.subject, revision: offer.revision }

pure val exampleReply: Subject = { owner: EmailOwner, item: "reply" }
pure val exampleAppointment: Subject = { owner: CalendarOwner, item: "appointment" }
pure val offerValues = Set({ subject: exampleReply, revision: 1 })
```

### A consent is used once, and her newer turn, a changed revision or a retiring detour voids it

The owner holds the offer it is waiting on and the largest stamp it has used.
A consent is usable only while her turn that gave it is still her latest, for
the subject and revision the owner holds, and with a stamp larger than the
largest one the owner has used. Using it records the stamp and never lowers
it, so the same yes cannot act twice, and neither can an older one. Any newer
turn of hers makes it void, and so does any change to the revision the owner
holds. A visit to another surface or a rail popover keeps a usable consent
usable; every other detour voids it.

```quint
type Held = { offer: Offer, spent: int }

pure def canUse(given: Consent, held: Held, now: Moment): bool =
  given.herTurn == now.herTurn and given.subject == held.offer.subject and
  given.revision == held.offer.revision and given.stamp > held.spent
pure def spend(given: Consent, held: Held): Held =
  { ...held, spent: if (given.stamp > held.spent) given.stamp else held.spent }
pure def agreed(request: Request, stamp: int, held: Held, now: Moment): bool =
  canConsent(request, now, stamp) and canUse(consent(request, stamp, held.offer), held, now)
pure def heldAfter(detour: Detour, held: Held): Held = match detour {
  | Withdrawn => { ...held, offer: { ...held.offer, revision: held.offer.revision + 1 } }
  | Reproposed => { ...held, offer: { ...held.offer, revision: held.offer.revision + 1 } }
  | _ => held
}

pure def lawHostTurnYieldsNoConsent(request: Request, stamp: int, held: Held, now: Moment): bool =
  not(fromPerson(request.origin)) implies not(agreed(request, stamp, held, now))
pure def lawConsentIsUsedOnce(given: Consent, held: Held, now: Moment): bool =
  canUse(given, held, now) implies not(canUse(given, spend(given, held), now))
pure def lawSpentNeverFalls(given: Consent, held: Held): bool =
  spend(given, held).spent >= held.spent
pure def lawNewerTurnVoidsConsent(given: Consent, held: Held, now: Moment): bool =
  given.herTurn < now.herTurn implies not(canUse(given, held, now))
pure def lawChangedOfferVoidsConsent(given: Consent, held: Held, now: Moment): bool =
  given.revision != held.offer.revision implies not(canUse(given, held, now))
pure def lawVisitKeepsConsent(detour: Detour, given: Consent, held: Held, now: Moment): bool =
  not(retires(detour)) implies
    canUse(given, heldAfter(detour, held), momentAfter(detour, now)) == canUse(given, held, now)
pure def lawRetiringDetourVoidsConsent(detour: Detour, given: Consent, held: Held, now: Moment): bool =
  (retires(detour) and canUse(given, held, now)) implies
    not(canUse(given, heldAfter(detour, held), momentAfter(detour, now)))

pure val detourValues = Set(SurfaceVisited, PopoverOpened, Corrected, Withdrawn, Reproposed, ConversationRestarted, GraceClosed)
pure val givenValues = Set(
  { stamp: 1, herTurn: 1, subject: exampleReply, revision: 1 }, { stamp: 2, herTurn: 1, subject: exampleReply, revision: 1 },
  { stamp: 1, herTurn: 1, subject: exampleReply, revision: 2 }, { stamp: 1, herTurn: 1, subject: exampleAppointment, revision: 1 },
  { stamp: 1, herTurn: 0, subject: exampleReply, revision: 1 })
pure val heldValues = Set(
  { offer: { subject: exampleReply, revision: 1 }, spent: 0 },
  { offer: { subject: exampleReply, revision: 1 }, spent: 1 },
  { offer: { subject: exampleReply, revision: 1 }, spent: 2 },
  { offer: { subject: exampleReply, revision: 2 }, spent: 0 },
  { offer: { subject: exampleAppointment, revision: 1 }, spent: 0 })
```

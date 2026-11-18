# Who asked, and what she agreed to

A leaf library with no state of its own. Every owner of something Grace can
act on or propose, Email, Calendar, the email accounts on the tablet,
Settings, Files, the browser, memory and payment, takes the same two
records: a `Request`, which says which turn of the
[conversation](./conversation.md) asked for an action and where that turn came
from, and a `Consent`, which says that the person agreed to one revision of one
owner's proposal. Neither record carries what is being done: a mail draft, an
appointment or a payment stays with the spec that owns it. Each owner keeps the
revision rule it already has, and that rule is what makes a changed proposal
void a consent: Email's `alwaysApprovalIsCurrent`,
`stepSendingNeedsCurrentApproval` and `stepOnlyThePersonApproves`
([email](./email.md)), Calendar's `alwaysSaveApprovalIsCurrent`
([calendar](./calendar.md)) and its whole-entry comparison in
[calendarView](./calendarView.md), payment's `stepOnlyApprovedSubmission`
([payment](./commitment.md)), memory's `stepFillUsesCurrentApproval`
([memory](./memory.md)), and the workspace's `lawCorrectedSpeechCannotApprove`
and `lawLateSpeechCannotApprove` ([workspace](./workspace.md)). No shared
pending-request, saving or outcome record is built here.

## Story: Only her own words ask Grace to act

> As a person who lets Grace read my mail and websites for me, I want only what
> I type, say or tap to ask her to do something, so that words in an email, on
> a page or in a file can tell me things but can never make her act.

### A request records its turn, the work it belongs to and where the turn came from

A turn comes from the person when she typed it, said it or tapped an answer.
Words heard while a page plays sound are the page's, not hers. Every other
turn is made by the host: from a page, an email, a file, a device event, or
Grace's own words, such as her opening line or her report of what she did on
another surface. A host turn may still be read and answered.

```quint
type Origin = Typed | Spoken | Tapped | FromPage | FromEmail | FromFile | FromDevice | FromGrace
type Request = { generation: int, workVersion: int, origin: Origin }
type Moment = { generation: int, workVersion: int }

pure def fromPerson(origin: Origin): bool = origin == Typed or origin == Spoken or origin == Tapped
```

### Only a current request from the person's own turn may ask for an action on any surface

An action is admitted only for a request from the person's own turn, in the
conversation's current generation and for the current work. A turn the host
made can produce words and guidance, and no action and no consent on any
surface: even a consent built from it can never be used.

```quint
pure def mayAct(request: Request, now: Moment): bool =
  fromPerson(request.origin) and request.generation == now.generation and request.workVersion == now.workVersion
pure def canConsent(request: Request, now: Moment, stamp: int): bool = mayAct(request, now) and stamp > 0

pure def lawHostTurnNeverAuthorizes(request: Request, now: Moment, stamp: int, proposal: Proposal, held: Held): bool =
  not(fromPerson(request.origin)) implies
    (not(mayAct(request, now)) and not(canConsent(request, now, stamp)) and
      not(canUse(consent(request, stamp, proposal), held, now)))

pure val requestValues = Set(
  { generation: 1, workVersion: 1, origin: Typed }, { generation: 1, workVersion: 1, origin: Spoken },
  { generation: 1, workVersion: 1, origin: Tapped }, { generation: 1, workVersion: 1, origin: FromPage },
  { generation: 1, workVersion: 1, origin: FromEmail }, { generation: 1, workVersion: 1, origin: FromFile },
  { generation: 1, workVersion: 1, origin: FromDevice }, { generation: 1, workVersion: 1, origin: FromGrace },
  { generation: 0, workVersion: 1, origin: Typed }, { generation: 1, workVersion: 2, origin: Spoken })
pure val nowValues = Set({ generation: 1, workVersion: 1 }, { generation: 2, workVersion: 1 })
pure val stampValues = Set(0, 1, 2)
```

## Story: Each yes counts once, for what she was shown

> As a person who says yes to something Grace proposes, I want that yes to
> count once, for exactly the version I was shown, and to keep counting while
> I look at another app, but not after I say something new.

### A proposal is known by its owner, its item and its revision, not by where it is shown

The subject names the owner and the item within it; the revision is the
owner's, and changes whenever what the person would agree to changes. Where
the proposal is shown is not part of it, so moving between surfaces or
opening a popover from the rail keeps it. A correction, a cancellation, a new
proposal, New conversation and Close Grace retire it.

```quint
type Owner = EmailOwner | CalendarOwner | AccountsOwner | SettingsOwner | FilesOwner | BrowserOwner | MemoryOwner | PaymentOwner
type Subject = { owner: Owner, item: str }
type Proposal = { subject: Subject, revision: int }
type Interruption = SurfaceVisit | RailPopover | Correction | Cancellation | NewProposal | NewConversation | GraceClosed

pure def retires(interruption: Interruption): bool = match interruption {
  | SurfaceVisit => false
  | RailPopover => false
  | _ => true
}
```

### A consent names one revision of one proposal and the turn that gave it

It is made only where `canConsent` admits her turn. The stamp numbers her
answer: the host gives each answer a new, larger stamp. The consent keeps the
conversation generation and the origin of the turn that gave it, and the
subject and revision she was shown.

```quint
type Consent = { stamp: int, generation: int, origin: Origin, subject: Subject, revision: int }

pure def consent(request: Request, stamp: int, proposal: Proposal): Consent =
  { stamp: stamp, generation: request.generation, origin: request.origin, subject: proposal.subject, revision: proposal.revision }

pure val proposalValues = Set(
  { subject: { owner: EmailOwner, item: "reply" }, revision: 1 },
  { subject: { owner: CalendarOwner, item: "visit" }, revision: 1 })
```

### A consent is used once, and a newer turn voids it

The owner holds the proposal it is waiting on and the last stamp it used. A
consent is usable only if the person's own turn gave it, while the
conversation is still in the generation of that turn, for the subject and
revision the owner holds, and with a stamp the owner has not used. Using it
records the stamp, so the same yes cannot act twice; any newer turn of the
conversation makes it void, and so does any change to the revision the owner
holds.

```quint
type Held = { proposal: Proposal, spent: int }

pure def canUse(given: Consent, held: Held, now: Moment): bool =
  fromPerson(given.origin) and given.generation == now.generation and given.subject == held.proposal.subject and
  given.revision == held.proposal.revision and given.stamp > held.spent
pure def spend(given: Consent, held: Held): Held = { ...held, spent: given.stamp }

pure def lawConsentIsUsedOnce(given: Consent, held: Held, now: Moment): bool =
  canUse(given, held, now) implies not(canUse(given, spend(given, held), now))
pure def lawNewerTurnVoidsConsent(given: Consent, held: Held, now: Moment): bool =
  given.generation < now.generation implies not(canUse(given, held, now))
pure def lawChangedProposalVoidsConsent(given: Consent, held: Held, now: Moment): bool =
  given.revision != held.proposal.revision implies not(canUse(given, held, now))

pure val letter: Subject = { owner: EmailOwner, item: "reply" }
pure val visit: Subject = { owner: CalendarOwner, item: "visit" }
pure val givenValues = Set(
  { stamp: 1, generation: 1, origin: Tapped, subject: letter, revision: 1 },
  { stamp: 2, generation: 1, origin: Spoken, subject: letter, revision: 1 },
  { stamp: 1, generation: 1, origin: Typed, subject: letter, revision: 2 },
  { stamp: 1, generation: 1, origin: Tapped, subject: visit, revision: 1 },
  { stamp: 1, generation: 0, origin: Tapped, subject: letter, revision: 1 },
  { stamp: 2, generation: 1, origin: FromEmail, subject: visit, revision: 1 },
  { stamp: 2, generation: 1, origin: FromGrace, subject: letter, revision: 1 })
pure val heldValues = Set(
  { proposal: { subject: letter, revision: 1 }, spent: 0 },
  { proposal: { subject: letter, revision: 1 }, spent: 1 },
  { proposal: { subject: letter, revision: 2 }, spent: 0 },
  { proposal: { subject: visit, revision: 1 }, spent: 0 })
```

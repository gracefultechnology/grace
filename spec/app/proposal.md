# The calendar question Grace is waiting on

Grace can suggest a new appointment, including one from the email being read,
a change to a saved appointment or its removal, from any screen. The
[calendar view](./calendarView.md) promises that "the displayed question owns
one immutable proposal until it is confirmed, corrected or cancelled"; this
module is that question. It holds at most one ask, the revision the person is
shown, the turn that asked it and her yes, built as a
[consent](./request.md) for that revision. It never writes a calendar: after
her yes the host applies the agreed ask to the target calendar with
`ViewConsent` (`confirmAppointment`, `confirmChange` or `confirmDeletion`),
which checks the exact review again, and settles the question with the
calendar's answer. The target is a calendar key: 0 is "On this tablet",
otherwise the email account whose calendar it is. Questions are not urgent:
there is no deadline and no reminder.

## Story: Say yes to exactly what Grace proposes for my calendar

> As Margaret, I want an appointment Grace suggests, or a change or deletion
> she suggests, to happen only after I say yes to that exact one, once, and to
> be dropped when I say something else.

### A proposal comes only from her current turn

Grace asks only in answer to the person's own current turn: typed, said or
tapped, in the conversation's current generation and for the current work.
Words in an email, on a page or in a file can never make her ask. A new
question replaces the one before it, and every change to the question moves
its revision, so a yes to an earlier question can never apply to a later one.
While the person's yes is being applied, Grace cannot ask again.

```quint
import request as R from "./request"
import calendarView as V from "./calendarView"

type ProposalActor = Grace | Person | Host
type Ask = NoAsk
  | AddAsk({ target: int, review: V::AppointmentReview })
  | ChangeAsk({ target: int, review: V::ChangeReview })
  | DeleteAsk({ target: int, review: V::DeletionReview })
type Pending = { ask: Ask, revision: int, generation: int, spent: int, agreed: int }

pure val initial: Pending = { ask: NoAsk, revision: 0, generation: -1, spent: 0, agreed: 0 }
pure val asked: R::Subject = { owner: R::CalendarOwner, item: "ask" }
pure def held(p: Pending): R::Held = { proposal: { subject: asked, revision: p.revision }, spent: p.spent }
pure def proposalOf(p: Pending): R::Proposal = held(p).proposal
pure def targetOf(ask: Ask): int = match ask {
  | AddAsk(x) => x.target
  | ChangeAsk(x) => x.target
  | DeleteAsk(x) => x.target
  | NoAsk => -1
}
pure def asking(p: Pending): bool = targetOf(p.ask) >= 0

pure def canPropose(p: Pending, ask: Ask, request: R::Request, now: R::Moment, by: ProposalActor): bool =
  by == Grace and targetOf(ask) >= 0 and R::mayAct(request, now) and p.agreed == 0
pure def propose(p: Pending, ask: Ask, request: R::Request, now: R::Moment, by: ProposalActor): Pending =
  { ...p, ask: ask, revision: p.revision + 1, generation: request.generation }

pure def lawHostTurnCannotPropose(p: Pending, ask: Ask, request: R::Request, now: R::Moment, by: ProposalActor): bool =
  not(R::fromPerson(request.origin)) implies not(canPropose(p, ask, request, now, by))
pure def stepQuestionChangesMoveTheRevision(before: Pending, after: Pending): bool =
  after.revision >= before.revision and (after.ask != before.ask implies after.revision > before.revision)
pure def sometimesAsking(p: Pending): bool = asking(p) and p.agreed == 0
```

### Her yes counts once, for the revision she was shown

Only the person agrees, and only with a consent that `R::consent` built from
her own turn for the question as it is held now: its subject and revision,
in the conversation's current generation, from a turn after the one that
asked, with an answer stamp not used before. Agreeing spends that stamp, so
the same yes cannot agree twice, and any newer turn voids a yes not yet used.
Grace's own words, a page, an email, a file, a device event or her Ask Grace
tap never agree.
Nothing but her yes marks the question agreed.

```quint
pure def canAgree(p: Pending, given: R::Consent, now: R::Moment, by: ProposalActor): bool =
  by == Person and asking(p) and p.agreed == 0 and given.generation > p.generation and
  R::canUse(given, held(p), now)
pure def agree(p: Pending, given: R::Consent, now: R::Moment, by: ProposalActor): Pending =
  { ...p, spent: R::spend(given, held(p)).spent, agreed: given.stamp }

pure def stepOnlyHerYesAgrees(before: Pending, via: str, after: Pending): bool =
  (after.agreed > 0 and after.agreed != before.agreed) implies via == "agree"
pure def stepStampsAreNeverReused(before: Pending, after: Pending): bool = after.spent >= before.spent
pure def alwaysAgreedIsTheSpentStamp(p: Pending): bool =
  p.agreed >= 0 and p.spent >= 0 and (p.agreed > 0 implies (p.agreed == p.spent and asking(p)))
pure def lawYesCountsOnce(p: Pending, given: R::Consent, now: R::Moment, by: ProposalActor): bool =
  canAgree(p, given, now, by) implies not(canAgree(agree(p, given, now, by), given, now, by))
pure def lawNewerTurnVoidsYes(p: Pending, given: R::Consent, now: R::Moment, by: ProposalActor): bool =
  given.generation < now.generation implies not(canAgree(p, given, now, by))
pure def lawYesToAnotherRevisionDoesNotAgree(p: Pending, given: R::Consent, now: R::Moment, by: ProposalActor): bool =
  (given.revision != p.revision or given.subject != asked) implies not(canAgree(p, given, now, by))
pure def lawHostTurnCannotAgree(p: Pending, given: R::Consent, now: R::Moment, by: ProposalActor): bool =
  not(R::fromPerson(given.origin)) implies not(canAgree(p, given, now, by))
pure def lawAskingForHelpCannotAgree(p: Pending, given: R::Consent, now: R::Moment, by: ProposalActor): bool =
  given.origin == R::AskedForHelp implies not(canAgree(p, given, now, by))
pure def lawTheAskingTurnCannotAgree(p: Pending, given: R::Consent, now: R::Moment, by: ProposalActor): bool =
  given.generation <= p.generation implies not(canAgree(p, given, now, by))
pure def sometimesAgreed(p: Pending): bool = p.agreed > 0
```

### An agreed question stays exactly as agreed until the calendar answers

After her yes, the host applies the agreed ask to its target calendar and
settles the question with the revision it applied, whether the calendar took
it or refused it as no longer current; a refusal is told to Grace, who may
ask again. Nothing else changes or drops an agreed question: neither a new
question nor an interruption.

```quint
pure def canSettleAsk(p: Pending, revision: int, by: ProposalActor): bool =
  by == Host and p.agreed > 0 and revision == p.revision
pure def settleAsk(p: Pending, revision: int, by: ProposalActor): Pending =
  { ...p, ask: NoAsk, revision: p.revision + 1, agreed: 0 }

pure def stepAgreedQuestionIsKept(before: Pending, via: str, after: Pending): bool =
  before.agreed > 0 implies ((after.ask == before.ask and after.revision == before.revision and
    after.agreed == before.agreed) or via == "settleAsk")
pure def sometimesSettled(p: Pending): bool = not(asking(p)) and p.spent > 0
```

### A correction, a No or a new conversation drops a question she has not agreed to

A correction, her No, a new question, New conversation or closing Grace
retires an unanswered question, whether the host or Grace notices it.
Looking at another app or opening a popover from the rail does not: the
question waits. When a turn drops it, that turn is her own answer, typed,
said or tapped, in the current generation and for the current work: her Ask
Grace tap asked for help, so neither Grace's reply to it nor the host drops
her question then, and it waits for her answer.

```quint
pure def canWithdraw(p: Pending, interruption: R::Interruption, by: ProposalActor): bool =
  (by == Host or by == Grace) and asking(p) and p.agreed == 0 and R::retires(interruption)
pure def withdraw(p: Pending, interruption: R::Interruption, by: ProposalActor): Pending =
  { ...p, ask: NoAsk, revision: p.revision + 1 }

pure def turnDrops(p: Pending, interruption: R::Interruption, request: R::Request, now: R::Moment, by: ProposalActor): bool =
  R::answers(request.origin) and R::mayAct(request, now) and canWithdraw(p, interruption, by)

pure def lawAskingForHelpCannotDrop(p: Pending, interruption: R::Interruption, request: R::Request, now: R::Moment, by: ProposalActor): bool =
  request.origin == R::AskedForHelp implies not(turnDrops(p, interruption, request, now, by))
pure def lawHostTurnCannotDrop(p: Pending, interruption: R::Interruption, request: R::Request, now: R::Moment, by: ProposalActor): bool =
  not(R::fromPerson(request.origin)) implies not(turnDrops(p, interruption, request, now, by))
pure def lawLookingElsewhereKeepsTheQuestion(p: Pending, interruption: R::Interruption, by: ProposalActor): bool =
  (interruption == R::SurfaceVisit or interruption == R::RailPopover) implies not(canWithdraw(p, interruption, by))
pure def sometimesWithdrawn(p: Pending): bool = not(asking(p)) and p.revision > 0 and p.spent == 0
```

### Samples ask for each kind of calendar question and answer from each kind of turn

```quint
pure val addVisit: Ask = AddAsk({ target: 1, review: V::reviewedAppointment.review })
pure val moveVisit: Ask = ChangeAsk({ target: 0, review: V::agreedChange.review })
pure val removeVisit: Ask = DeleteAsk({ target: 0, review: V::agreedDeletion.review })
pure val askValues = Set(addVisit).union(Set(moveVisit)).union(Set(removeVisit)).union(Set(NoAsk))
  .union(Set(AddAsk({ target: -1, review: V::reviewedAppointment.review })))
pure val requestValues = Set(
  { generation: 1, workVersion: 1, origin: R::Spoken }, { generation: 2, workVersion: 1, origin: R::Typed },
  { generation: 1, workVersion: 1, origin: R::FromEmail }, { generation: 1, workVersion: 2, origin: R::Tapped },
  { generation: 2, workVersion: 1, origin: R::AskedForHelp })
pure val nowValues = Set({ generation: 1, workVersion: 1 }, { generation: 2, workVersion: 1 }, { generation: 3, workVersion: 1 })
pure val givenValues = Set(
  R::consent({ generation: 2, workVersion: 1, origin: R::Tapped }, 1, { subject: asked, revision: 1 }))
  .union(Set(R::consent({ generation: 2, workVersion: 1, origin: R::Spoken }, 2, { subject: asked, revision: 1 })))
  .union(Set(R::consent({ generation: 3, workVersion: 1, origin: R::Typed }, 2, { subject: asked, revision: 3 })))
  .union(Set(R::consent({ generation: 3, workVersion: 1, origin: R::Tapped }, 3, { subject: asked, revision: 2 })))
  .union(Set(R::consent({ generation: 1, workVersion: 1, origin: R::Tapped }, 1, { subject: asked, revision: 1 })))
  .union(Set(R::consent({ generation: 2, workVersion: 1, origin: R::FromEmail }, 1, { subject: asked, revision: 1 })))
  .union(Set(R::consent({ generation: 2, workVersion: 1, origin: R::Tapped }, 1, { subject: R::visit, revision: 1 })))
  .union(Set(R::consent({ generation: 3, workVersion: 1, origin: R::AskedForHelp }, 3, { subject: asked, revision: 1 })))
pure val revisionValues = Set(0, 1, 2, 3)
```

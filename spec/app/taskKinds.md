# The kinds of task and what each must keep

One registry answers, for every kind of task, the questions a preparation asks of what it read: whether the facts belong to the task's kind, where they leave it, whether terms fit them, what Grace may type for a choice and what she may suggest. Paying a bill is the [bill kind](./billKind.md) and booking a visit is the [booking kind](./bookingKind.md). Each answer is one `match` with an arm per kind, so a kind added to the facts stops the check until every answer has its arm.

## Story: Ask every kind the same questions

> As a person asking Grace to do a task of any kind, I want each kind held to the same steps: the facts read and confirmed, the terms checked against them, a review, my consent and the outcome checked.

### Facts are nothing read yet or one kind's reading, and fit only a task of that kind when whole

```quint
import task as T from "./task"
import billKind as BK from "./billKind"
import bookingKind as VK from "./bookingKind"
type Facts = NoFacts | BillRead({ bill: BK::BillFacts }) | VisitRead({ visit: VK::VisitFacts })
pure def factsFit(kind: T::TaskKind, facts: Facts): bool = match facts {
  | NoFacts => false
  | BillRead(x) => kind == T::BillPay and BK::validBill(x.bill)
  | VisitRead(x) => kind == T::AppointmentBooking and VK::validVisit(x.visit)
}
pure val sampleBillKey: T::Subject = { kind: T::BillPay, owner: "owner", origin: "https://utility.example", account: "account", ref: "bill" }
pure val sampleVisitKey: T::Subject = { ...sampleBillKey, kind: T::AppointmentBooking, ref: "visit" }
pure val sampleBillFacts: Facts = BillRead({ bill: BK::sampleBill })
pure val sampleVisitFacts: Facts = VisitRead({ visit: VK::sampleVisit })
pure val factsValues = BK::factsValues.map(f => BillRead({ bill: f }))
  .union(VK::factsValues.map(f => VisitRead({ visit: f }))).union(Set(NoFacts))
pure def lawFactsOfAnotherKindNeverFit(kind: T::TaskKind, facts: Facts): bool = match facts {
  | NoFacts => not(factsFit(kind, facts))
  | BillRead(x) => factsFit(kind, facts) implies kind == T::BillPay
  | VisitRead(x) => factsFit(kind, facts) implies kind == T::AppointmentBooking
}
```

### A reading leaves the task actionable, with nothing to do, already under way, or unavailable for a stated reason

A bill already being paid is under way, a bill with nothing due needs nothing, a payable bill is actionable, and any other bill is unavailable with the bill's own reason. A visit already booked is under way, a visit that can be booked online is actionable, and any other visit is unavailable with the visit's own reason; a visit never needs nothing. With nothing read, the task is unavailable because nothing was read. A cost not yet observed is told apart, since it is not zero: a bill's fee not read, or a visit whose price the website does not show.

```quint
type Standing = Actionable | NothingToDo | AlreadyUnderWay | Unavailable
pure def standing(facts: Facts): Standing = match facts {
  | NoFacts => Unavailable
  | BillRead(x) => if (BK::underWay(x.bill)) AlreadyUnderWay else if (BK::nothingDue(x.bill)) NothingToDo
      else if (BK::payable(x.bill)) Actionable else Unavailable
  | VisitRead(x) => if (VK::underWay(x.visit)) AlreadyUnderWay else if (VK::bookable(x.visit)) Actionable else Unavailable
}
pure def whyUnavailable(facts: Facts): str = match facts {
  | NoFacts => "Nothing was read"
  | BillRead(x) => BK::whyNot(x.bill)
  | VisitRead(x) => VK::whyNot(x.visit)
}
pure def costUnobserved(facts: Facts): bool = match facts {
  | NoFacts => false
  | BillRead(x) => not(x.bill.fee.known)
  | VisitRead(x) => not(x.visit.priced)
}
pure def lawUnavailableFactsHaveAReason(kind: T::TaskKind, facts: Facts): bool =
  (factsFit(kind, facts) and standing(facts) == Unavailable) implies whyUnavailable(facts) != ""
```

### Terms fit facts only of their own kind, and terms that fit whole facts are valid for the task and leave it actionable

A payment fits a bill as the bill kind judges it, and a booking fits a visit as the booking kind judges it. A booking's terms say whether she accepted a clash with her calendar; no other terms do.

```quint
pure def payTermsFit(bill: BK::BillFacts, terms: T::Terms): bool = match terms {
  | NoTerms => false
  | PayTerms(y) => BK::payFits(bill, y.pay)
  | BookTerms(y) => false
}
pure def bookTermsFit(visit: VK::VisitFacts, terms: T::Terms): bool = match terms {
  | NoTerms => false
  | PayTerms(y) => false
  | BookTerms(y) => VK::bookingFits(visit, y.book)
}
pure def termsFit(facts: Facts, terms: T::Terms): bool = match facts {
  | NoFacts => false
  | BillRead(x) => payTermsFit(x.bill, terms)
  | VisitRead(x) => bookTermsFit(x.visit, terms)
}
pure def acceptsClash(terms: T::Terms): bool = match terms {
  | NoTerms => false
  | PayTerms(x) => false
  | BookTerms(x) => x.book.acceptsClash
}
pure val sampleClashTerms: T::Terms = T::BookTerms({ book: {
  ...VK::suggestedBooking(VK::sampleVisit), slot: VK::sampleClashSlot, acceptsClash: true } })
pure val termsValues = T::payValues.map(p => T::PayTerms({ pay: p }))
  .union(T::bookValues.map(b => T::BookTerms({ book: b })))
  .union(Set(T::NoTerms, sampleClashTerms, T::BookTerms({ book: VK::suggestedBooking(VK::sampleVisit) })))
pure def lawFittingTermsAreValidForTheFactsKind(kind: T::TaskKind, facts: Facts, terms: T::Terms): bool =
  (factsFit(kind, facts) and termsFit(facts, terms)) implies (T::validTerms(kind, terms) and standing(facts) == Actionable)
```

### Grace types only what a choice says, for a bill its amount and day, for a booking its time and the kinds of detail asked

No terms give nothing to type, and every chosen terms give something to type.

```quint
type Fill = NoFill | PayFill({ payForm: BK::FormFill }) | BookFill({ bookForm: VK::VisitFill })
pure def fillOf(terms: T::Terms): Fill = match terms {
  | NoTerms => NoFill
  | PayTerms(x) => PayFill({ payForm: BK::formFill(x.pay) })
  | BookTerms(x) => BookFill({ bookForm: VK::visitFill(x.book) })
}
pure def lawGraceTypesOnlyAChoice(terms: T::Terms): bool = (fillOf(terms) == NoFill) iff not(T::hasTerms(terms))
```

### A suggestion fits the whole facts it was made from, or there is none

Grace suggests terms only for an actionable reading whose kind offers a default for it, for a bill one observed in full with one funding method, for a visit one whose calendar was read with exactly one offered time free. A suggestion is never selected for the person.

```quint
pure def suggestion(facts: Facts, today: int): T::Terms = match facts {
  | NoFacts => T::NoTerms
  | BillRead(x) => if (standing(facts) == Actionable and BK::defaultAvailable(x.bill, today))
      T::PayTerms({ pay: BK::suggestedPay(x.bill, today) }) else T::NoTerms
  | VisitRead(x) => if (standing(facts) == Actionable and VK::onlyFreeSlot(x.visit))
      T::BookTerms({ book: VK::suggestedBooking(x.visit) }) else T::NoTerms
}
pure val samplePayTerms: T::Terms = suggestion(sampleBillFacts, 1)
pure val sampleBookTerms: T::Terms = suggestion(sampleVisitFacts, 1)
pure def lawASuggestionFitsOrIsAbsent(kind: T::TaskKind, facts: Facts, today: int): bool =
  factsFit(kind, facts) implies (not(T::hasTerms(suggestion(facts, today))) or termsFit(facts, suggestion(facts, today)))
```

### Every kind's plan confirms the facts, reviews, asks consent and checks the outcome, and records in the calendar only a kind that does

The plan is derived from the kind and never held as state, so no kind can leave out the yes to the facts, the review, the consent or the outcome.

```quint
type StepKind = SourceStep | AccessStep | FactsStep | ConfirmStep | ChoiceStep | FillStep | FormStep
  | ReviewStep | ConsentStep | SubmitStep | OutcomeStep | RecordStep
pure def plan(kind: T::TaskKind): List[StepKind] =
  List(SourceStep, AccessStep, FactsStep, ConfirmStep, ChoiceStep, FillStep, FormStep, ReviewStep, ConsentStep, SubmitStep, OutcomeStep)
    .concat(if (T::recordsInCalendar(kind)) List(RecordStep) else List())
pure def lawEveryPlanConfirmsReviewsAndConsents(kind: T::TaskKind): bool =
  plan(kind).some(s => s == ConfirmStep) and plan(kind).some(s => s == ReviewStep) and plan(kind).some(s => s == ConsentStep) and
  plan(kind).some(s => s == OutcomeStep) and (plan(kind).some(s => s == RecordStep) iff T::recordsInCalendar(kind))
```

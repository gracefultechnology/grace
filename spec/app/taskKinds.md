# The kinds of task and what each must keep

One registry answers, for every kind of task, the questions a preparation asks of what it read: whether the facts belong to the task's kind, where they leave it, whether terms fit them, what Grace may type for a choice and what she may suggest. Paying a bill is the [bill kind](./billKind.md). Each answer is one `match` with an arm per kind, so a kind added to the facts stops the check until every answer has its arm. Booking a visit has terms in the [vocabulary](./task.md) but no reading here yet, so no booking can fit or be filled.

## Story: Ask every kind the same questions

> As a person asking Grace to do a task of any kind, I want each kind held to the same steps: the facts read and confirmed, the terms checked against them, a review, my consent and the outcome checked.

### Facts are nothing read yet or one kind's reading, and fit only a task of that kind when whole

```quint
import task as T from "./task"
import billKind as BK from "./billKind"
type Facts = NoFacts | BillRead({ bill: BK::BillFacts })
pure def factsFit(kind: T::TaskKind, facts: Facts): bool = match facts {
  | NoFacts => false
  | BillRead(x) => kind == T::BillPay and BK::validBill(x.bill)
}
pure val sampleBillKey: T::Subject = { kind: T::BillPay, owner: "owner", origin: "https://utility.example", account: "account", ref: "bill" }
pure val sampleBillFacts: Facts = BillRead({ bill: BK::sampleBill })
pure val factsValues = BK::factsValues.map(f => BillRead({ bill: f })).union(Set(NoFacts))
pure def lawFactsOfAnotherKindNeverFit(kind: T::TaskKind, facts: Facts): bool = match facts {
  | NoFacts => not(factsFit(kind, facts))
  | BillRead(x) => factsFit(kind, facts) implies kind == T::BillPay
}
```

### A reading leaves the task actionable, with nothing to do, already under way, or unavailable for a stated reason

A bill already being paid is under way, a bill with nothing due needs nothing, a payable bill is actionable, and any other bill is unavailable with the bill's own reason. With nothing read, the task is unavailable because nothing was read. A cost not yet observed is told apart, since it is not zero.

```quint
type Standing = Actionable | NothingToDo | AlreadyUnderWay | Unavailable
pure def standing(facts: Facts): Standing = match facts {
  | NoFacts => Unavailable
  | BillRead(x) => if (BK::underWay(x.bill)) AlreadyUnderWay else if (BK::nothingDue(x.bill)) NothingToDo
      else if (BK::payable(x.bill)) Actionable else Unavailable
}
pure def whyUnavailable(facts: Facts): str = match facts {
  | NoFacts => "Nothing was read"
  | BillRead(x) => BK::whyNot(x.bill)
}
pure def costUnobserved(facts: Facts): bool = match facts {
  | NoFacts => false
  | BillRead(x) => not(x.bill.fee.known)
}
pure def lawUnavailableFactsHaveAReason(kind: T::TaskKind, facts: Facts): bool =
  (factsFit(kind, facts) and standing(facts) == Unavailable) implies whyUnavailable(facts) != ""
```

### Terms fit facts only of their own kind, and terms that fit whole facts are valid for the task and leave it actionable

A payment fits a bill as the bill kind judges it. Booking terms fit no facts until a booking can be read.

```quint
pure def payTermsFit(bill: BK::BillFacts, terms: T::Terms): bool = match terms {
  | NoTerms => false
  | PayTerms(y) => BK::payFits(bill, y.pay)
  | BookTerms(y) => false
}
pure def termsFit(facts: Facts, terms: T::Terms): bool = match facts {
  | NoFacts => false
  | BillRead(x) => payTermsFit(x.bill, terms)
}
pure val termsValues = T::payValues.map(p => T::PayTerms({ pay: p }))
  .union(T::bookValues.map(b => T::BookTerms({ book: b })))
  .union(Set(T::NoTerms))
pure def lawFittingTermsAreValidForTheFactsKind(kind: T::TaskKind, facts: Facts, terms: T::Terms): bool =
  (factsFit(kind, facts) and termsFit(facts, terms)) implies (T::validTerms(kind, terms) and standing(facts) == Actionable)
```

### Grace types only what a choice says, for a bill its amount and day

No terms give nothing to type, and booking terms give nothing to type until a booking can be filled.

```quint
type Fill = NoFill | PayFill({ payForm: BK::FormFill })
pure def fillOf(terms: T::Terms): Fill = match terms {
  | NoTerms => NoFill
  | PayTerms(x) => PayFill({ payForm: BK::formFill(x.pay) })
  | BookTerms(x) => NoFill
}
```

### A suggestion fits the whole facts it was made from, or there is none

Grace suggests terms only for an actionable reading whose kind offers a default for it, for a bill one observed in full with one funding method. A suggestion is never selected for the person.

```quint
pure def suggestion(facts: Facts, today: int): T::Terms = match facts {
  | NoFacts => T::NoTerms
  | BillRead(x) => if (standing(facts) == Actionable and BK::defaultAvailable(x.bill, today))
      T::PayTerms({ pay: BK::suggestedPay(x.bill, today) }) else T::NoTerms
}
pure val samplePayTerms: T::Terms = suggestion(sampleBillFacts, 1)
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

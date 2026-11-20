# Paying a bill, as one kind of task

What makes a task a bill payment: the facts read from the provider's website, when they are whole, where the bill stands, which payment fits it, what Grace may type for it and which payment she may suggest. The [registry of kinds](./taskKinds.md) is the only reader of a bill's own fields; the [bill preparation](./billpay.md) and the [commitment](./commitment.md) never read them. The preparation and its [review](./preparationReview.md) import this library only so that the bill's types can be named.

## Story: Read a bill and judge a payment against it

> As a person paying a bill, I want what Grace read from the provider kept exactly, unknown amounts never taken for zero, and a payment accepted only if it fits that bill.

### A bill's facts keep unknown amounts apart from zero, and whole facts never hold a negative fee

Each balance is known or unknown, so an unknown balance or fee is never zero. Credit balances may be negative; an observed fee is not. The facts name the currency, the due day, whether a payment is already scheduled, whether the provider says nothing is due, whether online payment is allowed and the funding methods it offers, each named. Whole facts have a currency, a due day that is not negative, no unnamed funding method and no negative observed fee.

```quint
import task as T from "./task"
type Balance = { known: bool, amount: int }
type BillFacts = {
  statement: Balance, minimum: Balance, current: Balance, fee: Balance,
  dueDay: int, currency: str, scheduled: bool, nothingDue: bool, paymentAllowed: bool, funding: List[str]
}
pure def validBill(facts: BillFacts): bool =
  facts.currency != "" and facts.dueDay >= 0 and facts.funding.every(f => f != "") and
  (facts.fee.known implies facts.fee.amount >= 0) and
  (facts.nothingDue implies not(facts.minimum.known and facts.minimum.amount > 0))
pure val sampleBill: BillFacts = {
  statement: { known: true, amount: 8420 }, minimum: { known: true, amount: 3500 }, current: { known: true, amount: 11255 },
  fee: { known: true, amount: 0 }, dueDay: 3, currency: "USD", scheduled: false, nothingDue: false, paymentAllowed: true,
  funding: List("bank-ref")
}
pure val factsValues = {
  val unread = {
    statement: { known: false, amount: 0 }, minimum: { known: false, amount: 0 }, current: { known: false, amount: 0 },
    fee: { known: false, amount: 0 }, dueDay: 0, currency: "", scheduled: false, nothingDue: false, paymentAllowed: false,
    funding: List()
  }
  Set(sampleBill,
    { ...sampleBill, fee: { known: true, amount: 25 }, scheduled: true, funding: List("bank-ref", "other-bank") },
    { ...sampleBill, statement: { known: true, amount: 0 }, minimum: { known: true, amount: 0 }, current: { known: true, amount: 0 },
      fee: { known: false, amount: 0 }, dueDay: 0, nothingDue: true, paymentAllowed: false, funding: List() },
    { ...sampleBill, fee: { known: false, amount: 0 } },
    { ...unread, currency: "USD", minimum: { known: true, amount: 100 }, nothingDue: true },
    { ...unread, currency: "USD", fee: { known: true, amount: -1 } },
    { ...unread, currency: "USD", current: { known: true, amount: -250 }, nothingDue: true },
    unread)
}
pure def lawObservedFeeIsNonnegative(facts: BillFacts): bool =
  validBill(facts) implies (facts.fee.known implies facts.fee.amount >= 0)
```

### Whole facts that say nothing is due never show a positive minimum due

No payment due needs the provider's explicit status; a zero or negative balance alone does not establish it. A positive statement balance or new charges can stand beside it, but a positive minimum due contradicts it, so such a reading is not whole and must be read again or explained.

```quint
pure def lawNoDueIsConsistent(facts: BillFacts): bool =
  validBill(facts) implies (facts.nothingDue implies not(facts.minimum.known and facts.minimum.amount > 0))
```

### A bill is already being paid, has nothing due, can be paid, or cannot be paid online for a stated reason

A scheduled or pending payment means the bill is already under way and is looked into before anything new. A bill can be paid online only when the provider allows it and offers at least one funding method; otherwise the reason says which of the two is missing.

```quint
pure def underWay(facts: BillFacts): bool = facts.scheduled
pure def nothingDue(facts: BillFacts): bool = facts.nothingDue
pure def payable(facts: BillFacts): bool = facts.paymentAllowed and facts.funding.length() > 0
pure def whyNot(facts: BillFacts): str =
  if (not(facts.paymentAllowed)) "Online payment is unavailable"
  else if (facts.funding.length() == 0) "No supported funding method is available" else ""
```

### A payment fits a bill only when nothing is scheduled or settled, payment is allowed, and it is valid, in the bill's currency and from one of its funding methods

```quint
pure def payFits(facts: BillFacts, pay: T::Proposal): bool =
  not(facts.scheduled) and not(facts.nothingDue) and facts.paymentAllowed and T::validProposal(pay) and
  pay.currency == facts.currency and facts.funding.includes(pay.funding)
pure def lawAFittingPaymentKeepsTheBillRule(facts: BillFacts, pay: T::Proposal): bool =
  payFits(facts, pay) implies (T::validProposal(pay) and pay.currency == facts.currency and
    facts.funding.includes(pay.funding) and facts.paymentAllowed and not(facts.scheduled))
```

### Grace fills a bill's form with the chosen amount and day only

The fee, currency and funding method are read back from the form, never typed by Grace.

```quint
type FormFill = { amount: int, day: int }
pure def formFill(pay: T::Proposal): FormFill = { amount: pay.amount, day: pay.day }
```

### A payment is suggested only when the statement balance and the fee were observed and one funding method is offered

The suggestion is the statement balance, today, from the one funding method, with the observed fee. An unknown fee does not mean free, so it is never suggested over.

```quint
pure def defaultAvailable(facts: BillFacts, today: int): bool =
  facts.statement.known and facts.statement.amount > 0 and facts.fee.known and facts.fee.amount >= 0 and
  today > 0 and facts.funding.length() == 1
pure def suggestedPay(facts: BillFacts, today: int): T::Proposal =
  { amount: facts.statement.amount, fee: facts.fee.amount, currency: facts.currency, day: today,
    funding: facts.funding.nthOr(0, "") }
pure def lawAnUnknownFeeIsNeverSuggested(facts: BillFacts, today: int): bool =
  not(facts.fee.known) implies not(defaultAvailable(facts, today))
```

# Prepare a bill payment on any supported website

The semantic journey is goal → verified destination and account → current bill → chosen amount/date/method → verified form → consequential review. These are facts to establish, not a fixed list of pages or clicks. A website may combine or repeat them. [Execution](./execution.md) discovers current controls and [payment](./commitment.md) owns authorization and durable outcomes. This preparation model cannot submit money.

Sources: new prototype's sign-in, account, payment, review and outcome views; PRD JOURNEY 01–09, HELP 01–12 and U01–12. Demo values, account suffixes, website names, synthetic credentials and synthetic success are not requirements. The same contract accepts any origin for which the integration can establish the required evidence; unsupported sites stop truthfully.

## Story: Understand the bill before deciding how to pay

> As a person opening a bill from Email, Calendar or a request to Grace, I want the current website facts explained and the right account checked before I decide on a payment.

### A bill preparation holds evidence and choices separately

Unknown balances and fees are represented explicitly rather than treated as zero. Credit balances may be negative; an observed fee is nonnegative. The provider's bill identity is independent of the calendar entry used to open it. No balance is interpreted as proof of affordability or available bank funds. Each trusted access, fact or form report carries its identity and revision together; representative report samples include accepted, stale and invalid evidence without imposing a runtime bound.

```quint
import commitment as CM from "./commitment"
import task as T from "./task"
type BillPhase = NoBill | NeedsLogin | ReadBill | ChoosePayment | PreparePayment | ReadyForReview | HandedOff | NoPaymentDue | ConflictingPayment | BillBlocked
type Access = SignedOut | Challenge | SignedIn | WrongAccount | AccessDenied
type FillBy = NotAsked | GraceFills | PersonFills
type FormFill = { amount: int, day: int }
type Balance = { known: bool, amount: int }
type BillFacts = {
  statement: Balance, minimum: Balance, current: Balance, fee: Balance,
  dueDay: int, currency: str, scheduled: bool, nothingDue: bool, paymentAllowed: bool, funding: List[str]
}
type AccessReport = { key: T::Subject, version: int, access: Access }
type FactReport = { key: T::Subject, facts: BillFacts, evidence: str, version: int }
type BillPreparation = {
  key: T::Subject, phase: BillPhase, facts: BillFacts,
  factsConfirmed: bool, choice: T::Proposal, fillBy: FillBy, evidence: str, version: int, live: bool, reason: str
}
type BillEffect = ReviewPayment({ key: T::Subject, proposal: T::Proposal, evidence: str, version: int })
type BillResult = { state: BillPreparation, out: List[BillEffect] }
pure val noFacts: BillFacts = {
  statement: { known: false, amount: 0 }, minimum: { known: false, amount: 0 },
  current: { known: false, amount: 0 }, fee: { known: false, amount: 0 }, dueDay: 0, currency: "", scheduled: false, nothingDue: false,
  paymentAllowed: false, funding: List()
}
pure val noChoice: T::Proposal = { amount: 0, fee: 0, currency: "", day: 0, funding: "" }
pure def payOf(terms: T::Terms): T::Proposal = match terms {
  | NoTerms => noChoice
  | PayTerms(x) => x.pay
  | BookTerms(x) => noChoice
}
pure val initial: BillPreparation = {
  key: T::emptyKey, phase: NoBill, facts: noFacts, factsConfirmed: false, choice: noChoice, fillBy: NotAsked,
  evidence: "", version: 0, live: true, reason: ""
}
pure def validFacts(facts: BillFacts): bool =
  facts.currency != "" and facts.dueDay >= 0 and facts.funding.every(f => f != "") and
  (facts.fee.known implies facts.fee.amount >= 0) and
  (facts.nothingDue implies not(facts.minimum.known and facts.minimum.amount > 0))
pure val factsValues = Set(
  { statement: { known: true, amount: 8420 }, minimum: { known: true, amount: 3500 }, current: { known: true, amount: 11255 }, fee: { known: true, amount: 0 }, dueDay: 3, currency: "USD", scheduled: false, nothingDue: false, paymentAllowed: true, funding: List("bank-ref") },
  { statement: { known: true, amount: 8420 }, minimum: { known: true, amount: 3500 }, current: { known: true, amount: 11255 }, fee: { known: true, amount: 25 }, dueDay: 3, currency: "USD", scheduled: true, nothingDue: false, paymentAllowed: true, funding: List("bank-ref", "other-bank") },
  { statement: { known: true, amount: 0 }, minimum: { known: true, amount: 0 }, current: { known: true, amount: 0 }, fee: { known: false, amount: 0 }, dueDay: 0, currency: "USD", scheduled: false, nothingDue: true, paymentAllowed: false, funding: List() },
  { statement: { known: true, amount: 8420 }, minimum: { known: true, amount: 3500 }, current: { known: true, amount: 11255 }, fee: { known: false, amount: 0 }, dueDay: 3, currency: "USD", scheduled: false, nothingDue: false, paymentAllowed: true, funding: List("bank-ref") },
  { ...noFacts, currency: "USD", minimum: { known: true, amount: 100 }, nothingDue: true },
  { ...noFacts, currency: "USD", fee: { known: true, amount: -1 } },
  { ...noFacts, currency: "USD", current: { known: true, amount: -250 }, nothingDue: true },
  noFacts
)
pure val accessReportValues = Set(
  { key: CM::exampleKey, version: 1, access: SignedIn },
  { key: CM::exampleKey, version: 1, access: SignedOut },
  { key: CM::exampleKey, version: 1, access: Challenge },
  { key: CM::exampleKey, version: 1, access: WrongAccount },
  { key: CM::exampleKey, version: 1, access: AccessDenied },
  { key: CM::exampleKey, version: 2, access: SignedIn },
  { key: CM::exampleKey, version: 3, access: SignedIn },
  { key: CM::exampleKey, version: 4, access: SignedIn },
  { key: CM::exampleKey, version: 5, access: SignedIn },
  { key: T::emptyKey, version: 1, access: SignedIn })
pure val factReportValues = factsValues.map(f => { key: CM::exampleKey, facts: f, evidence: "source", version: 2 })
  .union(factsValues.map(f => { key: CM::exampleKey, facts: f, evidence: "source", version: 3 }))
  .union(Set({ key: T::emptyKey, facts: noFacts, evidence: "", version: 2 }))
pure val formReportValues = CM::reviewReportValues.union(Set(4, 5).map(v => { ...CM::exampleReview, proposal: T::PayTerms({ pay: { ...CM::exampleProposal, amount: 3500 } }), revision: v }))
pure val proposalValues = Set(CM::exampleProposal, { amount: 3500, fee: 25, currency: "USD", day: 2, funding: "other-bank" }, noChoice)
pure val expectedVersionValues = Set(0, 1, 2, 3, 4, 5, 6)
pure val reasonValues = Set("unsupported", "expired", "")
pure val weight_begin = 2
pure val weight_inspectAccess = 2
pure val weight_readFacts = 2
pure val weight_choose = 2
pure val weight_verifyForm = 2
pure val weight_handOff = 2
```

### Opening a selected bill requests private sign-in without assuming account access

The source link is evidence of the requested bill, not authority for website actions. The trusted bridge verifies the official origin and actual authenticated account. Passwords and codes are entered privately on the site; wrong credentials, CAPTCHA, unavailable verification and session expiry are explained rather than bypassed. A push approval waits for the resulting browser state; Grace never controls the phone.

```quint
pure def canBegin(b: BillPreparation, key: T::Subject, evidence: str, by: T::TaskActor): bool =
  b.phase == NoBill and T::validKey(key) and evidence != "" and by == T::Person
pure def begin(b: BillPreparation, key: T::Subject, evidence: str, by: T::TaskActor): BillPreparation =
  { ...b, key: key, phase: NeedsLogin, evidence: evidence, version: b.version + 1 }
pure def canInspectAccess(b: BillPreparation, accessReport: AccessReport, by: T::TaskActor): bool =
  b.phase != NoBill and b.phase != HandedOff and b.live and accessReport.key == b.key and accessReport.version == b.version and by == T::Host
pure def inspectAccess(b: BillPreparation, accessReport: AccessReport, by: T::TaskActor): BillPreparation = {
  ...b, phase: if (accessReport.access == SignedIn) ReadBill else if (accessReport.access == SignedOut or accessReport.access == Challenge) NeedsLogin else BillBlocked,
  reason: if (accessReport.access == WrongAccount) "The account does not match" else if (accessReport.access == AccessDenied) "Sign-in is unavailable" else "",
  choice: noChoice, fillBy: NotAsked, facts: noFacts, factsConfirmed: false, version: b.version + 1
}
pure def alwaysBoundBill(b: BillPreparation): bool = b.phase == NoBill or T::validKey(b.key)
pure def alwaysVersion(b: BillPreparation): bool = b.version >= 0
pure def sometimesPrivateSignIn(b: BillPreparation): bool = b.phase == NeedsLogin
```

### Current bill facts distinguish payment choices, no payment due and an existing payment

Statement balance, minimum due, current balance, fees, due date and existing payment status are shown only when observed for this exact bill key and current preparation revision; a callback for another bill cannot populate its facts. A scheduled/pending existing payment is investigated before a new proposal. No payment due requires the provider's explicit status; a zero or negative balance alone does not establish it. A positive statement balance or new current charges can coexist with no payment due, but a positive minimum due contradicts that status and requires reobservation or an explained block. Missing or unsupported payment methods produce an honest block. The person can ask about any fact without changing the choice.

```quint
pure def canReadFacts(b: BillPreparation, factReport: FactReport, by: T::TaskActor): bool =
  (b.phase == ReadBill or b.phase == ConflictingPayment or b.phase == NoPaymentDue) and b.live and factReport.key == b.key and validFacts(factReport.facts) and
  factReport.evidence != "" and factReport.version == b.version and by == T::Host
pure def lawDifferentBillFactsAreRejected(b: BillPreparation, factReport: FactReport, by: T::TaskActor): bool =
  factReport.key != b.key implies not(canReadFacts(b, factReport, by))
pure def readFacts(b: BillPreparation, factReport: FactReport, by: T::TaskActor): BillPreparation = {
  ...b, facts: factReport.facts, factsConfirmed: false, evidence: factReport.evidence, version: b.version + 1,
  phase: if (factReport.facts.scheduled) ConflictingPayment else if (factReport.facts.nothingDue) NoPaymentDue
    else if (not(factReport.facts.paymentAllowed) or factReport.facts.funding.length() == 0) BillBlocked else ChoosePayment,
  reason: if (not(factReport.facts.scheduled) and not(factReport.facts.nothingDue) and not(factReport.facts.paymentAllowed)) "Online payment is unavailable"
    else if (not(factReport.facts.scheduled) and not(factReport.facts.nothingDue) and factReport.facts.funding.length() == 0) "No supported funding method is available" else ""
}
pure def defaultAvailable(b: BillPreparation, today: int): bool =
  b.phase == ChoosePayment and b.live and b.facts.statement.known and b.facts.statement.amount > 0 and
  b.facts.fee.known and b.facts.fee.amount >= 0 and today > 0 and b.facts.funding.length() == 1
pure def suggestedPayment(b: BillPreparation, today: int): T::Proposal = if (defaultAvailable(b, today)) {
  amount: b.facts.statement.amount, fee: b.facts.fee.amount, currency: b.facts.currency,
  day: today, funding: b.facts.funding.nthOr(0, "")
} else noChoice
pure def alwaysObservedFeeIsNonnegative(b: BillPreparation): bool = b.facts.fee.known implies b.facts.fee.amount >= 0
pure def alwaysNoDueIsConsistent(b: BillPreparation): bool = b.facts.nothingDue implies not(b.facts.minimum.known and b.facts.minimum.amount > 0)
pure def sometimesNoPaymentDue(b: BillPreparation): bool = b.phase == NoPaymentDue
pure def sometimesExistingPaymentIsInvestigated(b: BillPreparation): bool = b.phase == ConflictingPayment
pure def sometimesFeeStillNeedsObservation(b: BillPreparation): bool = b.phase == ChoosePayment and not(b.facts.fee.known)
```

### The person checks the bill facts before any payment question, and saying they look wrong reads them again

Grace states the bill and asks "Does that look right to you?" with the answers "Yes, that's right" and "That doesn't look right", and asks about paying only in the next turn (prototype/Grace Prototype.html:1512, 1516). This follows the prototype rather than the single combined proposal question of PRD JOURNEY 06-07 (prototype/prd.md:1879-1880). "Yes, that's right" is its own answer, recorded before any choice: no amount, date or funding method is accepted for the bill until the person has confirmed the facts read for the current version, and every new reading of the facts needs a new yes. When the person says the facts look wrong, Grace slows down, asks what seems different and says that nothing has been paid: the shown facts and any choice are discarded, the preparation version advances so that a report about the disputed reading cannot return, and no choice can be made until the facts are read again for the new version. Disputing never prepares, fills or hands off a payment.

```quint
pure def canConfirmFacts(b: BillPreparation, by: T::TaskActor): bool =
  b.phase == ChoosePayment and b.live and not(b.factsConfirmed) and by == T::Person
pure def confirmFacts(b: BillPreparation, by: T::TaskActor): BillPreparation = { ...b, factsConfirmed: true }
pure def alwaysChoiceFollowsConfirmedFacts(b: BillPreparation): bool =
  (b.phase == PreparePayment or b.phase == ReadyForReview or b.phase == HandedOff) implies b.factsConfirmed
pure def canDisputeFacts(b: BillPreparation, by: T::TaskActor): bool =
  (b.phase == ChoosePayment or b.phase == NoPaymentDue or b.phase == ConflictingPayment) and b.live and by == T::Person
pure def disputeFacts(b: BillPreparation, by: T::TaskActor): BillPreparation =
  { ...b, phase: ReadBill, facts: noFacts, factsConfirmed: false, choice: noChoice, fillBy: NotAsked, reason: "", version: b.version + 1 }
pure def lawDisputingFactsPaysNothing(b: BillPreparation, by: T::TaskActor): bool =
  canDisputeFacts(b, by) implies
    disputeFacts(b, by).phase == ReadBill and disputeFacts(b, by).key == b.key and
    disputeFacts(b, by).choice == noChoice and disputeFacts(b, by).fillBy == NotAsked and
    disputeFacts(b, by).version > b.version and not(canChoose(disputeFacts(b, by), b.choice, by))
```

### Choosing an amount, date and funding method is separate from approving submission

The default is one understandable proposal only when its facts, including the fee, are observed; it is never silently selected. An unknown fee does not mean free. Otherwise ask one missing choice at a time. Any supported amount, date and existing funding method may be selected, not only the prototype's two radio choices. Relative or ambiguous dates must be resolved by the person before an exact day enters this model. Fees are part of the proposal and must be reviewed against the final form because they may depend on the chosen date or funding method.

```quint
pure def canChoose(b: BillPreparation, proposal: T::Proposal, by: T::TaskActor): bool =
  (b.phase == ChoosePayment or b.phase == PreparePayment or b.phase == ReadyForReview) and b.live and b.factsConfirmed and
  not(b.facts.scheduled) and b.facts.paymentAllowed and T::validProposal(proposal) and
  proposal.currency == b.facts.currency and b.facts.funding.includes(proposal.funding) and by == T::Person
pure def choose(b: BillPreparation, proposal: T::Proposal, by: T::TaskActor): BillPreparation =
  { ...b, choice: proposal, phase: PreparePayment, fillBy: NotAsked, version: b.version + 1 }
pure def alwaysChoiceMatchesBill(b: BillPreparation): bool =
  (b.phase == PreparePayment or b.phase == ReadyForReview or b.phase == HandedOff) implies
    T::validProposal(b.choice) and b.choice.currency == b.facts.currency and b.facts.funding.includes(b.choice.funding) and
    b.facts.paymentAllowed and not(b.facts.scheduled)
```

### The person's answer to the fill offer decides whether Grace may fill the payment form

Grace offers to fill in only values the person already chose, the amount and the payment date, and fills them only after a yes to that specific offer: "Shall I fill in $84.20 and today's date for you?" with the answers "Yes, fill it in" and "No, I'll do it" (prototype/Grace Prototype.html:1503, 1513). In the prototype that limit is only an instruction to the model: its code fills the form whenever the model asks to fill on the payment page (prototype/Grace Prototype.html:1635), whatever the answer was. This spec deliberately departs from that and makes the answer a recorded state. Every new choice asks again. After "No, I'll do it", Grace points and waits while the person types, and the form is checked as it is read back. The person may change the answer while the form is being prepared.

A fill carries only an amount and a day. `graceMayFill` holds for a fill only while the form is being prepared, the preparation is live, the answer is "Yes, fill it in", and the fill's amount and day are those of the current choice. This model dispatches no website operation, so it records the answer and defines `graceMayFill` but cannot itself stop a fill. The owner that dispatches website operations must refuse Grace's fill of a payment form unless `graceMayFill` holds for exactly the values it would type.

```quint
pure def canDecideFill(b: BillPreparation, fillBy: FillBy, by: T::TaskActor): bool =
  b.phase == PreparePayment and b.live and fillBy != NotAsked and by == T::Person
pure def decideFill(b: BillPreparation, fillBy: FillBy, by: T::TaskActor): BillPreparation = { ...b, fillBy: fillBy }
pure def chosenFill(b: BillPreparation): FormFill = { amount: b.choice.amount, day: b.choice.day }
pure def graceMayFill(b: BillPreparation, fill: FormFill): bool =
  b.phase == PreparePayment and b.live and b.fillBy == GraceFills and fill == chosenFill(b)
pure def alwaysFillAnswerBelongsToAChoice(b: BillPreparation): bool =
  b.fillBy != NotAsked implies (b.phase == PreparePayment or b.phase == ReadyForReview or b.phase == HandedOff)
pure def stepGraceFillsOnlyAfterTheirYes(before: BillPreparation, via: str, after: BillPreparation): bool =
  (after.fillBy == GraceFills and before.fillBy != GraceFills) implies via == "decideFill"
pure def sometimesGraceFills(b: BillPreparation): bool = graceMayFill(b, chosenFill(b))
pure def sometimesPersonFills(b: BillPreparation): bool = b.phase == PreparePayment and b.fillBy == PersonFills
```

## Story: Correct the website form and review consequences

> As a person paying a bill, I want Grace to check what the website actually contains, accept corrections and stop if it cannot verify the right payment.

### The final form must match every chosen value before consequential review

Populate and re-find actual semantic controls through the execution policy, then read them back. If a fee or other value differs, return to a choice or explain the mismatch; a stale or mismatched callback cannot advance. No payment is submitted by this preparation step.

```quint
pure def canVerifyForm(b: BillPreparation, formReport: T::ReviewReport, by: T::TaskActor): bool =
  b.phase == PreparePayment and b.live and formReport.key == b.key and formReport.proposal == T::PayTerms({ pay: b.choice }) and formReport.evidence != "" and
  formReport.revision == b.version and by == T::Host
pure def verifyForm(b: BillPreparation, formReport: T::ReviewReport, by: T::TaskActor): BillPreparation =
  { ...b, phase: ReadyForReview, evidence: formReport.evidence }
pure def canHandOff(b: BillPreparation, by: T::TaskActor): bool = b.phase == ReadyForReview and b.live and by == T::Actuator
pure def handOff(b: BillPreparation, by: T::TaskActor): BillResult = {
  state: { ...b, phase: HandedOff },
  out: List(ReviewPayment({ key: b.key, proposal: b.choice, evidence: b.evidence, version: b.version }))
}
pure def stepOnlyVerifiedReview(before: BillPreparation, after: BillPreparation, out: List[BillEffect]): bool =
  out.length() > 0 implies before.phase == ReadyForReview and before.live and after.phase == HandedOff
pure def sometimesReviewReady(b: BillPreparation): bool = b.phase == ReadyForReview
pure def sometimesReviewHandedOff(b: BillPreparation): bool = b.phase == HandedOff
```

### A choice the person makes on the page itself becomes the choice to check

The person may pick an amount or type a date on the website instead of saying it (prototype/Grace Prototype.html:1038, 1683). The trusted host reports what the form now holds for this bill and the current preparation version, and whether the change came from the person's own taps or typing on the page, as the prototype tells her own input apart from Grace's (prototype/Grace Prototype.html:1038, 1683). Only a change the host attributes to the person can become the choice: Grace's own fill, a value the website prefilled or selected by default, and a value the website changed by itself never replace the choice the person made. A valid proposal from the person's own change that differs from the current choice, in the bill's currency and with one of its funding methods, becomes the choice. The preparation goes back to preparing the form under a new version, whether or not the earlier form had been verified, so the review never goes ahead with the old choice: only a form that matches the new choice can be verified for review. Any other difference leaves the form unverifiable until it matches the choice or the preparation is blocked. Because the person filled the values herself, Grace does not offer to fill them again.

```quint
pure def canAdoptFormChoice(b: BillPreparation, formReport: T::ReviewReport, personEdited: bool, by: T::TaskActor): bool =
  (b.phase == PreparePayment or b.phase == ReadyForReview) and b.live and personEdited and formReport.key == b.key and
  formReport.proposal != T::PayTerms({ pay: b.choice }) and T::validTerms(T::BillPay, formReport.proposal) and
  payOf(formReport.proposal).currency == b.facts.currency and b.facts.funding.includes(payOf(formReport.proposal).funding) and
  formReport.evidence != "" and formReport.revision == b.version and by == T::Host
pure def adoptFormChoice(b: BillPreparation, formReport: T::ReviewReport, personEdited: bool, by: T::TaskActor): BillPreparation =
  { ...b, choice: payOf(formReport.proposal), phase: PreparePayment, fillBy: PersonFills, version: b.version + 1 }
pure def lawPageChoiceIsCheckedAgain(b: BillPreparation, formReport: T::ReviewReport, personEdited: bool, by: T::TaskActor): bool =
  canAdoptFormChoice(b, formReport, personEdited, by) implies
    adoptFormChoice(b, formReport, personEdited, by).phase == PreparePayment and
    T::PayTerms({ pay: adoptFormChoice(b, formReport, personEdited, by).choice }) == formReport.proposal and
    adoptFormChoice(b, formReport, personEdited, by).choice != b.choice and
    adoptFormChoice(b, formReport, personEdited, by).version > b.version
pure def lawOnlyThePersonsEditReplacesTheChoice(b: BillPreparation, formReport: T::ReviewReport, by: T::TaskActor): bool =
  not(canAdoptFormChoice(b, formReport, false, by))
```

### Pausing or changed context discards a prepared form but keeps the selected bill

After explicit Resume, recheck sign-in, account, current bill and possible existing payment. Never replay a saved click or assume an old form survived. The payment ledger independently retains any possible submission, including after this preparation has handed off. A new preparation never resets that ledger.

```quint
pure def canPause(b: BillPreparation, by: T::TaskActor): bool = b.phase != NoBill and b.live and (by == T::Person or by == T::Host)
pure def pause(b: BillPreparation, by: T::TaskActor): BillPreparation =
  { ...b, live: false, version: b.version + 1 }
pure def canResume(b: BillPreparation, by: T::TaskActor): bool = b.phase != NoBill and not(b.live) and by == T::Person
pure def resume(b: BillPreparation, by: T::TaskActor): BillPreparation =
  { ...b, live: true, phase: NeedsLogin, facts: noFacts, factsConfirmed: false, choice: noChoice, fillBy: NotAsked, reason: "", version: b.version + 1 }
pure def canBlock(b: BillPreparation, reason: str, expectedVersion: int, by: T::TaskActor): bool =
  b.phase != NoBill and b.phase != HandedOff and reason != "" and expectedVersion == b.version and by == T::Host
pure def block(b: BillPreparation, reason: str, expectedVersion: int, by: T::TaskActor): BillPreparation =
  { ...b, phase: BillBlocked, reason: reason, fillBy: NotAsked, version: b.version + 1 }
pure def alwaysBlockExplained(b: BillPreparation): bool = b.phase == BillBlocked implies b.reason != ""
pure def stepBillIdentityPersists(before: BillPreparation, after: BillPreparation): bool = before.phase != NoBill implies after.key == before.key
pure def sometimesBlocked(b: BillPreparation): bool = b.phase == BillBlocked
pure def sometimesPaused(b: BillPreparation): bool = b.phase != NoBill and not(b.live)
```

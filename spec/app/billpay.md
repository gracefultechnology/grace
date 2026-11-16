# Prepare a bill payment on any supported website

The semantic journey is goal → verified destination and account → current bill → chosen amount/date/method → verified form → consequential review. These are facts to establish, not a fixed list of pages or clicks. A website may combine or repeat them. [Execution](./execution.md) discovers current controls and [payment](./payment.md) owns authorization and durable outcomes. This preparation model cannot submit money.

Sources: new prototype's sign-in, account, payment, review and outcome views; PRD JOURNEY 01–09, HELP 01–12 and U01–12. Demo values, account suffixes, website names, synthetic credentials and synthetic success are not requirements. The same contract accepts any origin for which the integration can establish the required evidence; unsupported sites stop truthfully.

## Story: Understand the bill before deciding how to pay

> As a person opening a bill from Email, Calendar or a request to Grace, I want the current website facts explained and the right account checked before I decide on a payment.

### A bill preparation holds evidence and choices separately

Unknown balances and fees are represented explicitly rather than treated as zero. Credit balances may be negative; an observed fee is nonnegative. The provider's bill identity is independent of the calendar entry used to open it. No balance is interpreted as proof of affordability or available bank funds. Each trusted access, fact or form report carries its identity and revision together; representative report samples include accepted, stale and invalid evidence without imposing a runtime bound.

```quint
import payment as P from "./payment"
type BillPhase = NoBill | NeedsLogin | ReadBill | ChoosePayment | PreparePayment | ReadyForReview | HandedOff | NoPaymentDue | ConflictingPayment | BillBlocked
type Access = SignedOut | Challenge | SignedIn | WrongAccount | AccessDenied
type FillBy = NotAsked | GraceFills | PersonFills
type Balance = { known: bool, amount: int }
type BillFacts = {
  statement: Balance, minimum: Balance, current: Balance, fee: Balance,
  dueDay: int, currency: str, scheduled: bool, nothingDue: bool, paymentAllowed: bool, funding: List[str]
}
type AccessReport = { key: P::BillKey, version: int, access: Access }
type FactReport = { key: P::BillKey, facts: BillFacts, evidence: str, version: int }
type BillPreparation = {
  key: P::BillKey, phase: BillPhase, facts: BillFacts,
  choice: P::Proposal, fillBy: FillBy, evidence: str, version: int, live: bool, reason: str
}
type BillEffect = ReviewPayment({ key: P::BillKey, proposal: P::Proposal, evidence: str, version: int })
type BillResult = { state: BillPreparation, out: List[BillEffect] }
pure val noFacts: BillFacts = {
  statement: { known: false, amount: 0 }, minimum: { known: false, amount: 0 },
  current: { known: false, amount: 0 }, fee: { known: false, amount: 0 }, dueDay: 0, currency: "", scheduled: false, nothingDue: false,
  paymentAllowed: false, funding: List()
}
pure val initial: BillPreparation = {
  key: P::emptyKey, phase: NoBill, facts: noFacts, choice: P::emptyProposal, fillBy: NotAsked,
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
  { key: P::exampleKey, version: 1, access: SignedIn },
  { key: P::exampleKey, version: 1, access: SignedOut },
  { key: P::exampleKey, version: 1, access: Challenge },
  { key: P::exampleKey, version: 1, access: WrongAccount },
  { key: P::exampleKey, version: 1, access: AccessDenied },
  { key: P::exampleKey, version: 2, access: SignedIn },
  { key: P::exampleKey, version: 3, access: SignedIn },
  { key: P::exampleKey, version: 4, access: SignedIn },
  { key: P::exampleKey, version: 5, access: SignedIn },
  { key: P::emptyKey, version: 1, access: SignedIn })
pure val factReportValues = factsValues.map(f => { key: P::exampleKey, facts: f, evidence: "source", version: 2 })
  .union(factsValues.map(f => { key: P::exampleKey, facts: f, evidence: "source", version: 3 }))
  .union(Set({ key: P::emptyKey, facts: noFacts, evidence: "", version: 2 }))
pure val formReportValues = P::reviewReportValues.union(Set(4, 5).map(v => { ...P::exampleReview, proposal: { ...P::exampleProposal, amount: 3500 }, revision: v }))
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
pure def canBegin(b: BillPreparation, key: P::BillKey, evidence: str, by: P::PaymentActor): bool =
  b.phase == NoBill and P::validKey(key) and evidence != "" and by == P::Person
pure def begin(b: BillPreparation, key: P::BillKey, evidence: str, by: P::PaymentActor): BillPreparation =
  { ...b, key: key, phase: NeedsLogin, evidence: evidence, version: b.version + 1 }
pure def canInspectAccess(b: BillPreparation, accessReport: AccessReport, by: P::PaymentActor): bool =
  b.phase != NoBill and b.phase != HandedOff and b.live and accessReport.key == b.key and accessReport.version == b.version and by == P::BrowserHost
pure def inspectAccess(b: BillPreparation, accessReport: AccessReport, by: P::PaymentActor): BillPreparation = {
  ...b, phase: if (accessReport.access == SignedIn) ReadBill else if (accessReport.access == SignedOut or accessReport.access == Challenge) NeedsLogin else BillBlocked,
  reason: if (accessReport.access == WrongAccount) "The account does not match" else if (accessReport.access == AccessDenied) "Sign-in is unavailable" else "",
  choice: P::emptyProposal, fillBy: NotAsked, facts: noFacts, version: b.version + 1
}
pure def alwaysBoundBill(b: BillPreparation): bool = b.phase == NoBill or P::validKey(b.key)
pure def alwaysVersion(b: BillPreparation): bool = b.version >= 0
pure def sometimesPrivateSignIn(b: BillPreparation): bool = b.phase == NeedsLogin
```

### Current bill facts distinguish payment choices, no payment due and an existing payment

Statement balance, minimum due, current balance, fees, due date and existing payment status are shown only when observed for this exact bill key and current preparation revision; a callback for another bill cannot populate its facts. A scheduled/pending existing payment is investigated before a new proposal. No payment due requires the provider's explicit status; a zero or negative balance alone does not establish it. A positive statement balance or new current charges can coexist with no payment due, but a positive minimum due contradicts that status and requires reobservation or an explained block. Missing or unsupported payment methods produce an honest block. The person can ask about any fact without changing the choice.

```quint
pure def canReadFacts(b: BillPreparation, factReport: FactReport, by: P::PaymentActor): bool =
  (b.phase == ReadBill or b.phase == ConflictingPayment or b.phase == NoPaymentDue) and b.live and factReport.key == b.key and validFacts(factReport.facts) and
  factReport.evidence != "" and factReport.version == b.version and by == P::BrowserHost
pure def lawDifferentBillFactsAreRejected(b: BillPreparation, factReport: FactReport, by: P::PaymentActor): bool =
  factReport.key != b.key implies not(canReadFacts(b, factReport, by))
pure def readFacts(b: BillPreparation, factReport: FactReport, by: P::PaymentActor): BillPreparation = {
  ...b, facts: factReport.facts, evidence: factReport.evidence, version: b.version + 1,
  phase: if (factReport.facts.scheduled) ConflictingPayment else if (factReport.facts.nothingDue) NoPaymentDue
    else if (not(factReport.facts.paymentAllowed) or factReport.facts.funding.length() == 0) BillBlocked else ChoosePayment,
  reason: if (not(factReport.facts.scheduled) and not(factReport.facts.nothingDue) and not(factReport.facts.paymentAllowed)) "Online payment is unavailable"
    else if (not(factReport.facts.scheduled) and not(factReport.facts.nothingDue) and factReport.facts.funding.length() == 0) "No supported funding method is available" else ""
}
pure def defaultAvailable(b: BillPreparation, today: int): bool =
  b.phase == ChoosePayment and b.live and b.facts.statement.known and b.facts.statement.amount > 0 and
  b.facts.fee.known and b.facts.fee.amount >= 0 and today > 0 and b.facts.funding.length() == 1
pure def suggestedPayment(b: BillPreparation, today: int): P::Proposal = if (defaultAvailable(b, today)) {
  amount: b.facts.statement.amount, fee: b.facts.fee.amount, currency: b.facts.currency,
  day: today, funding: b.facts.funding.nthOr(0, "")
} else P::emptyProposal
pure def alwaysObservedFeeIsNonnegative(b: BillPreparation): bool = b.facts.fee.known implies b.facts.fee.amount >= 0
pure def alwaysNoDueIsConsistent(b: BillPreparation): bool = b.facts.nothingDue implies not(b.facts.minimum.known and b.facts.minimum.amount > 0)
pure def sometimesNoPaymentDue(b: BillPreparation): bool = b.phase == NoPaymentDue
pure def sometimesExistingPaymentIsInvestigated(b: BillPreparation): bool = b.phase == ConflictingPayment
pure def sometimesFeeStillNeedsObservation(b: BillPreparation): bool = b.phase == ChoosePayment and not(b.facts.fee.known)
```

### The person checks the bill facts before any payment question, and saying they look wrong reads them again

Grace states the bill and asks "Does that look right to you?" with the answers "Yes, that's right" and "That doesn't look right", and asks about paying only in the next turn (prototype/Grace Prototype.html:1512, 1516). This follows the prototype rather than the single combined proposal question of PRD JOURNEY 06-07 (prototype/prd.md:1879-1880). Choosing a payment is the person's yes. When the person says the facts look wrong, Grace slows down, asks what seems different and says that nothing has been paid: the shown facts and any choice are discarded, the preparation version advances so that a report about the disputed reading cannot return, and no choice can be made until the facts are read again for the new version. Disputing never prepares, fills or hands off a payment.

```quint
pure def canDisputeFacts(b: BillPreparation, by: P::PaymentActor): bool =
  (b.phase == ChoosePayment or b.phase == NoPaymentDue or b.phase == ConflictingPayment) and b.live and by == P::Person
pure def disputeFacts(b: BillPreparation, by: P::PaymentActor): BillPreparation =
  { ...b, phase: ReadBill, facts: noFacts, choice: P::emptyProposal, fillBy: NotAsked, reason: "", version: b.version + 1 }
pure def lawDisputingFactsPaysNothing(b: BillPreparation, by: P::PaymentActor): bool =
  canDisputeFacts(b, by) implies
    disputeFacts(b, by).phase == ReadBill and disputeFacts(b, by).key == b.key and
    disputeFacts(b, by).choice == P::emptyProposal and disputeFacts(b, by).fillBy == NotAsked and
    disputeFacts(b, by).version > b.version and not(canChoose(disputeFacts(b, by), b.choice, by))
```

### Choosing an amount, date and funding method is separate from approving submission

The default is one understandable proposal only when its facts, including the fee, are observed; it is never silently selected. An unknown fee does not mean free. Otherwise ask one missing choice at a time. Any supported amount, date and existing funding method may be selected, not only the prototype's two radio choices. Relative or ambiguous dates must be resolved by the person before an exact day enters this model. Fees are part of the proposal and must be reviewed against the final form because they may depend on the chosen date or funding method.

```quint
pure def canChoose(b: BillPreparation, proposal: P::Proposal, by: P::PaymentActor): bool =
  (b.phase == ChoosePayment or b.phase == PreparePayment or b.phase == ReadyForReview) and b.live and
  not(b.facts.scheduled) and b.facts.paymentAllowed and P::validProposal(proposal) and
  proposal.currency == b.facts.currency and b.facts.funding.includes(proposal.funding) and by == P::Person
pure def choose(b: BillPreparation, proposal: P::Proposal, by: P::PaymentActor): BillPreparation =
  { ...b, choice: proposal, phase: PreparePayment, fillBy: NotAsked, version: b.version + 1 }
pure def alwaysChoiceMatchesBill(b: BillPreparation): bool =
  (b.phase == PreparePayment or b.phase == ReadyForReview or b.phase == HandedOff) implies
    P::validProposal(b.choice) and b.choice.currency == b.facts.currency and b.facts.funding.includes(b.choice.funding) and
    b.facts.paymentAllowed and not(b.facts.scheduled)
```

### Grace fills the payment form only after the person says yes to filling it

Grace may type only values the person already chose, the amount and the payment date, and only after a yes to a specific offer: "Shall I fill in $84.20 and today's date for you?" with the answers "Yes, fill it in" and "No, I'll do it" (prototype/Grace Prototype.html:1503, 1513). The fill itself runs only from that answer (prototype/Grace Prototype.html:1635). Every new choice asks again. After "No, I'll do it", Grace points and waits while the person types, and the form is checked as it is read back. The person may change the answer while the form is being prepared. The owner that dispatches website operations allows Grace's fill of a payment form only while `graceMayFill` holds.

```quint
pure def canDecideFill(b: BillPreparation, fillBy: FillBy, by: P::PaymentActor): bool =
  b.phase == PreparePayment and b.live and fillBy != NotAsked and by == P::Person
pure def decideFill(b: BillPreparation, fillBy: FillBy, by: P::PaymentActor): BillPreparation = { ...b, fillBy: fillBy }
pure def graceMayFill(b: BillPreparation): bool = b.phase == PreparePayment and b.live and b.fillBy == GraceFills
pure def alwaysFillAnswerBelongsToAChoice(b: BillPreparation): bool =
  b.fillBy != NotAsked implies (b.phase == PreparePayment or b.phase == ReadyForReview or b.phase == HandedOff)
pure def stepGraceFillsOnlyAfterTheirYes(before: BillPreparation, via: str, after: BillPreparation): bool =
  (after.fillBy == GraceFills and before.fillBy != GraceFills) implies via == "decideFill"
pure def sometimesGraceFills(b: BillPreparation): bool = graceMayFill(b)
pure def sometimesPersonFills(b: BillPreparation): bool = b.phase == PreparePayment and b.fillBy == PersonFills
```

## Story: Correct the website form and review consequences

> As a person paying a bill, I want Grace to check what the website actually contains, accept corrections and stop if it cannot verify the right payment.

### The final form must match every chosen value before consequential review

Populate and re-find actual semantic controls through the execution policy, then read them back. If a fee or other value differs, return to a choice or explain the mismatch; a stale or mismatched callback cannot advance. No payment is submitted by this preparation step.

```quint
pure def canVerifyForm(b: BillPreparation, formReport: P::ReviewReport, by: P::PaymentActor): bool =
  b.phase == PreparePayment and b.live and formReport.key == b.key and formReport.proposal == b.choice and formReport.evidence != "" and
  formReport.revision == b.version and by == P::BrowserHost
pure def verifyForm(b: BillPreparation, formReport: P::ReviewReport, by: P::PaymentActor): BillPreparation =
  { ...b, phase: ReadyForReview, evidence: formReport.evidence }
pure def canHandOff(b: BillPreparation, by: P::PaymentActor): bool = b.phase == ReadyForReview and b.live and by == P::Executor
pure def handOff(b: BillPreparation, by: P::PaymentActor): BillResult = {
  state: { ...b, phase: HandedOff },
  out: List(ReviewPayment({ key: b.key, proposal: b.choice, evidence: b.evidence, version: b.version }))
}
pure def stepOnlyVerifiedReview(before: BillPreparation, after: BillPreparation, out: List[BillEffect]): bool =
  out.length() > 0 implies before.phase == ReadyForReview and before.live and after.phase == HandedOff
pure def sometimesReviewReady(b: BillPreparation): bool = b.phase == ReadyForReview
pure def sometimesReviewHandedOff(b: BillPreparation): bool = b.phase == HandedOff
```

### A choice the person makes on the page itself becomes the choice to check

The person may pick an amount or type a date on the website instead of saying it (prototype/Grace Prototype.html:1038, 1683). The trusted host reports what the form now holds for this bill and the current preparation version. A valid proposal that differs from the current choice, in the bill's currency and with one of its funding methods, becomes the choice. The preparation goes back to preparing the form under a new version, whether or not the earlier form had been verified, so the review never goes ahead with the old choice. The values are already on the page, so the person filled them herself and Grace does not offer to fill them again.

```quint
pure def canAdoptFormChoice(b: BillPreparation, formReport: P::ReviewReport, by: P::PaymentActor): bool =
  (b.phase == PreparePayment or b.phase == ReadyForReview) and b.live and formReport.key == b.key and
  formReport.proposal != b.choice and P::validProposal(formReport.proposal) and
  formReport.proposal.currency == b.facts.currency and b.facts.funding.includes(formReport.proposal.funding) and
  formReport.evidence != "" and formReport.revision == b.version and by == P::BrowserHost
pure def adoptFormChoice(b: BillPreparation, formReport: P::ReviewReport, by: P::PaymentActor): BillPreparation =
  { ...b, choice: formReport.proposal, phase: PreparePayment, fillBy: PersonFills, version: b.version + 1 }
pure def lawPageChoiceIsCheckedAgain(b: BillPreparation, formReport: P::ReviewReport, by: P::PaymentActor): bool =
  canAdoptFormChoice(b, formReport, by) implies
    adoptFormChoice(b, formReport, by).phase == PreparePayment and
    adoptFormChoice(b, formReport, by).choice == formReport.proposal and
    adoptFormChoice(b, formReport, by).version > b.version
```

### Pausing or changed context discards a prepared form but keeps the selected bill

After explicit Resume, recheck sign-in, account, current bill and possible existing payment. Never replay a saved click or assume an old form survived. The payment ledger independently retains any possible submission, including after this preparation has handed off. A new preparation never resets that ledger.

```quint
pure def canPause(b: BillPreparation, by: P::PaymentActor): bool = b.phase != NoBill and b.live and (by == P::Person or by == P::BrowserHost)
pure def pause(b: BillPreparation, by: P::PaymentActor): BillPreparation =
  { ...b, live: false, version: b.version + 1 }
pure def canResume(b: BillPreparation, by: P::PaymentActor): bool = b.phase != NoBill and not(b.live) and by == P::Person
pure def resume(b: BillPreparation, by: P::PaymentActor): BillPreparation =
  { ...b, live: true, phase: NeedsLogin, facts: noFacts, choice: P::emptyProposal, fillBy: NotAsked, reason: "", version: b.version + 1 }
pure def canBlock(b: BillPreparation, reason: str, expectedVersion: int, by: P::PaymentActor): bool =
  b.phase != NoBill and b.phase != HandedOff and reason != "" and expectedVersion == b.version and by == P::BrowserHost
pure def block(b: BillPreparation, reason: str, expectedVersion: int, by: P::PaymentActor): BillPreparation =
  { ...b, phase: BillBlocked, reason: reason, fillBy: NotAsked, version: b.version + 1 }
pure def alwaysBlockExplained(b: BillPreparation): bool = b.phase == BillBlocked implies b.reason != ""
pure def stepBillIdentityPersists(before: BillPreparation, after: BillPreparation): bool = before.phase != NoBill implies after.key == before.key
pure def sometimesBlocked(b: BillPreparation): bool = b.phase == BillBlocked
pure def sometimesPaused(b: BillPreparation): bool = b.phase != NoBill and not(b.live)
```

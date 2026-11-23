# Prepare a bill payment on any supported website

The semantic journey is goal → verified destination and account → current bill → chosen amount/date/method → verified form → consequential review. These are facts to establish, not a fixed list of pages or clicks. A website may combine or repeat them. [Execution](./execution.md) discovers current controls and [payment](./commitment.md) owns authorization and durable outcomes. This preparation model cannot submit money. It never reads a bill's own fields: what it holds is one [kind's](./taskKinds.md) reading and the task's terms, and the [bill kind](./billKind.md) judges them. Booking a visit is prepared by the same steps, its reading and terms judged by the [booking kind](./bookingKind.md).

Sources: new prototype's sign-in, account, payment, review and outcome views; PRD JOURNEY 01–09, HELP 01–12 and U01–12. Demo values, account suffixes, website names, synthetic credentials and synthetic success are not requirements. The same contract accepts any origin for which the integration can establish the required evidence; unsupported sites stop truthfully.

## Story: Understand the bill before deciding how to pay

> As a person opening a bill from Email, Calendar or a request to Grace, I want the current website facts explained and the right account checked before I decide on a payment.

### A bill preparation holds evidence and choices separately

The facts are a reading of one kind of task, here the [bill kind's](./billKind.md), or nothing read yet; the choice is the task's terms, here a payment, or none yet. Unknown balances and fees are represented explicitly rather than treated as zero. The provider's bill identity is independent of the calendar entry used to open it. No balance is interpreted as proof of affordability or available bank funds. Each trusted access, fact or form report carries its identity and revision together; representative report samples include accepted, stale and invalid evidence, for a bill and for a visit, and a visit's subject with a bill's facts, without imposing a runtime bound.

```quint
import task as T from "./task"
import billKind as BK from "./billKind"
import bookingKind as VK from "./bookingKind"
import taskKinds as K from "./taskKinds"
type PrepPhase = NoTask | NeedsAccess | ReadingFacts | Choosing | Preparing | ReadyForReview | HandedOff | NothingNeeded | AlreadyUnderWay | Blocked
type Access = SignedOut | Challenge | SignedIn | WrongAccount | AccessDenied
type FillBy = NotAsked | GraceFills | PersonFills
type AccessReport = { key: T::Subject, version: int, access: Access }
type FactReport = { key: T::Subject, facts: K::Facts, evidence: str, version: int }
type Prep = {
  key: T::Subject, phase: PrepPhase, facts: K::Facts,
  factsConfirmed: bool, choice: T::Terms, fillBy: FillBy, evidence: str, version: int, live: bool, reason: str
}
type PrepEffect = Review({ key: T::Subject, proposal: T::Terms, evidence: str, version: int })
type PrepResult = { state: Prep, out: List[PrepEffect] }
pure val initial: Prep = {
  key: T::emptyKey, phase: NoTask, facts: K::NoFacts, factsConfirmed: false, choice: T::NoTerms, fillBy: NotAsked,
  evidence: "", version: 0, live: true, reason: ""
}
pure val keyValues = Set(
  K::sampleBillKey, { ...K::sampleBillKey, origin: "https://credit.example" },
  K::sampleVisitKey, T::emptyKey)
pure val accessReportValues = {
  val begun = begin(initial, K::sampleBillKey, "source", T::Person)
  val later = Set(1, 2, 3, 4).map(n => { key: begun.key, version: begun.version + n, access: SignedIn })
  Set(SignedIn, SignedOut, Challenge, WrongAccount, AccessDenied).map(a => { key: begun.key, version: begun.version, access: a })
    .union(later).union(Set({ key: T::emptyKey, version: begun.version, access: SignedIn }))
    .union(Set({ key: K::sampleVisitKey, version: begun.version, access: SignedIn }))
}
pure val factReportValues = {
  val begun = begin(initial, K::sampleBillKey, "source", T::Person)
  val signed = inspectAccess(begun, { key: begun.key, version: begun.version, access: SignedIn }, T::Host)
  val billFacts = K::factsValues.filter(f => match f { | VisitRead(x) => false | _ => true })
  val visitFacts = K::factsValues.filter(f => match f { | VisitRead(x) => true | _ => false })
  billFacts.map(f => { key: signed.key, facts: f, evidence: "source", version: signed.version })
    .union(billFacts.map(f => { key: signed.key, facts: f, evidence: "source", version: signed.version + 1 }))
    .union(visitFacts.union(Set(K::sampleBillFacts)).map(f => { key: K::sampleVisitKey, facts: f, evidence: "source", version: signed.version }))
    .union(Set({ key: T::emptyKey, facts: K::NoFacts, evidence: "", version: signed.version }))
}
pure val formReportValues = {
  val begun = begin(initial, K::sampleBillKey, "source", T::Person)
  val signed = inspectAccess(begun, { key: begun.key, version: begun.version, access: SignedIn }, T::Host)
  val read = readFacts(signed, { key: signed.key, facts: K::sampleBillFacts, evidence: "source", version: signed.version }, T::Host)
  val chosen = choose(confirmFacts(read, T::Person), K::samplePayTerms, T::Person)
  val form = { key: chosen.key, proposal: chosen.choice, revision: chosen.version, evidence: "source" }
  val edited = { ...form, proposal: T::PayTerms({ pay: { amount: 3500, fee: 0, currency: "USD", day: 1, funding: "bank-ref" } }) }
  Set(-4, -3, -2, -1, 0, 1).map(n => { ...form, revision: chosen.version + n })
    .union(Set(0, 1).map(n => { ...edited, revision: chosen.version + n }))
    .union(Set({ ...form, key: { ...form.key, origin: "https://credit.example" } }, { ...form, evidence: "" }, { ...form, proposal: T::NoTerms }))
    .union(T::bookValues.map(b => { ...form, proposal: T::BookTerms({ book: b }) }))
    .union(Set(K::sampleBookTerms, K::sampleClashTerms).map(terms =>
      Set(0, 1).map(n => { key: K::sampleVisitKey, proposal: terms, revision: chosen.version + n, evidence: "portal" })).flatten())
}
pure val termsValues = Set(K::samplePayTerms, T::NoTerms,
  T::PayTerms({ pay: { amount: 3500, fee: 25, currency: "USD", day: 2, funding: "other-bank" } }))
  .union(Set(K::sampleBookTerms, K::sampleClashTerms))
pure val expectedVersionValues = Set(0, 1, 2, 3, 4, 5, 6)
pure val reasonValues = Set("unsupported", "expired", "")
pure val weight_begin = 3
pure val weight_inspectAccess = 3
pure val weight_readFacts = 3
pure val weight_confirmFacts = 3
pure val weight_choose = 3
pure val weight_decideFill = 3
pure val weight_verifyForm = 3
pure val weight_handOff = 3
pure val weight_retire = 3
```

### Opening a selected bill requests private sign-in without assuming account access

The source link is evidence of the requested bill, not authority for website actions. The trusted bridge verifies the official origin and actual authenticated account. Passwords and codes are entered privately on the site; wrong credentials, CAPTCHA, unavailable verification and session expiry are explained rather than bypassed. A push approval waits for the resulting browser state; Grace never controls the phone.

```quint
pure def canBegin(b: Prep, key: T::Subject, evidence: str, by: T::TaskActor): bool =
  b.phase == NoTask and T::validKey(key) and evidence != "" and by == T::Person
pure def begin(b: Prep, key: T::Subject, evidence: str, by: T::TaskActor): Prep =
  { ...initial, key: key, phase: NeedsAccess, evidence: evidence, version: b.version + 1 }
pure def canInspectAccess(b: Prep, accessReport: AccessReport, by: T::TaskActor): bool =
  b.phase != NoTask and b.phase != HandedOff and b.live and accessReport.key == b.key and accessReport.version == b.version and by == T::Host
pure def inspectAccess(b: Prep, accessReport: AccessReport, by: T::TaskActor): Prep = {
  ...b, phase: if (accessReport.access == SignedIn) ReadingFacts else if (accessReport.access == SignedOut or accessReport.access == Challenge) NeedsAccess else Blocked,
  reason: if (accessReport.access == WrongAccount) "The account does not match" else if (accessReport.access == AccessDenied) "Sign-in is unavailable" else "",
  choice: T::NoTerms, fillBy: NotAsked, facts: K::NoFacts, factsConfirmed: false, version: b.version + 1
}
pure def alwaysBoundSubject(b: Prep): bool = b.phase == NoTask or T::validKey(b.key)
pure def alwaysVersion(b: Prep): bool = b.version >= 0
pure def sometimesPrivateSignIn(b: Prep): bool = b.phase == NeedsAccess
```

### Private sign-in never supplies payment consent

While sign-in is required, the bill preparation has no bill facts, confirmed amount, selected payment or permission to fill a payment form. Selecting a saved login in Passwords leaves the preparation at this step until the trusted account-access report arrives. The BillWorld login exercise checks the corresponding site behavior by verifying that opening the account leaves its payment history and funding unchanged.

```quint
pure def alwaysPrivateLoginHasNoPaymentAuthority(b: Prep): bool =
  b.phase == NeedsAccess implies
    (not(b.factsConfirmed) and b.fillBy == NotAsked and not(T::hasTerms(b.choice)) and b.facts == initial.facts)
```

### Current bill facts distinguish payment choices, no payment due and an existing payment

Statement balance, minimum due, current balance, fees, due date and existing payment status are shown only when observed for this exact bill key and current preparation revision; a callback for another bill cannot populate its facts. A scheduled/pending existing payment is investigated before a new proposal. No payment due requires the provider's explicit status; a zero or negative balance alone does not establish it. A positive statement balance or new current charges can coexist with no payment due, but a positive minimum due contradicts that status and requires reobservation or an explained block. Missing or unsupported payment methods produce an honest block, with the bill kind's reason. The person can ask about any fact without changing the choice. Facts read for another kind of task are refused, and the facts held are always nothing yet or whole facts of the task's own kind: for a bill, in a currency, with no negative observed fee and no positive minimum due beside no payment due. The suggested payment, when there is one, is the registry's suggestion for the current facts while the payment is being chosen.

```quint
pure def canReadFacts(b: Prep, factReport: FactReport, by: T::TaskActor): bool =
  (b.phase == ReadingFacts or b.phase == AlreadyUnderWay or b.phase == NothingNeeded) and b.live and factReport.key == b.key and
  K::factsFit(b.key.kind, factReport.facts) and factReport.evidence != "" and factReport.version == b.version and by == T::Host
pure def lawOtherSubjectsFactsAreRejected(b: Prep, factReport: FactReport, by: T::TaskActor): bool =
  factReport.key != b.key implies not(canReadFacts(b, factReport, by))
pure def lawFactsOfAnotherKindAreRejected(b: Prep, factReport: FactReport, by: T::TaskActor): bool =
  not(K::factsFit(b.key.kind, factReport.facts)) implies not(canReadFacts(b, factReport, by))
pure def readFacts(b: Prep, factReport: FactReport, by: T::TaskActor): Prep =
  val found = K::standing(factReport.facts)
  { ...b, facts: factReport.facts, factsConfirmed: false, evidence: factReport.evidence, version: b.version + 1,
    phase: if (found == K::AlreadyUnderWay) AlreadyUnderWay else if (found == K::NothingToDo) NothingNeeded
      else if (found == K::Unavailable) Blocked else Choosing,
    reason: if (found == K::Unavailable) K::whyUnavailable(factReport.facts) else "" }
pure def suggested(b: Prep, today: int): T::Terms =
  if (b.phase == Choosing and b.live) K::suggestion(b.facts, today) else T::NoTerms
pure def alwaysFactsFitTheKind(b: Prep): bool = b.facts == initial.facts or K::factsFit(b.key.kind, b.facts)
pure def sometimesNothingNeeded(b: Prep): bool = b.phase == NothingNeeded
pure def sometimesExistingIsInvestigated(b: Prep): bool = b.phase == AlreadyUnderWay
pure def sometimesCostStillNeedsObservation(b: Prep): bool = b.phase == Choosing and K::costUnobserved(b.facts)
```

### The person checks the bill facts before any payment question, and saying they look wrong reads them again

Grace states the bill and asks "Does that look right to you?" with the answers "Yes, that's right" and "That doesn't look right", and asks about paying only in the next turn (prototype/Grace Prototype.html:1512, 1516). This follows the prototype rather than the single combined proposal question of PRD JOURNEY 06-07 (prototype/prd.md:1879-1880). "Yes, that's right" is its own answer, recorded before any choice: no amount, date or funding method is accepted for the bill until the person has confirmed the facts read for the current version, and every new reading of the facts needs a new yes. When the person says the facts look wrong, Grace slows down, asks what seems different and says that nothing has been paid: the shown facts and any choice are discarded, the preparation version advances so that a report about the disputed reading cannot return, and no choice can be made until the facts are read again for the new version. Disputing never prepares, fills or hands off a payment.

```quint
pure def canConfirmFacts(b: Prep, by: T::TaskActor): bool =
  b.phase == Choosing and b.live and not(b.factsConfirmed) and by == T::Person
pure def confirmFacts(b: Prep, by: T::TaskActor): Prep = { ...b, factsConfirmed: true }
pure def alwaysChoiceFollowsConfirmedFacts(b: Prep): bool =
  (b.phase == Preparing or b.phase == ReadyForReview or b.phase == HandedOff) implies b.factsConfirmed
pure def canDisputeFacts(b: Prep, by: T::TaskActor): bool =
  (b.phase == Choosing or b.phase == NothingNeeded or b.phase == AlreadyUnderWay) and b.live and by == T::Person
pure def disputeFacts(b: Prep, by: T::TaskActor): Prep =
  { ...b, phase: ReadingFacts, facts: K::NoFacts, factsConfirmed: false, choice: T::NoTerms, fillBy: NotAsked, reason: "", version: b.version + 1 }
pure def lawDisputingFactsCommitsNothing(b: Prep, by: T::TaskActor): bool =
  canDisputeFacts(b, by) implies
    disputeFacts(b, by).phase == ReadingFacts and disputeFacts(b, by).key == b.key and
    not(T::hasTerms(disputeFacts(b, by).choice)) and disputeFacts(b, by).fillBy == NotAsked and
    disputeFacts(b, by).version > b.version and not(canChoose(disputeFacts(b, by), b.choice, by))
```

### Choosing an amount, date and funding method is separate from approving submission

The default is one understandable proposal only when its facts, including the fee, are observed; it is never silently selected. An unknown fee does not mean free. Otherwise ask one missing choice at a time. Any supported amount, date and existing funding method may be selected, not only the prototype's two radio choices. Relative or ambiguous dates must be resolved by the person before an exact day enters this model. Fees are part of the proposal and must be reviewed against the final form because they may depend on the chosen date or funding method. A choice is valid terms for the task's kind that fit the current facts, and once chosen it keeps fitting them through the form and the review; for a bill that is a valid proposal in the bill's currency, from one of its funding methods, while online payment is allowed and nothing is scheduled or settled. For a visit it is one of the offered times; a time that clashes with her calendar can be chosen when she says the clash is fine.

```quint
pure def canChoose(b: Prep, terms: T::Terms, by: T::TaskActor): bool =
  (b.phase == Choosing or b.phase == Preparing or b.phase == ReadyForReview) and b.live and b.factsConfirmed and
  T::validTerms(b.key.kind, terms) and K::termsFit(b.facts, terms) and by == T::Person
pure def choose(b: Prep, terms: T::Terms, by: T::TaskActor): Prep =
  { ...b, choice: terms, phase: Preparing, fillBy: NotAsked, version: b.version + 1 }
pure def alwaysChoiceFitsTheFacts(b: Prep): bool =
  (b.phase == Preparing or b.phase == ReadyForReview or b.phase == HandedOff) implies
    T::validTerms(b.key.kind, b.choice) and K::termsFit(b.facts, b.choice)
pure def sometimesAClashIsAccepted(b: Prep): bool = b.phase == Preparing and K::acceptsClash(b.choice)
pure val eval_witness_sometimesAClashIsAccepted = (
  ("begin", K::sampleVisitKey, "source", T::Person),
  ("inspectAccess", { key: K::sampleVisitKey, version: 1, access: SignedIn }, T::Host),
  ("readFacts", { key: K::sampleVisitKey, facts: K::sampleVisitFacts, evidence: "source", version: 2 }, T::Host),
  ("confirmFacts", T::Person),
  ("choose", K::sampleClashTerms, T::Person))
```

### The person's answer to the fill offer decides whether Grace may fill the task's form

Grace offers to fill in only values the person already chose, and fills them only after a yes to that specific offer, with the answers "Yes, fill it in" and "No, I'll do it". For a bill these are the amount and the payment date: "Shall I fill in $84.20 and today's date for you?" (prototype/Grace Prototype.html:1503, 1513). In the prototype that limit is only an instruction to the model: its code fills the form whenever the model asks to fill on the payment page (prototype/Grace Prototype.html:1635), whatever the answer was. This spec deliberately departs from that and makes the answer a recorded state. Every new choice asks again. After "No, I'll do it", Grace points and waits while the person types, and the form is checked as it is read back. The person may change the answer while the form is being prepared.

The person's answer applies to the offer version shown when they tapped it. A changed choice, a later answer, or another run makes that tap stale. Accepting an answer advances the version, so an earlier tap cannot undo it. The offer is the same for every kind of task: Grace offers to type only what the person chose. A fill is what the registry says the current choice types, for a bill only its amount and day, and never nothing. `graceMayFill` holds for a fill only while the form is being prepared, the preparation is live, the answer is "Yes, fill it in", and the fill is exactly that of the current choice. This model dispatches no website operation, so it records the answer and defines `graceMayFill` but cannot itself stop a fill. The [fill gate](./taskBridge.md) refuses Grace's fill of the task's form at the actuator unless the answer was "Yes, fill it in" for this task, and the actuator types a task's fill only when `graceMayFill` holds for exactly the values it would type.

```quint
pure def canDecideFill(b: Prep, fillBy: FillBy, expectedVersion: int, by: T::TaskActor): bool =
  b.phase == Preparing and b.live and expectedVersion == b.version and fillBy != NotAsked and by == T::Person
pure def decideFill(b: Prep, fillBy: FillBy, expectedVersion: int, by: T::TaskActor): Prep = { ...b, fillBy: fillBy, version: b.version + 1 }
pure def graceMayFill(b: Prep, fill: K::Fill): bool =
  b.phase == Preparing and b.live and b.fillBy == GraceFills and (match fill {
    | NoFill => false
    | _ => fill == K::fillOf(b.choice)
  })
pure def alwaysFillAnswerBelongsToAChoice(b: Prep): bool =
  b.fillBy != NotAsked implies (b.phase == Preparing or b.phase == ReadyForReview or b.phase == HandedOff)
pure def stepGraceFillsOnlyAfterTheirYes(before: Prep, via: str, after: Prep): bool =
  (after.fillBy == GraceFills and before.fillBy != GraceFills) implies via == "decideFill"
pure def sometimesGraceFills(b: Prep): bool = graceMayFill(b, K::fillOf(b.choice))
pure def sometimesPersonFills(b: Prep): bool = b.phase == Preparing and b.fillBy == PersonFills
pure val eval_witness_sometimesGraceFills = (
  ("begin", K::sampleBillKey, "source", T::Person),
  ("inspectAccess", { key: K::sampleBillKey, version: 1, access: SignedIn }, T::Host),
  ("readFacts", { key: K::sampleBillKey, facts: K::sampleBillFacts, evidence: "source", version: 2 }, T::Host),
  ("confirmFacts", T::Person),
  ("choose", K::samplePayTerms, T::Person),
  ("decideFill", GraceFills, 4, T::Person))
```

## Story: Correct the website form and review consequences

> As a person paying a bill, I want Grace to check what the website actually contains, accept corrections and stop if it cannot verify the right payment.

### The final form must match every chosen value before consequential review

Populate and re-find actual semantic controls through the execution policy, then read them back. If a fee or other value differs, return to a choice or explain the mismatch; a stale or mismatched callback cannot advance. No payment is submitted by this preparation step. A booking reaches its review and is handed off by the same steps as a bill.

```quint
pure def canVerifyForm(b: Prep, formReport: T::ReviewReport, by: T::TaskActor): bool =
  b.phase == Preparing and b.live and formReport.key == b.key and formReport.proposal == b.choice and formReport.evidence != "" and
  formReport.revision == b.version and by == T::Host
pure def verifyForm(b: Prep, formReport: T::ReviewReport, by: T::TaskActor): Prep =
  { ...b, phase: ReadyForReview, evidence: formReport.evidence }
pure def canHandOff(b: Prep, by: T::TaskActor): bool = b.phase == ReadyForReview and b.live and by == T::Actuator
pure def handOff(b: Prep, by: T::TaskActor): PrepResult = {
  state: { ...b, phase: HandedOff },
  out: List(Review({ key: b.key, proposal: b.choice, evidence: b.evidence, version: b.version }))
}
pure def stepOnlyVerifiedReview(before: Prep, after: Prep, out: List[PrepEffect]): bool =
  out.length() > 0 implies before.phase == ReadyForReview and before.live and after.phase == HandedOff
pure def sometimesReviewReady(b: Prep): bool = b.phase == ReadyForReview
pure def sometimesReviewHandedOff(b: Prep): bool = b.phase == HandedOff
pure def sometimesBookingReadyForReview(b: Prep): bool = b.key.kind == T::AppointmentBooking and b.phase == ReadyForReview
pure def sometimesBookingHandedOff(b: Prep): bool = b.key.kind == T::AppointmentBooking and b.phase == HandedOff
pure val eval_witness_sometimesBookingReadyForReview = (
  ("begin", K::sampleVisitKey, "source", T::Person),
  ("inspectAccess", { key: K::sampleVisitKey, version: 1, access: SignedIn }, T::Host),
  ("readFacts", { key: K::sampleVisitKey, facts: K::sampleVisitFacts, evidence: "source", version: 2 }, T::Host),
  ("confirmFacts", T::Person),
  ("choose", K::sampleBookTerms, T::Person),
  ("verifyForm", { key: K::sampleVisitKey, proposal: K::sampleBookTerms, revision: 4, evidence: "portal" }, T::Host))
pure val eval_witness_sometimesBookingHandedOff = (
  ("begin", K::sampleVisitKey, "source", T::Person),
  ("inspectAccess", { key: K::sampleVisitKey, version: 1, access: SignedIn }, T::Host),
  ("readFacts", { key: K::sampleVisitKey, facts: K::sampleVisitFacts, evidence: "source", version: 2 }, T::Host),
  ("confirmFacts", T::Person),
  ("choose", K::sampleBookTerms, T::Person),
  ("verifyForm", { key: K::sampleVisitKey, proposal: K::sampleBookTerms, revision: 4, evidence: "portal" }, T::Host),
  ("handOff", T::Actuator))
```

### A choice the person makes on the page itself becomes the choice to check

The person may pick an amount or type a date on the website instead of saying it (prototype/Grace Prototype.html:1038, 1683). The trusted host reports what the form now holds for this bill and the current preparation version, and whether the change came from the person's own taps or typing on the page, as the prototype tells her own input apart from Grace's (prototype/Grace Prototype.html:1038, 1683). Only a change the host attributes to the person can become the choice: Grace's own fill, a value the website prefilled or selected by default, and a value the website changed by itself never replace the choice the person made. Terms from the person's own change that differ from the current choice become the choice when they are valid for the task's kind and fit the current facts: for a bill, a valid proposal in the bill's currency, with one of its funding methods, while online payment is allowed and nothing is scheduled or settled. The preparation goes back to preparing the form under a new version, whether or not the earlier form had been verified, so the review never goes ahead with the old choice: only a form that matches the new choice can be verified for review. Any other difference leaves the form unverifiable until it matches the choice or the preparation is blocked. Because the person filled the values herself, Grace does not offer to fill them again.

```quint
pure def canAdoptFormChoice(b: Prep, formReport: T::ReviewReport, personEdited: bool, by: T::TaskActor): bool =
  (b.phase == Preparing or b.phase == ReadyForReview) and b.live and personEdited and formReport.key == b.key and
  formReport.proposal != b.choice and T::validTerms(b.key.kind, formReport.proposal) and K::termsFit(b.facts, formReport.proposal) and
  formReport.evidence != "" and formReport.revision == b.version and by == T::Host
pure def adoptFormChoice(b: Prep, formReport: T::ReviewReport, personEdited: bool, by: T::TaskActor): Prep =
  { ...b, choice: formReport.proposal, phase: Preparing, fillBy: PersonFills, version: b.version + 1 }
pure def lawPageChoiceIsCheckedAgain(b: Prep, formReport: T::ReviewReport, personEdited: bool, by: T::TaskActor): bool =
  canAdoptFormChoice(b, formReport, personEdited, by) implies
    adoptFormChoice(b, formReport, personEdited, by).phase == Preparing and
    adoptFormChoice(b, formReport, personEdited, by).choice == formReport.proposal and
    adoptFormChoice(b, formReport, personEdited, by).choice != b.choice and
    adoptFormChoice(b, formReport, personEdited, by).version > b.version
pure def lawOnlyThePersonsEditReplacesTheChoice(b: Prep, formReport: T::ReviewReport, by: T::TaskActor): bool =
  not(canAdoptFormChoice(b, formReport, false, by))
```

### Pausing or changed context discards a prepared form but keeps the selected bill

After explicit Resume, recheck sign-in, account, current bill and possible existing payment. Never replay a saved click or assume an old form survived. The payment ledger independently retains any possible submission, including after this preparation has handed off. A new preparation never resets that ledger.

```quint
pure def canPause(b: Prep, by: T::TaskActor): bool = b.phase != NoTask and b.live and (by == T::Person or by == T::Host)
pure def pause(b: Prep, by: T::TaskActor): Prep =
  { ...b, live: false, version: b.version + 1 }
pure def canResume(b: Prep, by: T::TaskActor): bool = b.phase != NoTask and not(b.live) and by == T::Person
pure def resume(b: Prep, by: T::TaskActor): Prep =
  { ...b, live: true, phase: NeedsAccess, facts: K::NoFacts, factsConfirmed: false, choice: T::NoTerms, fillBy: NotAsked, reason: "", version: b.version + 1 }
pure def canBlock(b: Prep, reason: str, expectedVersion: int, by: T::TaskActor): bool =
  b.phase != NoTask and b.phase != HandedOff and reason != "" and expectedVersion == b.version and by == T::Host
pure def block(b: Prep, reason: str, expectedVersion: int, by: T::TaskActor): Prep =
  { ...b, phase: Blocked, reason: reason, fillBy: NotAsked, version: b.version + 1 }
pure def alwaysBlockExplained(b: Prep): bool = b.phase == Blocked implies b.reason != ""
pure def stepSubjectPersists(before: Prep, after: Prep): bool = before.phase != NoTask implies after.key == before.key
pure def sometimesBlocked(b: Prep): bool = b.phase == Blocked
pure def sometimesPaused(b: Prep): bool = b.phase != NoTask and not(b.live)
```

## Story: End a task when it is finished or no longer wanted

> As a person who has finished a task, or who no longer wants it, I want Grace to end it so that nothing from it carries on.

### Ending a task discards its preparation, keeps its subject and lets nothing from it come back

The person ends a task by cancelling it; the host ends it when the assistant's work on it finishes, is abandoned or is replaced. A cancellation carries the version shown when the person tapped. A host report carries the version of the work it observed. Only a matching version can end the current preparation. Ending returns the preparation to no task: the facts, the evidence they were read from, the yes to them, the choice, the answer to the fill offer and any reason the task stopped are discarded, the preparation is live again, and its version advances, so that a report or a hand-off for the ended run carries an old version and attaches to nothing. The subject is kept, and only the person's own begin can select another one. Ending leaves the commitment alone, so a possible submission stays recorded. A task that was never begun cannot be ended, and no step of a preparation ever lowers its version.

```quint
pure def canRetire(b: Prep, expectedVersion: int, by: T::TaskActor): bool =
  b.phase != NoTask and expectedVersion == b.version and (by == T::Person or by == T::Host)
pure def retire(b: Prep, expectedVersion: int, by: T::TaskActor): Prep = { ...initial, key: b.key, version: b.version + 1 }
pure def lawOldAnswersAndRetirementsAreRefused(b: Prep, expectedVersion: int, fillBy: FillBy, by: T::TaskActor): bool =
  expectedVersion != b.version implies
    (not(canRetire(b, expectedVersion, by)) and not(canDecideFill(b, fillBy, expectedVersion, by)))
pure def stepRetireEndsTheRun(before: Prep, via: str, after: Prep): bool =
  via == "retire" implies (after.phase == NoTask and after.key == before.key and after.facts == K::NoFacts and
    not(after.factsConfirmed) and after.choice == T::NoTerms and after.fillBy == NotAsked and
    after.evidence == "" and after.reason == "" and after.live and after.version > before.version)
pure def stepVersionNeverGoesBack(before: Prep, after: Prep): bool = after.version >= before.version
pure def sometimesRetired(b: Prep): bool = b.phase == NoTask and b.version > 0
```

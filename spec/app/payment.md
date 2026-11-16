# Payment authorization and durable outcomes

One durable aggregate belongs to one owner, provider, account and bill occurrence. Email, Calendar, browser guidance and resumed tasks must retrieve this same aggregate; a new chat is not a new payment. The bill reference identifies a unique provider obligation or invoice cycle. A calendar entry ID is not part of payment identity: two entries referring to the same bill share one payment record. Identity uses stable opaque references, not an account suffix, amount, task ID or website name. No password, verification code, card number or bank credential enters this model.

This contract generalizes `BillAttempt`, `MoneyEffect` and `GuideConsent` from the legacy formal models. It implements current INV 01–08, JOURNEY 09–11 and TXN 01–02. Their diagnostic feature switches and fixed attempt bounds are intentionally absent. The shell authenticates `by` independently of event JSON. Browser evidence means evidence obtained and checked by the trusted browser integration, never an assertion by website text or the language model.

## Story: Review and authorize the exact payment

> As a person paying a bill, I want to see what will happen and choose whether to submit it, without an old answer paying changed details.

### A payment starts without an identity, proposal or submission

Dates are unambiguous local calendar-day references accompanied by the website's date semantics in the UI. Money is integer minor units in one explicit currency. Funding references are non-secret identifiers resolved by the provider, never credentials. The initial empty values are sentinels, not a real bill.

```quint
type PaymentActor = Person | BrowserHost | DurableStore | Executor
type PaymentStage = Empty | Draft | Reviewed | Guarded | Authorized | Checking | Resolved
type PaymentOutcome = NotSubmitted | Unknown | Pending | Scheduled | Accepted | Completed | VerifiedFailure | Returned
type BillKey = { owner: str, origin: str, account: str, bill: str }
type Proposal = { amount: int, fee: int, currency: str, day: int, funding: str }
type ReviewReport = { key: BillKey, proposal: Proposal, revision: int, evidence: str }
type OutcomeReport = { key: BillKey, attempt: int, revision: int, result: PaymentOutcome, evidence: str, reference: str }
type PriorReport = { key: BillKey, proposal: Proposal, revision: int, result: PaymentOutcome, evidence: str, reference: str }
type StoredOutcome = { result: PaymentOutcome, evidence: str, reference: str }
type Payment = {
  key: BillKey, proposal: Proposal, stage: PaymentStage, result: PaymentOutcome,
  revision: int, evidence: str, readBack: bool,
  live: bool, fresh: bool, attempt: int, dispatched: bool, reference: str,
  durable: StoredOutcome, saveError: bool
}
type PaymentEffect = SubmitPayment({ attempt: int, revision: int, key: BillKey, proposal: Proposal })
type PaymentResult = { state: Payment, out: List[PaymentEffect] }
pure val emptyKey: BillKey = { owner: "", origin: "", account: "", bill: "" }
pure val emptyProposal: Proposal = { amount: 0, fee: 0, currency: "", day: 0, funding: "" }
pure val initial: Payment = {
  key: emptyKey, proposal: emptyProposal, stage: Empty, result: NotSubmitted,
  revision: 0, evidence: "", readBack: false,
  live: true, fresh: false, attempt: 0, dispatched: false, reference: "",
  durable: { result: NotSubmitted, evidence: "", reference: "" }, saveError: false
}
pure def validKey(key: BillKey): bool = key.owner != "" and key.origin != "" and key.account != "" and key.bill != ""
pure def validProposal(proposal: Proposal): bool = proposal.amount > 0 and proposal.fee >= 0 and proposal.currency != "" and proposal.day > 0 and proposal.funding != ""
pure val keyValues = Set(
  { owner: "owner", origin: "https://utility.example", account: "account", bill: "bill" },
  { owner: "owner", origin: "https://credit.example", account: "account", bill: "bill" },
  emptyKey
)
pure val proposalValues = Set(
  { amount: 8420, fee: 0, currency: "USD", day: 1, funding: "bank-ref" },
  { amount: 3500, fee: 25, currency: "USD", day: 2, funding: "other-bank" },
  emptyProposal
)
pure val observedRevisionValues = Set(0, 1, 2, 3, 4, 5, 6)
pure val observedAttemptValues = Set(0, 1, 2, 3)
pure val exampleKey: BillKey = { owner: "owner", origin: "https://utility.example", account: "account", bill: "bill" }
pure val exampleProposal: Proposal = { amount: 8420, fee: 0, currency: "USD", day: 1, funding: "bank-ref" }
pure val exampleReview: ReviewReport = { key: exampleKey, proposal: exampleProposal, revision: 0, evidence: "source" }
pure val reviewReportValues = Set(
  exampleReview, { ...exampleReview, revision: 1 }, { ...exampleReview, revision: 2 },
  { ...exampleReview, revision: 3 }, { ...exampleReview, revision: 4 }, { ...exampleReview, revision: 5 },
  { ...exampleReview, key: { ...exampleKey, origin: "https://credit.example" } },
  { ...exampleReview, evidence: "" }, { ...exampleReview, proposal: emptyProposal }
)
pure val exampleOutcome: OutcomeReport = { key: exampleKey, attempt: 1, revision: 2, result: Completed, evidence: "result", reference: "receipt" }
pure val outcomeReportValues = Set(
  exampleOutcome, { ...exampleOutcome, result: Scheduled }, { ...exampleOutcome, result: Accepted },
  { ...exampleOutcome, result: Pending, reference: "" }, { ...exampleOutcome, result: Unknown, reference: "" },
  { ...exampleOutcome, result: VerifiedFailure, reference: "" }, { ...exampleOutcome, result: Returned, reference: "" }, { ...exampleOutcome, result: NotSubmitted, reference: "" },
  { ...exampleOutcome, revision: 1 }, { ...exampleOutcome, revision: 3 }, { ...exampleOutcome, revision: 4 },
  { ...exampleOutcome, result: Returned, revision: 3, reference: "" },
  { ...exampleOutcome, result: Returned, revision: 4, reference: "" },
  { ...exampleOutcome, attempt: 2, revision: 5 }, { ...exampleOutcome, evidence: "" },
  { ...exampleOutcome, key: emptyKey }, { ...exampleOutcome, reference: "" }
)
pure val examplePrior: PriorReport = { key: exampleKey, proposal: exampleProposal, revision: 0, result: Scheduled, evidence: "prior-result", reference: "receipt" }
pure val priorReportValues = Set(
  examplePrior, { ...examplePrior, result: Unknown, reference: "" }, { ...examplePrior, result: Pending, reference: "" },
  { ...examplePrior, result: VerifiedFailure, reference: "" }, { ...examplePrior, result: Returned, reference: "" }, { ...examplePrior, revision: 1 },
  { ...examplePrior, key: { ...exampleKey, origin: "https://credit.example" } },
  { ...examplePrior, result: Completed }, { ...examplePrior, reference: "" }, { ...examplePrior, evidence: "" }
)
pure val weight_bind = 2
pure val weight_review = 2
pure val weight_recordReadBack = 2
pure val weight_persistWindow = 2
pure val weight_authorize = 2
pure val weight_submit = 2
pure val weight_recordOutcome = 2
```

### The selected bill identity is bound once and is never replaced by a new task

Binding requires the person's selected bill, after trusted source resolution. A wrong owner or destination must be corrected before binding or opened as a separate bill aggregate; it cannot rewrite an existing attempt's identity.

```quint
pure def canBind(p: Payment, key: BillKey, by: PaymentActor): bool = p.stage == Empty and validKey(key) and by == Person
pure def bind(p: Payment, key: BillKey, by: PaymentActor): Payment = { ...p, key: key, stage: Draft }
pure def alwaysIdentity(p: Payment): bool = p.stage == Empty or validKey(p.key)
pure def stepIdentityNeverChanges(before: Payment, after: Payment): bool = before.stage != Empty implies after.key == before.key
```

### Only a fresh matching review can replace the current proposal

The browser host has checked the selected account, actual fields, fees, date and funding method against the person's choices. A mismatched review does not advance. Every new review invalidates prior read-back and approval. A reviewed proposal is still unsubmitted. An unresolved window cannot be overwritten by editing the form. Discovered by the proof: every reviewed proposal must retain its nonempty evidence reference, even before an attempt is opened; otherwise a journal could contain no basis for the review.

```quint
pure def canReview(p: Payment, reviewReport: ReviewReport, by: PaymentActor): bool =
  p.live and (p.stage == Draft or p.stage == Reviewed) and p.result == NotSubmitted and p.durable.result == NotSubmitted and
  reviewReport.key == p.key and validProposal(reviewReport.proposal) and reviewReport.evidence != "" and reviewReport.revision == p.revision and by == BrowserHost
pure def review(p: Payment, reviewReport: ReviewReport, by: PaymentActor): Payment =
  { ...p, proposal: reviewReport.proposal, stage: Reviewed, revision: p.revision + 1,
    evidence: reviewReport.evidence, fresh: true, readBack: false, reference: "", saveError: false }
pure def alwaysProposal(p: Payment): bool =
  (p.stage == Reviewed or p.stage == Guarded or p.stage == Authorized or p.stage == Checking or p.stage == Resolved) implies validProposal(p.proposal)
pure def alwaysCounters(p: Payment): bool = p.revision >= 0 and p.attempt >= 0
pure def alwaysReviewHasEvidence(p: Payment): bool = p.stage == Reviewed implies p.evidence != ""
```

### Current amount, date, funding method and fees are presented before voice approval

The accessible review and its spoken equivalent contain the same proposal. The host acknowledges completed presentation for the exact revision. Interruption before the read-back is complete cannot authorize submission.

```quint
pure def canRecordReadBack(p: Payment, observedRevision: int, by: PaymentActor): bool =
  (p.stage == Reviewed or p.stage == Guarded) and p.live and p.fresh and observedRevision == p.revision and by == BrowserHost
pure def recordReadBack(p: Payment, observedRevision: int, by: PaymentActor): Payment = { ...p, readBack: true }
```

### A durable unresolved window exists before either submission route is enabled

The store acknowledgement means identity, proposal, review evidence/time reference and attempt number survived an atomic durable write. Every physical write uses the canonical bill key and a revision-checked transaction: serialization or compare-and-swap rejects a stale commit before it changes storage, not only when its callback reaches this model. Concurrent entry points retrieve and update this one aggregate. The shell must request that write before exposing a guided final-payment target. A current-revision write failure leaves Reviewed, records a storage error and offers Retry; no final-payment effect is emitted. Opening the window records uncertainty before dispatch because a manual tap or crash may occur before its observation returns.

```quint
pure def canPersistWindow(p: Payment, observedRevision: int, by: PaymentActor): bool =
  p.stage == Reviewed and p.live and p.fresh and p.durable.result == NotSubmitted and observedRevision == p.revision and by == DurableStore
pure def persistWindow(p: Payment, observedRevision: int, by: PaymentActor): Payment =
  { ...p, stage: Guarded, result: Unknown, attempt: p.attempt + 1, dispatched: false,
    durable: { result: Unknown, evidence: p.evidence, reference: "" }, saveError: false }
pure def canWindowSaveFailed(p: Payment, observedRevision: int, by: PaymentActor): bool =
  canPersistWindow(p, observedRevision, by)
pure def windowSaveFailed(p: Payment, observedRevision: int, by: PaymentActor): Payment = { ...p, saveError: true }
pure def sometimesWindowSaveFailed(p: Payment): bool = p.stage == Reviewed and p.saveError
pure def alwaysWindow(p: Payment): bool =
  p.result != NotSubmitted implies p.attempt > 0 and p.evidence != ""
```

### Explicit approval binds to the complete current proposal and is consumed once

Only the person's completed, unambiguous approval of this review can authorize the agent. A correction in the same utterance is not approval. Silence, a website instruction, an early yes, a partial recognition result or the assistant's own audio cannot create this event. The input boundary must classify these cases before dispatching it. The emitted command carries the resulting dispatch revision. Immediately before the real click the actuator checks that command against the current aggregate and consumes its canonical bill/attempt identifier once; interruption or a newer review makes the queued command stale, because every review, stop and page change advances the revision the command carries.

The prototype has the person tap Submit payment herself and tells Grace never to move money (prototype/Grace Prototype.html:1502, 1519). Spoken approval as a second route to submission is a deliberate addition kept from PRD JOURNEY 10 (prototype/prd.md:1883) and recorded in docs/prototype-audit.md:155-160; the person signs off on this departure from the prototype when accepting this rule.

```quint
pure def canAuthorize(p: Payment, observedRevision: int, hasCorrection: bool, by: PaymentActor): bool =
  p.stage == Guarded and p.live and p.fresh and p.readBack and observedRevision == p.revision and not(hasCorrection) and by == Person
pure def authorize(p: Payment, observedRevision: int, hasCorrection: bool, by: PaymentActor): Payment = { ...p, stage: Authorized }
pure def alwaysAuthorization(p: Payment): bool =
  p.stage == Authorized implies p.live and p.fresh and p.readBack and p.result == Unknown and not(p.dispatched)
pure def canSubmit(p: Payment, observedRevision: int, observedAttempt: int, by: PaymentActor): bool =
  p.stage == Authorized and p.live and p.fresh and observedRevision == p.revision and observedAttempt == p.attempt and by == Executor
pure def submit(p: Payment, observedRevision: int, observedAttempt: int, by: PaymentActor): PaymentResult = {
  state: { ...p, stage: Checking, result: Unknown, dispatched: true, readBack: false, fresh: false, revision: p.revision + 1 },
  out: List(SubmitPayment({ attempt: p.attempt, revision: p.revision + 1, key: p.key, proposal: p.proposal }))
}
pure def effectIsCurrent(p: Payment, command: PaymentEffect): bool = match command {
  | SubmitPayment(details) => p.stage == Checking and p.dispatched and p.live and
    details.key == p.key and details.proposal == p.proposal and details.attempt == p.attempt and
    details.revision == p.revision
}
pure def stepEmittedPaymentMatchesCurrentAttempt(before: Payment, after: Payment, out: List[PaymentEffect]): bool =
  out.every(command => effectIsCurrent(after, command))
pure val commandValues = Set(SubmitPayment({ attempt: 1, revision: 2, key: exampleKey, proposal: exampleProposal }))
pure def stepOnlyApprovedSubmission(before: Payment, after: Payment, out: List[PaymentEffect]): bool =
  out.length() > 0 implies before.stage == Authorized and before.live and before.fresh and before.readBack and
    before.result == Unknown and not(before.dispatched) and after.stage == Checking and after.dispatched
```

### An observed website tap starts outcome checking without an agent submission

The person remains free to act directly on the website. The trusted integration correlates the observed tap with this durable attempt. Observing a tap never emits another payment. A tap that escaped guidance must be reconciled as an unknown external attempt before more guidance is offered; the browser cannot be assumed to prevent every manual action.

```quint
pure def canObserveManualSubmit(p: Payment, observedAttempt: int, by: PaymentActor): bool =
  (p.stage == Guarded or p.stage == Authorized) and observedAttempt == p.attempt and by == BrowserHost
pure def observeManualSubmit(p: Payment, observedAttempt: int, by: PaymentActor): Payment =
  { ...p, stage: Checking, result: Unknown, dispatched: true, readBack: false, fresh: false, revision: p.revision + 1 }
pure def sometimesVoiceSubmission(p: Payment): bool = p.stage == Authorized
pure def sometimesChecking(p: Payment): bool = p.stage == Checking and p.dispatched
```

## Story: Stop, resume and investigate without paying twice

> As a person returning to a bill, I want Grace to remember what might already have happened and check it before offering another payment.

### Stop and changed context invalidate authorization without erasing the attempt

Stop also represents Close, departure from the task, lost authorization and interruption requiring a pause. Page changes include account changes, manual navigation, edited fields and viewport changes that invalidate the target. Every such change invalidates queued revision tokens. A journaled but unobserved effect remains Unknown even if the task is abandoned.

```quint
pure def canStop(p: Payment, by: PaymentActor): bool = p.stage != Empty and p.live and (by == Person or by == BrowserHost)
pure def stop(p: Payment, by: PaymentActor): Payment = { ...invalidate(p, by), live: false }
pure def canInvalidate(p: Payment, by: PaymentActor): bool = p.stage != Empty and by == BrowserHost
pure def invalidate(p: Payment, by: PaymentActor): Payment = {
  ...p, fresh: false, readBack: false, revision: p.revision + 1,
  stage: if (p.stage == Authorized) Guarded else if (p.stage == Reviewed) Draft else p.stage
}
pure def canResume(p: Payment, by: PaymentActor): bool = p.stage != Empty and not(p.live) and by == Person
pure def resume(p: Payment, by: PaymentActor): Payment = { ...p, live: true, fresh: false, readBack: false }
pure def stepStopKeepsOutcome(before: Payment, via: str, after: Payment): bool =
  (via == "stop" or via == "invalidate" or via == "resume") implies after.result == before.result and after.attempt == before.attempt
pure def sometimesPausedUncertain(p: Payment): bool = not(p.live) and p.result == Unknown
```

### Only matching authoritative evidence can resolve an existing attempt

The host verifies the result for this bill, proposal and attempt, not merely a success-looking page. Empty or absent confirmation is Unknown. Pending remains unresolved. Scheduled, Accepted and Completed are different factual results; only Completed represents observed completion. A reference is required for positive outcomes. A verified failure means the provider has established no successful payment for this attempt. A later authoritative return or reversal is Returned, even after Scheduled, Accepted or Completed. It preserves the submission attempt and replaces the current status truthfully; historical success is not proof of current settlement. Reliable proof of no submission may return the aggregate to Draft; a timeout or missing receipt cannot supply that proof.

```quint
pure def positiveOutcome(result: PaymentOutcome): bool = result == Scheduled or result == Accepted or result == Completed
pure def canRecordOutcome(p: Payment, outcomeReport: OutcomeReport, by: PaymentActor): bool =
  p.attempt > 0 and (p.stage == Guarded or p.stage == Authorized or p.stage == Checking or p.stage == Resolved) and
  outcomeReport.key == p.key and outcomeReport.attempt == p.attempt and outcomeReport.revision == p.revision and outcomeReport.evidence != "" and by == BrowserHost and
  (positiveOutcome(outcomeReport.result) implies outcomeReport.reference != "") and
  (positiveOutcome(p.result) implies positiveOutcome(outcomeReport.result) or outcomeReport.result == Returned) and
  (p.result == Completed implies outcomeReport.result == Completed or outcomeReport.result == Returned) and
  (p.result == Returned implies outcomeReport.result == Returned)
pure def recordOutcome(p: Payment, outcomeReport: OutcomeReport, by: PaymentActor): Payment = {
  ...p, result: outcomeReport.result, evidence: outcomeReport.evidence,
  reference: if (positiveOutcome(outcomeReport.result)) outcomeReport.reference else "",
  stage: if (outcomeReport.result == NotSubmitted) Draft else if (outcomeReport.result == Unknown or outcomeReport.result == Pending) Checking else Resolved,
  fresh: false, readBack: false, revision: p.revision + 1, saveError: false
}
pure def alwaysResult(p: Payment): bool =
  positiveOutcome(p.result) implies p.stage == Resolved and p.reference != ""
pure def alwaysSubmissionStage(p: Payment): bool =
  (p.stage == Guarded or p.stage == Authorized) implies p.result == Unknown and not(p.dispatched)
pure def alwaysResolved(p: Payment): bool =
  p.stage == Resolved implies positiveOutcome(p.result) or p.result == VerifiedFailure or p.result == Returned
pure def sometimesScheduled(p: Payment): bool = p.result == Scheduled
pure def sometimesCompleted(p: Payment): bool = p.result == Completed
pure def sometimesPending(p: Payment): bool = p.result == Pending
pure def sometimesFailed(p: Payment): bool = p.result == VerifiedFailure
pure def sometimesReturned(p: Payment): bool = p.result == Returned
```

### Leaving the review through Edit before any submit tap returns the payment to a draft

The website's review page offers Edit beside Submit payment, and Edit goes back to the payment form (prototype/Grace Prototype.html:1026, 1044). The unresolved window is already saved by then, so the attempt is Unknown. The trusted host's verified observation that the person left this attempt's review page through Edit, with no submit tap seen, is evidence that nothing was submitted: it reports that as a NotSubmitted outcome for the current attempt and revision. That outcome returns the payment to Draft and keeps the attempt count, and the durable store records it before a new review can replace the proposal. Without that observation, for example after a page change with no Edit tap seen, the attempt stays Unknown and is investigated.

```quint
pure def editReport(p: Payment, evidence: str): OutcomeReport =
  { key: p.key, attempt: p.attempt, revision: p.revision, result: NotSubmitted, evidence: evidence, reference: "" }
pure def lawEditBeforeSubmitReturnsToDraft(p: Payment, evidence: str): bool =
  (p.attempt > 0 and (p.stage == Guarded or p.stage == Authorized) and p.result == Unknown and evidence != "") implies
    canRecordOutcome(p, editReport(p, evidence), BrowserHost) and
    recordOutcome(p, editReport(p, evidence), BrowserHost).stage == Draft and
    recordOutcome(p, editReport(p, evidence), BrowserHost).result == NotSubmitted and
    recordOutcome(p, editReport(p, evidence), BrowserHost).attempt == p.attempt and
    recordOutcome(p, editReport(p, evidence), BrowserHost).key == p.key
pure def sometimesEditedBeforeSubmit(p: Payment): bool = p.stage == Draft and p.attempt > 0 and p.durable.result == Unknown
```

### A payment made outside Grace is reconciled before new payment guidance

Discovered by review of the manual-navigation journey: requiring every observed attempt to begin with Grace's own review would omit payments made while Grace was closed. The durable store acknowledges a freshly verified prior attempt for this exact bill before it is adopted. Its outcome may remain Unknown. A missing or ambiguous bill identity blocks assistance at the account boundary; it must not be assigned an invented identity or ignored. This is reconciliation of evidence, not permission to make a payment.

```quint
pure def canReconcilePrior(p: Payment, priorReport: PriorReport, by: PaymentActor): bool =
  (p.stage == Draft or p.stage == Reviewed) and p.live and p.result == NotSubmitted and p.durable.result == NotSubmitted and
  priorReport.key == p.key and validProposal(priorReport.proposal) and priorReport.revision == p.revision and priorReport.result != NotSubmitted and
  priorReport.evidence != "" and (positiveOutcome(priorReport.result) implies priorReport.reference != "") and by == DurableStore
pure def reconcilePrior(p: Payment, priorReport: PriorReport, by: PaymentActor): Payment = {
  ...p, proposal: priorReport.proposal, result: priorReport.result, evidence: priorReport.evidence,
  reference: if (positiveOutcome(priorReport.result)) priorReport.reference else "",
  stage: if (priorReport.result == Unknown or priorReport.result == Pending) Checking else Resolved,
  attempt: p.attempt + 1, revision: p.revision + 1, fresh: false, readBack: false, dispatched: true,
  durable: { result: priorReport.result, evidence: priorReport.evidence, reference: if (positiveOutcome(priorReport.result)) priorReport.reference else "" }, saveError: false
}
pure def sometimesPriorPaymentReconciled(p: Payment): bool = p.stage == Resolved and p.attempt > 0 and p.dispatched
```

### A new attempt requires a person's retry after verified failure or return and a new review

There is no retry transition for Pending, Unknown or a positive result. Returned means the trusted integration has established a final return or reversal, not a speculative missing credit. Retrying a returned payment requires saving that evidence and a new explicit decision by the person; a status callback cannot initiate repayment. A new bill occurrence is a different durable aggregate. The previous attempt count remains, making stale outcome callbacks distinguishable from a later attempt. Retrying never reuses read-back or approval.

```quint
pure def canRetry(p: Payment, by: PaymentActor): bool = p.stage == Resolved and (p.result == VerifiedFailure or p.result == Returned) and p.durable.result == p.result and p.live and by == Person
pure def retry(p: Payment, by: PaymentActor): Payment = {
  ...p, stage: Draft, result: NotSubmitted, fresh: false, readBack: false, dispatched: false,
  revision: p.revision + 1, reference: "", durable: { result: NotSubmitted, evidence: p.evidence, reference: "" }, saveError: false
}
pure def alwaysUnsubmittedStage(p: Payment): bool =
  (p.stage == Empty or p.stage == Draft or p.stage == Reviewed) implies p.result == NotSubmitted
pure def stepNoDuplicate(before: Payment, via: str, after: Payment): bool =
  after.attempt > before.attempt implies (via == "persistWindow" or via == "reconcilePrior") and before.result == NotSubmitted
pure def stepConfirmationChangesOnlyWithEvidence(before: Payment, via: str, after: Payment): bool =
  positiveOutcome(before.result) and not(positiveOutcome(after.result)) implies
    (via == "recordOutcome" and after.result == Returned and after.attempt == before.attempt) or via == "restart"
pure def stepDurableReturnRequiresSavedEvidence(before: Payment, via: str, after: Payment): bool =
  positiveOutcome(before.durable.result) and not(positiveOutcome(after.durable.result)) implies
    via == "saveOutcome" and before.result == Returned and after.durable.result == Returned and after.attempt == before.attempt
pure def sometimesRetry(p: Payment): bool = p.stage == Draft and p.attempt > 0
```

### A failed outcome save does not undo the observed payment

Discovered by review of the legacy receipt-save failure: a provider result and a durable local receipt are separate facts. The running session keeps the observed result when saving fails and offers a storage retry, never a payment retry. A store acknowledgement copies only the current revision. Positive durable results are not retryable; a later return must first be observed and durably recorded. Discovered by the proof: all attempts retain a current evidence reference, including verified no-submission results, and every stored nonempty outcome belongs to an existing attempt with a valid proposal. These facts make outcome saving and restart safe for every admitted state.

```quint
pure def outcomeNeedsSave(p: Payment): bool =
  p.result != p.durable.result or p.evidence != p.durable.evidence or p.reference != p.durable.reference
pure def canSaveOutcome(p: Payment, observedRevision: int, by: PaymentActor): bool =
  p.attempt > 0 and (p.stage == Draft or p.stage == Checking or p.stage == Resolved) and
  observedRevision == p.revision and outcomeNeedsSave(p) and by == DurableStore
pure def saveOutcome(p: Payment, observedRevision: int, succeeded: bool, by: PaymentActor): Payment = {
  ...p, durable: if (succeeded) { result: p.result, evidence: p.evidence, reference: p.reference } else p.durable,
  saveError: not(succeeded)
}
pure def alwaysAttemptHasEvidence(p: Payment): bool = p.attempt > 0 implies p.evidence != ""
pure def alwaysDurableOutcomeHasAttempt(p: Payment): bool =
  p.durable.result != NotSubmitted implies p.attempt > 0 and validProposal(p.proposal) and p.durable.evidence != ""
pure def alwaysDurableWindow(p: Payment): bool =
  p.attempt > 0 implies p.durable.evidence != ""
pure def alwaysDurableConfirmation(p: Payment): bool =
  positiveOutcome(p.durable.result) implies p.durable.reference != "" and (positiveOutcome(p.result) or p.result == Returned)
pure def sometimesOutcomeSaveFailed(p: Payment): bool = p.saveError
```

### Restart restores the last durable result and revokes transient permission

The shell restores this aggregate through generated state decoding and a durable store, never from chat memory. Before a window exists, transient review is discarded. After a window exists its durable outcome and identity survive. If an observed result was not saved, restart restores the unresolved window and investigates; it cannot assume either success or failure. This qualifies the running-session rule that an observed confirmation is retained: a lost volatile confirmation is not a reversed payment.

```quint
pure def canRestart(p: Payment, by: PaymentActor): bool = p.stage != Empty and by == DurableStore
pure def restart(p: Payment, by: PaymentActor): Payment = {
  ...p, live: false, fresh: false, readBack: false, revision: p.revision + 1,
  result: p.durable.result, evidence: if (p.attempt > 0) p.durable.evidence else p.evidence,
  reference: p.durable.reference, saveError: false,
  stage: if (p.durable.result == NotSubmitted) Draft
    else if (p.durable.result == Unknown or p.durable.result == Pending) Checking else Resolved
}
pure def stepRestartKeepsRecord(before: Payment, via: str, after: Payment): bool =
  via == "restart" implies after.key == before.key and after.durable == before.durable and
    after.result == before.durable.result and after.attempt == before.attempt and not(after.fresh) and not(after.readBack)
```

### An owner that keeps payments keeps every payment rule

The workspace keeps the current payment and earlier ones. It requires this one list of the payment rules of each, kept here beside the rules so that a new payment rule cannot be left out of it.

```quint
pure def validPayment(p: Payment): bool =
  alwaysIdentity(p) and alwaysProposal(p) and alwaysCounters(p) and
  alwaysWindow(p) and alwaysAuthorization(p) and alwaysResult(p) and
  alwaysSubmissionStage(p) and alwaysResolved(p) and alwaysUnsubmittedStage(p) and
  alwaysDurableWindow(p) and alwaysDurableConfirmation(p) and
  alwaysReviewHasEvidence(p) and alwaysAttemptHasEvidence(p) and alwaysDurableOutcomeHasAttempt(p)
```

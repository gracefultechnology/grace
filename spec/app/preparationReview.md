# Convert the current bill preparation into a scoped review

This stateless library connects [bill preparation](./billpay.md) to the existing
[workspace review](./workspace.md), without state or a payment/review transition.
For every BillPreparation handoff, the host must use this conversion, then consume
its result through existing `reviewCommitment` with the authenticated Host actor.

## Story: Review the payment I actually chose

> As a person paying a bill, I want the checked website form and the current
> review to contain my latest amount, fee, date and funding choice.

### A conversion preserves the live preparation and captured context

The host captures the workspace payment tokens when it verifies the form for
this handoff. Preparation version and payment revision belong to different
owners and must not be substituted for one another. Conversion compares the
emitted handoff against the actual current preparation and the captured tokens
against the actual current workspace. It never refreshes an old envelope with
new tokens. It preserves the exact key, proposal and evidence.

The caller authenticates the host and reads the two canonical states, converts,
and dispatches the existing guarded review synchronously, without an await or
interleaved update. Interruption or correction invalidates the relevant owning
states. A successful conversion is a value, not a durable authorization: it
cannot be queued and then used without repeating these current-state checks.
The existing payment revision increment rejects a duplicate original envelope.

These laws cover the conversion. They do not establish that a supplied state is
the live application state or that browser evidence describes the actual page.
Those remain host obligations. Direct workspace review is for callers that actually
performed equivalent provider-form/choice verification, not an alternative BP handoff route.

```quint
import billpay as BP from "./billpay"
import commitment as CM from "./commitment"
import task as T from "./task"
import taskKinds as K from "./taskKinds"
import workspace as W from "./workspace"
import shell as S from "./shell"
import browser as B from "./browser"
import browserControls as BC from "./browserControls"
import execution as X from "./execution"

type ScopedPreparedReview = { handoff: BP::BillEffect, captured: W::CommitmentTokens }
type ReviewConversion = ReviewDeclined | ReviewConverted({ report: W::CurrentReview })

pure def reportFromHandoff(transfer: ScopedPreparedReview): W::CurrentReview =
  val handoff = transfer.handoff
  match handoff {
    | ReviewPayment(details) => {
      deviceVersion: transfer.captured.deviceVersion,
      browserRevision: transfer.captured.browserRevision,
      taskVersion: transfer.captured.taskVersion,
      review: {
        key: details.key, proposal: details.proposal, evidence: details.evidence,
        revision: transfer.captured.revision
      }
    }
  }

pure def preparationMatchesHandoff(preparation: BP::BillPreparation, transfer: ScopedPreparedReview): bool =
  val handoff = transfer.handoff
  match handoff {
    | ReviewPayment(details) => preparation.live and preparation.phase == BP::HandedOff and
      details.version == preparation.version and details.key == preparation.key and
      details.proposal == preparation.choice and details.evidence == preparation.evidence
  }

pure def convertPreparedReview(
  preparation: BP::BillPreparation, w: W::Workspace,
  transfer: ScopedPreparedReview, by: W::WorkspaceActor
): ReviewConversion =
  if (preparationMatchesHandoff(preparation, transfer) and W::commitmentTokensMatch(w, transfer.captured) and
      W::canReviewCommitment(w, reportFromHandoff(transfer), by))
    ReviewConverted({ report: reportFromHandoff(transfer) })
  else ReviewDeclined

pure def lawConversionKeepsCurrentChoice(
  preparation: BP::BillPreparation, w: W::Workspace,
  transfer: ScopedPreparedReview, by: W::WorkspaceActor
): bool =
  val converted = convertPreparedReview(preparation, w, transfer, by)
  match converted {
  | ReviewDeclined => true
  | ReviewConverted(value) => preparationMatchesHandoff(preparation, transfer) and
    value.report.review.key == preparation.key and value.report.review.proposal == preparation.choice and
    value.report.review.evidence == preparation.evidence and
    value.report.review.revision == transfer.captured.revision
}

pure def lawConversionRequiresCurrentWorkspace(
  preparation: BP::BillPreparation, w: W::Workspace,
  transfer: ScopedPreparedReview, by: W::WorkspaceActor
): bool =
  val converted = convertPreparedReview(preparation, w, transfer, by)
  match converted {
  | ReviewDeclined => true
  | ReviewConverted(value) => W::commitmentTokensMatch(w, transfer.captured) and
    W::canReviewCommitment(w, value.report, by)
}

pure def lawCurrentPreparationConverts(
  preparation: BP::BillPreparation, w: W::Workspace,
  transfer: ScopedPreparedReview, by: W::WorkspaceActor
): bool =
  val converted = convertPreparedReview(preparation, w, transfer, by)
  (preparationMatchesHandoff(preparation, transfer) and W::commitmentTokensMatch(w, transfer.captured) and
    W::canReviewCommitment(w, reportFromHandoff(transfer), by)) implies match converted {
      | ReviewDeclined => false
      | ReviewConverted(value) => value.report == reportFromHandoff(transfer)
    }
```

### Finite examples cover a current handoff and retired source or destination versions

The accepted example reaches preparation version 4 and payment revision 0 through
the existing owners' operations. Other examples retain that transfer while its
preparation pauses, its workspace changes, or a payload field or captured token
is stale. The examples are simulation inputs and do not restrict runtime values.

```quint
pure val preparationValues = {
  val begun = BP::begin(BP::initial, CM::exampleKey, "source", T::Person)
  val signed = BP::inspectAccess(begun, { key: CM::exampleKey, version: 1, access: BP::SignedIn }, T::Host)
  val facts = BP::readFacts(signed, { key: CM::exampleKey, version: 2, evidence: "source", facts: K::sampleBillFacts }, T::Host)
  val chosen = BP::choose(BP::confirmFacts(facts, T::Person), CM::exampleTerms, T::Person)
  val verified = BP::verifyForm(chosen, { ...CM::exampleReview, revision: 4 }, T::Host)
  val handed = BP::handOff(verified, T::Actuator).state
  val paused = BP::pause(handed, T::Person)
  Set(BP::initial, chosen, verified, handed, paused, BP::resume(paused, T::Person))
}
pure val wValues = {
  val started = W::changeLifecycle(W::initial, W::StartupSucceeded, W::Host)
  val available = W::setAvailability(started,
    { connection: S::Online, reasoning: true, microphone: true, observation: true }, W::Host)
  val opened = W::openGrace(W::visit(available, S::Browser, W::Person), W::Person)
  val begun = W::begin(opened,
    { owner: "owner", task: "task", goal: "Read the account", origin: "https://utility.example" }, W::Person)
  val loaded = W::receiveLoad(begun, { id: 1, version: 1, result: B::Loaded }, W::Host)
  val observed = W::observe(loaded, { deviceVersion: 6, browserRevision: 2, taskVersion: 1,
    website: X::goodObservation, checkpoint: "Read the current account" }, W::Host)
  val bound = W::bindCommitment(observed, CM::exampleKey, W::Person)
  val reviewed = W::reviewCommitment(bound,
    { deviceVersion: 6, browserRevision: 2, taskVersion: 1, review: CM::exampleReview }, W::Host)
  val changed = W::changePage(bound, BC::PageChanged({ id: 1, revision: 2 }), W::Host)
  val resumed = W::resume(changed, W::Person)
  val other = W::observe(resumed, {
    deviceVersion: resumed.device.contextVersion, browserRevision: resumed.browser.revision,
    taskVersion: resumed.assistant.workVersion, checkpoint: "Read the other account",
    website: { ...X::goodObservation, generation: resumed.execution.generation, matchedAccount: "other-account" }
  }, W::Host)
  Set(W::initial, bound, reviewed, changed, other)
}
pure val transferValues = {
  val captured = { deviceVersion: 6, browserRevision: 2, taskVersion: 1, revision: 0, attempt: 0 }
  val details = { key: CM::exampleKey, proposal: CM::exampleTerms, evidence: "source", version: 4 }
  val valid = { handoff: BP::ReviewPayment(details), captured: captured }
  Set(valid,
    { ...valid, handoff: BP::ReviewPayment({ ...details, version: 3 }) },
    { ...valid, handoff: BP::ReviewPayment({ ...details, key: { ...CM::exampleKey, account: "other-account" } }) },
    { ...valid, handoff: BP::ReviewPayment({ ...details, proposal: T::PayTerms({ pay: { ...CM::exampleProposal, day: 2 } }) }) },
    { ...valid, handoff: BP::ReviewPayment({ ...details, evidence: "other-evidence" }) },
    { ...valid, handoff: BP::ReviewPayment({ ...details, evidence: "" }) },
    { ...valid, captured: { ...captured, deviceVersion: 5 } },
    { ...valid, captured: { ...captured, browserRevision: 1 } },
    { ...valid, captured: { ...captured, taskVersion: 0 } },
    { ...valid, captured: { ...captured, revision: 1 } },
    { ...valid, captured: { ...captured, attempt: 1 } })
}
pure val byValues = Set(W::Host, W::Person, W::Store, W::Actuator)
```

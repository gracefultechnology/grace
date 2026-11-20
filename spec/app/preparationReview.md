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
import billKind as BK from "./billKind"
import commitment as CM from "./commitment"
import task as T from "./task"
import taskKinds as K from "./taskKinds"
import workspace as W from "./workspace"
import interaction as I from "./interaction"
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

Each workspace example has one accepted transfer: preparation version 4, reached
through the existing owners' operations, with the payment revision and attempt
that workspace holds. Other examples retain those transfers while their
preparation pauses, or with a payload field or captured token that is stale. The examples are simulation inputs and do not restrict runtime values.

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
  val opened = W::openGrace(W::visit(started, S::Browser, W::Person), W::Person)
  val allowed = W::setBrowserObservation(opened, { allowed: true,
    deviceVersion: opened.device.contextVersion, browserRevision: opened.browser.revision }, W::Person)
  val available = W::setAvailability(allowed,
    { connection: S::Online, reasoning: true, microphone: true, observation: true }, W::Host)
  val compact = W::interact(available, I::Resize({ expanded: false }), W::Person)
  val begun = W::begin(compact,
    { owner: "owner", task: "task", goal: "Read the account", origin: "https://utility.example" }, W::Person)
  val loaded = W::receiveLoad(begun, { id: begun.browser.selected,
    version: B::tabById(begun.browser, begun.browser.selected).loadVersion, result: B::Loaded }, W::Host)
  val observed = W::observe(loaded, { deviceVersion: loaded.device.contextVersion,
    browserRevision: loaded.browser.revision, taskVersion: loaded.assistant.workVersion,
    website: X::goodObservation, checkpoint: "Read the current account" }, W::Host)
  val bound = W::bindCommitment(observed, CM::exampleKey, W::Person)
  val reviewed = W::reviewCommitment(bound,
    { deviceVersion: bound.device.contextVersion, browserRevision: bound.browser.revision,
      taskVersion: bound.assistant.workVersion, review: CM::exampleReview }, W::Host)
  val changed = W::changePage(bound, BC::PageChanged({ id: bound.browser.selected, revision: bound.browser.revision }), W::Host)
  val resumed = W::resume(changed, W::Person)
  val other = W::observe(resumed, {
    deviceVersion: resumed.device.contextVersion, browserRevision: resumed.browser.revision,
    taskVersion: resumed.assistant.workVersion, checkpoint: "Read the other account",
    website: { ...X::goodObservation, generation: resumed.execution.generation, matchedAccount: "other-account" }
  }, W::Host)
  Set(W::initial, bound, reviewed, changed, other)
}
pure val transferValues = {
  val details = { key: CM::exampleKey, proposal: CM::exampleTerms, evidence: "source", version: 4 }
  val valid = wValues.map(w => { handoff: BP::ReviewPayment(details), captured: { deviceVersion: w.device.contextVersion,
    browserRevision: w.browser.revision, taskVersion: w.assistant.workVersion, revision: w.commitment.revision, attempt: w.commitment.attempt } })
  valid
    .union(valid.map(t => { ...t, handoff: BP::ReviewPayment({ ...details, version: 3 }) }))
    .union(valid.map(t => { ...t, handoff: BP::ReviewPayment({ ...details, key: { ...CM::exampleKey, account: "other-account" } }) }))
    .union(valid.map(t => { ...t, handoff: BP::ReviewPayment({ ...details, proposal: T::PayTerms({ pay: { ...CM::exampleProposal, day: 2 } }) }) }))
    .union(valid.map(t => { ...t, handoff: BP::ReviewPayment({ ...details, evidence: "other-evidence" }) }))
    .union(valid.map(t => { ...t, handoff: BP::ReviewPayment({ ...details, evidence: "" }) }))
    .union(valid.map(t => { ...t, captured: { ...t.captured, deviceVersion: t.captured.deviceVersion - 1 } }))
    .union(valid.map(t => { ...t, captured: { ...t.captured, browserRevision: t.captured.browserRevision - 1 } }))
    .union(valid.map(t => { ...t, captured: { ...t.captured, taskVersion: t.captured.taskVersion - 1 } }))
    .union(valid.map(t => { ...t, captured: { ...t.captured, revision: t.captured.revision + 1 } }))
    .union(valid.map(t => { ...t, captured: { ...t.captured, attempt: t.captured.attempt + 1 } }))
}
pure val byValues = Set(W::Host, W::Person, W::Store, W::Actuator)
```

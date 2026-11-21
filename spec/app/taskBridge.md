# Join a task's preparation to its review, its fills and its view

This stateless library connects [bill preparation](./prep.md) to the existing
[workspace review](./workspace.md), without state or a payment/review transition.
For every Prep handoff, the host must use this conversion, then consume
its result through existing `reviewCommitment` with the authenticated Host actor.
It also holds the gate the actuator checks before Grace fills a task's form, and
the step and status the person sees, read from the preparation and the
[commitment](./commitment.md) together.

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
performed equivalent provider-form/choice verification, not an alternative preparation handoff route.

```quint
import prep as P from "./prep"
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

type ScopedPreparedReview = { handoff: P::PrepEffect, captured: W::CommitmentTokens }
type ReviewConversion = ReviewDeclined | ReviewConverted({ report: W::CurrentReview })

pure def reportFromHandoff(transfer: ScopedPreparedReview): W::CurrentReview =
  val handoff = transfer.handoff
  match handoff {
    | Review(details) => {
      deviceVersion: transfer.captured.deviceVersion,
      browserRevision: transfer.captured.browserRevision,
      taskVersion: transfer.captured.taskVersion,
      review: {
        key: details.key, proposal: details.proposal, evidence: details.evidence,
        revision: transfer.captured.revision
      }
    }
  }

pure def preparationMatchesHandoff(preparation: P::Prep, transfer: ScopedPreparedReview): bool =
  val handoff = transfer.handoff
  match handoff {
    | Review(details) => preparation.live and preparation.phase == P::HandedOff and
      details.version == preparation.version and details.key == preparation.key and
      details.proposal == preparation.choice and details.evidence == preparation.evidence
  }

pure def convertPreparedReview(
  preparation: P::Prep, w: W::Workspace,
  transfer: ScopedPreparedReview, by: W::WorkspaceActor
): ReviewConversion =
  if (preparationMatchesHandoff(preparation, transfer) and W::commitmentTokensMatch(w, transfer.captured) and
      W::canReviewCommitment(w, reportFromHandoff(transfer), by))
    ReviewConverted({ report: reportFromHandoff(transfer) })
  else ReviewDeclined

pure def lawConversionKeepsCurrentChoice(
  preparation: P::Prep, w: W::Workspace,
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
  preparation: P::Prep, w: W::Workspace,
  transfer: ScopedPreparedReview, by: W::WorkspaceActor
): bool =
  val converted = convertPreparedReview(preparation, w, transfer, by)
  match converted {
  | ReviewDeclined => true
  | ReviewConverted(value) => W::commitmentTokensMatch(w, transfer.captured) and
    W::canReviewCommitment(w, value.report, by)
}

pure def lawCurrentPreparationConverts(
  preparation: P::Prep, w: W::Workspace,
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
  val begun = P::begin(P::initial, CM::exampleKey, "source", T::Person)
  val signed = P::inspectAccess(begun, { key: CM::exampleKey, version: 1, access: P::SignedIn }, T::Host)
  val facts = P::readFacts(signed, { key: CM::exampleKey, version: 2, evidence: "source", facts: K::sampleBillFacts }, T::Host)
  val chosen = P::choose(P::confirmFacts(facts, T::Person), CM::exampleTerms, T::Person)
  val verified = P::verifyForm(chosen, { ...CM::exampleReview, revision: 4 }, T::Host)
  val handed = P::handOff(verified, T::Actuator).state
  val paused = P::pause(handed, T::Person)
  Set(P::initial, chosen, verified, handed, paused, P::resume(paused, T::Person))
    .union(Set(P::decideFill(chosen, P::GraceFills, T::Person)))
    .union(Set(P::decideFill(chosen, P::PersonFills, T::Person)))
    .union(Set(P::pause(P::decideFill(chosen, P::GraceFills, T::Person), T::Host)))
    .union(Set(P::retire(handed, T::Host)))
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
    version: B::tabById(begun.browser, begun.browser.selected).loadVersion, result: B::Loaded,
    secure: false, endedAt: "https://utility.example" }, W::Host)
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
  val valid = wValues.map(w => { handoff: P::Review(details), captured: { deviceVersion: w.device.contextVersion,
    browserRevision: w.browser.revision, taskVersion: w.assistant.workVersion, revision: w.commitment.revision, attempt: w.commitment.attempt } })
  valid
    .union(valid.map(t => { ...t, handoff: P::Review({ ...details, version: 3 }) }))
    .union(valid.map(t => { ...t, handoff: P::Review({ ...details, key: { ...CM::exampleKey, account: "other-account" } }) }))
    .union(valid.map(t => { ...t, handoff: P::Review({ ...details, proposal: T::PayTerms({ pay: { ...CM::exampleProposal, day: 2 } }) }) }))
    .union(valid.map(t => { ...t, handoff: P::Review({ ...details, evidence: "other-evidence" }) }))
    .union(valid.map(t => { ...t, handoff: P::Review({ ...details, evidence: "" }) }))
    .union(valid.map(t => { ...t, captured: { ...t.captured, deviceVersion: t.captured.deviceVersion - 1 } }))
    .union(valid.map(t => { ...t, captured: { ...t.captured, browserRevision: t.captured.browserRevision - 1 } }))
    .union(valid.map(t => { ...t, captured: { ...t.captured, taskVersion: t.captured.taskVersion - 1 } }))
    .union(valid.map(t => { ...t, captured: { ...t.captured, revision: t.captured.revision + 1 } }))
    .union(valid.map(t => { ...t, captured: { ...t.captured, attempt: t.captured.attempt + 1 } }))
}
pure val byValues = Set(W::Host, W::Person, W::Store, W::Actuator)
```

## Story: Grace types into a task's form only after I said yes

> As a person doing a task on a website, I want Grace to type into the task's
> form only after I answered "Yes, fill it in", and only for the task I am on.

### A fill of a task's form needs the person's yes to the fill offer for the task being prepared

The actuator checks this gate beside the [current command check](./actuation.md)
before Grace's fill reaches the page. While a task is being prepared, Grace's
fill of a form is permitted only while the form is being prepared, the
preparation is live, the person answered "Yes, fill it in" to the fill offer,
and the fill is for the task's own owner and website. After "No, I'll do it",
before any answer, once the form has been checked or handed off, and while the
task is paused, no fill of the task's form goes through. A fill outside any
task, with no preparation begun or after the task has ended, is an ordinary
website command, which the current command check alone decides. Other kinds of
website command are not fills and this gate leaves them alone.

```quint
pure def fillPermitted(preparation: P::Prep, operation: X::WebsiteEffect): bool = match operation {
  | Operate(details) => details.kind != X::FillOrdinary or preparation.phase == P::NoTask or
      (preparation.phase == P::Preparing and preparation.live and preparation.fillBy == P::GraceFills and
       details.owner == preparation.key.owner and details.origin == preparation.key.origin)
}
pure def lawNoFillWithoutTheirYes(preparation: P::Prep, operation: X::WebsiteEffect): bool = match operation {
  | Operate(details) => (details.kind == X::FillOrdinary and preparation.phase != P::NoTask and
      preparation.fillBy != P::GraceFills) implies not(fillPermitted(preparation, operation))
}
pure def lawPausedOrCheckedFormIsNotFilled(preparation: P::Prep, operation: X::WebsiteEffect): bool = match operation {
  | Operate(details) => (details.kind == X::FillOrdinary and preparation.phase != P::NoTask and
      (not(preparation.live) or preparation.phase != P::Preparing)) implies not(fillPermitted(preparation, operation))
}
pure val operationValues = Set(
  X::Operate({ owner: CM::exampleKey.owner, task: "task", origin: CM::exampleKey.origin, generation: 1, observation: 1,
    target: "control", valueRef: "value", kind: X::FillOrdinary }),
  X::Operate({ owner: CM::exampleKey.owner, task: "task", origin: "https://credit.example", generation: 1, observation: 1,
    target: "control", valueRef: "value", kind: X::FillOrdinary }),
  X::Operate({ owner: "other-owner", task: "task", origin: CM::exampleKey.origin, generation: 1, observation: 1,
    target: "control", valueRef: "value", kind: X::FillOrdinary }),
  X::Operate({ owner: CM::exampleKey.owner, task: "task", origin: CM::exampleKey.origin, generation: 1, observation: 1,
    target: "control", valueRef: "", kind: X::Choose }))
```

## Story: See where my task stands

> As a person in the middle of a task, I want to see the step it is on and
> whether it waits for me, waits for the website, is done, did not go through
> or could not continue.

### The step shown is on the task's plan: the preparation's step until the hand-off, then the commitment's

Before the hand-off the step follows the preparation: choosing what the task is
about, signing in, reading the facts (also while nothing is needed, something is
already under way or the task is blocked), the yes to the facts, the choice, the
fill offer, and the form, then the review once the form is checked. After the
hand-off the step follows this task's own commitment: the consent while the
window is open, the submission once she has said yes, the outcome while it is
being checked, and, once it is resolved, recording in the calendar for a kind
that records there and the outcome otherwise; before the commitment reaches its
window, or when the commitment belongs to another subject, the step is the
review. The step of a begun task is always one of its kind's plan.

```quint
pure def joined(preparation: P::Prep, c: CM::Commitment): bool = c.stage != CM::Empty and c.key == preparation.key
pure def currentStep(preparation: P::Prep, c: CM::Commitment): K::StepKind =
  if (preparation.phase == P::HandedOff) (
    if (joined(preparation, c) and c.stage == CM::Guarded) K::ConsentStep
    else if (joined(preparation, c) and c.stage == CM::Authorized) K::SubmitStep
    else if (joined(preparation, c) and c.stage == CM::Checking) K::OutcomeStep
    else if (joined(preparation, c) and c.stage == CM::Resolved) (if (T::recordsInCalendar(preparation.key.kind)) K::RecordStep else K::OutcomeStep)
    else K::ReviewStep)
  else if (preparation.phase == P::NoTask) K::SourceStep
  else if (preparation.phase == P::NeedsAccess) K::AccessStep
  else if (preparation.phase == P::Choosing and not(preparation.factsConfirmed)) K::ConfirmStep
  else if (preparation.phase == P::Choosing) K::ChoiceStep
  else if (preparation.phase == P::Preparing and preparation.fillBy == P::NotAsked) K::FillStep
  else if (preparation.phase == P::Preparing) K::FormStep
  else if (preparation.phase == P::ReadyForReview) K::ReviewStep
  else K::FactsStep
pure def lawTheStepIsOnThePlan(preparation: P::Prep, c: CM::Commitment): bool =
  preparation.phase != P::NoTask implies K::plan(preparation.key.kind).includes(currentStep(preparation, c))
pure val cValues = {
  val bound = CM::bind(CM::initial, CM::exampleKey, T::Person)
  val reviewed = { ...bound, proposal: CM::exampleTerms, stage: CM::Reviewed, evidence: "source", revision: 1 }
  val guarded = { ...reviewed, stage: CM::Guarded, result: CM::Unknown, attempt: 1,
    durable: { result: CM::Unknown, evidence: "source", reference: "" } }
  val checking = { ...guarded, stage: CM::Checking, dispatched: true, revision: 2 }
  val completed = { ...checking, stage: CM::Resolved, result: CM::Completed, reference: "receipt", revision: 3 }
  val saved = { ...completed, durable: { result: CM::Completed, evidence: "source", reference: "receipt" } }
  val failed = { ...checking, stage: CM::Resolved, result: CM::VerifiedFailure, revision: 3 }
  Set(CM::initial, bound, guarded, checking, completed, saved, failed)
    .union(Set({ ...guarded, stage: CM::Authorized }))
    .union(Set({ ...saved, result: CM::Returned, reference: "" }))
    .union(Set({ ...checking, live: false }))
    .union(Set({ ...saved, key: { ...CM::exampleKey, account: "other-account" } }))
}
```

### The task is done only once a positive outcome and its reference are saved

The status is read in this order. It did not go through when this task's own
commitment is resolved with a verified failure or a return. It is done when
that commitment is resolved and its saved outcome is positive with a reference.
Otherwise it is stopped when no task is being prepared, the preparation is
paused, or the commitment is paused; it could not continue when the
preparation is blocked; it waits for the website while the outcome is being
checked; it waits for the person while the step is signing in, the yes to the
facts, the choice, the fill offer or the consent; and it is in progress
otherwise. An outcome that is positive but not yet saved is not done.

```quint
type TaskStatus = InProgress | WaitingForPerson | Stopped | WaitingForProvider | Done | DidNotGoThrough | CouldNotContinue
pure def waitsForPerson(shown: K::StepKind): bool =
  shown == K::AccessStep or shown == K::ConfirmStep or shown == K::ChoiceStep or shown == K::FillStep or shown == K::ConsentStep
pure def taskStatus(preparation: P::Prep, c: CM::Commitment): TaskStatus =
  val mine = joined(preparation, c)
  if (mine and c.stage == CM::Resolved and (c.result == CM::VerifiedFailure or c.result == CM::Returned)) DidNotGoThrough
  else if (mine and c.stage == CM::Resolved and CM::positiveOutcome(c.durable.result) and c.durable.reference != "") Done
  else if (preparation.phase == P::NoTask or not(preparation.live) or (mine and not(c.live))) Stopped
  else if (preparation.phase == P::Blocked) CouldNotContinue
  else if (mine and c.stage == CM::Checking) WaitingForProvider
  else if (waitsForPerson(currentStep(preparation, c))) WaitingForPerson
  else InProgress
pure def lawDoneMeansASavedPositiveOutcome(preparation: P::Prep, c: CM::Commitment): bool =
  taskStatus(preparation, c) == Done implies
    (c.key == preparation.key and c.stage == CM::Resolved and CM::positiveOutcome(c.durable.result) and c.durable.reference != "")
```

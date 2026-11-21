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

Until the current review opens its own submission window, the preparation shows
the source, access, facts, confirmation, choice, fill offer, form or review.
A saved attempt for the same bill or booking can still be inspected separately.

The host retains the original hand-off and the assistant's task ID when its
converted review is accepted by Workspace. At the successful journal acknowledgement
it uses that receipt to link the new attempt. It checks the reviewed revision,
the incremented attempt, the terms and the evidence of that hand-off. Later
steps read the commitment only through this link. A different preparation,
task or attempt cannot pick it up. A guarded window shows consent, authorization
shows submission, and checking or a failed or returned attempt shows outcome.
Only a successful booking advances to recording in Calendar.

```quint
import assistant as A from "./assistant"

type AcceptedTaskReview = { task: str, transfer: ScopedPreparedReview }
type TaskAttemptLink = { task: str, key: T::Subject, preparationVersion: int, attempt: int }
type TaskProgress = NoLinkedAttempt | Following({ link: TaskAttemptLink }) | FinishedAttempt({ link: TaskAttemptLink })
type TaskView = { preparation: P::Prep, workspace: W::Workspace, progress: TaskProgress }

pure def journaledTaskAttempt(preparation: P::Prep, w: W::Workspace, accepted: AcceptedTaskReview): TaskProgress =
  val c = w.commitment
  val captured = accepted.transfer.captured
  if (preparationMatchesHandoff(preparation, accepted.transfer) and W::currentCommitmentContext(w) and
      accepted.task != "" and accepted.task == w.commitmentTask and c.stage == CM::Guarded and
      c.key == preparation.key and c.proposal == preparation.choice and c.evidence == preparation.evidence and
      c.revision == captured.revision + 1 and c.attempt == captured.attempt + 1)
    Following({ link: { task: accepted.task, key: c.key, preparationVersion: preparation.version, attempt: c.attempt } })
  else NoLinkedAttempt

pure def sameAttempt(view: TaskView, link: TaskAttemptLink): bool =
  link.task != "" and view.workspace.commitmentTask == link.task and view.workspace.assistant.taskId == link.task and
  view.preparation.key == link.key and view.workspace.commitment.key == link.key and
  link.attempt > 0 and view.workspace.commitment.attempt == link.attempt

pure def finishedWithReceipt(w: W::Workspace): bool =
  val c = w.commitment
  w.assistant.activity == A::Finished and c.stage == CM::Resolved and
    c.evidence != "" and w.assistant.evidence == c.evidence and not(CM::outcomeNeedsSave(c)) and
    (if (CM::positiveOutcome(c.result)) w.assistant.outcome == A::Completed and c.reference != ""
     else (c.result == CM::VerifiedFailure or c.result == CM::Returned) and w.assistant.outcome == A::VerifiedFailure)

pure def joined(view: TaskView): bool =
  val progress = view.progress
  match progress {
    | NoLinkedAttempt => false
    | Following(run) => sameAttempt(view, run.link) and view.preparation.phase == P::HandedOff and
        view.preparation.version == run.link.preparationVersion and view.workspace.assistant.outcome != A::Abandoned
    | FinishedAttempt(run) => sameAttempt(view, run.link) and view.preparation.phase == P::NoTask and
        view.preparation.version == run.link.preparationVersion + 1 and finishedWithReceipt(view.workspace)
  }

pure def progressAtEnd(view: TaskView, by: T::TaskActor): TaskProgress =
  val progress = view.progress
  match progress {
    | Following(run) => if (by == T::Host and joined(view) and finishedWithReceipt(view.workspace))
        FinishedAttempt({ link: run.link }) else NoLinkedAttempt
    | _ => NoLinkedAttempt
  }

pure def preparationStep(preparation: P::Prep): K::StepKind =
  if (preparation.phase == P::NoTask) K::SourceStep
  else if (preparation.phase == P::NeedsAccess) K::AccessStep
  else if (preparation.phase == P::Choosing and not(preparation.factsConfirmed)) K::ConfirmStep
  else if (preparation.phase == P::Choosing) K::ChoiceStep
  else if (preparation.phase == P::Preparing and preparation.fillBy == P::NotAsked) K::FillStep
  else if (preparation.phase == P::Preparing) K::FormStep
  else if (preparation.phase == P::ReadyForReview or preparation.phase == P::HandedOff) K::ReviewStep
  else K::FactsStep

pure def currentStep(view: TaskView): K::StepKind =
  val c = view.workspace.commitment
  if (not(joined(view))) preparationStep(view.preparation)
  else if (c.stage == CM::Guarded) K::ConsentStep
  else if (c.stage == CM::Authorized) K::SubmitStep
  else if (c.stage == CM::Resolved and CM::positiveOutcome(c.result) and T::recordsInCalendar(c.key.kind)) K::RecordStep
  else if (c.stage == CM::Checking or c.stage == CM::Resolved) K::OutcomeStep
  else K::ReviewStep

pure def lawTheStepIsOnThePlan(view: TaskView): bool =
  view.preparation.phase != P::NoTask implies K::plan(view.preparation.key.kind).includes(currentStep(view))
pure def lawARejectedOrReturnedTaskShowsTheOutcome(view: TaskView): bool =
  val c = view.workspace.commitment
  (joined(view) and c.stage == CM::Resolved and (c.result == CM::VerifiedFailure or c.result == CM::Returned))
    implies currentStep(view) == K::OutcomeStep
```

### The task is done only once a positive outcome and its reference are saved

A linked attempt with a verified failure or return did not go through. A positive
outcome is done when its current result, evidence and reference are all saved.
During a person's form entry the task waits for them. A paused task is stopped,
a blocked preparation could not continue, and an attempt being checked waits
for the website.

When ending a task the host takes the link returned by `progressAtEnd` in the
same operation as retiring its preparation. It keeps a reference only when
Workspace already finished that very attempt with matching durable evidence.
Cancellation, abandonment and replacement keep no receipt on the task view.
A new begin on the same subject and a later attempt cannot inherit the old status.
The durable commitment stays with its subject.

```quint
type TaskStatus = InProgress | WaitingForPerson | Stopped | WaitingForProvider | Done | DidNotGoThrough | CouldNotContinue
pure def waitsForPerson(shown: K::StepKind): bool =
  shown == K::AccessStep or shown == K::ConfirmStep or shown == K::ChoiceStep or shown == K::FillStep or shown == K::ConsentStep

pure def taskStatus(view: TaskView): TaskStatus =
  val p = view.preparation
  val c = view.workspace.commitment
  val mine = joined(view)
  if (mine and c.stage == CM::Resolved and (c.result == CM::VerifiedFailure or c.result == CM::Returned)) DidNotGoThrough
  else if (mine and c.stage == CM::Resolved and CM::positiveOutcome(c.result) and c.reference != "" and not(CM::outcomeNeedsSave(c))) Done
  else if (p.phase == P::NoTask or not(p.live) or (mine and not(c.live))) Stopped
  else if (p.phase == P::Blocked) CouldNotContinue
  else if (mine and c.stage == CM::Checking) WaitingForProvider
  else if (waitsForPerson(currentStep(view)) or (p.phase == P::Preparing and p.fillBy == P::PersonFills)) WaitingForPerson
  else InProgress

pure def lawDoneMeansASavedPositiveOutcome(view: TaskView): bool =
  val c = view.workspace.commitment
  taskStatus(view) == Done implies
    (joined(view) and c.stage == CM::Resolved and CM::positiveOutcome(c.result) and c.reference != "" and not(CM::outcomeNeedsSave(c)))
pure def lawUnlinkedResultsCannotFinishThePreparation(view: TaskView): bool =
  not(joined(view)) implies (currentStep(view) == preparationStep(view.preparation) and
    taskStatus(view) != Done and taskStatus(view) != DidNotGoThrough and taskStatus(view) != WaitingForProvider)
pure def lawWaitingForTheirFormEntry(view: TaskView): bool =
  (view.preparation.phase == P::Preparing and view.preparation.live and view.preparation.fillBy == P::PersonFills)
    implies taskStatus(view) == WaitingForPerson
pure def lawCancellationEndsTheTaskView(view: TaskView): bool =
  val ended = { ...view, preparation: P::retire(view.preparation, view.preparation.version, T::Person), progress: progressAtEnd(view, T::Person) }
  P::canRetire(view.preparation, view.preparation.version, T::Person) implies taskStatus(ended) == Stopped

pure def lawEndingTheFinishedRunKeepsItsReceipt(view: TaskView): bool =
  val ended = { ...view, preparation: P::retire(view.preparation, view.preparation.version, T::Host), progress: progressAtEnd(view, T::Host) }
  (joined(view) and view.preparation.phase == P::HandedOff and finishedWithReceipt(view.workspace))
    implies (joined(ended) and taskStatus(ended) == taskStatus(view))

pure def viewTokens(w: W::Workspace): W::CommitmentTokens =
  { deviceVersion: w.device.contextVersion, browserRevision: w.browser.revision, taskVersion: w.assistant.workVersion,
    revision: w.commitment.revision, attempt: w.commitment.attempt }

pure val formForView = {
  val begun = P::begin(P::initial, CM::exampleKey, "source", T::Person)
  val signed = P::inspectAccess(begun, { key: begun.key, version: begun.version, access: P::SignedIn }, T::Host)
  val facts = P::readFacts(signed, { key: signed.key, version: signed.version, evidence: "source", facts: K::sampleBillFacts }, T::Host)
  P::choose(P::confirmFacts(facts, T::Person), CM::exampleTerms, T::Person)
}
pure val guardedViewValues = wValues.filter(w => w.commitment.stage == CM::Draft and W::currentCommitmentContext(w)).map(w => {
  val form = P::verifyForm(formForView, { ...CM::exampleReview, revision: formForView.version }, T::Host)
  val handed = P::handOff(form, T::Actuator)
  val transfer = { handoff: handed.out.nth(0), captured: viewTokens(w) }
  val converted = convertPreparedReview(handed.state, w, transfer, W::Host)
  match converted {
    | ReviewDeclined => { preparation: handed.state, workspace: w, progress: NoLinkedAttempt }
    | ReviewConverted(delivered) => {
      val reviewed = W::reviewCommitment(w, delivered.report, W::Host)
      val readBack = W::readBackCommitment(reviewed, viewTokens(reviewed), W::Host)
      val guarded = W::journalCommitment(readBack, viewTokens(readBack), true, W::Store)
      { preparation: handed.state, workspace: guarded,
        progress: journaledTaskAttempt(handed.state, guarded, { task: reviewed.commitmentTask, transfer: transfer }) }
    }
  }
})
pure val checkingViewValues = guardedViewValues.map(v =>
  { ...v, workspace: W::observeCommitmentTap(v.workspace, viewTokens(v.workspace), W::Host) })
pure def outcomeView(view: TaskView, result: CM::Outcome): TaskView =
  val w = view.workspace
  val report = { ...CM::exampleOutcome, key: w.commitment.key, revision: w.commitment.revision,
    attempt: w.commitment.attempt, result: result, reference: if (CM::positiveOutcome(result)) "receipt" else "" }
  { ...view, workspace: W::recordCommitment(w, { deviceVersion: w.device.contextVersion,
    browserRevision: w.browser.revision, taskVersion: w.assistant.workVersion, report: report }, W::Host) }
pure val observedViewValues = checkingViewValues.map(v => outcomeView(v, CM::Completed))
  .union(checkingViewValues.map(v => outcomeView(v, CM::VerifiedFailure)))
pure val savedViewValues = observedViewValues.map(v => { ...v, workspace: W::saveCommitment(v.workspace, {
  key: v.workspace.commitment.key, revision: v.workspace.commitment.revision, succeeded: true }, W::Store) })
pure val endedViewValues = savedViewValues.map(v => { ...v, progress: progressAtEnd(v, T::Host),
  preparation: P::retire(v.preparation, v.preparation.version, T::Host) })
pure val viewValues = guardedViewValues.union(checkingViewValues).union(observedViewValues)
  .union(savedViewValues).union(endedViewValues)
  .union(endedViewValues.map(v => { ...v, preparation: P::begin(v.preparation, v.preparation.key, "another request", T::Person) }))
  .union(guardedViewValues.map(v => { ...v, preparation: P::decideFill(formForView, P::PersonFills, formForView.version, T::Person) }))
  .union(guardedViewValues.map(v => { ...v, workspace: W::abandonTask(v.workspace, W::Person),
    preparation: P::retire(v.preparation, v.preparation.version, T::Person), progress: progressAtEnd(v, T::Person) }))
```

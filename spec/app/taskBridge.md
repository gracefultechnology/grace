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
pure val sampleChosenPreparation = {
  val begun = P::begin(P::initial, CM::exampleKey, "source", T::Person)
  val signed = P::inspectAccess(begun, { key: CM::exampleKey, version: 1, access: P::SignedIn }, T::Host)
  val facts = P::readFacts(signed, { key: CM::exampleKey, version: 2, evidence: "source", facts: K::sampleBillFacts }, T::Host)
  P::choose(P::confirmFacts(facts, T::Person), CM::exampleTerms, T::Person)
}
pure val preparationValues = {
  val chosen = sampleChosenPreparation
  val yes = P::decideFill(chosen, P::GraceFills, chosen.version, T::Person)
  val no = P::decideFill(yes, P::PersonFills, yes.version, T::Person)
  val verified = P::verifyForm(chosen, { ...CM::exampleReview, revision: 4 }, T::Host)
  val handed = P::handOff(verified, T::Actuator).state
  val paused = P::pause(handed, T::Person)
  Set(P::initial, chosen, verified, handed, paused, P::resume(paused, T::Person))
    .union(Set(yes, no, P::decideFill(no, P::GraceFills, no.version, T::Person)))
    .union(Set(P::pause(yes, T::Host), P::retire(handed, handed.version, T::Host)))
}
pure val sampleLoadedTask = {
  val started = W::changeLifecycle(W::initial, W::StartupSucceeded, W::Host)
  val opened = W::openGrace(W::visit(started, S::Browser, W::Person), W::Person)
  val allowed = W::setBrowserObservation(opened, { allowed: true,
    deviceVersion: opened.device.contextVersion, browserRevision: opened.browser.revision }, W::Person)
  val available = W::setAvailability(allowed,
    { connection: S::Online, reasoning: true, microphone: true, observation: true }, W::Host)
  val compact = W::interact(available, I::Resize({ expanded: false }), W::Person)
  val begun = W::begin(compact,
    { owner: "owner", task: "task", goal: "Read the account", origin: "https://utility.example" }, W::Person)
  W::receiveLoad(begun, { id: begun.browser.selected,
    version: B::tabById(begun.browser, begun.browser.selected).loadVersion, result: B::Loaded,
    secure: false, endedAt: "https://utility.example" }, W::Host)
}
pure val wValues = {
  val loaded = sampleLoadedTask
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

When the host queues a website command it keeps the complete emitted Workspace
effect, the current preparation version and where the write came from. A fill
issued outside a task keeps that origin. A task fill carries the identity of
the assistant task that owns this preparation, the full verified provider
subject (including account and bill or appointment reference), and the typed
values for that form. The host captures this once from the owning task and
page. It must not assign a new origin or version when it claims the entry.

At the page, the actuator must still have the [current Workspace command](./actuation.md).
For a task fill it independently resolves that command's target and value
reference on the current verified form. The read names the exact command,
provider subject and typed values the actuator would write. A field written
individually must resolve to the corresponding field and value of that form
fill. A missing or ambiguous mapping, account, or subject cannot produce a
verified read. The actuator checks the result immediately before writing,
without an intervening navigation, account change or edit.

Only a live preparation with the person's current “Yes, fill it in” can supply
those exact values. A changed answer, choice, pause, retirement or replacement
withdraws the old write even if the person later chooses the same values.
An ordinary fill may proceed outside a task only at the version where it was
queued. Other commands keep their existing Workspace checks. This rule defines
the actuator's contract; the host supplies and verifies the page evidence.

```quint
import actuation as AC from "./actuation"

type FillSource = OutsidePreparation | TaskForm({ task: str, key: T::Subject, fill: K::Fill })
type QueuedWebsiteCommand = { command: W::WorkspaceEffect, prepVersion: int, source: FillSource }
type FormRead = NoTaskForm | VerifiedForm({ command: W::WorkspaceEffect, key: T::Subject, fill: K::Fill })

pure def captureWebsiteCommand(preparation: P::Prep, command: W::WorkspaceEffect, preparedTask: str): QueuedWebsiteCommand =
  { command: command, prepVersion: preparation.version,
    source: if (preparation.phase == P::NoTask) OutsidePreparation
      else TaskForm({ task: preparedTask, key: preparation.key, fill: K::fillOf(preparation.choice) }) }

pure def formFillCommand(command: W::WorkspaceEffect): bool = match command {
  | Execute(details) => {
    val operation = details.effect
    match operation { | Operate(action) => action.kind == X::FillOrdinary }
  }
  | _ => false
}
pure def fillPermitted(
  preparation: P::Prep, fillWorkspace: W::Workspace, queued: QueuedWebsiteCommand, read: FormRead, by: W::WorkspaceActor
): bool = {
  val source = queued.source
  AC::currentEffect(fillWorkspace, queued.command, by) and
    (not(formFillCommand(queued.command)) or (
      queued.prepVersion == preparation.version and match source {
        | OutsidePreparation => preparation.phase == P::NoTask and read == NoTaskForm
        | TaskForm(taskForm) => match read {
          | NoTaskForm => false
          | VerifiedForm(verified) => verified.command == queued.command and verified.key == taskForm.key and
              taskForm.key == preparation.key and taskForm.task == fillWorkspace.execution.task and
              taskForm.key.owner == fillWorkspace.execution.owner and taskForm.key.origin == fillWorkspace.execution.origin and
              taskForm.key.account == fillWorkspace.execution.matchedAccount and verified.fill == taskForm.fill and
              P::graceMayFill(preparation, verified.fill)
        }
      }))
}
pure def lawNoFillWithoutTheirYes(
  preparation: P::Prep, fillWorkspace: W::Workspace, queued: QueuedWebsiteCommand, read: FormRead
): bool =
  (formFillCommand(queued.command) and (preparation.phase != P::NoTask or queued.source != OutsidePreparation) and
    preparation.fillBy != P::GraceFills)
    implies not(fillPermitted(preparation, fillWorkspace, queued, read, W::Actuator))
pure def lawPausedOrCheckedFormIsNotFilled(
  preparation: P::Prep, fillWorkspace: W::Workspace, queued: QueuedWebsiteCommand, read: FormRead
): bool =
  (formFillCommand(queued.command) and (preparation.phase != P::NoTask or queued.source != OutsidePreparation) and
    (not(preparation.live) or preparation.phase != P::Preparing))
    implies not(fillPermitted(preparation, fillWorkspace, queued, read, W::Actuator))
pure def lawAnOldFillCannotGainFreshConsent(
  preparation: P::Prep, fillWorkspace: W::Workspace, queued: QueuedWebsiteCommand, read: FormRead
): bool =
  (formFillCommand(queued.command) and queued.prepVersion != preparation.version)
    implies not(fillPermitted(preparation, fillWorkspace, queued, read, W::Actuator))
pure def lawATaskFillUsesItsOwnVerifiedForm(
  preparation: P::Prep, fillWorkspace: W::Workspace, queued: QueuedWebsiteCommand, read: FormRead
): bool = {
  val source = queued.source
  (formFillCommand(queued.command) and fillPermitted(preparation, fillWorkspace, queued, read, W::Actuator))
    implies match source {
      | OutsidePreparation => preparation.phase == P::NoTask and read == NoTaskForm
      | TaskForm(taskForm) => taskForm.key == preparation.key and taskForm.task == fillWorkspace.assistant.taskId and
          taskForm.key.account == fillWorkspace.execution.matchedAccount and
          read == VerifiedForm({ command: queued.command, key: taskForm.key, fill: taskForm.fill }) and
          P::graceMayFill(preparation, taskForm.fill)
    }
}

pure val sampleFieldWrite = {
  val loaded = sampleLoadedTask
  val observed = W::observe(loaded, { deviceVersion: loaded.device.contextVersion, browserRevision: loaded.browser.revision,
    taskVersion: loaded.assistant.workVersion, checkpoint: "Read the payment form", website: { ...X::goodObservation,
      generation: loaded.execution.generation, targets: List({ id: "bill-amount", consequence: X::AskFirst, inReach: true }) } }, W::Host)
  val queued = W::prepare(observed, AC::sampleOperationRequest(observed, "bill-amount", "chosen-payment", X::FillOrdinary), W::Host)
  W::dispatch(queued, AC::sampleOperationTokens(queued), W::Actuator)
}
pure val fillWorkspaceValues = Set(sampleFieldWrite.state, W::initial, AC::ordinarySample(AC::observedSample(W::initial)).state)
pure val sampleQueuedFill = {
  val yes = P::decideFill(sampleChosenPreparation, P::GraceFills, sampleChosenPreparation.version, T::Person)
  captureWebsiteCommand(yes, sampleFieldWrite.out.nth(0), "task")
}
pure val queuedValues = Set(sampleQueuedFill,
  captureWebsiteCommand(P::initial, sampleFieldWrite.out.nth(0), ""),
  { ...sampleQueuedFill, source: TaskForm({ task: "other-task", key: CM::exampleKey, fill: K::fillOf(CM::exampleTerms) }) },
  { ...sampleQueuedFill, command: AC::ordinarySample(AC::observedSample(W::initial)).out.nth(0) })
pure val readValues = {
  val original = { command: sampleQueuedFill.command, key: CM::exampleKey, fill: K::fillOf(CM::exampleTerms) }
  Set(NoTaskForm, VerifiedForm(original),
    VerifiedForm({ ...original, key: { ...CM::exampleKey, account: "other-account" } }),
    VerifiedForm({ ...original, key: { ...CM::exampleKey, ref: "other-bill" } }),
    VerifiedForm({ ...original, fill: K::fillOf(T::PayTerms({ pay: { ...CM::exampleProposal, day: 2 } })) }),
    VerifiedForm({ ...original, command: AC::ordinarySample(AC::observedSample(W::initial)).out.nth(0) }))
}
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

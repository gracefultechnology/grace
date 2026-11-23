# Join a task's preparation to its review, its fills and its view

This library connects [task preparation](./prep.md) to the existing
[workspace review](./workspace.md), without a payment or review transition of
its own. The host keeps each queued website command with its original fill
source and preparation version. It retains the accepted handoff and task ID
until the journal acknowledges the matching attempt, then follows that attempt
through its progress link. On retirement the host keeps the link only if
Workspace has finished that attempt with matching durable evidence.
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
import bookingKind as VK from "./bookingKind"
import commitment as CM from "./commitment"
import task as T from "./task"
import taskKinds as K from "./taskKinds"
import workspace as WS from "./workspace"
import interaction as I from "./interaction"
import shell as S from "./shell"
import browser as B from "./browser"
import browserControls as BC from "./browserControls"
import execution as X from "./execution"

type ScopedPreparedReview = { handoff: P::PrepEffect, captured: WS::CommitmentTokens }
type ReviewConversion = ReviewDeclined | ReviewConverted({ report: WS::CurrentReview })

pure def reportFromHandoff(transfer: ScopedPreparedReview): WS::CurrentReview =
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
  preparation: P::Prep, w: WS::Workspace,
  transfer: ScopedPreparedReview, by: WS::WorkspaceActor
): ReviewConversion =
  if (preparationMatchesHandoff(preparation, transfer) and WS::commitmentTokensMatch(w, transfer.captured) and
      WS::canReviewCommitment(w, reportFromHandoff(transfer), by))
    ReviewConverted({ report: reportFromHandoff(transfer) })
  else ReviewDeclined

pure def lawConversionKeepsCurrentChoice(
  preparation: P::Prep, w: WS::Workspace,
  transfer: ScopedPreparedReview, by: WS::WorkspaceActor
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
  preparation: P::Prep, w: WS::Workspace,
  transfer: ScopedPreparedReview, by: WS::WorkspaceActor
): bool =
  val converted = convertPreparedReview(preparation, w, transfer, by)
  match converted {
  | ReviewDeclined => true
  | ReviewConverted(value) => WS::commitmentTokensMatch(w, transfer.captured) and
    WS::canReviewCommitment(w, value.report, by)
}

pure def lawCurrentPreparationConverts(
  preparation: P::Prep, w: WS::Workspace,
  transfer: ScopedPreparedReview, by: WS::WorkspaceActor
): bool =
  val converted = convertPreparedReview(preparation, w, transfer, by)
  (preparationMatchesHandoff(preparation, transfer) and WS::commitmentTokensMatch(w, transfer.captured) and
    WS::canReviewCommitment(w, reportFromHandoff(transfer), by)) implies match converted {
      | ReviewDeclined => false
      | ReviewConverted(value) => value.report == reportFromHandoff(transfer)
    }
```

### Finite examples cover a current handoff and retired source or destination versions

A preparation handed off at version 4 converts when the current workspace can
accept its payment revision and attempt. An unbound task, a changed page or a
different account can prevent conversion. The examples also cover a paused,
resumed or retired preparation, a yes or no to filling, and stale payloads or
captured tokens. A booking is handed off the same way, at the same preparation
version, and converts only for a workspace bound to that booking. Runtime
values range beyond these finite simulation examples.

```quint
pure val preparationValues = {
  val begun = P::begin(P::initial, CM::exampleKey, "source", T::Person)
  val signed = P::inspectAccess(begun, { key: CM::exampleKey, version: 1, access: P::SignedIn }, T::Host)
  val facts = P::readFacts(signed, { key: CM::exampleKey, version: 2, evidence: "source", facts: K::sampleBillFacts }, T::Host)
  val chosen = P::choose(P::confirmFacts(facts, T::Person), CM::exampleTerms, T::Person)
  val yes = P::decideFill(chosen, P::GraceFills, chosen.version, T::Person)
  val no = P::decideFill(yes, P::PersonFills, yes.version, T::Person)
  val verified = P::verifyForm(chosen, { ...CM::exampleReview, revision: 4 }, T::Host)
  val handed = P::handOff(verified, T::Actuator).state
  val paused = P::pause(handed, T::Person)
  val visitBegun = P::begin(P::initial, K::sampleVisitKey, "source", T::Person)
  val visitSigned = P::inspectAccess(visitBegun, { key: K::sampleVisitKey, version: 1, access: P::SignedIn }, T::Host)
  val visitFacts = P::readFacts(visitSigned, { key: K::sampleVisitKey, version: 2, evidence: "source", facts: K::sampleVisitFacts }, T::Host)
  val visitChosen = P::choose(P::confirmFacts(visitFacts, T::Person), K::sampleBookTerms, T::Person)
  val visitVerified = P::verifyForm(visitChosen, { key: K::sampleVisitKey, proposal: K::sampleBookTerms, revision: 4, evidence: "source" }, T::Host)
  Set(P::initial, chosen, verified, handed, paused, P::resume(paused, T::Person))
    .union(Set(yes, no, P::decideFill(no, P::GraceFills, no.version, T::Person)))
    .union(Set(P::pause(yes, T::Host), P::retire(handed, handed.version, T::Host)))
    .union(Set(visitChosen, P::handOff(visitVerified, T::Actuator).state))
}
pure def exampleLoadedWorkspace(starting: WS::Workspace): WS::Workspace = {
  val started = WS::changeLifecycle(starting, WS::StartupSucceeded, WS::Host)
  val opened = WS::openGrace(WS::visit(started, S::Browser, WS::Person), WS::Person)
  val allowed = WS::setBrowserObservation(opened, { allowed: true,
    deviceVersion: opened.device.contextVersion, browserRevision: opened.browser.revision }, WS::Person)
  val available = WS::setAvailability(allowed,
    { connection: S::Online, reasoning: true, microphone: true, observation: true }, WS::Host)
  val compact = WS::interact(available, I::Resize({ expanded: false }), WS::Person)
  val begun = WS::begin(compact,
    { owner: "owner", task: "task", goal: "Read the account", origin: "https://utility.example" }, WS::Person)
  WS::receiveLoad(begun, { id: begun.browser.selected,
    version: B::tabById(begun.browser, begun.browser.selected).loadVersion, result: B::Loaded,
    secure: false, endedAt: "https://utility.example" }, WS::Host)
}
pure val wValues = {
  val loaded = exampleLoadedWorkspace(WS::initial)
  val observed = WS::observe(loaded, { deviceVersion: loaded.device.contextVersion,
    browserRevision: loaded.browser.revision, taskVersion: loaded.assistant.workVersion,
    website: X::goodObservation, checkpoint: "Read the current account" }, WS::Host)
  val bound = WS::bindCommitment(observed, CM::exampleKey, WS::Person)
  val boundVisit = WS::bindCommitment(observed, K::sampleVisitKey, WS::Person)
  val reviewed = WS::reviewCommitment(bound,
    { deviceVersion: bound.device.contextVersion, browserRevision: bound.browser.revision,
      taskVersion: bound.assistant.workVersion, review: CM::exampleReview }, WS::Host)
  val changed = WS::changePage(bound, BC::PageChanged({ id: bound.browser.selected, revision: bound.browser.revision }), WS::Host)
  val resumed = WS::resume(changed, WS::Person)
  val other = WS::observe(resumed, {
    deviceVersion: resumed.device.contextVersion, browserRevision: resumed.browser.revision,
    taskVersion: resumed.assistant.workVersion, checkpoint: "Read the other account",
    website: { ...X::goodObservation, generation: resumed.execution.generation, matchedAccount: "other-account" }
  }, WS::Host)
  Set(WS::initial, loaded, bound, reviewed, changed, other, boundVisit)
}
pure val transferValues = {
  val details = { key: CM::exampleKey, proposal: CM::exampleTerms, evidence: "source", version: 4 }
  val valid = wValues.map(w => { handoff: P::Review(details), captured: { deviceVersion: w.device.contextVersion,
    browserRevision: w.browser.revision, taskVersion: w.assistant.workVersion, revision: w.commitment.revision, attempt: w.commitment.attempt } })
  val visit = { key: K::sampleVisitKey, proposal: K::sampleBookTerms, evidence: "source", version: 4 }
  valid
    .union(valid.map(t => { ...t, handoff: P::Review(visit) }))
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
pure val byValues = Set(WS::Host, WS::Person, WS::Store, WS::Actuator)
```

## Story: Grace types into a task's form only after I said yes

> As a person doing a task on a website, I want Grace to type into the task's
> form only after I answered "Yes, fill it in", and only for the task I am on.

### A fill of a task's form needs the person's yes to the fill offer for the task being prepared

When the host queues a website command it keeps the complete emitted Workspace
effect, the current preparation version and where the write came from. A fill
here is Grace typing an ordinary form value (`FillOrdinary`), not a sign-in
identifier or a private entry; choosing, navigating and every other operation
keep their existing Workspace checks. A fill issued outside a task keeps that
origin. A task fill carries the identity of
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

For a booking, the queued write keeps the exact field target, an opaque value
reference and the version after the person's answer. A time field identifies
the chosen slot. A personal detail field names one of the requested kinds.
At write time the actuator independently resolves the target on the current
form and checks the original receipt against the person's [current saved
details](./memoryActuation.md). The receipt must still authorize the same
command, task, origin, owner and value reference, and the stored detail must
have the kind she approved for this field. A correction or deletion revokes
the fill. The queued command carries only the field binding.

Only a live preparation with the person's current “Yes, fill it in” can supply
those exact values. A changed answer, choice, pause, retirement or replacement
withdraws the old write even if the person later chooses the same values.
An ordinary fill may proceed outside a task only at the version where it was
queued. Other commands keep their existing Workspace checks. This rule defines
the actuator's contract; the host supplies and verifies the page evidence.

```quint
import actuation as AC from "./actuation"
import conversation as C from "./conversation"
import preferences as R from "./preferences"
import wake as W from "./wake"
import memory as M from "./memory"
import savedDetails as SD from "./savedDetails"
import memoryActuation as MA from "./memoryActuation"

type BookingDetailBinding = { target: str, valueRef: str, detail: str, answerVersion: int }
type BookingField = NoBookingField
  | BookingTimeField({ target: str, valueRef: str, slot: T::Slot, answerVersion: int })
  | BookingSavedField(BookingDetailBinding)
type FillSource = OutsidePreparation | TaskForm({ task: str, key: T::Subject, fill: K::Fill, bookingField: BookingField })
type QueuedWebsiteCommand = { command: WS::WorkspaceEffect, prepVersion: int, source: FillSource }
type ResolvedBookingDetail = { details: SD::SavedDetails, resolved: MA::SavedFill }
type BookingDetailRead = NoBookingDetailRead | ReadBookingDetail(ResolvedBookingDetail)
type VerifiedTaskForm = {
  command: WS::WorkspaceEffect, key: T::Subject, fill: K::Fill, bookingField: BookingField, detailRead: BookingDetailRead
}
type FormRead = NoTaskForm | VerifiedForm(VerifiedTaskForm)

pure def captureWebsiteCommand(
  preparation: P::Prep, command: WS::WorkspaceEffect, preparedTask: str, bookingField: BookingField
): QueuedWebsiteCommand =
  { command: command, prepVersion: preparation.version,
    source: if (preparation.phase == P::NoTask) OutsidePreparation
      else TaskForm({ task: preparedTask, key: preparation.key, fill: K::fillOf(preparation.choice), bookingField: bookingField }) }

pure def writesFormField(operation: X::WebsiteEffect): bool = match operation {
  | Operate(details) => details.kind == X::FillOrdinary
}
pure def formFillCommand(command: WS::WorkspaceEffect): bool = match command {
  | Execute(details) => writesFormField(details.effect)
  | _ => false
}
pure def namesBookingOperation(effect: X::WebsiteEffect, target: str, valueRef: str): bool = match effect {
  | Operate(operation) => operation.kind == X::FillOrdinary and operation.target == target and target != "" and
      operation.valueRef == valueRef and valueRef != ""
}
pure def namesBookingField(command: WS::WorkspaceEffect, target: str, valueRef: str): bool = match command {
  | Execute(details) => namesBookingOperation(details.effect, target, valueRef)
  | _ => false
}
pure def bookingDetailKindMatches(kind: M::FactKind, detail: str): bool =
  (kind == M::Name and detail == "name") or (kind == M::Phone and detail == "phone") or (kind == M::Address and detail == "address")
pure def bookingFieldMatches(
  w: WS::Workspace, command: WS::WorkspaceEffect, requestedFill: K::Fill, bookingField: BookingField,
  detailRead: BookingDetailRead, answerVersion: int, by: WS::WorkspaceActor
): bool = {
  match requestedFill {
    | BookFill(booking) => match bookingField {
      | NoBookingField => false
      | BookingTimeField(time) => time.slot == booking.bookForm.slot and time.answerVersion == answerVersion and
          detailRead == NoBookingDetailRead and namesBookingField(command, time.target, time.valueRef)
      | BookingSavedField(binding) => binding.answerVersion == answerVersion and booking.bookForm.details.includes(binding.detail) and
          namesBookingField(command, binding.target, binding.valueRef) and match detailRead {
            | NoBookingDetailRead => false
            | ReadBookingDetail(read) =>
                bookingDetailKindMatches(SD::detailAt(read.details, MA::receiptKey(read.resolved.authorization)).kind, binding.detail) and
                MA::currentSavedDetailEffect(w, command, read.details, read.resolved, by)
          }
    }
    | _ => bookingField == NoBookingField and detailRead == NoBookingDetailRead
  }
}
pure def fillPermitted(
  preparation: P::Prep, fillWorkspace: WS::Workspace, queued: QueuedWebsiteCommand, read: FormRead, by: WS::WorkspaceActor
): bool = {
  val source = queued.source
  AC::currentEffect(fillWorkspace, queued.command, by) and
    (not(formFillCommand(queued.command)) or (
      queued.prepVersion == preparation.version and match source {
        | OutsidePreparation => preparation.phase == P::NoTask and read == NoTaskForm
        | TaskForm(taskForm) => match read {
          | NoTaskForm => false
          | VerifiedForm(verified) => verified.command == queued.command and verified.key == taskForm.key and
              taskForm.key == preparation.key and taskForm.task == fillWorkspace.assistant.taskId and
              taskForm.key.owner == fillWorkspace.execution.owner and taskForm.key.origin == fillWorkspace.execution.origin and
              taskForm.key.account == fillWorkspace.execution.matchedAccount and verified.fill == taskForm.fill and
              verified.bookingField == taskForm.bookingField and bookingFieldMatches(fillWorkspace, verified.command, verified.fill, verified.bookingField, verified.detailRead, queued.prepVersion, by) and
              P::graceMayFill(preparation, verified.fill)
        }
      }))
}
pure def lawNoFillWithoutTheirYes(
  preparation: P::Prep, fillWorkspace: WS::Workspace, queued: QueuedWebsiteCommand, read: FormRead
): bool =
  (formFillCommand(queued.command) and (preparation.phase != P::NoTask or queued.source != OutsidePreparation) and
    preparation.fillBy != P::GraceFills)
    implies not(fillPermitted(preparation, fillWorkspace, queued, read, WS::Actuator))
pure def lawPausedOrCheckedFormIsNotFilled(
  preparation: P::Prep, fillWorkspace: WS::Workspace, queued: QueuedWebsiteCommand, read: FormRead
): bool =
  (formFillCommand(queued.command) and (preparation.phase != P::NoTask or queued.source != OutsidePreparation) and
    (not(preparation.live) or preparation.phase != P::Preparing))
    implies not(fillPermitted(preparation, fillWorkspace, queued, read, WS::Actuator))
pure def lawAnOldFillCannotGainFreshConsent(
  preparation: P::Prep, fillWorkspace: WS::Workspace, queued: QueuedWebsiteCommand, read: FormRead
): bool =
  (formFillCommand(queued.command) and queued.prepVersion != preparation.version)
    implies not(fillPermitted(preparation, fillWorkspace, queued, read, WS::Actuator))
pure def lawATaskFillUsesItsOwnVerifiedForm(
  preparation: P::Prep, fillWorkspace: WS::Workspace, queued: QueuedWebsiteCommand, read: FormRead
): bool = {
  val source = queued.source
  (formFillCommand(queued.command) and fillPermitted(preparation, fillWorkspace, queued, read, WS::Actuator))
    implies match source {
      | OutsidePreparation => preparation.phase == P::NoTask and read == NoTaskForm
      | TaskForm(taskForm) => match read {
        | NoTaskForm => false
        | VerifiedForm(verified) => taskForm.key == preparation.key and taskForm.task == fillWorkspace.assistant.taskId and
            taskForm.key.account == fillWorkspace.execution.matchedAccount and verified.command == queued.command and
            verified.key == taskForm.key and verified.fill == taskForm.fill and verified.bookingField == taskForm.bookingField and
            bookingFieldMatches(fillWorkspace, verified.command, verified.fill, verified.bookingField, verified.detailRead, queued.prepVersion, WS::Actuator) and P::graceMayFill(preparation, taskForm.fill)
      }
    }
}

pure def exampleFillWorkspace(target: str, valueRef: str): WS::Workspace = {
  val loaded = exampleLoadedWorkspace(WS::initial)
  val observed = WS::observe(loaded, { deviceVersion: loaded.device.contextVersion, browserRevision: loaded.browser.revision,
    taskVersion: loaded.assistant.workVersion, checkpoint: "Read the form", website: { ...X::goodObservation,
      generation: loaded.execution.generation, targets: List({ id: target, consequence: X::AskFirst, inReach: true }) } }, WS::Host)
  WS::prepare(observed, AC::sampleOperationRequest(observed, target, valueRef, X::FillOrdinary), WS::Host)
}
pure val billFill: WS::Workspace = exampleFillWorkspace("bill-amount", "chosen-payment")
pure val bookedNamePending: WS::Workspace = exampleFillWorkspace("name-field", "memory-name-revision-2")
pure def dispatchedBookingName(pending: WS::Workspace): WS::WorkspaceResult =
  WS::dispatch(pending, AC::sampleOperationTokens(pending), WS::Actuator)
pure val bookingNameBinding: BookingDetailBinding = { target: "name-field", valueRef: "memory-name-revision-2", detail: "name", answerVersion: 5 }
pure val bookingNameField: BookingField = BookingSavedField({ target: bookingNameBinding.target, valueRef: bookingNameBinding.valueRef,
  detail: bookingNameBinding.detail, answerVersion: bookingNameBinding.answerVersion })
pure val bookedNameAuthorization: M::MemoryStep = MA::authorizedFill(MA::approvedFact(M::initial))
pure val bookingNameRead: ResolvedBookingDetail = { details: { facts: List(bookedNameAuthorization.state) },
  resolved: { owner: K::sampleVisitKey.owner, valueRef: bookingNameBinding.valueRef, authorization: bookedNameAuthorization.out.nth(0) } }
pure val fillWorkspaceValues: Set[WS::Workspace] =
  Set(billFill, WS::dispatch(billFill, AC::sampleOperationTokens(billFill), WS::Actuator).state, dispatchedBookingName(bookedNamePending).state,
    WS::initial, AC::ordinarySample(AC::observedSample(WS::initial)).state)
pure val queuedValues: Set[QueuedWebsiteCommand] = {
  val write = WS::dispatch(billFill, AC::sampleOperationTokens(billFill), WS::Actuator)
  val chosen = preparationValues.filter(p => p.key == CM::exampleKey and p.phase == P::Preparing and p.fillBy == P::NotAsked).getOnlyElement()
  val yes = P::decideFill(chosen, P::GraceFills, chosen.version, T::Person)
  val queued = captureWebsiteCommand(yes, write.out.nth(0), "task", NoBookingField)
  Set(queued, captureWebsiteCommand(P::initial, queued.command, "", NoBookingField),
    { ...queued, source: TaskForm({ task: "other-task", key: CM::exampleKey, fill: K::fillOf(CM::exampleTerms), bookingField: NoBookingField }) },
    { ...queued, command: AC::ordinarySample(AC::observedSample(WS::initial)).out.nth(0) })
    .union(preparationValues.filter(p => p.key == K::sampleVisitKey and p.phase == P::Preparing).map(v =>
      captureWebsiteCommand(P::decideFill(v, P::GraceFills, v.version, T::Person), dispatchedBookingName(bookedNamePending).out.nth(0), "task", bookingNameField)))
}
pure val operationValues: Set[X::WebsiteEffect] = queuedValues.map(q => {
  val command = q.command
  match command {
    | Execute(details) => Set(details.effect)
    | _ => Set()
  }
}).flatten()
pure val readValues: Set[FormRead] = {
  val outside = queuedValues.filter(q => q.source == OutsidePreparation).getOnlyElement()
  val original = { command: outside.command, key: CM::exampleKey, fill: K::fillOf(CM::exampleTerms),
    bookingField: NoBookingField, detailRead: NoBookingDetailRead }
  val book = { command: dispatchedBookingName(bookedNamePending).out.nth(0), key: K::sampleVisitKey, fill: K::fillOf(K::sampleBookTerms),
    bookingField: bookingNameField, detailRead: ReadBookingDetail(bookingNameRead) }
  val corrected = M::propose(bookedNameAuthorization.state, MA::correction, M::MemoryUser)
  val forgotten = M::forget(bookedNameAuthorization.state, bookedNameAuthorization.state.revision, M::MemoryUser)
  Set(NoTaskForm, VerifiedForm(original),
    VerifiedForm({ ...original, key: { ...CM::exampleKey, account: "other-account" } }),
    VerifiedForm({ ...original, key: { ...CM::exampleKey, ref: "other-bill" } }),
    VerifiedForm(book), VerifiedForm({ ...book, bookingField: NoBookingField }),
    VerifiedForm({ ...book, bookingField: BookingSavedField({ ...bookingNameBinding, detail: "address" }) }),
    VerifiedForm({ ...book, bookingField: BookingSavedField({ ...bookingNameBinding, valueRef: "replaced-name-ref" }) }),
    VerifiedForm({ ...book, bookingField: BookingSavedField({ ...bookingNameBinding, answerVersion: 4 }) }),
    VerifiedForm({ ...book, detailRead: NoBookingDetailRead }),
    VerifiedForm({ ...book, detailRead: ReadBookingDetail({ ...bookingNameRead, details: { facts: List(corrected) } }) }),
    VerifiedForm({ ...book, detailRead: ReadBookingDetail({ ...bookingNameRead, details: { facts: List(forgotten) } }) }),
    VerifiedForm({ ...original, fill: K::fillOf(T::PayTerms({ pay: { ...CM::exampleProposal, day: 2 } })) }),
    VerifiedForm({ ...original, command: AC::ordinarySample(AC::observedSample(WS::initial)).out.nth(0) }))
}
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
type TaskView = { preparation: P::Prep, workspace: WS::Workspace, progress: TaskProgress }

pure def journaledTaskAttempt(preparation: P::Prep, w: WS::Workspace, accepted: AcceptedTaskReview): TaskProgress =
  val c = w.commitment
  val captured = accepted.transfer.captured
  if (preparationMatchesHandoff(preparation, accepted.transfer) and WS::currentCommitmentContext(w) and
      accepted.task != "" and accepted.task == w.commitmentTask and c.stage == CM::Guarded and c.fresh and
      w.device.contextVersion == captured.deviceVersion and w.browser.revision == captured.browserRevision and
      w.assistant.workVersion == captured.taskVersion and
      c.key == preparation.key and c.proposal == preparation.choice and c.evidence == preparation.evidence and
      c.revision == captured.revision + 1 and c.attempt == captured.attempt + 1)
    Following({ link: { task: accepted.task, key: c.key, preparationVersion: preparation.version, attempt: c.attempt } })
  else NoLinkedAttempt

pure def sameAttempt(view: TaskView, link: TaskAttemptLink): bool =
  link.task != "" and view.workspace.commitmentTask == link.task and view.workspace.assistant.taskId == link.task and
  view.preparation.key == link.key and view.workspace.commitment.key == link.key and
  link.attempt > 0 and view.workspace.commitment.attempt == link.attempt

pure def finishedWithReceipt(w: WS::Workspace): bool =
  val c = w.commitment
  w.assistant.activity == A::Finished and c.stage == CM::Resolved and
    c.evidence != "" and w.assistant.evidence == c.evidence and not(CM::outcomeNeedsSave(c)) and
    (if (CM::positiveOutcome(c.result)) w.assistant.outcome == A::Completed and c.reference != ""
     else (c.result == CM::VerifiedFailure or c.result == CM::Returned) and w.assistant.outcome == A::VerifiedFailure)

pure def joined(view: TaskView): bool =
  val progress = view.progress
  match progress {
    | NoLinkedAttempt => false
    | Following(tracked) => sameAttempt(view, tracked.link) and view.preparation.phase == P::HandedOff and
        view.preparation.version == tracked.link.preparationVersion and view.workspace.assistant.outcome != A::Abandoned
    | FinishedAttempt(tracked) => sameAttempt(view, tracked.link) and view.preparation.phase == P::NoTask and
        view.preparation.version == tracked.link.preparationVersion + 1 and finishedWithReceipt(view.workspace)
  }

pure def progressAtEnd(view: TaskView, by: T::TaskActor): TaskProgress =
  val progress = view.progress
  match progress {
    | Following(tracked) => if (by == T::Host and joined(view) and finishedWithReceipt(view.workspace))
        FinishedAttempt({ link: tracked.link }) else NoLinkedAttempt
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
  joined(view) and c.stage == CM::Resolved and (c.result == CM::VerifiedFailure or c.result == CM::Returned)
    implies currentStep(view) == K::OutcomeStep
```

### The task is done only once a positive outcome and its reference are saved

A linked attempt with a verified failure or return did not go through. A positive
outcome is done when its current result, evidence and reference are all saved.
During a person's form entry the task waits for them. A paused task is stopped,
a blocked preparation could not continue, and an attempt being checked waits
for the website at the outcome step. A completed task shows its outcome or
Calendar recording. A failure or return stays on the outcome step.

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
pure def lawTheStatusAgreesWithTheStep(view: TaskView): bool =
  val shown = currentStep(view)
  val status = taskStatus(view)
  match status {
    | Done => shown == K::OutcomeStep or shown == K::RecordStep
    | DidNotGoThrough => shown == K::OutcomeStep
    | WaitingForProvider => shown == K::OutcomeStep
    | WaitingForPerson => waitsForPerson(shown) or (shown == K::FormStep and view.preparation.fillBy == P::PersonFills)
    | _ => true
  }
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
  joined(view) and view.preparation.phase == P::HandedOff and finishedWithReceipt(view.workspace)
    implies (joined(ended) and taskStatus(ended) == taskStatus(view))

pure val viewValues: Set[TaskView] = {
  val chosen = preparationValues.filter(p => p.key == CM::exampleKey and p.phase == P::Preparing and p.fillBy == P::NotAsked).getOnlyElement()
  val guarded = wValues.filter(w => w.commitment.stage == CM::Draft and WS::currentCommitmentContext(w)).map(w =>
    Set(chosen).union(preparationValues.filter(p => p.key == K::sampleVisitKey and p.phase == P::Preparing)).map(picked => {
      val form = P::verifyForm(picked, { key: picked.key, proposal: picked.choice, revision: picked.version, evidence: "source" }, T::Host)
      val handed = P::handOff(form, T::Actuator)
      val transfer = { handoff: handed.out.nth(0), captured: AC::sampleCommitmentTokens(w) }
      val converted = convertPreparedReview(handed.state, w, transfer, WS::Host)
      match converted {
        | ReviewDeclined => { preparation: handed.state, workspace: w, progress: NoLinkedAttempt }
        | ReviewConverted(delivered) => {
          val reviewed = WS::reviewCommitment(w, delivered.report, WS::Host)
          val readBack = WS::readBackCommitment(reviewed, AC::sampleCommitmentTokens(reviewed), WS::Host)
          val journaled = WS::journalCommitment(readBack, AC::sampleCommitmentTokens(readBack), true, WS::Store)
          { preparation: handed.state, workspace: journaled,
            progress: journaledTaskAttempt(handed.state, journaled, { task: reviewed.commitmentTask, transfer: transfer }) }
        }
      }
    })).flatten()
  val checking = guarded.map(v =>
    { ...v, workspace: WS::observeCommitmentTap(v.workspace, AC::sampleCommitmentTokens(v.workspace), WS::Host) })
  val observed = checking.map(view =>
    Set(CM::Completed, CM::VerifiedFailure).map(result => {
      val w = view.workspace
      val report = { ...CM::exampleOutcome, key: w.commitment.key, revision: w.commitment.revision,
        attempt: w.commitment.attempt, result: result, reference: if (CM::positiveOutcome(result)) "receipt" else "" }
      { ...view, workspace: WS::recordCommitment(w, { deviceVersion: w.device.contextVersion,
        browserRevision: w.browser.revision, taskVersion: w.assistant.workVersion, report: report }, WS::Host) }
    })).flatten()
  val saved = observed.map(v => { ...v, workspace: WS::saveCommitment(v.workspace, {
    key: v.workspace.commitment.key, revision: v.workspace.commitment.revision, succeeded: true }, WS::Store) })
  val ended = saved.map(v => { ...v, progress: progressAtEnd(v, T::Host),
    preparation: P::retire(v.preparation, v.preparation.version, T::Host) })
  guarded.union(checking).union(observed)
    .union(saved).union(ended)
    .union(ended.map(v => { ...v, preparation: P::begin(v.preparation, v.preparation.key, "another request", T::Person) }))
    .union(guarded.map(v => { ...v, preparation: P::decideFill(chosen, P::PersonFills, chosen.version, T::Person) }))
    .union(guarded.map(v => { ...v, workspace: WS::abandonTask(v.workspace, WS::Person),
      preparation: P::retire(v.preparation, v.preparation.version, T::Person), progress: progressAtEnd(v, T::Person) }))
}
```

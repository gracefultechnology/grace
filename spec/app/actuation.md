# Check an emitted website command at the actuator

The browser actuator receives an effect from the owning Workspace. This
stateless library checks its authority against the current Workspace immediately
before the external write. The trusted outbox retains the original emitted
effect. Its consumer claims that entry once and evaluates the check and starts
the browser request in the same serialization boundary as interruption.

## Story: Stop old website actions before they reach the page

> As a person who stops, changes a page or switches an account, I want Grace
> to drop any delayed command for the old context and retain payment evidence
> if submission might already have happened.

### The actuator must still have the exact current browser command

An ordinary effect must match the operation in flight, including its owner,
task, origin, generations, classified target and value reference. A payment must
match its existing unresolved attempt and the same observed account, task,
device and page. An observed manual tap emits no agent submission. The host
uses only entries emitted by the model, checks current saved-value authority
where applicable and enforces one-time delivery before handing off to Chromium.
When the outbox consumer claims a fill of a task's form, it makes three checks
before the write reaches the page: this check of the command against the
current Workspace; the [task bridge's](./taskBridge.md) `fillPermitted` against
the current preparation, which holds only after the person's "Yes, fill it in"
for that task; and the preparation's `graceMayFill` for exactly the values it
would type. A fill that fails any of the three is dropped like a stale command.

```quint
import workspace as WS from "./workspace"
import assistant as A from "./assistant"
import execution as X from "./execution"
import commitment as CM from "./commitment"
import task as T from "./task"

pure def currentOrdinaryEffect(x: X::Execution, operation: X::WebsiteEffect): bool = match operation {
  | Operate(details) => x.phase == X::InFlight and X::alwaysIdentity(x) and X::alwaysPrepared(x) and
    details.owner == x.owner and details.task == x.task and details.origin == x.origin and
    details.generation == x.generation and details.observation == x.observation and
    details.target == x.target and details.valueRef == x.valueRef and details.kind == x.kind
}

pure def currentEffect(w: WS::Workspace, pendingEffect: WS::WorkspaceEffect, by: WS::WorkspaceActor): bool =
  by == WS::Actuator and WS::mayAssist(w) and WS::observationIsCurrent(w) and match pendingEffect {
    | Execute(command) => command.deviceVersion == w.device.contextVersion and
      command.browserRevision == w.browser.revision and w.assistant.activity == A::DoingWork and
      w.execution.task == w.assistant.taskId and currentOrdinaryEffect(w.execution, command.effect)
    | Commit(command) => command.deviceVersion == w.device.contextVersion and
      command.browserRevision == w.browser.revision and command.taskVersion == w.assistant.workVersion and
      w.assistant.activity == A::WebsiteWait and w.commitment.result == CM::Unknown and
      w.commitment.durable.result == CM::Unknown and WS::currentCommitmentContext(w) and
      CM::effectIsCurrent(w.commitment, command.effect)
    | _ => false
  }

pure def lawOnlyActuatorConsumes(w: WS::Workspace, pendingEffect: WS::WorkspaceEffect, by: WS::WorkspaceActor): bool =
  currentEffect(w, pendingEffect, by) implies by == WS::Actuator

pure def lawStaleBrowserCommandIsRefused(w: WS::Workspace, pendingEffect: WS::WorkspaceEffect): bool = match pendingEffect {
  | Execute(command) => (command.deviceVersion != w.device.contextVersion or command.browserRevision != w.browser.revision)
      implies not(currentEffect(w, pendingEffect, WS::Actuator))
  | Commit(command) => (command.deviceVersion != w.device.contextVersion or command.browserRevision != w.browser.revision or
      command.taskVersion != w.assistant.workVersion) implies not(currentEffect(w, pendingEffect, WS::Actuator))
  | _ => not(currentEffect(w, pendingEffect, WS::Actuator))
}

pure def lawCommitmentConsumptionUsesDurableAttempt(w: WS::Workspace, pendingEffect: WS::WorkspaceEffect): bool = match pendingEffect {
  | Commit(command) => currentEffect(w, pendingEffect, WS::Actuator) implies
      w.commitment.durable.result == CM::Unknown and w.execution.matchedAccount == w.commitment.key.account and
      CM::effectIsCurrent(w.commitment, command.effect)
  | _ => true
}
```

### Finite examples include current commands and requests fenced by Stop

The person grants observation and the selected page loads before either
browser route can act. The ordinary example emits its current website
command. The payment example reviews the bill, reads it back, journals the
attempt, and receives the person's complete approval before the actuator
emits its one command. Stop fences both emitted commands. A separate
manual tap on the reviewed website enters outcome checking without asking
the actuator to submit. These checks apply to arbitrary verified sites,
values and versions.

```quint
import shell as S from "./shell"
import browser as B from "./browser"
import conversation as C from "./conversation"
import wake as W from "./wake"
import preferences as R from "./preferences"
import interaction as I from "./interaction"

pure def observedSample(starting: WS::Workspace): WS::Workspace = {
  val ready = WS::changeLifecycle(starting, WS::StartupSucceeded, WS::Host)
  val online = WS::setAvailability(ready, { connection: S::Online, reasoning: true, microphone: true, observation: false }, WS::Host)
  val opened = WS::openGrace(WS::visit(online, S::Browser, WS::Person), WS::Person)
  val allowed = WS::setBrowserObservation(opened, { allowed: true, deviceVersion: opened.device.contextVersion, browserRevision: opened.browser.revision }, WS::Person)
  val compact = WS::interact(allowed, I::Resize({ expanded: false }), WS::Person)
  val task = WS::begin(compact, { owner: "owner", task: "task", goal: "Read the account", origin: CM::exampleKey.origin }, WS::Person)
  val page = WS::receiveLoad(task, { id: task.browser.selected, version: B::activeTab(task.browser).loadVersion, result: B::Loaded }, WS::Host)
  WS::observe(page, { deviceVersion: page.device.contextVersion, browserRevision: page.browser.revision, taskVersion: page.assistant.workVersion,
    website: { ...X::goodObservation, generation: page.execution.generation }, checkpoint: "Read the current account" }, WS::Host)
}
pure def sampleOperationTokens(w: WS::Workspace): WS::OperationTokens =
  { deviceVersion: w.device.contextVersion, browserRevision: w.browser.revision, taskVersion: w.assistant.workVersion,
    generation: w.execution.generation, observation: w.execution.observation }
pure def sampleOperationRequest(w: WS::Workspace, target: str, valueRef: str, kind: X::OperationKind): WS::OperationRequest =
  { deviceVersion: w.device.contextVersion, browserRevision: w.browser.revision, taskVersion: w.assistant.workVersion,
    generation: w.execution.generation, observation: w.execution.observation, target: target, valueRef: valueRef, kind: kind }
pure def ordinarySample(observed: WS::Workspace): WS::WorkspaceResult = {
  val queued = WS::prepare(observed, sampleOperationRequest(observed, "control", "", X::ReadPage), WS::Host)
  WS::dispatch(queued, sampleOperationTokens(queued), WS::Actuator)
}
pure def sampleCommitmentTokens(w: WS::Workspace): WS::CommitmentTokens =
  { deviceVersion: w.device.contextVersion, browserRevision: w.browser.revision, taskVersion: w.assistant.workVersion,
    revision: w.commitment.revision, attempt: w.commitment.attempt }
pure def journaledSample(observed: WS::Workspace): WS::Workspace = {
  val bound = WS::bindCommitment(observed, CM::exampleKey, WS::Person)
  val reviewed = WS::reviewCommitment(bound, { deviceVersion: bound.device.contextVersion, browserRevision: bound.browser.revision,
    taskVersion: bound.assistant.workVersion, review: { ...CM::exampleReview, revision: bound.commitment.revision } }, WS::Host)
  val readBack = WS::readBackCommitment(reviewed, sampleCommitmentTokens(reviewed), WS::Host)
  WS::journalCommitment(readBack, sampleCommitmentTokens(readBack), true, WS::Store)
}
pure def approvedSample(journaled: WS::Workspace): WS::Workspace = {
  val listening = WS::talk(journaled, WS::Person)
  WS::approveSpokenCommitment(listening, sampleCommitmentTokens(listening),
    { token: listening.assistant.conversation.generation, text: "Yes, pay this bill.",
      owner: C::HumanAudio, complete: true, approves: true, correction: false }, WS::Person)
}
pure def commitmentSample(approved: WS::Workspace): WS::WorkspaceResult =
  WS::submitCommitment(approved, sampleCommitmentTokens(approved), WS::Actuator)
pure val pendingEffectValues = {
  val observed = observedSample(WS::initial)
  val approved = approvedSample(journaledSample(observed))
  Set(ordinarySample(observed).out.nth(0), commitmentSample(approved).out.nth(0), WS::WakeFeedback({ signal: W::WakeChime }))
}
pure val operationValues = Set(X::Operate({ owner: "owner", task: "task", origin: CM::exampleKey.origin,
  generation: 1, observation: 1, target: "control", valueRef: "", kind: X::ReadPage }))
pure val xValues = Set(X::initial, ordinarySample(observedSample(WS::initial)).state.execution)
pure val observedValues = Set(observedSample(WS::initial))
pure val startingValues = Set(WS::initial)
pure val wValues = {
  val observed = observedSample(WS::initial)
  val ordinary = ordinarySample(observed).state
  val journaled = journaledSample(observed)
  val approved = approvedSample(journaled)
  val submitted = commitmentSample(approved).state
  val manual = WS::observeCommitmentTap(journaled, sampleCommitmentTokens(journaled), WS::Host)
  Set(WS::initial, ordinary, WS::stop(ordinary, WS::Person), approved, submitted, WS::stop(submitted, WS::Person),
    manual, WS::stop(manual, WS::Person))
}
```

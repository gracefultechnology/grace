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

Examples derive effects through each owning Workspace transition. They include
both browser routes and Stop after emission. Grace is made compact before the
task begins, since her steps run only while the page is in view
([assistant](./assistant.md)). The same checks apply to arbitrary verified
sites, values and versions.

```quint
import shell as S from "./shell"
import browser as B from "./browser"
import conversation as C from "./conversation"
import wake as W from "./wake"
import preferences as R from "./preferences"
import interaction as I from "./interaction"

pure def observedSample(starting: WS::Workspace): WS::Workspace = {
  val ready = WS::changeLifecycle(starting, WS::StartupSucceeded, WS::Host)
  val online = WS::setAvailability(ready, { connection: S::Online, reasoning: true, microphone: true, observation: true }, WS::Host)
  val opened = WS::interact(WS::openGrace(WS::visit(online, S::Browser, WS::Person), WS::Person),
    I::Resize({ expanded: false }), WS::Person)
  val task = WS::begin(opened, { owner: "owner", task: "task", goal: "Read the account", origin: CM::exampleKey.origin }, WS::Person)
  val page = WS::receiveLoad(task, { id: 1, version: 1, result: B::Loaded, secure: true, endedAt: CM::exampleKey.origin }, WS::Host)
  WS::observe(page, { deviceVersion: 6, browserRevision: 2, taskVersion: 1, website: X::goodObservation,
    checkpoint: "Read the current account" }, WS::Host)
}
pure def ordinarySample(observed: WS::Workspace): WS::WorkspaceResult = {
  val versions = { deviceVersion: 6, browserRevision: 2, taskVersion: 1, generation: 1, observation: 1 }
  val queued = WS::prepare(observed, { deviceVersion: 6, browserRevision: 2, taskVersion: 1, generation: 1, observation: 1,
    target: "control", valueRef: "", kind: X::ReadPage }, WS::Host)
  WS::dispatch(queued, versions, WS::Actuator)
}
pure def commitmentSample(observed: WS::Workspace): WS::WorkspaceResult = {
  val bound = WS::bindCommitment(observed, CM::exampleKey, WS::Person)
  val reviewed = WS::reviewCommitment(bound,
    { deviceVersion: 6, browserRevision: 2, taskVersion: 1, review: CM::exampleReview }, WS::Host)
  val tokens = { deviceVersion: 6, browserRevision: 2, taskVersion: 1, revision: 1, attempt: 0 }
  val readBack = WS::readBackCommitment(reviewed, tokens, WS::Host)
  val journaled = WS::journalCommitment(readBack, tokens, true, WS::Store)
  val listening = WS::talk(journaled, WS::Person)
  val journalTokens = { ...tokens, attempt: 1 }
  val approved = WS::approveSpokenCommitment(listening, journalTokens, { token: listening.assistant.conversation.generation,
    text: "Yes, pay this bill.", owner: C::HumanAudio, complete: true, approves: true, correction: false }, WS::Person)
  WS::submitCommitment(approved, { ...journalTokens, taskVersion: approved.assistant.workVersion }, WS::Actuator)
}
pure val pendingEffectValues = {
  val observed = observedSample(WS::initial)
  Set(ordinarySample(observed).out.nth(0), commitmentSample(observed).out.nth(0), WS::WakeFeedback({ signal: W::WakeChime }))
}
pure val operationValues = Set(X::Operate({ owner: "owner", task: "task", origin: CM::exampleKey.origin,
  generation: 1, observation: 1, target: "control", valueRef: "", kind: X::ReadPage }))
pure val xValues = Set(X::initial, ordinarySample(observedSample(WS::initial)).state.execution)
pure val observedValues = Set(observedSample(WS::initial))
pure val startingValues = Set(WS::initial)
pure val wValues = {
  val observed = observedSample(WS::initial)
  val ordinary = ordinarySample(observed).state
  val commitment = commitmentSample(observed).state
  Set(WS::initial, ordinary, WS::stop(ordinary, WS::Person), commitment, WS::stop(commitment, WS::Person))
}
```

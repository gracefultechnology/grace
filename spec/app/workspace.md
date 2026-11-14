# The active Grace workspace

This composition makes the [device](./shell.md), [browser](./browser.md),
[assistant](./assistant.md) and [ordinary website controller](./execution.md)
obey one interruption boundary. The actual states live here, rather than a
second set of readiness or task flags. The assistant owns the task identity;
the controller carries the same identity only to reject stale operations.

The canonical [payment aggregates](./payment.md) are held directly, one
instance per owner, provider, account and bill, with one active record and
retained inactive records. Every entry point retrieves the same aggregate;
neither a new task nor a duplicate calendar entry creates another attempt
record. Closing a page, losing service or restarting fences authorization
while retaining durable evidence. This module proves
coordination; it does not prove a browser
adapter correctly recognized a website or that an external effect succeeded.

## Story: Leave and return without hidden work

> As a person using Grace, I can leave a task, close Grace, lose permissions
> or put the device to sleep without old clicks or recording continuing.

### The workspace contains the actual device, page, conversation and operation

The two observed versions are evidence references, not alternate page state.
There is no provider name, domain allowlist or fixed sequence of website steps.
Caller identities are supplied by the authenticated host, not website content.

```quint
import shell as S from "./shell"
import browser as B from "./browser"
import assistant as A from "./assistant"
import conversation as C from "./conversation"
import execution as X from "./execution"
import payment as P from "./payment"
import preferences as R from "./preferences"
import wake as W from "./wake"
import interaction as I from "./interaction"
import browserControls as BC from "./browserControls"

type WorkspaceActor = Person | Host | Store | Actuator
type Workspace = {
  device: S::Shell, browser: B::Browser, assistant: A::Assistant,
  execution: X::Execution, payment: P::Payment, otherPayments: List[P::Payment],
  preferences: R::Preferences, wake: W::Wake,
  paymentTask: str, observedDevice: int, observedBrowser: int
}
type WorkspaceEffect = Execute({ deviceVersion: int, browserRevision: int, effect: X::WebsiteEffect })
  | Pay({ deviceVersion: int, browserRevision: int, taskVersion: int, effect: P::PaymentEffect })
  | WakeFeedback({ signal: W::WakeSignal })
  | PreferenceFeedback({ revision: int, effect: R::PreferenceEffect })
type WorkspaceResult = { state: Workspace, out: List[WorkspaceEffect] }
type Availability = {
  connection: S::Connectivity, reasoning: bool, microphone: bool, observation: bool
}
type Lifecycle = StartupSucceeded | StartupFailed | RetryStartup | SleepDevice | WakeDevice | RestartDevice
type TaskRequest = { owner: str, task: str, goal: str, origin: str }
type LoadReport = { id: int, version: int, result: B::Load }
type UnexpectedNavigation = { id: int, revision: int, destination: str }
type CurrentObservation = {
  deviceVersion: int, browserRevision: int, taskVersion: int,
  website: X::ObservationReport, checkpoint: str
}
type OperationRequest = {
  deviceVersion: int, browserRevision: int, taskVersion: int,
  generation: int, observation: int, target: str, valueRef: str, kind: X::OperationKind
}
type OperationTokens = {
  deviceVersion: int, browserRevision: int, taskVersion: int,
  generation: int, observation: int
}
type CurrentVerification = {
  deviceVersion: int, browserRevision: int, taskVersion: int,
  website: X::VerificationReport, checkpoint: str, needsUser: bool
}
type GoalCompletion = {
  owner: str, task: str, goal: str, evidence: str,
  deviceVersion: int, browserRevision: int, taskVersion: int,
  generation: int, observation: int
}
type SpokenApproval = {
  token: int, text: str, owner: C::AudioOwner,
  complete: bool, approves: bool, correction: bool
}
type PaymentTokens = {
  deviceVersion: int, browserRevision: int, taskVersion: int,
  revision: int, attempt: int
}
type CurrentReview = { deviceVersion: int, browserRevision: int, taskVersion: int, review: P::ReviewReport }
type CurrentOutcome = { deviceVersion: int, browserRevision: int, taskVersion: int, report: P::OutcomeReport }
type CurrentPrior = { deviceVersion: int, browserRevision: int, taskVersion: int, report: P::PriorReport }
type SaveReport = { key: P::BillKey, revision: int, succeeded: bool }
type ProgressKind = OrdinaryProgress | PaymentProgress
type ProgressReport = {
  owner: str, task: str, deviceVersion: int, browserRevision: int, taskVersion: int,
  generation: int, observation: int, paymentRevision: int, attempt: int,
  kind: ProgressKind, destination: str
}
pure val initial: Workspace = {
  device: S::initial, browser: B::initial, assistant: A::initial,
  execution: X::initial, payment: P::initial, otherPayments: List(),
  preferences: R::initial, wake: W::initial,
  paymentTask: "", observedDevice: 0, observedBrowser: 0
}
pure def mayAssist(w: Workspace): bool =
  w.device.connectivity == S::Online and S::mayRequestReasoning(w.device) and
  S::mayObserveBrowser(w.device) and A::isVisible(w.assistant)
pure def observationIsCurrent(w: Workspace): bool =
  w.observedDevice == w.device.contextVersion and w.observedBrowser == w.browser.revision
pure def quietAssistant(a: A::Assistant): A::Assistant =
  if (A::unfinished(a)) A::pause(a, C::ConversationRuntime)
  else if (A::canQuiet(a, C::ConversationRuntime)) A::quiet(a, C::ConversationRuntime) else a
pure def quietExecution(x: X::Execution): X::Execution =
  if (X::canPause(x, X::BrowserBridge)) X::pause(x, X::BrowserBridge) else x
pure def quietPayment(p: P::Payment): P::Payment =
  if (P::canStop(p, P::BrowserHost)) P::stop(p, P::BrowserHost)
  else if (P::canInvalidate(p, P::BrowserHost)) P::invalidate(p, P::BrowserHost) else p
pure def interrupted(device: S::Shell, browser: B::Browser, w: Workspace): Workspace =
  val leavesSurface = device.surface != w.device.surface or device.readiness != S::Ready
  val assistant = quietAssistant(w.assistant)
  {
    ...w, device: device,
    browser: if (leavesSurface and browser.editingAddress) B::dismissAddress(browser) else browser,
    assistant: if (leavesSurface and A::canDismissKeyboard(assistant, C::ConversationUser))
      A::dismissKeyboard(assistant, C::ConversationUser) else assistant,
    execution: quietExecution(w.execution), payment: quietPayment(w.payment),
    wake: W::cancel(w.wake, W::WakeHost)
  }
pure def alwaysDeviceRules(w: Workspace): bool =
  S::alwaysContextVersionIsNonnegative(w.device) and S::alwaysReturnDestinationIsAnApplication(w.device)
pure def alwaysBrowserRules(w: Workspace): bool =
  B::alwaysTabsAreWellFormed(w.browser) and B::alwaysTabIdentifiersAreUnique(w.browser) and
  B::alwaysSelectedTabExists(w.browser) and B::alwaysBrowserCountersAreValid(w.browser) and
  B::alwaysRecentDestinationsAreDistinct(w.browser)
pure def alwaysAssistantRules(w: Workspace): bool =
  A::alwaysConversationRules(w.assistant) and A::alwaysHiddenIsQuiet(w.assistant) and
  A::alwaysTaskContextExists(w.assistant) and A::alwaysOperationsBelongToWorkingTasks(w.assistant) and
  A::alwaysOnlyVerifiedEndpointsClaimCompletion(w.assistant) and A::alwaysReplacementIsComplete(w.assistant)
pure def alwaysExecutionRules(w: Workspace): bool =
  X::alwaysIdentity(w.execution) and X::alwaysGenerations(w.execution) and
  X::alwaysPrepared(w.execution) and X::alwaysExplainedBlock(w.execution) and
  X::alwaysFailureCount(w.execution) and X::alwaysFailedApproachIsConcrete(w.execution) and
  X::alwaysNoExhaustedApproachQueued(w.execution)
pure def validPayment(p: P::Payment): bool =
  P::alwaysIdentity(p) and P::alwaysProposal(p) and P::alwaysCounters(p) and
  P::alwaysWindow(p) and P::alwaysAuthorization(p) and P::alwaysResult(p) and
  P::alwaysSubmissionStage(p) and P::alwaysResolved(p) and P::alwaysUnsubmittedStage(p) and
  P::alwaysDurableWindow(p) and P::alwaysDurableConfirmation(p) and
  P::alwaysReviewHasEvidence(p) and P::alwaysAttemptHasEvidence(p) and P::alwaysDurableOutcomeHasAttempt(p)
pure def alwaysPaymentRules(w: Workspace): bool =
  validPayment(w.payment) and w.otherPayments.every(p => validPayment(p))
pure def alwaysPaymentRegistryIsCanonical(w: Workspace): bool =
  w.otherPayments.every(p => p.stage != P::Empty and not(p.live) and not(p.fresh) and not(p.readBack) and
    (w.payment.stage == P::Empty or p.key != w.payment.key) and
    w.otherPayments.select(other => other.key == p.key).length() == 1)
pure def paymentRecords(w: Workspace): List[P::Payment] =
  if (w.payment.stage == P::Empty) w.otherPayments else w.otherPayments.append(w.payment)
pure def storedPayment(key: P::BillKey, records: List[P::Payment]): P::Payment =
  records.foldl(P::initial, (found, record) => if (record.key == key) record else found)
pure def paymentByKey(w: Workspace, key: P::BillKey): P::Payment =
  if (w.payment.stage != P::Empty and w.payment.key == key) w.payment else storedPayment(key, w.otherPayments)
pure def matchingPayment(w: Workspace): bool =
  w.payment.key.owner == w.execution.owner and w.payment.key.origin == w.execution.origin
pure def currentPaymentContext(w: Workspace): bool =
  mayAssist(w) and observationIsCurrent(w) and w.execution.phase == X::Observed and
  w.execution.originVerified and w.execution.accountMatched and w.execution.redactionReady and
  not(w.execution.privateInput) and matchingPayment(w) and w.paymentTask == w.assistant.taskId
pure def alwaysPaymentAssociation(w: Workspace): bool =
  w.paymentTask != "" implies w.payment.stage != P::Empty and w.paymentTask == w.assistant.taskId
pure def alwaysPaymentUsesCanonicalIdentity(w: Workspace): bool =
  (w.paymentTask != "" and w.execution.phase != X::Idle) implies matchingPayment(w)
pure def alwaysPaymentReviewUsesCurrentContext(w: Workspace): bool =
  w.payment.fresh implies currentPaymentContext(w)
pure def alwaysPausedPaymentCannotSubmit(w: Workspace): bool =
  w.assistant.activity == A::Paused implies not(w.payment.fresh) and
    (w.payment.stage == P::Empty or not(w.payment.live))
pure def alwaysOneTask(w: Workspace): bool =
  (A::unfinished(w.assistant) iff w.execution.phase != X::Idle) and
  (w.execution.phase != X::Idle implies w.execution.task == w.assistant.taskId)
pure def alwaysPausedTogether(w: Workspace): bool =
  (w.assistant.activity == A::Paused) iff (w.execution.phase == X::Paused)
pure def alwaysCurrentBeforeAction(w: Workspace): bool =
  (w.execution.phase == X::Observed or w.execution.phase == X::Queued or w.execution.phase == X::InFlight)
  implies mayAssist(w) and observationIsCurrent(w) and B::activeTab(w.browser).load == B::Loaded
pure def alwaysRecordingHasPermission(w: Workspace): bool =
  w.assistant.conversation.voice implies w.device.readiness == S::Ready and
    w.device.microphoneAllowed and S::mayRequestReasoning(w.device) and A::isVisible(w.assistant)
pure def alwaysOperationHasVisibleTask(w: Workspace): bool =
  (w.execution.phase == X::Queued or w.execution.phase == X::InFlight)
  iff w.assistant.activity == A::DoingWork
pure def alwaysEvidenceVersionsAreNonnegative(w: Workspace): bool =
  w.observedDevice >= 0 and w.observedBrowser >= 0
pure def alwaysWakeRules(w: Workspace): bool =
  W::alwaysWakeCounters(w.wake) and W::alwaysActiveWakeHasDeadline(w.wake)
pure def alwaysActiveWakePausesWebsiteWork(w: Workspace): bool =
  w.wake.phase != W::Dormant implies w.execution.phase == X::Idle or w.execution.phase == X::Paused
pure def alwaysPreferencesRules(w: Workspace): bool =
  R::alwaysSettingsAreValid(w.preferences) and R::alwaysVersionsAreOrdered(w.preferences) and
  R::alwaysPendingSaveHasAVersion(w.preferences)
```

### Device changes and permission changes stop work before the new context is used

This includes restoration: reconnecting, touch waking and granting a permission
cannot silently restart work or a microphone. The host reports the operating
system's current access, not an optimistic result before a permission prompt.
Startup failure and retry stay distinct from a usable device.
Sleep and restart hide Grace after pausing it, preserving the task, transcript
and draft. Touch waking restores the application surface without reopening
Grace; an enabled wake phrase can explicitly open a new exchange.

```quint
pure def canChangeLifecycle(w: Workspace, lifecycle: Lifecycle, by: WorkspaceActor): bool =
  by == Host and match lifecycle {
    | StartupSucceeded => S::canFinishStartup(w.device)
    | StartupFailed => S::canFinishStartup(w.device)
    | RetryStartup => S::canRetryStartup(w.device)
    | SleepDevice => S::canSleep(w.device)
    | WakeDevice => S::canWake(w.device)
    | RestartDevice => true
  }
pure def changeLifecycle(w: Workspace, lifecycle: Lifecycle, by: WorkspaceActor): Workspace =
  val device = match lifecycle {
    | StartupSucceeded => S::finishStartup(w.device, true)
    | StartupFailed => S::finishStartup(w.device, false)
    | RetryStartup => S::retryStartup(w.device)
    | SleepDevice => S::sleep(w.device)
    | WakeDevice => S::wake(w.device)
    | RestartDevice => S::restart(w.device)
  }
  val stopped = interrupted(device, w.browser, w)
  val hidden = if ((lifecycle == SleepDevice or lifecycle == RestartDevice) and A::isVisible(stopped.assistant))
    { ...stopped, assistant: A::close(stopped.assistant, C::ConversationUser) } else stopped
  val restored = if (lifecycle == RestartDevice) { ...hidden, preferences: R::restart(w.preferences, R::PreferenceStore) } else hidden
  if (lifecycle == RestartDevice and P::canRestart(w.payment, P::DurableStore))
    { ...restored, payment: P::restart(w.payment, P::DurableStore),
      otherPayments: w.otherPayments.listMap(p => P::restart(p, P::DurableStore)) }
  else restored
pure def canSetAvailability(w: Workspace, availability: Availability, by: WorkspaceActor): bool =
  by == Host and (availability.connection != w.device.connectivity or
    availability.reasoning != w.device.reasoningAvailable or
    availability.microphone != w.device.microphoneAllowed or
    availability.observation != w.device.observationAllowed)
pure def setAvailability(w: Workspace, availability: Availability, by: WorkspaceActor): Workspace =
  val connected = S::setConnectivity(w.device, availability.connection)
  val reasoning = S::setReasoningAvailability(connected, availability.reasoning)
  val microphone = S::setMicrophonePermission(reasoning, availability.microphone)
  interrupted(S::setObservationPermission(microphone, availability.observation), w.browser, w)
```

### Home, native controls and Close have explicit interruption semantics

Home retains all browser tabs. Close browser resets the tabs and returns Home.
Close Grace hides its window and retains the website. All three preserve the
task, transcript and draft while pausing unfinished work and stopping speech.
Returning to an application or reopening Grace reveals that same paused task.
Leaving the surface or sleeping dismisses keyboard focus while retaining the
draft. Opening Grace ends an active address-editor focus; browser address entry
still works independently while Grace is closed.

```quint
pure def canVisit(w: Workspace, destination: S::Surface, by: WorkspaceActor): bool =
  by == Person and (S::canOpenSurface(w.device, destination) or S::canOpenNative(w.device, destination))
pure def visit(w: Workspace, destination: S::Surface, by: WorkspaceActor): Workspace =
  interrupted(if (S::isTaskSurface(destination)) S::openSurface(w.device, destination)
    else S::openNative(w.device, destination), w.browser, w)
pure def canReturnToApplication(w: Workspace, by: WorkspaceActor): bool =
  by == Person and S::canReturnFromNative(w.device)
pure def returnToApplication(w: Workspace, by: WorkspaceActor): Workspace =
  interrupted(S::returnFromNative(w.device), w.browser, w)
pure def canCloseBrowser(w: Workspace, by: WorkspaceActor): bool =
  by == Person and w.device.readiness == S::Ready
pure def closeBrowser(w: Workspace, by: WorkspaceActor): Workspace =
  interrupted(S::openSurface(w.device, S::Home), B::closeBrowser(w.browser), w)
pure def canOpenGrace(w: Workspace, by: WorkspaceActor): bool =
  by == Person and w.device.readiness == S::Ready and A::canOpen(w.assistant, C::ConversationUser)
pure def openGrace(w: Workspace, by: WorkspaceActor): Workspace =
  afterInteraction(A::open(w.assistant, C::ConversationUser), w.browser.editingAddress, false, w)
pure def canCloseGrace(w: Workspace, by: WorkspaceActor): bool =
  by == Person and A::canClose(w.assistant, C::ConversationUser)
pure def closeGrace(w: Workspace, by: WorkspaceActor): Workspace = {
  ...w, assistant: A::close(w.assistant, C::ConversationUser), execution: quietExecution(w.execution),
  payment: quietPayment(w.payment), wake: W::cancel(w.wake, W::WakeUser)
}
pure def canStop(w: Workspace, by: WorkspaceActor): bool = by == Person and A::unfinished(w.assistant)
pure def stop(w: Workspace, by: WorkspaceActor): Workspace = interrupted(w.device, w.browser, w)
pure def canAbandonTask(w: Workspace, by: WorkspaceActor): bool =
  by == Person and A::canAbandon(w.assistant, C::ConversationUser) and
  X::canRetire(w.execution, X::User)
pure def abandonTask(w: Workspace, by: WorkspaceActor): Workspace = {
  ...w, assistant: A::abandon(w.assistant, C::ConversationUser),
  execution: X::retire(w.execution, X::User), payment: quietPayment(w.payment),
  wake: W::cancel(w.wake, W::WakeUser)
}
pure def canTalk(w: Workspace, by: WorkspaceActor): bool =
  by == Person and S::mayRequestReasoning(w.device) and w.device.microphoneAllowed and
  A::canTalk(w.assistant, C::ConversationUser)
pure def talk(w: Workspace, by: WorkspaceActor): Workspace =
  afterInteraction(A::talk(w.assistant, C::ConversationUser), w.assistant.keyboard != A::NoKeyboard or w.browser.editingAddress, false, w)
pure def canPurgePrivate(w: Workspace, token: int, messageIndex: int, purgeDraft: bool, by: WorkspaceActor): bool =
  by == Host and A::canPurgePrivate(w.assistant, token, messageIndex, purgeDraft, C::ConversationRuntime)
pure def purgePrivate(w: Workspace, token: int, messageIndex: int, purgeDraft: bool, by: WorkspaceActor): Workspace = {
  ...w, assistant: A::purgePrivate(w.assistant, token, messageIndex, purgeDraft, C::ConversationRuntime),
  execution: quietExecution(w.execution), payment: quietPayment(w.payment), wake: W::cancel(w.wake, W::WakeHost)
}
```

### Conversation input and geometry use the same owned assistant state

The pure interaction dispatcher calls existing assistant operations. User
controls are authenticated as user input and service callbacks as runtime
input. Typing, answer chips, speech, replies, failures, reading, Repeat and
keyboard/window controls all update this workspace's actual conversation.
Every accepted interaction cancels obsolete wake timers.

Newly submitted content and geometry changes invalidate browser targets and
payment review. Active work rechecks; already paused work stays paused. A
geometry change alone preserves a wait for the person's Continue or answer.
Changing Type or keyboard presentation preserves the dispatcher result,
including an already submitted response and its generation. Generic task
observation, preparation and completion wait while the conversation is
Thinking or has an unanswered question, so an old task cannot act before a
correction has been interpreted and any needed clarification answered.
A fully classified payment approval uses its separate atomic route below.

```quint

pure def canInteract(w: Workspace, input: I::Interaction, by: WorkspaceActor): bool =
  (by == Person or by == Host) and w.device.readiness == S::Ready and
  (I::needsReasoning(input) implies S::mayRequestReasoning(w.device)) and
  (I::targetsWebsite(input) implies w.device.surface == S::Browser) and
  (I::needsCurrentGuidance(input) implies guidanceIsCurrent(w)) and
  I::canInteract(w.assistant, input, if (by == Person) C::ConversationUser else C::ConversationRuntime)
pure def afterInteraction(changed: A::Assistant, geometry: bool, content: bool, w: Workspace): Workspace = {
  val fencesTask = content or geometry
  val browser = if (geometry and w.browser.editingAddress and changed.keyboard != A::WebsiteKeyboard)
    B::dismissAddress(w.browser) else w.browser
  {
    ...w,
    assistant: if (fencesTask and A::unfinished(changed) and changed.activity != A::Paused and
      (content or changed.activity != A::UserWait))
      { ...changed, activity: A::Rechecking, operation: "", workVersion: changed.workVersion + 1 } else changed,
    execution: if (fencesTask and X::canInvalidate(w.execution, X::BrowserBridge))
      X::invalidate(w.execution, X::BrowserBridge) else w.execution,
    payment: if (fencesTask and P::canInvalidate(w.payment, P::BrowserHost))
      P::invalidate(w.payment, P::BrowserHost) else w.payment,
    browser: if (geometry) B::pageChanged(browser) else browser,
    wake: W::cancel(w.wake, W::WakeHost)
  }
}
pure def interact(w: Workspace, input: I::Interaction, by: WorkspaceActor): Workspace =
  afterInteraction(I::interact(w.assistant, input, if (by == Person) C::ConversationUser else C::ConversationRuntime),
    I::changesGeometry(input), I::submitsContent(input), w)
pure def lawGeometryDoesNotAnswerForThePerson(w: Workspace, input: I::Interaction, by: WorkspaceActor): bool =
  w.assistant.activity == A::UserWait and canInteract(w, input, by) and
  I::changesGeometry(input) and not(I::submitsContent(input))
  implies interact(w, input, by).assistant.activity == A::UserWait
pure def canNewConversation(w: Workspace, by: WorkspaceActor): bool =
  by == Person and w.device.readiness == S::Ready and w.execution.phase == X::Idle and
  A::canNewConversation(w.assistant, C::ConversationUser)
pure def newConversation(w: Workspace, by: WorkspaceActor): Workspace = {
  ...w, assistant: A::newConversation(w.assistant, C::ConversationUser), paymentTask: "",
  wake: W::cancel(w.wake, W::WakeUser)
}
pure def canRequestReplacement(w: Workspace, requestedTask: str, requestedGoal: str, by: WorkspaceActor): bool =
  by == Person and w.device.readiness == S::Ready and
  A::canRequestReplacement(w.assistant, requestedTask, requestedGoal, C::ConversationUser)
pure def requestReplacement(w: Workspace, requestedTask: str, requestedGoal: str, by: WorkspaceActor): Workspace = {
  ...w, assistant: A::requestReplacement(w.assistant, requestedTask, requestedGoal, C::ConversationUser),
  execution: quietExecution(w.execution), payment: quietPayment(w.payment), wake: W::cancel(w.wake, W::WakeUser)
}
pure def canKeepTask(w: Workspace, by: WorkspaceActor): bool =
  by == Person and w.device.readiness == S::Ready and A::canChooseReplacement(w.assistant, C::ConversationUser)
pure def keepTask(w: Workspace, by: WorkspaceActor): Workspace = {
  ...w, assistant: A::chooseReplacement(w.assistant, false, C::ConversationUser), wake: W::cancel(w.wake, W::WakeUser)
}
pure def canReplaceTask(w: Workspace, taskRequest: TaskRequest, by: WorkspaceActor): bool =
  by == Person and mayAssist(w) and taskRequest.owner != "" and taskRequest.origin != "" and
  taskRequest.task == w.assistant.replacementId and taskRequest.goal == w.assistant.replacementGoal and
  A::canChooseReplacement(w.assistant, C::ConversationUser) and X::canRetire(w.execution, X::User)
pure def replaceTask(w: Workspace, taskRequest: TaskRequest, by: WorkspaceActor): Workspace = {
  ...w, assistant: A::chooseReplacement(w.assistant, true, C::ConversationUser),
  execution: X::start(X::retire(w.execution, X::User), taskRequest.owner, taskRequest.task, taskRequest.origin, X::User),
  browser: B::navigate(w.browser, taskRequest.origin), payment: quietPayment(w.payment), paymentTask: "",
  wake: W::cancel(w.wake, W::WakeUser)
}
pure def canContinueTask(w: Workspace, by: WorkspaceActor): bool =
  by == Person and mayAssist(w) and A::canContinueTask(w.assistant, C::ConversationUser) and
  X::canInvalidate(w.execution, X::BrowserBridge)
pure def continueTask(w: Workspace, by: WorkspaceActor): Workspace = {
  ...w, assistant: A::continueTask(w.assistant, C::ConversationUser),
  execution: X::invalidate(w.execution, X::BrowserBridge),
  payment: if (P::canInvalidate(w.payment, P::BrowserHost)) P::invalidate(w.payment, P::BrowserHost) else w.payment,
  wake: W::cancel(w.wake, W::WakeUser)
}
pure def sometimesTypedRequestIsPending(w: Workspace): bool =
  not(w.assistant.conversation.voice) and w.assistant.conversation.turn == C::Thinking
pure def sometimesReplacementIsPending(w: Workspace): bool = w.assistant.replacementId != ""
```

Replacement first pauses the old task and asks one question. Keeping it does
not resume it. Confirming the named new task supplies its selected verified
source route, retires the old operation generation and starts observation
without changing any old payment record. A new conversation is available
only after the task is finished or explicitly abandoned; it clears the old
conversation link, never the payment ledger.

### Guidance is visible only on its current surface and target

The assistant owns one target and its visibility; the instruction comes from
its existing checkpoint or response. Publication is authenticated host evidence,
not a planner assertion. It names the current device, browser, task, conversation
and guidance revisions. Dismiss and Show use the shared interaction route and
never execute, pause or complete the task. Native app layout changes retire the
target through `invalidateGuidance` before the changed controls can be shown.
Page, keyboard, surface and task changes make old guidance unavailable immediately.
The UI renders the ring and label only through `guidanceVisible`.

```quint
pure def guidanceIsCurrent(w: Workspace): bool =
  w.device.readiness == S::Ready and A::guidanceIsCurrent(w.assistant) and
  w.assistant.guidance.deviceVersion == w.device.contextVersion and
  w.assistant.guidance.browserRevision == w.browser.revision
pure def guidanceVisible(w: Workspace): bool = guidanceIsCurrent(w) and w.assistant.guidance.shown
pure def canPublishGuidance(w: Workspace, guidanceReport: A::GuidanceReport, by: WorkspaceActor): bool =
  by == Host and w.device.readiness == S::Ready and
  guidanceReport.deviceVersion == w.device.contextVersion and guidanceReport.browserRevision == w.browser.revision and
  A::canPublishGuidance(w.assistant, guidanceReport, C::ConversationRuntime)
pure def publishGuidance(w: Workspace, guidanceReport: A::GuidanceReport, by: WorkspaceActor): Workspace = {
  ...w, assistant: A::publishGuidance(w.assistant, guidanceReport, C::ConversationRuntime)
}
pure def canInvalidateGuidance(w: Workspace, guidanceRevision: int, by: WorkspaceActor): bool =
  by == Host and A::canInvalidateGuidance(w.assistant, guidanceRevision, C::ConversationRuntime)
pure def invalidateGuidance(w: Workspace, guidanceRevision: int, by: WorkspaceActor): Workspace = {
  ...w, assistant: A::invalidateGuidance(w.assistant, guidanceRevision, C::ConversationRuntime)
}
pure def lawStaleGuidanceIsHidden(w: Workspace): bool =
  (w.assistant.guidance.deviceVersion != w.device.contextVersion or
    w.assistant.guidance.browserRevision != w.browser.revision) implies not(guidanceVisible(w))
pure def lawGuidanceControlsKeepExecution(w: Workspace, input: I::Interaction, by: WorkspaceActor): bool =
  I::needsCurrentGuidance(input) and canInteract(w, input, by) implies
    (interact(w, input, by).execution == w.execution and interact(w, input, by).payment == w.payment and
      interact(w, input, by).assistant.checkpoint == w.assistant.checkpoint and
      interact(w, input, by).assistant.conversation == w.assistant.conversation)
pure def sometimesGuidanceShown(w: Workspace): bool = guidanceVisible(w)
pure def sometimesGuidanceDismissed(w: Workspace): bool = guidanceIsCurrent(w) and not(w.assistant.guidance.shown)
pure val guidanceRevisionValues = Set(0, 1, 2)
pure val guidanceReportValues = Set(
  { target: "control", revision: 0, workVersion: 1, conversationVersion: 1, deviceVersion: 6, browserRevision: 2, verified: true },
  { target: "control", revision: 0, workVersion: 1, conversationVersion: 2, deviceVersion: 6, browserRevision: 2, verified: true },
  { target: "control", revision: 0, workVersion: 0, conversationVersion: 2, deviceVersion: 2, browserRevision: 0, verified: true },
  { target: "control", revision: 0, workVersion: 1, conversationVersion: 2, deviceVersion: 5, browserRevision: 2, verified: true },
  { target: "control", revision: 0, workVersion: 1, conversationVersion: 2, deviceVersion: 6, browserRevision: 2, verified: false })
```

### Home pages and rail overlays invalidate the covered page

```quint
pure def canChooseHomePage(w: Workspace, page: S::HomePage, by: WorkspaceActor): bool =
  by == Person and S::canChooseHomePage(w.device, page)
pure def chooseHomePage(w: Workspace, page: S::HomePage, by: WorkspaceActor): Workspace =
  interrupted(S::chooseHomePage(w.device, page), w.browser, w)
pure def canChooseSettingsPage(w: Workspace, page: S::SettingsPage, by: WorkspaceActor): bool =
  by == Person and S::canChooseSettingsPage(w.device, page)
pure def chooseSettingsPage(w: Workspace, page: S::SettingsPage, by: WorkspaceActor): Workspace =
  interrupted(S::chooseSettingsPage(w.device, page), w.browser, w)
pure def canTogglePopover(w: Workspace, popover: S::RailPopover, by: WorkspaceActor): bool =
  by == Person and S::canTogglePopover(w.device, popover)
pure def togglePopover(w: Workspace, popover: S::RailPopover, by: WorkspaceActor): Workspace =
  interrupted(S::togglePopover(w.device, popover), w.browser, w)
pure def canDismissPopover(w: Workspace, by: WorkspaceActor): bool = by == Person and S::canDismissPopover(w.device)
pure def dismissPopover(w: Workspace, by: WorkspaceActor): Workspace =
  interrupted(S::dismissPopover(w.device), w.browser, w)
pure def stepInterruptionsKeepTask(before: Workspace, via: str, after: Workspace): bool =
  (via == "changeLifecycle" or via == "setAvailability" or via == "visit" or
   via == "returnToApplication" or via == "closeBrowser" or via == "closeGrace" or via == "stop" or
   (via == "changePage" and after.browser.revision != before.browser.revision) or
   via == "chooseHomePage" or via == "chooseSettingsPage" or via == "togglePopover" or via == "dismissPopover")
  implies after.assistant.taskId == before.assistant.taskId and
    after.assistant.goal == before.assistant.goal and after.assistant.checkpoint == before.assistant.checkpoint and
    after.assistant.conversation.messages == before.assistant.conversation.messages and
    after.assistant.conversation.draft == before.assistant.conversation.draft and
    not(after.assistant.conversation.voice)
```

### An enabled wake phrase listens without resuming a website task

The actual preference, device permission and current conversation fence the
native detector. Detection never uses planner-supplied authority. A human wake
phrase is explicit voice intent even while the device sleeps. It pauses the
old task and invalidates payment approval before opening a fresh exchange.
Existing open chat keeps its size; Home opens expanded and other apps compact.
The wake chime obeys actual volume/mute. Pre-trigger audio stays local to the
native detector. Capture after detection still requires an available reasoning
route and microphone permission; unavailable service opens Grace with a clear
notice and leaves manual controls available. Detection availability is distinct
from reasoning availability. While a wake exchange or its silence notice is
active, website execution is idle or paused. Starting or resuming website work
cancels that wake exchange before its timer can hide Grace.

```quint
pure def priorWindow(a: A::Assistant): W::PriorWindow =
  if (a.presentation == A::Closed) W::WasClosed else if (a.presentation == A::Compact) W::WasCompact else W::WasExpanded
pure def wakeWindow(a: A::Assistant, presentation: A::Presentation): A::Assistant =
  { ...a, keyboard: A::NoKeyboard, presentation: presentation }
pure def listeningAfterWake(w: Workspace): A::Assistant =
  val paused = quietAssistant(w.assistant)
  val presentation = if (A::isVisible(paused)) paused.presentation else if (w.device.surface == S::Home) A::Expanded else A::Compact
  val opened = wakeWindow(paused, presentation)
  if (w.device.reasoningAvailable) A::talk(opened, C::ConversationUser) else opened
pure def canDetectWake(w: Workspace, detection: W::WakeDetection, by: WorkspaceActor): bool =
  by == Host and W::canDetect(w.wake, detection, W::WakeHost) and
  w.preferences.session.wakeEnabled and w.device.microphoneAllowed and
  (w.device.readiness == S::Ready or w.device.readiness == S::Sleeping) and
  detection.prior == priorWindow(w.assistant) and
  detection.conversationVersion == listeningAfterWake(w).conversation.generation
pure def detectWake(w: Workspace, detection: W::WakeDetection, by: WorkspaceActor): WorkspaceResult = {
  state: { ...w, device: if (w.device.readiness == S::Sleeping) S::wake(w.device) else w.device,
    browser: if (w.browser.editingAddress or w.assistant.keyboard != A::NoKeyboard)
      B::pageChanged(B::dismissAddress(w.browser)) else w.browser,
    assistant: listeningAfterWake(w), execution: quietExecution(w.execution), payment: quietPayment(w.payment),
    wake: if (w.device.reasoningAvailable) W::detect(w.wake, detection, W::WakeHost).state
      else W::cancel(w.wake, W::WakeHost) },
  out: List(WakeFeedback({ signal: if (w.device.reasoningAvailable) W::WakeChime else W::ExplainUnavailable }))
}
pure def canWakeNoSpeech(w: Workspace, timer: W::WakeTimer, by: WorkspaceActor): bool =
  by == Host and W::canNoSpeech(w.wake, timer, W::WakeHost) and A::isVisible(w.assistant) and
  C::canWakeSilence(w.assistant.conversation, timer.conversationVersion, C::ConversationRuntime)
pure def wakeNoSpeech(w: Workspace, timer: W::WakeTimer, by: WorkspaceActor): WorkspaceResult = {
  state: { ...w, wake: W::noSpeech(w.wake, timer, W::WakeHost).state,
    assistant: { ...w.assistant, conversation: C::wakeSilence(w.assistant.conversation, timer.conversationVersion, C::ConversationRuntime) } },
  out: List(WakeFeedback({ signal: W::ExplainSilence }))
}
pure def canWakeReturn(w: Workspace, timer: W::WakeTimer, by: WorkspaceActor): bool =
  by == Host and W::canReturnAfterSilence(w.wake, timer, W::WakeHost) and
  timer.conversationVersion == w.assistant.conversation.generation and A::isVisible(w.assistant)
pure def wakeReturn(w: Workspace, timer: W::WakeTimer, by: WorkspaceActor): Workspace = {
  ...w, wake: W::returnAfterSilence(w.wake, timer, W::WakeHost).state,
  assistant: if (w.wake.prior == W::WasClosed) A::close(w.assistant, C::ConversationUser)
    else A::resize(w.assistant, w.wake.prior == W::WasExpanded, C::ConversationUser)
}
pure def canCancelWake(w: Workspace, by: WorkspaceActor): bool =
  (by == Person or by == Host) and w.wake.phase != W::Dormant
pure def cancelWake(w: Workspace, by: WorkspaceActor): Workspace =
  interrupted(w.device, w.browser, w)
pure def stepWakeNeverDispatchesWebsite(before: Workspace, via: str, after: Workspace, out: List[WorkspaceEffect]): bool =
  via == "detectWake" implies
    out.length() == 1 and out.every(effect => match effect {
      | WakeFeedback(feedback) => feedback.signal == (if (before.device.reasoningAvailable) W::WakeChime else W::ExplainUnavailable)
      | _ => false
    }) and
    after.payment.result == before.payment.result and not(after.payment.fresh)
pure def sometimesWakeListens(w: Workspace): bool =
  w.wake.phase == W::AwaitingSpeech and w.assistant.conversation.turn == C::Listening
pure def sometimesWakeExplainsSilence(w: Workspace): bool =
  w.wake.phase == W::SilenceNotice and not(w.assistant.conversation.voice)
```

### Preference changes invalidate wake timers and use the same durable settings

The workspace contains the actual settings aggregate, including the wake
choice. Changing settings cancels a pending silence-return timer so it cannot
close a newly opened Settings explanation. Disabling wake immediately stops
its detector; it does not grant or remove OS microphone permission. Save and
acknowledgment use the existing versioned preference storage contract. Preview
and Undo recheck browser geometry when text size changes, while sound-only
changes preserve current targets. Both Sample voice and Test sound use the
same guarded sample action. Its audio effect carries the preference revision;
the actuator checks it and the current device mute setting before playback.

```quint
pure def canChangePreferences(w: Workspace, settings: R::DisplayPreferences, by: WorkspaceActor): bool =
  by == Person and w.device.readiness == S::Ready and R::canPreview(w.preferences, settings, R::PreferenceUser)
pure def withPreferences(preferences: R::Preferences, w: Workspace): Workspace =
  val updated = afterInteraction(w.assistant, preferences.session.textSize != w.preferences.session.textSize, false, w)
  { ...updated, preferences: preferences }
pure def changePreferences(w: Workspace, settings: R::DisplayPreferences, by: WorkspaceActor): Workspace =
  withPreferences(R::preview(w.preferences, settings, R::PreferenceUser), w)
pure def canUndoPreferences(w: Workspace, by: WorkspaceActor): bool =
  by == Person and w.device.readiness == S::Ready and R::canUndo(w.preferences, R::PreferenceUser)
pure def undoPreferences(w: Workspace, by: WorkspaceActor): Workspace =
  withPreferences(R::undo(w.preferences, R::PreferenceUser), w)
pure def canSamplePreferences(w: Workspace, by: WorkspaceActor): bool =
  by == Person and w.device.readiness == S::Ready and R::canSample(w.preferences, R::PreferenceUser)
pure def samplePreferences(w: Workspace, by: WorkspaceActor): WorkspaceResult =
  val sample = R::sample(w.preferences, R::PreferenceUser)
  { state: { ...w, preferences: sample.state, wake: W::cancel(w.wake, W::WakeUser) },
    out: sample.out.listMap(effect => PreferenceFeedback({ revision: w.preferences.revision, effect: effect })) }
pure def lawSampleDoesNotStartCapture(w: Workspace, by: WorkspaceActor): bool =
  samplePreferences(w, by).state.assistant == w.assistant
pure def canSavePreferences(w: Workspace, by: WorkspaceActor): bool =
  by == Host and R::canSave(w.preferences, R::PreferenceUser)
pure def savePreferences(w: Workspace, by: WorkspaceActor): Workspace =
  { ...w, preferences: R::save(w.preferences, R::PreferenceUser) }
pure def canPreferencesSaved(w: Workspace, saveToken: int, by: WorkspaceActor): bool =
  by == Store and R::canSaved(w.preferences, saveToken, R::PreferenceStore)
pure def preferencesSaved(w: Workspace, saveToken: int, succeeded: bool, by: WorkspaceActor): Workspace =
  { ...w, preferences: if (succeeded) R::saved(w.preferences, saveToken, R::PreferenceStore)
    else R::saveFailed(w.preferences, saveToken, R::PreferenceStore) }
```

## Story: Resume against the current website

> As a person returning to a task, I choose Resume and Grace checks the page
> as it is now before preparing or dispatching another ordinary step.

### Starting and changing pages use the browser's real navigation state

Starting a task opens its supplied destination and waits for real loading
and observation. Manual tab changes, navigation and page interactions pause
the task. One typed dispatcher covers address editing, empty Go, back/forward,
reload, tabs, layout capacity, scroll, zoom, page panels and recent shortcuts.
The resulting browser is stored here. Recent-list edits leave website work
alone; changes to the actual page or keyboard geometry interrupt it. Current
host reports cover form/account changes and measured layout; stale reports
cannot rewrite a newer page. A background load can complete without disturbing
the selected page. A selected-page change invalidates prior observations.
An address keyboard hides the visible Grace window using its existing website
keyboard presentation. Dismissal, navigation, Talk, Type and Show chat synchronize
that presentation with the actual address focus without opening hidden Grace.

```quint
pure def canBegin(w: Workspace, taskRequest: TaskRequest, by: WorkspaceActor): bool =
  by == Person and mayAssist(w) and taskRequest.origin != "" and
  A::canBeginTask(w.assistant, taskRequest.task, taskRequest.goal, C::ConversationUser) and
  X::canStart(w.execution, taskRequest.owner, taskRequest.task, taskRequest.origin, X::User)
pure def begin(w: Workspace, taskRequest: TaskRequest, by: WorkspaceActor): Workspace = {
  ...w, browser: B::navigate(w.browser, taskRequest.origin),
  assistant: A::beginTask(w.assistant, taskRequest.task, taskRequest.goal, C::ConversationUser),
  execution: X::start(w.execution, taskRequest.owner, taskRequest.task, taskRequest.origin, X::User),
  payment: quietPayment(w.payment), paymentTask: "", wake: W::cancel(w.wake, W::WakeUser)
}
pure def canChangePage(w: Workspace, browserInput: BC::BrowserInput, by: WorkspaceActor): bool =
  (by == Person or by == Host) and w.device.readiness == S::Ready and w.device.surface == S::Browser and
  BC::canControl(w.browser, browserInput, if (by == Person) BC::BrowserControlUser else BC::BrowserControlHost)
pure def changePage(w: Workspace, browserInput: BC::BrowserInput, by: WorkspaceActor): Workspace =
  val browser = BC::control(w.browser, browserInput, if (by == Person) BC::BrowserControlUser else BC::BrowserControlHost)
  val updated = if (browser.revision != w.browser.revision) interrupted(w.device, browser, w)
    else { ...w, browser: browser, wake: W::cancel(w.wake, W::WakeHost) }
  val assistant = if (browser.editingAddress and A::canFocusWebsite(updated.assistant, C::ConversationUser))
      A::focusWebsite(updated.assistant, C::ConversationUser)
    else if (w.browser.editingAddress and not(browser.editingAddress) and updated.assistant.keyboard == A::WebsiteKeyboard)
      A::dismissKeyboard(updated.assistant, C::ConversationUser)
    else updated.assistant
  { ...updated, assistant: assistant }
pure def canReceiveLoad(w: Workspace, loadReport: LoadReport, by: WorkspaceActor): bool =
  by == Host and B::canFinishLoad(w.browser, loadReport.id, loadReport.version, loadReport.result)
pure def receiveLoad(w: Workspace, loadReport: LoadReport, by: WorkspaceActor): Workspace =
  val browser = B::finishLoad(w.browser, loadReport.id, loadReport.version, loadReport.result)
  if (loadReport.id == w.browser.selected and
      ((loadReport.result != B::Loaded and A::unfinished(w.assistant)) or
       w.execution.phase == X::Observed or w.execution.phase == X::Queued or w.execution.phase == X::InFlight))
    interrupted(w.device, browser, w)
  else { ...w, browser: browser }
```

### Correlated website progress is observed without asking the person to resume

The host identifies a document change caused by the currently dispatched
ordinary operation or payment. It records that navigation in the actual
browser and invalidates the old target. Fresh observation follows within
the active task. A payment result page continues its existing outcome wait;
it never becomes another submit. An unexpected change pauses instead.

```quint
pure def canReceiveProgress(w: Workspace, progress: ProgressReport, by: WorkspaceActor): bool =
  by == Host and mayAssist(w) and progress.owner == w.execution.owner and progress.task == w.assistant.taskId and
  progress.deviceVersion == w.device.contextVersion and progress.browserRevision == w.browser.revision and
  progress.taskVersion == w.assistant.workVersion and
  ((progress.kind == OrdinaryProgress and w.execution.phase == X::InFlight and
    progress.generation == w.execution.generation and progress.observation == w.execution.observation) or
   (progress.kind == PaymentProgress and w.assistant.activity == A::WebsiteWait and
    w.payment.stage == P::Checking and w.payment.dispatched and
    progress.paymentRevision == w.payment.revision and progress.attempt == w.payment.attempt))
pure def receiveProgress(w: Workspace, progress: ProgressReport, by: WorkspaceActor): Workspace = {
  ...w, browser: if (progress.destination == "") B::pageChanged(w.browser) else B::navigate(w.browser, progress.destination),
  execution: X::invalidate(w.execution, X::BrowserBridge),
  payment: if (P::canInvalidate(w.payment, P::BrowserHost)) P::invalidate(w.payment, P::BrowserHost) else w.payment,
  assistant: if (progress.kind == OrdinaryProgress)
    A::receiveStep(w.assistant, w.assistant.taskId, progress.taskVersion, w.assistant.operation,
      "Inspect the updated page", false, C::ConversationRuntime) else w.assistant
}
pure def canUnexpectedPage(w: Workspace, unexpected: UnexpectedNavigation, by: WorkspaceActor): bool =
  by == Host and w.device.readiness == S::Ready and w.device.surface == S::Browser and
  unexpected.id == w.browser.selected and unexpected.revision == w.browser.revision and
  B::canNavigate(w.browser, unexpected.destination)
pure def unexpectedPage(w: Workspace, unexpected: UnexpectedNavigation, by: WorkspaceActor): Workspace =
  interrupted(w.device, B::navigate(w.browser, unexpected.destination), w)
pure def lawLateNavigationCannotReplaceCurrentTab(w: Workspace, unexpected: UnexpectedNavigation, by: WorkspaceActor): bool =
  (unexpected.id != w.browser.selected or unexpected.revision != w.browser.revision)
  implies not(canUnexpectedPage(w, unexpected, by))
pure def canResume(w: Workspace, by: WorkspaceActor): bool =
  by == Person and mayAssist(w) and A::canResume(w.assistant, C::ConversationUser) and
  X::canResume(w.execution, X::User)
pure def resume(w: Workspace, by: WorkspaceActor): Workspace = {
  ...w, assistant: A::resume(w.assistant, C::ConversationUser), execution: X::resume(w.execution, X::User),
  payment: if (P::canResume(w.payment, P::Person)) P::resume(w.payment, P::Person) else w.payment,
  wake: W::cancel(w.wake, W::WakeUser)
}
```

### Reconciliation binds the current page and device versions to the one task

A late observation is rejected even if its task name still matches. It must
match the current device context, current selected document revision, current
task generation and current controller generation. The trusted host checks
the actual origin, account and redaction before it supplies this evidence.

```quint
pure def canObserve(w: Workspace, currentObservation: CurrentObservation, by: WorkspaceActor): bool =
  by == Host and mayAssist(w) and w.assistant.conversation.turn != C::Thinking and not(w.assistant.conversation.question) and
  currentObservation.deviceVersion == w.device.contextVersion and
  B::observationMatches(w.browser, w.browser.selected, currentObservation.browserRevision) and
  currentObservation.taskVersion == w.assistant.workVersion and currentObservation.checkpoint != "" and
  (w.assistant.activity == A::ReadyForStep or w.assistant.activity == A::Rechecking or
    (w.assistant.activity == A::WebsiteWait and w.payment.stage == P::Checking and w.payment.dispatched)) and
  X::canObserve(w.execution, currentObservation.website, X::BrowserBridge)
pure def observe(w: Workspace, currentObservation: CurrentObservation, by: WorkspaceActor): Workspace =
  val observedWorkspace = {
    ...w, execution: X::observe(w.execution, currentObservation.website, X::BrowserBridge),
    assistant: if (w.assistant.activity == A::Rechecking)
      A::reconcile(w.assistant, w.assistant.taskId, currentObservation.taskVersion, currentObservation.checkpoint, true, C::ConversationRuntime)
      else w.assistant,
    observedDevice: currentObservation.deviceVersion, observedBrowser: currentObservation.browserRevision
  }
  afterPaymentEvidence(w.payment, observedWorkspace)
pure def canPrepare(w: Workspace, operationRequest: OperationRequest, by: WorkspaceActor): bool =
  by == Host and mayAssist(w) and observationIsCurrent(w) and w.assistant.conversation.turn != C::Thinking and not(w.assistant.conversation.question) and
  operationRequest.deviceVersion == w.device.contextVersion and operationRequest.browserRevision == w.browser.revision and
  operationRequest.generation == w.execution.generation and operationRequest.taskVersion == w.assistant.workVersion and
  A::canStartStep(w.assistant, w.assistant.taskId, operationRequest.taskVersion, operationRequest.target, C::ConversationRuntime) and
  X::canPrepare(w.execution, operationRequest.target, operationRequest.valueRef, operationRequest.kind, operationRequest.observation, X::BrowserBridge)
pure def prepare(w: Workspace, operationRequest: OperationRequest, by: WorkspaceActor): Workspace = {
  ...w, assistant: A::startStep(w.assistant, w.assistant.taskId, operationRequest.taskVersion, operationRequest.target, C::ConversationRuntime),
  execution: X::prepare(w.execution, operationRequest.target, operationRequest.valueRef, operationRequest.kind, operationRequest.observation, X::BrowserBridge),
  payment: if (P::canInvalidate(w.payment, P::BrowserHost)) P::invalidate(w.payment, P::BrowserHost) else w.payment
}
```

### Dispatch checks the context again and readback establishes the result

Only this transition emits an ordinary browser effect. The actuator rechecks
the envelope versions at the actual effect boundary, since an interruption
can happen after queuing. It cannot retract an already delivered action.
Readback reports success or a visible mismatch; a mismatch pauses for manual
reconciliation. Neither outcome by itself declares the whole task completed.
A successful readback may identify a manual step that needs the person. Grace
then waits for Continue and observes the current page again before another step.

```quint
pure def canDispatch(w: Workspace, tokens: OperationTokens, by: WorkspaceActor): bool =
  by == Actuator and mayAssist(w) and observationIsCurrent(w) and
  tokens.deviceVersion == w.device.contextVersion and tokens.browserRevision == w.browser.revision and
  tokens.taskVersion == w.assistant.workVersion and
  X::canDispatch(w.execution, tokens.generation, tokens.observation, X::Dispatcher)
pure def dispatch(w: Workspace, tokens: OperationTokens, by: WorkspaceActor): WorkspaceResult =
  val result = X::dispatch(w.execution, tokens.generation, tokens.observation, X::Dispatcher)
  { state: { ...w, execution: result.state },
    out: result.out.listMap(effect => Execute({ deviceVersion: w.device.contextVersion,
      browserRevision: w.browser.revision, effect: effect })) }
pure def canVerify(w: Workspace, currentVerification: CurrentVerification, by: WorkspaceActor): bool =
  by == Host and mayAssist(w) and observationIsCurrent(w) and currentVerification.deviceVersion == w.device.contextVersion and
  currentVerification.browserRevision == w.browser.revision and currentVerification.taskVersion == w.assistant.workVersion and
  A::canReceiveStep(w.assistant, w.assistant.taskId, currentVerification.taskVersion, w.assistant.operation, currentVerification.checkpoint, C::ConversationRuntime) and
  X::canVerify(w.execution, currentVerification.website, X::BrowserBridge)
pure def verify(w: Workspace, currentVerification: CurrentVerification, by: WorkspaceActor): Workspace =
  val execution = X::verify(w.execution, currentVerification.website, X::BrowserBridge)
  if (currentVerification.website.matches) {
    ...w, execution: execution,
    assistant: A::receiveStep(w.assistant, w.assistant.taskId, currentVerification.taskVersion,
      w.assistant.operation, currentVerification.checkpoint, currentVerification.needsUser, C::ConversationRuntime)
  } else { ...w, execution: quietExecution(execution), assistant: quietAssistant(w.assistant), payment: quietPayment(w.payment) }
pure def sampleMatchesPreferences(preferenceEffect: R::PreferenceEffect, settings: R::DisplayPreferences): bool =
  match preferenceEffect { | PlaySample(data) => data.pace == settings.pace and
    data.volume == settings.volume and data.muted == settings.muted }
pure def stepEffectsRequireCurrentContext(before: Workspace, after: Workspace, out: List[WorkspaceEffect]): bool =
  out.every(effect => match effect {
    | Execute(command) => mayAssist(before) and observationIsCurrent(before) and
        before.execution.phase == X::Queued and after.execution.phase == X::InFlight
    | Pay(command) => currentPaymentContext(before) and before.payment.stage == P::Authorized and
        after.payment.stage == P::Checking and after.payment.dispatched
    | PreferenceFeedback(feedback) => feedback.revision == before.preferences.revision and
        sampleMatchesPreferences(feedback.effect, before.preferences.session)
    | WakeFeedback(feedback) => if (feedback.signal == W::WakeChime)
        before.preferences.session.wakeEnabled and after.device.readiness == S::Ready and after.device.microphoneAllowed
      else if (feedback.signal == W::ExplainUnavailable) after.device.readiness == S::Ready and
        not(after.device.reasoningAvailable) and not(after.assistant.conversation.voice)
      else feedback.signal == W::ExplainSilence and before.wake.phase == W::AwaitingSpeech and not(after.assistant.conversation.voice)
  })
pure def lawStaleDeviceCannotDispatch(w: Workspace, tokens: OperationTokens, by: WorkspaceActor): bool =
  tokens.deviceVersion != w.device.contextVersion implies not(canDispatch(w, tokens, by))
pure def lawStalePageCannotDispatch(w: Workspace, tokens: OperationTokens, by: WorkspaceActor): bool =
  tokens.browserRevision != w.browser.revision implies not(canDispatch(w, tokens, by))
pure def sometimesPausedTaskIsRetained(w: Workspace): bool =
  w.assistant.activity == A::Paused and w.assistant.taskId != ""
pure def sometimesResumeRequiresObservation(w: Workspace): bool =
  w.assistant.activity == A::Rechecking and w.execution.phase == X::NeedObservation
pure def sometimesOperationDispatched(w: Workspace): bool = w.execution.phase == X::InFlight
pure def sometimesOperationVerified(w: Workspace): bool = w.execution.phase == X::Verified
```

### An ordinary website goal finishes only with its own verified endpoint

A successfully verified step does not itself complete the person's goal.
The trusted domain integration separately reports that the requested goal
has been fulfilled, with nonempty endpoint evidence and the same owner,
task, goal, page, device and operation versions. That report retires the
ordinary controller and permits a later task without labelling this one
abandoned. An attached payment must use its durable payment-result path;
an ordinary completion report cannot bypass its unresolved ledger.

```quint
pure def canCompleteOrdinary(w: Workspace, completion: GoalCompletion, by: WorkspaceActor): bool =
  by == Host and mayAssist(w) and observationIsCurrent(w) and w.paymentTask == "" and
  w.assistant.conversation.turn != C::Thinking and not(w.assistant.conversation.question) and
  w.execution.phase == X::Verified and w.assistant.activity == A::ReadyForStep and w.assistant.replacementId == "" and
  completion.owner == w.execution.owner and completion.task == w.assistant.taskId and completion.goal == w.assistant.goal and
  completion.deviceVersion == w.device.contextVersion and
  B::observationMatches(w.browser, w.browser.selected, completion.browserRevision) and
  completion.generation == w.execution.generation and completion.observation == w.execution.observation and
  A::canFinishTask(w.assistant, completion.task, completion.taskVersion, A::Completed, completion.evidence, C::ConversationRuntime)
pure def completeOrdinary(w: Workspace, completion: GoalCompletion, by: WorkspaceActor): Workspace = {
  ...w, execution: X::retire(w.execution, X::BrowserBridge),
  assistant: A::finishTask(w.assistant, completion.task, completion.taskVersion, A::Completed, completion.evidence, C::ConversationRuntime)
}
pure def lawPaymentCannotUseOrdinaryCompletion(w: Workspace, completion: GoalCompletion, by: WorkspaceActor): bool =
  w.paymentTask != "" implies not(canCompleteOrdinary(w, completion, by))
pure def sometimesOrdinaryGoalCompletes(w: Workspace): bool =
  w.paymentTask == "" and w.assistant.activity == A::Finished and w.assistant.outcome == A::Completed and w.execution.phase == X::Idle
```

## Story: Preserve payment authorization and uncertainty across surfaces

> As a person paying a bill, I want Home, Close, Sleep and manual navigation
> to revoke permission to submit while retaining what may already have happened.

### The active bill is bound to the observed owner and origin once

Selecting a different bill retains the old aggregate in the inactive registry
and selects its existing record or creates a previously unseen identity.
Reopening the same bill retrieves its existing durable attempt. Browser tasks
on any provider remain available while previous uncertain attempts are retained.
`paymentTask` is a link to the assistant-owned task, not another task state.
An explicit bill selection attaches the existing record to a new task; an
old payment result cannot silently finish an unrelated later conversation.
The future storage adapter validates and decodes that record before creating
its owning machine; event input cannot assign an arbitrary payment state.

```quint
pure def canBindPayment(w: Workspace, key: P::BillKey, by: WorkspaceActor): bool =
  by == Person and mayAssist(w) and observationIsCurrent(w) and w.execution.phase == X::Observed and
  w.execution.originVerified and w.execution.accountMatched and w.execution.redactionReady and
  not(w.execution.privateInput) and key.owner == w.execution.owner and key.origin == w.execution.origin and
  w.paymentTask == "" and P::validKey(key)
pure def bindPayment(w: Workspace, key: P::BillKey, by: WorkspaceActor): Workspace =
  val existing = if (w.payment.stage != P::Empty and w.payment.key == key) w.payment
    else storedPayment(key, w.otherPayments)
  val others = w.otherPayments.select(p => p.key != key)
  {
    ...w, paymentTask: w.assistant.taskId,
    payment: if (existing.stage == P::Empty) P::bind(P::initial, key, P::Person)
      else if (P::canResume(existing, P::Person)) P::resume(existing, P::Person) else existing,
    otherPayments: if (w.payment.stage != P::Empty and w.payment.key != key)
      others.append(quietPayment(w.payment)) else others
  }
pure def canReviewPayment(w: Workspace, currentReview: CurrentReview, by: WorkspaceActor): bool =
  by == Host and currentPaymentContext(w) and currentReview.deviceVersion == w.device.contextVersion and
  currentReview.browserRevision == w.browser.revision and currentReview.taskVersion == w.assistant.workVersion and
  P::canReview(w.payment, currentReview.review, P::BrowserHost)
pure def reviewPayment(w: Workspace, currentReview: CurrentReview, by: WorkspaceActor): Workspace = {
  ...w, payment: P::review(w.payment, currentReview.review, P::BrowserHost)
}
pure def paymentTokensMatch(w: Workspace, paymentTokens: PaymentTokens): bool =
  currentPaymentContext(w) and paymentTokens.deviceVersion == w.device.contextVersion and
  paymentTokens.browserRevision == w.browser.revision and paymentTokens.taskVersion == w.assistant.workVersion and
  paymentTokens.revision == w.payment.revision and paymentTokens.attempt == w.payment.attempt
```

### Review readback and durable journaling precede explicit approval

The host acknowledges finished readback of the exact review. Only the durable
store can acknowledge the unresolved window or report a write failure. A
failed write leaves a visible retryable save error and never enables submit.
Approval must be the person's completed, unambiguous response with no
correction; it is not inferred from speech fragments or website content.

```quint
pure def canReadBackPayment(w: Workspace, paymentTokens: PaymentTokens, by: WorkspaceActor): bool =
  by == Host and paymentTokensMatch(w, paymentTokens) and
  P::canRecordReadBack(w.payment, paymentTokens.revision, P::BrowserHost)
pure def readBackPayment(w: Workspace, paymentTokens: PaymentTokens, by: WorkspaceActor): Workspace = {
  ...w, payment: P::recordReadBack(w.payment, paymentTokens.revision, P::BrowserHost)
}
pure def canJournalPayment(w: Workspace, paymentTokens: PaymentTokens, succeeded: bool, by: WorkspaceActor): bool =
  by == Store and paymentTokensMatch(w, paymentTokens) and
  P::canPersistWindow(w.payment, paymentTokens.revision, P::DurableStore)
pure def journalPayment(w: Workspace, paymentTokens: PaymentTokens, succeeded: bool, by: WorkspaceActor): Workspace = {
  ...w, payment: if (succeeded) P::persistWindow(w.payment, paymentTokens.revision, P::DurableStore)
    else P::windowSaveFailed(w.payment, paymentTokens.revision, P::DurableStore)
}
```

### A fully classified spoken approval is recorded and authorized atomically

The trusted input boundary routes a complete human utterance that explicitly
approves the current readback here, under authenticated person intent. It
records the same words through the ordinary hearing contract and authorizes
that exact payment in one transition. Partial audio, playback, a late token,
nonapproval or any correction cannot use this route. Other spoken input uses
the generic interaction path, which invalidates the review. This distinction
prevents a valid approval from invalidating itself and prevents a correction
from leaving an old authorization usable. The conversation may think about
its acknowledgment while this already classified payment decision proceeds.

```quint

pure def canApproveSpokenPayment(w: Workspace, paymentTokens: PaymentTokens, spoken: SpokenApproval, by: WorkspaceActor): bool =
  by == Person and spoken.complete and spoken.approves and not(spoken.correction) and
  w.assistant.activity == A::ReadyForStep and w.assistant.replacementId == "" and
  paymentTokensMatch(w, paymentTokens) and
  A::canHear(w.assistant, spoken.token, spoken.text, spoken.owner, C::ConversationRuntime) and
  P::canAuthorize(w.payment, paymentTokens.revision, spoken.correction, P::Person)
pure def approveSpokenPayment(w: Workspace, paymentTokens: PaymentTokens, spoken: SpokenApproval, by: WorkspaceActor): Workspace = {
  ...w, assistant: A::hear(w.assistant, spoken.token, spoken.text, spoken.owner, C::ConversationRuntime),
  payment: P::authorize(w.payment, paymentTokens.revision, spoken.correction, P::Person),
  wake: W::cancel(w.wake, W::WakeUser)
}
pure def lawCorrectedSpeechCannotApprove(w: Workspace, paymentTokens: PaymentTokens, spoken: SpokenApproval, by: WorkspaceActor): bool =
  (not(spoken.complete) or not(spoken.approves) or spoken.correction)
  implies not(canApproveSpokenPayment(w, paymentTokens, spoken, by))
pure def lawLateSpeechCannotApprove(w: Workspace, paymentTokens: PaymentTokens, spoken: SpokenApproval, by: WorkspaceActor): bool =
  spoken.token != w.assistant.conversation.generation implies not(canApproveSpokenPayment(w, paymentTokens, spoken, by))
pure def sometimesSpokenApprovalIsRecorded(w: Workspace): bool =
  w.payment.stage == P::Authorized and w.assistant.conversation.turn == C::Thinking
```

### Final submission checks the current workspace and consumes one payment authorization

The actual actuator rechecks the emitted context envelope immediately before
its external effect. Every departure calls the payment's Stop transition,
revoking freshness and approval. An interrupted journaled window stays
Unknown; Resume cannot authorize or submit it again. It must be investigated.
A directly observed website tap is recorded without an additional effect.

```quint
pure def canSubmitPayment(w: Workspace, paymentTokens: PaymentTokens, by: WorkspaceActor): bool =
  by == Actuator and paymentTokensMatch(w, paymentTokens) and
  A::canStartStep(w.assistant, w.assistant.taskId, paymentTokens.taskVersion, "payment", C::ConversationRuntime) and
  P::canSubmit(w.payment, paymentTokens.revision, paymentTokens.attempt, P::Executor)
pure def submitPayment(w: Workspace, paymentTokens: PaymentTokens, by: WorkspaceActor): WorkspaceResult =
  val submitted = P::submit(w.payment, paymentTokens.revision, paymentTokens.attempt, P::Executor)
  val working = A::startStep(w.assistant, w.assistant.taskId, paymentTokens.taskVersion, "payment", C::ConversationRuntime)
  { state: { ...w, payment: submitted.state,
      assistant: A::waitForWebsite(working, working.taskId, working.workVersion, C::ConversationRuntime) },
    out: submitted.out.listMap(effect => Pay({ deviceVersion: w.device.contextVersion,
      browserRevision: w.browser.revision, taskVersion: w.assistant.workVersion, effect: effect })) }
pure def canObservePaymentTap(w: Workspace, paymentTokens: PaymentTokens, by: WorkspaceActor): bool =
  by == Host and paymentTokensMatch(w, paymentTokens) and
  A::canStartStep(w.assistant, w.assistant.taskId, paymentTokens.taskVersion, "payment", C::ConversationRuntime) and
  P::canObserveManualSubmit(w.payment, paymentTokens.attempt, P::BrowserHost)
pure def observePaymentTap(w: Workspace, paymentTokens: PaymentTokens, by: WorkspaceActor): Workspace =
  val working = A::startStep(w.assistant, w.assistant.taskId, paymentTokens.taskVersion, "payment", C::ConversationRuntime)
  { ...w, payment: P::observeManualSubmit(w.payment, paymentTokens.attempt, P::BrowserHost),
    assistant: A::waitForWebsite(working, working.taskId, working.workVersion, C::ConversationRuntime) }
pure def lawHiddenPaymentCannotSubmit(w: Workspace, paymentTokens: PaymentTokens, by: WorkspaceActor): bool =
  (w.device.surface != S::Browser or not(A::isVisible(w.assistant)) or w.device.readiness != S::Ready)
  implies not(canSubmitPayment(w, paymentTokens, by))
pure def lawStalePaymentContextCannotSubmit(w: Workspace, paymentTokens: PaymentTokens, by: WorkspaceActor): bool =
  (paymentTokens.deviceVersion != w.device.contextVersion or paymentTokens.browserRevision != w.browser.revision)
  implies not(canSubmitPayment(w, paymentTokens, by))
```

### Verified provider outcomes finish the task while storage retains the payment record

Scheduled, Accepted and Completed finish the requested submission task but
remain distinct payment facts; only Completed claims settlement. Verified
failure or a provider-evidenced return is a failed endpoint. Pending and
Unknown keep the task unresolved. The ordinary controller is retired only
when verified endpoint evidence has been saved durably and finishes the task.
Saving a result can fail without undoing the observed payment or offering
another submission. Grace shows the observed result and a receipt-save retry
while retaining this unfinished bookkeeping, so restart cannot retain a
completed task beside a lost receipt.

Discovered by the proof review: editing recent history is not a departure from
the current page. Every browser-control edit preserves the payment attempt and
durable record. Only a changed page or geometry revision revokes readiness;
history-only edits retain the current readiness.

```quint
pure def terminalPayment(result: P::PaymentOutcome): bool =
  P::positiveOutcome(result) or result == P::VerifiedFailure or result == P::Returned
pure def afterPaymentEvidence(payment: P::Payment, w: Workspace): Workspace =
  if (terminalPayment(payment.result) and not(P::outcomeNeedsSave(payment)) and
      w.paymentTask == w.assistant.taskId and A::unfinished(w.assistant) and w.assistant.activity != A::Paused) {
    ...w, payment: quietPayment(payment), execution: X::retire(w.execution, X::BrowserBridge),
    assistant: A::finishTask(w.assistant, w.assistant.taskId, w.assistant.workVersion,
      if (P::positiveOutcome(payment.result)) A::Completed else A::VerifiedFailure,
      payment.evidence, C::ConversationRuntime)
  } else if (payment.result == P::NotSubmitted and w.assistant.activity == A::WebsiteWait) {
    ...w, payment: payment,
    assistant: A::receiveStep(w.assistant, w.assistant.taskId, w.assistant.workVersion,
      w.assistant.operation, "No submission was established; review before continuing", false, C::ConversationRuntime)
  } else { ...w, payment: payment }
pure def canRecordPayment(w: Workspace, currentOutcome: CurrentOutcome, by: WorkspaceActor): bool =
  by == Host and currentPaymentContext(w) and currentOutcome.deviceVersion == w.device.contextVersion and
  currentOutcome.browserRevision == w.browser.revision and currentOutcome.taskVersion == w.assistant.workVersion and
  P::canRecordOutcome(w.payment, currentOutcome.report, P::BrowserHost)
pure def recordPayment(w: Workspace, currentOutcome: CurrentOutcome, by: WorkspaceActor): Workspace =
  afterPaymentEvidence(P::recordOutcome(w.payment, currentOutcome.report, P::BrowserHost), w)
pure def canReconcilePriorPayment(w: Workspace, currentPrior: CurrentPrior, by: WorkspaceActor): bool =
  by == Store and currentPaymentContext(w) and currentPrior.deviceVersion == w.device.contextVersion and
  currentPrior.browserRevision == w.browser.revision and currentPrior.taskVersion == w.assistant.workVersion and
  P::canReconcilePrior(w.payment, currentPrior.report, P::DurableStore)
pure def reconcilePriorPayment(w: Workspace, currentPrior: CurrentPrior, by: WorkspaceActor): Workspace =
  afterPaymentEvidence(P::reconcilePrior(w.payment, currentPrior.report, P::DurableStore), w)
pure def canSavePayment(w: Workspace, saveReport: SaveReport, by: WorkspaceActor): bool =
  by == Store and P::validKey(saveReport.key) and
  P::canSaveOutcome(paymentByKey(w, saveReport.key), saveReport.revision, P::DurableStore)
pure def savePayment(w: Workspace, saveReport: SaveReport, by: WorkspaceActor): Workspace =
  if (w.payment.stage != P::Empty and saveReport.key == w.payment.key)
    afterPaymentEvidence(P::saveOutcome(w.payment, saveReport.revision, saveReport.succeeded, P::DurableStore), w)
  else { ...w, otherPayments: w.otherPayments.listMap(p => if (p.key == saveReport.key)
    P::saveOutcome(p, saveReport.revision, saveReport.succeeded, P::DurableStore) else p) }
pure def canRetryPayment(w: Workspace, by: WorkspaceActor): bool =
  by == Person and currentPaymentContext(w) and P::canRetry(w.payment, P::Person)
pure def retryPayment(w: Workspace, by: WorkspaceActor): Workspace = {
  ...w, payment: P::retry(w.payment, P::Person)
}
pure def stepPaymentSwitchRetainsRecords(before: Workspace, via: str, after: Workspace): bool =
  via == "bindPayment" implies paymentRecords(before).every(prior =>
    paymentRecords(after).some(record => record.key == prior.key and
      record.attempt == prior.attempt and record.durable == prior.durable and record.result == prior.result))
pure def stepDepartureKeepsPaymentAttempt(before: Workspace, via: str, after: Workspace): bool =
  (via == "changePage" implies after.payment.attempt == before.payment.attempt and
    after.payment.durable == before.payment.durable) and
  ((via == "changeLifecycle" or via == "setAvailability" or via == "visit" or
    via == "returnToApplication" or via == "closeBrowser" or via == "closeGrace" or via == "stop" or
    (via == "changePage" and before.browser.revision != after.browser.revision) or
    via == "unexpectedPage" or via == "purgePrivate" or via == "abandonTask" or
    via == "chooseHomePage" or via == "chooseSettingsPage" or via == "togglePopover" or via == "dismissPopover")
  implies after.payment.attempt == before.payment.attempt and after.payment.durable == before.payment.durable and
    not(after.payment.fresh) and (after.payment.stage == P::Empty or not(after.payment.live)))
pure def sometimesPaymentAuthorized(w: Workspace): bool = w.payment.stage == P::Authorized
pure def sometimesPaymentDispatched(w: Workspace): bool = w.payment.stage == P::Checking and w.payment.dispatched
pure def sometimesInterruptedPaymentIsUncertain(w: Workspace): bool =
  w.assistant.activity == A::Paused and w.payment.result == P::Unknown and not(w.payment.live)
pure def sometimesPaymentResultFinishesTask(w: Workspace): bool =
  w.assistant.activity == A::Finished and P::positiveOutcome(w.payment.result) and w.execution.phase == X::Idle
```

### Finite exploration samples do not cap runtime identities or website values

The samples exercise the first operation and a stale context alongside a
different website. They are only simulation inputs; generated APIs accept
arbitrary request identifiers, nonempty destinations and integer generations.
Walks include an ordinary task and a replacement on another origin. Navigation
uses its default weight, giving current callbacks a chance to arrive before
a later visit advances the context. Separate guarded traces cover permission,
startup-failure and restart variants.

```quint
pure val availabilityValues = Set(
  { connection: S::Online, reasoning: true, microphone: true, observation: true })
pure val aValues = Set(A::initial,
  A::pause(A::beginTask(A::open(A::initial, C::ConversationUser),
    "task", "Read the account", C::ConversationUser), C::ConversationUser))
pure val changedValues = aValues
pure val preferencesValues = Set(R::initial)
pure val preferenceEffectValues = Set(R::PlaySample({ pace: R::Normal, volume: 60, muted: false }))
pure val xValues = Set(X::initial,
  X::pause(X::start(X::initial, "owner", "task", "https://utility.example", X::User), X::User))
pure val pValues = Set(P::initial, P::bind(P::initial, P::exampleKey, P::Person))
pure val paymentValues = pValues
pure val recordsValues = Set(List(), List(P::bind(P::initial, P::exampleKey, P::Person)))
pure val deviceValues = Set(S::initial, S::finishStartup(S::initial, true))
pure val browserValues = Set(B::initial, B::navigate(B::initial, "https://utility.example"))
pure val wValues = Set(initial)
pure val detectionValues = Set(
  { ...W::exampleDetection, generation: 2, conversationVersion: 1 },
  { ...W::exampleDetection, generation: 3, conversationVersion: 1 },
  { ...W::exampleDetection, generation: 2, conversationVersion: 0 },
  { ...W::exampleDetection, generation: 2, conversationVersion: 4 },
  { ...W::exampleDetection, generation: 3, conversationVersion: 5 },
  { ...W::exampleDetection, generation: 2, conversationVersion: 4, prior: W::WasExpanded },
  { ...W::exampleDetection, generation: 0, context: { ...W::availableContext, enabled: false } })
pure val timerValues = Set(
  { generation: 3, conversationVersion: 1, now: 8000 }, { generation: 3, conversationVersion: 2, now: 16000 },
  { generation: 4, conversationVersion: 1, now: 8000 }, { generation: 4, conversationVersion: 2, now: 16000 },
  { generation: 3, conversationVersion: 4, now: 8000 }, { generation: 3, conversationVersion: 5, now: 16000 },
  { generation: 4, conversationVersion: 5, now: 8000 }, { generation: 4, conversationVersion: 6, now: 16000 })
pure val settingsValues = R::settingsValues
pure val inputValues = I::inputValues
pure val requestedTaskValues = Set("other", "")
pure val requestedGoalValues = Set("Read another account", "")
pure val spokenValues = Set(
  { token: 3, text: "Yes, pay this bill.", owner: C::HumanAudio, complete: true, approves: true, correction: false },
  { token: 4, text: "Yes, pay this bill.", owner: C::HumanAudio, complete: true, approves: true, correction: false },
  { token: 2, text: "Yes, pay this bill.", owner: C::HumanAudio, complete: true, approves: true, correction: false },
  { token: 1, text: "Yes, pay this bill.", owner: C::HumanAudio, complete: true, approves: true, correction: false },
  { token: 2, text: "Yes, but change the amount.", owner: C::HumanAudio, complete: true, approves: true, correction: true },
  { token: 2, text: "Yes", owner: C::HumanAudio, complete: false, approves: true, correction: false })
pure val taskRequestValues = Set(
  { owner: "owner", task: "task", goal: "Read the account", origin: "https://utility.example" },
  { owner: "owner", task: "other", goal: "Read another account", origin: "https://credit.example" })
pure val browserInputValues = BC::browserInputValues
pure val unexpectedValues = Set(
  { id: 1, revision: 2, destination: "https://utility.example/updated" },
  { id: 2, revision: 2, destination: "https://credit.example" },
  { id: 1, revision: 0, destination: "https://utility.example/updated" })
pure val loadReportValues = Set(
  { id: 1, version: 1, result: B::Loaded }, { id: 1, version: 1, result: B::LoadFailed },
  { id: 1, version: 3, result: B::Loaded })
pure val observed: CurrentObservation = {
  deviceVersion: 6, browserRevision: 2, taskVersion: 1, website: X::goodObservation, checkpoint: "Read the current account"
}
pure val currentObservationValues = Set(observed,
  { ...observed, website: { ...X::goodObservation, task: "other", origin: "https://credit.example" } },
  { ...observed, browserRevision: 3, website: { ...X::goodObservation, generation: 2 } },
  { ...observed, browserRevision: 3, taskVersion: 2, website: { ...X::goodObservation, generation: 2 } },
  { ...observed, browserRevision: 4, taskVersion: 3,
    website: { ...X::goodObservation, generation: 3, task: "other", origin: "https://credit.example" } },
  { ...observed, browserRevision: 4, taskVersion: 3, website: { ...X::goodObservation, generation: 3 } },
  { ...observed, browserRevision: 4, taskVersion: 4, website: { ...X::goodObservation, generation: 3 } })
pure val operation: OperationRequest = {
  deviceVersion: 6, browserRevision: 2, taskVersion: 1,
  generation: 1, observation: 1, target: "control", valueRef: "", kind: X::ReadPage
}
pure val operationRequestValues = Set(operation, { ...operation, deviceVersion: 0 }, { ...operation, kind: X::FinalSubmit })
pure val tokensValues = Set(
  { deviceVersion: 6, browserRevision: 2, taskVersion: 1, generation: 1, observation: 1 },
  { deviceVersion: 0, browserRevision: 2, taskVersion: 1, generation: 1, observation: 1 })
pure val currentVerificationValues = Set({ deviceVersion: 6, browserRevision: 2, taskVersion: 1,
  website: X::goodVerification, checkpoint: "Current account read", needsUser: false },
  { deviceVersion: 6, browserRevision: 2, taskVersion: 1,
    website: { ...X::goodVerification, task: "other" }, checkpoint: "Current account read", needsUser: false },
  { deviceVersion: 6, browserRevision: 2, taskVersion: 1,
    website: X::goodVerification, checkpoint: "Please check the account details", needsUser: true })
pure val completedGoal: GoalCompletion = {
  owner: "owner", task: "task", goal: "Read the account", evidence: "goal-endpoint",
  deviceVersion: 6, browserRevision: 2, taskVersion: 2, generation: 1, observation: 1
}
pure val completionValues = Set(completedGoal,
  { ...completedGoal, task: "other", goal: "Read another account" },
  { ...completedGoal, evidence: "" },
  { ...completedGoal, taskVersion: 1 }, { ...completedGoal, goal: "Another goal" })
pure val paymentTokensValues = Set(
  { deviceVersion: 6, browserRevision: 2, taskVersion: 1, revision: 1, attempt: 0 },
  { deviceVersion: 6, browserRevision: 2, taskVersion: 1, revision: 1, attempt: 1 },
  { deviceVersion: 6, browserRevision: 2, taskVersion: 2, revision: 1, attempt: 1 },
  { deviceVersion: 0, browserRevision: 2, taskVersion: 1, revision: 1, attempt: 1 })
pure val currentReviewValues = Set({ deviceVersion: 6, browserRevision: 2, taskVersion: 1, review: P::exampleReview })
pure val currentOutcomeValues = Set({ deviceVersion: 6, browserRevision: 2, taskVersion: 1, report: P::exampleOutcome },
  { deviceVersion: 6, browserRevision: 2, taskVersion: 2, report: P::exampleOutcome },
  { deviceVersion: 6, browserRevision: 3, taskVersion: 1, report: { ...P::exampleOutcome, revision: 3 } },
  { deviceVersion: 6, browserRevision: 2, taskVersion: 1, report: { ...P::exampleOutcome, result: P::Pending, reference: "" } },
  { deviceVersion: 6, browserRevision: 2, taskVersion: 2, report: { ...P::exampleOutcome, result: P::VerifiedFailure, reference: "" } },
  { deviceVersion: 6, browserRevision: 2, taskVersion: 2, report: { ...P::exampleOutcome, result: P::Returned, reference: "" } })
pure val currentPriorValues = Set(
  { deviceVersion: 6, browserRevision: 2, taskVersion: 1, report: P::examplePrior },
  { deviceVersion: 6, browserRevision: 2, taskVersion: 1, report: { ...P::examplePrior, result: P::VerifiedFailure, reference: "" } },
  { deviceVersion: 6, browserRevision: 2, taskVersion: 1, report: { ...P::examplePrior, result: P::Returned, reference: "" } })
pure val saveReportValues = Set(
  { key: P::exampleKey, revision: 3, succeeded: true },
  { key: P::exampleKey, revision: 4, succeeded: true },
  { key: P::exampleKey, revision: 3, succeeded: false })
pure val progressValues = Set(
  { owner: "owner", task: "task", deviceVersion: 6, browserRevision: 2, taskVersion: 1,
    generation: 1, observation: 1, paymentRevision: 2, attempt: 1, kind: OrdinaryProgress, destination: "" },
  { owner: "owner", task: "task", deviceVersion: 6, browserRevision: 2, taskVersion: 1,
    generation: 1, observation: 1, paymentRevision: 2, attempt: 1, kind: PaymentProgress, destination: "" })
pure val weight_changeLifecycle = 4
pure val weight_setAvailability = 4
pure val weight_openGrace = 12
pure val weight_publishGuidance = 12
pure val weight_begin = 24
pure val weight_receiveLoad = 24
pure val weight_observe = 24
pure val weight_prepare = 2
pure val weight_dispatch = 24
pure val weight_verify = 24
pure val weight_bindPayment = 24
pure val weight_reviewPayment = 24
pure val weight_readBackPayment = 4
pure val weight_journalPayment = 24
pure val weight_approveSpokenPayment = 24
pure val weight_submitPayment = 24
pure val weight_recordPayment = 24
pure val weight_completeOrdinary = 24
pure val weight_savePayment = 24
pure val weight_interact = 8
pure val weight_detectWake = 8
pure val weight_wakeNoSpeech = 8
pure val weight_wakeReturn = 8
pure val tokenValues = Set(-1, 2)
pure val destinationValues = Set(S::Browser, S::Home, S::DeviceSettings)
pure val lifecycleValues = Set(StartupSucceeded)
```

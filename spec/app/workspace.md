# The active Grace workspace

This composition makes the [device](./shell.md), [browser](./browser.md),
[assistant](./assistant.md) and [ordinary website controller](./execution.md)
obey one interruption boundary. The actual states live here, rather than a
second set of readiness or task flags. The assistant owns the task identity;
the controller carries the same identity only to reject stale operations.

The canonical [payment aggregates](./commitment.md) are held directly, one
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
> When I choose Wi-Fi, Home or Settings during a full-screen conversation,
> Grace moves into the lower pane so I can see the control I chose.

### The workspace contains the actual device, page, conversation and operation

The two observed versions are evidence references, not alternate page state.
There is no provider name, domain allowlist or fixed sequence of website steps.
Caller identities are supplied by the authenticated host, not website content.
Discovered by the proof: every retained plan step has a named subject and
nonempty outcome, so the next instruction still exists after a receipt.
The workspace also retains the component rules for a loaded page's security,
the assistant's visible work, guidance and conversation offers, and the
execution's verified observation context, including its quoted page facts
and that a queued step is one Grace may take herself. The workspace keeps every
always rule of the execution it holds.

```quint
import shell as S from "./shell"
import browser as B from "./browser"
import assistant as A from "./assistant"
import conversation as C from "./conversation"
import execution as X from "./execution"
import commitment as CM from "./commitment"
import task as T from "./task"
import preferences as R from "./preferences"
import wake as W from "./wake"
import interaction as I from "./interaction"
import browserControls as BC from "./browserControls"

type WorkspaceActor = Person | Host | Store | Actuator
type StepDetails = { surface: S::Surface, subject: str, outcome: str }
type GuidedStep = ReadMail | ReadBrowser | ReadChangedBrowser | ReadStatement | ReadCalendar | SaveMailAppointment
  | ReachNamedPage({ subject: str }) | SurfaceOutcome({ surface: S::Surface, subject: str, outcome: str })
type GuidedMail = { account: int, owner: str, address: str, ref: str, generation: int, revision: int, version: str }
type GuidedCalendarApproval = {
  task: str, account: int, owner: str, calendar: str, sourceRef: str, provisional: str, proposal: int,
  title: str, starts: int, ends: int, timezone: str, location: str, notes: str
}
type GuidedReceipt = { sourceKey: str, evidence: str }
type GuidedPlan = {
  owner: str, steps: List[GuidedStep], receipts: List[GuidedReceipt], openingBrowser: int, originalAsk: str, linkStep: int, linkUrl: str,
  mail: GuidedMail, calendarApproval: GuidedCalendarApproval, savedOccurrence: str, savedEvidence: str
}
type GuidedRequest = { owner: str, task: str, goal: str, steps: List[GuidedStep] }
type GuidedObservation = {
  owner: str, task: str, version: int, deviceVersion: int, browserRevision: int,
  step: GuidedStep, sourceKey: str, evidence: str
}
type GuidedNamedPageCheck = { report: GuidedObservation, documentId: str, loadVersion: int, url: str, heading: str }
type GuidedMailCheck = { report: GuidedObservation, mail: GuidedMail }
type GuidedCalendarReadback = { approval: GuidedCalendarApproval, occurrence: str, evidence: str }
type GuidedReview = { revision: int, generation: int, workVersion: int, request: GuidedRequest }
type GuidedLink = {
  task: str, version: int, generation: int, deviceVersion: int, browserRevision: int,
  stepIndex: int, url: str
}
type ReviewOffer = { owner: str, task: str, generation: int, workVersion: int, steps: List[GuidedStep] }
pure def emptyReview(revision: int): GuidedReview = {
  revision: revision, generation: -1, workVersion: -1, request: { owner: "", task: "", goal: "", steps: List() }
}
pure val noGuidedMail: GuidedMail = { account: 0, owner: "", address: "", ref: "", generation: 0, revision: 0, version: "" }
pure val noGuidedApproval: GuidedCalendarApproval = {
  task: "", account: 0, owner: "", calendar: "", sourceRef: "", provisional: "", proposal: -1,
  title: "", starts: 0, ends: 0, timezone: "", location: "", notes: ""
}
pure val emptyPlan: GuidedPlan = {
  owner: "", steps: List(), receipts: List(), openingBrowser: 0, originalAsk: "", linkStep: -1, linkUrl: "",
  mail: noGuidedMail, calendarApproval: noGuidedApproval, savedOccurrence: "", savedEvidence: ""
}
pure def guidedDetails(guidedStep: GuidedStep): StepDetails = match guidedStep {
  | ReadMail => { surface: S::Email, subject: "Open email", outcome: "Open the email you want me to read." }
  | ReadBrowser => { surface: S::Browser, subject: "Open website", outcome: "Open the page you want me to check." }
  | ReadStatement => { surface: S::Browser, subject: "Current statement", outcome: "Check the statement amount due and its due date." }
  | ReadChangedBrowser => { surface: S::Browser, subject: "Next website page", outcome: "Open the next page you want me to check." }
  | ReadCalendar => { surface: S::Calendar, subject: "Saved appointment", outcome: "Open the saved appointment you want me to read." }
  | SaveMailAppointment => { surface: S::Calendar, subject: "Appointment from the email", outcome: "Ask me to prepare the appointment from the email. Approve its details separately." }
  | ReachNamedPage(target) => { surface: S::Browser, subject: target.subject, outcome: "Find and check the named page." }
  | SurfaceOutcome(details) => { surface: details.surface, subject: details.subject, outcome: details.outcome }
}
pure val noGuidedStep: GuidedStep = SurfaceOutcome({ surface: S::Home, subject: "", outcome: "" })
pure def hasNext(plan: GuidedPlan): bool = plan.receipts.length() < plan.steps.length()
pure def nextOutcome(plan: GuidedPlan): GuidedStep = plan.steps.nthOr(plan.receipts.length(), noGuidedStep)
type Workspace = {
  device: S::Shell, browser: B::Browser, assistant: A::Assistant,
  execution: X::Execution, commitment: CM::Commitment, otherCommitments: List[CM::Commitment],
  preferences: R::Preferences, wake: W::Wake,
  plan: GuidedPlan, review: GuidedReview, commitmentTask: str, observedDevice: int, observedBrowser: int
}
type WorkspaceEffect = Execute({ deviceVersion: int, browserRevision: int, effect: X::WebsiteEffect })
  | Commit({ deviceVersion: int, browserRevision: int, taskVersion: int, effect: CM::CommitmentEffect })
  | WakeFeedback({ signal: W::WakeSignal })
  | PreferenceFeedback({ revision: int, effect: R::PreferenceEffect })
type WorkspaceResult = { state: Workspace, out: List[WorkspaceEffect] }
type BrowserObservationChoice = { allowed: bool, deviceVersion: int, browserRevision: int }
type Availability = {
  connection: S::Connectivity, reasoning: bool, microphone: bool, observation: bool
}
type Lifecycle = StartupSucceeded | StartupFailed | RetryStartup | SleepDevice | WakeDevice | RestartDevice
type TaskRequest = { owner: str, task: str, goal: str, origin: str }
type LoadReport = { id: int, version: int, result: B::Load }
type UnexpectedNavigation = { id: int, revision: int, loadVersion: int, destination: str }
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
type CommitmentTokens = {
  deviceVersion: int, browserRevision: int, taskVersion: int,
  revision: int, attempt: int
}
type CurrentReview = { deviceVersion: int, browserRevision: int, taskVersion: int, review: T::ReviewReport }
type CurrentOutcome = { deviceVersion: int, browserRevision: int, taskVersion: int, report: CM::OutcomeReport }
type CurrentPrior = { deviceVersion: int, browserRevision: int, taskVersion: int, report: CM::PriorReport }
type SaveReport = { key: T::Subject, revision: int, succeeded: bool }
type ProgressKind = OrdinaryProgress | CommitmentProgress
type ProgressReport = {
  owner: str, task: str, deviceVersion: int, browserRevision: int, taskVersion: int,
  generation: int, observation: int, commitmentRevision: int, attempt: int,
  kind: ProgressKind, destination: str
}
pure val initial: Workspace = {
  device: S::initial, browser: B::initial, assistant: A::initial,
  execution: X::initial, commitment: CM::initial, otherCommitments: List(),
  preferences: R::initial, wake: W::initial,
  plan: emptyPlan, review: emptyReview(0), commitmentTask: "", observedDevice: 0, observedBrowser: 0
}
pure def privateSignInActive(w: Workspace): bool =
  w.device.surface == S::Browser and B::activeTab(w.browser).manualSignIn
pure def privateSurfaceActive(w: Workspace): bool =
  w.device.surface == S::Passwords or privateSignInActive(w)
pure def mayAssist(w: Workspace): bool =
  not(privateSignInActive(w)) and w.device.connectivity == S::Online and S::mayRequestReasoning(w.device) and
  S::mayObserveBrowser(w.device) and A::isVisible(w.assistant)
pure def observationIsCurrent(w: Workspace): bool =
  w.observedDevice == w.device.contextVersion and w.observedBrowser == w.browser.revision
pure def quietAssistant(a: A::Assistant): A::Assistant =
  if (A::unfinished(a)) A::pause(a, C::ConversationRuntime)
  else if (A::canQuiet(a, C::ConversationRuntime)) A::quiet(a, C::ConversationRuntime) else a
pure def quietExecution(x: X::Execution): X::Execution =
  if (X::canPause(x, X::BrowserBridge)) X::pause(x, X::BrowserBridge) else x
pure def quietCommitment(p: CM::Commitment): CM::Commitment =
  if (CM::canStop(p, T::Host)) CM::stop(p, T::Host)
  else if (CM::canInvalidate(p, T::Host)) CM::invalidate(p, T::Host) else p
pure def interrupted(device: S::Shell, browser: B::Browser, w: Workspace): Workspace =
  val leavesSurface = device.surface != w.device.surface or device.readiness != S::Ready
  val assistant = quietAssistant(w.assistant)
  {
    ...w, device: device,
    browser: if (leavesSurface and browser.editingAddress) B::dismissAddress(browser) else browser,
    assistant: if (leavesSurface and A::canDismissKeyboard(assistant, C::ConversationUser))
      A::dismissKeyboard(assistant, C::ConversationUser) else assistant,
    execution: quietExecution(w.execution), commitment: quietCommitment(w.commitment),
    wake: W::cancel(w.wake, W::WakeHost)
  }
pure def alwaysDeviceRules(w: Workspace): bool =
  S::alwaysContextVersionIsNonnegative(w.device) and S::alwaysReturnDestinationIsAnApplication(w.device)
pure def alwaysBrowserRules(w: Workspace): bool =
  B::alwaysTabsAreWellFormed(w.browser) and B::alwaysTabIdentifiersAreUnique(w.browser) and
  B::alwaysSelectedTabExists(w.browser) and B::alwaysBrowserCountersAreValid(w.browser) and
  B::alwaysOnlyALoadedPageIsSecure(w.browser) and B::alwaysRecentDestinationsAreDistinct(w.browser)
pure def alwaysAssistantRules(w: Workspace): bool = I::validAssistant(w.assistant)
pure def alwaysExecutionRules(w: Workspace): bool =
  X::alwaysIdentity(w.execution) and X::alwaysGenerations(w.execution) and
  X::alwaysFactsAreQuoted(w.execution) and X::alwaysObservedContextExists(w.execution) and
  X::alwaysQueuedStepIsGraces(w.execution) and X::alwaysPrepared(w.execution) and X::alwaysExplainedBlock(w.execution) and
  X::alwaysFailureCount(w.execution) and X::alwaysFailedApproachIsConcrete(w.execution) and
  X::alwaysNoExhaustedApproachQueued(w.execution)
pure def alwaysCommitmentRules(w: Workspace): bool =
  CM::validCommitment(w.commitment) and w.otherCommitments.every(p => CM::validCommitment(p))
pure def alwaysCommitmentRegistryIsCanonical(w: Workspace): bool =
  w.otherCommitments.every(p => p.stage != CM::Empty and not(p.live) and not(p.fresh) and not(p.readBack) and
    (w.commitment.stage == CM::Empty or p.key != w.commitment.key) and
    w.otherCommitments.select(other => other.key == p.key).length() == 1)
pure def commitmentRecords(w: Workspace): List[CM::Commitment] =
  if (w.commitment.stage == CM::Empty) w.otherCommitments else w.otherCommitments.append(w.commitment)
pure def storedCommitment(key: T::Subject, records: List[CM::Commitment]): CM::Commitment =
  records.foldl(CM::initial, (found, record) => if (record.key == key) record else found)
pure def commitmentByKey(w: Workspace, key: T::Subject): CM::Commitment =
  if (w.commitment.stage != CM::Empty and w.commitment.key == key) w.commitment else storedCommitment(key, w.otherCommitments)
pure def matchingCommitment(w: Workspace): bool =
  w.commitment.key.owner == w.execution.owner and w.commitment.key.origin == w.execution.origin
pure def currentCommitmentContext(w: Workspace): bool =
  mayAssist(w) and observationIsCurrent(w) and w.execution.phase == X::Observed and
  w.execution.originVerified and w.execution.redactionReady and not(w.execution.privateInput) and
  matchingCommitment(w) and w.execution.matchedAccount == w.commitment.key.account and
  w.execution.matchedAccount != "" and w.commitmentTask == w.assistant.taskId
pure def alwaysCommitmentAssociation(w: Workspace): bool =
  w.commitmentTask != "" implies w.commitment.stage != CM::Empty and w.commitmentTask == w.assistant.taskId
pure def alwaysCommitmentUsesCanonicalIdentity(w: Workspace): bool =
  (w.commitmentTask != "" and w.execution.phase != X::Idle) implies matchingCommitment(w)
pure def alwaysCommitmentReviewUsesCurrentContext(w: Workspace): bool =
  w.commitment.fresh implies currentCommitmentContext(w)
pure def alwaysPausedCommitmentCannotSubmit(w: Workspace): bool =
  w.assistant.activity == A::Paused implies not(w.commitment.fresh) and
    (w.commitment.stage == CM::Empty or not(w.commitment.live))
pure def alwaysOneTask(w: Workspace): bool =
  (A::unfinished(w.assistant) iff (w.execution.phase != X::Idle or hasNext(w.plan))) and
  (w.plan.owner != "" implies w.execution.phase == X::Idle and w.commitmentTask == "") and
  ((w.plan.owner == "") iff w.plan.steps.length() == 0) and
  w.plan.receipts.length() <= w.plan.steps.length() and
  w.plan.steps.every(s => guidedDetails(s).subject != "" and guidedDetails(s).outcome != "") and
  (w.execution.phase != X::Idle implies w.execution.task == w.assistant.taskId)
pure def alwaysPausedTogether(w: Workspace): bool =
  (w.assistant.activity == A::Paused) iff (w.execution.phase == X::Paused or (hasNext(w.plan) and w.assistant.activity == A::Paused))
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
Sleep hides Grace after pausing it, preserving the task, transcript and draft.
Touch waking restores the application surface without reopening Grace; an
enabled wake phrase can explicitly open a new exchange. Native lock blocks
application access until OS authentication permits it. The model relies on the
host supplying `WakeDevice` or an admitted `WakeDetection.context.ready` only
after Grace may be shown. Unlocking alone does not resume the task.

Discovered by requirements review: applying the same pause to Restart retained
an executable pre-crash task, contrary to ANDROID 09. Restart clears the active
task, conversation, unsent chat draft and guidance, and retires website work.
The prototype's Restart also returns Home with a fresh blank browser tab
(1765–1767). Recent destinations remain; native cookie/session restoration is
not evidence of authentication and must be reobserved. Callback generations
advance rather than returning to initial zeroes. Confirmed preferences and
every canonical payment record survive; a volatile payment observation restores
from its durable outcome, including Unknown. Restart never reports a completed
task or retries a payment.

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
pure def restartedAssistant(a: A::Assistant): A::Assistant = {
  ...A::initial, workVersion: a.workVersion + 1,
  guidance: { ...A::noGuidance, revision: a.guidance.revision + 1 },
  conversation: { ...C::initial, generation: a.conversation.generation + 1,
    draftRevision: a.conversation.draftRevision + 1 }
}
pure def pausedLifecycle(device: S::Shell, closeAfterPause: bool, w: Workspace): Workspace =
  val stopped = interrupted(device, w.browser, w)
  if (closeAfterPause and A::isVisible(stopped.assistant))
    { ...stopped, assistant: A::close(stopped.assistant, C::ConversationUser) } else stopped
pure def changeLifecycle(w: Workspace, lifecycle: Lifecycle, by: WorkspaceActor): Workspace =
  val device = match lifecycle {
    | StartupSucceeded => S::finishStartup(w.device, true)
    | StartupFailed => S::finishStartup(w.device, false)
    | RetryStartup => S::retryStartup(w.device)
    | SleepDevice => S::sleep(w.device)
    | WakeDevice => S::wake(w.device)
    | RestartDevice => S::restart(w.device)
  }
  if (lifecycle == RestartDevice)
    { ...w, device: device, browser: { ...B::closeBrowser(w.browser), clearRequested: false },
      assistant: restartedAssistant(w.assistant), review: emptyReview(w.review.revision + 1), plan: emptyPlan,
      execution: if (X::canRetire(w.execution, X::BrowserBridge)) X::retire(w.execution, X::BrowserBridge) else w.execution,
      commitmentTask: "", preferences: R::restart(w.preferences, R::PreferenceStore),
      wake: W::cancel(w.wake, W::WakeHost),
      commitment: if (CM::canRestart(w.commitment, T::Store)) CM::restart(w.commitment, T::Store) else w.commitment,
      otherCommitments: w.otherCommitments.listMap(p => CM::restart(p, T::Store)) }
  else pausedLifecycle(device, lifecycle == SleepDevice, w)
pure def lawNonRestartKeepsSession(w: Workspace, lifecycle: Lifecycle, by: WorkspaceActor): bool =
  val after = changeLifecycle(w, lifecycle, by)
  (alwaysAssistantRules(w) and canChangeLifecycle(w, lifecycle, by) and lifecycle != RestartDevice) implies
    after.assistant.taskId == w.assistant.taskId and after.assistant.goal == w.assistant.goal and
    after.assistant.checkpoint == w.assistant.checkpoint and
    after.assistant.conversation.messages == w.assistant.conversation.messages and
    after.assistant.conversation.draft == w.assistant.conversation.draft and
    not(after.assistant.conversation.voice) and
    (lifecycle == SleepDevice implies after.assistant.presentation == A::Closed and
      (A::unfinished(w.assistant) implies after.assistant.activity == A::Paused))
pure def lawRestartClearsSession(w: Workspace, by: WorkspaceActor): bool =
  val after = changeLifecycle(w, RestartDevice, by)
  canChangeLifecycle(w, RestartDevice, by) implies
    after.device.readiness == S::Starting and after.device.surface == S::Home and
    after.assistant.activity == A::NoTask and after.assistant.taskId == "" and
    after.assistant.goal == "" and after.assistant.checkpoint == "" and after.assistant.operation == "" and
    after.assistant.replacementId == "" and after.assistant.replacementGoal == "" and
    after.assistant.outcome == A::Unfinished and after.assistant.evidence == "" and
    after.assistant.presentation == A::Closed and after.assistant.keyboard == A::NoKeyboard and
    after.assistant.guidance.target == "" and not(after.assistant.guidance.shown) and
    after.assistant.workVersion > w.assistant.workVersion and
    after.assistant.guidance.revision > w.assistant.guidance.revision and
    after.assistant.conversation.messages == List() and after.assistant.conversation.draft == "" and
    after.assistant.conversation.turn == C::Ready and not(after.assistant.conversation.voice) and
    after.assistant.conversation.generation > w.assistant.conversation.generation and
    after.assistant.conversation.draftRevision > w.assistant.conversation.draftRevision and
    after.execution.phase == X::Idle and after.commitmentTask == "" and after.wake.phase == W::Dormant and
    after.device.contextVersion > w.device.contextVersion and after.wake.generation > w.wake.generation and
    after.execution.generation >= w.execution.generation and
    (w.execution.phase != X::Idle implies after.execution.generation > w.execution.generation) and
    after.browser.tabs == List(B::blankTab(w.browser.nextId, w.browser.serial + 1)) and
    after.browser.revision > w.browser.revision and after.browser.recent == w.browser.recent and
    not(after.browser.editingAddress) and not(after.browser.clearRequested)
pure def sameDurableCommitmentRecord(priorCommitment: CM::Commitment, restoredCommitment: CM::Commitment): bool =
  priorCommitment.key == restoredCommitment.key and priorCommitment.attempt == restoredCommitment.attempt and
    priorCommitment.durable == restoredCommitment.durable
pure def lawRestartKeepsCommitmentRecords(w: Workspace, by: WorkspaceActor): bool =
  val after = changeLifecycle(w, RestartDevice, by)
  canChangeLifecycle(w, RestartDevice, by) implies
    sameDurableCommitmentRecord(w.commitment, after.commitment) and
    (w.commitment.stage != CM::Empty implies after.commitment.result == w.commitment.durable.result) and
    after.otherCommitments.length() == w.otherCommitments.length() and
    w.otherCommitments.every(prior => after.otherCommitments.some(restored => sameDurableCommitmentRecord(prior, restored))) and
    after.otherCommitments.every(p => p.result == p.durable.result and not(p.live) and not(p.fresh))
pure def canSetAvailability(w: Workspace, availability: Availability, by: WorkspaceActor): bool =
  by == Host and (availability.observation implies w.device.observationAllowed) and
  (availability.connection != w.device.connectivity or
    availability.reasoning != w.device.reasoningAvailable or
    availability.microphone != w.device.microphoneAllowed or
    availability.observation != w.device.observationAllowed)
pure def setAvailability(w: Workspace, availability: Availability, by: WorkspaceActor): Workspace =
  val connected = S::setConnectivity(w.device, availability.connection)
  val reasoning = S::setReasoningAvailability(connected, availability.reasoning)
  val microphone = S::setMicrophonePermission(reasoning, availability.microphone)
  interrupted(S::setObservationPermission(microphone, availability.observation), w.browser, w)
```

### The person can allow Grace to read her browser and revoke that choice

Browser reading starts off. The person may allow it from Grace's window on
the Browser surface. They can turn it off from Grace's window on any
surface. The choice applies to this Grace session. Restarting resets it.
Only a current device and browser revision can change it. A change
interrupts outstanding browser work and advances the device context.
The host cannot grant this permission. Native surface refusals still apply.

```quint
pure def canSetBrowserObservation(w: Workspace, choice: BrowserObservationChoice, by: WorkspaceActor): bool =
  by == Person and w.device.readiness == S::Ready and A::isVisible(w.assistant) and
  choice.deviceVersion == w.device.contextVersion and choice.browserRevision == w.browser.revision and
  choice.allowed != w.device.observationAllowed and (choice.allowed implies w.device.surface == S::Browser)
pure def setBrowserObservation(w: Workspace, choice: BrowserObservationChoice, by: WorkspaceActor): Workspace =
  interrupted(S::setObservationPermission(w.device, choice.allowed), w.browser, w)
pure def lawOnlyPersonCanAllowBrowserObservation(w: Workspace, availability: Availability, by: WorkspaceActor): bool =
  not(w.device.observationAllowed) and availability.observation implies not(canSetAvailability(w, availability, by))
pure val choiceValues = Set(
  { allowed: true, deviceVersion: 2, browserRevision: 0 },
  { allowed: true, deviceVersion: 6, browserRevision: 0 },
  { allowed: true, deviceVersion: 6, browserRevision: 1 },
  { allowed: true, deviceVersion: 7, browserRevision: 1 },
  { allowed: true, deviceVersion: 8, browserRevision: 1 },
  { allowed: false, deviceVersion: 7, browserRevision: 0 },
  { allowed: false, deviceVersion: 8, browserRevision: 1 })
```

### Home, native controls and Close have explicit interruption semantics

Home retains all browser tabs. Close browser resets the tabs and returns Home.
Close Grace hides its window and retains the website. All three preserve the
task, transcript and draft while pausing unfinished work and stopping speech.
Returning to an application or reopening Grace reveals that same paused task.
Leaving the surface or sleeping dismisses keyboard focus while retaining the
draft. Opening Grace ends an active address-editor focus; browser address entry
still works independently while Grace is closed.
Choosing Home or Settings moves expanded chat into the lower pane, including
when the selected surface is already open. Compact chat stays compact and
closed chat stays closed.

```quint
pure def makeRoomForRail(revealControls: bool, w: Workspace): Workspace =
  if (revealControls and w.assistant.presentation == A::Expanded)
    { ...w, assistant: A::resize(w.assistant, false, C::ConversationUser) } else w
pure def canVisit(w: Workspace, destination: S::Surface, by: WorkspaceActor): bool =
  by == Person and (S::canOpenSurface(w.device, destination) or S::canOpenNative(w.device, destination))
pure def visit(w: Workspace, destination: S::Surface, by: WorkspaceActor): Workspace =
  val device = if (S::isTaskSurface(destination)) S::openSurface(w.device, destination) else S::openNative(w.device, destination)
  makeRoomForRail(destination == S::Home or destination == S::DeviceSettings, interrupted(device, w.browser, w))
pure def canReturnToApplication(w: Workspace, by: WorkspaceActor): bool =
  by == Person and S::canReturnFromNative(w.device)
pure def returnToApplication(w: Workspace, by: WorkspaceActor): Workspace =
  interrupted(S::returnFromNative(w.device), w.browser, w)
pure def canCloseBrowser(w: Workspace, by: WorkspaceActor): bool =
  by == Person and w.device.readiness == S::Ready
pure def closeBrowser(w: Workspace, by: WorkspaceActor): Workspace =
  interrupted(S::openSurface(w.device, S::Home), B::closeBrowser(w.browser), w)
pure def canOpenGrace(w: Workspace, by: WorkspaceActor): bool =
  by == Person and w.device.readiness == S::Ready and not(privateSurfaceActive(w)) and A::canOpen(w.assistant, C::ConversationUser)
pure def openGrace(w: Workspace, by: WorkspaceActor): Workspace =
  afterInteraction(A::open(w.assistant, C::ConversationUser), w.browser.editingAddress, false, w)
pure def canCloseGrace(w: Workspace, by: WorkspaceActor): bool =
  by == Person and A::canClose(w.assistant, C::ConversationUser)
pure def closeGrace(w: Workspace, by: WorkspaceActor): Workspace = {
  ...w, assistant: A::close(w.assistant, C::ConversationUser), review: emptyReview(w.review.revision + 1), execution: quietExecution(w.execution),
  commitment: quietCommitment(w.commitment), wake: W::cancel(w.wake, W::WakeUser)
}
pure def canStop(w: Workspace, by: WorkspaceActor): bool = by == Person and A::unfinished(w.assistant)
pure def stop(w: Workspace, by: WorkspaceActor): Workspace = interrupted(w.device, w.browser, w)
pure def canAbandonTask(w: Workspace, by: WorkspaceActor): bool =
  by == Person and A::canAbandon(w.assistant, C::ConversationUser) and
  (hasNext(w.plan) or X::canRetire(w.execution, X::User))
pure def abandonTask(w: Workspace, by: WorkspaceActor): Workspace = {
  ...w, assistant: A::abandon(w.assistant, C::ConversationUser),
  execution: if (hasNext(w.plan)) w.execution else X::retire(w.execution, X::User), plan: emptyPlan, commitment: quietCommitment(w.commitment),
  wake: W::cancel(w.wake, W::WakeUser)
}
pure def canTalk(w: Workspace, by: WorkspaceActor): bool =
  by == Person and not(privateSurfaceActive(w)) and S::mayRequestReasoning(w.device) and w.device.microphoneAllowed and
  A::canTalk(w.assistant, C::ConversationUser)
pure def talk(w: Workspace, by: WorkspaceActor): Workspace =
  afterInteraction(A::talk(w.assistant, C::ConversationUser), w.assistant.keyboard != A::NoKeyboard or w.browser.editingAddress, false, w)
pure def canPurgePrivate(w: Workspace, token: int, messageIndex: int, purgeDraft: bool, by: WorkspaceActor): bool =
  by == Host and A::canPurgePrivate(w.assistant, token, messageIndex, purgeDraft, C::ConversationRuntime)
pure def purgePrivate(w: Workspace, token: int, messageIndex: int, purgeDraft: bool, by: WorkspaceActor): Workspace = {
  ...w, assistant: A::purgePrivate(w.assistant, token, messageIndex, purgeDraft, C::ConversationRuntime),
  execution: quietExecution(w.execution), commitment: quietCommitment(w.commitment), wake: W::cancel(w.wake, W::WakeHost)
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
  (by == Person or by == Host) and w.device.readiness == S::Ready and not(privateSurfaceActive(w)) and
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
    assistant: if (fencesTask) A::supersede(not(content), changed) else changed,
    execution: if (fencesTask and X::canInvalidate(w.execution, X::BrowserBridge))
      X::invalidate(w.execution, X::BrowserBridge) else w.execution,
    commitment: if (fencesTask and CM::canInvalidate(w.commitment, T::Host))
      CM::invalidate(w.commitment, T::Host) else w.commitment,
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
  ...w, assistant: A::newConversation(w.assistant, C::ConversationUser), review: emptyReview(w.review.revision + 1), plan: emptyPlan, commitmentTask: "",
  wake: W::cancel(w.wake, W::WakeUser)
}
pure def canRequestReplacement(w: Workspace, requestedTask: str, requestedGoal: str, by: WorkspaceActor): bool =
  by == Person and w.device.readiness == S::Ready and
  A::canRequestReplacement(w.assistant, requestedTask, requestedGoal, C::ConversationUser)
pure def requestReplacement(w: Workspace, requestedTask: str, requestedGoal: str, by: WorkspaceActor): Workspace = {
  ...w, assistant: A::requestReplacement(w.assistant, requestedTask, requestedGoal, C::ConversationUser),
  execution: quietExecution(w.execution), commitment: quietCommitment(w.commitment), wake: W::cancel(w.wake, W::WakeUser)
}
pure def canKeepTask(w: Workspace, by: WorkspaceActor): bool =
  by == Person and w.device.readiness == S::Ready and A::canChooseReplacement(w.assistant, C::ConversationUser)
pure def keepTask(w: Workspace, by: WorkspaceActor): Workspace = {
  ...w, assistant: A::chooseReplacement(w.assistant, false, C::ConversationUser), wake: W::cancel(w.wake, W::WakeUser)
}
pure def canReplaceTask(w: Workspace, taskRequest: TaskRequest, by: WorkspaceActor): bool =
  by == Person and mayAssist(w) and taskRequest.owner != "" and taskRequest.origin != "" and
  taskRequest.task == w.assistant.replacementId and taskRequest.goal == w.assistant.replacementGoal and
  A::canChooseReplacement(w.assistant, C::ConversationUser) and (hasNext(w.plan) or X::canRetire(w.execution, X::User))
pure def replaceTask(w: Workspace, taskRequest: TaskRequest, by: WorkspaceActor): Workspace = {
  ...w, assistant: A::chooseReplacement(w.assistant, true, C::ConversationUser),
  plan: emptyPlan, execution: X::start(if (hasNext(w.plan)) w.execution else X::retire(w.execution, X::User), taskRequest.owner, taskRequest.task, taskRequest.origin, X::User),
  browser: B::navigate(w.browser, taskRequest.origin), commitment: quietCommitment(w.commitment), commitmentTask: "",
  wake: W::cancel(w.wake, W::WakeUser)
}
pure def canContinueTask(w: Workspace, by: WorkspaceActor): bool =
  by == Person and mayAssist(w) and A::canContinueTask(w.assistant, C::ConversationUser) and
  X::canInvalidate(w.execution, X::BrowserBridge)
pure def continueTask(w: Workspace, by: WorkspaceActor): Workspace = {
  ...w, assistant: A::continueTask(w.assistant, C::ConversationUser),
  execution: X::invalidate(w.execution, X::BrowserBridge),
  commitment: if (CM::canInvalidate(w.commitment, T::Host)) CM::invalidate(w.commitment, T::Host) else w.commitment,
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
    (interact(w, input, by).execution == w.execution and interact(w, input, by).commitment == w.commitment and
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

Choosing Wi-Fi on the rail moves expanded chat into the lower pane, just as
Home and Settings do. The Wi-Fi popover still toggles on each tap.

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
  makeRoomForRail(popover == S::WifiPopover, interrupted(S::togglePopover(w.device, popover), w.browser, w))
pure def lawRailChoicesRevealTheirControls(w: Workspace): bool =
  val expected = if (w.assistant.presentation == A::Expanded) A::Compact else w.assistant.presentation
  w.device.readiness == S::Ready implies
    visit(w, S::Home, Person).assistant.presentation == expected and
    visit(w, S::DeviceSettings, Person).assistant.presentation == expected and
    togglePopover(w, S::WifiPopover, Person).assistant.presentation == expected
pure def canDismissPopover(w: Workspace, by: WorkspaceActor): bool = by == Person and S::canDismissPopover(w.device)
pure def dismissPopover(w: Workspace, by: WorkspaceActor): Workspace =
  interrupted(S::dismissPopover(w.device), w.browser, w)
pure def stepInterruptionsKeepTask(before: Workspace, via: str, after: Workspace): bool =
  (via == "setAvailability" or via == "visit" or
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

When the silence notice restores a closed Grace window, it also quiets any
retained payment. A proof witness showed that a live retained record could
otherwise remain active after the window paused an unfinished task.

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
  not(privateSurfaceActive(w)) and
  by == Host and W::canDetect(w.wake, detection, W::WakeHost) and
  w.preferences.session.wakeEnabled and w.device.microphoneAllowed and
  (w.device.readiness == S::Ready or w.device.readiness == S::Sleeping) and
  detection.prior == priorWindow(w.assistant) and
  detection.conversationVersion == listeningAfterWake(w).conversation.generation
pure def detectWake(w: Workspace, detection: W::WakeDetection, by: WorkspaceActor): WorkspaceResult = {
  state: { ...w, device: if (w.device.readiness == S::Sleeping) S::wake(w.device) else w.device,
    browser: if (w.browser.editingAddress or w.assistant.keyboard != A::NoKeyboard)
      B::pageChanged(B::dismissAddress(w.browser)) else w.browser,
    assistant: listeningAfterWake(w), execution: quietExecution(w.execution), commitment: quietCommitment(w.commitment),
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
    else A::resize(w.assistant, w.wake.prior == W::WasExpanded, C::ConversationUser),
  commitment: if (w.wake.prior == W::WasClosed) quietCommitment(w.commitment) else w.commitment
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
    after.commitment.result == before.commitment.result and not(after.commitment.fresh)
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
  plan: emptyPlan, assistant: A::beginTask(w.assistant, taskRequest.task, taskRequest.goal, C::ConversationUser),
  execution: X::start(w.execution, taskRequest.owner, taskRequest.task, taskRequest.origin, X::User),
  commitment: quietCommitment(w.commitment), commitmentTask: "", wake: W::cancel(w.wake, W::WakeUser)
}
pure def canChangePage(w: Workspace, browserInput: BC::BrowserInput, by: WorkspaceActor): bool =
  (by == Person or by == Host) and w.device.readiness == S::Ready and w.device.surface == S::Browser and
  BC::canControl(w.browser, browserInput, if (by == Person) BC::BrowserControlUser else BC::BrowserControlHost) and
  BC::requestMatchesTask(browserInput, w.execution.task, w.execution.origin)
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
it never becomes another submit. An unexpected change pauses instead. A payment progress callback must belong
to the attached task and an active execution. A proof witness showed that an
unrelated retained payment could otherwise create ordinary website work inside
an active guided plan.

```quint
pure def canReceiveProgress(w: Workspace, progress: ProgressReport, by: WorkspaceActor): bool =
  by == Host and mayAssist(w) and progress.owner == w.execution.owner and progress.task == w.assistant.taskId and
  progress.deviceVersion == w.device.contextVersion and progress.browserRevision == w.browser.revision and
  progress.taskVersion == w.assistant.workVersion and
  ((progress.kind == OrdinaryProgress and w.execution.phase == X::InFlight and
    progress.generation == w.execution.generation and progress.observation == w.execution.observation) or
   (progress.kind == CommitmentProgress and w.assistant.activity == A::WebsiteWait and
    w.commitmentTask != "" and w.commitmentTask == progress.task and X::canInvalidate(w.execution, X::BrowserBridge) and
    w.commitment.stage == CM::Checking and w.commitment.dispatched and
    progress.commitmentRevision == w.commitment.revision and progress.attempt == w.commitment.attempt))
pure def receiveProgress(w: Workspace, progress: ProgressReport, by: WorkspaceActor): Workspace = {
  ...w, browser: if (progress.destination == "") B::pageChanged(w.browser) else B::pageMoved(w.browser, progress.destination),
  execution: X::invalidate(w.execution, X::BrowserBridge),
  commitment: if (CM::canInvalidate(w.commitment, T::Host)) CM::invalidate(w.commitment, T::Host) else w.commitment,
  assistant: if (progress.kind == OrdinaryProgress)
    A::receiveStep(w.assistant, w.assistant.taskId, progress.taskVersion, w.assistant.operation,
      "Inspect the updated page", false, C::ConversationRuntime) else w.assistant
}
pure def canUnexpectedPage(w: Workspace, unexpected: UnexpectedNavigation, by: WorkspaceActor): bool =
  by == Host and w.device.readiness == S::Ready and w.device.surface == S::Browser and
  unexpected.id == w.browser.selected and unexpected.revision == w.browser.revision and
  B::canNavigate(w.browser, unexpected.destination)
pure def unexpectedPage(w: Workspace, unexpected: UnexpectedNavigation, by: WorkspaceActor): Workspace =
  interrupted(w.device, B::pageMoved(w.browser, unexpected.destination), w)
pure def lawLateNavigationCannotReplaceCurrentTab(w: Workspace, unexpected: UnexpectedNavigation, by: WorkspaceActor): bool =
  (unexpected.id != w.browser.selected or unexpected.revision != w.browser.revision)
  implies not(canUnexpectedPage(w, unexpected, by))
pure def canResume(w: Workspace, by: WorkspaceActor): bool =
  by == Person and A::canResume(w.assistant, C::ConversationUser) and
  (if (hasNext(w.plan)) w.device.readiness == S::Ready and w.assistant.replacementId == ""
   else mayAssist(w) and X::canResume(w.execution, X::User))
pure def resume(w: Workspace, by: WorkspaceActor): Workspace = {
  ...w, assistant: A::resume(w.assistant, C::ConversationUser),
  execution: if (hasNext(w.plan)) w.execution else X::resume(w.execution, X::User),
  commitment: if (not(hasNext(w.plan)) and CM::canResume(w.commitment, T::Person)) CM::resume(w.commitment, T::Person) else w.commitment,
  wake: W::cancel(w.wake, W::WakeUser)
}
```

### A page that moves by itself where the person is not looking only records where it went

A page in a tab that is not selected, or the selected one while the browser
is not the ready surface, keeps running and can move by itself. The host
reports it as for the page in view, and the browser records it on that tab.
Nothing is interrupted. Grace's website work needs the selected page in
view on the ready browser, so a task continues past a tab in the
background, whose move leaves the selected page and the revision as they
were; the selected page's own move, while hidden, changes the revision as
any page moving by itself does. The host names the load version of the
load the page was running when it moved, and a report is refused once that
tab has started another load; what happens in other tabs, or to the
browser's revision, never makes it late.

```quint
pure def canUnwatchedPage(w: Workspace, unexpected: UnexpectedNavigation, by: WorkspaceActor): bool =
  by == Host and unexpected.loadVersion == B::tabById(w.browser, unexpected.id).loadVersion and
  not(w.device.readiness == S::Ready and w.device.surface == S::Browser and unexpected.id == w.browser.selected) and
  B::canTabMoved(w.browser, unexpected.id, unexpected.destination)
pure def unwatchedPage(w: Workspace, unexpected: UnexpectedNavigation, by: WorkspaceActor): Workspace = {
  ...w, browser: B::tabMoved(w.browser, unexpected.id, unexpected.destination)
}
```

### Reconciliation binds the current page and device versions to the one task

A late observation is rejected even if its task name still matches. It must
match the current device context, current selected document revision, current
task generation and current controller generation. The trusted host checks
the actual origin, account and redaction before it supplies this evidence.

```quint
pure def observationArrives(w: Workspace, currentObservation: CurrentObservation, by: WorkspaceActor): bool =
  by == Host and mayAssist(w) and w.assistant.conversation.turn != C::Thinking and not(w.assistant.conversation.question) and
  currentObservation.deviceVersion == w.device.contextVersion and
  B::observationMatches(w.browser, w.browser.selected, currentObservation.browserRevision) and
  currentObservation.taskVersion == w.assistant.workVersion and currentObservation.checkpoint != "" and
  (w.assistant.activity == A::ReadyForStep or w.assistant.activity == A::Rechecking or
    (w.assistant.activity == A::WebsiteWait and w.commitment.stage == CM::Checking and w.commitment.dispatched))
pure def canObserve(w: Workspace, currentObservation: CurrentObservation, by: WorkspaceActor): bool =
  observationArrives(w, currentObservation, by) and X::canObserve(w.execution, currentObservation.website, X::BrowserBridge)
pure def observe(w: Workspace, currentObservation: CurrentObservation, by: WorkspaceActor): Workspace =
  val observedWorkspace = {
    ...w, execution: X::observe(w.execution, currentObservation.website, X::BrowserBridge),
    assistant: if (w.assistant.activity == A::Rechecking)
      A::reconcile(w.assistant, w.assistant.taskId, currentObservation.taskVersion, currentObservation.checkpoint, true, C::ConversationRuntime)
      else w.assistant,
    observedDevice: currentObservation.deviceVersion, observedBrowser: currentObservation.browserRevision
  }
  afterCommitmentEvidence(w.commitment, observedWorkspace)
pure def canPrepare(w: Workspace, operationRequest: OperationRequest, by: WorkspaceActor): bool =
  by == Host and mayAssist(w) and observationIsCurrent(w) and w.assistant.conversation.turn != C::Thinking and not(w.assistant.conversation.question) and
  operationRequest.deviceVersion == w.device.contextVersion and operationRequest.browserRevision == w.browser.revision and
  operationRequest.generation == w.execution.generation and operationRequest.taskVersion == w.assistant.workVersion and
  A::canStartStep(w.assistant, w.assistant.taskId, operationRequest.taskVersion, operationRequest.target, C::ConversationRuntime) and
  X::canPrepare(w.execution, operationRequest.target, operationRequest.valueRef, operationRequest.kind, operationRequest.observation, X::BrowserBridge)
pure def prepare(w: Workspace, operationRequest: OperationRequest, by: WorkspaceActor): Workspace = {
  ...w, assistant: A::startStep(w.assistant, w.assistant.taskId, operationRequest.taskVersion, operationRequest.target, C::ConversationRuntime),
  execution: X::prepare(w.execution, operationRequest.target, operationRequest.valueRef, operationRequest.kind, operationRequest.observation, X::BrowserBridge),
  commitment: if (CM::canInvalidate(w.commitment, T::Host)) CM::invalidate(w.commitment, T::Host) else w.commitment
}
```

### A page on another origin, or a step that is the person's, blocks the task where she can see it

An observation that arrives on every current version but reads a page on
another origin than the task's is not dropped: the task is blocked with that
reason and its checkpoint. When the step the task needs, at the current
observation, is one Grace may not take, because it is out of her reach or is
the person's to tap, the task is blocked for the person with that step named,
and an approved payment review on the old page is no longer current, also
when the step left to the person is a payment's own pay button. Either
way Grace's visible work waits for the person and fences older reports, so
she continues only after the person chooses Continue and a fresh observation
on the task's own origin arrives. Neither changes the conversation.

```quint
pure def canRefuseOrigin(w: Workspace, currentObservation: CurrentObservation, by: WorkspaceActor): bool =
  observationArrives(w, currentObservation, by) and X::canRefuseOrigin(w.execution, currentObservation.website, X::BrowserBridge)
pure def waitForPerson(a: A::Assistant, checkpoint: str): A::Assistant =
  { ...a, activity: A::UserWait, checkpoint: checkpoint, operation: "", workVersion: a.workVersion + 1 }
pure def refuseOrigin(w: Workspace, currentObservation: CurrentObservation, by: WorkspaceActor): Workspace = {
  ...w, execution: X::refuseOrigin(w.execution, currentObservation.website, X::BrowserBridge),
  assistant: waitForPerson(w.assistant, currentObservation.checkpoint),
  observedDevice: currentObservation.deviceVersion, observedBrowser: currentObservation.browserRevision
}
pure def canLeaveToPerson(w: Workspace, operationRequest: OperationRequest, by: WorkspaceActor): bool =
  by == Host and mayAssist(w) and observationIsCurrent(w) and w.assistant.conversation.turn != C::Thinking and not(w.assistant.conversation.question) and
  operationRequest.deviceVersion == w.device.contextVersion and operationRequest.browserRevision == w.browser.revision and
  operationRequest.generation == w.execution.generation and operationRequest.observation == w.execution.observation and
  operationRequest.taskVersion == w.assistant.workVersion and w.assistant.activity == A::ReadyForStep and
  X::canLeaveToPerson(w.execution, operationRequest.target, X::BrowserBridge)
pure def leaveToPerson(w: Workspace, operationRequest: OperationRequest, by: WorkspaceActor): Workspace = {
  ...w, execution: X::leaveToPerson(w.execution, operationRequest.target, X::BrowserBridge),
  assistant: waitForPerson(w.assistant, w.assistant.checkpoint),
  commitment: if (CM::canInvalidate(w.commitment, T::Host)) CM::invalidate(w.commitment, T::Host) else w.commitment
}
pure def sometimesOtherOriginBlocksTask(w: Workspace): bool =
  w.assistant.activity == A::UserWait and X::sometimesOtherOriginRefused(w.execution)
pure def sometimesStepLeftToPerson(w: Workspace): bool =
  w.assistant.activity == A::UserWait and X::sometimesOutOfReachStepIsThePersons(w.execution)
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
  } else { ...w, execution: quietExecution(execution), assistant: quietAssistant(w.assistant), commitment: quietCommitment(w.commitment) }
pure def sampleMatchesPreferences(preferenceEffect: R::PreferenceEffect, settings: R::DisplayPreferences): bool =
  match preferenceEffect { | PlaySample(data) => data.pace == settings.pace and
    data.volume == settings.volume and data.muted == settings.muted }
pure def stepEffectsRequireCurrentContext(before: Workspace, after: Workspace, out: List[WorkspaceEffect]): bool =
  out.every(effect => match effect {
    | Execute(command) => mayAssist(before) and observationIsCurrent(before) and
        before.execution.phase == X::Queued and after.execution.phase == X::InFlight
    | Commit(command) => currentCommitmentContext(before) and before.commitment.stage == CM::Authorized and
        after.commitment.stage == CM::Checking and after.commitment.dispatched
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

The person's goal is not complete because a step was verified.
The trusted domain integration separately reports that the requested goal
has been fulfilled, with nonempty endpoint evidence and the same owner,
task, goal, page, device and operation versions. The report counts only
when the current observation of the page carries the goal's own fact with
its quote; a report from the host with no quoted fact establishes nothing.
No step is required first: a goal that only reads the page finishes on the
observation that quotes it. That report retires the
ordinary controller and permits a later task without labelling this one
abandoned. An attached payment must use its durable payment-result path;
an ordinary completion report cannot bypass its unresolved ledger.

```quint
pure def canCompleteOrdinary(w: Workspace, completion: GoalCompletion, by: WorkspaceActor): bool =
  by == Host and mayAssist(w) and observationIsCurrent(w) and w.commitmentTask == "" and
  w.assistant.conversation.turn != C::Thinking and not(w.assistant.conversation.question) and
  X::goalObserved(w.execution, completion.goal) and w.assistant.activity == A::ReadyForStep and w.assistant.replacementId == "" and
  completion.owner == w.execution.owner and completion.task == w.assistant.taskId and completion.goal == w.assistant.goal and
  completion.deviceVersion == w.device.contextVersion and
  B::observationMatches(w.browser, w.browser.selected, completion.browserRevision) and
  completion.generation == w.execution.generation and completion.observation == w.execution.observation and
  A::canFinishTask(w.assistant, completion.task, completion.taskVersion, A::Completed, completion.evidence, C::ConversationRuntime)
pure def completeOrdinary(w: Workspace, completion: GoalCompletion, by: WorkspaceActor): Workspace = {
  ...w, execution: X::retire(w.execution, X::BrowserBridge),
  assistant: A::finishTask(w.assistant, completion.task, completion.taskVersion, A::Completed, completion.evidence, C::ConversationRuntime)
}
pure def lawCommitmentCannotUseOrdinaryCompletion(w: Workspace, completion: GoalCompletion, by: WorkspaceActor): bool =
  w.commitmentTask != "" implies not(canCompleteOrdinary(w, completion, by))
pure def sometimesOrdinaryGoalCompletes(w: Workspace): bool =
  w.plan.owner == "" and w.commitmentTask == "" and w.assistant.activity == A::Finished and w.assistant.outcome == A::Completed and w.execution.phase == X::Idle
```

## Story: Follow one reviewed plan across apps

> As a person asking Grace to read a message, check the details on a website and put the appointment in my calendar, I want to see what remains and keep my place when I change apps.

### The person starts a sequence of outcomes without opening a website

Each step names an app, a subject and an expected outcome. The reviewed operation selects the evidence check. Its wording may change without authorizing another operation. A named browser destination carries the reviewed name. A custom outcome on another surface appears in the plan and needs its own evidence adapter before the conversation can offer it. Its instruction can guide several interactions. A plan records references to observations in order. The next instruction follows the most recent confirmed outcome. The person chooses the plan and the host supplies the authenticated account. Starting or resuming a plan grants no authority to write to an app. A payment continues to use the payment ledger.

```quint
pure def canBeginGuided(w: Workspace, request: GuidedRequest, by: WorkspaceActor): bool =
  by == Person and w.device.readiness == S::Ready and w.execution.phase == X::Idle and
  A::canBeginTask(w.assistant, request.task, request.goal, C::ConversationUser) and
  request.owner != "" and request.steps.length() > 0 and
  request.steps.every(s => guidedDetails(s).subject != "" and guidedDetails(s).outcome != "")
pure def beginGuided(w: Workspace, request: GuidedRequest, by: WorkspaceActor): Workspace =
  val assistant = A::beginTask(w.assistant, request.task, request.goal, C::ConversationUser)
  val plan: GuidedPlan = { ...emptyPlan, owner: request.owner, steps: request.steps,
    openingBrowser: w.browser.revision, originalAsk: request.goal }
  { ...w, plan: plan, review: emptyReview(w.review.revision + 1), assistant: { ...assistant, checkpoint: guidedDetails(nextOutcome(plan)).outcome },
    commitmentTask: "", commitment: quietCommitment(w.commitment), wake: W::cancel(w.wake, W::WakeUser) }
```

### A read plan offered in chat waits for the person to start it

The conversation host validates the current human request before it offers
a nonempty ordered sequence of outcomes for the items the person opens. The reviewed plan retains every proposed step, including sequences longer than four. Each completed check keeps its local source identity and readable evidence. Different items may have the same displayed text. Reopening one unchanged item cannot satisfy a second check for another item. The workspace
checks its current conversation and work versions and takes the goal
directly from the current person’s words, including any restrictions.
The host records the account and linked source that the offer uses. The person must still be under that same authority when accepting the review, resuming it or confirming a read. Reconnecting the same linked account can renew access without changing the owner. Reading the selected items does not establish other requested outcomes. Only a person accepting the displayed revision may start
this plan. Opening the app does not approve an external change. The
browser’s opening revision identifies a document loaded later in the plan.
With permission and an active compact Browser step, the person can ask
Grace to highlight a link on the loaded page. The host binds the
highlighted destination to this step and its current page context. A
highlight does not record a read or navigate the page. Visiting a
different destination does not finish the pointed step. Links to the same destination share one candidate. Visible link names and section relationships can help distinguish a topic index from its articles. Grace asks its Cloud decision service under the signed-in Grace account. The service receives the reviewed goal and bounded visible labels with temporary candidate identifiers. A signed-out session cannot ask for a choice. A choice can guide only while that account, task and document are current. A temporary decision-service failure permits one fresh observation and retry while the same person and step are current.

When the person permits observation and a secure site is loaded, the chat planner can see that the current tab already has a website open and the public hostname. The browser keeps the full address and document contents local when reporting that context.

When the person names a browser destination, the reviewed step shows the
name quoted from the current request. Checking a page opened along the way
does not finish that step. The person can ask for another highlight from
the new page with the same step active.

For a requested statement read, the host reads the current visible document locally. The document must identify itself as the current or latest bill, statement or invoice. The amount due and due date each need a single distinct labeled value on the same statement. A date labeled Payment due or Due by is still a due date when the value is on its own or separated from another field by a visible delimiter. A previous balance, minimum payment or statement issue date supplies a different fact. The host rereads the document identity, revision and values before confirming the step. An ambiguous or incomplete statement leaves the step open.

```quint
pure def hasOneStatementAnswer(amounts: Set[str], dates: Set[str]): bool =
  amounts.size() == 1 and dates.size() == 1 and not(amounts.contains("")) and not(dates.contains(""))
pure def isNamedDestination(guidedStep: GuidedStep): bool = match guidedStep {
  | ReachNamedPage(_) => true
  | _ => false
}
pure def hasGuidedAdapter(guidedStep: GuidedStep): bool = match guidedStep {
  | SurfaceOutcome(_) => false
  | _ => true
}
pure def isLinkGuidanceStep(guidedStep: GuidedStep): bool = match guidedStep {
  | ReadBrowser => true
  | ReadChangedBrowser => true
  | ReadStatement => true
  | ReachNamedPage(_) => true
  | _ => false
}
pure def mayGuideReadLink(w: Workspace): bool =
  hasNext(w.plan) and isLinkGuidanceStep(nextOutcome(w.plan)) and
  w.device.readiness == S::Ready and w.device.surface == S::Browser and mayAssist(w) and
  w.assistant.presentation == A::Compact and B::activeTab(w.browser).load == B::Loaded and
  (w.assistant.activity == A::ReadyForStep or w.assistant.activity == A::Rechecking) and
  w.assistant.replacementId == "" and w.assistant.conversation.turn == C::Ready and not(w.assistant.conversation.question) and
  w.execution.phase == X::Idle and w.commitmentTask == ""
pure def canSetGuidedLink(w: Workspace, link: GuidedLink, by: WorkspaceActor): bool =
  by == Host and mayGuideReadLink(w) and link.url != "" and link.task == w.assistant.taskId and
  link.version == w.assistant.workVersion and link.generation == w.assistant.conversation.generation and
  link.deviceVersion == w.device.contextVersion and link.browserRevision == w.browser.revision and
  link.stepIndex == w.plan.receipts.length()
pure def setGuidedLink(w: Workspace, link: GuidedLink, by: WorkspaceActor): Workspace =
  { ...w, plan: { ...w.plan, linkStep: link.stepIndex, linkUrl: link.url } }
pure def guidedLinkObserved(w: Workspace): bool =
  (w.plan.linkStep == w.plan.receipts.length() and w.plan.linkUrl != "") implies
    (w.device.surface == S::Browser and B::activeTab(w.browser).load == B::Loaded and
      B::tabUrl(B::activeTab(w.browser)) == w.plan.linkUrl)
pure def reviewedRequest(w: Workspace, offer: ReviewOffer): GuidedRequest = {
  val ask = w.assistant.conversation.messages.foldl("", (latest, message) =>
    if (message.author == C::HumanMessage) message.text else latest)
  { owner: offer.owner, task: offer.task, goal: ask, steps: offer.steps }
}
pure def canOfferReadReview(w: Workspace, offer: ReviewOffer, by: WorkspaceActor): bool =
  by == Host and w.commitmentTask == "" and
  offer.generation == w.assistant.conversation.generation and offer.workVersion == w.assistant.workVersion and
  offer.steps.length() > 0 and offer.steps.every(offeredOutcome => hasGuidedAdapter(offeredOutcome)) and
  canBeginGuided(w, reviewedRequest(w, offer), Person)
pure def offerReadReview(w: Workspace, offer: ReviewOffer, by: WorkspaceActor): Workspace = {
  ...w, review: { revision: w.review.revision + 1, generation: offer.generation,
    workVersion: offer.workVersion, request: reviewedRequest(w, offer) }
}
pure def scopedReadRequest(review: GuidedReview): GuidedRequest =
  { ...review.request, goal: "Check the items I open" }
pure def canStartReadReview(w: Workspace, reviewRevision: int, by: WorkspaceActor): bool =
  by == Person and reviewRevision == w.review.revision and w.commitmentTask == "" and
  w.review.generation == w.assistant.conversation.generation and w.review.workVersion == w.assistant.workVersion and
  w.assistant.conversation.turn == C::Ready and not(w.assistant.conversation.question) and
  w.review.request.goal != "" and canBeginGuided(w, scopedReadRequest(w.review), Person)
pure def startReadReview(w: Workspace, reviewRevision: int, by: WorkspaceActor): Workspace =
  val started = beginGuided(w, scopedReadRequest(w.review), by)
  { ...started, plan: { ...started.plan, originalAsk: w.review.request.goal } }
pure def lawAnOldReadReviewCannotStart(w: Workspace, reviewRevision: int, by: WorkspaceActor): bool =
  reviewRevision != w.review.revision implies not(canStartReadReview(w, reviewRevision, by))
pure val offerValues = Set(
  { owner: "tablet", task: "read", generation: 1, workVersion: 0, steps: List(ReadMail) },
  { owner: "tablet", task: "read", generation: 2, workVersion: 0, steps: List(ReadChangedBrowser) },
  { owner: "tablet", task: "read", generation: 2, workVersion: 0, steps: List(ReachNamedPage({ subject: "Support" })) })
pure val linkValues = Set({ task: "read", version: 1, generation: 2, deviceVersion: 2, browserRevision: 1,
  stepIndex: 0, url: "https://biller.example/help" })
pure val reviewRevisionValues = Set(0, 1, 2, 3, 4)
```

### Only a current observation of the next outcome advances the plan

The app adapter checks the actual outcome on the named subject under the authenticated account. It supplies an opaque receipt and the context captured with that observation. The host accepts it once, on the visible app, for the same task and revision. Every Browser check requires the current session’s reading permission on an ordinary tab, including checking a page the person opened manually. Passwords and private sign-in never provide a plan receipt. An app switch pauses guidance. If a replacement decision is pending, the person must keep the old plan before resuming it. After an explicit Resume, a fresh observation may reconcile an outcome the person achieved manually. The final observed outcome completes the task. An attached payment cannot use a plan receipt to complete, and a paused plan cannot accept one. A missing result leaves the instruction in place. A named browser step only accepts a dedicated observation of the exact approved name in the active page loaded during this plan. The host reads the first level-one heading in the main content through the native visible-text reader, excluding navigation and sidebars. It compares the heading with the reviewed name after normalizing Unicode and spacing. It verifies the visible heading again before accepting the result. The two heading readings must agree. Current main-document observations on either side of each reading must identify the same loaded document and URL and show no covering blocker. Changes elsewhere in that document can occur while the heading is being checked. A navigation label, a browser-tab title or a generic document receipt cannot finish the named step.

```quint
pure def isAppointmentSave(guidedStep: GuidedStep): bool = match guidedStep {
  | SaveMailAppointment => true
  | _ => false
}
pure def guidedObservationCurrent(w: Workspace, report: GuidedObservation, by: WorkspaceActor): bool =
  by == Host and not(privateSurfaceActive(w)) and hasNext(w.plan) and w.execution.phase == X::Idle and w.commitmentTask == "" and
  A::isVisible(w.assistant) and w.device.readiness == S::Ready and
  (w.assistant.activity == A::ReadyForStep or w.assistant.activity == A::Rechecking) and
  w.assistant.replacementId == "" and w.assistant.conversation.turn != C::Thinking and not(w.assistant.conversation.question) and
  report.owner == w.plan.owner and report.task == w.assistant.taskId and report.version == w.assistant.workVersion and
  report.deviceVersion == w.device.contextVersion and report.browserRevision == w.browser.revision and
  report.step == nextOutcome(w.plan) and guidedDetails(report.step).surface == w.device.surface and
  (guidedDetails(report.step).surface == S::Browser implies w.device.observationAllowed) and guidedLinkObserved(w) and
  report.sourceKey != "" and report.evidence != "" and not(w.plan.receipts.some(receipt => receipt.sourceKey == report.sourceKey)) and
  (isAppointmentSave(report.step) implies
    (w.plan.savedOccurrence != "" and report.evidence == w.plan.savedEvidence))
pure def canConfirmGuided(w: Workspace, report: GuidedObservation, by: WorkspaceActor): bool =
  not(isNamedDestination(report.step)) and guidedObservationCurrent(w, report, by)
pure def confirmGuided(w: Workspace, report: GuidedObservation, by: WorkspaceActor): Workspace =
  val plan = { ...w.plan, receipts: w.plan.receipts.append({ sourceKey: report.sourceKey, evidence: report.evidence }) }
  val assistant = w.assistant
  { ...w, plan: plan, assistant:
    if (hasNext(plan)) { ...assistant, activity: A::ReadyForStep, checkpoint: guidedDetails(nextOutcome(plan)).outcome,
      workVersion: assistant.workVersion + 1 }
    else A::finishTask(assistant, report.task, report.version, A::Completed, report.evidence, C::ConversationRuntime) }
pure def canConfirmGuidedNamedPage(w: Workspace, pageCheck: GuidedNamedPageCheck, by: WorkspaceActor): bool =
  val tab = B::activeTab(w.browser)
  guidedObservationCurrent(w, pageCheck.report, by) and
  isNamedDestination(pageCheck.report.step) and pageCheck.documentId != "" and
  tab.load == B::Loaded and pageCheck.url != "" and pageCheck.url == B::tabUrl(tab) and
  pageCheck.loadVersion == tab.loadVersion and pageCheck.loadVersion > w.plan.openingBrowser and
  pageCheck.heading == guidedDetails(pageCheck.report.step).subject
pure def confirmGuidedNamedPage(w: Workspace, pageCheck: GuidedNamedPageCheck, by: WorkspaceActor): Workspace =
  confirmGuided(w, pageCheck.report, by)
pure def lawNamedPageNeedsItsOwnObservation(w: Workspace, report: GuidedObservation, by: WorkspaceActor): bool =
  isNamedDestination(report.step) implies not(canConfirmGuided(w, report, by))
pure def lawWrongNamedHeadingCannotFinish(w: Workspace, pageCheck: GuidedNamedPageCheck, by: WorkspaceActor): bool =
  pageCheck.heading != guidedDetails(pageCheck.report.step).subject implies not(canConfirmGuidedNamedPage(w, pageCheck, by))
pure def lawOtherOwnersCannotAdvanceAPlan(w: Workspace, report: GuidedObservation, by: WorkspaceActor): bool =
  report.owner != w.plan.owner implies not(canConfirmGuided(w, report, by))
pure def lawOldCallbacksCannotAdvanceAPlan(w: Workspace, report: GuidedObservation, by: WorkspaceActor): bool =
  report.version != w.assistant.workVersion implies not(canConfirmGuided(w, report, by))
pure def lawPausedPlanCannotAdvance(w: Workspace, report: GuidedObservation, by: WorkspaceActor): bool =
  w.assistant.activity == A::Paused implies not(canConfirmGuided(w, report, by))
pure def lawCommitmentCannotUsePlanReceipt(w: Workspace, report: GuidedObservation, by: WorkspaceActor): bool =
  w.commitmentTask != "" implies not(canConfirmGuided(w, report, by))
pure val sampleStep: GuidedStep = SurfaceOutcome({ surface: S::Home, subject: "appointment", outcome: "Read the appointment" })
pure val requestValues = Set({ owner: "owner", task: "task", goal: "Read my appointment", steps: List(sampleStep) })
pure val sampleReport: GuidedObservation = {
  owner: "owner", task: "task", version: 1, deviceVersion: 1, browserRevision: 0,
  step: sampleStep, sourceKey: "appointment-id", evidence: "appointment-receipt"
}
pure val namedReport = { ...sampleReport, step: ReachNamedPage({ subject: "Support" }), sourceKey: "help-page", evidence: "Support" }
pure val samplePageCheck: GuidedNamedPageCheck = {
  report: namedReport, documentId: "help-document", loadVersion: 2, url: "https://example.org/help", heading: "Support"
}
pure val reportValues = Set(sampleReport, { ...sampleReport, deviceVersion: 2 }, namedReport)
pure val pageCheckValues = Set(samplePageCheck, { ...samplePageCheck, heading: "Home" })
pure def sometimesGuidedGoalIsObserved(w: Workspace): bool =
  w.plan.owner != "" and w.plan.receipts.length() > 0 and w.assistant.outcome == A::Completed
```

### A calendar save must come from the selected email and a separately approved write

Checking a selected open email records its current account, identity and
version. A later calendar step may recognize a save from that same email
and account. Starting the plan cannot write. The calendar's separate
approved proposal is still what authorizes saving the exact appointment.
The provider must return the saved occurrence and a fresh read must find
those exact approved details under the same account. The host may retain
the adopted occurrence during a surface switch. Checking the matching
saved occurrence can retry the read and advance the resumed plan. A calendar feed item,
wrong source, or unsaved appointment cannot count as a save.

```quint
pure def canConfirmGuidedMail(w: Workspace, mailCheck: GuidedMailCheck, by: WorkspaceActor): bool =
  val reportedStep = mailCheck.report.step
  val opensMail = match reportedStep {
    | ReadMail => true
    | _ => false
  }
  opensMail and canConfirmGuided(w, mailCheck.report, by) and
  mailCheck.mail.account > 0 and mailCheck.mail.owner != "" and mailCheck.mail.address != "" and mailCheck.mail.ref != "" and
  mailCheck.mail.generation >= 0 and mailCheck.mail.revision >= 0
pure def confirmGuidedMail(w: Workspace, mailCheck: GuidedMailCheck, by: WorkspaceActor): Workspace =
  val after = confirmGuided(w, mailCheck.report, by)
  { ...after, plan: { ...after.plan, mail: mailCheck.mail } }
pure def guidedSavePending(w: Workspace): bool =
  hasNext(w.plan) and isAppointmentSave(nextOutcome(w.plan)) and
  w.execution.phase == X::Idle and w.commitmentTask == ""
pure def canExpectGuidedCalendar(w: Workspace, approval: GuidedCalendarApproval, by: WorkspaceActor): bool =
  by == Host and guidedSavePending(w) and w.plan.savedOccurrence == "" and
  approval.task == w.assistant.taskId and approval.account == w.plan.mail.account and approval.account > 0 and
  approval.owner == w.plan.mail.address and approval.sourceRef == w.plan.mail.ref and approval.sourceRef != "" and
  approval.calendar != "" and approval.provisional != "" and approval.proposal > w.plan.calendarApproval.proposal and
  approval.title != "" and approval.ends > approval.starts and approval.timezone != ""
pure def expectGuidedCalendar(w: Workspace, approval: GuidedCalendarApproval, by: WorkspaceActor): Workspace =
  { ...w, plan: { ...w.plan, calendarApproval: approval } }
pure def canObserveGuidedCalendar(w: Workspace, saved: GuidedCalendarReadback, by: WorkspaceActor): bool =
  by == Host and guidedSavePending(w) and
  saved.approval == w.plan.calendarApproval and saved.approval.proposal >= 0 and
  saved.approval.task == w.assistant.taskId and saved.occurrence != "" and
  ((w.plan.savedOccurrence == "" and saved.evidence == "") or
    (w.plan.savedOccurrence == saved.occurrence and w.plan.savedEvidence == "" and saved.evidence != ""))
pure def observeGuidedCalendar(w: Workspace, saved: GuidedCalendarReadback, by: WorkspaceActor): Workspace =
  { ...w, plan: { ...w.plan, savedOccurrence: saved.occurrence, savedEvidence: saved.evidence } }
pure def lawOtherMailCannotBindAGuidedCalendar(w: Workspace, approval: GuidedCalendarApproval, by: WorkspaceActor): bool =
  (approval.sourceRef != w.plan.mail.ref or approval.account != w.plan.mail.account) implies
    not(canExpectGuidedCalendar(w, approval, by))
pure def lawMissingSaveCannotConfirmCalendar(w: Workspace, report: GuidedObservation, by: WorkspaceActor): bool =
  (isAppointmentSave(report.step) and (w.plan.savedOccurrence == "" or w.plan.savedEvidence == "")) implies not(canConfirmGuided(w, report, by))
pure val mailCheckValues = Set({ report: sampleReport, mail: { ...noGuidedMail, account: 1, owner: "tablet", address: "mail", ref: "invite", version: "test" } })
pure val approvalValues = Set({ ...noGuidedApproval, task: "task", account: 1, owner: "mail", calendar: "primary",
  sourceRef: "invite", provisional: "draft", proposal: 1, title: "Visit", starts: 1, ends: 2, timezone: "UTC" })
pure val savedValues = Set({ approval: { ...noGuidedApproval, task: "task", account: 1, owner: "mail", calendar: "primary",
  sourceRef: "invite", provisional: "draft", proposal: 1, title: "Visit", starts: 1, ends: 2, timezone: "UTC" },
  occurrence: "saved", evidence: "Saved Visit" })
```

## Story: Preserve payment authorization and uncertainty across surfaces

> As a person paying a bill, I want Home, Close, Sleep and manual navigation
> to revoke permission to submit while retaining what may already have happened.

### The active bill is bound to the observed owner and origin once

Selecting a different bill retains the old aggregate in the inactive registry
and selects its existing record or creates a previously unseen identity.
Reopening the same bill retrieves its existing durable attempt. Browser tasks
on any provider remain available while previous uncertain attempts are retained.
Discovered by a guarded trace: a true account-match flag and verified origin
alone let two accounts at the same provider pass the same observation. The
opaque account in the bill key must match the verified account in current
browser evidence before attaching the bill or advancing its payment flow.
Leaving that account revokes readiness while the durable record remains.
`commitmentTask` is a link to the assistant-owned task, not another task state.
An explicit bill selection attaches the existing record to a new task; an
old payment result cannot silently finish an unrelated later conversation.
The future storage adapter validates and decodes that record before creating
its owning machine; event input cannot assign an arbitrary payment state.

```quint
pure def canBindCommitment(w: Workspace, key: T::Subject, by: WorkspaceActor): bool =
  by == Person and mayAssist(w) and observationIsCurrent(w) and w.execution.phase == X::Observed and
  w.execution.originVerified and w.execution.redactionReady and not(w.execution.privateInput) and
  key.owner == w.execution.owner and key.origin == w.execution.origin and key.account == w.execution.matchedAccount and
  w.commitmentTask == "" and T::validKey(key)
pure def lawMismatchedAccountCannotBindCommitment(w: Workspace, key: T::Subject, by: WorkspaceActor): bool =
  key.account != w.execution.matchedAccount implies not(canBindCommitment(w, key, by))
pure def lawMismatchedAccountCannotAdvanceCommitment(w: Workspace): bool =
  (w.execution.matchedAccount == "" or w.execution.matchedAccount != w.commitment.key.account) implies
    not(currentCommitmentContext(w))
pure def bindCommitment(w: Workspace, key: T::Subject, by: WorkspaceActor): Workspace =
  val existing = if (w.commitment.stage != CM::Empty and w.commitment.key == key) w.commitment
    else storedCommitment(key, w.otherCommitments)
  val others = w.otherCommitments.select(p => p.key != key)
  {
    ...w, commitmentTask: w.assistant.taskId,
    commitment: if (existing.stage == CM::Empty) CM::bind(CM::initial, key, T::Person)
      else if (CM::canResume(existing, T::Person)) CM::resume(existing, T::Person) else existing,
    otherCommitments: if (w.commitment.stage != CM::Empty and w.commitment.key != key)
      others.append(quietCommitment(w.commitment)) else others
  }
pure def canReviewCommitment(w: Workspace, currentReview: CurrentReview, by: WorkspaceActor): bool =
  by == Host and currentCommitmentContext(w) and currentReview.deviceVersion == w.device.contextVersion and
  currentReview.browserRevision == w.browser.revision and currentReview.taskVersion == w.assistant.workVersion and
  CM::canReview(w.commitment, currentReview.review, T::Host)
pure def reviewCommitment(w: Workspace, currentReview: CurrentReview, by: WorkspaceActor): Workspace = {
  ...w, commitment: CM::review(w.commitment, currentReview.review, T::Host)
}
pure def commitmentTokensMatch(w: Workspace, commitmentTokens: CommitmentTokens): bool =
  currentCommitmentContext(w) and commitmentTokens.deviceVersion == w.device.contextVersion and
  commitmentTokens.browserRevision == w.browser.revision and commitmentTokens.taskVersion == w.assistant.workVersion and
  commitmentTokens.revision == w.commitment.revision and commitmentTokens.attempt == w.commitment.attempt
```

### Review readback and durable journaling precede explicit approval

The host acknowledges finished readback of the exact review. Only the durable
store can acknowledge the unresolved window or report a write failure. A
failed write leaves a visible retryable save error and never enables submit.
Approval must be the person's completed, unambiguous response with no
correction; it is not inferred from speech fragments or website content.

```quint
pure def canReadBackCommitment(w: Workspace, commitmentTokens: CommitmentTokens, by: WorkspaceActor): bool =
  by == Host and commitmentTokensMatch(w, commitmentTokens) and
  CM::canRecordReadBack(w.commitment, commitmentTokens.revision, T::Host)
pure def readBackCommitment(w: Workspace, commitmentTokens: CommitmentTokens, by: WorkspaceActor): Workspace = {
  ...w, commitment: CM::recordReadBack(w.commitment, commitmentTokens.revision, T::Host)
}
pure def canJournalCommitment(w: Workspace, commitmentTokens: CommitmentTokens, succeeded: bool, by: WorkspaceActor): bool =
  by == Store and commitmentTokensMatch(w, commitmentTokens) and
  CM::canPersistWindow(w.commitment, commitmentTokens.revision, T::Store)
pure def journalCommitment(w: Workspace, commitmentTokens: CommitmentTokens, succeeded: bool, by: WorkspaceActor): Workspace = {
  ...w, commitment: if (succeeded) CM::persistWindow(w.commitment, commitmentTokens.revision, T::Store)
    else CM::windowSaveFailed(w.commitment, commitmentTokens.revision, T::Store)
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

pure def canApproveSpokenCommitment(w: Workspace, commitmentTokens: CommitmentTokens, spoken: SpokenApproval, by: WorkspaceActor): bool =
  by == Person and spoken.complete and spoken.approves and not(spoken.correction) and
  w.assistant.activity == A::ReadyForStep and w.assistant.replacementId == "" and
  commitmentTokensMatch(w, commitmentTokens) and
  A::canHear(w.assistant, spoken.token, spoken.text, spoken.owner, C::ConversationRuntime) and
  CM::canAuthorize(w.commitment, commitmentTokens.revision, spoken.correction, T::Person)
pure def approveSpokenCommitment(w: Workspace, commitmentTokens: CommitmentTokens, spoken: SpokenApproval, by: WorkspaceActor): Workspace = {
  ...w, assistant: { ...w.assistant,
    conversation: C::hear(w.assistant.conversation, spoken.token, spoken.text, spoken.owner, C::ConversationRuntime) },
  commitment: CM::authorize(w.commitment, commitmentTokens.revision, spoken.correction, T::Person),
  wake: W::cancel(w.wake, W::WakeUser)
}
pure def lawClassifiedApprovalPreservesTheReviewedStep(w: Workspace, commitmentTokens: CommitmentTokens, spoken: SpokenApproval, by: WorkspaceActor): bool =
  val approved = approveSpokenCommitment(w, commitmentTokens, spoken, by)
  canApproveSpokenCommitment(w, commitmentTokens, spoken, by) and w.assistant.presentation == A::Compact implies
    canSubmitCommitment(approved, commitmentTokens, Actuator) and
    not(canApproveSpokenCommitment(approved, commitmentTokens, spoken, by))
pure def lawCorrectedSpeechCannotApprove(w: Workspace, commitmentTokens: CommitmentTokens, spoken: SpokenApproval, by: WorkspaceActor): bool =
  (not(spoken.complete) or not(spoken.approves) or spoken.correction)
  implies not(canApproveSpokenCommitment(w, commitmentTokens, spoken, by))
pure def lawLateSpeechCannotApprove(w: Workspace, commitmentTokens: CommitmentTokens, spoken: SpokenApproval, by: WorkspaceActor): bool =
  spoken.token != w.assistant.conversation.generation implies not(canApproveSpokenCommitment(w, commitmentTokens, spoken, by))
pure def sometimesSpokenApprovalIsRecorded(w: Workspace): bool =
  w.commitment.stage == CM::Authorized and w.assistant.conversation.turn == C::Thinking
```

### Final submission checks the current workspace and consumes one payment authorization

The actual actuator rechecks the emitted context envelope immediately before
its external effect. Every departure calls the payment's Stop transition,
revoking freshness and approval. An interrupted journaled window stays
Unknown; Resume cannot authorize or submit it again. It must be investigated.
A directly observed website tap is recorded without an additional effect.

```quint
pure def canSubmitCommitment(w: Workspace, commitmentTokens: CommitmentTokens, by: WorkspaceActor): bool =
  by == Actuator and commitmentTokensMatch(w, commitmentTokens) and
  A::canStartStep(w.assistant, w.assistant.taskId, commitmentTokens.taskVersion, "commitment", C::ConversationRuntime) and
  CM::canSubmit(w.commitment, commitmentTokens.revision, commitmentTokens.attempt, T::Actuator)
pure def submitCommitment(w: Workspace, commitmentTokens: CommitmentTokens, by: WorkspaceActor): WorkspaceResult =
  val submitted = CM::submit(w.commitment, commitmentTokens.revision, commitmentTokens.attempt, T::Actuator)
  val working = A::startStep(w.assistant, w.assistant.taskId, commitmentTokens.taskVersion, "commitment", C::ConversationRuntime)
  { state: { ...w, commitment: submitted.state,
      assistant: A::waitForWebsite(working, working.taskId, working.workVersion, C::ConversationRuntime) },
    out: submitted.out.listMap(effect => Commit({ deviceVersion: w.device.contextVersion,
      browserRevision: w.browser.revision, taskVersion: w.assistant.workVersion, effect: effect })) }
pure def canObserveCommitmentTap(w: Workspace, commitmentTokens: CommitmentTokens, by: WorkspaceActor): bool =
  by == Host and commitmentTokensMatch(w, commitmentTokens) and
  A::canStartStep(w.assistant, w.assistant.taskId, commitmentTokens.taskVersion, "commitment", C::ConversationRuntime) and
  CM::canObserveManualSubmit(w.commitment, commitmentTokens.attempt, T::Host)
pure def observeCommitmentTap(w: Workspace, commitmentTokens: CommitmentTokens, by: WorkspaceActor): Workspace =
  val working = A::startStep(w.assistant, w.assistant.taskId, commitmentTokens.taskVersion, "commitment", C::ConversationRuntime)
  { ...w, commitment: CM::observeManualSubmit(w.commitment, commitmentTokens.attempt, T::Host),
    assistant: A::waitForWebsite(working, working.taskId, working.workVersion, C::ConversationRuntime) }
pure def lawOneApprovalIssuesExactlyOneSubmission(w: Workspace, commitmentTokens: CommitmentTokens): bool =
  val submitted = submitCommitment(w, commitmentTokens, Actuator)
  canSubmitCommitment(w, commitmentTokens, Actuator) implies
    submitted.out.length() == 1 and not(canSubmitCommitment(submitted.state, commitmentTokens, Actuator))
pure def lawStopRevokesCommitmentSubmission(w: Workspace, commitmentTokens: CommitmentTokens): bool =
  canStop(w, Person) implies not(canSubmitCommitment(stop(w, Person), commitmentTokens, Actuator))
pure def lawHiddenCommitmentCannotSubmit(w: Workspace, commitmentTokens: CommitmentTokens, by: WorkspaceActor): bool =
  (w.device.surface != S::Browser or not(A::isVisible(w.assistant)) or w.device.readiness != S::Ready)
  implies not(canSubmitCommitment(w, commitmentTokens, by))
pure def lawStaleCommitmentContextCannotSubmit(w: Workspace, commitmentTokens: CommitmentTokens, by: WorkspaceActor): bool =
  (commitmentTokens.deviceVersion != w.device.contextVersion or commitmentTokens.browserRevision != w.browser.revision)
  implies not(canSubmitCommitment(w, commitmentTokens, by))
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
pure def terminalCommitment(result: CM::Outcome): bool =
  CM::positiveOutcome(result) or result == CM::VerifiedFailure or result == CM::Returned
pure def afterCommitmentEvidence(commitment: CM::Commitment, w: Workspace): Workspace =
  if (terminalCommitment(commitment.result) and not(CM::outcomeNeedsSave(commitment)) and
      w.commitmentTask == w.assistant.taskId and A::unfinished(w.assistant) and w.assistant.activity != A::Paused) {
    ...w, commitment: quietCommitment(commitment), execution: X::retire(w.execution, X::BrowserBridge),
    assistant: A::finishTask(w.assistant, w.assistant.taskId, w.assistant.workVersion,
      if (CM::positiveOutcome(commitment.result)) A::Completed else A::VerifiedFailure,
      commitment.evidence, C::ConversationRuntime)
  } else if (commitment.result == CM::NotSubmitted and w.assistant.activity == A::WebsiteWait) {
    ...w, commitment: commitment,
    assistant: A::receiveStep(w.assistant, w.assistant.taskId, w.assistant.workVersion,
      w.assistant.operation, "No submission was established; review before continuing", false, C::ConversationRuntime)
  } else { ...w, commitment: commitment }
pure def canRecordCommitment(w: Workspace, currentOutcome: CurrentOutcome, by: WorkspaceActor): bool =
  by == Host and currentCommitmentContext(w) and currentOutcome.deviceVersion == w.device.contextVersion and
  currentOutcome.browserRevision == w.browser.revision and currentOutcome.taskVersion == w.assistant.workVersion and
  CM::canRecordOutcome(w.commitment, currentOutcome.report, T::Host)
pure def recordCommitment(w: Workspace, currentOutcome: CurrentOutcome, by: WorkspaceActor): Workspace =
  afterCommitmentEvidence(CM::recordOutcome(w.commitment, currentOutcome.report, T::Host), w)
pure def canReconcilePriorCommitment(w: Workspace, currentPrior: CurrentPrior, by: WorkspaceActor): bool =
  by == Store and currentCommitmentContext(w) and currentPrior.deviceVersion == w.device.contextVersion and
  currentPrior.browserRevision == w.browser.revision and currentPrior.taskVersion == w.assistant.workVersion and
  CM::canReconcilePrior(w.commitment, currentPrior.report, T::Store)
pure def reconcilePriorCommitment(w: Workspace, currentPrior: CurrentPrior, by: WorkspaceActor): Workspace =
  afterCommitmentEvidence(CM::reconcilePrior(w.commitment, currentPrior.report, T::Store), w)
pure def canSaveCommitment(w: Workspace, saveReport: SaveReport, by: WorkspaceActor): bool =
  by == Store and T::validKey(saveReport.key) and
  CM::canSaveOutcome(commitmentByKey(w, saveReport.key), saveReport.revision, T::Store)
pure def saveCommitment(w: Workspace, saveReport: SaveReport, by: WorkspaceActor): Workspace =
  if (w.commitment.stage != CM::Empty and saveReport.key == w.commitment.key)
    afterCommitmentEvidence(CM::saveOutcome(w.commitment, saveReport.revision, saveReport.succeeded, T::Store), w)
  else { ...w, otherCommitments: w.otherCommitments.listMap(p => if (p.key == saveReport.key)
    CM::saveOutcome(p, saveReport.revision, saveReport.succeeded, T::Store) else p) }
pure def canRetryCommitment(w: Workspace, by: WorkspaceActor): bool =
  by == Person and currentCommitmentContext(w) and CM::canRetry(w.commitment, T::Person)
pure def retryCommitment(w: Workspace, by: WorkspaceActor): Workspace = {
  ...w, commitment: CM::retry(w.commitment, T::Person)
}
pure def stepCommitmentSwitchRetainsRecords(before: Workspace, via: str, after: Workspace): bool =
  via == "bindCommitment" implies commitmentRecords(before).every(prior =>
    commitmentRecords(after).some(record => record.key == prior.key and
      record.attempt == prior.attempt and record.durable == prior.durable and record.result == prior.result))
pure def stepDepartureKeepsCommitmentAttempt(before: Workspace, via: str, after: Workspace): bool =
  (via == "changePage" implies after.commitment.attempt == before.commitment.attempt and
    after.commitment.durable == before.commitment.durable) and
  ((via == "changeLifecycle" or via == "setAvailability" or via == "visit" or
    via == "returnToApplication" or via == "closeBrowser" or via == "closeGrace" or via == "stop" or
    (via == "changePage" and before.browser.revision != after.browser.revision) or
    via == "unexpectedPage" or via == "purgePrivate" or via == "abandonTask" or
    via == "chooseHomePage" or via == "chooseSettingsPage" or via == "togglePopover" or via == "dismissPopover")
  implies after.commitment.attempt == before.commitment.attempt and after.commitment.durable == before.commitment.durable and
    not(after.commitment.fresh) and (after.commitment.stage == CM::Empty or not(after.commitment.live)))
pure def sometimesCommitmentAuthorized(w: Workspace): bool = w.commitment.stage == CM::Authorized
pure def sometimesCommitmentDispatched(w: Workspace): bool = w.commitment.stage == CM::Checking and w.commitment.dispatched
pure def sometimesInterruptedCommitmentIsUncertain(w: Workspace): bool =
  w.assistant.activity == A::Paused and w.commitment.result == CM::Unknown and not(w.commitment.live)
pure def sometimesCommitmentResultFinishesTask(w: Workspace): bool =
  w.assistant.activity == A::Finished and CM::positiveOutcome(w.commitment.result) and w.execution.phase == X::Idle
```

The samples exercise the first operation and a stale context alongside a
different website. They are only simulation inputs; generated APIs accept
arbitrary request identifiers, nonempty destinations and integer generations.
Walks include an ordinary task and payments at two different origins. Preparing
an ordinary step has the weight of the other website callbacks: ordinary
completion needs browser observation permission, a compact chat and a fresh
observation that quotes its goal, and the steps toward that goal come from
preparation, which a rarer preparation almost never reaches within a sampled walk. Navigation
uses its default weight, giving current callbacks a chance to arrive before
a later visit advances the context. Walks also go offline, lose the
microphone, sleep, wake, restart, fail to start and retry, and open every
application. The laws are checked on the states the walks reach.

```quint
pure val availabilityValues = Set(
  { connection: S::Online, reasoning: true, microphone: true, observation: true },
  { connection: S::Offline, reasoning: true, microphone: true, observation: true },
  { connection: S::Online, reasoning: true, microphone: false, observation: true })
pure val aValues = Set(A::initial,
  A::pause(A::beginTask(A::open(A::initial, C::ConversationUser),
    "task", "Read the account", C::ConversationUser), C::ConversationUser))
pure val changedValues = aValues
pure val preferencesValues = Set(R::initial)
pure val preferenceEffectValues = Set(R::PlaySample({ pace: R::Normal, volume: 60, muted: false }))
pure val xValues = Set(X::initial,
  X::pause(X::start(X::initial, "owner", "task", "https://utility.example", X::User), X::User))
pure val pValues = Set(CM::initial, CM::bind(CM::initial, CM::exampleKey, T::Person))
pure val commitmentValues = pValues
pure val priorCommitmentValues = pValues
pure val restoredCommitmentValues = pValues
pure val recordsValues = Set(List(), List(CM::bind(CM::initial, CM::exampleKey, T::Person)))
pure val deviceValues = Set(S::initial, S::finishStartup(S::initial, true))
pure val browserValues = Set(B::initial, B::navigate(B::initial, "https://utility.example"))
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
  { id: 1, revision: 2, loadVersion: 1, destination: "https://utility.example/updated" },
  { id: 2, revision: 2, loadVersion: 0, destination: "https://credit.example" },
  { id: 1, revision: 0, loadVersion: 0, destination: "https://utility.example/updated" })
pure val loadReportValues = Set(
  { id: 1, version: 1, result: B::Loaded }, { id: 1, version: 1, result: B::LoadFailed },
  { id: 1, version: 2, result: B::Loaded }, { id: 1, version: 3, result: B::Loaded })
pure val observed: CurrentObservation = {
  deviceVersion: 7, browserRevision: 3, taskVersion: 1, website: X::goodObservation, checkpoint: "Read the current account"
}
pure val currentObservationValues = Set(observed,
  { ...observed, website: { ...X::goodObservation, task: "other", origin: "https://credit.example" } },
  { ...observed, browserRevision: 4, website: { ...X::goodObservation, generation: 2 } },
  { ...observed, browserRevision: 4, taskVersion: 2, website: { ...X::goodObservation, generation: 2 } },
  { ...observed, browserRevision: 5, taskVersion: 3,
    website: { ...X::goodObservation, generation: 3, task: "other", origin: "https://credit.example" } },
  { ...observed, taskVersion: 3, checkpoint: "Back on the account page", website: { ...X::goodObservation, generation: 3 } },
  { ...observed, website: { ...X::goodObservation, origin: "https://credit.example" } },
  { ...observed, taskVersion: 2, checkpoint: "Account read",
    website: { ...X::goodObservation, facts: List({ name: "Read the account", valueRef: "account-value", quoteRef: "account-quote" }) } },
  { ...observed, browserRevision: 5, taskVersion: 3, website: { ...X::goodObservation, generation: 3 } },
  { ...observed, browserRevision: 5, taskVersion: 4, website: { ...X::goodObservation, generation: 3 } })
pure val operation: OperationRequest = {
  deviceVersion: 7, browserRevision: 3, taskVersion: 1,
  generation: 1, observation: 1, target: "control", valueRef: "", kind: X::ReadPage
}
pure val operationRequestValues = Set(operation, { ...operation, deviceVersion: 0 }, { ...operation, kind: X::FinalSubmit },
  { ...operation, target: "booking-frame", kind: X::Choose })
pure val tokensValues = Set(
  { deviceVersion: 7, browserRevision: 3, taskVersion: 1, generation: 1, observation: 1 },
  { deviceVersion: 0, browserRevision: 3, taskVersion: 1, generation: 1, observation: 1 })
pure val currentVerificationValues = Set({ deviceVersion: 7, browserRevision: 3, taskVersion: 1,
  website: X::goodVerification, checkpoint: "Current account read", needsUser: false },
  { deviceVersion: 7, browserRevision: 3, taskVersion: 1,
    website: { ...X::goodVerification, task: "other" }, checkpoint: "Current account read", needsUser: false },
  { deviceVersion: 7, browserRevision: 3, taskVersion: 1,
    website: X::goodVerification, checkpoint: "Please check the account details", needsUser: true },
  { deviceVersion: 7, browserRevision: 3, taskVersion: 1,
    website: { ...X::goodVerification, task: "other" }, checkpoint: "Please check the account details", needsUser: true })
pure val completedGoal: GoalCompletion = {
  owner: "owner", task: "task", goal: "Read the account", evidence: "goal-endpoint",
  deviceVersion: 7, browserRevision: 3, taskVersion: 2, generation: 1, observation: 2
}
pure val completionValues = Set(completedGoal,
  { ...completedGoal, task: "other", goal: "Read another account" },
  { ...completedGoal, evidence: "" },
  { ...completedGoal, taskVersion: 1 }, { ...completedGoal, goal: "Another goal" })
pure val commitmentTokensValues = Set(
  { deviceVersion: 7, browserRevision: 3, taskVersion: 1, revision: 1, attempt: 0 },
  { deviceVersion: 7, browserRevision: 3, taskVersion: 1, revision: 1, attempt: 1 },
  { deviceVersion: 7, browserRevision: 3, taskVersion: 2, revision: 1, attempt: 1 },
  { deviceVersion: 0, browserRevision: 3, taskVersion: 1, revision: 1, attempt: 1 })
pure val currentReviewValues = Set(
  { deviceVersion: 7, browserRevision: 3, taskVersion: 1, review: CM::exampleReview },
  { deviceVersion: 7, browserRevision: 3, taskVersion: 1,
    review: { ...CM::exampleReview, key: { ...CM::exampleKey, origin: "https://credit.example" } } })
pure val currentOutcomeValues = Set({ deviceVersion: 7, browserRevision: 3, taskVersion: 1, report: CM::exampleOutcome },
  { deviceVersion: 7, browserRevision: 3, taskVersion: 2, report: CM::exampleOutcome },
  { deviceVersion: 7, browserRevision: 4, taskVersion: 1, report: { ...CM::exampleOutcome, revision: 3 } },
  { deviceVersion: 7, browserRevision: 3, taskVersion: 1, report: { ...CM::exampleOutcome, result: CM::Pending, reference: "" } },
  { deviceVersion: 7, browserRevision: 3, taskVersion: 2, report: { ...CM::exampleOutcome, result: CM::VerifiedFailure, reference: "" } },
  { deviceVersion: 7, browserRevision: 3, taskVersion: 2, report: { ...CM::exampleOutcome, result: CM::Returned, reference: "" } },
  { deviceVersion: 7, browserRevision: 3, taskVersion: 2,
    report: { ...CM::exampleOutcome, key: { ...CM::exampleKey, origin: "https://credit.example" } } })
pure val currentPriorValues = Set(
  { deviceVersion: 7, browserRevision: 3, taskVersion: 1, report: CM::examplePrior },
  { deviceVersion: 7, browserRevision: 3, taskVersion: 1, report: { ...CM::examplePrior, result: CM::VerifiedFailure, reference: "" } },
  { deviceVersion: 7, browserRevision: 3, taskVersion: 1, report: { ...CM::examplePrior, result: CM::Returned, reference: "" } })
pure val saveReportValues = Set(
  { key: CM::exampleKey, revision: 3, succeeded: true },
  { key: CM::exampleKey, revision: 4, succeeded: true },
  { key: CM::exampleKey, revision: 3, succeeded: false },
  { key: { ...CM::exampleKey, origin: "https://credit.example" }, revision: 3, succeeded: true })
pure val progressValues = Set(
  { owner: "owner", task: "other", deviceVersion: 7, browserRevision: 3, taskVersion: 1,
    generation: 1, observation: 1, commitmentRevision: 2, attempt: 1, kind: OrdinaryProgress, destination: "" },
  { owner: "owner", task: "task", deviceVersion: 7, browserRevision: 3, taskVersion: 1,
    generation: 1, observation: 1, commitmentRevision: 2, attempt: 1, kind: OrdinaryProgress, destination: "" },
  { owner: "owner", task: "task", deviceVersion: 7, browserRevision: 3, taskVersion: 1,
    generation: 1, observation: 1, commitmentRevision: 2, attempt: 1, kind: CommitmentProgress, destination: "" })
pure val weight_changeLifecycle = 4
pure val weight_setAvailability = 4
pure val weight_openGrace = 12
pure val weight_publishGuidance = 12
pure val weight_begin = 24
pure val weight_receiveLoad = 24
pure val weight_observe = 24
pure val weight_prepare = 24
pure val weight_dispatch = 24
pure val weight_verify = 24
pure val weight_bindCommitment = 24
pure val weight_reviewCommitment = 24
pure val weight_readBackCommitment = 4
pure val weight_journalCommitment = 24
pure val weight_approveSpokenCommitment = 24
pure val weight_submitCommitment = 24
pure val weight_recordCommitment = 24
pure val weight_completeOrdinary = 24
pure val weight_refuseOrigin = 8
pure val weight_leaveToPerson = 8
pure val weight_saveCommitment = 24
pure val weight_interact = 8
pure val weight_detectWake = 8
pure val weight_wakeNoSpeech = 8
pure val weight_wakeReturn = 8
pure val tokenValues = Set(-1, 2)
pure val destinationValues = Set(S::Browser, S::Home, S::DeviceSettings, S::Calendar, S::Email, S::Files)
pure val lifecycleValues = Set(StartupSucceeded, StartupFailed, RetryStartup, SleepDevice, WakeDevice, RestartDevice)
```

## Story: Open an available control from Grace's reply

> As a person, I can choose a control Grace offers for my current request.
> I see the available action before it runs, and I review drafts and
> appointment changes before anything is sent or saved.

### A reply offers controls for its current turn and visible context

An offer identifies its exact turn, device surface, browser revision and
preference revision. A newer turn, closed Grace window, or changed context
retires the offer. Navigation, browser controls, preference previews and
owned reads use the same rules as their visible controls. Opening a draft or
appointment review never authorizes delivery, saving, removal, or a website
submission. An action without a current supported path is not shown as
completed. A prepared offer becomes visible only once its exact response is
the latest turn in the written transcript.

```quint
type ReplyControlContext = { generation: int, device: int, browser: int, preferences: int }
pure val replyValues = Set(
  { generation: 0, device: 0, browser: 0, preferences: 0 },
  { generation: 1, device: 0, browser: 0, preferences: 0 },
  { generation: 1, device: 1, browser: 1, preferences: 1 })

pure def replyControlContext(w: Workspace): ReplyControlContext =
  { generation: w.assistant.conversation.generation, device: w.device.contextVersion,
    browser: w.browser.revision, preferences: w.preferences.revision }
pure def replyControlsCurrent(w: Workspace, reply: ReplyControlContext): bool =
  w.device.readiness == S::Ready and w.assistant.presentation != A::Closed and
  w.assistant.conversation.turn != C::Thinking and
  reply.generation == w.assistant.conversation.generation and reply.device == w.device.contextVersion and
  reply.browser == w.browser.revision and reply.preferences == w.preferences.revision
pure def lawReplyControlStaleTurn(w: Workspace, reply: ReplyControlContext): bool =
  reply.generation != w.assistant.conversation.generation implies not(replyControlsCurrent(w, reply))
```

# Evidence-grounded website assistance

This is the generic browser operation contract, reused on every provider. It replaces hardcoded pages, selectors and script playback with a semantic operation on a current, verified target. It preserves the useful guarantees of legacy `TaskFence`, `TaskActuatorDispatch`, `TaskBindingFence`, `TaskOwnerFence`, `GuideStopFence` and `ControlOracle`. Neither a button label nor website text proves that a control is harmless.

Browser observation, target classification, redaction, account matching and enforcement at the actual dispatch boundary are trusted integration responsibilities. A model proves what happens when those responsibilities supply correct events; it cannot prove arbitrary-site interpretation. An unsupported or ambiguous site has a visible manual continuation or honest block, never a fabricated result.

## Story: Get help on the website I chose

> As a person using an unfamiliar website, I want Grace to understand its current controls and guide or perform authorized ordinary work without assuming every site looks like the demo.

### Every operation belongs to the selected owner, task and origin

The caller identity comes from the authenticated shell, separately from event JSON. Values and targets are opaque non-secret references; actual private input is excluded from this state. The bridge supplies a stable semantic context reference for the page facts relevant to an operation. Reobserving unchanged facts does not create a new context, target or value reference merely because an observation counter changed.

```quint
type ExecutionActor = User | BrowserBridge | Planner | Dispatcher
type OperationPhase = Idle | NeedObservation | Observed | Queued | InFlight | Verified | Blocked | Paused
type OperationKind = ReadPage | Navigate | FillOrdinary | FillSignInIdentifier | PrivateEntry | FinalSubmit | ConsentChoice | UnknownControl
type Consequence = Routine | AskFirst | PersonOnly | Commit
type Tapper = ByPerson | ByGrace
type PageFact = { name: str, valueRef: str, quoteRef: str }
type PageTarget = { id: str, consequence: Consequence, inReach: bool }
type ObservationReport = {
  owner: str, task: str, origin: str, generation: int, contextRef: str, originVerified: bool, matchedAccount: str, privateInput: bool, redactionReady: bool,
  facts: List[PageFact], targets: List[PageTarget]
}
type VerificationReport = { owner: str, task: str, generation: int, observation: int, matches: bool, reason: str }
type Approach = { contextRef: str, target: str, valueRef: str, kind: OperationKind }
type Execution = {
  owner: str, task: str, origin: str, phase: OperationPhase, generation: int,
  observation: int, contextRef: str, target: str, valueRef: str, kind: OperationKind,
  failedApproach: Approach, failures: int,
  originVerified: bool, matchedAccount: str, privateInput: bool, redactionReady: bool, reason: str,
  facts: List[PageFact], targets: List[PageTarget]
}
type WebsiteEffect = Operate({ owner: str, task: str, origin: str, generation: int, observation: int, target: str, valueRef: str, kind: OperationKind })
type ExecutionResult = { state: Execution, out: List[WebsiteEffect] }
pure val noApproach: Approach = { contextRef: "", target: "", valueRef: "", kind: UnknownControl }
pure val initial: Execution = {
  owner: "", task: "", origin: "", phase: Idle, generation: 0, observation: 0,
  contextRef: "", target: "", valueRef: "", kind: UnknownControl, failedApproach: noApproach, failures: 0,
  originVerified: false, matchedAccount: "", privateInput: false, redactionReady: false, reason: "",
  facts: List(), targets: List()
}
pure val ownerValues = Set("owner", "")
pure val taskValues = Set("task", "")
pure val originValues = Set("https://utility.example", "https://credit.example", "")
pure val targetValues = Set("control", "name-field", "password", "booking-frame", "other", "")
pure val valueRefValues = Set("value", "")
pure val reasonValues = Set("unsupported", "changed", "")
pure val expectedGenerationValues = Set(0, 1, 2, 3)
pure val expectedObservationValues = Set(0, 1, 2, 3)
pure val goodObservation: ObservationReport = {
  owner: "owner", task: "task", origin: "https://utility.example", generation: 1, contextRef: "page-facts", originVerified: true, matchedAccount: "account", privateInput: false, redactionReady: true,
  facts: List({ name: "balance", valueRef: "balance-value", quoteRef: "balance-quote" }),
  targets: List({ id: "control", consequence: Routine, inReach: true }, { id: "name-field", consequence: AskFirst, inReach: true },
    { id: "password", consequence: PersonOnly, inReach: true }, { id: "booking-frame", consequence: Routine, inReach: false })
}
pure val observationReportValues = Set(
  { ...goodObservation, facts: List({ name: "confirmed", valueRef: "confirmation-value", quoteRef: "confirmation-quote" }) },
  { ...goodObservation, facts: List({ name: "confirmed", valueRef: "confirmation-value", quoteRef: "" }) },
  goodObservation, { ...goodObservation, generation: 2 }, { ...goodObservation, generation: 3 },
  { ...goodObservation, generation: 4 }, { ...goodObservation, generation: 5 }, { ...goodObservation, generation: 6 },
  { ...goodObservation, origin: "https://credit.example" }, { ...goodObservation, owner: "other" },
  { ...goodObservation, originVerified: false }, { ...goodObservation, redactionReady: false },
  { ...goodObservation, privateInput: true }, { ...goodObservation, matchedAccount: "" },
  { ...goodObservation, contextRef: "changed-page-facts" }, { ...goodObservation, contextRef: "" }
)
pure val goodVerification: VerificationReport = { owner: "owner", task: "task", generation: 1, observation: 1, matches: true, reason: "" }
pure val verificationReportValues = Set(
  goodVerification, { ...goodVerification, generation: 2 }, { ...goodVerification, generation: 3 },
  { ...goodVerification, observation: 2 }, { ...goodVerification, generation: 2, observation: 2 },
  { ...goodVerification, matches: false, reason: "changed" }, { ...goodVerification, owner: "other" },
  { ...goodVerification, task: "other" }, { ...goodVerification, matches: false },
  { ...goodVerification, observation: 2, matches: false, reason: "field rejected" },
  { ...goodVerification, observation: 3 },
  { ...goodVerification, generation: 3, observation: 2, matches: false, reason: "field rejected" }
)
pure val weight_start = 10
pure val weight_observe = 10
pure val weight_prepare = 10
pure val weight_dispatch = 10
pure val weight_verify = 10
pure val weight_leaveToPerson = 10
pure val weight_refuseOrigin = 5
```

### Starting work requires an explicit owner and task with a verified destination

Selecting a search result is not verification. The host must establish the intended origin before personal information is used. Starting does not grant permission for consent choices, secrets or payment; it only requests observation. Existing work must finish or be explicitly discarded before another task starts; starting the same task again cannot clear its failed-approach limit.

```quint
pure def canStart(x: Execution, owner: str, task: str, origin: str, by: ExecutionActor): bool =
  x.phase == Idle and owner != "" and task != "" and origin != "" and by == User
pure def start(x: Execution, owner: str, task: str, origin: str, by: ExecutionActor): Execution = {
  ...initial, owner: owner, task: task, origin: origin, phase: NeedObservation, generation: x.generation + 1, observation: x.observation
}
pure def alwaysIdentity(x: Execution): bool = x.phase == Idle or (x.owner != "" and x.task != "" and x.origin != "")
pure def alwaysGenerations(x: Execution): bool = x.generation >= 0 and x.observation >= 0
```

### Observation is fresh, origin-bound and privacy-filtered

The bridge emits this only after validating the active tab, document, frame, viewport and task. Any change to them or the authenticated account invalidates this observation before dispatch. A nonempty matched account is the opaque identity of the verified account for this task. The bridge leaves it empty while sign-in is unavailable or the account cannot be matched. Public sign-in guidance remains available; filling personal information requires the matched account. When reliable redaction is unavailable, capture stops. Private fields are handled by the user and never included as values here.

The observation carries what the page shows, in the prototype's shape: facts, each with a reference to the quoted page text that supports it, and named targets, each with its consequence class and whether it is in Grace's reach. A fact without its quote is not a fact, so an observation holding one is refused. Facts, quotes and labels are data read from the page, never a request to Grace: nothing on a page can start, approve or widen a step.

```quint
pure def quoted(observationReport: ObservationReport): bool = observationReport.facts.every(f => f.quoteRef != "")
pure def canObserve(x: Execution, observationReport: ObservationReport, by: ExecutionActor): bool =
  (x.phase == NeedObservation or x.phase == Verified or x.phase == Blocked) and
  observationReport.owner == x.owner and observationReport.task == x.task and observationReport.origin == x.origin and
  observationReport.generation == x.generation and observationReport.contextRef != "" and
  observationReport.originVerified and observationReport.redactionReady and quoted(observationReport) and by == BrowserBridge
pure def observe(x: Execution, observationReport: ObservationReport, by: ExecutionActor): Execution = {
  ...x, phase: Observed, observation: x.observation + 1, contextRef: observationReport.contextRef, originVerified: observationReport.originVerified,
  matchedAccount: observationReport.matchedAccount, privateInput: observationReport.privateInput,
  redactionReady: observationReport.redactionReady, target: "", valueRef: "", kind: UnknownControl, reason: "",
  facts: observationReport.facts, targets: observationReport.targets
}
pure def alwaysFactsAreQuoted(x: Execution): bool = x.facts.every(f => f.quoteRef != "")
```

### A task's origin comes from its verified source or the person, and a page on any other origin is refused

The origin a task starts with is the one its verified source names, or an address the person typed or confirmed. A verified origin means the page is on exactly that origin; no reputation list or look-alike score establishes or widens it. When the page the bridge reads for the current generation is on any other origin, the step is refused visibly: the task is blocked with that reason until a fresh observation on its own origin.

```quint
pure val otherOrigin = "other origin"
pure def canRefuseOrigin(x: Execution, observationReport: ObservationReport, by: ExecutionActor): bool =
  (x.phase == NeedObservation or x.phase == Verified or x.phase == Blocked) and
  observationReport.owner == x.owner and observationReport.task == x.task and
  observationReport.generation == x.generation and observationReport.origin != x.origin and by == BrowserBridge
pure def refuseOrigin(x: Execution, observationReport: ObservationReport, by: ExecutionActor): Execution =
  { ...x, phase: Blocked, reason: otherOrigin, generation: x.generation + 1 }
pure def sometimesOtherOriginRefused(x: Execution): bool = x.phase == Blocked and x.reason == otherOrigin
```

### The goal is fulfilled only when the current page shows its fact with a quote

Each task kind declares the fact that marks its endpoint. The endpoint is established only when the current observation, taken after the last operation, carries that fact, and every fact carries its quote. A report from the host with no quoted fact establishes nothing.

```quint
pure def goalObserved(x: Execution, goal: str): bool =
  x.phase == Observed and goal != "" and x.facts.some(f => f.name == goal)
pure def sometimesGoalObserved(x: Execution): bool = goalObserved(x, "confirmed")
```

### Observed, queued and in-flight work always has a verified, redaction-ready page context

Only `observe` enters these phases, and its guard requires a stable context
reference, a verified origin and reliable redaction. Preparing and dispatching
keep that context.

```quint
pure def alwaysObservedContextExists(x: Execution): bool =
  (x.phase == Observed or x.phase == Queued or x.phase == InFlight) implies
    x.contextRef != "" and x.originVerified and x.redactionReady
```

### Each step has a consequence class, and Grace takes only the steps that are hers

The bridge classifies every target it names, from the control itself and never from what the page says about it. A routine step (read, move on, an ordinary button or option) Grace may take. An ask-first step (filling in a detail) she takes only with the person's yes, which is the value reference: a value the person gave or a saved detail she approved for this site. A person-only step (a password, sign-in, a site's consent or permission) and a commit (money, booking, sending, deleting, changing) are tapped by the person; a commit Grace takes only through the [commitment](./payment.md) route. A target out of Grace's reach is tapped by the person whatever its class. A step Grace may not take is only pointed at.

```quint
pure val noTarget: PageTarget = { id: "", consequence: PersonOnly, inReach: false }
pure def targetNamed(x: Execution, target: str): PageTarget = x.targets.select(t => t.id == target).nthOr(0, noTarget)
pure def tapper(pageTarget: PageTarget): Tapper =
  if (pageTarget.inReach and (pageTarget.consequence == Routine or pageTarget.consequence == AskFirst)) ByGrace else ByPerson
pure def graceMayTake(x: Execution, target: str, valueRef: str): bool = {
  val pageTarget = targetNamed(x, target)
  pageTarget.id == target and tapper(pageTarget) == ByGrace and (pageTarget.consequence == AskFirst implies valueRef != "")
}
pure def alwaysQueuedStepIsGraces(x: Execution): bool =
  (x.phase == Queued or x.phase == InFlight) implies graceMayTake(x, x.target, x.valueRef)
```

### Grace reads the page's main frame, and a step out of her reach is the person's

Grace reads the main frame of the page. A control inside a frame from another site, a canvas or an image-only button is out of her reach, and the bridge names it as a target that is not in reach. When the step the task needs is out of her reach or is the person's to tap, the task stays with the person: Grace says so in one sentence, points at it where she can, and continues only on a fresh observation after the person acts. She never taps a guess.

```quint
pure val forThePerson = "for the person"
pure def canLeaveToPerson(x: Execution, target: str, by: ExecutionActor): bool =
  x.phase == Observed and target != "" and targetNamed(x, target).id == target and
  tapper(targetNamed(x, target)) == ByPerson and by == BrowserBridge
pure def leaveToPerson(x: Execution, target: str, by: ExecutionActor): Execution =
  { ...x, phase: Blocked, reason: forThePerson, target: target, valueRef: "", kind: UnknownControl, generation: x.generation + 1 }
pure def sometimesOutOfReachStepIsThePersons(x: Execution): bool =
  x.phase == Blocked and x.reason == forThePerson and x.target != "" and not(targetNamed(x, x.target).inReach)
```

### Only classified ordinary operations use the generic dispatch path

Read and navigation may proceed as routine steps of the requested task. The step's target must be one the current observation names and Grace may take. Ordinary personal-data fills require the authenticated matched account and the chosen value. A non-secret sign-in identifier may instead be filled on the verified origin before authentication; its value reference must be supplied by the person or approved origin-scoped memory. The trusted bridge validates the planner's semantic target and effect classification before accepting preparation. Unknown effects, credentials, final submission, cookie consent and permission dialogs cannot use this route. The person handles site consent and private entry; [payment](./payment.md) owns final-payment authorization. No site name appears in the policy.

```quint
pure def ordinary(kind: OperationKind): bool = kind == ReadPage or kind == Navigate or kind == FillOrdinary or kind == FillSignInIdentifier
pure def currentApproach(x: Execution): Approach = { contextRef: x.contextRef, target: x.target, valueRef: x.valueRef, kind: x.kind }
pure def mayTryApproach(x: Execution, target: str, valueRef: str, kind: OperationKind): bool =
  x.failures < 2 or x.failedApproach != { contextRef: x.contextRef, target: target, valueRef: valueRef, kind: kind }
pure def canPrepare(x: Execution, target: str, valueRef: str, kind: OperationKind, expectedObservation: int, by: ExecutionActor): bool =
  x.phase == Observed and expectedObservation == x.observation and target != "" and ordinary(kind) and
  x.contextRef != "" and x.originVerified and x.redactionReady and not(x.privateInput) and mayTryApproach(x, target, valueRef, kind) and
  (kind == FillOrdinary implies x.matchedAccount != "" and valueRef != "") and
  (kind == FillSignInIdentifier implies valueRef != "") and graceMayTake(x, target, valueRef) and by == BrowserBridge
pure def prepare(x: Execution, target: str, valueRef: str, kind: OperationKind, expectedObservation: int, by: ExecutionActor): Execution =
  { ...x, phase: Queued, target: target, valueRef: valueRef, kind: kind }
pure def alwaysPrepared(x: Execution): bool =
  (x.phase == Queued or x.phase == InFlight) implies x.contextRef != "" and x.target != "" and ordinary(x.kind) and x.originVerified and x.redactionReady and not(x.privateInput) and
    (x.kind == FillOrdinary implies x.matchedAccount != "" and x.valueRef != "") and
    (x.kind == FillSignInIdentifier implies x.valueRef != "")
```

### The effect boundary checks both generations and dispatches a prepared operation once

The actual actuator must compare tokens again when executing the emitted command. Queueing an effect is not evidence it happened. Every completed operation requires fresh observation before the next operation; old targets and old values cannot be reused as a playback script.

```quint
pure def canDispatch(x: Execution, expectedGeneration: int, expectedObservation: int, by: ExecutionActor): bool =
  x.phase == Queued and expectedGeneration == x.generation and expectedObservation == x.observation and by == Dispatcher
pure def dispatch(x: Execution, expectedGeneration: int, expectedObservation: int, by: ExecutionActor): ExecutionResult = {
  state: { ...x, phase: InFlight },
  out: List(Operate({ owner: x.owner, task: x.task, origin: x.origin, generation: x.generation,
    observation: x.observation, target: x.target, valueRef: x.valueRef, kind: x.kind }))
}
pure def stepOnlyCurrentOrdinaryEffects(before: Execution, after: Execution, out: List[WebsiteEffect]): bool =
  out.length() > 0 implies before.phase == Queued and after.phase == InFlight and ordinary(before.kind) and before.redactionReady and not(before.privateInput)
pure def sometimesOperationDispatched(x: Execution): bool = x.phase == InFlight
```

### Actual readback establishes completion and a mismatch establishes a visible block

The bridge verifies the resulting page and populated values, not just an invocation result. Late callbacks with an old owner, task or generation are rejected. A mismatch produces a reason and requires new observation; it never invents success. Under PRD U07, one failed attempt permits one unchanged retry. A second failure of the same semantic context, target, value and operation closes that approach and offers manual continuation or a different approach. A successful operation clears the consecutive failure record. A genuinely changed context or choice can be attempted; a new observation number alone cannot reset the limit.

```quint
pure def canVerify(x: Execution, verificationReport: VerificationReport, by: ExecutionActor): bool =
  x.phase == InFlight and verificationReport.owner == x.owner and verificationReport.task == x.task and
  verificationReport.generation == x.generation and verificationReport.observation == x.observation and
  (verificationReport.matches or verificationReport.reason != "") and by == BrowserBridge
pure def verify(x: Execution, verificationReport: VerificationReport, by: ExecutionActor): Execution =
  { ...x, phase: if (verificationReport.matches) Verified else Blocked, reason: if (verificationReport.matches) "" else verificationReport.reason,
    failedApproach: if (verificationReport.matches) noApproach else currentApproach(x),
    failures: if (verificationReport.matches) 0 else if (x.failedApproach == currentApproach(x)) x.failures + 1 else 1 }
pure def canBlock(x: Execution, reason: str, by: ExecutionActor): bool =
  (x.phase == NeedObservation or x.phase == Observed or x.phase == Queued) and reason != "" and by == BrowserBridge
pure def block(x: Execution, reason: str, by: ExecutionActor): Execution =
  { ...x, phase: Blocked, reason: reason, generation: x.generation + 1 }
pure def alwaysExplainedBlock(x: Execution): bool = x.phase == Blocked implies x.reason != ""
pure def alwaysFailureCount(x: Execution): bool = x.failures >= 0 and x.failures <= 2
pure def alwaysFailedApproachIsConcrete(x: Execution): bool =
  if (x.failures == 0) x.failedApproach == noApproach
  else x.failedApproach.contextRef != "" and x.failedApproach.target != "" and ordinary(x.failedApproach.kind)
pure def alwaysNoExhaustedApproachQueued(x: Execution): bool =
  (x.phase == Queued or x.phase == InFlight) implies mayTryApproach(x, x.target, x.valueRef, x.kind)
pure def stepOnlyResultsChangeFailureMemory(before: Execution, via: str, after: Execution): bool =
  (via != "verify" and via != "retire" and via != "start") implies
    after.failures == before.failures and after.failedApproach == before.failedApproach
pure def sometimesVerified(x: Execution): bool = x.phase == Verified
pure def sometimesBlocked(x: Execution): bool = x.phase == Blocked
pure def sometimesUnchangedRetryStops(x: Execution): bool = x.failures == 2
pure def sometimesChangedApproachStillWorks(x: Execution): bool =
  x.phase == Queued and x.failures == 2 and currentApproach(x) != x.failedApproach
```

## Story: Interrupt or navigate without stale actions

> As a person changing my mind or doing a step myself, I want old queued work discarded and my current screen checked before assistance continues.

### Stop revokes queued work and resume requests a new observation

Stop remains available through touch with the microphone off. It does not promise to undo an already dispatched external effect. An ordinary in-flight operation is reobserved; a possible payment is also retained by the independent payment ledger. Navigation, account change, manual input, scroll/resize, permissions or memory revisions invalidate the old target through the same generation fence. Pause, resume, invalidation and reobservation preserve failed-approach evidence; they do not create another unchanged retry.

```quint
pure def canPause(x: Execution, by: ExecutionActor): bool = x.phase != Idle and x.phase != Paused and (by == User or by == BrowserBridge)
pure def pause(x: Execution, by: ExecutionActor): Execution =
  { ...x, phase: Paused, generation: x.generation + 1, redactionReady: false, target: "", valueRef: "", kind: UnknownControl }
pure def canResume(x: Execution, by: ExecutionActor): bool = x.phase == Paused and by == User
pure def resume(x: Execution, by: ExecutionActor): Execution =
  { ...x, phase: NeedObservation, generation: x.generation + 1, matchedAccount: "", privateInput: false, reason: "" }
pure def canInvalidate(x: Execution, by: ExecutionActor): bool = x.phase != Idle and x.phase != Paused and by == BrowserBridge
pure def invalidate(x: Execution, by: ExecutionActor): Execution =
  { ...x, phase: NeedObservation, generation: x.generation + 1, redactionReady: false, target: "", valueRef: "", kind: UnknownControl }
pure def stepGenerationNeverDecreases(before: Execution, after: Execution): bool = after.generation >= before.generation and after.observation >= before.observation
pure def sometimesPaused(x: Execution): bool = x.phase == Paused
```

### Finishing or discarding a task retires its operation generation

The composed workspace retires ordinary operations when a task finishes or is explicitly discarded. Retirement makes no assertion about an external result and does not erase the separate payment record. A later task starts with a new generation; callbacks and queued commands from the retired task cannot attach to it.

```quint
pure def canRetire(x: Execution, by: ExecutionActor): bool = x.phase != Idle and (by == User or by == BrowserBridge)
pure def retire(x: Execution, by: ExecutionActor): Execution =
  { ...initial, generation: x.generation + 1, observation: x.observation }
pure def stepRetirementClearsTargets(before: Execution, via: str, after: Execution): bool =
  via == "retire" implies after.phase == Idle and after.target == "" and after.valueRef == "" and after.generation > before.generation
```

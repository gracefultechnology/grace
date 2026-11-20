# Grace's current assistance

The new prototype uses a compact bottom window and an expanded conversation,
not the historical fixed-width sidebar. This container owns presentation and
one assistance task. It composes the [conversation](./conversation.md), which
alone owns its microphone, transcript, draft and reading position. Domain
machines own email, calendar, browser and payment truth; endpoint evidence
here is a reference to their verified result, never an independent payment
ledger. Sources: INT 01–15, CTX 01, INV 04/07–09 and ANDROID 06/09.

## Story: Keep control of one task across windows and pauses

> As an older adult, I want to hide Grace, use the website myself and return
> deliberately, with my task and conversation still understandable. When I open
> Grace again, the chat has the same size it had when I closed it.

### One task has one context and one current step

The task and operation identifiers are arbitrary. Checkpoints are current
instructions, not an upcoming fixed click sequence. The shell admits only
authenticated runtime callbacks; the domain must verify any endpoint before
emitting `finishTask` with its evidence reference. Pausing fences the current
step: unfinished work pauses, any operation is dropped and the work version
moves on. Starting a task gives it its goal as the first checkpoint, quiets
the conversation and retires its question.

```quint
import conversation as C from "./conversation"
type Presentation = Closed | Compact | Expanded
type KeyboardOwner = NoKeyboard | ChatKeyboard | WebsiteKeyboard
type Assistance = NoTask | ReadyForStep | DoingWork | WebsiteWait | UserWait | Paused | Rechecking | Finished
type TaskOutcome = Unfinished | Completed | VerifiedFailure | Abandoned
type GuidanceKind = Look | Tap | Done
type Guidance = {
  target: str, kind: GuidanceKind, revision: int, workVersion: int, conversationVersion: int,
  deviceVersion: int, browserRevision: int, shown: bool
}
type GuidanceReport = {
  target: str, revision: int, workVersion: int, conversationVersion: int,
  deviceVersion: int, browserRevision: int, verified: bool
}
pure val noGuidance: Guidance = {
  target: "", kind: Look, revision: 0, workVersion: 0, conversationVersion: 0,
  deviceVersion: 0, browserRevision: 0, shown: false
}
type Assistant = {
  presentation: Presentation, reopenExpanded: bool, keyboard: KeyboardOwner, guidance: Guidance,
  conversation: C::Conversation, activity: Assistance,
  taskId: str, goal: str, checkpoint: str, operation: str,
  workVersion: int, outcome: TaskOutcome, evidence: str,
  replacementId: str, replacementGoal: str, interruptedWork: bool
}
pure val initial: Assistant = {
  presentation: Closed, reopenExpanded: true, keyboard: NoKeyboard, guidance: noGuidance, conversation: C::initial,
  activity: NoTask, taskId: "", goal: "", checkpoint: "", operation: "",
  workVersion: 0, outcome: Unfinished, evidence: "",
  replacementId: "", replacementGoal: "", interruptedWork: false
}
pure def unfinished(a: Assistant): bool =
  a.activity != NoTask and a.activity != Finished
pure def isVisible(a: Assistant): bool = a.presentation != Closed
pure def paused(c: C::Conversation, a: Assistant): Assistant =
  { ...a, conversation: c, activity: if (unfinished(a)) Paused else a.activity,
    operation: "", workVersion: a.workVersion + 1 }
pure def started(task: str, goal: str, by: C::ConversationActor, a: Assistant): Assistant =
  val quieted = C::quiet(a.conversation, by)
  { ...a, taskId: task, goal: goal, checkpoint: goal, activity: ReadyForStep,
    workVersion: a.workVersion + 1, operation: "", outcome: Unfinished, evidence: "",
    conversation: { ...quieted, question: false, answers: List() }, replacementId: "", replacementGoal: "" }
```

### Above the website keyboard a caption strip shows the live conversation

While the website keyboard covers Grace, a caption strip shows what is
happening in the conversation: the person's words while Grace listens, Grace
thinking, speaking or paused (prototype 1229, 1234–1246). It is hidden when
the conversation is ready. Focusing a website field keeps Grace's speech going
under the caption; the prototype pauses it instead (1697–1699), which would
change the conversation on a window change.

```quint
pure def keyboardCaptionVisible(a: Assistant): bool =
  isVisible(a) and a.keyboard == WebsiteKeyboard and a.conversation.turn != C::Ready
```

### Opening and resizing reveal the same conversation without activating it

Ask Grace opens expanded the first time. After Close, Ask Grace restores the
last visible size, whether the person closed the full conversation or the
compact chat below the page. Pressing Ask Grace while the window is visible
keeps its size. Reopening preserves the paused task and waits for the person
to resume it. Expand, Collapse and Show chat keep the conversation. Show chat
closes the website keyboard and reveals Grace at the size she had.

```quint
pure def canOpen(a: Assistant, by: C::ConversationActor): bool = by == C::ConversationUser and not(isVisible(a))
pure def open(a: Assistant, by: C::ConversationActor): Assistant =
  { ...a, presentation: if (a.reopenExpanded) Expanded else Compact }
pure def canResize(a: Assistant, expanded: bool, by: C::ConversationActor): bool =
  by == C::ConversationUser and isVisible(a)
pure def resize(a: Assistant, expanded: bool, by: C::ConversationActor): Assistant =
  val sized = { ...a, presentation: if (expanded) Expanded else Compact }
  if (expanded and (a.activity == DoingWork or a.activity == WebsiteWait))
    { ...sized, activity: Rechecking, operation: "", workVersion: a.workVersion + 1 } else sized
pure def canShowChat(a: Assistant, by: C::ConversationActor): bool =
  by == C::ConversationUser and isVisible(a) and a.keyboard == WebsiteKeyboard
pure def showChat(a: Assistant, by: C::ConversationActor): Assistant =
  { ...a, keyboard: NoKeyboard }
pure def stepShowChatKeepsTheSize(before: Assistant, via: str, after: Assistant): bool =
  via == "showChat" implies after.presentation == before.presentation
```

### Close hides Grace and fences unfinished work without reporting completion

The website stays open in the browser model. All queued work is invalidated,
speech/capture stop, and the current checkpoint stays. The same fence applies
when the relevant page changes or the device leaves the task context.

```quint
pure def canClose(a: Assistant, by: C::ConversationActor): bool =
  by == C::ConversationUser and isVisible(a)
pure def close(a: Assistant, by: C::ConversationActor): Assistant =
  { ...paused(C::quiet(a.conversation, by), a), presentation: Closed,
    reopenExpanded: a.presentation == Expanded, keyboard: NoKeyboard,
    interruptedWork: a.activity == DoingWork or a.activity == WebsiteWait }
pure def canPause(a: Assistant, by: C::ConversationActor): bool = unfinished(a)
pure def pause(a: Assistant, by: C::ConversationActor): Assistant =
  paused(C::quiet(a.conversation, by), a)

pure def lawReopeningRestoresTheClosedSize(a: Assistant): bool =
  isVisible(a) implies open(close(a, C::ConversationUser), C::ConversationUser).presentation == a.presentation
pure def stepClosePreservesTask(before: Assistant, via: str, after: Assistant): bool =
  via == "close" implies after.taskId == before.taskId and after.goal == before.goal and
    after.checkpoint == before.checkpoint and after.outcome == before.outcome
```

### Resume first reconciles current evidence and never replays an old queue

The runtime compares current site/account/domain state, including possible
manual submission, before saying continuation is allowed. A conflict stays
paused with an updated explanation; finishing instead uses verified endpoint
evidence. Merely reopening is never Resume.

```quint
pure def canResume(a: Assistant, by: C::ConversationActor): bool =
  by == C::ConversationUser and isVisible(a) and a.activity == Paused
pure def resume(a: Assistant, by: C::ConversationActor): Assistant =
  { ...a, activity: Rechecking, workVersion: a.workVersion + 1, operation: "" }
pure def canReconcile(a: Assistant, task: str, version: int, checkpoint: str, by: C::ConversationActor): bool =
  by == C::ConversationRuntime and a.activity == Rechecking and task == a.taskId and
  version == a.workVersion and checkpoint != ""
pure def reconcile(a: Assistant, task: str, version: int, checkpoint: str, permitted: bool, by: C::ConversationActor): Assistant =
  { ...a, activity: if (permitted) ReadyForStep else Paused, checkpoint: checkpoint }
```

### A new task cannot silently replace unfinished assistance

A detour question uses the same conversation. An unrelated goal creates one
replacement question; only an explicit choice replaces the current task.
That question pauses and fences existing work, speech and pending responses.
Keeping the old task leaves it
paused until the person chooses Resume.
Abandoning assistance does not erase the separate transaction evidence or
personal memory. No persistent End task control is required.

```quint
pure def canBeginTask(a: Assistant, task: str, goal: str, by: C::ConversationActor): bool =
  by == C::ConversationUser and isVisible(a) and not(unfinished(a)) and task != "" and goal != ""
pure def beginTask(a: Assistant, task: str, goal: str, by: C::ConversationActor): Assistant =
  started(task, goal, by, a)
pure def canRequestReplacement(a: Assistant, task: str, goal: str, by: C::ConversationActor): bool =
  by == C::ConversationUser and isVisible(a) and unfinished(a) and task != "" and task != a.taskId and goal != ""
pure def requestReplacement(a: Assistant, task: str, goal: str, by: C::ConversationActor): Assistant =
  { ...paused(C::quiet(a.conversation, by), a), replacementId: task, replacementGoal: goal }
pure def canChooseReplacement(a: Assistant, by: C::ConversationActor): bool =
  by == C::ConversationUser and isVisible(a) and a.replacementId != ""
pure def chooseReplacement(a: Assistant, replace: bool, by: C::ConversationActor): Assistant =
  if (replace) started(a.replacementId, a.replacementGoal, by, a)
  else { ...a, replacementId: "", replacementGoal: "" }
pure def canAbandon(a: Assistant, by: C::ConversationActor): bool =
  by == C::ConversationUser and isVisible(a) and unfinished(a)
pure def abandon(a: Assistant, by: C::ConversationActor): Assistant =
  { ...a, activity: Finished, outcome: Abandoned, operation: "", evidence: "",
    workVersion: a.workVersion + 1, conversation: C::quiet(a.conversation, by),
    replacementId: "", replacementGoal: "" }
```

### Only the current task and operation can advance a meaningful step

`DoingWork` denotes an active ordinary step, `WebsiteWait` a provider wait and
`UserWait` a request for the person's input; conversation thinking remains a
separate turn. These events report domain work; they do not execute or
authorize a browser action themselves.

```quint
pure def canStartStep(a: Assistant, task: str, version: int, operation: str, by: C::ConversationActor): bool =
  by == C::ConversationRuntime and a.presentation == Compact and a.activity == ReadyForStep and
  task == a.taskId and version == a.workVersion and operation != "" and a.replacementId == ""
pure def startStep(a: Assistant, task: str, version: int, operation: str, by: C::ConversationActor): Assistant =
  { ...a, activity: DoingWork, operation: operation }
pure def canWaitForWebsite(a: Assistant, task: str, version: int, by: C::ConversationActor): bool =
  by == C::ConversationRuntime and a.activity == DoingWork and task == a.taskId and version == a.workVersion
pure def waitForWebsite(a: Assistant, task: str, version: int, by: C::ConversationActor): Assistant =
  { ...a, activity: WebsiteWait }
pure def canReceiveStep(a: Assistant, task: str, version: int, operation: str, checkpoint: str, by: C::ConversationActor): bool =
  by == C::ConversationRuntime and (a.activity == DoingWork or a.activity == WebsiteWait) and
  task == a.taskId and version == a.workVersion and operation == a.operation and checkpoint != ""
pure def receiveStep(a: Assistant, task: str, version: int, operation: str, checkpoint: str, needsUser: bool, by: C::ConversationActor): Assistant =
  { ...a, activity: if (needsUser) UserWait else ReadyForStep, checkpoint: checkpoint,
    operation: "", workVersion: a.workVersion + 1 }
pure def canContinueTask(a: Assistant, by: C::ConversationActor): bool =
  by == C::ConversationUser and isVisible(a) and a.activity == UserWait
pure def continueTask(a: Assistant, by: C::ConversationActor): Assistant =
  { ...a, activity: Rechecking, workVersion: a.workVersion + 1 }
```

### Grace works on the page only while it is in view

Expanded Grace covers the page, which is then paused and not drawn, so her own
steps run only in the compact window: a step starts only there, and expanding
Grace while she works fences that step and its operation, so it is rechecked
like any other window change and goes on only once she is compact again. When a step is needed while she is expanded, Grace first asks
"Would you like to watch me do it?" with the chips "Yes, show me" and "No, go
ahead" (prototype 1518, 1596–1599), and her first step makes her window
smaller, on the person's screen, as the prototype's does (1371). The person's
own Collapse also answers the question (1740). This spec departs from the
prototype on "No, go ahead": there Grace works behind her expanded window; here
she makes it smaller either way, because she never acts on a page that is not
running.

```quint
pure def canCollapseForWork(a: Assistant, task: str, version: int, by: C::ConversationActor): bool =
  by == C::ConversationRuntime and a.presentation == Expanded and a.activity == ReadyForStep and
  task == a.taskId and version == a.workVersion and a.replacementId == ""
pure def collapseForWork(a: Assistant, task: str, version: int, by: C::ConversationActor): Assistant =
  { ...a, presentation: Compact }
pure def alwaysGraceWorksOnlyOnTheVisiblePage(a: Assistant): bool =
  (a.activity == DoingWork or a.activity == WebsiteWait) implies a.presentation == Compact
pure def sometimesCollapsedForWork(a: Assistant): bool =
  a.presentation == Compact and a.activity == ReadyForStep and a.taskId != ""
```

### Completion is a verified domain endpoint, never Close, silence or a click

The domain integration must supply evidence for the same task and its actual
terminal outcome. Pending, unknown and blocked outcomes cannot enter this
transition. A verified failure is explicitly different from completion.

```quint
pure def canFinishTask(a: Assistant, task: str, version: int, result: TaskOutcome, evidence: str, by: C::ConversationActor): bool =
  by == C::ConversationRuntime and unfinished(a) and a.activity != Paused and
  task == a.taskId and version == a.workVersion and evidence != "" and
  (result == Completed or result == VerifiedFailure)
pure def finishTask(a: Assistant, task: str, version: int, result: TaskOutcome, evidence: str, by: C::ConversationActor): Assistant =
  { ...a, activity: Finished, outcome: result, evidence: evidence, operation: "",
    workVersion: a.workVersion + 1, replacementId: "", replacementGoal: "" }
```

## Story: Dismiss guidance without stopping the task

> As a person reading a website or app, I can hide the target label and ring,
> keep the instruction in Grace, and show that guidance again while it is current.

### Guidance belongs to the current instruction and never grants action authority

PRD INT 12 and the prototype's `gclose` control distinguish hiding a label from
Close or Stop. The label reuses the current task checkpoint, or the latest Grace
response when no task is active. It does not store another instruction. A trusted
host locates one semantic target and supplies the current device, page, task,
conversation and guidance revisions. This may point to an app control or private
sign-in field without authorizing input or exposing that field's contents.

A new instruction, task, conversation, page or layout retires the old target.
The workspace checks device/page versions; app adapters explicitly invalidate
before moving or removing a target. Close and Stop invalidate the work version.
A delayed target report cannot undo a newer publication, dismissal or invalidation.

Guidance has a kind (prototype 1138–1154): Look rings a fact to look at,
with no label; Tap labels the control the person should use next; Done is the
green check. Green means done: Done is published only for a task that finished
with a verified completed outcome (prototype 1485, 1519; RESP 05), so a
scheduled payment turns green only once its task has finished with that
verified result. A Done marker for the current work and conversation keeps this
requirement even while the window or current activity hides it. Grace's own
working marker comes from her activity. Guidance cannot name a future work or
conversation generation. The host names the kind beside its report
(`publishGuidanceAs`). `publishGuidance` publishes the label of a Tap.

```quint
pure def guidanceInstruction(a: Assistant): str =
  if (unfinished(a)) a.checkpoint else C::latestGraceText(a.conversation)
pure def guidanceIsCurrent(a: Assistant): bool =
  isVisible(a) and a.guidance.target != "" and guidanceInstruction(a) != "" and
  a.activity != Paused and a.activity != Rechecking and
  a.guidance.workVersion == a.workVersion and a.guidance.conversationVersion == a.conversation.generation
pure def canPublishGuidanceAs(a: Assistant, report: GuidanceReport, kind: GuidanceKind, by: C::ConversationActor): bool =
  by == C::ConversationRuntime and isVisible(a) and guidanceInstruction(a) != "" and
  a.conversation.turn != C::Thinking and a.activity != Paused and a.activity != Rechecking and report.verified and report.target != "" and
  report.revision == a.guidance.revision and report.workVersion == a.workVersion and
  report.conversationVersion == a.conversation.generation and report.deviceVersion >= 0 and report.browserRevision >= 0 and
  (kind == Done implies a.activity == Finished and a.outcome == Completed)
pure def publishGuidanceAs(a: Assistant, report: GuidanceReport, kind: GuidanceKind, by: C::ConversationActor): Assistant = {
  ...a, guidance: { target: report.target, kind: kind, revision: a.guidance.revision + 1,
    workVersion: report.workVersion, conversationVersion: report.conversationVersion,
    deviceVersion: report.deviceVersion, browserRevision: report.browserRevision, shown: true }
}
pure def canPublishGuidance(a: Assistant, report: GuidanceReport, by: C::ConversationActor): bool =
  canPublishGuidanceAs(a, report, Tap, by)
pure def publishGuidance(a: Assistant, report: GuidanceReport, by: C::ConversationActor): Assistant =
  publishGuidanceAs(a, report, Tap, by)
pure def alwaysGuidanceIsNotAhead(a: Assistant): bool =
  a.guidance.workVersion <= a.workVersion and a.guidance.conversationVersion <= a.conversation.generation
pure def alwaysDoneMeansVerifiedCompletion(a: Assistant): bool =
  (a.guidance.target != "" and a.guidance.kind == Done and
    a.guidance.workVersion == a.workVersion and a.guidance.conversationVersion == a.conversation.generation) implies
      a.activity == Finished and a.outcome == Completed
pure def sometimesDoneShown(a: Assistant): bool = guidanceIsCurrent(a) and a.guidance.kind == Done
pure def canInvalidateGuidance(a: Assistant, revision: int, by: C::ConversationActor): bool =
  by == C::ConversationRuntime and revision == a.guidance.revision and a.guidance.target != ""
pure def invalidateGuidance(a: Assistant, revision: int, by: C::ConversationActor): Assistant = {
  ...a, guidance: { ...a.guidance, target: "", shown: false, revision: a.guidance.revision + 1 }
}
```

### Dismiss hides only the label and Show restores only a still-current target

Both controls carry the displayed guidance revision. Dismiss preserves the
instruction, task, microphone, draft, and execution permissions. Show restores
that same target and instruction; it does not reobserve or resume work. When a
target is stale, the host must locate it again before Show becomes available.

```quint
pure def canDismissGuidance(a: Assistant, revision: int, by: C::ConversationActor): bool =
  by == C::ConversationUser and guidanceIsCurrent(a) and a.guidance.shown and revision == a.guidance.revision
pure def dismissGuidance(a: Assistant, revision: int, by: C::ConversationActor): Assistant = {
  ...a, guidance: { ...a.guidance, shown: false, revision: a.guidance.revision + 1 }
}
pure def canShowGuidance(a: Assistant, revision: int, by: C::ConversationActor): bool =
  by == C::ConversationUser and guidanceIsCurrent(a) and not(a.guidance.shown) and revision == a.guidance.revision
pure def showGuidance(a: Assistant, revision: int, by: C::ConversationActor): Assistant = {
  ...a, guidance: { ...a.guidance, shown: true, revision: a.guidance.revision + 1 }
}
pure def lawDismissOnlyChangesGuidance(a: Assistant, revision: int, by: C::ConversationActor): bool =
  { ...dismissGuidance(a, revision, by), guidance: a.guidance } == a and
    dismissGuidance(a, revision, by).guidance == { ...a.guidance, shown: false, revision: a.guidance.revision + 1 }
pure def lawShowKeepsTheTarget(a: Assistant, revision: int, by: C::ConversationActor): bool =
  canShowGuidance(a, revision, by) implies
    (showGuidance(a, revision, by).guidance.target == a.guidance.target and guidanceIsCurrent(showGuidance(a, revision, by)))
pure def lawStaleGuidanceCannotReturn(a: Assistant, revision: int, by: C::ConversationActor): bool =
  (a.guidance.workVersion != a.workVersion or a.guidance.conversationVersion != a.conversation.generation) implies
    not(canShowGuidance(a, revision, by))
pure def sometimesGuidanceShown(a: Assistant): bool = guidanceIsCurrent(a) and a.guidance.shown
pure def sometimesGuidanceDismissed(a: Assistant): bool = guidanceIsCurrent(a) and not(a.guidance.shown)
pure val exampleReport: GuidanceReport =
  { target: "control", revision: 0, workVersion: 1, conversationVersion: 1, deviceVersion: 0, browserRevision: 0, verified: true }
pure val reportValues = Set(exampleReport,
  { ...exampleReport, workVersion: 0, conversationVersion: 2 }, { ...exampleReport, conversationVersion: 2 },
  { ...exampleReport, verified: false }, { ...exampleReport, target: "" },
  { ...exampleReport, workVersion: 2, conversationVersion: 3 })
```

### Page guidance shows only on the visible page and steps aside while Grace talks or works

The ring and label never show while Grace is expanded, since she then covers
the page, or while the person types to her; they step aside while Grace thinks
or speaks, and while she works on the page only her own working marker shows
(prototype 1129–1132). `guidanceMayShow` is that condition, for the view that
draws the ring and label to require.

```quint
pure def guidanceMayShow(a: Assistant): bool =
  a.presentation == Compact and a.keyboard != ChatKeyboard and
  a.conversation.turn != C::Thinking and a.conversation.turn != C::Speaking and
  a.activity != DoingWork and a.activity != WebsiteWait
pure def lawExpandedGraceShowsNoGuidance(a: Assistant): bool =
  a.presentation == Expanded implies not(guidanceMayShow(a))
```

## Story: Keep voice and typing available in either Grace window

> As an older adult, I want the same controls and conversation in either
> window, while typing on the website continues to mean website input.

### The container routes deliberate controls into its one conversation

These wrappers use the conversation's guards, with no second microphone
lifecycle. Website keyboard input is not a chat draft. The keyboard dismiss
and window resize paths do not clear a draft or activate the microphone.
Privacy removal is also accepted while hidden: it purges the conversation
and pauses unfinished work before a sanitized context can be used again.
Submitting a message, by typing, speaking or tapping an answer, supersedes the
task's current step: unfinished work that is not paused is rechecked against
the new request, with any operation in flight fenced. `supersede` is that one
fence, which can keep a step that waits for the person.
Task identifiers and checkpoints are non-secret metadata, never copies of
private field values or unfiltered message text.

```quint
pure def supersede(keepUserWait: bool, a: Assistant): Assistant =
  if (unfinished(a) and a.activity != Paused and not(keepUserWait and a.activity == UserWait))
    { ...a, activity: Rechecking, operation: "", workVersion: a.workVersion + 1 } else a
pure def canTalk(a: Assistant, by: C::ConversationActor): bool = isVisible(a) and C::canTalk(a.conversation, by)
pure def talk(a: Assistant, by: C::ConversationActor): Assistant =
  { ...a, conversation: C::talk(a.conversation, by), keyboard: NoKeyboard }
pure def canChooseType(a: Assistant, by: C::ConversationActor): bool = isVisible(a) and C::canChooseType(a.conversation, by)
pure def chooseType(a: Assistant, by: C::ConversationActor): Assistant =
  { ...a, conversation: C::chooseType(a.conversation, by), keyboard: ChatKeyboard }
pure def canDismissKeyboard(a: Assistant, by: C::ConversationActor): bool = by == C::ConversationUser and a.keyboard != NoKeyboard
pure def dismissKeyboard(a: Assistant, by: C::ConversationActor): Assistant = { ...a, keyboard: NoKeyboard }
pure def canFocusWebsite(a: Assistant, by: C::ConversationActor): bool = by == C::ConversationUser and isVisible(a)
pure def focusWebsite(a: Assistant, by: C::ConversationActor): Assistant = { ...a, keyboard: WebsiteKeyboard }
pure def canEditDraft(a: Assistant, text: str, by: C::ConversationActor): bool =
  isVisible(a) and a.keyboard == ChatKeyboard and C::canEditDraft(a.conversation, text, by)
pure def editDraft(a: Assistant, text: str, by: C::ConversationActor): Assistant =
  { ...a, conversation: C::editDraft(a.conversation, text, by) }
pure def canSendDraft(a: Assistant, revision: int, by: C::ConversationActor): bool =
  isVisible(a) and a.keyboard == ChatKeyboard and C::canSendDraft(a.conversation, revision, by)
pure def sendDraft(a: Assistant, revision: int, by: C::ConversationActor): Assistant =
  supersede(false, { ...a, conversation: C::sendDraft(a.conversation, revision, by), keyboard: NoKeyboard })
pure def canHear(a: Assistant, token: int, text: str, owner: C::AudioOwner, by: C::ConversationActor): bool =
  isVisible(a) and C::canHear(a.conversation, token, text, owner, by)
pure def hear(a: Assistant, token: int, text: str, owner: C::AudioOwner, by: C::ConversationActor): Assistant =
  supersede(false, { ...a, conversation: C::hear(a.conversation, token, text, owner, by) })
pure def canChooseAnswer(a: Assistant, token: int, text: str, by: C::ConversationActor): bool =
  isVisible(a) and C::canChooseAnswer(a.conversation, token, text, by)
pure def chooseAnswer(a: Assistant, token: int, text: str, by: C::ConversationActor): Assistant =
  supersede(false, { ...a, conversation: C::chooseAnswer(a.conversation, token, text, by) })
pure def canRespond(a: Assistant, token: int, text: str, isQuestion: bool, answers: List[str], by: C::ConversationActor): bool =
  isVisible(a) and C::canRespond(a.conversation, token, text, isQuestion, answers, by)
pure def respond(a: Assistant, token: int, text: str, isQuestion: bool, answers: List[str], audible: bool, by: C::ConversationActor): Assistant =
  { ...a, conversation: C::respond(a.conversation, token, text, isQuestion, answers, audible, by) }
pure def canPauseSpeech(a: Assistant, by: C::ConversationActor): bool = isVisible(a) and C::canPauseSpeech(a.conversation, by)
pure def pauseSpeech(a: Assistant, by: C::ConversationActor): Assistant =
  { ...a, conversation: C::pauseSpeech(a.conversation, by) }
pure def canResumeSpeech(a: Assistant, by: C::ConversationActor): bool = isVisible(a) and C::canResumeSpeech(a.conversation, by)
pure def resumeSpeech(a: Assistant, by: C::ConversationActor): Assistant =
  { ...a, conversation: C::resumeSpeech(a.conversation, by) }
pure def canBargeIn(a: Assistant, token: int, spoken: int, owner: C::AudioOwner, by: C::ConversationActor): bool =
  isVisible(a) and C::canBargeIn(a.conversation, token, spoken, owner, by)
pure def bargeIn(a: Assistant, token: int, spoken: int, owner: C::AudioOwner, by: C::ConversationActor): Assistant =
  { ...a, conversation: C::bargeIn(a.conversation, token, spoken, owner, by) }
pure def canFinishSpeech(a: Assistant, token: int, played: bool, by: C::ConversationActor): bool =
  isVisible(a) and C::canFinishSpeech(a.conversation, token, played, by)
pure def finishSpeech(a: Assistant, token: int, played: bool, by: C::ConversationActor): Assistant =
  { ...a, conversation: C::finishSpeech(a.conversation, token, played, by) }
pure def canQuiet(a: Assistant, by: C::ConversationActor): bool = isVisible(a)
pure def quiet(a: Assistant, by: C::ConversationActor): Assistant =
  { ...a, conversation: C::quiet(a.conversation, by) }
pure def canSilence(a: Assistant, token: int, by: C::ConversationActor): bool =
  isVisible(a) and C::canSilence(a.conversation, token, by)
pure def silence(a: Assistant, token: int, by: C::ConversationActor): Assistant =
  { ...a, conversation: C::silence(a.conversation, token, by) }
pure def canUnusableSpeech(a: Assistant, token: int, owner: C::AudioOwner, by: C::ConversationActor): bool =
  isVisible(a) and C::canUnusableSpeech(a.conversation, token, owner, by)
pure def unusableSpeech(a: Assistant, token: int, owner: C::AudioOwner, by: C::ConversationActor): Assistant =
  { ...a, conversation: C::unusableSpeech(a.conversation, token, owner, by) }
pure def canReadEarlier(a: Assistant, position: int, by: C::ConversationActor): bool =
  isVisible(a) and C::canReadEarlier(a.conversation, position, by)
pure def readEarlier(a: Assistant, position: int, by: C::ConversationActor): Assistant =
  { ...a, conversation: C::readEarlier(a.conversation, position, by) }
pure def canReadLatest(a: Assistant, by: C::ConversationActor): bool =
  isVisible(a) and C::canReadLatest(a.conversation, by)
pure def readLatest(a: Assistant, by: C::ConversationActor): Assistant =
  { ...a, conversation: C::readLatest(a.conversation, by) }
pure def canRepeatReply(a: Assistant, audible: bool, by: C::ConversationActor): bool =
  isVisible(a) and C::canRepeatReply(a.conversation, audible, by)
pure def repeatReply(a: Assistant, audible: bool, by: C::ConversationActor): Assistant =
  { ...a, conversation: C::repeatReply(a.conversation, audible, by) }
pure def canServiceFailure(a: Assistant, token: int, text: str, by: C::ConversationActor): bool =
  isVisible(a) and C::canServiceFailure(a.conversation, token, text, by)
pure def serviceFailure(a: Assistant, token: int, text: str, by: C::ConversationActor): Assistant =
  { ...a, conversation: C::serviceFailure(a.conversation, token, text, by) }
pure def canPurgePrivate(a: Assistant, token: int, messageIndex: int, purgeDraft: bool, by: C::ConversationActor): bool =
  C::canPurgePrivate(a.conversation, token, messageIndex, purgeDraft, by)
pure def purgePrivate(a: Assistant, token: int, messageIndex: int, purgeDraft: bool, by: C::ConversationActor): Assistant =
  paused(C::purgePrivate(a.conversation, token, messageIndex, purgeDraft, by), a)
pure def canNewConversation(a: Assistant, by: C::ConversationActor): bool =
  isVisible(a) and not(unfinished(a)) and C::canNewConversation(a.conversation, by)
pure def newConversation(a: Assistant, by: C::ConversationActor): Assistant =
  { ...a, conversation: C::newConversation(a.conversation, by), activity: NoTask,
    taskId: "", goal: "", checkpoint: "", operation: "", evidence: "", outcome: Unfinished,
    workVersion: a.workVersion + 1, replacementId: "", replacementGoal: "" }
```

### Hidden assistance is quiet and every task status has its necessary context

```quint
pure def alwaysConversationRules(a: Assistant): bool =
  C::alwaysListeningHasAnActiveExchange(a.conversation) and C::alwaysRecognitionRetriesAreBounded(a.conversation) and
  C::alwaysReadingPositionExists(a.conversation) and C::alwaysGenerationsAreNonnegative(a.conversation) and
  C::alwaysMessagesHaveContent(a.conversation)
pure def alwaysHiddenIsQuiet(a: Assistant): bool =
  a.presentation == Closed implies not(a.conversation.voice) and a.conversation.turn == C::Ready and
    (a.activity == NoTask or a.activity == Paused or a.activity == Finished)
pure def alwaysTaskContextExists(a: Assistant): bool =
  (a.activity != NoTask implies a.taskId != "" and a.goal != "" and a.checkpoint != "") and
  (a.activity == NoTask implies a.taskId == "" and a.goal == "" and a.checkpoint == "") and a.workVersion >= 0 and a.guidance.revision >= 0
pure def alwaysOperationsBelongToWorkingTasks(a: Assistant): bool =
  (a.activity == DoingWork or a.activity == WebsiteWait) iff a.operation != ""
pure def alwaysOnlyVerifiedEndpointsClaimCompletion(a: Assistant): bool =
  (a.outcome == Completed or a.outcome == VerifiedFailure implies a.activity == Finished and a.evidence != "") and
  (a.activity == Finished iff a.outcome != Unfinished) and
  (a.outcome == Unfinished implies a.evidence == "")
pure def alwaysConversationOffersAndInterruptions(a: Assistant): bool =
  C::alwaysAnswersBelongToTheQuestion(a.conversation) and C::alwaysInterruptionsMarkMessages(a.conversation)
pure def alwaysReplacementIsComplete(a: Assistant): bool =
  (a.replacementId != "" iff a.replacementGoal != "") and
  (a.replacementId != "" implies unfinished(a) and a.replacementId != a.taskId)
pure def stepWindowChangesKeepConversation(before: Assistant, via: str, after: Assistant): bool =
  (via == "open" or via == "resize" or via == "showChat" or via == "dismissKeyboard" or via == "focusWebsite") implies
    after.conversation == before.conversation
```

### Pausing, reconciliation, replacement and verified outcomes are reachable

```quint
pure def sometimesPaused(a: Assistant): bool = a.activity == Paused
pure def sometimesRechecking(a: Assistant): bool = a.activity == Rechecking
pure def sometimesWebsiteWait(a: Assistant): bool = a.activity == WebsiteWait
pure def sometimesUserWait(a: Assistant): bool = a.activity == UserWait
pure def sometimesReplacementQuestion(a: Assistant): bool = a.replacementId != ""
pure def sometimesCompleted(a: Assistant): bool = a.outcome == Completed
pure def sometimesFailed(a: Assistant): bool = a.outcome == VerifiedFailure
pure def sometimesAbandoned(a: Assistant): bool = a.outcome == Abandoned
pure def sometimesKeyboardCaption(a: Assistant): bool = keyboardCaptionVisible(a)
pure def sometimesReopenedOverInterruptedWork(a: Assistant): bool =
  a.presentation == Compact and a.activity == Paused and a.interruptedWork
pure val weight_publishGuidance = 10
pure val weight_dismissGuidance = 10
pure val weight_showGuidance = 10
```

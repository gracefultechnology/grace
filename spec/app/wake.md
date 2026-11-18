# Wake Grace by voice

The user selected the new prototype's “Hey Grace” behavior on November 13.
This supersedes the older PRD prohibition of wake words and background wake
detection. `prototype/Grace Prototype.html:2050,2253–2269` supplies the setting,
sleep screen, wake response and silence return. The default is enabled.
[Preferences](./preferences.md) owns that persisted choice; this module owns
only one wake interaction and its timers. [Workspace](./workspace.md) joins it
to the actual device and conversation.

On November 16 the owner chose speech through Grace's cloud service with no
model on the tablet. A wake phrase cannot be heard in the cloud without
sending the room's sound all day, so the MVP ships no wake detector: the host
reports detection unavailable, no detection is admitted, the Settings row shows
that it is not available and the sleep screen says to touch the screen. The
rules below stay so that a detector can return later. Pre-trigger audio is
neither saved nor sent to any speech service. Detection is not open-ended
conversation recording. The host excludes Grace's and website audio, checks current microphone
permission and binds callbacks to this interaction's generation. A recognized
human wake phrase starts a fresh listening exchange; it never resumes website
execution or supplies approval to a payment. Turning the setting off stops the
detector immediately, including while preference persistence is pending.

## Story: Call Grace from any app or while the screen sleeps

> As a user, I want to say “Hey Grace” when enabled, see Grace listening, and
> return to what I was doing if I say nothing else.

### Only a current human wake detection can start the interaction

Detection while asleep wakes the screen. On Home, Grace opens expanded; over an
app it opens compact; an already visible window keeps its size. A short chime
uses device volume/mute. The transcript and unsent draft remain intact. Existing
website work is paused and old authorization invalidated before listening.
Touching the sleep screen wakes it without opening Grace or starting capture.
The native host reports unavailable detection instead of pretending it works.
When Grace cannot answer, the [workspace](./workspace.md) gives the
`ExplainUnavailable` signal in place of the chime and starts no wake
interaction; this module never emits it.

```quint
type WakeActor = WakeUser | WakeHost
type WakePhase = Dormant | AwaitingSpeech | SilenceNotice
type PriorWindow = WasClosed | WasCompact | WasExpanded
type WakeSource = HumanWake | GracePlayback | OtherPlayback
type WakeContext = { enabled: bool, permitted: bool, available: bool, ready: bool, source: WakeSource }
type WakeDetection = { generation: int, now: int, conversationVersion: int, prior: PriorWindow, context: WakeContext }
type Wake = { phase: WakePhase, generation: int, conversationVersion: int, deadline: int, prior: PriorWindow }
type WakeSignal = WakeChime | ExplainSilence | ExplainUnavailable | ReturnToPriorWindow
type WakeResult = { state: Wake, out: List[WakeSignal] }
pure val initial: Wake = { phase: Dormant, generation: 0, conversationVersion: 0, deadline: 0, prior: WasClosed }
pure def permittedWake(context: WakeContext): bool =
  context.enabled and context.permitted and context.available and context.ready and context.source == HumanWake
pure def canDetect(w: Wake, detection: WakeDetection, by: WakeActor): bool =
  by == WakeHost and detection.generation == w.generation and detection.now >= 0 and
  detection.conversationVersion >= 0 and permittedWake(detection.context)
pure def detect(w: Wake, detection: WakeDetection, by: WakeActor): WakeResult = {
  state: { phase: AwaitingSpeech, generation: w.generation + 1,
    conversationVersion: detection.conversationVersion, deadline: detection.now + 8000, prior: detection.prior },
  out: List(WakeChime)
}
pure def alwaysWakeCounters(w: Wake): bool =
  w.generation >= 0 and w.conversationVersion >= 0 and w.deadline >= 0
pure def alwaysActiveWakeHasDeadline(w: Wake): bool =
  w.phase != Dormant implies w.deadline >= 8000 and w.generation > 0
pure def lawPlaybackNeverWakes(context: WakeContext): bool =
  context.source != HumanWake implies not(permittedWake(context))
pure def lawDisabledNeverWakes(context: WakeContext): bool =
  not(context.enabled) implies not(permittedWake(context))
pure def sometimesAwaitingSpeech(w: Wake): bool = w.phase == AwaitingSpeech
```

### Silence uses the current timer and cannot close a later conversation

After eight seconds without input, capture stops and Grace explains that she
did not hear anything. That explanation may be spoken only when output is
enabled; it does not restart capture. After another eight seconds, a window
opened by the wake phrase closes; a previously visible window returns to its
prior size. No response, consent or task completion is inferred from silence.
Any new input, Talk, Type, navigation, settings change or lifecycle change
invalidates these timers. A timer never controls a newer conversation version.

```quint
type WakeTimer = { generation: int, conversationVersion: int, now: int }
pure def canNoSpeech(w: Wake, timer: WakeTimer, by: WakeActor): bool =
  by == WakeHost and w.phase == AwaitingSpeech and timer.generation == w.generation and
  timer.conversationVersion == w.conversationVersion and timer.now >= w.deadline
pure def noSpeech(w: Wake, timer: WakeTimer, by: WakeActor): WakeResult = {
  state: { ...w, phase: SilenceNotice, conversationVersion: timer.conversationVersion + 1,
    deadline: timer.now + 8000 }, out: List(ExplainSilence)
}
pure def canReturnAfterSilence(w: Wake, timer: WakeTimer, by: WakeActor): bool =
  by == WakeHost and w.phase == SilenceNotice and timer.generation == w.generation and
  timer.conversationVersion == w.conversationVersion and timer.now >= w.deadline
pure def returnAfterSilence(w: Wake, timer: WakeTimer, by: WakeActor): WakeResult = {
  state: { ...w, phase: Dormant, generation: w.generation + 1 }, out: List(ReturnToPriorWindow)
}
pure def cancel(w: Wake, by: WakeActor): Wake =
  { ...w, phase: Dormant, generation: w.generation + 1 }
pure def stepGenerationNeverRegresses(before: Wake, after: Wake): bool = after.generation >= before.generation
pure def lawOldTimerCannotClose(w: Wake, timer: WakeTimer, by: WakeActor): bool =
  timer.generation != w.generation implies not(canReturnAfterSilence(w, timer, by))
pure def sometimesSilenceNotice(w: Wake): bool = w.phase == SilenceNotice
pure def sometimesWakeFinished(w: Wake): bool = w.phase == Dormant and w.generation > 1
```

### Settings and the sleep screen say when wake detection is unavailable

The Settings row is on, off, or not available when the tablet has no
detector, whatever the saved choice. The sleep screen offers the wake phrase
only when it would be heard; otherwise it says to touch the screen.

```quint
type WakeRow = WakeOn | WakeOff | WakeUnavailable
pure def wakeRow(chosen: bool, available: bool): WakeRow =
  if (not(available)) WakeUnavailable else if (chosen) WakeOn else WakeOff
pure def sleepHint(chosen: bool, available: bool): str =
  if (wakeRow(chosen, available) == WakeOn) "Say “Hey Grace”, or touch the screen" else "Touch the screen to wake it"
pure def lawUnavailableNeverWakes(context: WakeContext): bool =
  not(context.available) implies
    not(permittedWake(context)) and wakeRow(context.enabled, context.available) == WakeUnavailable
```

### Examples cover enabled, disabled, playback and expired callbacks

```quint
pure val availableContext: WakeContext = { enabled: true, permitted: true, available: true, ready: true, source: HumanWake }
pure val contextValues = Set(availableContext, { ...availableContext, enabled: false },
  { ...availableContext, permitted: false }, { ...availableContext, available: false },
  { ...availableContext, ready: false }, { ...availableContext, source: GracePlayback },
  { ...availableContext, source: OtherPlayback })
pure val exampleDetection: WakeDetection = { generation: 0, now: 0, conversationVersion: 1, prior: WasClosed, context: availableContext }
pure val detectionValues = Set(exampleDetection, { ...exampleDetection, generation: 1, prior: WasExpanded },
  { ...exampleDetection, context: { ...availableContext, enabled: false } })
pure val timerValues = Set({ generation: 1, conversationVersion: 1, now: 8000 },
  { generation: 1, conversationVersion: 1, now: 16000 },
  { generation: 1, conversationVersion: 2, now: 16000 },
  { generation: 0, conversationVersion: 1, now: 16000 })
```

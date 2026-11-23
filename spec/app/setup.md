# Set up a new tablet

A new tablet walks its owner through a short set-up before Home. The steps,
in order: Wi-Fi, connecting an email account (with Not now), her preferred
name, speaking pace and text size with a live preview, a short explanation
of what Grace does, trying Talk, trying Type, closing Grace, bringing her
back with Ask Grace, then Grace's own question, "What would you like to
do?". Set-up uses English and one voice. It offers no language or wake-word picker.

This follows PRD ONB-01 to ONB-03 (`prototype/prd.md:923–927`), with three
changes. Wi-Fi comes first on the launcher tablet, because thinking and
speech run in the cloud. The account step comes before anything spoken,
because Grace can think only once an email account is connected and the
cloud account behind speech and reasoning is usable, so Not now there
leaves Grace unable to answer. ONB-01 lets only the sign-in be skipped;
here every step but the explanation can be put off, each at a stated cost.

Set-up is its own record, not a conversation. Until Grace can think, every
step is fixed written text answered by a tap or by typing, and no step
needs Grace to reason. Speech is Cartesia through the cloud, used only
where it reports it is available: Grace reads the lines aloud, and the
Talk step can be tried. The
record survives a restart, unlike the conversation. Which email accounts
exist, and how one is connected, is the accounts model's; whether the cloud
account is signed in and usable is the cloud connection's; her name is the
memory model's Name fact. Set-up only hears each of them. Pace and text size
stay the preferences model's: a set-up answer there is the same preview and
acknowledged save that Settings uses.

## Story: Set up my tablet

> As an older adult with a new tablet, I want a few plain questions that get
> it ready for me, that I can put off, and that pick up where I left them.

### Set-up has an ordered list of steps and a current one

Each step is pending, done (answered, or already true) or put off with Not
now. The facts are what the host reports: whether this build owns
Wi-Fi (the launcher does, the standalone app does not), whether the tablet
is online, whether an email account is connected, whether the cloud account
is signed in and usable (signed in, and not needing attention), whether she
has a saved name, and whether cloud speech is available. Grace can think
only while an email account is connected, the cloud account is usable and
the tablet is online. The hand-over is the place after the last step, where
set-up is ending.

```quint
import preferences as P from "./preferences"
type SetupStage = WifiStep | AccountStep | NameStep | PaceStep | TextSizeStep | ExplainStep | TalkStep | TypeStep | CloseStep | ReopenStep | HandOverStep
type SetupPhase = Unstarted | Answering | Away | Ending | EndFailed | Ended
type SetupFacts = { ownsWifi: bool, online: bool, accountConnected: bool, cloudUsable: bool, named: bool, speechAvailable: bool }
type StepOutcome = Pending | Done | PutOff
type SetupProgress = { step: SetupStage, outcomes: int -> StepOutcome }
type Setup = { phase: SetupPhase, progress: SetupProgress, facts: SetupFacts, wentAway: bool, endToken: int, graceAccount: GraceAccount, tabletSignIn: TabletSignIn, googleLink: GoogleLink }
type SetupEffect = | AskWhatToDo
type SetupResult = { state: Setup, out: List[SetupEffect] }
pure val allSetupSteps: List[SetupStage] = List(WifiStep, AccountStep, NameStep, PaceStep, TextSizeStep, ExplainStep, TalkStep, TypeStep, CloseStep, ReopenStep, HandOverStep)
pure def orderOf(st: SetupStage): int =
  if (st == WifiStep) 0 else if (st == AccountStep) 1 else if (st == NameStep) 2 else if (st == PaceStep) 3
  else if (st == TextSizeStep) 4 else if (st == ExplainStep) 5 else if (st == TalkStep) 6 else if (st == TypeStep) 7
  else if (st == CloseStep) 8 else if (st == ReopenStep) 9 else 10
pure def nextStep(st: SetupStage): SetupStage =
  if (st == WifiStep) AccountStep else if (st == AccountStep) NameStep else if (st == NameStep) PaceStep
  else if (st == PaceStep) TextSizeStep else if (st == TextSizeStep) ExplainStep else if (st == ExplainStep) TalkStep
  else if (st == TalkStep) TypeStep else if (st == TypeStep) CloseStep else if (st == CloseStep) ReopenStep else HandOverStep
pure val noFacts: SetupFacts = { ownsWifi: false, online: false, accountConnected: false, cloudUsable: false, named: false, speechAvailable: false }
pure def graceThinks(f: SetupFacts): bool = f.accountConnected and f.cloudUsable and f.online
pure def outcomeOf(p: SetupProgress, st: SetupStage): StepOutcome = p.outcomes.getOr(orderOf(st), Pending)
pure def withOutcome(p: SetupProgress, st: SetupStage, answered: bool): int -> StepOutcome = p.outcomes.put(orderOf(st), outcomeFor(answered))
pure def outcomeFor(answered: bool): StepOutcome = if (answered) Done else PutOff
```

### A new tablet starts in set-up

Nothing is answered yet and set-up has not ended. The first screen is the
start screen, waiting for the host to report its facts; set-up's own pages
show from that report on.

```quint
pure val initial: Setup = {
  phase: Unstarted, progress: { step: WifiStep, outcomes: Map() },
  facts: noFacts, wentAway: false, endToken: 0, graceAccount: CheckingAccount, tabletSignIn: NoTabletSignIn, googleLink: GoogleLinkUnknown
}
pure def showsSetUp(s: Setup): bool = s.phase == Answering or s.phase == Ending or s.phase == EndFailed
```

### A step whose outcome is already true is passed

Wi-Fi is passed when the tablet is online, or when this build does not own
Wi-Fi (the standalone app, where an offline tablet is pointed to the
system's own settings). The account step is passed when an email account is
connected, and the name step when she has a saved name. A step put off with
Not now is cleared the moment its outcome comes true: coming online clears a
put-off Wi-Fi step. Passing never goes beyond the name step, and never
repeats a finished step.

```quint
pure def passes(st: SetupStage, f: SetupFacts): bool =
  if (st == WifiStep) not(f.ownsWifi) or f.online
  else if (st == AccountStep) f.accountConnected
  else if (st == NameStep) f.named
  else false
pure def passOne(p: SetupProgress, st: SetupStage, f: SetupFacts): SetupProgress =
  if (passes(st, f) and (p.step == st or outcomeOf(p, st) == PutOff))
    { step: if (p.step == st) nextStep(st) else p.step, outcomes: withOutcome(p, st, true) }
  else p
pure def settledProgress(p: SetupProgress, f: SetupFacts): SetupProgress =
  passOne(passOne(passOne(p, WifiStep, f), AccountStep, f), NameStep, f)
```

### Once started, the current step is never one already true

Discovered by the proof: without it, nothing showed that Not now on the
account step happens only while no account is connected, so a put-off
account could have stood beside a connected one.

```quint
pure def alwaysTheCurrentStepIsNotAlreadyTrue(s: Setup): bool =
  s.phase != Unstarted implies not(passes(s.progress.step, s.facts))
```

### The launcher and the standalone app differ only in the Wi-Fi step

The standalone app shows one step fewer, and its progress count says so.

```quint
pure def lawFlavorsDifferOnlyInWifi(st: SetupStage, online: bool, connected: bool, named: bool): bool =
  st != WifiStep implies
    passes(st, { ...noFacts, ownsWifi: true, online: online, accountConnected: connected, named: named }) ==
    passes(st, { ...noFacts, ownsWifi: false, online: online, accountConnected: connected, named: named })
```

### The progress count fits the steps of this build

Set-up shows "Step n of m", where m counts every step but the hand-over,
less Wi-Fi on a build that does not own it, since that build never has a
Wi-Fi step. On a build that has the step, a step passed because it was
already true still counts, so the number only goes up within a run: a
launcher tablet already online opens on "Step 2 of 10".

```quint
pure def shownStepCount(f: SetupFacts): int = if (f.ownsWifi) 10 else 9
pure def progressNumber(s: Setup): int = if (s.facts.ownsWifi) orderOf(s.progress.step) + 1 else orderOf(s.progress.step)
pure def alwaysTheCountFitsTheStepsShown(s: Setup): bool =
  (s.phase == Answering) implies (1 <= progressNumber(s) and progressNumber(s) <= shownStepCount(s.facts))
```

### The host's report starts set-up, and a restart keeps the step

The host reports at every cold start whether it owns Wi-Fi, whether the
tablet is online, whether an email account is connected and whether she has
a saved name. The first report shows the first step not already true. After
a restart set-up is where it was: the same step, unless its outcome came
true meanwhile, and still on Home if she was there. Whether the cloud
account is usable and whether speech is available are unknown until they
are reported again, so an end that was being saved, or whose save failed,
is not known to be kept: she is on Home, and Carry on setting up saves it
again once Grace can think.

```quint
pure def withFacts(f: SetupFacts, s: Setup): Setup =
  val stops = (s.phase == Ending or s.phase == EndFailed) and not(graceThinks(f))
  { ...s, facts: f, progress: settledProgress(s.progress, f),
    phase: if (stops) Away else s.phase, wentAway: s.wentAway or stops }
pure def hostStarted(s: Setup, ownsWifi: bool, online: bool, connected: bool, named: bool): Setup =
  val t = withFacts({ ownsWifi: ownsWifi, online: online, accountConnected: connected, cloudUsable: false, named: named, speechAvailable: false }, s)
  { ...t, phase: if (s.phase == Unstarted) Answering else t.phase }
pure def stepRestartKeepsTheStep(before: Setup, via: str, after: Setup): bool =
  via == "hostStarted" implies
    (after.progress.step == before.progress.step or passes(before.progress.step, after.facts))
```

### Connectivity, the accounts, her name and speech are facts reported to set-up

Set-up does not connect anything itself. The Wi-Fi page, the accounts
model, the cloud connection, the memory model and cloud speech do; set-up
hears that the tablet came online or went offline, that an email account
was connected or removed, that the cloud account became usable or stopped
being usable, that her name was saved or deleted, and that speech became
available or stopped. It hears nothing before the host's first report,
since until then it cannot know whether this build owns Wi-Fi. If Grace
stops being able to think while the end is being saved, or after a failed
save, she is taken to Home, where set-up waits.

```quint
pure def canConnectivityChanged(s: Setup, online: bool): bool = s.phase != Unstarted
pure def connectivityChanged(s: Setup, online: bool): Setup = withFacts({ ...s.facts, online: online }, s)
pure def canAccountChanged(s: Setup, connected: bool): bool = s.phase != Unstarted
pure def accountChanged(s: Setup, connected: bool): Setup = withFacts({ ...s.facts, accountConnected: connected }, s)
pure def canCloudChanged(s: Setup, usable: bool): bool = s.phase != Unstarted
pure def cloudChanged(s: Setup, usable: bool): Setup = withFacts({ ...s.facts, cloudUsable: usable }, s)
pure def canNameChanged(s: Setup, named: bool): bool = s.phase != Unstarted
pure def nameChanged(s: Setup, named: bool): Setup = withFacts({ ...s.facts, named: named }, s)
pure def canSpeechChanged(s: Setup, available: bool): bool = s.phase != Unstarted
pure def speechChanged(s: Setup, available: bool): Setup = { ...s, facts: { ...s.facts, speechAvailable: available } }
```

### Within a run, a step advances only on its own answer, a skip, or its outcome coming true

Pace, text size, the explanation of what Grace does and the four practice
steps are answered by their own control: the shell sends the pace and text
size answers only once the preferences store acknowledges the choice (a
choice equal to the current setting needs no save and is answered at once),
Talk when she has spoken once, Type when she has sent a typed line, Close
when she has closed Grace's window, and Reopen when she has brought it back
with Ask Grace. The explanation says in one sentence what Grace does, and
that while the microphone is on her voice goes to the cloud to be
understood and Grace's replies come back from it to be spoken. In the Close
step, closing Grace's window is her answer; it does not leave set-up. A tap anywhere else, or an
answer meant for another step, is refused. The name step is answered by the
memory model saving her name. Answering the last step reaches the hand-over
and, while Grace can think, asks the store to keep that set-up has ended;
otherwise she goes to Home, where set-up waits. Within a run the step never
goes back; only Run set-up again starts over.

```quint
pure def answerable(st: SetupStage): bool =
  st == PaceStep or st == TextSizeStep or st == ExplainStep or st == TalkStep or st == TypeStep or st == CloseStep or st == ReopenStep
pure def reachHandOver(q: SetupProgress, s: Setup): Setup =
  if (graceThinks(s.facts)) { ...s, progress: q, phase: Ending, endToken: s.endToken + 1 }
  else { ...s, progress: q, phase: Away, wentAway: true }
pure def moveOn(st: SetupStage, s: Setup, answered: bool): Setup =
  val onward = { step: nextStep(st), outcomes: withOutcome(s.progress, st, answered) }
  val q = settledProgress(onward, s.facts)
  if (q.step == HandOverStep) reachHandOver(q, s) else { ...s, progress: q }
pure def canAnswer(s: Setup, st: SetupStage): bool =
  s.phase == Answering and st == s.progress.step and answerable(st) and (st != TalkStep or readsAloud(s))
pure def answer(s: Setup, st: SetupStage): Setup = moveOn(st, s, true)
pure def stepOnlyItsAnswerASkipOrItsOutcomeAdvances(before: Setup, via: str, after: Setup): bool =
  after.progress.step != before.progress.step implies
    (via == "answer" or via == "skip" or via == "runAgain" or passes(before.progress.step, after.facts))
pure def stepNeverGoesBack(before: Setup, after: Setup): bool =
  before.phase != Ended implies orderOf(after.progress.step) >= orderOf(before.progress.step)
```

### Each practice step rings at most one control

The practice steps point at the control they teach with a ring: Talk at
the dock's Talk button while Grace speaks, Type at the Type button, Close at
the window's Close button and Reopen at Ask Grace in the rail. No other
step, and no step while set-up is not being answered, rings anything. While
speech is unavailable the Talk step rings nothing and says why.

```quint
type RingTarget = NoRing | RingOnTalk | RingOnType | RingOnClose | RingOnAskGrace
pure def ringOn(s: Setup): RingTarget =
  if (s.phase != Answering) NoRing
  else if (s.progress.step == TalkStep) (if (readsAloud(s)) RingOnTalk else NoRing)
  else if (s.progress.step == TypeStep) RingOnType
  else if (s.progress.step == CloseStep) RingOnClose
  else if (s.progress.step == ReopenStep) RingOnAskGrace
  else NoRing
```

### Every step but the explanation can be put off, at a stated cost, and is offered again in one place

Not now on Wi-Fi moves on, and the account step then waits for the
internet, so offline set-up stops there: her name, pace and text size come
after it. The account step offers Wi-Fi again, as the one thing it needs.
Not now on the account takes her to Home, where the browser, Settings and
the Wi-Fi page work by hand and Grace's window says she needs an account to
help; Email and Calendar stay empty. Set-up stays on Home until she taps
Carry on setting up, its one way back; once an account is connected the
account step is settled, and carrying on starts at the step after it. Not
now on the name means Grace greets her without one, and her name can be
given later in Settings. On pace or text size, the live preview is undone,
the current setting stays, and Settings has the same choice. On a practice
step, she learns it later in Grace's own window, where the control still
works. Not now on Talk is always allowed; while speech is unavailable it is
the only way on. Not now on the last practice step reaches the hand-over as
answering it does. The explanation of what Grace does has only Next.

```quint
type SkipCost = NeedsInternet | GraceCannotHelp | GreetsWithoutName | KeepsCurrentSetting | LearnsLater | NotSkippable
type OfferedAgain = OnTheAccountStep | CarryOnSettingUp | InSettings | InGracesWindow | NotOffered
pure def skipCost(st: SetupStage): SkipCost =
  if (st == WifiStep) NeedsInternet else if (st == AccountStep) GraceCannotHelp
  else if (st == NameStep) GreetsWithoutName else if (st == PaceStep or st == TextSizeStep) KeepsCurrentSetting
  else if (st == TalkStep or st == TypeStep or st == CloseStep or st == ReopenStep) LearnsLater else NotSkippable
pure def offeredAgain(st: SetupStage): OfferedAgain =
  if (st == WifiStep) OnTheAccountStep else if (st == AccountStep) CarryOnSettingUp
  else if (st == NameStep or st == PaceStep or st == TextSizeStep) InSettings
  else if (st == TalkStep or st == TypeStep or st == CloseStep or st == ReopenStep) InGracesWindow else NotOffered
pure def canSkip(s: Setup, st: SetupStage): bool = s.phase == Answering and st == s.progress.step and skipCost(st) != NotSkippable
pure def skip(s: Setup, st: SetupStage): Setup =
  if (st == AccountStep)
    { ...s, phase: Away, wentAway: true, progress: { ...s.progress, outcomes: withOutcome(s.progress, st, false) } }
  else moveOn(st, s, false)
pure def accountPutOff(s: Setup): bool = outcomeOf(s.progress, AccountStep) == PutOff
pure def lawEveryPutOffStepIsOfferedAgain(st: SetupStage): bool =
  (skipCost(st) == NotSkippable) == (offeredAgain(st) == NotOffered)
```

### Set-up never passes the account step without an account

Nothing claims Grace can help before she can think and speak. The account
step says plainly what connecting lets Grace do: read her email and
calendar to help her, and send an email, move one to Trash or change an
event only when she says so. An account put off is still missing, and
set-up is still at its step; while the account step is current it is never
yet done.

```quint
pure def stepAccountIsPassedOnlyWithAnAccount(before: Setup, after: Setup): bool =
  (before.progress.step == AccountStep and after.progress.step != AccountStep) implies after.facts.accountConnected
pure def alwaysPutOffAccountIsStillMissing(s: Setup): bool =
  accountPutOff(s) implies (not(s.facts.accountConnected) and s.progress.step == AccountStep)
```

### Set-up ends only while Grace can think

The hand-over opens a conversation in which Grace must think, so it is
saved and ended only while an email account is connected, the cloud
account is usable and the tablet is online. Reaching the hand-over at any
other time leaves her on Home, which says what is missing (the internet, an
account, or an account that needs attention), and Carry on setting up comes
back when Grace can think.

```quint
pure def alwaysTheEndIsSavedOnlyWhileGraceCanThink(s: Setup): bool =
  (s.phase == Ending or s.phase == EndFailed) implies graceThinks(s.facts)
pure def stepSetUpEndsOnlyWhileGraceCanThink(before: Setup, after: Setup): bool =
  (before.phase != Ended and after.phase == Ended) implies graceThinks(after.facts)
```

### Set-up is written, and spoken only while cloud speech is available

Every step up to the account is silent text. From the name step on, while
set-up shows, Grace reads each line aloud and Talk is the dock's main
button only while Grace can think and cloud speech reports it is available; otherwise the line
stays written and Type is the main button. The Talk step is answered only
while Grace speaks, and only once she has been heard, which also needs the
microphone permission the system asks for; otherwise Not now is the way on.

```quint
pure def readsAloud(s: Setup): bool =
  showsSetUp(s) and graceThinks(s.facts) and s.facts.speechAvailable and orderOf(s.progress.step) > orderOf(AccountStep)
pure def stepTalkIsTriedOnlyWhileGraceSpeaks(before: Setup, via: str, after: Setup): bool =
  (via == "answer" and before.progress.step == TalkStep and after.progress.step != TalkStep) implies readsAloud(before)
```

### Every step before the current one is answered, put off or already true

Resuming never repeats a finished step, and no step ahead is settled early.

```quint
pure def alwaysEarlierStepsAreSettled(s: Setup): bool =
  allSetupSteps.every(st =>
    if (orderOf(st) < orderOf(s.progress.step)) outcomeOf(s.progress, st) != Pending
    else if (st == s.progress.step and st == AccountStep) outcomeOf(s.progress, st) != Done
    else outcomeOf(s.progress, st) == Pending)
```

### Leaving mid-way resumes at the same step

While set-up shows, it fills the screen: the rail, Home's cards and
Settings are out of reach, except Ask Grace in the rail while the Reopen
step asks for it, Grace's window opens only for the practice steps,
and only the system's volume keys work beside set-up's own page. Set-up's
own Close, Back or launcher Home take her to Home, where Carry on setting up brings her
back to the step she left. The screen sleeping and waking tells set-up
nothing, so the step is kept. An end being saved, or one whose save failed,
can be left the same way, and carrying on saves it again; at the hand-over
Carry on is offered only while Grace can think. Whether set-up has gone to
Home is kept for the run.

```quint
pure def canLeave(s: Setup): bool = showsSetUp(s)
pure def leave(s: Setup): Setup = { ...s, phase: Away, wentAway: true }
pure def canResume(s: Setup): bool = s.phase == Away and (s.progress.step != HandOverStep or graceThinks(s.facts))
pure def resume(s: Setup): Setup =
  if (s.progress.step == HandOverStep) reachHandOver(s.progress, s) else { ...s, phase: Answering }
pure def alwaysAwayMeansSetUpWentAway(s: Setup): bool = s.phase == Away implies s.wentAway
```

### Set-up ends while Grace can think and she keeps going

From any started state where Grace can think, set-up ends, as long as she
answers, puts off, carries on or retries a failed save whenever she can
and the store acknowledges a request it is given, unless Grace stops being able to think
on the way. Nothing promises the internet, the account or the cloud, so
this is the only end set-up can promise.

```quint
pure val fair_answer = "strong"
pure val fair_skip = "strong"
pure val fair_resume = "strong"
pure val fair_retryEnd = "strong"
pure val fair_endSaved = "strong"
pure def leadsToSetUpEnds(s: Setup, later: Setup): bool =
  (s.phase != Unstarted and graceThinks(s.facts)) implies (later.phase == Ended or not(graceThinks(later.facts)))
```

### Each run of set-up ends exactly once, on the store's current acknowledgement

The end is kept only when the store acknowledges the current request. Then,
and only then, set-up hands over: Grace's window opens on the ordinary
conversation with "What would you like to do?", and her answer there starts
a task. A failed save says so and offers Retry; an acknowledgement for an
earlier request is refused. Each request carries its own token, and tokens
only count up. Saving, a failed save and the end all stand at the
hand-over, which is never a question. Once ended, set-up stays ended until
she chooses Run set-up again in Settings, which starts a new run from the
first step not already true, keeping the host's facts. A run started again
ends only by walking it to the hand-over; leaving it waits on Home like any
other.

```quint
pure def canEndSaved(s: Setup, token: int): bool = s.phase == Ending and token == s.endToken
pure def endSaved(s: Setup, token: int): SetupResult = { state: { ...s, phase: Ended }, out: List(AskWhatToDo) }
pure def canEndSaveFailed(s: Setup, token: int): bool = s.phase == Ending and token == s.endToken
pure def endSaveFailed(s: Setup, token: int): Setup = { ...s, phase: EndFailed }
pure def canRetryEnd(s: Setup): bool = s.phase == EndFailed
pure def retryEnd(s: Setup): Setup = { ...s, phase: Ending, endToken: s.endToken + 1 }
pure def canRunAgain(s: Setup): bool = s.phase == Ended
pure def runAgain(s: Setup): Setup =
  { ...s, phase: Answering, wentAway: false, progress: settledProgress({ step: WifiStep, outcomes: Map() }, s.facts) }
pure def stepEachRunEndsOnce(before: Setup, after: Setup, out: List[SetupEffect]): bool =
  ((before.phase == Ended and after.phase != Ended) implies
    (after.phase == Answering and orderOf(after.progress.step) <= orderOf(PaceStep))) and
  ((out.length() > 0) iff (before.phase != Ended and after.phase == Ended))
pure def stepOnlyTheAcknowledgementEnds(before: Setup, via: str, after: Setup): bool =
  ((before.phase != Ended and after.phase == Ended) implies via == "endSaved") and after.endToken >= before.endToken
pure def alwaysEndingIsAtTheHandOver(s: Setup): bool =
  (s.phase == Ending or s.phase == EndFailed or s.phase == Ended) implies s.progress.step == HandOverStep
pure def alwaysTheHandOverIsNotAQuestion(s: Setup): bool =
  s.progress.step == HandOverStep implies s.phase != Answering and s.phase != Unstarted
pure def alwaysEndTokensCount(s: Setup): bool = s.endToken >= 0
```

### Set-up answers for pace and text size are preference previews

Set-up keeps no pace or text size of its own. Its choice is the preferences
model's preview of the current settings with only that one setting changed,
always a preview Settings itself could make.

```quint
pure def paceChoice(settings: P::DisplayPreferences, pace: P::Pace): P::DisplayPreferences = { ...settings, pace: pace }
pure def textSizeChoice(settings: P::DisplayPreferences, chosenSize: P::TextSize): P::DisplayPreferences = { ...settings, textSize: chosenSize }
pure def lawSetUpChoicesArePreferencePreviews(settings: P::DisplayPreferences, pace: P::Pace, chosenSize: P::TextSize): bool =
  val p = { ...P::initial, session: settings }
  P::validSettings(settings) implies
    (paceChoice(settings, pace) == settings or P::canPreview(p, paceChoice(settings, pace), P::PreferenceUser)) and
    (textSizeChoice(settings, chosenSize) == settings or P::canPreview(p, textSizeChoice(settings, chosenSize), P::PreferenceUser)) and
    paceChoice(settings, pace).textSize == settings.textSize and textSizeChoice(settings, chosenSize).pace == settings.pace
```

### Every way through set-up is reachable

A finished set-up, a failed save, a put-off account, a put-off Wi-Fi step,
a resumed set-up, the standalone app passing Wi-Fi, Talk tried aloud, and
set-up waiting on Home at the hand-over for Grace to be able to think are
all reachable.

```quint
pure val weight_hostStarted = 2
pure val weight_cloudChanged = 8
pure val weight_answer = 64
pure val weight_skip = 64
pure val weight_resume = 16
pure val weight_endSaved = 32
pure val weight_endSaveFailed = 32
pure val weight_retryEnd = 16
pure val weight_runAgain = 16
pure def sometimesFinished(s: Setup): bool = s.phase == Ended
pure def sometimesSaveFailed(s: Setup): bool = s.phase == EndFailed
pure def sometimesAccountPutOff(s: Setup): bool = s.phase == Away and accountPutOff(s)
pure def sometimesWifiPutOff(s: Setup): bool = outcomeOf(s.progress, WifiStep) == PutOff
pure def sometimesResumed(s: Setup): bool = s.phase == Answering and s.wentAway and orderOf(s.progress.step) > orderOf(AccountStep)
pure def sometimesStandaloneSkipsWifi(s: Setup): bool = not(s.facts.ownsWifi) and outcomeOf(s.progress, WifiStep) == Done and s.phase == Answering
pure def sometimesTalkTriedAloud(s: Setup): bool = outcomeOf(s.progress, TalkStep) == Done
pure def sometimesWaitsForGraceAtTheHandOver(s: Setup): bool = s.phase == Away and s.progress.step == HandOverStep and not(graceThinks(s.facts))
```


## Story: Sign in to Grace and manage my subscription

> As a person using Grace, I can sign in to my own Grace account, see my
> subscription, manage it with the payment provider, or sign out from Settings.

### Subscription actions belong to the Grace account that is signed in

Settings opens Account even without a network connection. The device uses
the Grace service's authenticated account and subscription response. An
account from another service, a checkout return, or a browser tab's sign-in
does not establish a Grace session or an active subscription. If the check
fails, or the web account's plan could not be read, offer to check again.
Account details are private to the device UI. A current subscription never
offers checkout. A previously registered customer may both manage their
account and subscribe again when the service reports checkout is available.
The web page shows the sign-in methods that the Grace service's signed-out
report lists, which only that service reports. The Android app checks its
own session and opens Grace's web account to manage the subscription. A web
session authorizes a tablet only after the person confirms the tablet
sign-in in the browser.

Each source reports through its own event. The tablet's own Grace session
reports whether this tablet is signed in, signed out, or needs to clear a
previous sign-in whose owner could not be verified because the credential
expired or the service rejected it. The Grace service's
authenticated response reports only the web account, its plan and its Google
connection; either may report that the account could not be checked. A signed-in web
account or a tablet whose acknowledged mail lease names the signed-in owner
can carry Google link state. The tablet reports the owner and a non-secret
lease version. The owner from the Google status must match before that link
can be shown. Every change to the
account shown comes from one of these two reports, each carrying only what
its source may report. Another service, a checkout return and a browser
tab's sign-in have no way to change the account, so none of them establishes
a session, and with it a plan; this is the step rule's promise, not a
separate law. A tablet asking to sign in is confirmed only by the person's
own choice, while a web account is signed in, and the confirmation holds
only while the reports name that signed-in account: any other report, even
one that the account could not be checked, asks her again. She confirms for
the account she is shown, and may confirm again for that same account while
her earlier confirmation still holds, as after a sign-in that did not
finish. She can cancel while Grace checks the account or waits for a sign-in
code. The tablet must then ask again before she can confirm. The model records
her confirmation. The browser opens the tablet's callback only when the
service's reply is the registered callback with the request's own state and
one code, the check isTheRequestsOwnReturn under "Browser approval needs an
explicit choice for the shown account". Just before it opens that callback,
the browser checks again that the same request still has her confirmation,
through tabletSignInConfirmed, so a late reply cannot reopen a cancelled
request.

A tablet signed in with its own session never offers checkout or the payment
provider: it opens Grace's web account to manage the subscription. That
Settings opens Account without a network connection is [the device
shell](./shell.md)'s "Settings and rail popovers preserve the surface
underneath": no connectivity check gates opening Settings. Nothing yet keeps
account details out of screenshots: the Settings account page marks itself
sensitive, but no code reads that marking and no rule checks it. Account settings offers to clear the old tablet
sign-in when the device reports that it needs cleanup. Until the person
confirms and the tablet reports an ordinary signed-out state, new sign-in
is unavailable. Cleanup does not verify an owner.

```quint
type GracePlan = PlanUnknown | PlanInactive | PlanInactiveBlocked | PlanActive | PlanInactiveManaged | PlanInactiveManagedCheckout | PlanActiveManaged
type TabletMailAuthority = { accountId: str, leaseVersion: str }
type MailLeaseUpgradePhase = LeaseUpgradeNotRequired | LeaseUpgradeRequired | LeaseUpgradeSignInPending | LeaseUpgradeAcknowledgmentPending | LeaseMailReady(TabletMailAuthority)
type GraceAccount = CheckingAccount | GraceDeviceSignedOut | GraceDeviceSignInNeedsCleanup | GraceDeviceSignedIn({ mailLeaseUpgrade: MailLeaseUpgradePhase }) | GraceSignedOut({ google: bool, emailCode: bool, smsCode: bool }) | AccountUnavailable | GraceSignedIn({ accountId: str, email: str, plan: GracePlan })
pure val signedInTablet: GraceAccount = GraceDeviceSignedIn({ mailLeaseUpgrade: LeaseUpgradeNotRequired })
type AccountSource = TabletSession | GraceService
type TabletSignIn = NoTabletSignIn | TabletSignInAsked | TabletSignInConfirmed({ accountId: str })
pure def mayStartCheckout(account: GraceAccount): bool = match account {
  | GraceSignedIn(info) => info.plan == PlanInactive or info.plan == PlanInactiveManagedCheckout
  | _ => false
}
pure def mayOpenBillingPortal(account: GraceAccount): bool = match account {
  | GraceSignedIn(info) => info.plan == PlanInactiveManaged or info.plan == PlanInactiveManagedCheckout or info.plan == PlanActiveManaged
  | _ => false
}
pure def reportedBy(source: AccountSource, report: GraceAccount): bool = match report {
  | GraceDeviceSignedIn(_) => source == TabletSession
  | GraceDeviceSignedOut => source == TabletSession
  | GraceDeviceSignInNeedsCleanup => source == TabletSession
  | GraceSignedIn(_) => source == GraceService
  | GraceSignedOut(_) => source == GraceService
  | AccountUnavailable => source == TabletSession or source == GraceService
  | CheckingAccount => false
}
pure def mayBeginDeviceSignIn(account: GraceAccount): bool = account == GraceDeviceSignedOut
pure def mayCleanupLegacySignIn(account: GraceAccount): bool = account == GraceDeviceSignInNeedsCleanup
pure def lawASignInNeedingCleanupCannotBeginANewSignIn(account: GraceAccount): bool =
  mayCleanupLegacySignIn(account) implies not(mayBeginDeviceSignIn(account))
pure def sometimesLegacySignInNeedsCleanup(s: Setup): bool = mayCleanupLegacySignIn(s.graceAccount)
pure def mayCheckAccountAgain(account: GraceAccount): bool = match account {
  | AccountUnavailable => true
  | GraceSignedIn(info) => info.plan == PlanUnknown
  | _ => false
}
pure def lawAFailedCheckOffersToCheckAgain(accountId: str, email: str): bool =
  mayCheckAccountAgain(AccountUnavailable) and mayCheckAccountAgain(GraceSignedIn({ accountId: accountId, email: email, plan: PlanUnknown }))
pure def managesOnTheWeb(account: GraceAccount): bool = match account {
  | GraceDeviceSignedIn(_) => true
  | _ => false
}
pure def lawATabletManagesItsSubscriptionOnTheWeb(account: GraceAccount): bool =
  managesOnTheWeb(account) implies (not(mayStartCheckout(account)) and not(mayOpenBillingPortal(account)))
pure def linkUnknown(link: GoogleLink): bool = match link {
  | GoogleLinkUnknown => true
  | _ => false
}
pure def tabletSignInAsked(t: TabletSignIn): bool = match t {
  | TabletSignInAsked => true
  | _ => false
}
pure def showsTabletSignIn(t: TabletSignIn): bool = match t {
  | NoTabletSignIn => false
  | _ => true
}
pure def webAccountId(account: GraceAccount): str = match account {
  | GraceSignedIn(person) => person.accountId
  | _ => ""
}
pure def keptTabletSignIn(t: TabletSignIn, report: GraceAccount): TabletSignIn = match t {
  | TabletSignInConfirmed(c) => if (c.accountId == webAccountId(report)) TabletSignInConfirmed({ accountId: c.accountId }) else TabletSignInAsked
  | _ => t
}
pure def leaseAccountId(mailLease: MailLeaseUpgradePhase): str = match mailLease {
  | LeaseMailReady(owner) => if (owner.leaseVersion != "") owner.accountId else ""
  | _ => ""
}
pure def tabletMailAccountId(account: GraceAccount): str = match account {
  | GraceDeviceSignedIn(tablet) => leaseAccountId(tablet.mailLeaseUpgrade)
  | _ => ""
}
pure def managedReadAccountId(account: GraceAccount): str =
  if (webAccountId(account) != "") webAccountId(account) else tabletMailAccountId(account)
pure def canReportGraceAccount(s: Setup, report: GraceAccount, link: GoogleLink): bool =
  reportedBy(TabletSession, report) and (linkUnknown(link) or tabletMailAccountId(report) != "")
pure def reportGraceAccount(s: Setup, report: GraceAccount, link: GoogleLink): Setup =
  { ...s, graceAccount: report, googleLink: link, tabletSignIn: keptTabletSignIn(s.tabletSignIn, report) }
pure def canReportGraceService(s: Setup, report: GraceAccount, link: GoogleLink): bool =
  reportedBy(GraceService, report) and (linkUnknown(link) or webAccountId(report) != "")
pure def reportGraceService(s: Setup, report: GraceAccount, link: GoogleLink): Setup =
  { ...s, graceAccount: report, googleLink: link, tabletSignIn: keptTabletSignIn(s.tabletSignIn, report) }
pure def reportTabletSignIn(s: Setup, waiting: bool): Setup = { ...s, tabletSignIn: if (waiting) TabletSignInAsked else NoTabletSignIn }
pure def canConfirmTabletSignIn(s: Setup, accountId: str): bool =
  accountId != "" and accountId == webAccountId(s.graceAccount) and (tabletSignInAsked(s.tabletSignIn) or tabletSignInConfirmed(s))
pure def confirmTabletSignIn(s: Setup, accountId: str): Setup = { ...s, tabletSignIn: TabletSignInConfirmed({ accountId: accountId }) }
pure def tabletSignInConfirmed(s: Setup): bool =
  val t = s.tabletSignIn
  match t {
    | TabletSignInConfirmed(c) => c.accountId != "" and c.accountId == webAccountId(s.graceAccount)
    | _ => false
  }
pure def alwaysATabletSignInIsConfirmedForTheSignedInAccount(s: Setup): bool =
  val t = s.tabletSignIn
  match t {
    | TabletSignInConfirmed(_) => tabletSignInConfirmed(s)
    | _ => true
  }
pure def stepOnlyThePersonConfirmsATabletSignIn(before: Setup, via: str, after: Setup): bool =
  (tabletSignInConfirmed(after) and not(tabletSignInConfirmed(before))) implies
    (via == "confirmTabletSignIn" and tabletSignInAsked(before.tabletSignIn))
pure def stepTheAccountComesOnlyFromItsOwnSource(before: Setup, via: str, after: Setup): bool =
  after.graceAccount != before.graceAccount implies
    ((via == "reportGraceAccount" and reportedBy(TabletSession, after.graceAccount)) or
     (via == "reportGraceService" and reportedBy(GraceService, after.graceAccount)))
pure def alwaysOnlyAnAuthorizedAccountCarriesAGoogleConnection(s: Setup): bool =
  linkUnknown(s.googleLink) or managedReadAccountId(s.graceAccount) != ""
pure val reportValues: Set[GraceAccount] = Set(
  CheckingAccount, GraceDeviceSignedOut, GraceDeviceSignInNeedsCleanup, signedInTablet, AccountUnavailable,
  GraceDeviceSignedIn({ mailLeaseUpgrade: LeaseUpgradeRequired }),
  GraceDeviceSignedIn({ mailLeaseUpgrade: LeaseUpgradeSignInPending }),
  GraceDeviceSignedIn({ mailLeaseUpgrade: LeaseUpgradeAcknowledgmentPending }),
  GraceDeviceSignedIn({ mailLeaseUpgrade: LeaseMailReady({ accountId: "known", leaseVersion: "first" }) }),
  GraceDeviceSignedIn({ mailLeaseUpgrade: LeaseMailReady({ accountId: "other", leaseVersion: "second" }) }),
  GraceSignedOut({ google: true, emailCode: true, smsCode: false }),
  GraceSignedIn({ accountId: "known", email: "person@example.com", plan: PlanInactive }),
  GraceSignedIn({ accountId: "known", email: "person@example.com", plan: PlanInactiveManaged }),
  GraceSignedIn({ accountId: "known", email: "person@example.com", plan: PlanInactiveManagedCheckout }),
  GraceSignedIn({ accountId: "known", email: "person@example.com", plan: PlanInactiveBlocked }),
  GraceSignedIn({ accountId: "known", email: "person@example.com", plan: PlanUnknown }),
  GraceSignedIn({ accountId: "other", email: "", plan: PlanActive }),
  GraceSignedIn({ accountId: "other", email: "", plan: PlanActiveManaged })
)
pure val accountValues: Set[GraceAccount] = reportValues
pure val accountIdValues: Set[str] = Set("", "known", "other")
pure def lawAnActivePlanDoesNotOfferCheckout(account: GraceAccount): bool =
  match account {
    | GraceSignedIn(info) => (info.plan == PlanActive or info.plan == PlanActiveManaged) implies not(mayStartCheckout(account))
    | _ => true
  }
pure def lawAReturningCustomerMayManageAndSubscribeAgain(accountId: str, email: str): bool =
  val returning = GraceSignedIn({ accountId: accountId, email: email, plan: PlanInactiveManagedCheckout })
  mayStartCheckout(returning) and mayOpenBillingPortal(returning)
```


### An enrolled tablet offers one sign-in to update mail and calendar access

A tablet with an older device credential offers sign-in again in Account.
Email and Calendar direct the owner to Account until that sign-in is done.
The owner can cancel while the browser sign-in is pending.
The tablet retains the same owner and offers no new attempt while it waits
for a device acknowledgment. When the device confirms the updated sign-in,
the prompt goes away and the tablet reads Email and Calendar with the
connection the owner already granted. The native Eliza auth package holds
the lease. A read names the same owner, current lease version and Google
grant throughout. An account or lease change clears results from the old
access. This step does not ask for new Google permissions.

```quint
pure def mayBeginMailLeaseUpgrade(account: GraceAccount): bool =
  account == GraceDeviceSignedIn({ mailLeaseUpgrade: LeaseUpgradeRequired })
pure def mayCancelMailLeaseUpgrade(account: GraceAccount): bool =
  account == GraceDeviceSignedIn({ mailLeaseUpgrade: LeaseUpgradeSignInPending })
pure def showsMailLeaseUpgrade(account: GraceAccount): bool = match account {
  | GraceDeviceSignedIn(tablet) => tablet.mailLeaseUpgrade == LeaseUpgradeRequired or
    tablet.mailLeaseUpgrade == LeaseUpgradeSignInPending or tablet.mailLeaseUpgrade == LeaseUpgradeAcknowledgmentPending
  | _ => false
}
pure def lawAMailLeaseUpgradeKeepsTheTabletSignedIn(account: GraceAccount): bool =
  showsMailLeaseUpgrade(account) implies
    (managesOnTheWeb(account) and not(mayBeginDeviceSignIn(account)))
```

### Google mail and calendar access requires separate consent for the Grace account

Grace shows Google connection controls only in a signed-in Grace web
account when the cloud reports the connector is available. The person
chooses mail, calendar or both. On a phone-only Grace account the person
names the Google address to connect. The cloud checks the confirmed Google
identity against the Grace account and discloses only the resulting connection.

```quint
type GoogleLink = GoogleLinkUnknown | GoogleLinkUnavailable | GoogleLinkReady | GoogleLinkConnected({ email: str, mail: bool, calendar: bool, grant: str, sendMail: bool, trashMail: bool, writeCalendar: bool })
pure val linkValues: Set[GoogleLink] = Set(GoogleLinkUnknown, GoogleLinkUnavailable, GoogleLinkReady, GoogleLinkConnected({ email: "person@example.com", mail: true, calendar: true, grant: "linked", sendMail: false, trashMail: false, writeCalendar: false }), GoogleLinkConnected({ email: "person@example.com", mail: true, calendar: false, grant: "linked", sendMail: true, trashMail: true, writeCalendar: false }), GoogleLinkConnected({ email: "person@example.com", mail: false, calendar: true, grant: "linked", sendMail: false, trashMail: false, writeCalendar: false }))
pure def mayOfferGoogleLink(account: GraceAccount, link: GoogleLink): bool =
  match account {
    | GraceSignedIn(_) => match link {
      | GoogleLinkReady => true
      | GoogleLinkConnected(_) => true
      | _ => false
    }
    | _ => false
  }
pure def lawLinkRequiresGraceSignIn(link: GoogleLink): bool =
  not(mayOfferGoogleLink(signedInTablet, link))
```


## Story: Read the Google mail and calendar I connected

> As a person using Grace, I can search my connected Gmail folders and browse
> my primary Google calendar by week, month or day. I can start on my tablet,
> sign in, and choose the message or appointment I want on my tablet or
> on Grace's web page.

### Managed reads show only the matching signed-in account and the capability it granted

The connected Gmail view opens in Inbox. The person can choose Sent, Drafts
or Trash and search within that folder. Inbox unread and Drafts counts come
from the connected account's provider. The calendar opens on the current
week. Changing the week, month or selected day shows appointments from the
chosen dates. Both views start with read access. A message opens into a
plain-text preview for the chosen reference, never executable HTML.
When the person opens a web address in that preview, Grace checks the selected
message’s current Gmail revision, displayed body, account and grant. A Gmail
Spam label holds the destination for a separate confirmation. A checked read
without that label releases the address on tap. An incomplete read grants no
link action. The Browser opens the released address in one new tab.
A preview carries no authority to inspect attachments, reply or forward.
The application checks the account bound to each provider result. The
tablet sends only the current authorized reads through its native Eliza
lease, and returns no response after that owner or lease changes. A
tablet's hosted handoff retains the selected view through sign-in, and
uses the browser account matching that tablet when there is a bound owner.
If the cloud reports the Google connector is unavailable, the selected
view shows that status after sign-in and offers no connection action.
On Home the signed-in web account can see the first two recently loaded Inbox
messages and the next three appointments for its current grant. The cards
open their named surfaces. If the account or grant changes, old summaries
disappear.

```quint
type ManagedReadView = ManagedEmail | ManagedCalendar
pure def mayReadManaged(account: GraceAccount, link: GoogleLink, view: ManagedReadView): bool =
  managedReadAccountId(account) != "" and match link {
    | GoogleLinkConnected(g) => (tabletMailAccountId(account) == "" or g.grant != "") and
      (if (view == ManagedEmail) g.mail else g.calendar)
    | _ => false
  }
pure def managedReadMatches(accountId: str, receiptAccountId: str, wanted: str, received: str): bool =
  accountId != "" and accountId == receiptAccountId and wanted == received
pure def lawADeviceSessionAloneDoesNotReadGoogle(link: GoogleLink, view: ManagedReadView): bool =
  not(mayReadManaged(signedInTablet, link, view))
pure def lawAManagedReadDoesNotCrossAccounts(accountId: str, receiptAccountId: str, ref: str): bool =
  accountId != receiptAccountId implies not(managedReadMatches(accountId, receiptAccountId, ref, ref))
```

### A managed draft can be sent only through the current owner grant

The person reviews the exact address, subject and draft text before sending.
A reply attaches to the selected message's thread. Its address and subject
come from the selected message and stay fixed through review.
Send requires a separate opt-in. Grace submits the confirmed draft only for the
current account and grant. A stale or uncertain attempt cannot be submitted again
as a new draft automatically.

```quint
pure def maySendManagedMail(account: GraceAccount, link: GoogleLink, accountId: str, grant: str): bool =
  match account {
    | GraceSignedIn(person) => match link {
      | GoogleLinkConnected(g) => person.accountId == accountId and g.grant == grant and grant != "" and g.mail and g.sendMail
      | _ => false
    }
    | _ => false
  }
pure def lawADeviceSessionAloneDoesNotSendGoogle(link: GoogleLink, accountId: str, grant: str): bool =
  not(maySendManagedMail(signedInTablet, link, accountId, grant))
```

### Trash and Calendar changes use the exact selected version

The owner may separately enable Trash and Undo, and appointment changes. Gmail
offers Move to Trash when the opened message still carries the Inbox label. Undo
is available only once the provider confirms moving the selected message to
Trash. Appointments are read back to the person before confirmation. For a
new weekly or monthly appointment, the review includes its frequency and
time zone. A monthly series skips months without the selected day. Edits and
removals apply to the selected version of an appointment in the primary
calendar. For a repeating appointment, the person chooses a single occurrence
or reviews and confirms the entire series separately. Grace checks provider
evidence before showing success.

A managed change requires the signed-in web account, its current grant and
the permission for that operation. Trash requires both mail and Trash
access. An appointment change requires both calendar access and permission
to change appointments. The selection check accepts only the exact,
nonempty ID and version the person reviewed, and the managed Google shell
applies it twice, when it stages the proposal and again before sending.
A message is offered for Trash only with its version, and that version is
empty unless the opened message is outside the Trash folder, carries the
Inbox label and does not carry the Trash label, so no other message can be
selected for Trash.

A whole-series change opens review only while the occurrence that asked
for the series is still selected and its series is the one under review.
A new appointment carries no selected ID or version, so it cannot change an
existing item, and its receipt must name the item this operation made.
Before showing success, Grace checks that the provider receipt names the
same account, item and operation. Undo is built only from a Trash receipt
that passed that check, and it names that receipt's operation as the one it
reverses: the managed Google shell keeps the receipt with the mailbox it shows,
through a change of folder or another page, until that Undo is confirmed, and
sends an Undo only for the message, the version and the operation that receipt
names, so without a confirmed move to Trash there is nothing to undo. The Undo
button is drawn from that kept receipt, so the page never offers an Undo the
shell would refuse.

An appointment change is read back before it is sent: the review the person
sees is the change itself, held by the managed Google shell, and Grace sends
only the change that is under review, with the same item, version, series,
frequency, time zone and details. A repeating appointment can be under
review only as a new appointment that names its time zone, so the review
shows both its frequency and its time zone. A change to the entire series
names the occurrence that asked for it, so a review of one occurrence never
sends a change to its series, and a series change needs a review of its own.
The review of a new monthly series warns that months are skipped exactly
when its day is past the 28th, since every month has its first 28 days and
some lack the 29th, 30th or 31st.

Grace names no calendar in a change and checks no calendar in its receipt:
the hosted service reads and changes only the primary calendar, and it, not
a rule here, computes the series and checks that Google saved the frequency
and time zone. No rule in this spec checks that the calendar is the primary
one. The local mailbox and calendar have their own rules for the same steps:
"Only an authorized current selection can begin a provider mutation" in
[Email item](./emailItem.md), and in [Calendar](./calendar.md) and
[Calendar view](./calendarView.md) "Recurrence creates another occurrence
rather than changing an existing identity", "Saving a repeating event
updates its whole series through the same form", "The deletion question
binds its selected occurrence and explicit scope", "Grace's deletion takes
effect only for the occurrence and scope the person agreed to" and "A
provider's create receipt names the saved occurrence".

```quint
type ManagedChange = ManagedTrash | ManagedAppointmentChange
pure def mayChangeManaged(account: GraceAccount, link: GoogleLink, accountId: str, grant: str, request: ManagedChange): bool =
  match account {
    | GraceSignedIn(person) => match link {
      | GoogleLinkConnected(g) => person.accountId == accountId and g.grant == grant and grant != "" and
        (if (request == ManagedTrash) g.mail and g.trashMail else g.calendar and g.writeCalendar)
      | _ => false
    }
    | _ => false
  }
pure def isSelectedVersion(selectedId: str, selectedVersion: str, id: str, version: str): bool =
  id != "" and version != "" and id == selectedId and version == selectedVersion
pure def lawOnlyTheSelectedVersionIsChanged(selectedId: str, selectedVersion: str, id: str, version: str): bool =
  (isSelectedVersion(selectedId, selectedVersion, selectedId, selectedVersion) == (selectedId != "" and selectedVersion != "")) and
  (isSelectedVersion(selectedId, selectedVersion, id, version) implies (id == selectedId and version == selectedVersion))
pure def trashableVersion(inTrashFolder: bool, inboxLabel: bool, trashLabel: bool, version: str): str =
  if (not(inTrashFolder) and inboxLabel and not(trashLabel)) version else ""
pure def lawOnlyAnInboxMessageOutsideTrashCanBeSelectedForTrash(inTrashFolder: bool, inboxLabel: bool, trashLabel: bool, id: str, version: str): bool =
  isSelectedVersion(id, trashableVersion(inTrashFolder, inboxLabel, trashLabel, version), id, version) implies
    (not(inTrashFolder) and inboxLabel and not(trashLabel) and version != "")
pure def isTheSelectedSeries(selectedId: str, selectedSeriesId: str, seriesFor: str, seriesId: str): bool =
  seriesFor != "" and selectedId == seriesFor and selectedSeriesId != "" and selectedSeriesId == seriesId
pure def lawASeriesChangeNeedsItsOccurrenceStillSelected(selectedId: str, selectedSeriesId: str, seriesFor: str, seriesId: str): bool =
  isTheSelectedSeries(selectedId, selectedSeriesId, seriesFor, seriesId) implies
    (seriesFor != "" and seriesFor == selectedId and seriesId != "" and seriesId == selectedSeriesId)
type AppointmentReview = { id: str, version: str, seriesFor: str, frequency: str, timeZone: str, details: str }
pure def isAReviewableAppointment(review: AppointmentReview): bool =
  review.details != "" and (review.frequency == "" or (review.id == "" and review.timeZone != ""))
pure def isTheReviewedAppointment(reviewed: AppointmentReview, sent: AppointmentReview): bool =
  reviewed.id == sent.id and reviewed.version == sent.version and reviewed.seriesFor == sent.seriesFor and
  reviewed.frequency == sent.frequency and reviewed.timeZone == sent.timeZone and
  reviewed.details == sent.details and isAReviewableAppointment(reviewed)
pure val appointmentReviewSample: AppointmentReview = { id: "", version: "", seriesFor: "", frequency: "Weekly", timeZone: "Europe/Paris", details: "Lunch" }
pure val reviewedValues: Set[AppointmentReview] = Set(appointmentReviewSample)
  .union(Set({ ...appointmentReviewSample, timeZone: "" }))
  .union(Set({ ...appointmentReviewSample, frequency: "Monthly" }))
  .union(Set({ ...appointmentReviewSample, details: "Dentist" }))
  .union(Set({ ...appointmentReviewSample, id: "visit", version: "v1", frequency: "", timeZone: "" }))
  .union(Set({ ...appointmentReviewSample, id: "visit", version: "v1" }))
  .union(Set({ ...appointmentReviewSample, id: "series", version: "v1", seriesFor: "visit", frequency: "", timeZone: "" }))
pure val sentValues: Set[AppointmentReview] = reviewedValues
pure def lawARepeatingAppointmentIsSentWithTheFrequencyAndTimeZoneItsReviewShowed(reviewed: AppointmentReview, sent: AppointmentReview): bool =
  (isTheReviewedAppointment(reviewed, sent) and sent.frequency != "") implies
    (sent.frequency == reviewed.frequency and sent.timeZone == reviewed.timeZone and sent.timeZone != "" and sent.id == "")
pure def lawASeriesChangeNeedsAReviewOfTheSeries(reviewed: AppointmentReview, sent: AppointmentReview): bool =
  (reviewed.seriesFor != sent.seriesFor or reviewed.id != sent.id or reviewed.version != sent.version or reviewed.details != sent.details) implies
    not(isTheReviewedAppointment(reviewed, sent))
pure val shortestMonthDays = 28
pure def skipsMonthsWithoutItsDay(frequency: str, dayOfMonth: int): bool =
  frequency == "Monthly" and dayOfMonth > shortestMonthDays
pure val frequencyValues: Set[str] = Set("", "Weekly", "Monthly")
pure val dayOfMonthValues: Set[int] = Set(1, 28, 29, 30, 31)
pure def lawAMonthlySeriesWarnsOnlyWhenSomeMonthLacksItsDay(frequency: str, dayOfMonth: int): bool =
  (dayOfMonth >= 1 and dayOfMonth <= 31) implies
    (skipsMonthsWithoutItsDay(frequency, dayOfMonth) == (frequency == "Monthly" and dayOfMonth >= 29))
pure def changeReceiptMatches(accountId: str, receiptAccountId: str, itemId: str, receiptItemId: str, operation: str, receiptOperation: str): bool =
  managedReadMatches(accountId, receiptAccountId, itemId, receiptItemId) and operation != "" and operation == receiptOperation
pure def lawAChangeReceiptNamesTheSameAccountItemAndOperation(accountId: str, receiptAccountId: str, itemId: str, receiptItemId: str, operation: str, receiptOperation: str): bool =
  changeReceiptMatches(accountId, receiptAccountId, itemId, receiptItemId, operation, receiptOperation) implies
    (accountId != "" and accountId == receiptAccountId and itemId == receiptItemId and operation != "" and operation == receiptOperation)
pure def undoesTheTrashReceipt(trashedId: str, trashedVersion: str, trashOperation: str, id: str, version: str, prior: str): bool =
  trashOperation != "" and prior == trashOperation and isSelectedVersion(trashedId, trashedVersion, id, version)
pure def lawUndoReversesOnlyTheConfirmedMoveToTrash(trashedId: str, trashedVersion: str, trashOperation: str, id: str, version: str, prior: str): bool =
  not(undoesTheTrashReceipt(trashedId, trashedVersion, "", id, version, prior)) and
  ((prior != trashOperation or id != trashedId or version != trashedVersion) implies
    not(undoesTheTrashReceipt(trashedId, trashedVersion, trashOperation, id, version, prior)))
pure def grantOf(link: GoogleLink): str = match link {
  | GoogleLinkConnected(g) => g.grant
  | _ => ""
}
pure def lawAManagedChangeNeedsItsAccountItsGrantAndItsOwnPermission(account: GraceAccount, link: GoogleLink, accountId: str, grant: str, request: ManagedChange): bool =
  not(mayChangeManaged(signedInTablet, link, accountId, grant, request)) and
  (mayChangeManaged(account, link, accountId, grant, request) implies
    (grant != "" and webAccountId(account) == accountId and grantOf(link) == grant and match link {
      | GoogleLinkConnected(g) => if (request == ManagedTrash) (g.mail and g.trashMail) else (g.calendar and g.writeCalendar)
      | _ => false
    }))
```

## Story: Approve a password backup in my browser

> As the person using a Grace Cloud tablet, I can see which account is
> approving my request in the browser, finish sign-in if needed, and choose
> whether Grace should continue with the requested backup action.

### Browser approval needs an explicit choice for the shown account

Standalone Grace Cloud opens its own registered approval page in a
browser. The page shows one requested action and the account that will
approve it. Approve sends that account and action together. If the browser
account changes or needs fresh sign-in, the person uses one of that
deployment's available sign-in methods and chooses again. Cancel closes
the approval. The tablet exchanges the single-use return code for the
registered native request's device grant. Only a completed, verified
exchange supplies browser approval to the native recovery operation.
The recovery key and passwords stay in the native vault and its protected
screens.

The rules below take the page registration, the freshness of the sign-in and
the match to the shown account as inputs. All three must hold to offer
Approve. Counting the action as approved also requires the person's explicit
confirmation, which is her tap on Approve. A request is registered only when
it names the registered page and carries no field beyond the registered
ones, so a request cannot add a field for the recovery key or a password:
the browser counts the fields the registered request does not have, and
isARegisteredRequest admits a request only when that count is zero and the
request names the registered page.
The page does not inspect the values of the registered fields. The service
reports a stale sign-in or a changed account when it receives the action and
shown account together.

The browser follows a return, for a backup approval and for a tablet
sign-in, only to the registered callback, with exactly one state that is the
request's own and exactly one well-formed code. Cancel clears the saved request, so no later
sign-in return resumes it, as "Google sign-in can resume only a pending
browser approval" below requires. Binding the approval to the original
native request and its single use are mayUsePasswordBackupGrant and
consumePasswordBackupGrant under "A grant can be used once for the current
request". That only a completed, verified and unexpired exchange yields an
approval the native operation can use is exchangedApprovalIsUsable there.

```quint
pure def isARegisteredRequest(namesTheRegisteredPage: bool, unregisteredFields: int): bool =
  namesTheRegisteredPage and unregisteredFields == 0
pure def lawARequestWithAnUnregisteredFieldIsNotRegistered(namesTheRegisteredPage: bool, unregisteredFields: int): bool =
  not(isARegisteredRequest(false, unregisteredFields)) and
  (unregisteredFields != 0 implies not(isARegisteredRequest(namesTheRegisteredPage, unregisteredFields)))
pure def mayOfferBackupApproval(registered: bool, recentSignIn: bool, sameAccount: bool): bool =
  registered and recentSignIn and sameAccount
pure def mayApprovePasswordBackup(registered: bool, recentSignIn: bool, sameAccount: bool, confirmed: bool): bool =
  mayOfferBackupApproval(registered, recentSignIn, sameAccount) and confirmed
pure def lawStaleSignInCannotApprovePasswordBackup(registered: bool, sameAccount: bool, confirmed: bool): bool =
  not(mayApprovePasswordBackup(registered, false, sameAccount, confirmed))
pure def lawOnlyApproveOnTheRegisteredPageForTheShownAccountApprovesABackup(registered: bool, recentSignIn: bool, sameAccount: bool, confirmed: bool): bool =
  not(mayApprovePasswordBackup(false, recentSignIn, sameAccount, confirmed)) and
  not(mayApprovePasswordBackup(registered, recentSignIn, sameAccount, false)) and
  not(mayApprovePasswordBackup(registered, recentSignIn, false, confirmed))
pure def isTheRequestsOwnReturn(registeredCallback: bool, ownState: bool, states: int, codes: int, wellFormedCode: bool): bool =
  registeredCallback and ownState and states == 1 and codes == 1 and wellFormedCode
pure def lawOnlyTheRegisteredCallbackWithItsOwnStateAndOneCodeReturns(registeredCallback: bool, ownState: bool, states: int, codes: int, wellFormedCode: bool): bool =
  not(isTheRequestsOwnReturn(false, ownState, states, codes, wellFormedCode)) and
  not(isTheRequestsOwnReturn(registeredCallback, false, states, codes, wellFormedCode)) and
  not(isTheRequestsOwnReturn(registeredCallback, ownState, states, codes, false)) and
  (states != 1 implies not(isTheRequestsOwnReturn(registeredCallback, ownState, states, codes, wellFormedCode))) and
  (codes != 1 implies not(isTheRequestsOwnReturn(registeredCallback, ownState, states, codes, wellFormedCode)))
```

### Google sign-in can resume only a pending browser approval

The tablet’s browser approval returns from Google to the protected approval
page. Grace takes the pending request from this browser tab once. If Google
sign-in fails or the tab has no pending request, Grace cannot resume approval.
During rollout, a pending request started before the update can finish through
the previous account return. A new request uses only the protected return.

```quint
type BrowserBackupSignInReturn = ProtectedGoogleBackupReturn | FailedGoogleBackupReturn | LegacyGoogleAccountReturn
type PendingBrowserBackupApproval = NoPendingBrowserBackupApproval | LegacyPendingBrowserBackupApproval | ProtectedPendingBrowserBackupApproval
pure def mayResumeSavedBackupApproval(signInReturn: BrowserBackupSignInReturn, savedApproval: PendingBrowserBackupApproval): bool =
  match signInReturn {
    | ProtectedGoogleBackupReturn => savedApproval != NoPendingBrowserBackupApproval
    | FailedGoogleBackupReturn => false
    | LegacyGoogleAccountReturn => savedApproval == LegacyPendingBrowserBackupApproval
  }
pure def lawGoogleFailureDoesNotResumeBackup(savedApproval: PendingBrowserBackupApproval): bool =
  not(mayResumeSavedBackupApproval(FailedGoogleBackupReturn, savedApproval))
pure def lawUsedGoogleBackupReturnCannotResumeAgain(signInReturn: BrowserBackupSignInReturn): bool =
  not(mayResumeSavedBackupApproval(signInReturn, NoPendingBrowserBackupApproval))
pure def lawNewBackupCannotResumeOnOrdinaryAccountReturn(savedApproval: PendingBrowserBackupApproval): bool =
  savedApproval == ProtectedPendingBrowserBackupApproval implies not(mayResumeSavedBackupApproval(LegacyGoogleAccountReturn, savedApproval))
```

## Story: Keep my passwords private when the tablet account changes

> I can keep passwords on my own tablet, and I can choose to link them to my verified Grace account. Signing out closes private controls. Another account on this tablet cannot read or adopt the passwords I linked.

### Only the device-only profile or the current verified owner can open the vault

An anonymous device profile can open an unbound vault. A verified account opens a bound vault only for the same account, with the same current credential generation in the same deployment environment. A tablet with ambiguous active credentials closes the vault until it has one acknowledged account on its selected deployment. Pending sign-in, an expired credential, unreadable storage, and the separate legacy vault identity all close the vault. Switching accounts closes active edits, reveals and fill requests.

```quint
type PasswordCustody = DevicePasswordCustody | BoundPasswordCustody({ scope: str, generationId: str })
type PasswordAccount = DevicePasswordAccount | InactivePasswordAccount | ActivePasswordAccount({ scope: str, credentialId: str })
pure val passwordAccountValues: Set[PasswordAccount] = Set(
  DevicePasswordAccount, InactivePasswordAccount,
  ActivePasswordAccount({ scope: "current-owner", credentialId: "current-generation" }),
  ActivePasswordAccount({ scope: "other-owner", credentialId: "current-generation" }),
  ActivePasswordAccount({ scope: "current-owner", credentialId: "other-generation" }),
  ActivePasswordAccount({ scope: "current-owner", credentialId: "" }))
pure val custodyValues: Set[PasswordCustody] = Set(
  DevicePasswordCustody,
  BoundPasswordCustody({ scope: "current-owner", generationId: "current-generation" }),
  BoundPasswordCustody({ scope: "", generationId: "current-generation" }),
  BoundPasswordCustody({ scope: "current-owner", generationId: "" }))
pure def passwordAdmission(custody: PasswordCustody, passwordAccount: PasswordAccount): bool =
  match custody {
    | DevicePasswordCustody => match passwordAccount { | DevicePasswordAccount => true | _ => false }
    | BoundPasswordCustody(owner) => match passwordAccount {
        | ActivePasswordAccount(active) => owner.scope != "" and owner.scope == active.scope and owner.generationId != "" and owner.generationId == active.credentialId
        | _ => false
      }
  }
pure def lawAnotherScopeCannotOpenBoundPasswords(scope: str, other: str, generationId: str): bool =
  scope != other implies not(passwordAdmission(BoundPasswordCustody({ scope: scope, generationId: generationId }),
    ActivePasswordAccount({ scope: other, credentialId: generationId })))
pure def lawSignedOutCannotOpenBoundPasswords(scope: str, generationId: str): bool =
  not(passwordAdmission(BoundPasswordCustody({ scope: scope, generationId: generationId }), DevicePasswordAccount))
```

### Linking local passwords requires account verification and the person's approval

The host verifies the current account and product scope before binding the current credential generation. Linking existing device-only entries additionally requires confirmation from the person after device authentication. The same owner may verify a renewed credential. A different owner cannot take over this vault.

```quint
pure def mayBindPasswords(custody: PasswordCustody, verifiedScope: str, activeId: str, hasEntries: bool, confirmedLink: bool): bool =
  verifiedScope != "" and activeId != "" and
  (match custody {
    | DevicePasswordCustody => not(hasEntries) or confirmedLink
    | BoundPasswordCustody(owner) => owner.scope == verifiedScope
  })
pure def lawCannotClaimAnotherPasswordOwner(scope: str, other: str, generationId: str): bool =
  scope != other implies not(mayBindPasswords(BoundPasswordCustody({ scope: scope, generationId: generationId }), other, generationId, true, true))
pure def lawDevicePasswordsNeedExplicitLink(scope: str, generationId: str): bool =
  not(mayBindPasswords(DevicePasswordCustody, scope, generationId, true, false))
```

## Story: Back up and recover my saved passwords

> As a tablet owner, I can save an encrypted copy of my passwords to the
> cloud deployment my tablet uses, restore them on a replacement tablet
> with my recovery key, or remove the copy from my cloud account while
> keeping the passwords on my tablet.

### A backup belongs to the signed-in owner and has its own approval

The native account host fixes one deployment for this distribution of
Grace. Either app form can use shared Eliza Cloud production or standalone
Grace Cloud production. Shared Eliza Cloud staging is for debug builds.
Grace offers Backup and recovery when exactly one acknowledged native
account on the selected deployment, the tablet's screen lock, and that
deployment's backup service are ready. An unavailable deployment leaves
the local vault available under its usual rules.

```quint
type PasswordCloudProfile = SharedElizaProduction | SharedElizaStaging | StandaloneGraceProduction
pure def passwordCloudIssuer(profile: PasswordCloudProfile): str =
  match profile {
    | SharedElizaProduction => "https://cloud.eliza.app"
    | SharedElizaStaging => "https://cloud-staging.eliza.app"
    | StandaloneGraceProduction => "https://api.graceforseniors.com"
  }
pure def passwordRecoveryOffered(profile: PasswordCloudProfile, acknowledgedAccounts: int, debugBuild: bool, screenSecure: bool, serviceReady: bool): bool =
  acknowledgedAccounts == 1 and (profile != SharedElizaStaging or debugBuild) and screenSecure and serviceReady
pure def lawAmbiguousAccountCannotOpenPasswordRecovery(profile: PasswordCloudProfile, debugBuild: bool): bool =
  not(passwordRecoveryOffered(profile, 2, debugBuild, true, true))
pure def lawProductionBuildCannotOpenStagingPasswordRecovery(screenSecure: bool, serviceReady: bool): bool =
  not(passwordRecoveryOffered(SharedElizaStaging, 1, false, screenSecure, serviceReady))
```

### Each deployment approves through its own sign-in

Each verify, save, restore or remove action starts a new approval for the
current native account. Shared Eliza Cloud asks the owner for fresh native
Google verification and for consent to the action in the native flow.
Grace uses the Eliza sign-in package to check that its registered app,
environment and callback support native backup approval. The package binds
the Google proof to the acknowledged device credential and the requested
action. The selected Google identity must resolve to the same verified
account and organization. If the registered service cannot issue this
approval, the person can still use the local vault.
Standalone Grace Cloud uses its registered browser approval and gives the
same tablet a bound device grant. A grant from either flow is usable only
in that flow's deployment.

```quint
type PasswordBackupPurpose = VerifyPasswordOwner | SavePasswordBackup | RestorePasswordBackup | DeletePasswordBackup
type PasswordBackupBinding = { profile: PasswordCloudProfile, issuer: str, registrationId: str, accountId: str, organizationId: str, generationId: str, requestId: str, purpose: PasswordBackupPurpose }
type PasswordBackupApproval = SharedNativePasswordApproval({ binding: PasswordBackupBinding }) | StandaloneBrowserPasswordApproval({ binding: PasswordBackupBinding })
pure def lawSharedBackupNeedsAdvertisedAuthority(acknowledgedAccounts: int, debugBuild: bool, screenSecure: bool): bool =
  not(passwordRecoveryOffered(SharedElizaProduction, acknowledgedAccounts, debugBuild, screenSecure, false)) and
  not(passwordRecoveryOffered(SharedElizaStaging, acknowledgedAccounts, debugBuild, screenSecure, false))
pure def mayApproveSharedPasswordBackup(freshNativeGoogle: bool, sameAccount: bool, confirmed: bool): bool =
  freshNativeGoogle and sameAccount and confirmed
pure def validPasswordBackupBinding(binding: PasswordBackupBinding): bool =
  binding.issuer == passwordCloudIssuer(binding.profile) and
  binding.registrationId != "" and binding.accountId != "" and binding.organizationId != "" and
  binding.generationId != "" and binding.requestId != ""
pure def samePasswordBackupBinding(a: PasswordBackupBinding, b: PasswordBackupBinding): bool =
  a.profile == b.profile and a.issuer == b.issuer and a.registrationId == b.registrationId and
  a.accountId == b.accountId and a.organizationId == b.organizationId and
  a.generationId == b.generationId and a.requestId == b.requestId and a.purpose == b.purpose
pure def passwordBackupApprovalMatches(approval: PasswordBackupApproval, binding: PasswordBackupBinding): bool =
  validPasswordBackupBinding(binding) and (match approval {
    | StandaloneBrowserPasswordApproval(grant) => binding.profile == StandaloneGraceProduction and samePasswordBackupBinding(grant.binding, binding)
    | SharedNativePasswordApproval(grant) => binding.profile != StandaloneGraceProduction and samePasswordBackupBinding(grant.binding, binding)
  })
pure def lawSharedCloudNeedsFreshNativeSignIn(sameAccount: bool, confirmed: bool): bool =
  not(mayApproveSharedPasswordBackup(false, sameAccount, confirmed))
pure def lawSharedConsentCannotApproveStandalone(binding: PasswordBackupBinding): bool =
  binding.profile == StandaloneGraceProduction implies
    not(passwordBackupApprovalMatches(SharedNativePasswordApproval({ binding: binding }), binding))
pure def lawStandaloneConsentCannotApproveShared(binding: PasswordBackupBinding): bool =
  binding.profile != StandaloneGraceProduction implies
    not(passwordBackupApprovalMatches(StandaloneBrowserPasswordApproval({ binding: binding }), binding))
```

### A grant can be used once for the current request

Grace captures the current verified account and the selected deployment's
registered app when it opens a unique native request. The approval must
match that deployment and canonical issuer, named app registration,
verified account and organization, sign-in generation, request, and action.
Both deployments supply the verified organization.
Grace consumes the matching approval before starting the authorized
operation. Cancel, sign-out, and replacement of the request or the account
credentials close the pending operation. A credential change also closes
the recovery screen. Later approvals for a closed operation are unusable.
Expired or unverified approval material never becomes approval evidence:
the browser's approval reaches the native operation only from an exchange
that finished, was verified and has not expired, and then only when it
matches the pending request. The native exchange in the Android app is not
generated from this rule.

```quint
type PasswordBackupRequest = PendingPasswordBackupRequest({ binding: PasswordBackupBinding }) | ClosedPasswordBackupRequest
pure def mayUsePasswordBackupGrant(pending: PasswordBackupRequest, approval: PasswordBackupApproval): bool =
  match pending {
    | PendingPasswordBackupRequest(request) => passwordBackupApprovalMatches(approval, request.binding)
    | ClosedPasswordBackupRequest => false
  }
pure def consumePasswordBackupGrant(pending: PasswordBackupRequest, approval: PasswordBackupApproval): PasswordBackupRequest =
  if (mayUsePasswordBackupGrant(pending, approval)) ClosedPasswordBackupRequest else pending
pure def cancelPasswordBackupRequest(pending: PasswordBackupRequest): PasswordBackupRequest =
  ClosedPasswordBackupRequest
pure val sharedPasswordBackupSample: PasswordBackupBinding = {
  profile: SharedElizaProduction, issuer: "https://cloud.eliza.app", registrationId: "grace",
  accountId: "owner", organizationId: "home", generationId: "active", requestId: "request", purpose: SavePasswordBackup
}
pure val standalonePasswordBackupSample: PasswordBackupBinding = {
  ...sharedPasswordBackupSample, profile: StandaloneGraceProduction, issuer: "https://api.graceforseniors.com"
}
pure val bindingValues: Set[PasswordBackupBinding] = Set(sharedPasswordBackupSample)
  .union(Set(standalonePasswordBackupSample))
  .union(Set({ ...sharedPasswordBackupSample, issuer: "https://cloud-staging.eliza.app" }))
  .union(Set({ ...sharedPasswordBackupSample, organizationId: "other-home" }))
  .union(Set({ ...standalonePasswordBackupSample, organizationId: "" }))
  .union(Set({ ...sharedPasswordBackupSample, purpose: RestorePasswordBackup }))
  .union(Set({ ...standalonePasswordBackupSample, generationId: "old" }))
pure val approvedValues: Set[PasswordBackupBinding] = bindingValues
pure val pendingValues: Set[PasswordBackupRequest] = Set(ClosedPasswordBackupRequest)
  .union(Set(PendingPasswordBackupRequest({ binding: sharedPasswordBackupSample })))
  .union(Set(PendingPasswordBackupRequest({ binding: standalonePasswordBackupSample })))
pure val approvalValues: Set[PasswordBackupApproval] = Set(SharedNativePasswordApproval({ binding: sharedPasswordBackupSample }))
  .union(Set(StandaloneBrowserPasswordApproval({ binding: standalonePasswordBackupSample })))
pure def lawPasswordBackupGrantFollowsItsBinding(binding: PasswordBackupBinding, approved: PasswordBackupBinding): bool =
  binding != approved implies
    not(mayUsePasswordBackupGrant(PendingPasswordBackupRequest({ binding: binding }), SharedNativePasswordApproval({ binding: approved }))) and
    not(mayUsePasswordBackupGrant(PendingPasswordBackupRequest({ binding: binding }), StandaloneBrowserPasswordApproval({ binding: approved })))
pure def lawPasswordBackupGrantNeedsCanonicalIssuer(binding: PasswordBackupBinding): bool =
  binding.issuer != passwordCloudIssuer(binding.profile) implies
    not(mayUsePasswordBackupGrant(PendingPasswordBackupRequest({ binding: binding }), SharedNativePasswordApproval({ binding: binding }))) and
    not(mayUsePasswordBackupGrant(PendingPasswordBackupRequest({ binding: binding }), StandaloneBrowserPasswordApproval({ binding: binding })))
pure def lawPasswordBackupGrantNeedsVerifiedOrganization(binding: PasswordBackupBinding): bool =
  binding.organizationId == "" implies
    not(mayUsePasswordBackupGrant(PendingPasswordBackupRequest({ binding: binding }), SharedNativePasswordApproval({ binding: binding }))) and
    not(mayUsePasswordBackupGrant(PendingPasswordBackupRequest({ binding: binding }), StandaloneBrowserPasswordApproval({ binding: binding })))
pure def lawMatchingPasswordBackupGrantIsUsable(binding: PasswordBackupBinding): bool =
  validPasswordBackupBinding(binding) implies
    mayUsePasswordBackupGrant(PendingPasswordBackupRequest({ binding: binding }),
      if (binding.profile == StandaloneGraceProduction) StandaloneBrowserPasswordApproval({ binding: binding })
      else SharedNativePasswordApproval({ binding: binding }))
pure def lawPasswordBackupGrantCannotBeReused(pending: PasswordBackupRequest, approval: PasswordBackupApproval): bool =
  mayUsePasswordBackupGrant(pending, approval) implies
    not(mayUsePasswordBackupGrant(consumePasswordBackupGrant(pending, approval), approval))
pure def lawCancelledPasswordBackupRequestCannotBeApproved(pending: PasswordBackupRequest, approval: PasswordBackupApproval): bool =
  not(mayUsePasswordBackupGrant(cancelPasswordBackupRequest(pending), approval))
type BackupExchange = ExchangeUnfinished | ExchangeRejected | ExchangeVerified({ binding: PasswordBackupBinding, expired: bool })
pure def exchangedApprovalIsUsable(pending: PasswordBackupRequest, exchange: BackupExchange): bool =
  match exchange {
    | ExchangeVerified(done) => not(done.expired) and mayUsePasswordBackupGrant(pending, StandaloneBrowserPasswordApproval({ binding: done.binding }))
    | _ => false
  }
pure def lawOnlyAVerifiedCurrentExchangeApprovesNativeRecovery(pending: PasswordBackupRequest, binding: PasswordBackupBinding): bool =
  not(exchangedApprovalIsUsable(pending, ExchangeUnfinished)) and
  not(exchangedApprovalIsUsable(pending, ExchangeRejected)) and
  not(exchangedApprovalIsUsable(pending, ExchangeVerified({ binding: binding, expired: true }))) and
  not(exchangedApprovalIsUsable(cancelPasswordBackupRequest(pending), ExchangeVerified({ binding: binding, expired: false }))) and
  (exchangedApprovalIsUsable(pending, ExchangeVerified({ binding: binding, expired: false })) implies
    not(exchangedApprovalIsUsable(consumePasswordBackupGrant(pending, StandaloneBrowserPasswordApproval({ binding: binding })), ExchangeVerified({ binding: binding, expired: false }))))
```

### Restore fills an empty vault after a fresh unlock

Verifying ownership, saving and restoring require a fresh Android unlock
confirmation for that operation, even when the foreground Passwords screen is already open.
Passwords and the recovery key stay in the protected native flow and are
kept out of the agent. The cloud receives only the encrypted snapshot.
Restore fills an empty vault in one step.

```quint
type RecoveryPresence = ForegroundVaultAccess | ConfirmedRecoveryUnlock | EndedRecoveryUnlock
pure def passwordRestoreAdmitted(ownerMatches: bool, presence: RecoveryPresence, recoveryKeyMatches: bool, vaultEmpty: bool): bool =
  ownerMatches and presence == ConfirmedRecoveryUnlock and recoveryKeyMatches and vaultEmpty
pure def lawPasswordRecoveryKeepsExistingVault(ownerMatches: bool, presence: RecoveryPresence, recoveryKeyMatches: bool): bool =
  not(passwordRestoreAdmitted(ownerMatches, presence, recoveryKeyMatches, false))
pure def lawStaleUnlockCannotRestorePasswords(ownerMatches: bool, recoveryKeyMatches: bool, vaultEmpty: bool): bool =
  not(passwordRestoreAdmitted(ownerMatches, EndedRecoveryUnlock, recoveryKeyMatches, vaultEmpty))
pure def lawForegroundVaultCannotAuthorizeRestore(ownerMatches: bool, recoveryKeyMatches: bool, vaultEmpty: bool): bool =
  not(passwordRestoreAdmitted(ownerMatches, ForegroundVaultAccess, recoveryKeyMatches, vaultEmpty))
```

### Removing the cloud copy keeps the tablet's passwords

A removal starts only with an approval for the current remove request.
Starting it consumes that approval and remembers the operation's binding.
The native host records the cloud copy as removed only when the selected
deployment acknowledges that operation. A refusal or an unconfirmed result
does not change the last confirmed cloud status. A reply for another
operation cannot complete the current one, and a finished operation cannot
be completed again. Every password on the tablet stays as it was.

```quint
type PasswordCloudCopy = StoredPasswordBackup | NoPasswordBackup
type PasswordStores = { tabletEntries: List[str], lastConfirmedCloudCopy: PasswordCloudCopy }
type PasswordRemoval = NoPasswordRemoval | AwaitingPasswordRemoval({ binding: PasswordBackupBinding })
type PasswordRemovalReply = { binding: PasswordBackupBinding, acknowledged: bool }
type PasswordRemovalStart = { request: PasswordBackupRequest, removal: PasswordRemoval }
type PasswordRemovalResult = { stores: PasswordStores, removal: PasswordRemoval }
pure def beginPasswordBackupRemoval(removalRequest: PasswordBackupRequest, removalApproval: PasswordBackupApproval): PasswordRemovalStart =
  val closed = { request: removalRequest, removal: NoPasswordRemoval }
  match removalRequest {
    | PendingPasswordBackupRequest(request) =>
      if (request.binding.purpose == DeletePasswordBackup and mayUsePasswordBackupGrant(removalRequest, removalApproval))
        { request: consumePasswordBackupGrant(removalRequest, removalApproval), removal: AwaitingPasswordRemoval({ binding: request.binding }) }
      else closed
    | ClosedPasswordBackupRequest => closed
  }
pure def finishPasswordBackupRemoval(stores: PasswordStores, removal: PasswordRemoval, removalReply: PasswordRemovalReply): PasswordRemovalResult =
  val unchanged = { stores: stores, removal: removal }
  match removal {
    | AwaitingPasswordRemoval(active) =>
      if (samePasswordBackupBinding(active.binding, removalReply.binding))
        { stores: if (removalReply.acknowledged) { ...stores, lastConfirmedCloudCopy: NoPasswordBackup } else stores, removal: NoPasswordRemoval }
      else unchanged
    | NoPasswordRemoval => unchanged
  }
pure val removalBindingSample: PasswordBackupBinding = { ...sharedPasswordBackupSample, purpose: DeletePasswordBackup }
pure val standaloneRemovalSample: PasswordBackupBinding = { ...standalonePasswordBackupSample, purpose: DeletePasswordBackup }
pure val storesValues: Set[PasswordStores] = Set({ tabletEntries: List(), lastConfirmedCloudCopy: StoredPasswordBackup })
  .union(Set({ tabletEntries: List("bank", "pharmacy"), lastConfirmedCloudCopy: StoredPasswordBackup }))
  .union(Set({ tabletEntries: List("bank"), lastConfirmedCloudCopy: NoPasswordBackup }))
pure val removalRequestValues: Set[PasswordBackupRequest] = pendingValues
  .union(Set(PendingPasswordBackupRequest({ binding: removalBindingSample }), PendingPasswordBackupRequest({ binding: standaloneRemovalSample })))
pure val removalApprovalValues: Set[PasswordBackupApproval] = approvalValues
  .union(Set(SharedNativePasswordApproval({ binding: removalBindingSample }), StandaloneBrowserPasswordApproval({ binding: standaloneRemovalSample })))
pure val removalValues: Set[PasswordRemoval] = Set(NoPasswordRemoval,
  AwaitingPasswordRemoval({ binding: removalBindingSample }), AwaitingPasswordRemoval({ binding: standaloneRemovalSample }))
pure val removalReplyValues: Set[PasswordRemovalReply] = Set(
  { binding: removalBindingSample, acknowledged: true }, { binding: removalBindingSample, acknowledged: false },
  { binding: standaloneRemovalSample, acknowledged: true }, { binding: standaloneRemovalSample, acknowledged: false },
  { binding: { ...removalBindingSample, requestId: "old" }, acknowledged: true })
pure def lawOnlyCurrentDeleteApprovalStartsRemoval(removalRequest: PasswordBackupRequest, removalApproval: PasswordBackupApproval): bool =
  val started = beginPasswordBackupRemoval(removalRequest, removalApproval)
  match removalRequest {
    | PendingPasswordBackupRequest(pending) =>
      if (pending.binding.purpose == DeletePasswordBackup and mayUsePasswordBackupGrant(removalRequest, removalApproval))
        started.removal == AwaitingPasswordRemoval({ binding: pending.binding }) and started.request == ClosedPasswordBackupRequest
      else started == { request: removalRequest, removal: NoPasswordRemoval }
    | ClosedPasswordBackupRequest => started == { request: removalRequest, removal: NoPasswordRemoval }
  }
pure def lawRemovingBackupKeepsTabletPasswords(stores: PasswordStores, removal: PasswordRemoval, removalReply: PasswordRemovalReply): bool =
  finishPasswordBackupRemoval(stores, removal, removalReply).stores.tabletEntries == stores.tabletEntries
pure def lawOnlyMatchingRemovalAcknowledgementClearsCopy(stores: PasswordStores, removal: PasswordRemoval, removalReply: PasswordRemovalReply): bool =
  val result = finishPasswordBackupRemoval(stores, removal, removalReply)
  match removal {
    | AwaitingPasswordRemoval(active) =>
      if (samePasswordBackupBinding(active.binding, removalReply.binding))
        result.removal == NoPasswordRemoval and result.stores.lastConfirmedCloudCopy ==
          (if (removalReply.acknowledged) NoPasswordBackup else stores.lastConfirmedCloudCopy)
      else result == { stores: stores, removal: removal }
    | NoPasswordRemoval => result == { stores: stores, removal: removal }
  }
```

# Set up a new tablet

A new tablet walks its owner through a short set-up before Home. The steps,
in order: Wi-Fi, connecting an email account (with Not now), her preferred
name, speaking pace and text size with a live preview, a short explanation
of what Grace does, trying Talk, trying Type, closing Grace, bringing her
back with Ask Grace, then Grace's own question, "What would you like to
do?". English, one voice, no language picker and no wake word.

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
type Setup = { phase: SetupPhase, progress: SetupProgress, facts: SetupFacts, wentAway: bool, endToken: int, graceAccount: GraceAccount, tabletSignIn: bool, googleLink: GoogleLink }
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
  facts: noFacts, wentAway: false, endToken: 0, graceAccount: CheckingAccount, tabletSignIn: false, googleLink: GoogleLinkUnknown
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
pure val weight_answer = 12
pure val weight_hostStarted = 2
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
fails, offer to check again. Account details are private to the device UI. A current subscription never
offers checkout. A previously registered customer may both manage their
account and subscribe again when the service reports checkout is available.
The web page shows the sign-in methods Grace offers. The Android app checks
its own session and opens Grace's web account to manage the subscription.
A web session authorizes a tablet only after the person confirms the tablet
sign-in in the browser.

```quint
type GracePlan = PlanUnknown | PlanInactive | PlanInactiveBlocked | PlanActive | PlanInactiveManaged | PlanInactiveManagedCheckout | PlanActiveManaged
type GraceAccount = CheckingAccount | GraceDeviceSignedOut | GraceDeviceSignedIn | GraceSignedOut({ google: bool, emailCode: bool, smsCode: bool }) | AccountUnavailable | GraceSignedIn({ accountId: str, email: str, plan: GracePlan })
pure def mayStartCheckout(account: GraceAccount): bool = match account {
  | GraceSignedIn(info) => info.plan == PlanInactive or info.plan == PlanInactiveManagedCheckout
  | _ => false
}
pure def mayOpenBillingPortal(account: GraceAccount): bool = match account {
  | GraceSignedIn(info) => info.plan == PlanInactiveManaged or info.plan == PlanInactiveManagedCheckout or info.plan == PlanActiveManaged
  | _ => false
}
pure def reportGraceAccount(s: Setup, report: GraceAccount, link: GoogleLink): Setup = { ...s, graceAccount: report, googleLink: link }
pure def reportTabletSignIn(s: Setup, waiting: bool): Setup = { ...s, tabletSignIn: waiting }
pure val reportValues: Set[GraceAccount] = Set(
  CheckingAccount, GraceDeviceSignedOut, GraceDeviceSignedIn, AccountUnavailable,
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
pure def lawAnActivePlanDoesNotOfferCheckout(account: GraceAccount): bool =
  match account {
    | GraceSignedIn(info) => (info.plan == PlanActive or info.plan == PlanActiveManaged) implies not(mayStartCheckout(account))
    | _ => true
  }
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
  not(mayOfferGoogleLink(GraceDeviceSignedIn, link))
```


## Story: Read the Google mail and calendar I connected

> As a person using Grace, I can open my managed Google inbox or upcoming
> calendar in Grace, including when I start from the tablet and sign in on
> Grace's web page. I choose the message or appointment I want to open.

### Managed reads show only the matching signed-in account and the capability it granted

The hosted read views show the Inbox and upcoming primary calendar, with
read access by default. A message opens into a
plain-text preview for the chosen reference, never executable HTML.
A preview carries no authority to inspect attachments, reply or forward.
The application checks the account bound to each provider result. A
tablet's hosted handoff retains the selected view through sign-in, and
uses the browser account matching that tablet when there is a bound owner.
On Home the signed-in web account can see the first two recently loaded Inbox
messages and the next three appointments for its current grant. The cards
open their named surfaces. If the account or grant changes, old summaries
disappear.

```quint
type ManagedReadView = ManagedEmail | ManagedCalendar
pure def mayReadManaged(account: GraceAccount, link: GoogleLink, view: ManagedReadView): bool =
  match account {
    | GraceSignedIn(_) => match link {
      | GoogleLinkConnected(g) => if (view == ManagedEmail) g.mail else g.calendar
      | _ => false
    }
    | _ => false
  }
pure def managedReadMatches(accountId: str, receiptAccountId: str, wanted: str, received: str): bool =
  accountId != "" and accountId == receiptAccountId and wanted == received
pure def lawADeviceSessionAloneDoesNotReadGoogle(link: GoogleLink, view: ManagedReadView): bool =
  not(mayReadManaged(GraceDeviceSignedIn, link, view))
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
  not(maySendManagedMail(GraceDeviceSignedIn, link, accountId, grant))
```

### Trash and Calendar changes use the exact selected version

The owner may separately enable Trash and Undo, and appointment changes. Undo
is available only once the provider confirms moving the selected message to
Trash. Appointments are read back to the person before confirmation. For a
new weekly or monthly appointment, the review includes its frequency and
time zone. A monthly series skips months without the selected day. Edits and
removals apply to the selected version of an appointment in the primary
calendar. For a repeating appointment, the person chooses a single occurrence
or reviews and confirms the entire series separately. Grace checks provider
evidence before showing success.

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
```

## Story: Approve a password backup in my browser

> As the person using Grace Passwords on my tablet, I can see which Grace
> account is approving my request, finish sign-in if needed, and choose
> whether Grace should continue with the requested backup action.

### Browser approval needs an explicit choice for the shown account

Grace opens its registered Cloud approval page in a browser. The page shows
one requested action and the account that will approve it. Approve sends
that account and action together. If the browser account changes or needs
fresh sign-in, the person uses one of the deployment's available account
sign-in methods and chooses again. Cancel closes the
approval without issuing it. The return to the tablet carries a single-use
code bound to the native request. The browser never handles the recovery
key or password data.

```quint
pure def mayApprovePasswordBackup(registered: bool, recentSignIn: bool, sameAccount: bool, confirmed: bool): bool =
  registered and recentSignIn and sameAccount and confirmed
```

## Story: Keep my passwords private when the tablet account changes

> I can keep passwords on my own tablet, and I can choose to link them to my verified Grace account. Signing out closes private controls. Another account on this tablet cannot read or adopt the passwords I linked.

### Only the device-only profile or the current verified owner can open the vault

An anonymous device profile can open an unbound vault. A verified account opens a bound vault only with the same current credential generation in the same deployment environment. A debug tablet with two active environments must choose one account before opening the vault. Pending sign-in, an expired credential, unreadable storage, and the separate legacy vault identity all close the vault. Switching accounts closes active edits, reveals and fill requests.

```quint
type PasswordCustody = DevicePasswordCustody | BoundPasswordCustody({ scope: str, generationId: str })
type PasswordAccount = DevicePasswordAccount | InactivePasswordAccount | ActivePasswordAccount({ credentialId: str })
pure def passwordAdmission(custody: PasswordCustody, account: PasswordAccount): bool =
  match custody {
    | DevicePasswordCustody => match account { | DevicePasswordAccount => true | _ => false }
    | BoundPasswordCustody(owner) => match account {
        | ActivePasswordAccount(active) => owner.scope != "" and owner.generationId != "" and owner.generationId == active.credentialId
        | _ => false
      }
  }
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

> As a tablet owner, I can choose to save an encrypted copy of my passwords,
> restore it on a replacement tablet with my recovery key, or remove it
> from my cloud account.

### A backup belongs to the signed-in owner and has its own approval

Grace offers Backup and recovery when exactly one acknowledged native
account, its screen lock and that account’s backup service are ready.
Production is available in every build. Staging is available only in a
debug build. A credential change closes the recovery screen and ends its
pending operation. Each operation needs the same signed-in account
and a new native account confirmation. Verifying ownership, saving and
restoring require a fresh tablet unlock. A tablet with saved passwords asks
the owner before linking those passwords to the account. The recovery key stays in a protected native screen,
and Grace sends only the encrypted snapshot. Restore fills an empty vault
in one step. Removing a cloud copy leaves local passwords available.

```quint
pure def passwordRecoveryOffered(acknowledgedAccounts: int, debugBuild: bool, staging: bool, screenSecure: bool, serviceReady: bool): bool =
  acknowledgedAccounts == 1 and (not(staging) or debugBuild) and screenSecure and serviceReady
pure def lawAmbiguousAccountCannotOpenPasswordRecovery(debugBuild: bool, staging: bool): bool =
  not(passwordRecoveryOffered(2, debugBuild, staging, true, true))
pure def lawProductionBuildCannotOpenStagingPasswordRecovery(screenSecure: bool, serviceReady: bool): bool =
  not(passwordRecoveryOffered(1, false, true, screenSecure, serviceReady))
pure def passwordRestoreAdmitted(ownerMatches: bool, freshUnlock: bool, recoveryKeyMatches: bool, vaultEmpty: bool): bool =
  ownerMatches and freshUnlock and recoveryKeyMatches and vaultEmpty
pure def lawPasswordRecoveryKeepsExistingVault(ownerMatches: bool, freshUnlock: bool, recoveryKeyMatches: bool): bool =
  not(passwordRestoreAdmitted(ownerMatches, freshUnlock, recoveryKeyMatches, false))
```

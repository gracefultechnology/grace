# Set up a new tablet

A new tablet walks its owner through a short set-up before Home. The steps,
in order: Wi-Fi, connecting an email account (with Not now), her preferred
name, speaking pace and text size with a live preview, one sentence on what
Grace does, trying Talk, trying Type, closing Grace and bringing her back,
then Grace's own question, "What would you like to do?". English, one voice,
no language picker and no wake word.

This follows PRD ONB-01 to ONB-03 (`prototype/prd.md:923–927`). The owner
changed three things since: Wi-Fi comes first on the launcher tablet,
because thinking and speech run in the cloud; the account step comes before
anything spoken, because the cloud account behind speech and reasoning rides
on it, so Not now there leaves Grace unable to answer; and the closing
question hands over to the ordinary conversation, where her answer starts a
task, instead of being a step of set-up.

Set-up is its own record, not a conversation. Until the account is
connected nothing can think or speak, so every step before the hand-over is
fixed written text answered by a tap or by typing, and nothing here asks for
reasoning or speech. The record survives a restart, unlike the
conversation. Which accounts exist, and how one is connected, is the
accounts model's; set-up only hears that one was connected. Pace and text
size stay the preferences model's: a set-up answer there is the same preview
and acknowledged save that Settings uses.

## Story: Set up my tablet

> As an older adult with a new tablet, I want a few plain questions that get
> it ready for me, that I can put off, and that pick up where I left them.

### Set-up has an ordered list of steps and a current one

Each step is pending, done (answered, or already true) or put off with Not
now. The facts are what the host reports: whether this build owns
Wi-Fi (the launcher does, the standalone app does not), whether the tablet
is online, and whether an email account is connected. The hand-over is the
place after the last step, where set-up is ending.

```quint
import preferences as P from "./preferences"
type SetupStep = WifiStep | AccountStep | NameStep | PaceStep | TextSizeStep | ExplainStep | TalkStep | TypeStep | CloseStep | HandOverStep
type SetupPhase = Unstarted | Answering | Away | Ending | EndFailed | Ended
type SetupFacts = { ownsWifi: bool, online: bool, accountConnected: bool }
type StepOutcome = Pending | Done | PutOff
type SetupProgress = { step: SetupStep, outcomes: SetupStep -> StepOutcome }
type Setup = { phase: SetupPhase, progress: SetupProgress, facts: SetupFacts, name: str, left: bool, endToken: int }
type SetupEffect = | AskWhatToDo
type SetupResult = { state: Setup, out: List[SetupEffect] }
pure val allSetupSteps: List[SetupStep] = List(WifiStep, AccountStep, NameStep, PaceStep, TextSizeStep, ExplainStep, TalkStep, TypeStep, CloseStep, HandOverStep)
pure def orderOf(st: SetupStep): int =
  if (st == WifiStep) 0 else if (st == AccountStep) 1 else if (st == NameStep) 2 else if (st == PaceStep) 3
  else if (st == TextSizeStep) 4 else if (st == ExplainStep) 5 else if (st == TalkStep) 6 else if (st == TypeStep) 7
  else if (st == CloseStep) 8 else 9
pure def nextStep(st: SetupStep): SetupStep =
  if (st == WifiStep) AccountStep else if (st == AccountStep) NameStep else if (st == NameStep) PaceStep
  else if (st == PaceStep) TextSizeStep else if (st == TextSizeStep) ExplainStep else if (st == ExplainStep) TalkStep
  else if (st == TalkStep) TypeStep else if (st == TypeStep) CloseStep else HandOverStep
pure val noFacts: SetupFacts = { ownsWifi: false, online: false, accountConnected: false }
pure def outcomeOf(p: SetupProgress, st: SetupStep): StepOutcome = p.outcomes.getOr(st, Pending)
pure def outcomeFor(answered: bool): StepOutcome = if (answered) Done else PutOff
```

### A new tablet starts in set-up

Nothing is answered yet and set-up has not ended. The first screen waits
for the host to report its facts.

```quint
pure val initial: Setup = {
  phase: Unstarted, progress: { step: WifiStep, outcomes: Map() },
  facts: noFacts, name: "", left: false, endToken: 0
}
pure def showsSetUp(s: Setup): bool = s.phase == Answering or s.phase == Ending or s.phase == EndFailed
```

### A step whose outcome is already true is passed

Wi-Fi is passed when the tablet is online, or when this build does not own
Wi-Fi (the standalone app, where an offline tablet is pointed to the
system's own settings). The account step is passed when an account is
connected, and the name step when she has given a name. A step put off with
Not now is cleared the moment its outcome comes true: coming online clears a
put-off Wi-Fi step. Passing never goes beyond the name step, and never
repeats a finished step.

```quint
pure def passes(st: SetupStep, f: SetupFacts, name: str): bool =
  if (st == WifiStep) not(f.ownsWifi) or f.online
  else if (st == AccountStep) f.accountConnected
  else if (st == NameStep) name != ""
  else false
pure def passOne(p: SetupProgress, st: SetupStep, f: SetupFacts, name: str): SetupProgress =
  if (passes(st, f, name) and (p.step == st or outcomeOf(p, st) == PutOff))
    { step: if (p.step == st) nextStep(st) else p.step, outcomes: p.outcomes.put(st, outcomeFor(true)) }
  else p
pure def settledProgress(p: SetupProgress, f: SetupFacts, name: str): SetupProgress =
  passOne(passOne(passOne(p, WifiStep, f, name), AccountStep, f, name), NameStep, f, name)
```

### Once started, the current step is never one already true

Discovered by the proof: without it, nothing showed that Not now on the
account step happens only while no account is connected, so a put-off
account could have stood beside a connected one.

```quint
pure def alwaysTheCurrentStepIsNotAlreadyTrue(s: Setup): bool =
  s.phase != Unstarted implies not(passes(s.progress.step, s.facts, s.name))
```

### The launcher and the standalone app differ only in the Wi-Fi step

```quint
pure def lawFlavorsDifferOnlyInWifi(st: SetupStep, online: bool, connected: bool, name: str): bool =
  st != WifiStep implies
    passes(st, { ownsWifi: true, online: online, accountConnected: connected }, name) ==
    passes(st, { ownsWifi: false, online: online, accountConnected: connected }, name)
```

### The host's report starts set-up, and a restart keeps the step

The host reports its facts at every cold start. The first report shows the
first step not already true. After a restart set-up is where it was: the
same step, unless its outcome came true meanwhile; still away if she had
left; and an end that was being saved is reported unconfirmed, so its late
acknowledgement is refused and Retry saves it again.

```quint
pure def hostStarted(s: Setup, ownsWifi: bool, online: bool, connected: bool): Setup =
  val f = { ownsWifi: ownsWifi, online: online, accountConnected: connected }
  { ...s, facts: f, progress: settledProgress(s.progress, f, s.name), endToken: s.endToken + 1,
    phase: if (s.phase == Unstarted) Answering else if (s.phase == Ending) EndFailed else s.phase }
pure def stepRestartKeepsTheStep(before: Setup, via: str, after: Setup): bool =
  via == "hostStarted" implies after.progress.step == settledProgress(before.progress, after.facts, after.name).step
```

### Connectivity and the account are facts reported to set-up

Set-up does not connect anything itself. The Wi-Fi page and the accounts
model do; set-up hears that the tablet came online or went offline, and that
an account was connected or removed. It hears nothing before the host's
first report, since until then it cannot know whether this build owns Wi-Fi.

```quint
pure def canConnectivityChanged(s: Setup, online: bool): bool = s.phase != Unstarted
pure def connectivityChanged(s: Setup, online: bool): Setup =
  val f = { ...s.facts, online: online }
  { ...s, facts: f, progress: settledProgress(s.progress, f, s.name) }
pure def canAccountChanged(s: Setup, connected: bool): bool = s.phase != Unstarted
pure def accountChanged(s: Setup, connected: bool): Setup =
  val f = { ...s.facts, accountConnected: connected }
  { ...s, facts: f, progress: settledProgress(s.progress, f, s.name) }
```

### A step advances only on its own answer, a skip, or its outcome coming true

Pace, text size, the sentence on what Grace does and the three practice
steps are answered by their own control: the shell sends the pace and text
size answers only once the preferences store acknowledges the choice, Talk
when she has spoken once, Type when she has sent a typed line, and Close
when she has closed Grace and brought her back with Ask Grace. In the Close
step the Close button is her answer, not leaving. A tap anywhere else, or an
answer meant for another step, is refused. Her name is the name step's
answer; it is never empty, and she can give it again at any time after the
host's first report. Answering the last step reaches the hand-over and asks
the store to keep that set-up has ended.

```quint
pure def answerable(st: SetupStep): bool =
  st == PaceStep or st == TextSizeStep or st == ExplainStep or st == TalkStep or st == TypeStep or st == CloseStep
pure def moveOn(st: SetupStep, s: Setup, answered: bool): Setup =
  val onward = { step: nextStep(st), outcomes: s.progress.outcomes.put(st, outcomeFor(answered)) }
  val q = settledProgress(onward, s.facts, s.name)
  if (q.step == HandOverStep) { ...s, progress: q, phase: Ending, endToken: s.endToken + 1 } else { ...s, progress: q }
pure def canAnswer(s: Setup, st: SetupStep): bool = s.phase == Answering and st == s.progress.step and answerable(st)
pure def answer(s: Setup, st: SetupStep): Setup = moveOn(st, s, true)
pure def canSetName(s: Setup, name: str): bool = s.phase != Unstarted and name != ""
pure def setName(s: Setup, name: str): Setup = { ...s, name: name, progress: settledProgress(s.progress, s.facts, name) }
pure def stepOnlyItsAnswerASkipOrItsOutcomeAdvances(before: Setup, via: str, after: Setup): bool =
  after.progress.step != before.progress.step implies
    (via == "answer" or via == "skip" or passes(before.progress.step, after.facts, after.name))
pure def stepNeverGoesBack(before: Setup, after: Setup): bool =
  orderOf(after.progress.step) >= orderOf(before.progress.step)
```

### Every step but the explanation can be put off, at a stated cost

Not now on Wi-Fi moves on, and the account step then waits for the
internet. Not now on the account takes her to Home, where the browser,
Settings and the Wi-Fi page work by hand and Grace's window says she needs
an account to help; Email and Calendar stay empty. Set-up waits at the
account step and goes on by itself once an account is connected. Not now on
the name means Grace greets her without one; on pace or text size, the
current setting stays; on a practice step, she can learn it later, and the
control still works. Not now on the last practice step reaches the hand-over
as answering it does. The one sentence on what Grace does has only Next.

```quint
type SkipCost = NeedsInternet | GraceCannotHelp | GreetsWithoutName | KeepsCurrentSetting | LearnsLater | NotSkippable
pure def skipCost(st: SetupStep): SkipCost =
  if (st == WifiStep) NeedsInternet else if (st == AccountStep) GraceCannotHelp
  else if (st == NameStep) GreetsWithoutName else if (st == PaceStep or st == TextSizeStep) KeepsCurrentSetting
  else if (st == TalkStep or st == TypeStep or st == CloseStep) LearnsLater else NotSkippable
pure def canSkip(s: Setup, st: SetupStep): bool = s.phase == Answering and st == s.progress.step and skipCost(st) != NotSkippable
pure def skip(s: Setup, st: SetupStep): Setup =
  if (st == AccountStep)
    { ...s, phase: Away, left: true, progress: { ...s.progress, outcomes: s.progress.outcomes.put(st, outcomeFor(false)) } }
  else moveOn(st, s, false)
pure def needsAccount(s: Setup): bool = outcomeOf(s.progress, AccountStep) == PutOff
```

### Set-up never passes the account step without an account

Nothing claims Grace can help before she can think and speak.

```quint
pure def stepAccountIsPassedOnlyWithAnAccount(before: Setup, after: Setup): bool =
  (before.progress.step == AccountStep and after.progress.step != AccountStep) implies after.facts.accountConnected
pure def alwaysPutOffAccountIsStillMissing(s: Setup): bool =
  needsAccount(s) implies (not(s.facts.accountConnected) and s.progress.step == AccountStep)
```

### Set-up is written, and read aloud only once the account is connected

Every step before the account is silent text. From the name step on, Grace
reads each line aloud while an account is connected; without one the line
stays written and Type stays the main button.

```quint
pure def readsAloud(s: Setup): bool = s.facts.accountConnected and orderOf(s.progress.step) > orderOf(AccountStep)
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

Close, Back or launcher Home during set-up take her to Home, where Carry on
setting up brings her back to the step she left. A failed final save can be
left the same way, and carrying on saves it again.

```quint
pure def canLeave(s: Setup): bool = s.phase == Answering or s.phase == EndFailed
pure def leave(s: Setup): Setup = { ...s, phase: Away, left: true }
pure def offersCarryOn(s: Setup): bool = s.phase == Away
pure def canResume(s: Setup): bool = s.phase == Away
pure def resume(s: Setup): Setup =
  val q = settledProgress(s.progress, s.facts, s.name)
  if (q.step == HandOverStep) { ...s, progress: q, phase: Ending, endToken: s.endToken + 1 } else { ...s, progress: q, phase: Answering }
```

### Set-up ends exactly once, on the store's current acknowledgement

The end is kept only when the store acknowledges the current request. Then,
and only then, set-up hands over: Grace's window opens on the ordinary
conversation with "What would you like to do?", and her answer there starts
a task. A failed save says so and offers Retry; an acknowledgement for an
earlier request is refused.

```quint
pure def canEndSaved(s: Setup, token: int): bool = s.phase == Ending and token == s.endToken
pure def endSaved(s: Setup, token: int): SetupResult = { state: { ...s, phase: Ended }, out: List(AskWhatToDo) }
pure def canEndSaveFailed(s: Setup, token: int): bool = s.phase == Ending and token == s.endToken
pure def endSaveFailed(s: Setup, token: int): Setup = { ...s, phase: EndFailed }
pure def canRetryEnd(s: Setup): bool = s.phase == EndFailed
pure def retryEnd(s: Setup): Setup = { ...s, phase: Ending, endToken: s.endToken + 1 }
pure def stepEndsOnce(before: Setup, after: Setup, out: List[SetupEffect]): bool =
  (before.phase == Ended implies after.phase == Ended) and
  ((out.length() > 0) iff (before.phase != Ended and after.phase == Ended))
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

### A finished set-up, a put-off account and a resumed set-up are reachable

```quint
pure val nameValues = Set("", "Margaret")
pure val weight_answer = 12
pure val weight_hostStarted = 2
pure def sometimesFinished(s: Setup): bool = s.phase == Ended
pure def sometimesAccountPutOff(s: Setup): bool = s.phase == Away and needsAccount(s)
pure def sometimesResumed(s: Setup): bool = s.phase == Answering and s.left and orderOf(s.progress.step) > orderOf(AccountStep)
pure def sometimesSaveFailed(s: Setup): bool = s.phase == EndFailed
pure def sometimesStandaloneSkipsWifi(s: Setup): bool = not(s.facts.ownsWifi) and outcomeOf(s.progress, WifiStep) == Done and s.phase == Answering
pure def sometimesWifiPutOff(s: Setup): bool = outcomeOf(s.progress, WifiStep) == PutOff
```

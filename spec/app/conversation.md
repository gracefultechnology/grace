# One conversation by voice or typing

The same transcript, draft and reading position serve the prototype's compact
and expanded Grace windows. This model owns the conversation, not website
input or payment approval. The assistant container controls whether its input
events are reachable. Sources: INT 08–11, VOICE 01–05, RESP 02/06 and the new
prototype's composer and Expand/Collapse controls. Hearing her and Grace's
voice are both Grace's cloud speech service (Cartesia, through her Eliza Cloud
account): nothing is recognised or synthesised on the tablet, so speech needs
the internet and the signed-in account. Attaching a photo or file to a chat
message is not part of the MVP.

## Story: Talk or type without losing the conversation

> As an older adult, I want to switch between talking and typing, interrupt
> Grace and read earlier messages without losing my draft or my place.

### A conversation starts ready with its microphone off

`voice` means an explicitly active, unmuted voice exchange; it permits human
barge-in while Grace speaks. `generation` identifies the current response and
speech work. The runtime authenticates `by`; an event cannot supply its own
trusted sender. Website audio is never human input. `answers` are the reply
chips Grace offered with her current question, and `interrupted` records how
much of each cut-off reply was spoken.

Every new message goes at the end of the transcript. A reader at the end
follows it; a reader of earlier messages keeps their place and sees that
something new is unread. A message is hers, Grace's, or a line saying what
Grace did. `streamed` counts the parts of the current reply that have arrived,
and `origin` says who started the current turn: the person, or the host for a
page event, a report of what was done elsewhere or Grace's opening line.

The Mic switch starts off and each exchange ends after one statement. This is
the owner's choice for the MVP and differs from the prototype, whose switch
stays on: with recognition in the cloud, an open microphone would send the
room's sound to the service for as long as Grace's window is open.

```quint
type ConversationActor = ConversationUser | ConversationRuntime
type Turn = Ready | Listening | Thinking | Speaking | Paused
type AudioOwner = HumanAudio | GraceAudio | WebsiteAudio
type MessageAuthor = HumanMessage | GraceMessage | ActionMessage
type TurnOrigin = HerRequest | PageEvent | ElsewhereReport | OpeningLine
type Message = { author: MessageAuthor, text: str }
pure val emptyHumanMessage: Message = { author: HumanMessage, text: "" }
type Interruption = { message: int, spoken: int }
type Conversation = {
  voice: bool, turn: Turn, generation: int, unusable: int,
  draft: str, draftRevision: int, messages: List[Message],
  question: bool, answers: List[str], interrupted: List[Interruption],
  atBottom: bool, unread: bool, readingPosition: int,
  streamed: int, origin: TurnOrigin
}
pure val initial: Conversation = {
  voice: false, turn: Ready, generation: 0, unusable: 0,
  draft: "", draftRevision: 0, messages: List(),
  question: false, answers: List(), interrupted: List(),
  atBottom: true, unread: false, readingPosition: 0,
  streamed: 0, origin: HerRequest
}
pure def appended(author: MessageAuthor, text: str, c: Conversation): Conversation =
  { ...c, messages: c.messages.append({ author: author, text: text }), unread: not(c.atBottom),
    readingPosition: if (c.atBottom) c.messages.length() + 1 else c.readingPosition }
```

### Talk or an enabled human wake phrase explicitly starts a voice exchange

Opening Grace, receiving a typed response, tapping an answer and moving a
window never activate the microphone. The workspace also invokes this entry
after an authenticated enabled “Hey Grace” detection, including from sleep;
that separate wake lifecycle never grants website or payment authority. No
wake detector ships in the MVP, so the [wake host](./wake.md) reports detection
unavailable and only Talk starts an exchange. Talk also deliberately resets the
consecutive unusable-speech limit and invalidates old response callbacks.

```quint
pure def canTalk(c: Conversation, by: ConversationActor): bool = by == ConversationUser
pure def talk(c: Conversation, by: ConversationActor): Conversation =
  { ...c, voice: true, turn: Listening, generation: c.generation + 1, unusable: 0 }

pure def alwaysListeningHasAnActiveExchange(c: Conversation): bool =
  c.turn == Listening implies c.voice
```

### Type and Stop listening end capture and prevent automatic reopening

Type preserves the complete unsent draft. If a submitted message is already
being answered, it keeps that pending response and receives it as text with
the mic off; changing input mode is not cancellation of the submitted message.
`quiet` is also the container's
operation when closing, pausing or leaving the visible conversation; it is
accepted from a user control or the trusted lifecycle runtime.

```quint
pure def quiet(c: Conversation, by: ConversationActor): Conversation =
  { ...c, voice: false, turn: Ready, generation: c.generation + 1 }

pure def canChooseType(c: Conversation, by: ConversationActor): bool = by == ConversationUser
pure def chooseType(c: Conversation, by: ConversationActor): Conversation =
  if (c.turn == Thinking) { ...c, voice: false } else quiet(c, by)
pure def stepTypeKeepsPendingResponse(before: Conversation, via: str, after: Conversation): bool =
  (via == "chooseType" and before.turn == Thinking) implies
    after.turn == Thinking and after.generation == before.generation and not(after.voice)

pure def canEditDraft(c: Conversation, text: str, by: ConversationActor): bool =
  by == ConversationUser and not(c.voice)
pure def editDraft(c: Conversation, text: str, by: ConversationActor): Conversation =
  { ...c, draft: text, draftRevision: c.draftRevision + 1 }
```

### Send consumes one exact draft once and never submits a website form

Send and IME Send carry the same draft revision. The first consumes it;
repeating that event is refused. Empty input stays a draft, and the view asks
for a message first. Chat messages are not browser effects or payment
approvals. Every submitted message, typed, spoken or tapped, answers and
retires the current question and its chips, and supersedes the older
generation.

```quint
pure def submitted(text: str, c: Conversation): Conversation =
  { ...appended(HumanMessage, text, c), turn: Thinking, generation: c.generation + 1,
    unusable: 0, question: false, answers: List(), streamed: 0, origin: HerRequest }
pure def canSendDraft(c: Conversation, revision: int, by: ConversationActor): bool =
  by == ConversationUser and not(c.voice) and c.draft != "" and revision == c.draftRevision
pure def sendDraft(c: Conversation, revision: int, by: ConversationActor): Conversation =
  { ...submitted(c.draft, c), draft: "", draftRevision: c.draftRevision + 1 }
```

### Only a complete human utterance can become a spoken request

Partial recognition and Grace or website audio cannot answer a question.
Receiving the complete utterance interrupts speech and supersedes the older
generation. The downstream domain must interpret every correction before
authorizing any effect; an initial streamed yes has no event here.

```quint
pure def canHear(c: Conversation, token: int, text: str, owner: AudioOwner, by: ConversationActor): bool =
  by == ConversationRuntime and c.voice and token == c.generation and
  (c.turn == Listening or c.turn == Speaking) and owner == HumanAudio and text != ""
pure def hear(c: Conversation, token: int, text: str, owner: AudioOwner, by: ConversationActor): Conversation =
  submitted(text, c)
```

### A tapped answer is one of the offered answers and preserves whether the microphone was active

An answer belongs to the current visible question and current generation, and
sends exactly the words of one chip Grace offered with it (prototype 1302–1303).
The transcript remains authoritative after its transient answer chips vanish.

```quint
pure def canChooseAnswer(c: Conversation, token: int, text: str, by: ConversationActor): bool =
  by == ConversationUser and c.question and token == c.generation and text != "" and c.answers.includes(text)
pure def chooseAnswer(c: Conversation, token: int, text: str, by: ConversationActor): Conversation =
  submitted(text, c)
```

### Responses have a written equivalent and only current callbacks change the turn

One `question` slot represents the current meaningful decision, never a queue
of unanswered questions. The language service must make `isQuestion` truthful
and ask only that decision. Every reply is written in the transcript. It is
also spoken when the person's voice output is on (`audible`), whether they
spoke or typed (prototype 1325); with voice output off it is only written.
Speaking never turns the microphone on, and a reply ends the voice exchange:
when Grace asks a question she is not listened to again until she taps Talk.
The microphone stays on while Grace speaks only so that she can be
interrupted, and closes when that reply ends. The one exception is Grace's
single request to say an unusable utterance again, which listens once more
because no statement has been heard yet.

```quint
pure def canRespond(c: Conversation, token: int, text: str, isQuestion: bool, answers: List[str], by: ConversationActor): bool =
  by == ConversationRuntime and token == c.generation and c.turn == Thinking and text != "" and
  offersAnswers(answers, isQuestion)
pure def respond(c: Conversation, token: int, text: str, isQuestion: bool, answers: List[str], audible: bool, by: ConversationActor): Conversation =
  { ...appended(GraceMessage, text, c), question: isQuestion, answers: answers,
    turn: if (audible) Speaking else Ready, voice: audible and c.voice }
pure def stepSpeakingNeverOpensTheMicrophone(before: Conversation, via: str, after: Conversation): bool =
  (via == "respond" or via == "repeatReply" or via == "resumeSpeech") implies (after.voice implies before.voice)

pure def canFinishSpeech(c: Conversation, token: int, by: ConversationActor): bool =
  by == ConversationRuntime and c.turn == Speaking and token == c.generation
pure def awaitsAStatement(c: Conversation): bool = c.voice and c.unusable > 0
pure def finishSpeech(c: Conversation, token: int, by: ConversationActor): Conversation =
  { ...c, turn: if (awaitsAStatement(c)) Listening else Ready, voice: awaitsAStatement(c) }
pure def lawTheMicrophoneClosesAfterOneStatement(c: Conversation, token: int, text: str, isQuestion: bool, answers: List[str], audible: bool, by: ConversationActor): bool =
  val replied = respond(c, token, text, isQuestion, answers, audible, by)
  val finished = finishSpeech(c, token, by)
  (canRespond(c, token, text, isQuestion, answers, by) implies
    replied.turn != Listening and (replied.voice implies replied.turn == Speaking)) and
  ((canFinishSpeech(c, token, by) and c.unusable == 0) implies not(finished.voice) and finished.turn == Ready)
```

### Answer chips come only with a closed question, two or three at a time

The prototype offers 2 to 3 chips, never 1, and only when the reply ends with
a closed question (prototype 1531). A chip for a money decision names the whole
action, such as "Yes, pay $84.20 today", never a bare "Yes"; the language
service owns that wording. An open question offers no chips.

```quint
pure def offersAnswers(answers: List[str], isQuestion: bool): bool =
  answers.length() == 0 or (isQuestion and answers.length() >= 2 and answers.length() <= 3 and answers.every(a => a != ""))
pure def alwaysAnswersBelongToTheQuestion(c: Conversation): bool =
  c.answers.length() == 0 or (c.question and offersAnswers(c.answers, true))
```

### Repeat reads the latest Grace response without turning on a muted microphone

An explicit Repeat speaks while voice output is on, even with capture off. It
ends any voice exchange, so it never opens listening at its end. It is offered
while Grace is ready or already speaking, never while she is listening or a
submitted message still awaits its reply, so it cannot fence that reply out.
The written response remains in the same transcript rather than becoming a new
answer.

```quint
pure def latestGraceText(c: Conversation): str =
  c.messages.foldl("", (latest, message) => if (message.author == GraceMessage) message.text else latest)
pure def canRepeatReply(c: Conversation, audible: bool, by: ConversationActor): bool =
  by == ConversationUser and audible and latestGraceText(c) != "" and (c.turn == Ready or c.turn == Speaking)
pure def repeatReply(c: Conversation, audible: bool, by: ConversationActor): Conversation =
  { ...c, voice: false, turn: Speaking, generation: c.generation + 1 }
pure def stepRepeatNeverOpensListening(before: Conversation, via: str, after: Conversation): bool =
  via == "repeatReply" implies not(after.voice) and after.turn == Speaking
```

### Pause stops Grace mid-sentence and Resume carries on from the same place

The header Pause stops Grace's speech and shows that she is paused; Resume
carries on from the same word (prototype 1213–1215, 1741–1744; PRD VOICE 02,
which keeps touch Pause available while muted). Both keep the generation, so
the paused reply stays current and no callback is fenced out. Pausing speech
does not stop or pause the website task; the workspace's Stop does that.

```quint
pure def canPauseSpeech(c: Conversation, by: ConversationActor): bool =
  by == ConversationUser and c.turn == Speaking
pure def pauseSpeech(c: Conversation, by: ConversationActor): Conversation = { ...c, turn: Paused }
pure def canResumeSpeech(c: Conversation, by: ConversationActor): bool =
  by == ConversationUser and c.turn == Paused
pure def resumeSpeech(c: Conversation, by: ConversationActor): Conversation = { ...c, turn: Speaking }
pure def stepPauseKeepsTheReply(before: Conversation, via: str, after: Conversation): bool =
  (via == "pauseSpeech" or via == "resumeSpeech") implies
    after.generation == before.generation and after.messages == before.messages and after.voice == before.voice
pure def sometimesSpeechPaused(c: Conversation): bool = c.turn == Paused
```

### Barge-in records how much of Grace's reply was spoken

When the person starts talking over Grace in a voice exchange, the runtime
stops her speech and reports how many words of her latest reply were spoken
(prototype 1341–1344; PRD VOICE 02 preserves delivered text). Grace keeps
listening for the complete utterance under the same generation. The written
reply stays whole; the transcript marks where she was cut off, and the
reasoning context learns which part the person did not hear.

```quint
pure def canBargeIn(c: Conversation, token: int, spoken: int, owner: AudioOwner, by: ConversationActor): bool =
  by == ConversationRuntime and c.voice and c.turn == Speaking and token == c.generation and
  owner == HumanAudio and spoken >= 0 and c.messages.length() > 0 and
  c.messages.nthOr(c.messages.length() - 1, emptyHumanMessage).author == GraceMessage
pure def bargeIn(c: Conversation, token: int, spoken: int, owner: AudioOwner, by: ConversationActor): Conversation =
  { ...c, turn: Listening, interrupted: c.interrupted.append({ message: c.messages.length() - 1, spoken: spoken }) }
pure def alwaysInterruptionsMarkMessages(c: Conversation): bool =
  c.interrupted.every(i => i.message >= 0 and i.message < c.messages.length() and i.spoken >= 0)
pure def sometimesBargedIn(c: Conversation): bool = c.interrupted.length() > 0
```

### A current speech or response failure leaves a usable typed fallback

A late failure cannot overwrite a newer turn. The runtime provides a plain
failure explanation and offers the existing Talk and Type controls; no
automatic listening or guessed answer follows.

```quint
pure def canServiceFailure(c: Conversation, token: int, text: str, by: ConversationActor): bool =
  by == ConversationRuntime and token == c.generation and text != "" and
  (c.turn == Thinking or c.turn == Speaking)
pure def serviceFailure(c: Conversation, token: int, text: str, by: ConversationActor): Conversation =
  { ...appended(GraceMessage, text, c), voice: false, turn: Ready, generation: c.generation + 1 }
```

### Silence ends listening without creating an answer

The current question and transcript remain available for a deliberate Talk,
Type or tapped response. A timeout is not consent and does not complete work.

```quint
pure def canSilence(c: Conversation, token: int, by: ConversationActor): bool =
  by == ConversationRuntime and c.turn == Listening and token == c.generation
pure def silence(c: Conversation, token: int, by: ConversationActor): Conversation = quiet(c, by)

pure def stepSilenceNeverAnswers(before: Conversation, via: str, after: Conversation): bool =
  via == "silence" implies after.messages == before.messages and after.question == before.question
```

### An unanswered wake phrase gets a notice with capture stopped

The wake timer is fenced by the current listening generation. Its explanation
is a Grace notice, never a human request or approval. The transcript receives
the same notice whether speech output is enabled or muted. The wake host may
play that notice without opening another listening exchange.

```quint
pure def canWakeSilence(c: Conversation, token: int, by: ConversationActor): bool =
  canSilence(c, token, by)
pure def wakeSilence(c: Conversation, token: int, by: ConversationActor): Conversation =
  { ...appended(GraceMessage, "I didn't hear anything. Say Hey Grace whenever you need me.", c),
    voice: false, turn: Ready, generation: c.generation + 1 }
```

### Unusable speech gets one repeat request and then stops listening

Silence, understandable ambiguity and recognition failure are distinct. The
first unusable utterance asks once; the second turns capture off and offers
the existing Talk and Type controls. No guessed request is emitted.

```quint
pure def canUnusableSpeech(c: Conversation, token: int, owner: AudioOwner, by: ConversationActor): bool =
  by == ConversationRuntime and c.voice and c.turn == Listening and
  token == c.generation and owner == HumanAudio and c.unusable < 2
pure def unusableSpeech(c: Conversation, token: int, owner: AudioOwner, by: ConversationActor): Conversation =
  { ...appended(GraceMessage,
      if (c.unusable == 0) "I didn't catch that. Could you say it again?" else "Use Type, or tap Talk to try again.", c),
    unusable: c.unusable + 1, generation: c.generation + 1,
    voice: c.unusable == 0, turn: if (c.unusable == 0) Speaking else Ready,
    question: c.unusable == 0, answers: List() }

pure def alwaysRecognitionRetriesAreBounded(c: Conversation): bool =
  c.unusable >= 0 and c.unusable <= 2 and (c.unusable == 2 implies not(c.voice))
```

### New messages do not pull the reader away from earlier messages

The position is a logical transcript position; the React shell maps it to the
actual scroll anchor. New response moves to the end only when explicitly
selected. Compact/expanded changes must reuse this same state.

```quint
pure def canReadEarlier(c: Conversation, position: int, by: ConversationActor): bool =
  by == ConversationUser and position >= 0 and position <= c.messages.length()
pure def readEarlier(c: Conversation, position: int, by: ConversationActor): Conversation =
  { ...c, atBottom: false, readingPosition: position }

pure def canReadLatest(c: Conversation, by: ConversationActor): bool = by == ConversationUser
pure def readLatest(c: Conversation, by: ConversationActor): Conversation =
  { ...c, atBottom: true, unread: false, readingPosition: c.messages.length() }

pure def alwaysReadingPositionExists(c: Conversation): bool =
  c.readingPosition >= 0 and c.readingPosition <= c.messages.length() and
  (c.atBottom implies c.readingPosition == c.messages.length() and not(c.unread))
pure def alwaysGenerationsAreNonnegative(c: Conversation): bool =
  c.generation >= 0 and c.draftRevision >= 0
pure def alwaysMessagesHaveContent(c: Conversation): bool =
  c.messages.every(m => m.text != "")
pure def stepTranscriptIsRetained(before: Conversation, via: str, after: Conversation): bool =
  via == "newConversation" or via == "purgePrivate" or (after.messages.length() >= before.messages.length() and
    before.messages.every(m => after.messages.includes(m)))
pure def stepDraftSurvivesModeChanges(before: Conversation, via: str, after: Conversation): bool =
  (via != "editDraft" and via != "sendDraft" and via != "newConversation" and via != "purgePrivate") implies
    after.draft == before.draft and after.draftRevision == before.draftRevision
pure def stepReadingIsNotPulledAway(before: Conversation, via: str, after: Conversation): bool =
  (not(before.atBottom) and via != "readEarlier" and via != "readLatest" and via != "newConversation") implies
    after.readingPosition == before.readingPosition
```

### Detected private content is removed before the conversation continues

DATA 01 requires removing an accidentally captured secret even when detected
after a message was displayed. The trusted privacy boundary identifies a
current transcript position and whether the draft is affected, without
putting the secret in an event. Removal replaces that message and any exact
copies of its text with a fixed
notice, clears an affected draft and cancels pending response, speech and
capture. Detection is external; this transition proves the removal and stale
callback fence. A stale detection must rescan the current transcript rather
than removing the same position in a different conversation. For multiple
affected entries, the adapter applies this operation successively with each
new generation before releasing the conversation for further use. Sanitized
state replaces any retained prompt/context copy; raw capture buffers and logs
are outside this model and must be scrubbed by the same privacy boundary.

```quint
pure val privateNotice = "[Private information removed]"
pure def canPurgePrivate(c: Conversation, token: int, messageIndex: int, purgeDraft: bool, by: ConversationActor): bool =
  by == ConversationRuntime and token == c.generation and
  (messageIndex == -1 or (messageIndex >= 0 and messageIndex < c.messages.length())) and
  (messageIndex >= 0 or purgeDraft)
pure def purgePrivate(c: Conversation, token: int, messageIndex: int, purgeDraft: bool, by: ConversationActor): Conversation =
  val selected = c.messages.nthOr(messageIndex, emptyHumanMessage)
  { ...c, voice: false, turn: Ready, generation: c.generation + 1, question: false, answers: List(),
    messages: c.messages.listMap(m => if (selected.text != "" and m.text == selected.text)
      { author: m.author, text: privateNotice } else m),
    draft: if (purgeDraft) "" else c.draft,
    draftRevision: if (purgeDraft) c.draftRevision + 1 else c.draftRevision }
pure def stepPrivateRemovalCancelsOutput(before: Conversation, via: str, after: Conversation): bool =
  via == "purgePrivate" implies not(after.voice) and after.turn == Ready and
    not(after.question) and after.generation > before.generation and after.messages.length() == before.messages.length()
pure def lawPrivateRemovalClearsSelectedText(c: Conversation, token: int, messageIndex: int, purgeDraft: bool, by: ConversationActor): bool =
  val selected = c.messages.nthOr(messageIndex, emptyHumanMessage)
  val after = purgePrivate(c, token, messageIndex, purgeDraft, by)
  canPurgePrivate(c, token, messageIndex, purgeDraft, by) implies
    (purgeDraft implies after.draft == "") and
    ((selected.text != "" and selected.text != privateNotice) implies after.messages.every(m => m.text != selected.text))
pure def sometimesPrivateContentRemoved(c: Conversation): bool = c.messages.some(m => m.text == privateNotice)
```

### A deliberate new conversation clears the old view but never reuses callback tokens

The containing assistant exposes this only when no unfinished task remains.
Personal memory and provider evidence do not belong to this transcript reset.
The agent keeps no conversation of its own: New conversation, a restart and
private-content removal each retire the agent-side conversation, and the next
turn starts one from this transcript.

```quint
pure def canNewConversation(c: Conversation, by: ConversationActor): bool = by == ConversationUser
pure def newConversation(c: Conversation, by: ConversationActor): Conversation =
  { ...initial, generation: c.generation + 1, draftRevision: c.draftRevision + 1 }
```

### Talking, typing, interruption and the fallback are reachable

```quint
pure def sometimesListening(c: Conversation): bool = c.turn == Listening
pure def sometimesSpeaking(c: Conversation): bool = c.turn == Speaking
pure def sometimesTypedQuestion(c: Conversation): bool = not(c.voice) and c.question
pure def sometimesUnusableFallback(c: Conversation): bool = c.unusable == 2
pure def sometimesUnreadReply(c: Conversation): bool = c.unread
pure def sometimesDraftSurvivesTalk(c: Conversation): bool = c.voice and c.draft != ""
pure def sometimesAnswersOffered(c: Conversation): bool = c.answers.length() >= 2
pure def sometimesTypedReplySpoken(c: Conversation): bool = not(c.voice) and c.turn == Speaking
```

## Story: Talk with Grace through her cloud voice

> As an older adult, I want Grace to hear me and answer aloud, to know that my
> voice goes to her cloud service, to be told plainly why she cannot talk when
> she cannot, and to see what she did for me even when I was elsewhere.

### She is told once, before her first Talk, where her voice goes

The sentence is shown before her first Talk and again in Settings. Her words
leave the tablet as she says them, so a spoken password, code or card number
has already been sent even if it is later removed from the transcript: Grace
asks for those to be typed into the website, never spoken. Reply text passes
the same private-text check before it is sent to be spoken, and recognised
words pass it before they become a message. Speech is English, in Grace's one
cloud voice.

```quint
pure val voiceDisclosure = "When you talk to Grace, your voice goes to Grace's cloud service to be understood."
```

### Only Talk opens the microphone, so her voice is sent only in an exchange she started

Talk opens one cloud speech session for its exchange, and the session closes
when the turn returns to Ready. Her audio is sent only while that exchange is
open: while Grace listens, and while Grace speaks with the microphone on so
that she can be interrupted. No reply, finished speech, failure or turn the
host starts turns the microphone on.

```quint
pure def sendsHerVoice(c: Conversation): bool = c.voice and (c.turn == Listening or c.turn == Speaking)
pure def stepOnlyTalkOpensTheMicrophone(before: Conversation, via: str, after: Conversation): bool =
  (not(before.voice) and after.voice) implies via == "talk"
```

### Listening waits eight seconds for her first word

The host reports Silence once no word has been heard for eight seconds after
listening began. The cloud service decides when a statement has ended; a
statement that continues is not cut off by this limit.

```quint
pure val firstWordLimitMs = 8000
pure def silenceDue(listeningSinceMs: int, nowMs: int): bool = nowMs - listeningSinceMs >= firstWordLimitMs
```

### Her words show as she says them and are never a request

The words heard so far are shown in the dock while she talks, for the current
exchange only. They live in the host beside the microphone level, never in the
draft or the transcript, and only the complete utterance becomes a request.

```quint
pure def showsHeardWords(c: Conversation, token: int, owner: AudioOwner): bool =
  c.voice and c.turn == Listening and token == c.generation and owner == HumanAudio
```

### Each speech failure has its own written explanation

No internet, signed out, the daily allowance reached, the service busy, a
microphone problem, a website using the microphone and sound that cannot play
each have their own sentence. Only no internet speaks of the connection; a
busy service never blames hers. A session that expires or is cancelled is a
normal end, not a failure, and tells her nothing. A website using the
microphone, such as a video visit, ends Grace's listening, so the two never
share it and words meant for the call never reach Grace.

```quint
type SpeechFailure = NoInternet | SignedOut | NoAllowance | ServiceBusy | MicrophoneProblem | WebsiteMicrophone | CannotPlay
pure def speechFailureText(failure: SpeechFailure): str = match failure {
  | NoInternet => "I can't talk while the tablet is offline. Open Wi-Fi to connect again."
  | SignedOut => "I can't talk until you sign in to your Grace account again."
  | NoAllowance => "I can't talk any more today. You can still type."
  | ServiceBusy => "My voice service is busy right now. Tap Talk to try again, or type."
  | MicrophoneProblem => "I can't use the microphone. Allow it in Settings, or type."
  | WebsiteMicrophone => "A website is using the microphone, so I've stopped listening. You can still type."
  | CannotPlay => "I can't play sound right now, so my replies stay written here."
}
pure def lawSpeechFailuresAreExplainedDistinctly(failure: SpeechFailure, other: SpeechFailure): bool =
  speechFailureText(failure) != "" and (failure != other implies speechFailureText(failure) != speechFailureText(other))
```

### A speech failure while she talks, Grace speaks, speech is paused or Grace is idle tells her and leaves Type usable

The failure ends capture and any spoken reply, and writes its explanation in
the transcript. The written reply, the draft and the current question stay.
Nothing reopens the microphone by itself. A failure while Grace is thinking is
a response failure, not a speech failure. A website using the microphone is
reported only while Grace's microphone is on; with it off there is nothing to
stop.

```quint
pure def canSpeechFailure(c: Conversation, token: int, failure: SpeechFailure, by: ConversationActor): bool =
  by == ConversationRuntime and token == c.generation and c.turn != Thinking and
  (failure == WebsiteMicrophone implies c.voice)
pure def speechFailure(c: Conversation, token: int, failure: SpeechFailure, by: ConversationActor): Conversation =
  { ...appended(GraceMessage, speechFailureText(failure), c), voice: false, turn: Ready, generation: c.generation + 1 }
pure def stepSpeechFailureStopsVoice(before: Conversation, via: str, after: Conversation): bool =
  via == "speechFailure" implies
    not(after.voice) and after.turn == Ready and after.generation > before.generation and after.question == before.question
pure def sometimesListeningEndedByFailure(c: Conversation): bool =
  not(c.voice) and c.turn == Ready and c.messages.some(m => m.text == speechFailureText(WebsiteMicrophone))
```

### A streamed reply arrives in order and ends the turn once

The parts of Grace's reply arrive one after another while she is thinking, so
the host can show them and start speaking the first sentence early. A part out
of order, or from a turn that Talk, Stop, a new message or a failure has since
superseded, is refused; choosing Type keeps the turn and its parts. The
transcript receives the whole reply once, with Respond, which ends the turn;
no part arrives after it.

```quint
pure def canReplyPart(c: Conversation, token: int, part: int, by: ConversationActor): bool =
  by == ConversationRuntime and token == c.generation and c.turn == Thinking and part == c.streamed
pure def replyPart(c: Conversation, token: int, part: int, by: ConversationActor): Conversation =
  { ...c, streamed: c.streamed + 1 }
pure def stepReplyPartsWaitForTheWholeReply(before: Conversation, via: str, after: Conversation): bool =
  via == "replyPart" implies
    after.messages == before.messages and after.turn == Thinking and after.generation == before.generation
pure def sometimesReplyStreamed(c: Conversation): bool = c.streamed >= 2 and c.turn != Thinking
```

### Grace may take a turn the person did not start, marked with where it came from

A page event, a report of what was done on another surface and Grace's
opening line start a turn that is not hers. The opening line is the
prototype's greeting by her first name, "What can I help with?", and comes
only when the transcript is empty. Such a turn adds no message in her name,
retires an open question without answering it, and starts only while Grace is
idle with the microphone off. Whether the current turn was hers is what the
request record reads.

```quint
pure def canHostTurn(c: Conversation, origin: TurnOrigin, by: ConversationActor): bool =
  by == ConversationRuntime and origin != HerRequest and c.turn == Ready and not(c.voice) and
  (origin == OpeningLine implies c.messages.length() == 0)
pure def hostTurn(c: Conversation, origin: TurnOrigin, by: ConversationActor): Conversation =
  { ...c, turn: Thinking, generation: c.generation + 1, streamed: 0, origin: origin,
    question: false, answers: List() }
pure def stepHostTurnsNeverSpeakForHer(before: Conversation, via: str, after: Conversation): bool =
  via == "hostTurn" implies after.messages == before.messages and after.origin != HerRequest and not(after.voice)
pure def sometimesOpeningLine(c: Conversation): bool =
  c.origin == OpeningLine and c.messages.length() == 1 and c.turn != Thinking
```

### What Grace did is written in the transcript, wherever it was done

When Grace adds an appointment, changes a setting or acts while another
surface is in front, a line saying what she did goes into the transcript
before her words, while she is thinking or idle. It survives a reload and is
cleared by New conversation like any message.

```quint
pure def canRecordAction(c: Conversation, text: str, by: ConversationActor): bool =
  by == ConversationRuntime and text != "" and (c.turn == Thinking or c.turn == Ready)
pure def recordAction(c: Conversation, text: str, by: ConversationActor): Conversation =
  appended(ActionMessage, text, c)
pure def sometimesActionRecorded(c: Conversation): bool = c.messages.some(m => m.author == ActionMessage)
```

### Each turn sends a bounded window of the transcript

The workspace transcript is the only conversation history. Each turn sends
its last 24 messages to the agent, which keeps no copy of its own: never more
than 24, all of them while the transcript is shorter, and always the newest.

```quint
pure val historyMessages = 24
pure def sentHistory(c: Conversation): List[Message] =
  c.messages.foldl(List(), (kept, m) => (if (kept.length() < historyMessages) kept else kept.tail()).append(m))
pure def lawHistoryWindowIsBounded(c: Conversation): bool =
  val sent = sentHistory(c)
  val count = c.messages.length()
  sent.length() == (if (count < historyMessages) count else historyMessages) and
  sent.nthOr(sent.length() - 1, emptyHumanMessage) == c.messages.nthOr(count - 1, emptyHumanMessage)
```

### A typed reply can be written and not spoken

With voice output off, a reply to a typed message is only written, and Grace
returns to Ready.

```quint
pure def sometimesReplyOnlyWritten(c: Conversation): bool =
  not(c.voice) and c.turn == Ready and c.messages.some(m => m.author == HumanMessage) and
  c.messages.nthOr(c.messages.length() - 1, emptyHumanMessage).author == GraceMessage
```

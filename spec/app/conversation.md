# One conversation by voice or typing

The same transcript, draft and reading position serve the prototype's compact
and expanded Grace windows. This model owns the conversation, not website
input or payment approval. The assistant container controls whether its input
events are reachable. Sources: INT 08–11, VOICE 01–05, RESP 02/06 and the new
prototype's composer and Expand/Collapse controls. Audio classification,
transcription and actual speech playback remain runtime obligations.

## Story: Talk or type without losing the conversation

> As an older adult, I want to switch between talking and typing, interrupt
> Grace and read earlier messages without losing my draft or my place.

### A conversation starts ready with its microphone off

`voice` means an explicitly active, unmuted voice exchange; it permits human
barge-in while Grace speaks. `generation` identifies the current response and
speech work. The runtime authenticates `by`; an event cannot supply its own
trusted sender. Website audio is never human input.

```quint
type ConversationActor = ConversationUser | ConversationRuntime
type Turn = Ready | Listening | Thinking | Speaking
type AudioOwner = HumanAudio | GraceAudio | WebsiteAudio
type MessageAuthor = HumanMessage | GraceMessage
type Message = { author: MessageAuthor, text: str }
type Conversation = {
  voice: bool, turn: Turn, generation: int, unusable: int,
  draft: str, draftRevision: int, messages: List[Message],
  question: bool, atBottom: bool, unread: bool, readingPosition: int
}
pure val initial: Conversation = {
  voice: false, turn: Ready, generation: 0, unusable: 0,
  draft: "", draftRevision: 0, messages: List(),
  question: false, atBottom: true, unread: false, readingPosition: 0
}
```

### Talk or an enabled human wake phrase explicitly starts a voice exchange

Opening Grace, receiving a typed response, tapping an answer and moving a
window never activate the microphone. The workspace also invokes this entry
after an authenticated enabled “Hey Grace” detection, including from sleep;
that separate wake lifecycle never grants website or payment authority.
Talk also deliberately resets the
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
repeating that event is refused. Empty input stays a draft and the view gives
the plain prompt returned by `sendPrompt`. Chat messages are not browser
effects or payment approvals.

```quint
pure def sendPrompt(c: Conversation): str = if (c.draft == "") "Type a message first." else ""
pure def canSendDraft(c: Conversation, revision: int, by: ConversationActor): bool =
  by == ConversationUser and not(c.voice) and c.draft != "" and revision == c.draftRevision
pure def sendDraft(c: Conversation, revision: int, by: ConversationActor): Conversation =
  { ...c, draft: "", draftRevision: c.draftRevision + 1,
    messages: c.messages.append({ author: HumanMessage, text: c.draft }),
    turn: Thinking, generation: c.generation + 1, question: false,
    unusable: 0, unread: not(c.atBottom),
    readingPosition: if (c.atBottom) c.messages.length() + 1 else c.readingPosition }
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
  { ...c, messages: c.messages.append({ author: HumanMessage, text: text }),
    turn: Thinking, generation: c.generation + 1, unusable: 0, question: false,
    unread: not(c.atBottom),
    readingPosition: if (c.atBottom) c.messages.length() + 1 else c.readingPosition }
```

### A tapped answer preserves whether the microphone was active

An answer belongs to the current visible question and current generation.
The transcript remains authoritative after its transient answer chips vanish.

```quint
pure def canChooseAnswer(c: Conversation, token: int, text: str, by: ConversationActor): bool =
  by == ConversationUser and c.question and token == c.generation and text != ""
pure def chooseAnswer(c: Conversation, token: int, text: str, by: ConversationActor): Conversation =
  { ...c, messages: c.messages.append({ author: HumanMessage, text: text }),
    turn: Thinking, generation: c.generation + 1, unusable: 0, question: false,
    unread: not(c.atBottom),
    readingPosition: if (c.atBottom) c.messages.length() + 1 else c.readingPosition }
```

### Responses have a written equivalent and only current callbacks change the turn

One `question` slot represents the current meaningful decision, never a queue
of unanswered questions. The language service must make `isQuestion` truthful
and ask only that decision. A typed exchange displays the reply with capture
off; only an active voice exchange plays it aloud.

```quint
pure def canRespond(c: Conversation, token: int, text: str, by: ConversationActor): bool =
  by == ConversationRuntime and token == c.generation and c.turn == Thinking and text != ""
pure def respond(c: Conversation, token: int, text: str, isQuestion: bool, by: ConversationActor): Conversation =
  { ...c, messages: c.messages.append({ author: GraceMessage, text: text }),
    turn: if (c.voice) Speaking else Ready, question: isQuestion,
    unread: not(c.atBottom),
    readingPosition: if (c.atBottom) c.messages.length() + 1 else c.readingPosition }

pure def canFinishSpeech(c: Conversation, token: int, by: ConversationActor): bool =
  by == ConversationRuntime and c.turn == Speaking and token == c.generation
pure def finishSpeech(c: Conversation, token: int, by: ConversationActor): Conversation =
  { ...c, turn: if (c.voice and c.question) Listening else Ready, voice: c.voice and c.question }
```

### Repeat reads the latest Grace response without turning on a muted microphone

An explicit Repeat may speak while capture is off. This is different from an
active voice exchange and never opens listening at its end. The written
response remains in the same transcript rather than becoming a new answer.

```quint
pure def latestGraceText(c: Conversation): str =
  c.messages.foldl("", (latest, message) => if (message.author == GraceMessage) message.text else latest)
pure def canRepeatReply(c: Conversation, by: ConversationActor): bool =
  by == ConversationUser and latestGraceText(c) != ""
pure def repeatReply(c: Conversation, by: ConversationActor): Conversation =
  { ...c, turn: Speaking, generation: c.generation + 1 }
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
  { ...c, voice: false, turn: Ready, generation: c.generation + 1,
    messages: c.messages.append({ author: GraceMessage, text: text }), unread: not(c.atBottom),
    readingPosition: if (c.atBottom) c.messages.length() + 1 else c.readingPosition }
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
  { ...c, voice: false, turn: Ready, generation: c.generation + 1,
    messages: c.messages.append({ author: GraceMessage, text: "I didn't hear anything. Say Hey Grace whenever you need me." }),
    unread: not(c.atBottom), readingPosition: if (c.atBottom) c.messages.length() + 1 else c.readingPosition }
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
  { ...c, unusable: c.unusable + 1, generation: c.generation + 1,
    voice: c.unusable == 0, turn: if (c.unusable == 0) Speaking else Ready,
    question: c.unusable == 0,
    messages: c.messages.append({ author: GraceMessage,
      text: if (c.unusable == 0) "I didn't catch that. Could you say it again?" else "Use Type, or tap Talk to try again." }),
    unread: not(c.atBottom),
    readingPosition: if (c.atBottom) c.messages.length() + 1 else c.readingPosition }

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
  val selected = c.messages.nthOr(messageIndex, { author: HumanMessage, text: "" })
  { ...c, voice: false, turn: Ready, generation: c.generation + 1, question: false,
    messages: c.messages.listMap(m => if (selected.text != "" and m.text == selected.text)
      { author: m.author, text: privateNotice } else m),
    draft: if (purgeDraft) "" else c.draft,
    draftRevision: if (purgeDraft) c.draftRevision + 1 else c.draftRevision }
pure def stepPrivateRemovalCancelsOutput(before: Conversation, via: str, after: Conversation): bool =
  via == "purgePrivate" implies not(after.voice) and after.turn == Ready and
    not(after.question) and after.generation > before.generation and after.messages.length() == before.messages.length()
pure def lawPrivateRemovalClearsSelectedText(c: Conversation, token: int, messageIndex: int, purgeDraft: bool, by: ConversationActor): bool =
  val selected = c.messages.nthOr(messageIndex, { author: HumanMessage, text: "" })
  val after = purgePrivate(c, token, messageIndex, purgeDraft, by)
  canPurgePrivate(c, token, messageIndex, purgeDraft, by) implies
    (purgeDraft implies after.draft == "") and
    ((selected.text != "" and selected.text != privateNotice) implies after.messages.every(m => m.text != selected.text))
pure def sometimesPrivateContentRemoved(c: Conversation): bool = c.messages.some(m => m.text == privateNotice)
```

### A deliberate new conversation clears the old view but never reuses callback tokens

The containing assistant exposes this only when no unfinished task remains.
Personal memory and provider evidence do not belong to this transcript reset.

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
```

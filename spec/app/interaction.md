# Conversation and window interactions

This is a pure dispatcher over the existing [assistant](./assistant.md).
It owns no second conversation, task, keyboard or window state. The
[workspace](./workspace.md) uses it to expose the complete conversation UI
while coordinating browser observations, payment and wake timers.

## Story: Use the same conversation through every input and window control

> As a person using Grace, I can type, speak, read, repeat and move between
> window and keyboard presentations without losing the current conversation.

### Each interaction uses the existing guarded assistant operation

User controls and trusted service results have distinct variants and retain
their original actor checks. Trusted service results come from Grace's cloud
agent and her cloud speech service; nothing is recognised or spoken by a model
on the tablet. Runtime text is never a user choice. A complete
human utterance keeps its audio provenance and current generation. Open,
Close, Talk, privacy removal, task replacement and a new conversation have
their own coordinated workspace routes. Pause and Resume act on Grace's
speech only; stopping the website task is the workspace's Stop.
Every interaction preserves the assistant's rules, including those for
visible work, current guidance, completion and conversation offers.

```quint
import assistant as A from "./assistant"
import conversation as C from "./conversation"

type Interaction = TypeIntoChat | StopVoice | ReadLatest | ShowChat | DismissKeyboard | FocusWebsite
  | PauseSpeech | ResumeSpeech | RepeatReply({ audible: bool })
  | EditDraft({ text: str }) | SendDraft({ revision: int }) | ChooseAnswer({ token: int, text: str })
  | ReadEarlier({ position: int }) | Resize({ expanded: bool })
  | Hear({ token: int, text: str, owner: C::AudioOwner })
  | BargeIn({ token: int, spoken: int, owner: C::AudioOwner })
  | Respond({ token: int, text: str, isQuestion: bool, answers: List[str], audible: bool }) | FinishSpeech({ token: int, played: bool })
  | ServiceFailure({ token: int, text: str }) | Silence({ token: int })
  | UnusableSpeech({ token: int, owner: C::AudioOwner })
  | DismissGuidance({ revision: int }) | ShowGuidance({ revision: int })

pure def canInteract(a: A::Assistant, input: Interaction, by: C::ConversationActor): bool = match input {
  | DismissGuidance(data) => A::canDismissGuidance(a, data.revision, by)
  | ShowGuidance(data) => A::canShowGuidance(a, data.revision, by)
  | TypeIntoChat => A::canChooseType(a, by)
  | StopVoice => by == C::ConversationUser and A::canQuiet(a, by)
  | EditDraft(data) => A::canEditDraft(a, data.text, by)
  | SendDraft(data) => A::canSendDraft(a, data.revision, by)
  | ChooseAnswer(data) => A::canChooseAnswer(a, data.token, data.text, by)
  | ReadEarlier(data) => A::canReadEarlier(a, data.position, by)
  | ReadLatest => A::canReadLatest(a, by)
  | RepeatReply(data) => A::canRepeatReply(a, data.audible, by)
  | PauseSpeech => A::canPauseSpeech(a, by)
  | ResumeSpeech => A::canResumeSpeech(a, by)
  | BargeIn(data) => A::canBargeIn(a, data.token, data.spoken, data.owner, by)
  | Resize(data) => A::canResize(a, data.expanded, by)
  | ShowChat => A::canShowChat(a, by)
  | DismissKeyboard => A::canDismissKeyboard(a, by)
  | FocusWebsite => A::canFocusWebsite(a, by)
  | Hear(data) => A::canHear(a, data.token, data.text, data.owner, by)
  | Respond(data) => A::canRespond(a, data.token, data.text, data.isQuestion, data.answers, by)
  | FinishSpeech(data) => A::canFinishSpeech(a, data.token, data.played, by)
  | ServiceFailure(data) => A::canServiceFailure(a, data.token, data.text, by)
  | Silence(data) => A::canSilence(a, data.token, by)
  | UnusableSpeech(data) => A::canUnusableSpeech(a, data.token, data.owner, by)
}
pure def interact(a: A::Assistant, input: Interaction, by: C::ConversationActor): A::Assistant = match input {
  | DismissGuidance(data) => A::dismissGuidance(a, data.revision, by)
  | ShowGuidance(data) => A::showGuidance(a, data.revision, by)
  | TypeIntoChat => A::chooseType(a, by)
  | StopVoice => A::quiet(a, by)
  | EditDraft(data) => A::editDraft(a, data.text, by)
  | SendDraft(data) => A::sendDraft(a, data.revision, by)
  | ChooseAnswer(data) => A::chooseAnswer(a, data.token, data.text, by)
  | ReadEarlier(data) => A::readEarlier(a, data.position, by)
  | ReadLatest => A::readLatest(a, by)
  | RepeatReply(data) => A::repeatReply(a, data.audible, by)
  | PauseSpeech => A::pauseSpeech(a, by)
  | ResumeSpeech => A::resumeSpeech(a, by)
  | BargeIn(data) => A::bargeIn(a, data.token, data.spoken, data.owner, by)
  | Resize(data) => A::resize(a, data.expanded, by)
  | ShowChat => A::showChat(a, by)
  | DismissKeyboard => A::dismissKeyboard(a, by)
  | FocusWebsite => A::focusWebsite(a, by)
  | Hear(data) => A::hear(a, data.token, data.text, data.owner, by)
  | Respond(data) => A::respond(a, data.token, data.text, data.isQuestion, data.answers, data.audible, by)
  | FinishSpeech(data) => A::finishSpeech(a, data.token, data.played, by)
  | ServiceFailure(data) => A::serviceFailure(a, data.token, data.text, by)
  | Silence(data) => A::silence(a, data.token, by)
  | UnusableSpeech(data) => A::unusableSpeech(a, data.token, data.owner, by)
}
pure def validAssistant(a: A::Assistant): bool =
  A::alwaysGraceWorksOnlyOnTheVisiblePage(a) and A::alwaysGuidanceIsNotAhead(a) and
  A::alwaysDoneMeansVerifiedCompletion(a) and A::alwaysConversationRules(a) and
  A::alwaysHiddenIsQuiet(a) and A::alwaysTaskContextExists(a) and A::alwaysOperationsBelongToWorkingTasks(a) and
  A::alwaysOnlyVerifiedEndpointsClaimCompletion(a) and A::alwaysConversationOffersAndInterruptions(a) and
  A::alwaysReplacementIsComplete(a)
pure def lawInteractionPreservesAssistant(a: A::Assistant, input: Interaction, by: C::ConversationActor): bool =
  validAssistant(a) and canInteract(a, input, by) implies validAssistant(interact(a, input, by))
```

### The workspace can distinguish new requests, changed geometry and local reading

Submitting human content supersedes prior conversational intent. Layout and
keyboard ownership alter the observed browser geometry. Draft editing and
reading alone do not submit a new request. Type must preserve an already
submitted response while muting it; stopping voice is distinct from stopping
the entire website task. Whether a reply is spoken follows the person's voice
output setting, never the host's word: `withAudible` puts that setting into a
Respond or Repeat before it is applied.

```quint
pure def needsCurrentGuidance(input: Interaction): bool = match input {
  | DismissGuidance(_) => true
  | ShowGuidance(_) => true
  | _ => false
}
pure def submitsContent(input: Interaction): bool = match input {
  | SendDraft(data) => true
  | ChooseAnswer(data) => true
  | Hear(data) => true
  | _ => false
}
pure def changesGeometry(input: Interaction): bool = match input {
  | TypeIntoChat => true
  | SendDraft(data) => true
  | Resize(data) => true
  | ShowChat => true
  | DismissKeyboard => true
  | FocusWebsite => true
  | _ => false
}
pure def needsReasoning(input: Interaction): bool = match input {
  | SendDraft(data) => true
  | ChooseAnswer(data) => true
  | Hear(data) => true
  | Respond(data) => true
  | _ => false
}
pure def targetsWebsite(input: Interaction): bool = match input {
  | FocusWebsite => true
  | _ => false
}
pure def withAudible(input: Interaction, audible: bool): Interaction = match input {
  | Respond(data) => Respond({ token: data.token, text: data.text, isQuestion: data.isQuestion, answers: data.answers, audible: audible })
  | RepeatReply(data) => RepeatReply({ audible: audible })
  | _ => input
}
pure val aValues = {
  val opened = A::open(A::initial, C::ConversationUser)
  val guided = A::publishGuidance(A::beginTask(opened, "task", "Choose the control", C::ConversationUser),
    A::exampleReport, C::ConversationRuntime)
  Set(A::initial, opened, A::talk(opened, C::ConversationUser), guided, A::dismissGuidance(guided, 1, C::ConversationUser))
}

pure val inputValues = Set(DismissGuidance({ revision: 1 }), ShowGuidance({ revision: 2 }),
  DismissGuidance({ revision: 0 }), ShowGuidance({ revision: 0 }), TypeIntoChat, StopVoice, ReadLatest, RepeatReply({ audible: true }), RepeatReply({ audible: false }),
  PauseSpeech, ResumeSpeech, ShowChat, DismissKeyboard, FocusWebsite,
  EditDraft({ text: "Hello" }), EditDraft({ text: "" }), SendDraft({ revision: 1 }), SendDraft({ revision: 0 }),
  ChooseAnswer({ token: 1, text: "Yes" }), ChooseAnswer({ token: 2, text: "Please explain" }),
  ReadEarlier({ position: 0 }), Resize({ expanded: true }), Resize({ expanded: false }),
  Hear({ token: 1, text: "Hello", owner: C::HumanAudio }), Hear({ token: 1, text: "Hello", owner: C::GraceAudio }),
  Respond({ token: 1, text: "How can I help?", isQuestion: true, answers: List(), audible: true }),
  Respond({ token: 1, text: "Shall I explain?", isQuestion: true, answers: List("Yes", "Please explain"), audible: false }),
  Respond({ token: 2, text: "Here is the explanation.", isQuestion: false, answers: List(), audible: true }),
  Respond({ token: 2, text: "Pay it?", isQuestion: true, answers: List("Yes"), audible: true }),
  BargeIn({ token: 1, spoken: 2, owner: C::HumanAudio }),
  FinishSpeech({ token: 1, played: true }), FinishSpeech({ token: 2, played: false }),
  ServiceFailure({ token: 1, text: "Voice is unavailable." }), Silence({ token: 1 }),
  UnusableSpeech({ token: 1, owner: C::HumanAudio }), UnusableSpeech({ token: 2, owner: C::HumanAudio }))
```

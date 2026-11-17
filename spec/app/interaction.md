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
their original actor checks. Runtime text is never a user choice. A complete
human utterance keeps its audio provenance and current generation. Open,
Close, Talk, privacy removal, task replacement and a new conversation have
their own coordinated workspace routes. Pause and Resume act on Grace's
speech only; stopping the website task is the workspace's Stop. Every
allowed interaction keeps every rule of the assistant.

```quint
import assistant as A from "./assistant"
import conversation as C from "./conversation"

type Interaction = TypeIntoChat | StopVoice | ReadLatest | ShowChat | DismissKeyboard | FocusWebsite
  | PauseSpeech | ResumeSpeech | RepeatReply({ audible: bool })
  | EditDraft({ text: str }) | SendDraft({ revision: int }) | ChooseAnswer({ token: int, text: str })
  | ReadEarlier({ position: int }) | Resize({ expanded: bool })
  | Hear({ token: int, text: str, owner: C::AudioOwner })
  | BargeIn({ token: int, spoken: int, owner: C::AudioOwner })
  | Respond({ token: int, text: str, isQuestion: bool, answers: List[str], audible: bool }) | FinishSpeech({ token: int })
  | ServiceFailure({ token: int, text: str }) | Silence({ token: int })
  | UnusableSpeech({ token: int, owner: C::AudioOwner })
  | DismissGuidance({ revision: int }) | ShowGuidance({ revision: int })

pure def canInteract(assistant: A::Assistant, input: Interaction, by: C::ConversationActor): bool = match input {
  | DismissGuidance(data) => A::canDismissGuidance(assistant, data.revision, by)
  | ShowGuidance(data) => A::canShowGuidance(assistant, data.revision, by)
  | TypeIntoChat => A::canChooseType(assistant, by)
  | StopVoice => by == C::ConversationUser and A::canQuiet(assistant, by)
  | EditDraft(data) => A::canEditDraft(assistant, data.text, by)
  | SendDraft(data) => A::canSendDraft(assistant, data.revision, by)
  | ChooseAnswer(data) => A::canChooseAnswer(assistant, data.token, data.text, by)
  | ReadEarlier(data) => A::canReadEarlier(assistant, data.position, by)
  | ReadLatest => A::canReadLatest(assistant, by)
  | RepeatReply(data) => A::canRepeatReply(assistant, data.audible, by)
  | PauseSpeech => A::canPauseSpeech(assistant, by)
  | ResumeSpeech => A::canResumeSpeech(assistant, by)
  | BargeIn(data) => A::canBargeIn(assistant, data.token, data.spoken, data.owner, by)
  | Resize(data) => A::canResize(assistant, data.expanded, by)
  | ShowChat => A::canShowChat(assistant, by)
  | DismissKeyboard => A::canDismissKeyboard(assistant, by)
  | FocusWebsite => A::canFocusWebsite(assistant, by)
  | Hear(data) => A::canHear(assistant, data.token, data.text, data.owner, by)
  | Respond(data) => A::canRespond(assistant, data.token, data.text, data.isQuestion, data.answers, by)
  | FinishSpeech(data) => A::canFinishSpeech(assistant, data.token, by)
  | ServiceFailure(data) => A::canServiceFailure(assistant, data.token, data.text, by)
  | Silence(data) => A::canSilence(assistant, data.token, by)
  | UnusableSpeech(data) => A::canUnusableSpeech(assistant, data.token, data.owner, by)
}
pure def interact(assistant: A::Assistant, input: Interaction, by: C::ConversationActor): A::Assistant = match input {
  | DismissGuidance(data) => A::dismissGuidance(assistant, data.revision, by)
  | ShowGuidance(data) => A::showGuidance(assistant, data.revision, by)
  | TypeIntoChat => A::chooseType(assistant, by)
  | StopVoice => A::quiet(assistant, by)
  | EditDraft(data) => A::editDraft(assistant, data.text, by)
  | SendDraft(data) => A::sendDraft(assistant, data.revision, by)
  | ChooseAnswer(data) => A::chooseAnswer(assistant, data.token, data.text, by)
  | ReadEarlier(data) => A::readEarlier(assistant, data.position, by)
  | ReadLatest => A::readLatest(assistant, by)
  | RepeatReply(data) => A::repeatReply(assistant, data.audible, by)
  | PauseSpeech => A::pauseSpeech(assistant, by)
  | ResumeSpeech => A::resumeSpeech(assistant, by)
  | BargeIn(data) => A::bargeIn(assistant, data.token, data.spoken, data.owner, by)
  | Resize(data) => A::resize(assistant, data.expanded, by)
  | ShowChat => A::showChat(assistant, by)
  | DismissKeyboard => A::dismissKeyboard(assistant, by)
  | FocusWebsite => A::focusWebsite(assistant, by)
  | Hear(data) => A::hear(assistant, data.token, data.text, data.owner, by)
  | Respond(data) => A::respond(assistant, data.token, data.text, data.isQuestion, data.answers, data.audible, by)
  | FinishSpeech(data) => A::finishSpeech(assistant, data.token, by)
  | ServiceFailure(data) => A::serviceFailure(assistant, data.token, data.text, by)
  | Silence(data) => A::silence(assistant, data.token, by)
  | UnusableSpeech(data) => A::unusableSpeech(assistant, data.token, data.owner, by)
}
pure def lawInteractionPreservesAssistant(assistant: A::Assistant, input: Interaction, by: C::ConversationActor): bool =
  A::validAssistant(assistant) and canInteract(assistant, input, by) implies A::validAssistant(interact(assistant, input, by))
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
pure val assistantValues = {
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
  FinishSpeech({ token: 1 }), FinishSpeech({ token: 2 }),
  ServiceFailure({ token: 1, text: "Voice is unavailable." }), Silence({ token: 1 }),
  UnusableSpeech({ token: 1, owner: C::HumanAudio }), UnusableSpeech({ token: 2, owner: C::HumanAudio }))
```

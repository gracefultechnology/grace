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
their own coordinated workspace routes.

```quint
import assistant as A from "./assistant"
import conversation as C from "./conversation"

type Interaction = TypeIntoChat | StopVoice | ReadLatest | RepeatReply | ShowChat | DismissKeyboard | FocusWebsite
  | EditDraft({ text: str }) | SendDraft({ revision: int }) | ChooseAnswer({ token: int, text: str })
  | ReadEarlier({ position: int }) | Resize({ expanded: bool })
  | Hear({ token: int, text: str, owner: C::AudioOwner })
  | Respond({ token: int, text: str, isQuestion: bool }) | FinishSpeech({ token: int })
  | ServiceFailure({ token: int, text: str }) | Silence({ token: int })
  | UnusableSpeech({ token: int, owner: C::AudioOwner })

pure def canInteract(a: A::Assistant, input: Interaction, by: C::ConversationActor): bool = match input {
  | TypeIntoChat => A::canChooseType(a, by)
  | StopVoice => by == C::ConversationUser and A::canQuiet(a, by)
  | EditDraft(data) => A::canEditDraft(a, data.text, by)
  | SendDraft(data) => A::canSendDraft(a, data.revision, by)
  | ChooseAnswer(data) => A::canChooseAnswer(a, data.token, data.text, by)
  | ReadEarlier(data) => A::canReadEarlier(a, data.position, by)
  | ReadLatest => A::canReadLatest(a, by)
  | RepeatReply => A::canRepeatReply(a, by)
  | Resize(data) => A::canResize(a, data.expanded, by)
  | ShowChat => A::canShowChat(a, by)
  | DismissKeyboard => A::canDismissKeyboard(a, by)
  | FocusWebsite => A::canFocusWebsite(a, by)
  | Hear(data) => A::canHear(a, data.token, data.text, data.owner, by)
  | Respond(data) => A::canRespond(a, data.token, data.text, by)
  | FinishSpeech(data) => A::canFinishSpeech(a, data.token, by)
  | ServiceFailure(data) => A::canServiceFailure(a, data.token, data.text, by)
  | Silence(data) => A::canSilence(a, data.token, by)
  | UnusableSpeech(data) => A::canUnusableSpeech(a, data.token, data.owner, by)
}
pure def interact(a: A::Assistant, input: Interaction, by: C::ConversationActor): A::Assistant = match input {
  | TypeIntoChat => A::chooseType(a, by)
  | StopVoice => A::quiet(a, by)
  | EditDraft(data) => A::editDraft(a, data.text, by)
  | SendDraft(data) => A::sendDraft(a, data.revision, by)
  | ChooseAnswer(data) => A::chooseAnswer(a, data.token, data.text, by)
  | ReadEarlier(data) => A::readEarlier(a, data.position, by)
  | ReadLatest => A::readLatest(a, by)
  | RepeatReply => A::repeatReply(a, by)
  | Resize(data) => A::resize(a, data.expanded, by)
  | ShowChat => A::showChat(a, by)
  | DismissKeyboard => A::dismissKeyboard(a, by)
  | FocusWebsite => A::focusWebsite(a, by)
  | Hear(data) => A::hear(a, data.token, data.text, data.owner, by)
  | Respond(data) => A::respond(a, data.token, data.text, data.isQuestion, by)
  | FinishSpeech(data) => A::finishSpeech(a, data.token, by)
  | ServiceFailure(data) => A::serviceFailure(a, data.token, data.text, by)
  | Silence(data) => A::silence(a, data.token, by)
  | UnusableSpeech(data) => A::unusableSpeech(a, data.token, data.owner, by)
}
pure def validAssistant(a: A::Assistant): bool =
  A::alwaysConversationRules(a) and A::alwaysHiddenIsQuiet(a) and
  A::alwaysTaskContextExists(a) and A::alwaysOperationsBelongToWorkingTasks(a) and
  A::alwaysOnlyVerifiedEndpointsClaimCompletion(a) and A::alwaysReplacementIsComplete(a)
pure def lawInteractionPreservesAssistant(a: A::Assistant, input: Interaction, by: C::ConversationActor): bool =
  validAssistant(a) and canInteract(a, input, by) implies validAssistant(interact(a, input, by))
```

### The workspace can distinguish new requests, changed geometry and local reading

Submitting human content supersedes prior conversational intent. Layout and
keyboard ownership alter the observed browser geometry. Draft editing and
reading alone do not submit a new request. Type must preserve an already
submitted response while muting it; stopping voice is distinct from stopping
the entire website task.

```quint
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
pure val aValues = Set(A::initial, A::open(A::initial, C::ConversationUser),
  A::talk(A::open(A::initial, C::ConversationUser), C::ConversationUser))
pure val inputValues = Set(TypeIntoChat, StopVoice, ReadLatest, RepeatReply, ShowChat, DismissKeyboard, FocusWebsite,
  EditDraft({ text: "Hello" }), EditDraft({ text: "" }), SendDraft({ revision: 1 }), SendDraft({ revision: 0 }),
  ChooseAnswer({ token: 1, text: "Yes" }), ChooseAnswer({ token: 2, text: "Please explain" }),
  ReadEarlier({ position: 0 }), Resize({ expanded: true }), Resize({ expanded: false }),
  Hear({ token: 1, text: "Hello", owner: C::HumanAudio }), Hear({ token: 1, text: "Hello", owner: C::GraceAudio }),
  Respond({ token: 1, text: "How can I help?", isQuestion: true }),
  Respond({ token: 2, text: "Here is the explanation.", isQuestion: false }),
  FinishSpeech({ token: 1 }), FinishSpeech({ token: 2 }),
  ServiceFailure({ token: 1, text: "Voice is unavailable." }), Silence({ token: 1 }),
  UnusableSpeech({ token: 1, owner: C::HumanAudio }), UnusableSpeech({ token: 2, owner: C::HumanAudio }))
```

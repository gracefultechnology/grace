// spec/app/assistant.md, "Story: Keep control of one task across windows and pauses"
// Grace's window: compact at the bottom, over the page when one shows, or expanded over everything
// right of the rail. The workspace owns the composer and its active turn.
import { AnswerChip, AnswerChips, besideRail, cn, GraceBubble, GraceDock, GraceHeader, GraceMessages, GraceWindow, UserBubble } from "@repo/ui";
import type { Interaction } from "../gen/app__interaction.ts";
import { OverPage } from "./PageLayer.tsx";
import { useDraft, useKeyboardHeight, useWorkspace } from "./useApp.ts";

/** @model spec/app/assistant.md */
export function Grace({ onHeightChange }: { onHeightChange: (height: number) => void }) {
  const { workspace, can, send } = useWorkspace();
  const { assistant, device } = workspace!;
  const conversation = assistant.conversation;
  const [draft, setDraft] = useDraft(conversation.draft, assistant.keyboard === "ChatKeyboard");
  // Prototype `layout()`: the window sits on the keyboard.
  const keyboard = useKeyboardHeight();
  if (assistant.presentation === "Closed") return null;
  const expanded = assistant.presentation === "Expanded";
  const answerEvent = (text: string): Interaction => ({ tag: "ChooseAnswer", token: conversation.generation, text });
  const answers = conversation.answers.filter((text) => can({ type: "interact", input: answerEvent(text) }));
  const interact = (input: Interaction) => { if (can({ type: "interact", input })) void send({ type: "interact", input }); };

  // spec/app/surface.md, "A Grace control is drawn over the page only after the host routes its rect to Grace": compact over a
  // shown page, and expanded over one the host has not hidden yet. One window at both sizes, so resizing keeps its focus.
  return (
    <OverPage className={cn(besideRail, "z-[3]")} style={{ bottom: 6 + keyboard }}>
      <GraceWindow size={expanded ? "expanded" : "compact"} onHeightChange={onHeightChange}
        // Prototype `sizeCompact()`: an explicit height at both sizes, so every change animates.
        style={expanded ? { height: `calc(100dvh - ${12 + keyboard}px)` } : undefined}
        header={
          <GraceHeader expanded={expanded} onExpandedChange={(larger) => interact({ tag: "Resize", expanded: larger })}
            onClose={() => { if (can({ type: "closeGrace" })) void send({ type: "closeGrace" }); }} />
        }
        dock={
          <GraceDock value={draft} maxLines={expanded ? 6 : 4} mic={conversation.voice}
            quiet={!device.reasoningAvailable || conversation.turn === "Thinking"}
            micUnavailable={device.microphoneAllowed ? undefined : device.reasoningAvailable ? "Type a message" : "Grace is unavailable right now"}
            onMicChange={(on) => {
              if (!on) interact({ tag: "StopVoice" });
              else if (can({ type: "talk" })) void send({ type: "talk" });
            }}
            onFieldFocus={() => interact({ tag: "TypeIntoChat" })}
            onValueChange={(text) => { setDraft(text); interact({ tag: "EditDraft", text }); }}
            onSend={() => interact({ tag: "SendDraft", revision: conversation.draftRevision })} />
        }>
        <GraceMessages>
          {conversation.messages.map((message, index) =>
            // eslint-disable-next-line @eslint-react/no-array-index-key -- the transcript only grows at its end
            message.author === "HumanMessage" ? <UserBubble key={index}>{message.text}</UserBubble> : <GraceBubble key={index}>{message.text}</GraceBubble>)}
          {answers.length > 0 && (
            <AnswerChips>{answers.map((text) => <AnswerChip key={text} onClick={() => interact(answerEvent(text))}>{text}</AnswerChip>)}</AnswerChips>
          )}
        </GraceMessages>
      </GraceWindow>
    </OverPage>
  );
}

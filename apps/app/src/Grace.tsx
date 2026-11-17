// spec/app/assistant.md, "Story: Keep control of one task across windows and pauses"
// Grace's window: compact at the bottom, over the page when one shows, or expanded over everything
// right of the rail. Conversation services are not connected yet; the composer keeps the draft.
import { besideRail, cn, GraceBubble, GraceDock, GraceHeader, GraceMessages, GraceWindow, UserBubble } from "@repo/ui";
import type { Interaction } from "../gen/app__interaction.ts";
import { OverPage } from "./PageLayer.tsx";
import { useDraft, useKeyboardHeight, usePasswordGuide, useWorkspace } from "./useApp.ts";

/** @model spec/app/assistant.md */
export function Grace({ onHeightChange }: { onHeightChange: (height: number) => void }) {
  const { workspace, can, send } = useWorkspace();
  const guide = usePasswordGuide();
  const { assistant } = workspace!;
  const conversation = assistant.conversation;
  const [draft, setDraft] = useDraft(conversation.draft, assistant.keyboard === "ChatKeyboard");
  // Prototype `layout()`: the window sits on the keyboard.
  const keyboard = useKeyboardHeight();
  if (assistant.presentation === "Closed") return null;
  const expanded = assistant.presentation === "Expanded";
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
          <GraceDock value={draft} maxLines={expanded ? 6 : 4}
            mic={conversation.voice || guide.microphone === "GuideMicListening"}
            listening={guide.microphone === "GuideMicListening"}
            placeholder={guide.microphone === "GuideMicUnavailable" ? "Voice help is unavailable. You can type to Grace." :
              guide.microphone === "GuideMicNoMatch" ? "Try saying “Open Passwords”, or type to Grace." : undefined}
            onMicChange={(on) => {
              if (on) guide.listen();
              else {
                guide.stopMic();
                interact({ tag: "StopVoice" });
              }
            }}
            onFieldFocus={() => { guide.stopMic(); interact({ tag: "TypeIntoChat" }); }}
            onValueChange={(text) => { setDraft(text); interact({ tag: "EditDraft", text }); }}
            onSend={() => {
              const { draftRevision } = conversation;
              void guide.request(draftRevision).then((guided) => {
                if (guided) setDraft("");
                else interact({ tag: "SendDraft", revision: draftRevision });
              });
            }} />
        }>
        <GraceMessages>
          {conversation.messages.map((message, index) =>
            // eslint-disable-next-line @eslint-react/no-array-index-key -- the transcript only grows at its end
            message.author === "HumanMessage" ? <UserBubble key={index}>{message.text}</UserBubble> : <GraceBubble key={index}>{message.text}</GraceBubble>)}
        </GraceMessages>
      </GraceWindow>
    </OverPage>
  );
}

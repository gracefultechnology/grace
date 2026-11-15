import type { ComponentMeta } from "vibestack/stories";
import { AnswerChip, AnswerChips } from "./AnswerChip.tsx";
import { GraceDock } from "./GraceDock.tsx";
import { dockArgs } from "./GraceDock.meta.tsx";
import { GraceHeader } from "./GraceHeader.tsx";
import { GraceBubble } from "./GraceBubble.tsx";
import { GraceMessages } from "./GraceMessages.tsx";
import { conversation, greeting, thinking } from "./GraceMessages.meta.tsx";
import { GraceVoiceMenu } from "./GraceVoiceMenu.tsx";
import type { GraceWindowProps } from "./GraceWindow.tsx";
import { TabletScreen } from "./TabletScreen.tsx";
import { UserBubble } from "./UserBubble.tsx";

const header = (expanded: boolean, pause: "idle" | "live" = "live") => (
  <GraceHeader expanded={expanded} pause={pause} voice={<GraceVoiceMenu side={expanded ? "bottom" : "top"} />} />
);
// While Grace speaks it is her turn: the field holds its place, dimmed, with no helper words; they step back for answers
// to tap too, and show only on Margaret's turn with nothing else to do (prototype dock()).
const dock = (expanded: boolean, turn: "grace" | "answers" | "margaret") => (
  <GraceDock {...dockArgs} quiet={turn === "grace"} placeholder={turn === "margaret" ? "Talk or tap to type a message" : ""} maxLines={expanded ? 6 : 4} />
);

// Prototype `#gwin` in `.chat-white` as Ask Grace opens her full screen, greeting Margaret (ref grace-open).
export const meta: ComponentMeta<GraceWindowProps> = {
  args: { size: "expanded", header: header(true), dock: dock(true, "grace"), children: <GraceMessages>{greeting}</GraceMessages> },
  examples: {
    // Ref grace-compact: three rows over Home.
    Compact: { size: "compact", header: header(false), dock: dock(false, "grace") },
    Conversation: { header: header(true, "idle"), dock: dock(true, "answers"), children: <GraceMessages>{conversation}</GraceMessages> },
    "Compact question": { size: "compact", height: 330, header: header(false, "idle"), dock: dock(false, "answers"), children: <GraceMessages>{conversation}</GraceMessages> },
    // While she talks the answers fade out and keep their place (prototype `.sugg.fade`).
    "Compact question, listening": {
      size: "compact",
      height: 330,
      header: header(false, "idle"),
      dock: dock(false, "margaret"),
      children: (
        <GraceMessages>
          <GraceBubble>Hi Margaret. What can I help with?</GraceBubble>
          <UserBubble>Can you help me pay my Chase bill?</UserBubble>
          <GraceBubble>I'll open Chase's website. Would you like to watch me do it?</GraceBubble>
          <AnswerChips faded>
            <AnswerChip>Yes, show me</AnswerChip>
            <AnswerChip>No, go ahead</AnswerChip>
          </AnswerChips>
        </GraceMessages>
      ),
    },
    "Compact thinking": { size: "compact", header: header(false, "idle"), dock: dock(false, "grace"), children: <GraceMessages>{thinking}</GraceMessages> },
    // A reply of four lines: the window grows a line and shows the reply's end (prototype sizeCompact(), focusMsg()).
    "Compact long reply": {
      size: "compact",
      height: 292,
      header: header(false, "idle"),
      dock: dock(false, "margaret"),
      children: (
        <GraceMessages>
          <GraceBubble>Hi Margaret. What can I help with?</GraceBubble>
          <UserBubble>Can you help me pay my Chase bill?</UserBubble>
          <GraceBubble>
            Chase's sign-in page is open. I'll take you through it step by step. Tap the password box, then type your password. Your bill is $84.20, due
            tomorrow, Thursday. Shall I fill in $84.20 and today's date for you?
          </GraceBubble>
        </GraceMessages>
      ),
    },
    Frost: { surface: "frost", size: "compact", header: header(false), dock: dock(false, "grace") },
  },
  decorator: (story) => <TabletScreen>{story()}</TabletScreen>,
};

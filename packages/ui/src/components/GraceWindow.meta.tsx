import type { ComponentMeta } from "vibestack/stories";
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
// While Grace speaks it is her turn: the field holds its place, dimmed, with no helper words.
const dock = (expanded: boolean, quiet = false) => <GraceDock {...dockArgs} quiet={quiet} maxLines={expanded ? 6 : 4} />;

// Prototype `#gwin` in `.chat-white` as Ask Grace opens her full screen, greeting Margaret (ref grace-open).
export const meta: ComponentMeta<GraceWindowProps> = {
  args: { size: "expanded", header: header(true), dock: dock(true, true), children: <GraceMessages>{greeting}</GraceMessages> },
  examples: {
    // Ref grace-compact: three rows over Home.
    Compact: { size: "compact", header: header(false), dock: dock(false, true) },
    Conversation: { header: header(true, "idle"), dock: dock(true), children: <GraceMessages>{conversation}</GraceMessages> },
    "Compact question": { size: "compact", height: 330, header: header(false, "idle"), dock: dock(false), children: <GraceMessages>{conversation}</GraceMessages> },
    "Compact thinking": { size: "compact", header: header(false, "idle"), dock: dock(false, true), children: <GraceMessages>{thinking}</GraceMessages> },
    // A reply of four lines: the window grows a line and shows the reply's end (prototype sizeCompact(), focusMsg()).
    "Compact long reply": {
      size: "compact",
      height: 292,
      header: header(false, "idle"),
      dock: dock(false),
      children: (
        <GraceMessages>
          <GraceBubble>Hi Margaret. What can I help with?</GraceBubble>
          <UserBubble>Can you help me pay my Chase bill?</UserBubble>
          <GraceBubble>
            I can help with that. Your Chase card has a balance of four hundred and twelve dollars, and the minimum payment is thirty five dollars. It is due this
            Friday. I can open the Chase website for you and we can pay it together, one step at a time, whenever you are ready to start. Shall we do it now?
          </GraceBubble>
        </GraceMessages>
      ),
    },
    Frost: { surface: "frost", size: "compact", header: header(false), dock: dock(false, true) },
  },
  decorator: (story) => <TabletScreen>{story()}</TabletScreen>,
};

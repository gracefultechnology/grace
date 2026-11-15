import type { ComponentMeta } from "vibestack/stories";
import type { GraceBubbleProps } from "./GraceBubble.tsx";

// Prototype `#msgs` in `.chat-white`: Grace greeting Margaret, the first words spoken and the rest still pale.
export const meta: ComponentMeta<GraceBubbleProps> = {
  args: { activity: "speaking", children: "Hi Margaret.", rest: "What can I help with?" },
  examples: {
    Said: { activity: undefined, children: "Your bill is $84.20, due tomorrow, Thursday. Does that look right to you?", rest: undefined },
    Thinking: { activity: "thinking", children: undefined, rest: undefined },
    // Prototype answerResume(): she carries on with the task she was doing.
    Working: { activity: "working", children: "Carrying on.", rest: undefined },
    Paused: { activity: undefined, children: "Hi Margaret", rest: undefined, stopped: "Paused" },
    // Prototype renderGrace() while `stopped`: Margaret spoke over her, so her line ends where she was cut off.
    Interrupted: { activity: undefined, children: "Your statement balance is", rest: undefined, stopped: "Interrupted" },
    // Her message held something that looked private, so the notice replaces it.
    Removed: { activity: undefined, children: undefined, rest: undefined, removed: true },
  },
  decorator: (story) => <div className="group/grace w-[1130px] bg-background p-6" data-surface="white">{story()}</div>,
};

import type { ComponentMeta } from "vibestack/stories";
import type { GraceBubbleProps } from "./GraceBubble.tsx";

// Prototype `#msgs` in `.chat-white`: Grace greeting Margaret, the first words spoken and the rest still pale.
export const meta: ComponentMeta<GraceBubbleProps> = {
  args: { activity: "speaking", children: "Hi Margaret.", rest: "What can I help with?" },
  examples: {
    Said: { activity: undefined, children: "Of course. Would you like to pay the full balance or a different amount?", rest: undefined },
    Thinking: { activity: "thinking", children: undefined, rest: undefined },
    Working: { activity: "working", children: "Opening Chase", rest: "for you now." },
    Paused: { activity: undefined, children: "Hi Margaret", rest: undefined, stopped: "Paused" },
  },
  decorator: (story) => <div className="group/grace w-[1130px] bg-background p-6" data-surface="white">{story()}</div>,
};

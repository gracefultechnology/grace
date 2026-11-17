import type { ComponentMeta } from "vibestack/stories";
import type { GraceBubbleProps } from "./GraceBubble.tsx";

export const meta: ComponentMeta<GraceBubbleProps> = {
  args: { activity: "speaking", children: "Hi Margaret.", rest: "What can I help with?" },
  examples: {
    Said: { activity: undefined, children: "Your bill is $84.20, due tomorrow, Thursday. Does that look right to you?", rest: undefined },
    Thinking: { activity: "thinking", children: undefined, rest: undefined },
    Working: { activity: "working", children: "Carrying on.", rest: undefined },
    "Working mid-sentence": { activity: "working", children: "Opening", rest: "Chase for you." },
    Paused: { activity: undefined, children: "Hi Margaret", rest: undefined, stopped: "Paused" },
    Interrupted: { activity: undefined, children: "Your statement balance is", rest: undefined, stopped: "Interrupted" },
    Removed: { activity: undefined, children: undefined, rest: undefined, removed: true },
  },
  decorator: (story) => <div className="group/grace w-[1130px] bg-background p-6">{story()}</div>,
};

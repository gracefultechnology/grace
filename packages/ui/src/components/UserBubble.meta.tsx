import type { ComponentMeta } from "vibestack/stories";
import type { UserBubbleProps } from "./UserBubble.tsx";

// Prototype `.ub`: what Margaret asked.
export const meta: ComponentMeta<UserBubbleProps> = {
  args: { children: "Can you help me pay my Chase bill?" },
  decorator: (story) => <div className="w-[1130px] bg-background p-6">{story()}</div>,
};

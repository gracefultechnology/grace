import type { ComponentMeta } from "vibestack/stories";
import type { UnreadDotProps } from "./UnreadDot.tsx";

export const meta: ComponentMeta<UnreadDotProps> = {
  decorator: (story) => <div className="p-6">{story()}</div>,
};

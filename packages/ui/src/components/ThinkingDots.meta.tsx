import type { ComponentMeta } from "vibestack/stories";
import type { ThinkingDotsProps } from "./ThinkingDots.tsx";

export const meta: ComponentMeta<ThinkingDotsProps> = {
  decorator: (story) => <div className="p-6">{story()}</div>,
};

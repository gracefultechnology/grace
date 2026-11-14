import type { ComponentMeta } from "vibestack/stories";
import type { ProgressProps } from "./Progress.tsx";

export const meta: ComponentMeta<ProgressProps> = {
  args: { value: 60, "aria-label": "Upload" },
  examples: { Empty: { value: 0 }, Done: { value: 100 }, Unknown: { value: null } },
  decorator: (story) => <div className="w-[440px] p-6">{story()}</div>,
};

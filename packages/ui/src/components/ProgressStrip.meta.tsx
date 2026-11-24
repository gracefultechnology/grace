import type { ComponentMeta } from "vibestack/stories";
import type { ProgressStripProps } from "./ProgressStrip.tsx";

export const meta: ComponentMeta<ProgressStripProps> = {
  args: { title: "Text size", step: 5, total: 10 },
  decorator: (story) => <div className="w-[760px] bg-background p-6">{story()}</div>,
  examples: {
    First: { title: "Wi-Fi", step: 1 },
    Last: { title: "Bring Grace back", step: 10 },
  },
};

import type { ComponentMeta } from "vibestack/stories";
import type { PageHeadingProps } from "./PageHeading.tsx";

export const meta: ComponentMeta<PageHeadingProps> = {
  args: { children: "Text size" },
  examples: {
    "Coming up": { level: "title", children: "Coming up" },
    "Other networks nearby": { level: "section", children: "Other networks nearby" },
  },
  decorator: (story) => <div className="w-[852px] bg-background p-6">{story()}</div>,
};

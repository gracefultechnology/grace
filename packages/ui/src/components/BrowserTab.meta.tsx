import type { ComponentMeta } from "vibestack/stories";
import type { BrowserTabProps } from "./BrowserTab.tsx";

export const meta: ComponentMeta<BrowserTabProps> = {
  args: { title: "Pay your card · Chase", initial: "C", selected: true },
  examples: { "New tab": { title: "New tab", initial: undefined } },
  decorator: (story) => (
    <div className="bg-gradient-frame">
      <div className="flex h-16 items-end bg-glass/42 pl-4">{story()}</div>
      <div className="h-20 bg-glass/78" />
    </div>
  ),
};

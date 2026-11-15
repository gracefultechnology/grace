import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { BrowserTabStripProps } from "./BrowserTabStrip.tsx";

const select = fn();
const close = fn();

export const meta: ComponentMeta<BrowserTabStripProps> = {
  // Prototype `.bz-strip` with its one new tab.
  args: { tabs: [{ id: 1, title: "New tab" }], selectedId: 1 },
  examples: {
    "Several tabs": {
      tabs: [
        { id: 1, title: "Pay your card · Chase", initial: "C" },
        { id: 2, title: "Riverside Library", initial: "R" },
        { id: 3, title: "New tab" },
      ],
      selectedId: 2,
      onSelectTab: select,
      onCloseTab: close,
    },
  },
  // The strip stands on the toolbar's white glass, over the browser window's glass.
  decorator: (story) => (
    <div className="w-[1130px] overflow-hidden rounded-t-window bg-gradient-frame">
      <div className="bg-glass/42">
        {story()}
        <div className="h-20 bg-glass/78" />
      </div>
    </div>
  ),
  play: {
    "Several tabs": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole("button", { name: "Pay your card · Chase" }));
      await userEvent.click(canvas.getByRole("button", { name: "Close New tab" }));
      await expect([select.mock.calls[0], close.mock.calls[0]]).toEqual([[1], [3]]);
    },
  },
};

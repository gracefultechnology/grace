import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { BrowserTabProps } from "./BrowserTab.tsx";

const select = fn();
const close = fn();

export const meta: ComponentMeta<BrowserTabProps> = {
  args: { title: "Pay your card · Chase", initial: "C", selected: true, onSelect: select, onClose: close },
  examples: { "New tab": { title: "New tab", initial: undefined } },
  decorator: (story) => (
    <div className="bg-gradient-frame">
      <div className="flex h-16 items-end bg-glass/42 pl-4">{story()}</div>
      <div className="h-20 bg-glass/78" />
    </div>
  ),
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      select.mockClear();
      close.mockClear();
      const canvas = within(canvasElement);
      const tab = canvas.getByRole("button", { name: "Pay your card · Chase" });
      await expect(tab.getAttribute("aria-current")).toBe("page");
      await userEvent.click(tab);
      await userEvent.click(canvas.getByRole("button", { name: "Close Pay your card · Chase" }));
      await expect([select, close].map((spy) => spy.mock.calls.length)).toEqual([1, 1]);
    },
  },
};

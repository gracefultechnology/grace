import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { AddressBar } from "./AddressBar.tsx";
import type { BrowserToolbarProps } from "./BrowserToolbar.tsx";

const back = fn();

export const meta: ComponentMeta<BrowserToolbarProps> = {
  // Prototype `.bz-bar` on a new tab.
  args: { children: <AddressBar value="" /> },
  examples: {
    // On the payment page, one page back.
    "Website": { canGoBack: true, canGo: true, onBack: back, children: <AddressBar value="chase.com/pay" /> },
  },
  decorator: (story) => <div className="w-[1130px] bg-gradient-frame">{story()}</div>,
  play: {
    Website: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await expect(canvas.getByRole("button", { name: "Forward" })).toBeDisabled();
      await userEvent.click(canvas.getByRole("button", { name: "Back" }));
      await expect(back).toHaveBeenCalled();
    },
  },
};

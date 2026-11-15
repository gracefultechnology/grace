import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { AddressBar } from "./AddressBar.tsx";
import type { BrowserToolbarProps } from "./BrowserToolbar.tsx";
import { unfocus } from "./MailApp.meta.tsx";

const back = fn();
const reload = fn();
const stop = fn();

export const meta: ComponentMeta<BrowserToolbarProps> = {
  // Prototype `.bz-bar` on a new tab.
  args: { children: <AddressBar value="" /> },
  examples: {
    // On the payment page, one page back.
    Website: { canGoBack: true, canGo: true, onBack: back, children: <AddressBar value="chase.com/pay" /> },
    // The same page, with Reload.
    Reload: { canGoBack: true, canGo: true, reloadable: true, onReload: reload, onStop: stop, children: <AddressBar value="chase.com/pay" /> },
    // While the page loads, Reload is Stop.
    "Loading page": { canGoBack: true, canGo: true, reloadable: true, pageLoading: true, onReload: reload, onStop: stop, children: <AddressBar value="chase.com/pay/review" /> },
  },
  decorator: (story) => <div className="w-[1130px] bg-gradient-frame">{story()}</div>,
  play: {
    Website: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await expect(canvas.getByRole("button", { name: "Forward" })).toBeDisabled();
      await userEvent.click(canvas.getByRole("button", { name: "Back" }));
      await expect(back).toHaveBeenCalled();
      unfocus();
    },
    Reload: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      reload.mockClear();
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Reload" }));
      await expect([reload.mock.calls.length, within(canvasElement).queryByRole("button", { name: "Stop" })]).toEqual([1, null]);
      unfocus();
    },
    "Loading page": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      reload.mockClear();
      stop.mockClear();
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Stop" }));
      await expect([stop.mock.calls.length, reload.mock.calls.length]).toEqual([1, 0]);
      unfocus();
    },
  },
};

import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { AddressBar } from "./AddressBar.tsx";
import type { BrowserToolbarProps } from "./BrowserToolbar.tsx";
import { unfocus } from "./MailApp.meta.tsx";

const back = fn();
const reload = fn();
const stop = fn();
const forward = fn();
const go = fn();

export const meta: ComponentMeta<BrowserToolbarProps> = {
  args: { children: <AddressBar value="" /> },
  examples: {
    Website: { canGoBack: true, canGo: true, onBack: back, onForward: forward, onGo: go, children: <AddressBar value="chase.com/pay" /> },
    Reload: { canGoBack: true, canGoForward: true, canGo: true, reloadable: true, onForward: forward, onReload: reload, onStop: stop, children: <AddressBar value="chase.com/pay" /> },
    "Loading page": { canGoBack: true, canGo: true, reloadable: true, pageLoading: true, onReload: reload, onStop: stop, children: <AddressBar value="chase.com/pay/review" /> },
  },
  decorator: (story) => <div className="w-[1130px] bg-gradient-frame">{story()}</div>,
  play: {
    Website: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      back.mockClear();
      forward.mockClear();
      go.mockClear();
      const canvas = within(canvasElement);
      const ahead = canvas.getByRole("button", { name: "Forward" });
      await expect(ahead).toBeDisabled();
      await userEvent.click(ahead, { pointerEventsCheck: 0 });
      await userEvent.click(canvas.getByRole("button", { name: "Back" }));
      await userEvent.click(canvas.getByRole("button", { name: "Go" }));
      await expect([back, forward, go].map((spy) => spy.mock.calls.length)).toEqual([1, 0, 1]);
      unfocus();
    },
    Reload: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      reload.mockClear();
      forward.mockClear();
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Reload" }));
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Forward" }));
      await expect([reload.mock.calls.length, forward.mock.calls.length, within(canvasElement).queryByRole("button", { name: "Stop" })]).toEqual([1, 1, null]);
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

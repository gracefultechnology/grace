import { expect, fn, screen, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { NewTabPageProps, NewTabShortcut } from "./NewTabPage.tsx";
import { unfocus } from "./MailApp.meta.tsx";

const open = fn();
const remove = fn();
const clear = fn();
const confirm = fn();
const cancel = fn();

const recent: NewTabShortcut[] = [
  { url: "chase.com", title: "Chase" },
  { url: "chase.com/card", title: "Credit card · Chase" },
  { url: "chase.com/pay", title: "Pay your card · Chase" },
  { url: "chase.com/pay/review", title: "Review payment · Chase" },
  { url: "chase.com/pay/done", title: "Payment scheduled · Chase" },
];

export const meta: ComponentMeta<NewTabPageProps> = {
  examples: {
    "Recent websites": { shortcuts: recent.slice(0, 1), onOpenShortcut: open },
    "Remove and clear": { shortcuts: recent, removable: true, clearable: true, onOpenShortcut: open, onRemoveShortcut: remove, onClear: clear },
    "Confirming clear": { shortcuts: recent, removable: true, clearable: true, onRemoveShortcut: remove, onClear: clear, confirmingClear: true, onConfirmClear: confirm, onCancelClear: cancel },
  },
  decorator: (story) => <div className="h-[644px] w-[1130px]">{story()}</div>,
  play: {
    "Recent websites": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Chase" }));
      await expect(open).toHaveBeenCalledWith("chase.com");
      unfocus();
    },
    "Remove and clear": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      for (const spy of [open, remove, clear]) spy.mockClear();
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole("button", { name: "Remove Chase" }));
      await userEvent.click(canvas.getByRole("button", { name: "Clear" }));
      await expect([remove.mock.calls[0], clear.mock.calls.length, open.mock.calls.length]).toEqual([["chase.com"], 1, 0]);
      unfocus();
    },
    "Confirming clear": async () => {
      confirm.mockClear();
      cancel.mockClear();
      const question = within(await screen.findByRole("dialog", { name: "Forget every website on this list?" }));
      await userEvent.click(question.getByRole("button", { name: "Clear" }));
      await userEvent.keyboard("{Escape}");
      await expect([confirm.mock.calls.length, cancel.mock.calls.length]).toEqual([1, 1]);
      unfocus();
    },
  },
};

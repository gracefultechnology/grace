import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { unfocus } from "./MailApp.meta.tsx";
import type { MailAttachmentProps } from "./MailAttachment.tsx";

const open = fn();
const retry = fn();

export const meta: ComponentMeta<MailAttachmentProps> = {
  // The clinic's form, attached to its reminder.
  args: { name: "Visit form.pdf", detail: "2 pages", onOpen: open, onPrint: fn() },
  examples: {
    Printing: { printStatus: "pending" },
    Printed: { printStatus: "accepted" },
    "Print failed": { printStatus: "failed", onRetry: retry },
    "Print unknown": { printStatus: "unknown" },
    Saved: { saveStatus: "saved" },
  },
  decorator: (story) => <div className="w-[810px] bg-background p-6">{story()}</div>,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Open" }));
      await expect(open).toHaveBeenCalled();
      unfocus();
    },
    "Print failed": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Try again" }));
      await expect(retry).toHaveBeenCalled();
      unfocus();
    },
    // While the printer's answer is unknown, Print waits.
    "Print unknown": ({ canvasElement }: { canvasElement: HTMLElement }) => expect(within(canvasElement).getByRole<HTMLButtonElement>("button", { name: "Print" }).disabled).toBe(true),
  },
};

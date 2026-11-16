import { expect, fn, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { tapCalls } from "./Button.meta.tsx";
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
    Default: tapCalls("Open", open, { rest: true }),
    "Print failed": tapCalls("Try again", retry, { rest: true }),
    // While the printer's answer is unknown, Print waits.
    "Print unknown": ({ canvasElement }: { canvasElement: HTMLElement }) => expect(within(canvasElement).getByRole<HTMLButtonElement>("button", { name: "Print" }).disabled).toBe(true),
  },
};

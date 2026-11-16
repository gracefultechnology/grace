import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { flowersPhoto, mailScreen, people, unfocus } from "./MailApp.meta.tsx";
import type { MailComposeProps } from "./MailCompose.tsx";

const send = fn();
const add = fn();
const retrySave = fn();

export const meta: ComponentMeta<MailComposeProps> = {
  args: {
    to: [people.susan],
    subject: "Sunday",
    body: "See you then!",
    attachments: [{ src: flowersPhoto, alt: "Daisies" }],
    onSend: send,
    onAddRecipient: add,
    onRemoveRecipient: fn(),
    onOpenCc: fn(),
    onSubjectChange: fn(),
    onBodyChange: fn(),
    onRemoveAttachment: fn(),
    onAttach: fn(),
    onDiscard: fn(),
    onBack: fn(),
    onClose: fn(),
  },
  examples: {
    "Large title": { headerMode: "large" },
    Blank: { to: [], subject: "", body: "", attachments: [] },
    "Attach open": { attachOpen: true },
    "With copies": { cc: [people.david], bcc: [people.joan] },
    Sending: { sendStatus: "sending" },
    "Send failed": { sendStatus: "failed" },
    "Not sure it sent": { sendStatus: "unknown" },
    "Record not saved": { sendStatus: "saveFailed", onRetrySave: retrySave },
    "Draft not saved": { draftError: "Your draft couldn’t be saved. Try again.", onRetryDraft: fn() },
    Reply: { title: "Reply", backLabel: "Susan’s email", subject: "Re: Photos from Lily’s recital", body: "", attachments: [] },
  },
  decorator: mailScreen,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole("button", { name: "Add to To" }));
      await expect(add).toHaveBeenCalledWith("to");
      await userEvent.click(canvas.getByRole("button", { name: "Send" }));
      await expect(send).toHaveBeenCalled();
      unfocus();
    },
    "Not sure it sent": ({ canvasElement }: { canvasElement: HTMLElement }) => expect(within(canvasElement).getByRole<HTMLButtonElement>("button", { name: "Send" }).disabled).toBe(true),
    "Record not saved": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole("button", { name: "Try again" }));
      await expect(retrySave).toHaveBeenCalled();
      await expect(canvas.getByRole<HTMLButtonElement>("button", { name: "Send" }).disabled).toBe(true);
      unfocus();
    },
  },
};

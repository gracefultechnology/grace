import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { flowersPhoto, mailScreen, people, unfocus } from "./MailApp.meta.tsx";
import type { MailComposeProps } from "./MailCompose.tsx";

const send = fn();
const add = fn();

export const meta: ComponentMeta<MailComposeProps> = {
  // A new email to Susan with a photo attached.
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
    Blank: { to: [], subject: "", body: "", attachments: [] },
    "Attach open": { attachOpen: true },
    "With copies": { cc: [people.david], bcc: [people.joan] },
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
  },
};

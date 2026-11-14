import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { flowersPhoto, mailScreen, people, programPhoto, stagePhoto, unfocus } from "./MailApp.meta.tsx";
import { MailLink, type MailMessageViewProps } from "./MailMessageView.tsx";

const photo = fn();
const reply = fn();

// The prototype's X.mail.items, opened.
const scam: Partial<MailMessageViewProps> = {
  from: people.security,
  address: "security-alert@acc0unt-help.co",
  time: "Yesterday",
  subject: "Urgent: confirm your password",
  scam: true,
  body: (
    <>
      Your account will be closed today. To keep it open, <MailLink href="#scam">confirm your password here</MailLink>.
    </>
  ),
  photos: undefined,
};

const clinic: Partial<MailMessageViewProps> = {
  from: people.clinic,
  time: "11:02 AM",
  subject: "Reminder: your appointment tomorrow at 10 am",
  body: "Dear Margaret, this is a reminder of your appointment with Dr. Patel tomorrow at 10:00 am. Please fill in the attached form and bring it with you.",
  photos: undefined,
  files: [{ name: "Visit form.pdf", detail: "2 pages" }],
  onOpenFile: fn(),
  onPrintFile: fn(),
};

export const meta: ComponentMeta<MailMessageViewProps> = {
  // Susan's email with Lily's recital photos.
  args: {
    from: people.susan,
    time: "2:15 PM",
    subject: "Photos from Lily’s recital",
    body: "Hi Mom! Here are some photos from Lily’s piano recital. She played so well and was very proud. See you on Sunday. Love, Susan",
    photos: [
      { src: stagePhoto, alt: "Lily on the stage" },
      { src: flowersPhoto, alt: "Daisies" },
      { src: programPhoto, alt: "The recital program" },
    ],
    onBack: fn(),
    onClose: fn(),
    onReply: reply,
    onForward: fn(),
    onDelete: fn(),
    onOpenPhoto: photo,
    onSaveAll: fn(),
  },
  examples: {
    Scam: scam,
    Attachment: clinic,
    "In Trash": { ...clinic, backLabel: "Trash", inTrash: true, onRestore: fn(), onDeleteForever: fn() },
  },
  decorator: mailScreen,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole("button", { name: "Daisies" }));
      await expect(photo).toHaveBeenCalledWith(1);
      await userEvent.click(canvas.getByRole("button", { name: "Reply" }));
      await expect(reply).toHaveBeenCalled();
      unfocus();
    },
    Scam: ({ canvasElement }: { canvasElement: HTMLElement }) => expect(within(canvasElement).getByRole("alert").textContent).toContain("scam"),
  },
};

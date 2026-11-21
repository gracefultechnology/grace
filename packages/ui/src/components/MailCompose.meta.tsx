import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { flowersPhoto, mailScreen, onMailScreen, people, unfocus } from "./MailApp.meta.tsx";
import type { MailComposeProps } from "./MailCompose.tsx";

const send = fn();
const add = fn();
const retrySave = fn();
const chooseFrom = fn();

const from = {
  accounts: [
    { id: 1, address: "margaret.ellis@gmail.com", name: "Gmail" },
    { id: 2, address: "margaret@outlook.com", name: "Outlook" },
  ],
  selected: 1,
  onSelect: chooseFrom,
};

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
    onAttach: { camera: fn(), photos: fn(), file: fn() },
    onDiscard: fn(),
    onBack: fn(),
    onClose: fn(),
  },
  examples: {
    Blank: { to: [], subject: "", body: "", attachments: [] },
    "Attach open": { attachOpen: true },
    "With copies": { cc: [people.david], bcc: [people.joan] },
    Sending: { sendStatus: "sending" },
    "Send failed": { sendStatus: "failed" },
    "Not sure it sent": {
      sendStatus: "unknown", onSend: undefined, onDiscard: undefined, onBack: undefined, onAttach: undefined, onOpenCc: undefined,
      onAddRecipient: undefined, onRemoveRecipient: undefined, onSubjectChange: undefined, onBodyChange: undefined, onRemoveAttachment: undefined,
    },
    "Record not saved": { sendStatus: "saveFailed", onRetrySave: retrySave },
    "Draft not saved": { draftError: "Your draft couldn’t be saved. Try again.", onRetryDraft: fn() },
    From: { from },
    "From menu open": { from: { ...from, open: true } },
    "Reply, Grace points at Send": {
      title: "Reply",
      backLabel: "Susan’s email",
      subject: "Re: Photos from Lily’s recital",
      body: "They’re lovely, thank you! See you on Sunday.",
      attachments: [],
      guide: { targetId: "send", kind: "instruction", title: "Tap Send", onClose: fn() },
    },
  },
  decorator: mailScreen,
  play: {
    Default: onMailScreen(async (canvas) => {
      await userEvent.click(canvas.getByRole("button", { name: "Add to To" }));
      await expect(add).toHaveBeenCalledWith("to");
      await userEvent.click(canvas.getByRole("button", { name: "Send" }));
      await expect(send).toHaveBeenCalled();
    }),
    From: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: /margaret\.ellis@gmail\.com/ }));
      await userEvent.click(await within(document.body).findByRole("menuitemradio", { name: /margaret@outlook\.com/ }));
      await expect(chooseFrom).toHaveBeenCalledWith(2);
      unfocus();
    },
    "Not sure it sent": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await expect(canvas.getByRole<HTMLButtonElement>("button", { name: "Send" }).disabled).toBe(true);
      await expect(canvas.queryByRole("button", { name: "Discard" })).toBeNull();
      await expect(canvas.queryByRole("button", { name: "Attach" })).toBeNull();
    },
    "Record not saved": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole("button", { name: "Try again" }));
      await expect(retrySave).toHaveBeenCalled();
      await expect(canvas.getByRole<HTMLButtonElement>("button", { name: "Send" }).disabled).toBe(true);
      unfocus();
    },
  },
};

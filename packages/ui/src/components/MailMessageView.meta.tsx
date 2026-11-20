import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { flowersPhoto, mailScreen, people, programPhoto, stagePhoto, unfocus } from "./MailApp.meta.tsx";
import { waterBill } from "./BillOffer.meta.tsx";
import { MailLink, type MailMessageViewProps } from "./MailMessageView.tsx";
import { PaymentStatusBadge } from "./PaymentStatusBadge.tsx";

const photo = fn();
const reply = fn();
const retry = fn();
const confirmBill = fn();

const bill: Partial<MailMessageViewProps> = {
  from: { name: "City Water", tone: 1 },
  time: "9:40 AM",
  subject: "Your November water bill",
  body: "Your bill for November is ready. Please pay by November 28.",
  photos: undefined,
  bill: waterBill,
  onConfirmBill: confirmBill,
  onDismissBill: fn(),
  onOpenBill: fn(),
};

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
};

export const meta: ComponentMeta<MailMessageViewProps> = {
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
    "Grace Points At The Warning": { ...scam, guide: { targetId: "caution", kind: "point" } },
    "Grace points at the link": {
      ...scam,
      body: (
        <>
          Your account will be closed today. To keep it open, <MailLink href="#scam" guide={{ kind: "point" }}>confirm your password here</MailLink>.
        </>
      ),
    },
    "Attachments refused": { files: clinic.files, onOpenPhoto: undefined, onSaveAll: undefined, onOpenFile: undefined },
    Attachment: clinic,
    "In Trash": { ...clinic, backLabel: "Trash", inTrash: true, onRestore: fn(), onDeleteForever: fn() },
    Loading: { status: "loading" },
    "Couldn’t open": { status: "failed", onRetry: retry },
    "Photos saved": { saveAllStatus: "saved" },
    Bill: bill,
    "Bill confirmed": { ...bill, bill: { ...waterBill, confirmed: true, status: <PaymentStatusBadge status="unknown" /> } },
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
    Loading: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await expect(["Reply", "Forward"].map((name) => canvas.getByRole<HTMLButtonElement>("button", { name }).disabled)).toEqual([true, true]);
    },
    "Couldn’t open": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Try again" }));
      await expect(retry).toHaveBeenCalled();
      unfocus();
    },
    Bill: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Yes" }));
      await expect(confirmBill).toHaveBeenCalled();
      unfocus();
    },
    "Attachments refused": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await expect(canvas.getByRole("img", { name: "Daisies" })).toBeTruthy();
      await expect(canvas.getByText("Visit form.pdf")).toBeTruthy();
      await expect(["Daisies", "Save all to Files", "Open"].map((name) => canvas.queryByRole("button", { name }))).toEqual([null, null, null]);
    },
    Scam: ({ canvasElement }: { canvasElement: HTMLElement }) => expect(within(canvasElement).getByRole("alert").textContent).toContain("scam"),
  },
};

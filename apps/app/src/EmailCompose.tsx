// spec/app/email.md, "Story: Write or reply and confirm before sending"; spec/app/email.md, "The visible Send button approves exactly the composer the user sees"; spec/app/email.md, "Back and Close keep a composer worth keeping and close an empty one"; spec/app/email.md, "Back preserves the exact draft and storage failure leaves it recoverable"; spec/app/mailboxes.md, "Story: Send from the right address"; spec/app/mailboxes.md, "From offers each account that has Email on and can send"; spec/app/mailboxes.md, "Changing From moves a draft never saved, whole and unapproved, and a saved draft stays"
import { type MailContact, MailCompose, type MailPhoto, type MailRecipientField, MailRecipientPicker, type MailSendStatus } from "@repo/ui";
import { Exit } from "effect";
import { use, useState } from "react";
import type { Accounts } from "../gen/app__accounts.ts";
import { type DraftContent, emptyContent, enabled, type Event as MailEvent, type Mailbox, type SendStatus } from "../gen/app__email.ts";
import { canMoveDraft, contactAccounts, fromChoices, type MailSource, sourceOf, startFrom } from "../gen/app__mailboxes.ts";
import type { Contact } from "./connector.vibe";
import { recipientsOf, recipientsValid } from "./mail.vibe";
import type { MailInstance, MailWriter } from "./useApp.ts";

export type Picking = { readonly field: MailRecipientField; readonly query: string };
type Field = "subject" | "body";
type Frame = { onClose?: () => void; closeLabel: string; inert?: boolean; "aria-hidden"?: boolean };

const questions: Record<MailRecipientField, string> = { to: "Who is it to?", cc: "Who should get a copy?", bcc: "Who should get a hidden copy?" };
const sending: Record<SendStatus, MailSendStatus> = {
  NoDraft: "idle", Composing: "idle", Reviewing: "idle", Sending: "sending", Sent: "idle", SendFailed: "failed", SendUnknown: "unknown",
};
const anAddress = /^[^@\s,;]+@[^@\s,;]+$/;
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const escaped = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function thumbnail(file: Mailbox["draftAttachments"][number]): MailPhoto {
  const label = file.kind === "Pdf" ? "PDF" : "Photo";
  const drawn = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 110"><desc>${escaped(file.id)}</desc><rect width="150" height="110" fill="white"/><text x="75" y="50" text-anchor="middle" font-family="sans-serif" font-size="22" font-weight="700">${label}</text><text x="75" y="78" text-anchor="middle" font-family="sans-serif" font-size="13">${escaped(file.name)}</text></svg>`;
  return { src: `data:image/svg+xml,${encodeURIComponent(drawn)}`, alt: file.name };
}

function statusOf(m: Mailbox): MailSendStatus {
  if (m.sendStatus === "Sent" && !m.sendResultSaved) return "saveFailed";
  return m.sendStatus === "Reviewing" && m.approvedRevision === m.revision ? "sending" : sending[m.sendStatus];
}

function sendTo(content: DraftContent, field: MailRecipientField, address: string): DraftContent {
  if (field === "to") return { ...content, to: address };
  return content[field].some((a) => same(a, address)) ? content : { ...content, [field]: [...content[field], address] };
}

function without(content: DraftContent, field: MailRecipientField, index: number): DraftContent {
  if (field === "to") return { ...content, to: recipientsOf(content.to).filter((_, i) => i !== index).join(", ") };
  return { ...content, [field]: content[field].filter((_, i) => i !== index) };
}

async function closing(box: MailInstance, event: MailEvent) {
  if (!box.can(event)) return;
  await box.send(event);
  if (box.state.replyTo === "") await box.send({ type: "showInbox" });
}

const keeping = (box: MailInstance, draftId = box.state.draftId || "draft"): MailEvent => ({ type: "preserveDraft", draftId });
const leavable = (box: MailInstance) => box.can(keeping(box)) || box.can({ type: "closeEmptyComposer" });

function leave(box: MailInstance, hush?: (id: number) => void) {
  const keep = keeping(box, box.state.draftId || `draft-${crypto.randomUUID()}`);
  if (!box.can(keep)) return closing(box, { type: "closeEmptyComposer" });
  hush?.(box.id);
  return closing(box, keep);
}

const discard = (box: MailInstance) => closing(box, { type: "discardDraft", confirmed: true });

export type EmailComposeProps = {
  registry: Accounts;
  boxes: readonly MailInstance[];
  box?: MailInstance;
  picking: Picking | null;
  onPicking: (picking: Picking | null) => void;
  mail: MailWriter;
  sender: (box: MailInstance) => string;
  frame: Frame;
};

/** @model spec/app/email.md */
export function EmailCompose({ registry, boxes, box, picking, onPicking, mail, sender, frame }: EmailComposeProps) {
  const people = use(mail.contacts(contactAccounts(registry).join(",")));
  const [typed, setTyped] = useState<Partial<Record<Field, string>>>({});
  const [ccOpen, setCcOpen] = useState(false);
  const sources: MailSource[] = boxes.map((b) => ({ account: b.id, mailbox: b.state }));
  const contactOf = (address: string): MailContact => ({ name: people.find((p) => same(p.address, address))?.name ?? address });

  const edit = (b: MailInstance, content: DraftContent, field?: Field, text?: string) => {
    const event: MailEvent = { type: "editDraft", content };
    if (!b.can(event)) return;
    if (field) setTyped((t) => ({ ...t, [field]: text }));
    void b.send(event).then(() => field && setTyped((t) => (t[field] === text ? { ...t, [field]: undefined } : t)));
  };

  const pick = (field: MailRecipientField, address: string) => {
    onPicking(null);
    if (box) return edit(box, sendTo(box.state.draft, field, address));
    const from = boxes.find((b) => b.id === startFrom(registry, sources, address));
    const start: MailEvent = { type: "startDraft", reply: false };
    const addressed: MailEvent = { type: "editDraft", content: { ...emptyContent, to: address } };
    if (from?.can(start)) void from.send(start).then((exit) => { if (Exit.isSuccess(exit) && enabled(exit.value, addressed, "MailUser")) void from.send(addressed); });
  };

  if (picking) {
    const sought = picking.query.trim();
    const found: readonly Contact[] = people.filter((p) => `${p.name} ${p.address}`.toLowerCase().includes(sought.toLowerCase()));
    const shown = anAddress.test(sought) && !found.some((p) => same(p.address, sought)) ? [...found, { name: sought, address: sought }] : found;
    const tiles: MailContact[] = shown.map((p) => ({ name: p.name }));
    const first = !box || (picking.field === "to" && box.state.draft.to === "");
    return (
      <MailRecipientPicker question={questions[picking.field]} people={tiles} query={picking.query}
        onQueryChange={(query) => onPicking({ ...picking, query })}
        onPick={(person) => { const chosen = shown[tiles.indexOf(person)]; if (chosen) pick(picking.field, chosen.address); }}
        backLabel={first ? "Inbox" : box.state.replyTo === "" ? "New email" : "Reply"}
        onBack={() => {
          onPicking(null);
          if (!box) void mail.discarded();
          else if (picking.field === "to" && box.state.draft.to === "") void discard(box);
        }} {...frame} />
    );
  }
  if (!box) return null;

  const m = box.state;
  const text = (field: Field) => typed[field] ?? m.draft[field];
  const write = (field: Field, value: string) => edit(box, { ...m.draft, subject: text("subject"), body: text("body"), [field]: value }, field, value);
  const choices = fromChoices(registry, sources).filter((a) => a.id === box.id || canMoveDraft(m, sourceOf(sources, a.id).mailbox));
  const keep: MailEvent = { type: "preserveDraft", draftId: m.draftId };
  const throwAway: MailEvent = { type: "discardDraft", confirmed: true };
  const undeleted = mail.undeleted.has(box.id);
  const removal = (index: number): MailEvent => ({ type: "removeAsset", assetId: m.draftAttachments[index]?.id ?? "" });
  const editable = box.can({ type: "editDraft", content: m.draft });
  const settling = Object.values(typed).some((t) => t !== undefined);
  const sendable = !settling && recipientsValid(m.draft) && box.can({ type: "confirmVisibleSend", revision: m.revision });
  const retry = undeleted ? throwAway : keep;

  return (
    <MailCompose title={m.replyTo === "" ? "New email" : "Reply"} backLabel={m.replyTo === "" ? "Inbox" : `${sender(box)}’s email`}
      from={{ accounts: choices.map((a) => ({ id: a.id, address: a.address, name: a.name })), selected: box.id, onSelect: (id) => { if (id !== box.id) void mail.moveDraft(box.id, id); } }}
      to={recipientsOf(m.draft.to).map(contactOf)} cc={m.draft.cc.map(contactOf)} bcc={m.draft.bcc.map(contactOf)}
      ccOpen={ccOpen} onOpenCc={editable ? () => setCcOpen(true) : undefined}
      onAddRecipient={editable ? (field) => onPicking({ field, query: "" }) : undefined}
      onRemoveRecipient={editable ? (field, index) => edit(box, without(m.draft, field, index)) : undefined}
      subject={text("subject")} onSubjectChange={editable ? (value) => write("subject", value) : undefined}
      body={text("body")} onBodyChange={editable ? (value) => write("body", value) : undefined}
      attachments={m.draftAttachments.map(thumbnail)}
      onRemoveAttachment={editable ? (index) => { if (box.can(removal(index))) void box.send(removal(index)); } : undefined}
      sendStatus={statusOf(m)}
      onSend={sendable ? () => void mail.confirmSend(box.id, m.revision) : undefined}
      onDiscard={box.can(throwAway) ? () => void discard(box) : undefined}
      draftError={m.draftStorage !== "DraftStoreFailed" ? undefined : undeleted ? "This email couldn’t be deleted from Drafts." : "This email couldn’t be saved to Drafts."}
      onRetryDraft={box.can(retry) ? () => void (undeleted ? discard(box) : box.send(keep)) : undefined}
      onBack={leavable(box) ? () => void leave(box) : undefined}
      {...frame}
      onClose={frame.onClose && (() => { void leave(box, mail.hush); frame.onClose?.(); })} />
  );
}

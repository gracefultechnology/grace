// spec/app/email.md, "Story: Write or reply and confirm before sending"; spec/app/email.md, "The visible Send button approves exactly the composer the user sees"; spec/app/email.md, "Back and Close keep a composer worth keeping and close an empty one"; spec/app/email.md, "Back preserves the exact draft and storage failure leaves it recoverable"; spec/app/mailboxes.md, "Story: Send from the right address"; spec/app/mailboxes.md, "From offers each account that has Email on and can send"; spec/app/mailboxes.md, "Changing From moves a draft never saved, whole and unapproved, and a saved draft stays"
import { type MailContact, MailCompose, type MailRecipientField, MailRecipientPicker, type MailSendStatus } from "@repo/ui";
import { use, useState } from "react";
import type { Accounts } from "../gen/app__accounts.ts";
import { type DraftContent, emptyContent, type Event as MailEvent, type Mailbox, type SendStatus } from "../gen/app__email.ts";
import { canMoveDraft, contactAccounts, fromChoices, type MailSource, sourceOf, startFrom } from "../gen/app__mailboxes.ts";
import type { Contact } from "./connector.vibe";
import { recipientsOf, recipientsValid } from "./mail.vibe";
import type { MailInstance, MailWriter } from "./useApp.ts";

export type Picking = { readonly field: MailRecipientField; readonly query: string };
type Field = "subject" | "body";
type Frame = { onClose: () => void; closeLabel: string; inert?: boolean; "aria-hidden"?: boolean };

const questions: Record<MailRecipientField, string> = { to: "Who is it to?", cc: "Who should get a copy?", bcc: "Who should get a hidden copy?" };
const sending: Record<SendStatus, MailSendStatus> = {
  NoDraft: "idle", Composing: "idle", Reviewing: "idle", Sending: "sending", Sent: "idle", SendFailed: "failed", SendUnknown: "unknown",
};
const anAddress = /^[^@\s,;]+@[^@\s,;]+$/;
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

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

function leave(box: MailInstance) {
  const keep: MailEvent = { type: "preserveDraft", draftId: box.state.draftId || `draft-${crypto.randomUUID()}` };
  return closing(box, box.can(keep) ? keep : { type: "closeEmptyComposer" });
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
    if (from?.can(start)) void from.send(start).then(() => from.send({ type: "editDraft", content: { ...emptyContent, to: address } }));
  };

  if (picking) {
    const sought = picking.query.trim();
    const found: readonly Contact[] = people.filter((p) => `${p.name} ${p.address}`.toLowerCase().includes(sought.toLowerCase()));
    const shown = anAddress.test(sought) && !found.some((p) => same(p.address, sought)) ? [...found, { name: sought, address: sought }] : found;
    return (
      <MailRecipientPicker question={questions[picking.field]} people={shown.map((p) => ({ name: p.name }))} query={picking.query}
        onQueryChange={(query) => onPicking({ ...picking, query })}
        onPick={(person) => { const chosen = shown.find((p) => p.name === person.name); if (chosen) pick(picking.field, chosen.address); }}
        backLabel={box ? "New email" : "Inbox"}
        onBack={() => { onPicking(null); if (box && picking.field === "to" && box.state.draft.to === "") void discard(box); }} {...frame} />
    );
  }
  if (!box) return null;

  const m = box.state;
  const text = (field: Field) => typed[field] ?? m.draft[field];
  const write = (field: Field, value: string) => edit(box, { ...m.draft, subject: text("subject"), body: text("body"), [field]: value }, field, value);
  const choices = fromChoices(registry, sources).filter((a) => a.id === box.id || canMoveDraft(m, sourceOf(sources, a.id).mailbox));
  const keep: MailEvent = { type: "preserveDraft", draftId: m.draftId };

  return (
    <MailCompose title={m.replyTo === "" ? "New email" : "Reply"} backLabel={m.replyTo === "" ? "Inbox" : `${sender(box)}’s email`}
      from={{ accounts: choices.map((a) => ({ id: a.id, address: a.address, name: a.name })), selected: box.id, onSelect: (id) => { if (id !== box.id) void mail.moveDraft(box.id, id); } }}
      to={recipientsOf(m.draft.to).map(contactOf)} cc={m.draft.cc.map(contactOf)} bcc={m.draft.bcc.map(contactOf)}
      ccOpen={ccOpen} onOpenCc={() => setCcOpen(true)}
      onAddRecipient={(field) => onPicking({ field, query: "" })}
      onRemoveRecipient={(field, index) => edit(box, without(m.draft, field, index))}
      subject={text("subject")} onSubjectChange={(value) => write("subject", value)}
      body={text("body")} onBodyChange={(value) => write("body", value)}
      sendStatus={statusOf(m)}
      onSend={() => { if (box.can({ type: "confirmVisibleSend", revision: m.revision }) && recipientsValid(m.draft)) void mail.confirmSend(box.id); }}
      onDiscard={() => void discard(box)}
      draftError={m.draftStorage === "DraftStoreFailed" ? "This email couldn’t be saved to Drafts." : undefined}
      onRetryDraft={() => { if (box.can(keep)) void box.send(keep); }}
      onBack={() => void leave(box)}
      {...frame}
      onClose={() => { void leave(box); frame.onClose(); }} />
  );
}

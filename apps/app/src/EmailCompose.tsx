// spec/app/email.md, "Story: Write or reply and confirm before sending"; spec/app/files.md, "Sharing a photo opens a draft without sending it"; spec/app/email.md, "The visible Send button approves exactly the composer the user sees"; spec/app/email.md, "Back and Close keep a composer worth keeping and close an empty one"; spec/app/email.md, "Back preserves the exact draft and storage failure leaves it recoverable"; spec/app/email.md, "The composer remembers who she is choosing for, Cc and Bcc, and where she attaches from"; spec/app/mailboxes.md, "Story: Send from the right address"; spec/app/mailboxes.md, "From offers each account that has Email on and can send"; spec/app/mailboxes.md, "Changing From moves a draft never saved, whole and unapproved, and a saved draft stays"; spec/app/mailboxes.md, "Writing starts at Who is it to?, and Cc and Bcc show once opened or used"; spec/app/files.md, "A photo taken or a file chosen on the device has its own local source identity"
import {
  MailAttachChooser, type MailAttachChooserProps, type MailComposeTarget, type MailContact, MailCompose, type MailPhoto, type MailRecipientField, MailRecipientPicker, type MailSendStatus,
} from "@repo/ui";
import { Effect } from "effect";
import { Suspense, use, useMemo, useState } from "react";
import type { Accounts } from "../gen/app__accounts.ts";
import type { ComposeChoice, DraftContent, Event as MailEvent, Mailbox, SendStatus } from "../gen/app__email.ts";
import { draftMovable, contactAccounts, fromChoices, type MailSource, pickerBack, showsCopies, sourceOf, startFrom } from "../gen/app__mailboxes.ts";
import { sendableAttachments, type Contact } from "./connector.vibe";
import { Library, type SavedPreview } from "./files.vibe";
import { keptOnTablet, recipientsOf, recipientsValid } from "./mail.vibe";
import { type MailInstance, type MailWriter, useRuntime, useWorkspace } from "./useApp.ts";

type Field = "subject" | "body";
type Frame = { onClose?: () => void; closeLabel: string; inert?: boolean; "aria-hidden"?: boolean };
type Source = MailAttachChooserProps["source"];

const composeTargets: readonly MailComposeTarget[] = ["from", "body", "send"];
const questions: Record<MailRecipientField, string> = { to: "Who is it to?", cc: "Who should get a copy?", bcc: "Who should get a hidden copy?" };
const pickedFields: Partial<Record<ComposeChoice, MailRecipientField>> = { PickNewEmail: "to", PickTo: "to", PickCc: "cc", PickBcc: "bcc" };
const pickers: Record<MailRecipientField, ComposeChoice> = { to: "PickTo", cc: "PickCc", bcc: "PickBcc" };
const sources: Partial<Record<ComposeChoice, Source>> = { ChoosePhoto: "photos", ChooseFile: "file" };
const kinds: Record<Source, SavedPreview["file"]["kind"]> = { photos: "Photo", file: "Pdf" };
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
const offered = (box: MailInstance, event: MailEvent) => (box.can(event) ? () => void box.send(event) : undefined);

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
  box: MailInstance;
  mail: MailWriter;
  sender: (box: MailInstance) => string;
  frame: Frame;
};

type Found = Promise<readonly SavedPreview[] | undefined>;
type ChoiceProps = Omit<MailAttachChooserProps, "onChoose"> & { onChoose: (file: SavedPreview) => void };

function AttachChoice({ found, onChoose, ...props }: ChoiceProps & { found: Found }) {
  const saved = use(found);
  return <MailAttachChooser open {...props} failed={saved === undefined}
    items={saved?.map((item) => ({ id: item.file.id, src: item.src, label: item.file.name }))}
    onChoose={(id) => { const item = saved?.find((s) => s.file.id === id); if (item) onChoose(item); }} />;
}

function AttachRead(props: ChoiceProps) {
  const runtime = useRuntime();
  const kind = kinds[props.source];
  const found = useMemo(() => runtime.runPromise(Effect.flatMap(Library, (files) => files.saved((file) => file.kind === kind))), [runtime, kind]);
  return (
    <Suspense fallback={<MailAttachChooser open {...props} onChoose={undefined} />}>
      <AttachChoice found={found} {...props} />
    </Suspense>
  );
}

type PickerProps = {
  field: MailRecipientField; people: readonly Contact[]; backLabel: string; onBack?: () => void; onPick: (address: string) => void; frame: Frame;
};

function RecipientChoice({ field, people, backLabel, onBack, onPick, frame }: PickerProps) {
  const [query, setQuery] = useState("");
  const sought = query.trim();
  const found = people.filter((p) => `${p.name} ${p.address}`.toLowerCase().includes(sought.toLowerCase()));
  const shown = anAddress.test(sought) && !found.some((p) => same(p.address, sought)) ? [...found, { name: sought, address: sought }] : found;
  const tiles: MailContact[] = shown.map((p) => ({ name: p.name }));
  return (
    <MailRecipientPicker question={questions[field]} people={tiles} query={query} onQueryChange={setQuery}
      onPick={(person) => { const chosen = shown[tiles.indexOf(person)]; if (chosen) onPick(chosen.address); }}
      backLabel={backLabel} onBack={onBack} {...frame} />
  );
}

/** @model spec/app/email.md */
export function EmailCompose({ registry, boxes, box, mail, sender, frame }: EmailComposeProps) {
  const people = use(mail.contacts(contactAccounts(registry).join(",")));
  const { guide } = useWorkspace();
  const [typed, setTyped] = useState<Partial<Record<Field, string>>>({});
  const [tries, setTries] = useState(0);
  const [refused, setRefused] = useState(false);
  const m = box.state;
  const source = sources[m.choosing];
  const boxSources: MailSource[] = boxes.map((b) => ({ account: b.id, mailbox: b.state }));
  const contactOf = (address: string): MailContact => ({ name: people.find((p) => same(p.address, address))?.name ?? address });
  const close = frame.onClose && (() => { void leave(box, mail.hush); frame.onClose?.(); });

  const edit = (content: DraftContent, field?: Field, text?: string) => {
    const event: MailEvent = { type: "editDraft", content };
    if (!box.can(event)) return Promise.resolve();
    if (field) setTyped((t) => ({ ...t, [field]: text }));
    return box.send(event).then(() => { if (field) setTyped((t) => (t[field] === text ? { ...t, [field]: undefined } : t)); });
  };

  const throwAway: MailEvent = { type: "discardDraft", confirmed: true };
  const picked = pickedFields[m.choosing];
  if (picked) {
    const first = pickerBack(m) === "DiscardToInbox";
    const pick = async (address: string) => {
      await edit(sendTo(m.draft, picked, address));
      const from = startFrom(registry, boxSources, address);
      if (first && m.draftAttachments.length === 0 && from !== box.id) void mail.moveDraft(box.id, from);
    };
    return (
      <RecipientChoice key={m.choosing} field={picked} people={people} onPick={(address) => void pick(address)}
        backLabel={first ? "Inbox" : m.replyTo === "" ? "New email" : "Reply"}
        onBack={first ? offered(box, throwAway) && (() => void discard(box)) : offered(box, { type: "closeChooser" })}
        frame={{ ...frame, onClose: close }} />
    );
  }

  const text = (field: Field) => typed[field] ?? m.draft[field];
  const write = (field: Field, value: string) => void edit({ ...m.draft, subject: text("subject"), body: text("body"), [field]: value }, field, value);
  const choices = fromChoices(registry, boxSources).filter((a) => a.id === box.id || draftMovable(m, sourceOf(boxSources, a.id).mailbox));
  const keep: MailEvent = { type: "preserveDraft", draftId: m.draftId };
  const undeleted = mail.undeleted.has(box.id);
  const removal = (index: number): MailEvent => ({ type: "removeAsset", assetId: m.draftAttachments[index]?.id ?? "" });
  const editable = box.can({ type: "editDraft", content: m.draft });
  const settling = Object.values(typed).some((t) => t !== undefined);
  const attachmentsValid = sendableAttachments(m.draftAttachments);
  const ready = !settling && attachmentsValid && recipientsValid(m.draft) && box.can({ type: "confirmVisibleSend", revision: m.revision });
  const retry = undeleted ? throwAway : keep;
  const chooser = (choice: ComposeChoice) => offered(box, { type: "openChooser", choice });
  const stopChoosing = () => { setRefused(false); offered(box, { type: "closeChooser" })?.(); };
  const choose = async (item: SavedPreview) => setRefused(!(await mail.attach(box.id, item.file)));
  const attaching = source && {
    source, refused, onCancel: stopChoosing, onRetry: () => setTries((n) => n + 1),
    onOpenChange: (open: boolean) => { if (!open) stopChoosing(); },
  };

  return (
    <>
    <MailCompose guide={guide((target) => composeTargets.find((t) => t === target))} title={m.replyTo === "" ? "New email" : "Reply"} backLabel={m.replyTo === "" ? "Inbox" : `${sender(box)}’s email`}
      from={{ accounts: choices.map((a) => ({ id: a.id, address: a.address, name: a.name })), selected: box.id, onSelect: (id) => { if (id !== box.id) void mail.moveDraft(box.id, id); } }}
      to={recipientsOf(m.draft.to).map(contactOf)} cc={m.draft.cc.map(contactOf)} bcc={m.draft.bcc.map(contactOf)}
      ccOpen={showsCopies(m)} onOpenCc={offered(box, { type: "showCopies" })}
      onAddRecipient={box.can({ type: "openChooser", choice: "PickTo" }) ? (field) => chooser(pickers[field])?.() : undefined}
      onRemoveRecipient={editable ? (field, index) => void edit(without(m.draft, field, index)) : undefined}
      subject={text("subject")} onSubjectChange={editable ? (value) => write("subject", value) : undefined}
      body={text("body")} onBodyChange={editable ? (value) => write("body", value) : undefined}
      attachments={m.draftAttachments.map(thumbnail)}
      onRemoveAttachment={editable ? (index) => offered(box, removal(index))?.() : undefined}
      sendStatus={statusOf(m)}
      onSend={ready ? () => void mail.confirmSend(box.id, m.revision) : undefined}
      onDiscard={offered(box, throwAway) && (() => void discard(box))}
      draftError={!attachmentsValid ? "Remove any unsupported or duplicate files. Email can send up to 10 attachments." :
        m.draftStorage !== "DraftStoreFailed" ? undefined : undeleted ? "This email couldn’t be deleted from Drafts." : keptOnTablet(mail.unsendable.get(box.id) ?? []) ?? "This email couldn’t be saved to Drafts."}
      onRetryDraft={attachmentsValid && box.can(retry) ? () => void (undeleted ? discard(box) : box.send(keep)) : undefined}
      onBack={leavable(box) ? () => void leave(box) : undefined}
      onAttach={{ camera: mail.camera && editable ? () => void mail.capture(box.id) : undefined, photos: chooser("ChoosePhoto"), file: chooser("ChooseFile") }}
      {...frame}
      onClose={close} />
    {attaching && <AttachRead key={tries} onChoose={(item) => void choose(item)} {...attaching} />}
    </>
  );
}

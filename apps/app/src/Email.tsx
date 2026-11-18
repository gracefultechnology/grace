// spec/app/files.md, "Saving one attachment or all selected photos is one acknowledged local transaction"; spec/app/mailboxes.md, "Story: See all my email in one place"; spec/app/mailboxes.md, "All inboxes is the union of the shown accounts’ inboxes"; spec/app/mailboxes.md, "Each account’s banner shows its own state, and offline is not a broken account"; spec/app/mailboxes.md, "A switched-off or removed account shows nothing anywhere"; spec/app/email.md, "Story: Read an email and its original attachment"; spec/app/email.md, "Switching folders clears the old query and starts a scoped listing"
import { type HomeMail, MailApp, type MailFolder, MailMessageView, type MailPhoto, type MailSaveStatus, MailSignInBanner, type MailSummary, MailSyncingRow, PdfViewer, PhotoViewer, Toast } from "@repo/ui";
import { Exit } from "effect";
import { type ReactNode, Suspense, useState } from "react";
import { type Accounts, mailAccounts } from "../gen/app__accounts.ts";
import { emptyContent, enabled, type Event as MailEvent, mayExportAttachments, messageRecord, photoAssets, readable, showsScamWarning } from "../gen/app__email.ts";
import type { Folder, MessageChange } from "../gen/app__emailItem.ts";
import { type Files, hasFile, type SavedFile } from "../gen/app__files.ts";
import { type MailBanner, type MailSource, type Row, accountRows, banners, folderRows, fromChoices, mailContext, openSource, outboxCount, outboxRows, showsMail, undoable, unreadIn } from "../gen/app__mailboxes.ts";
import type { Event as WorkspaceEvent } from "../gen/app__workspace.ts";
import type { Attached, MailContent } from "./connector.vibe";
import { EmailCompose, type Picking, thumbnail } from "./EmailCompose.tsx";
import { answerable, headerFor, recipientsOf } from "./mail.vibe";
import { type MailInstance, type MailWriter, useAccounts, useFiles, useMail, useMailContent, useMailFile, useWorkspace, WithMailboxes } from "./useApp.ts";

type Covered = { inert?: boolean; "aria-hidden"?: boolean };
type Read = (id: number, ref: string) => MailContent | undefined;
type Frame = Covered & { onClose?: () => void; closeLabel: string };
type Saver = { status: (files: readonly SavedFile[]) => MailSaveStatus | undefined; offer: (refs: readonly string[]) => (() => void) | undefined };

const folders: Record<Exclude<MailFolder, "outbox">, Folder> = { inbox: "InboxFolder", sent: "SentFolder", drafts: "DraftsFolder", trash: "TrashFolder" };
const backTo: Record<Folder, string> = { InboxFolder: "Inbox", SentFolder: "Sent", DraftsFolder: "Inbox", TrashFolder: "Trash", PurgedFolder: "Inbox" };
const folderOf = (folder: Folder) => (Object.keys(folders) as (keyof typeof folders)[]).find((f) => folders[f] === folder) ?? "inbox";
const sourcesOf = (boxes: readonly MailInstance[]): MailSource[] => boxes.map((b) => ({ account: b.id, mailbox: b.state }));
const pages = (n: number) => `${n} page${n === 1 ? "" : "s"}`;
const close = "Close Email";
const unlinked = (body: string) => body.replace(/https?:\/\/\S+/g, "(link removed)");
const unshown = "This attachment couldn’t be shown";
const unrendered = "This PDF can’t be shown on this tablet.";

function picture(file: SavedFile, held: Attached | undefined): MailPhoto {
  return held ? { src: `data:${held.mimeType};base64,${held.data}`, alt: file.name } : thumbnail(file);
}

function saverOf(box: MailInstance, mail: MailWriter | undefined, files: Files | undefined): Saver {
  return {
    status: (chosen) => {
      if (chosen.length > 0 && files?.loaded && chosen.every((f) => hasFile(files, f.id))) return "saved";
      const marks = chosen.map((f) => mail?.saves.get(f.id));
      return marks.includes("saving") ? "saving" : marks.includes("failed") ? "failed" : undefined;
    },
    offer: (refs) => (mail && refs.length > 0 && mayExportAttachments(box.state, [...refs]) ? () => void mail.save(box.id, refs) : undefined),
  };
}

function when(at: number, now: Date) {
  if (now.getTime() - at < 60_000) return "Just now";
  const day = new Date(at);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (day.toDateString() === now.toDateString()) return day.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (day.toDateString() === yesterday.toDateString()) return "Yesterday";
  return day.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function named(text: string, nameOf: (address: string) => string) {
  const [, display = "", address = text] = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(text) ?? [];
  const known = nameOf(address.trim());
  return known !== address.trim() ? known : display || known;
}

const newest = (read: Read) => (a: Row, b: Row) =>
  (read(b.account, b.record.identity.ref)?.receivedAt ?? 0) - (read(a.account, a.record.identity.ref)?.receivedAt ?? 0);

export function homeMail(registry: Accounts, boxes: readonly MailInstance[], read: Read): HomeMail[] {
  return mailContext(registry, sourcesOf(boxes))
    .filter((r) => r.record.folder === "InboxFolder")
    .sort((a, b) => Number(b.record.unread) - Number(a.record.unread) || newest(read)(a, b))
    .map((r) => {
      const c = read(r.account, r.record.identity.ref);
      return { id: `${r.account}/${r.record.identity.ref}`, name: c?.from ?? "", subject: c?.subject ?? "", unread: r.record.unread };
    });
}

/** @model spec/app/mailboxes.md */
export function Email(props: Covered) {
  const { accounts } = useAccounts();
  if (!accounts) return null;
  return <WithMailboxes ids={accounts.accounts.map((a) => a.id)}>{(boxes) => <Mail registry={accounts} boxes={boxes} {...props} />}</WithMailboxes>;
}

function Mail({ registry, boxes, ...props }: Covered & { registry: Accounts; boxes: readonly MailInstance[] }) {
  const { workspace, can, send } = useWorkspace();
  const account = useAccounts();
  const read = useMailContent();
  const held = useMailFile();
  const files = useFiles();
  const mail = useMail();
  const [picking, setPicking] = useState<Picking | null>(null);
  const [outboxChosen, setOutboxChosen] = useState(false);
  if (!workspace) return null;
  const now = new Date();
  const online = workspace.device.connectivity === "Online";
  const fire = (event: WorkspaceEvent) => (can(event) ? () => void send(event) : undefined);
  const home: WorkspaceEvent = { type: "visit", destination: "Home" };
  const frame = { onClose: fire(home), closeLabel: close, ...props };
  const accountSettings: WorkspaceEvent = { type: "chooseSettingsPage", page: "EmailCalendarSettings" };
  if (mailAccounts(registry).length === 0)
    return <MailApp noAccount folder="inbox" messages={[]} onConnect={fire(accountSettings)} onAskGrace={fire({ type: "openGrace" })} {...frame} />;

  const sources = sourcesOf(boxes);
  const shown = boxes.filter((b) => showsMail(registry, b.id));
  const name = (id: number) => registry.accounts.find((a) => a.id === id)?.name ?? "";
  const filter = (id: number) => { if (account.can({ type: "filterInbox", id })) void account.send({ type: "filterInbox", id }); };
  const renew = (id: number) => account.can({ type: "signInAgain", id }) && can(accountSettings)
    ? () => void account.send({ type: "signInAgain", id }).then((exit) => Exit.isSuccess(exit) && fire(accountSettings)?.())
    : undefined;
  const offer = (b: MailInstance, event: MailEvent) => (b.can(event) ? () => void b.send(event) : undefined);
  const sender = (b: MailInstance) => read(b.id, b.state.replyTo)?.from ?? "";

  const composing = shown.find((b) => b.state.composeVisible);
  if (mail && (composing || picking))
    return (
      <Suspense fallback={null}>
        <EmailCompose key={composing?.id ?? 0} registry={registry} boxes={shown} box={composing} picking={picking} onPicking={setPicking} mail={mail} sender={sender} frame={frame} />
      </Suspense>
    );

  const opening = shown.find((b) => b.id === openSource(registry, sources)) ?? shown.find((b) => b.state.readKind !== "Search" && b.state.readStatus !== "ReadIdle");
  if (opening) {
    const m = opening.state;
    const ready = m.view !== "Inbox";
    const ref = ready ? m.messageRef : m.requestedRef;
    const c = read(opening.id, ref);
    const forwarded = (sent: ReturnType<MailInstance["send"]>) => void sent.then((exit) => Exit.isSuccess(exit) && setPicking({ field: "to", query: "" }));
    const saver = saverOf(opening, mail, files);
    const unopened = m.view === "Message" && m.readKind === "OpenAttachment" && m.readStatus === "ReadFailed";
    const toast = unopened ? <Toast placement="screen">{unshown}</Toast> : mail?.note ? <Toast key={mail.note.id} placement="screen">{mail.note.text}</Toast> : undefined;
    if (m.view === "Attachment")
      return <Attachment box={opening} held={held} saver={saver} sender={c?.from ?? ""} subject={c?.subject ?? ""} onForward={forwarded} toast={toast} frame={frame} />;
    const open: MailEvent = { type: "readMail", kind: "OpenMessage", ref, approved: true };
    const target = { ref, revision: messageRecord(m, ref).revision };
    const change = (kind: MessageChange) => offer(opening, { type: "changeSelectedMessage", target, change: kind });
    const forward: MailEvent = { type: "forwardMessage", content: { ...emptyContent, subject: `Fwd: ${c?.subject ?? ""}`, body: unlinked(c?.body ?? "") } };
    const photos = photoAssets(m);
    const pdfs = m.assets.filter((a) => a.kind === "Pdf");
    const attachment = (file: SavedFile): MailEvent => ({ type: "readMail", kind: "OpenAttachment", ref: file.sourceRef, approved: true });
    const opener = (chosen: readonly SavedFile[]) => chosen.some((f) => opening.can(attachment(f))) ? (i: number) => { const f = chosen[i]; if (f) offer(opening, attachment(f))?.(); } : undefined;
    const allPhotos = photos.map((p) => p.sourceRef);
    return (
      <>
      <MailMessageView from={{ name: c?.from ?? "" }} address={showsScamWarning(m) ? c?.fromAddress : undefined} time={c ? when(c.receivedAt, now) : ""} subject={c?.subject ?? ""} body={c?.body ?? ""}
        scam={showsScamWarning(m)} inTrash={messageRecord(m, ref).folder === "TrashFolder"}
        photos={ready ? photos.map((p) => picture(p, held(opening.id, p.sourceRef))) : undefined} onOpenPhoto={opener(photos)}
        onSaveAll={saver.offer(allPhotos)} saveAllStatus={saver.status(photos)} onRetrySaveAll={saver.offer(allPhotos)}
        files={ready ? pdfs.map((a) => ({ name: a.name, detail: pages(a.pages) })) : undefined} onOpenFile={opener(pdfs)}
        status={ready ? "ready" : m.readStatus === "Reading" ? "loading" : "failed"}
        onRetry={offer(opening, open)}
        onReply={mail && ready && answerable(m) && (online || headerFor(mail, opening.id, m)) ? () => void mail.reply(opening.id) : undefined}
        onForward={mail && opening.can(forward) ? () => forwarded(opening.send(forward)) : undefined}
        onDelete={change("TrashMessage")} onRestore={change("RestoreMessage")} onDeleteForever={change("PurgeMessage")}
        backLabel={backTo[m.folder]} onBack={offer(opening, { type: "showInbox" })} {...frame} />
      {toast}
      </>
    );
  }

  const lead = (shown.find((b) => readable(b.state)) ?? shown[0])?.state;
  const folder: Folder = lead?.folder ?? "InboxFolder";
  const rows = accountRows(registry, sources);
  const waitingCount = outboxCount(registry, sources);
  const outbox = outboxChosen && waitingCount > 0;
  const waiting: MailSummary[] = outboxRows(registry, sources).map((r) => ({
    id: `${r.account}/${r.queued.operationId}`, from: { name: mail?.nameOf(r.queued.snapshot.content.to) ?? recipientsOf(r.queued.snapshot.content.to)[0] ?? "" }, subject: r.queued.snapshot.content.subject, time: "",
    account: rows.length ? name(r.account) : undefined,
  }));
  const theirs = folder === "DraftsFolder" || folder === "SentFolder";
  const party = (c: MailContent | undefined) => {
    if (!theirs) return c?.from ?? "";
    const to = c?.to[0] ? named(c.to[0], mail?.nameOf ?? ((a) => a)) : "";
    return folder === "SentFolder" ? to : to ? `To ${to}` : "No one yet";
  };
  const listed: MailSummary[] = folderRows(registry, sources, folder).sort(newest(read)).map((r) => {
    const c = read(r.account, r.record.identity.ref);
    return {
      id: `${r.account}/${r.record.identity.ref}`, from: { name: party(c) }, subject: theirs && c?.subject === "" ? "(no subject)" : c?.subject ?? "", time: c ? when(c.receivedAt, now) : "",
      unread: r.record.unread, account: rows.length ? name(r.account) : undefined,
    };
  });
  const notice = (b: MailBanner): ReactNode => {
    switch (b.kind) {
      case "OfflineBanner": return null;
      case "SignInBanner": return <MailSignInBanner key={`sign-in-${b.account}`} name={name(b.account)} others={b.othersFine} onSignIn={renew(b.account)} />;
      case "SyncingRow": return <MailSyncingRow key={`syncing-${b.account}`} name={name(b.account)} />;
      default: {
        const _exhaustive: never = b.kind;
        return _exhaustive;
      }
    }
  };
  const shownBanners = banners(registry, sources, online);
  const notes = shownBanners.filter((b) => b.kind !== "OfflineBanner").map(notice);
  const failed = shown.filter((b) => b.state.readKind === "Search" && b.state.readStatus === "ReadFailed");
  const search = (query: string): MailEvent => ({ type: "readMail", kind: "Search", ref: query, approved: true });
  const undo = shown.flatMap((b) => undoable(b.state).map((r) => ({ b, event: { type: "undoMessageTrash", target: { ref: r.identity.ref, revision: r.undoRevision } } satisfies MailEvent })))[0];
  const toast = undo ? <Toast placement="screen" onUndo={offer(undo.b, undo.event)}>Moved to Trash</Toast>
    : mail?.note ? <Toast key={mail.note.id} placement="screen">{mail.note.text}</Toast> : undefined;
  const writable = mail && fromChoices(registry, sources).some((a) => shown.find((b) => b.id === a.id)?.can({ type: "startDraft", reply: false }));
  const replace = (b: MailInstance, event: MailEvent) => {
    const stop: MailEvent = { type: "showInbox" };
    if (b.can(event)) void b.send(event);
    else if (b.state.readStatus === "Reading" && b.state.readKind === "Search" && b.can(stop))
      void b.send(stop).then((exit) => { if (Exit.isSuccess(exit) && enabled(exit.value, event, "MailUser")) void b.send(event); });
  };
  const show = (chosen: Folder) => shown.forEach((b) => {
    if (b.state.folder !== chosen) replace(b, { type: "chooseFolder", folder: chosen });
    else if (b.state.query !== "") replace(b, search(""));
  });

  return (
    <MailApp folder={outbox ? "outbox" : folderOf(folder)} counts={{ inbox: unreadIn(registry, sources, 0), outbox: waitingCount }}
      accounts={rows} account={registry.inboxFilter || undefined} banners={notes.length ? notes : undefined} messages={outbox ? waiting : listed} toast={toast}
      onWrite={writable ? () => setPicking({ field: "to", query: "" }) : undefined}
      status={shownBanners.some((b) => b.kind === "OfflineBanner") ? "offline" : failed.length ? "failed" : "ready"}
      query={lead?.query ?? ""}
      onQueryChange={(query) => shown.forEach((b) => replace(b, search(query)))}
      onRetry={failed.some((b) => b.can(search(b.state.query))) ? () => failed.forEach((b) => offer(b, search(b.state.query))?.()) : undefined}
      onSelectFolder={(chosen) => {
        setOutboxChosen(chosen === "outbox");
        if (chosen === "outbox") return;
        if (registry.inboxFilter !== 0) filter(0);
        show(folders[chosen]);
      }}
      onAccount={(id) => { setOutboxChosen(false); filter(id); show("InboxFolder"); }}
      onOpen={(id) => {
        const [owner, ...rest] = id.split("/");
        const box = shown.find((b) => b.id === Number(owner));
        const ref = rest.join("/");
        const event: MailEvent = outbox ? { type: "reopenQueued", operationId: ref } : { type: "readMail", kind: "OpenMessage", ref, approved: true };
        if (box?.can(event)) void box.send(event);
      }}
      onFixWifi={fire({ type: "chooseSettingsPage", page: "NetworkSettings" })} {...frame} />
  );
}

type AttachmentProps = {
  box: MailInstance; held: (id: number, ref: string) => Attached | undefined; saver: Saver; sender: string; subject: string;
  onForward: (sent: ReturnType<MailInstance["send"]>) => void; toast: ReactNode; frame: Frame;
};

function Attachment({ box, held, saver, sender, subject, onForward, toast, frame }: AttachmentProps) {
  const m = box.state;
  const ref = m.readKind === "OpenAttachment" && m.readStatus !== "ReadIdle" ? m.requestedRef : m.attachmentRef;
  const file = m.assets.find((a) => a.sourceRef === ref);
  if (!file) return null;
  const offer = (event: MailEvent) => (box.can(event) ? () => void box.send(event) : undefined);
  const status = m.readStatus === "Reading" ? "loading" : m.readStatus === "ReadFailed" ? "failed" : "ready";
  const back = offer({ type: "backToMessage" });
  const shown = held(box.id, file.sourceRef);
  const save = { onSave: saver.offer([file.sourceRef]), saveStatus: saver.status([file]) };
  const leave = { backLabel: back && `${sender}’s email`, onBack: back, onRetry: offer({ type: "readMail", kind: "OpenAttachment", ref: m.requestedRef, approved: true }), status, ...frame } as const;
  if (file.kind === "Pdf")
    return (
      <>
        <PdfViewer title={file.name} pageLabel={`Page 1 of ${file.pages}`} savable={save.onSave !== undefined} {...save} onRetryAction={save.onSave} {...leave}>
          {shown ? <object data={`data:${shown.mimeType};base64,${shown.data}`} type={shown.mimeType} aria-label={file.name} className="h-[640px] w-full">{unrendered}</object> : unrendered}
        </PdfViewer>
        {toast}
      </>
    );
  const photos = photoAssets(m);
  const at = photos.findIndex((p) => p.sourceRef === file.sourceRef);
  const forward: MailEvent = { type: "forwardAttachment", content: { ...emptyContent, subject: `Fwd: ${subject}` } };
  return (
    <>
      <PhotoViewer title={`Photo ${at + 1} of ${photos.length}`} {...picture(file, shown)} first={at === 0} last={at === photos.length - 1}
        onPrevious={offer({ type: "movePhoto", direction: -1 })} onNext={offer({ type: "movePhoto", direction: 1 })}
        {...save} onRetrySave={save.onSave}
        onForward={box.can(forward) ? () => onForward(box.send(forward)) : undefined} {...leave} />
      {toast}
    </>
  );
}

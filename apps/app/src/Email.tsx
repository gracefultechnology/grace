// spec/app/files.md, "Saving one attachment or all selected photos is one acknowledged local transaction"; spec/app/mailboxes.md, "Story: See all my email in one place"; spec/app/mailboxes.md, "All inboxes is the union of the shown accounts’ inboxes"; spec/app/mailboxes.md, "Each account’s banner shows its own state, and offline is not a broken account"; spec/app/mailboxes.md, "A switched-off or removed account shows nothing anywhere"; spec/app/email.md, "Story: Read an email and its original attachment"; spec/app/email.md, "Switching folders clears the old query and starts a scoped listing"; spec/app/mailboxes.md, "With no account’s Email on, Email offers only Connect your email and Ask Grace"; spec/app/mailboxes.md, "The Home Email card says Not connected, Waiting for the internet, or how many are new"; spec/app/mailboxes.md, "Choosing Outbox shows its waiting email, and an emptied Outbox gives way to the folder"; spec/app/agentActions.md, "Grace opens a setting, and points only at what is on the screen"
import { type Guide, type GuidePointing, type HomeEmailCardProps, type HomeMail, MailApp, type MailContact, type MailFolder, MailLink, type MailMessageTarget, MailMessageView, type MailPhoto, type MailSaveStatus, MailSignInBanner, type MailSummary, MailSyncingRow, PdfViewer, PhotoViewer, Toast } from "@repo/ui";
import { Exit } from "effect";
import { type ReactNode, Suspense, useState } from "react";
import type { Accounts } from "../gen/app__accounts.ts";
import { canReplyToMessage, emptyContent, enabled, type Event as MailEvent, mayExportAttachments, messageRecord, photoAssets, readable, showsScamWarning } from "../gen/app__email.ts";
import type { Folder, MessageChange } from "../gen/app__emailItem.ts";
import { type Files, hasFile, type SavedFile } from "../gen/app__files.ts";
import { type HomeMailStatus, type MailBanner, type MailSource, type Row, accountRows, banners, draftsIn, folderRows, fromChoices, homeRows, homeStatus, openSource, outboxCount, outboxRows, showsConnect, showsMail, showsOutbox, undoable, unreadIn } from "../gen/app__mailboxes.ts";
import type { Event as WorkspaceEvent } from "../gen/app__workspace.ts";
import type { Attached, MailContent } from "./connector.vibe";
import { EmailCompose, type Picking, thumbnail } from "./EmailCompose.tsx";
import { answerable, headerFor, queuedAt, recipientsOf } from "./mail.vibe";
import { type MailInstance, type MailWriter, useAccounts, useFiles, useMail, useMailContent, useMailFile, useMailHeld, useWorkspace, WithMailboxes } from "./useApp.ts";

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
const links = /https?:\/\/\S*[^\s.,;:!?)\]'"]/;
const unlinked = (body: string) => body.replace(new RegExp(links.source, "g"), "(link removed)");
const tones = [1, 2, 3, 4, 5, 6] as const;
const toneOf = (key: string) => tones[[...key.trim().toLowerCase()].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 9973, 0) % tones.length];
const contact = (name: string, address: string): MailContact => ({ name, tone: toneOf(address || name) });
const linked = (body: string, guide: GuidePointing | undefined) => {
  const parts = body.split(new RegExp(`(${links.source})`, "g"));
  const starts = parts.map((_, i) => parts.slice(0, i).join("").length);
  return parts.map((part, i) => (i % 2 ? <MailLink key={starts[i]} guide={i === 1 ? guide : undefined}>{part}</MailLink> : part));
};
const unshown = "This attachment couldn’t be shown";
const unrendered = "This PDF can’t be shown on this tablet.";

function picture(file: SavedFile, held: Attached | undefined): MailPhoto {
  return held ? { src: `data:${held.mimeType};base64,${held.data}`, alt: file.name } : thumbnail(file);
}

function saverOf(box: MailInstance, mail: MailWriter | undefined, files: Files | undefined): Saver {
  return {
    status: (chosen) => {
      if (!files || chosen.length === 0) return undefined;
      if (files.loaded && chosen.every((f) => hasFile(files, f.id))) return "saved";
      if (files.pending === "SavingFiles" && chosen.some((f) => files.pendingFiles.some((p) => p.id === f.id))) return "saving";
      return chosen.some((f) => mail?.unsaved.has(f.id)) ? "failed" : undefined;
    },
    offer: (refs) => (mail && files?.pending === "NoFileOperation" && refs.length > 0 && mayExportAttachments(box.state, [...refs]) ? () => void mail.save(box.id, refs) : undefined),
  };
}

const notices: Record<MailBanner["kind"], (b: MailBanner, name: string, onSignIn?: () => void) => ReactNode> = {
  OfflineBanner: () => null,
  SignInBanner: (b, name, onSignIn) => <MailSignInBanner key={`sign-in-${b.account}`} name={name} others={b.othersFine} onSignIn={onSignIn} />,
  SyncingRow: (b, name) => <MailSyncingRow key={`syncing-${b.account}`} name={name} />,
};

function when(at: number, now: Date) {
  if (now.getTime() - at < 60_000) return "Just now";
  const day = new Date(at);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (day.toDateString() === now.toDateString()) return day.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (day.toDateString() === yesterday.toDateString()) return "Yesterday";
  return day.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const parts = (text: string) => {
  const [, display = "", address = text] = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(text) ?? [];
  return { display, address: address.trim() };
};
const addressOf = (text: string) => parts(text).address;

function named(text: string, nameOf: (address: string) => string) {
  const { display, address } = parts(text);
  const known = nameOf(address);
  return known !== address ? known : display || known;
}

const newest = (read: Read) => (a: Row, b: Row) =>
  (read(b.account, b.record.identity.ref)?.receivedAt ?? 0) - (read(a.account, a.record.identity.ref)?.receivedAt ?? 0);

const homeStatuses = (status: HomeMailStatus): Pick<HomeEmailCardProps, "status" | "waiting" | "notConnected"> => {
  switch (status.tag) {
    case "NotConnected": return { notConnected: true };
    case "WaitingForInternet": return { status: "Waiting for the internet", waiting: "New email will arrive when you’re back online." };
    case "NewCount": return { status: `${status.count} new` };
    case "NoNew": return { status: "No new email" };
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
};

export function homeMail(registry: Accounts, boxes: readonly MailInstance[], read: Read, online: boolean): Pick<HomeEmailCardProps, "messages" | "status" | "waiting" | "notConnected"> {
  const sources = sourcesOf(boxes);
  const messages: HomeMail[] = homeRows(registry, sources).toSorted(newest(read)).slice(0, 2).map((r) => {
    const c = read(r.account, r.record.identity.ref);
    return { id: `${r.account}/${r.record.identity.ref}`, ...contact(c?.from ?? "", c?.fromAddress ?? ""), subject: c?.subject ?? "", unread: r.record.unread };
  });
  return { messages, ...homeStatuses(homeStatus(registry, sources, online)) };
}

type Ringed = MailMessageTarget | "link";
const ringed: readonly string[] = ["caution", "mbody", "saveall", "file", "link"] satisfies readonly Ringed[];
const isRinged = (target: string): target is Ringed => ringed.includes(target);
const aimed = (guide: Guide<Ringed> | undefined): { message?: Guide<MailMessageTarget>; link?: GuidePointing } => {
  if (!guide) return {};
  const { targetId, ...pointing } = guide;
  return targetId === "link" ? { link: pointing } : { message: { ...pointing, targetId } };
};
const rowOf = (target: string) => /^mail:(\d+):(.+)$/.exec(target)?.slice(1).join("/");

/** @model spec/app/mailboxes.md */
export function Email(props: Covered) {
  const { accounts } = useAccounts();
  if (!accounts) return null;
  return <WithMailboxes ids={accounts.accounts.map((a) => a.id)}>{(boxes) => <Mail registry={accounts} boxes={boxes} {...props} />}</WithMailboxes>;
}

function Mail({ registry, boxes, ...props }: Covered & { registry: Accounts; boxes: readonly MailInstance[] }) {
  const { workspace, can, send, guide, askGrace } = useWorkspace();
  const account = useAccounts();
  const read = useMailContent();
  const kept = useMailHeld();
  const held = useMailFile();
  const files = useFiles();
  const mail = useMail();
  const [picking, setPicking] = useState<Picking | null>(null);
  const [outboxChosen, setOutboxChosen] = useState(false);
  const sources = sourcesOf(boxes);
  if (!workspace) return null;
  const now = new Date();
  const online = workspace.device.connectivity === "Online";
  const fire = (event: WorkspaceEvent) => (can(event) ? () => void send(event) : undefined);
  const home: WorkspaceEvent = { type: "visit", destination: "Home" };
  const frame = { onClose: fire(home), closeLabel: close, ...props };
  const accountSettings: WorkspaceEvent = { type: "chooseSettingsPage", page: "EmailCalendarSettings" };
  if (showsConnect(registry))
    return <MailApp noAccount folder="inbox" messages={[]} onConnect={fire(accountSettings)} onAskGrace={askGrace("connectEmail")} {...frame} />;

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
    const header = mail && headerFor(mail, kept(opening.id, m.messageRef), opening.id, m);
    const replying = mail && ready && answerable(m) && header && canReplyToMessage(m, header, "MailHost");
    const scam = showsScamWarning(m);
    const saveAll = saver.offer(allPhotos);
    const present: Record<Ringed, boolean> = {
      caution: scam, mbody: ready, saveall: ready && photos.length > 0 && saveAll !== undefined, file: ready && pdfs.length > 0, link: ready && links.test(c?.body ?? ""),
    };
    const pointing = aimed(guide((target) => (isRinged(target) && present[target] ? target : undefined)));
    return (
      <>
      <MailMessageView from={contact(c?.from ?? "", c?.fromAddress ?? "")} address={scam ? c?.fromAddress : undefined} time={c ? when(c.receivedAt, now) : ""} subject={c?.subject ?? ""} body={linked(c?.body ?? "", pointing.link)} guide={pointing.message}
        scam={scam} inTrash={messageRecord(m, ref).folder === "TrashFolder"}
        photos={ready ? photos.map((p) => picture(p, held(opening.id, p))) : undefined} onOpenPhoto={opener(photos)}
        onSaveAll={saveAll} saveAllStatus={saver.status(photos)} onRetrySaveAll={saver.offer(allPhotos)}
        files={ready ? pdfs.map((a) => ({ name: a.name, detail: pages(a.pages) })) : undefined} onOpenFile={opener(pdfs)}
        status={ready ? "ready" : m.readStatus === "Reading" ? "loading" : "failed"}
        onRetry={offer(opening, open)}
        onReply={replying ? () => void mail.reply(opening.id) : undefined}
        onForward={m.folder !== "DraftsFolder" && opening.can(forward) ? () => forwarded(opening.send(forward)) : undefined}
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
  const outbox = showsOutbox(registry, sources, outboxChosen);
  const untitled = (subject: string | undefined) => subject === "" ? "(no subject)" : subject ?? "";
  const waiting: MailSummary[] = outboxRows(registry, sources).map((r) => {
    const at = queuedAt(r.queued.operationId);
    return {
      id: `${r.account}/${r.queued.operationId}`, from: contact(mail?.nameOf(r.queued.snapshot.content.to) ?? recipientsOf(r.queued.snapshot.content.to)[0] ?? "", recipientsOf(r.queued.snapshot.content.to)[0] ?? ""),
      subject: untitled(r.queued.snapshot.content.subject), time: Number.isNaN(at) ? "" : when(at, now), attachment: r.queued.snapshot.attachments.length > 0,
      account: rows.length ? name(r.account) : undefined,
    };
  });
  const theirs = folder === "DraftsFolder" || folder === "SentFolder";
  const party = (c: MailContent | undefined): MailContact => {
    if (!theirs) return contact(c?.from ?? "", c?.fromAddress ?? "");
    const to = c?.to[0] ? named(c.to[0], mail?.nameOf ?? ((a) => a)) : "";
    const address = c?.to[0] ? addressOf(c.to[0]) : "";
    if (folder === "SentFolder" || !to) return contact(folder === "SentFolder" ? to : "No one yet", address || to);
    return { ...contact(`To ${to}`, address || to), mark: [...to][0]?.toUpperCase() };
  };
  const listed: MailSummary[] = folderRows(registry, sources, folder).sort(newest(read)).map((r) => {
    const c = read(r.account, r.record.identity.ref);
    return {
      id: `${r.account}/${r.record.identity.ref}`, from: party(c),
      subject: r.record.answered && c?.replied ? `You replied: “${c.replied.slice(0, 28)}…”` : theirs ? untitled(c?.subject) : c?.subject ?? "",
      time: c ? when(c.receivedAt, now) : "", unread: r.record.unread, attachment: c?.attachment, account: rows.length ? name(r.account) : undefined,
    };
  });
  const shownBanners = banners(registry, sources, online);
  const notes = shownBanners.filter((b) => b.kind !== "OfflineBanner").map((b) => notices[b.kind](b, name(b.account), renew(b.account)));
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
  const onScreen = new Set((outbox ? waiting : listed).map((r) => r.id));
  const rowGuide = guide((target) => { const id = rowOf(target); return id !== undefined && onScreen.has(id) ? id : undefined; });
  const show = (chosen: Folder) => shown.forEach((b) => {
    if (b.state.folder !== chosen) replace(b, { type: "chooseFolder", folder: chosen });
    else if (b.state.query !== "") replace(b, search(""));
  });

  return (
    <MailApp folder={outbox ? "outbox" : folderOf(folder)} counts={{ inbox: unreadIn(registry, sources, 0), drafts: draftsIn(registry, sources), outbox: waitingCount }}
      guide={rowGuide} accounts={rows} account={registry.inboxFilter || undefined} banners={notes.length ? notes : undefined} messages={outbox ? waiting : listed} toast={toast}
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
  box: MailInstance; held: (id: number, file: SavedFile) => Attached | undefined; saver: Saver; sender: string; subject: string;
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
  const shown = held(box.id, file);
  const save = { onSave: saver.offer([file.sourceRef]), saveStatus: saver.status([file]) };
  const leave = { backLabel: back && `${sender}’s email`, onBack: back, onRetry: offer({ type: "readMail", kind: "OpenAttachment", ref: m.requestedRef, approved: true }), status, ...frame } as const;
  if (file.kind === "Pdf")
    return (
      <>
        <PdfViewer title={file.name} pageLabel={`Page 1 of ${file.pages}`} savable={save.onSave !== undefined || save.saveStatus !== undefined} {...save} onRetryAction={save.onSave} {...leave}>
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

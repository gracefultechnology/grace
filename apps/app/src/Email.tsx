// spec/app/files.md, "Saving one attachment or all selected photos is one acknowledged local transaction"; spec/app/mailboxes.md, "Story: See all my email in one place"; spec/app/mailboxes.md, "All inboxes is the union of the shown accounts’ inboxes"; spec/app/mailboxes.md, "Each account’s banner shows its own state, and offline is not a broken account"; spec/app/mailboxes.md, "A switched-off or removed account shows nothing anywhere"; spec/app/email.md, "Story: Read an email and its original attachment"; spec/app/email.md, "Switching folders clears the old query and starts a scoped listing"; spec/app/mailboxes.md, "With no account’s Email on, Email offers only Connect your email and Ask Grace"; spec/app/mailboxes.md, "The Home Email card says Waiting for the internet, Not connected, or how many are new"; spec/app/mailboxes.md, "Choosing Outbox shows its waiting email, and an emptied Outbox gives way to the folder"; spec/app/agentActions.md, "Grace opens a setting, and points only at what is on the screen"; spec/app/mailboxes.md, "Drafts counts the shown accounts’ saved drafts"
import { BrowserDialog, BrowserDialogText, Button, type Guide, type GuidePointing, MailApp, type MailContact, type MailFolder, MailLink, type MailMessageTarget, MailMessageView, type MailPhoto, type MailSaveStatus, MailSignInBanner, type MailSummary, MailSyncingRow, PdfViewer, PhotoViewer, Toast } from "@repo/ui";
import { Exit } from "effect";
import { type ReactNode, Suspense, useMemo, useState } from "react";
import { useMachine as useMailChoices } from "../gen/app__mailboxes.react.ts";
import type { Accounts, Event as AccountEvent } from "../gen/app__accounts.ts";
import { canReplyToMessage, emptyContent, enabled, type Event as MailEvent, mayExportAttachments, messageRecord, photoAssets, readable, showsScamWarning } from "../gen/app__email.ts";
import type { Folder, MessageChange } from "../gen/app__emailItem.ts";
import { type Files, hasFile, type SavedFile } from "../gen/app__files.ts";
import { type MailBanner, type MailSource, type Row, accountRows, banners, draftsIn, folderRows, fromChoices, openSource, outboxCount, outboxRows, showsConnect, showsMail, showsOutbox, startFrom, undoable, unreadIn } from "../gen/app__mailboxes.ts";
import type { Event as WorkspaceEvent } from "../gen/app__workspace.ts";
import type { Attached, MailContent } from "./connector.vibe";
import { EmailCompose } from "./EmailCompose.tsx";
import { chooseMailLink, type LinkChoice } from "./mailLink.vibe";
import { messageLinkParts } from "./messageLinks.vibe";
import { answerable, headerFor, queuedAt, recipientsOf } from "./mail.vibe";
import { type MailInstance, type MailWriter, mailThumbnail, useAccountIds, useAccounts, useFiles, useMail, useMailContent, useMailFile, useMailHeld, useMinute, useRuntime, useWorkspace, WithMailboxes } from "./useApp.ts";

type Covered = { inert?: boolean; "aria-hidden"?: boolean };
type Read = (id: number, ref: string) => MailContent | undefined;
type Frame = Covered & { onClose?: () => void; closeLabel: string };
type Saver = { status: (files: readonly SavedFile[]) => MailSaveStatus | undefined; offer: (refs: readonly string[]) => (() => void) | undefined };

const folders: Record<Exclude<MailFolder, "outbox">, Folder> = { inbox: "InboxFolder", sent: "SentFolder", drafts: "DraftsFolder", trash: "TrashFolder" };
const backTo: Record<Folder, string> = { InboxFolder: "Inbox", SentFolder: "Sent", DraftsFolder: "Inbox", TrashFolder: "Trash", PurgedFolder: "Inbox" };
const folderEntries = Object.entries(folders) as [Exclude<MailFolder, "outbox">, Folder][];
const folderOf = (folder: Folder) => folderEntries.find(([, f]) => f === folder)?.[0] ?? "inbox";
const sourcesOf = (boxes: readonly MailInstance[]): MailSource[] => boxes.map((b) => ({ account: b.id, mailbox: b.state }));
const pages = (n: number) => `${n} page${n === 1 ? "" : "s"}`;
const close = "Close Email";
const tones = [1, 2, 3, 4, 5, 6] as const;
const toneOf = (key: string) => tones[[...key.trim().toLowerCase()].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 9973, 0) % tones.length];
const contact = (name: string, address: string): MailContact => ({ name, tone: toneOf(address || name) });
const unshown = "This attachment couldn’t be shown";
const unrendered = "This PDF can’t be shown on this tablet.";
const forwardProbe: MailEvent = { type: "forwardMessage", content: emptyContent };

const dataUrls = new WeakMap<Attached, string>();

function dataUrl(held: Attached) {
  const known = dataUrls.get(held);
  if (known !== undefined) return known;
  const url = `data:${held.mimeType};base64,${held.data}`;
  dataUrls.set(held, url);
  return url;
}

function picture(file: SavedFile, held: Attached | undefined): MailPhoto {
  return held ? { src: dataUrl(held), alt: file.name } : mailThumbnail(file);
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

const mailClock = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const mailDay = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

function when(at: number, nowMs: number, todayStart: number, yesterdayStart: number) {
  if (nowMs - at < 60_000) return "Just now";
  if (at >= todayStart) return mailClock.format(at);
  if (at >= yesterdayStart) return "Yesterday";
  return mailDay.format(at);
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
  const { accounts, can, send } = useAccounts();
  const ids = useAccountIds();
  if (!accounts) return null;
  return <WithMailboxes ids={ids}>{(boxes) => <Mail registry={accounts} accountCan={can} accountSend={send} boxes={boxes} {...props} />}</WithMailboxes>;
}

type MailProps = Covered & {
  registry: Accounts;
  accountCan: (event: AccountEvent) => boolean;
  accountSend: (event: AccountEvent) => Promise<Exit.Exit<Accounts, unknown>>;
  boxes: readonly MailInstance[];
};

function Mail({ registry, accountCan, accountSend, boxes, ...props }: MailProps) {
  const { workspace, can, send, guide, askGrace } = useWorkspace();
  const runtime = useRuntime();
  const [unopenedLink, setUnopenedLink] = useState<string>();
  const read = useMailContent();
  const kept = useMailHeld();
  const held = useMailFile();
  const files = useFiles();
  const mail = useMail();
  const now = useMinute();
  const { state: choices, send: tell } = useMailChoices(runtime);
  const sources = useMemo(() => sourcesOf(boxes), [boxes]);
  const accountNames = useMemo(() => new Map(registry.accounts.map((a) => [a.id, a.name])), [registry.accounts]);
  const shown = useMemo(() => boxes.filter((b) => showsMail(registry, b.id)), [boxes, registry]);

  const opening = useMemo(
    () => shown.find((b) => b.id === openSource(registry, sources)) ?? shown.find((b) => b.state.readKind !== "Search" && b.state.readStatus !== "ReadIdle"),
    [shown, registry, sources],
  );
  const openingRef = opening ? (opening.state.view !== "Inbox" ? opening.state.messageRef : opening.state.requestedRef) : "";
  const openingContent = opening ? read(opening.id, openingRef) : undefined;
  const parsedBody = useMemo(() => (opening ? messageLinkParts(openingContent?.body ?? "") : undefined), [opening, openingContent?.body]);

  const nowMs = now.getTime();
  const { todayStart, yesterdayStart } = useMemo(() => {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return { todayStart: start, yesterdayStart: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime() };
  }, [now]);

  const lead = (shown.find((b) => readable(b.state)) ?? shown[0])?.state;
  const folder: Folder = lead?.folder ?? "InboxFolder";
  const rows = useMemo(() => accountRows(registry, sources), [registry, sources]);
  const outbox = choices ? showsOutbox(registry, sources, choices) : false;

  const waiting = useMemo<MailSummary[]>(() => {
    if (!outbox || opening) return [];
    const untitled = (subject: string | undefined) => subject === "" ? "(no subject)" : subject ?? "";
    return outboxRows(registry, sources).map((r) => {
      const at = queuedAt(r.queued.operationId);
      const firstRecipient = recipientsOf(r.queued.snapshot.content.to)[0] ?? "";
      return {
        id: `${r.account}/${r.queued.operationId}`,
        from: contact(mail?.nameOf(r.queued.snapshot.content.to, { id: r.account, ref: r.queued.snapshot.replyTo }) ?? firstRecipient, firstRecipient),
        subject: untitled(r.queued.snapshot.content.subject),
        time: Number.isNaN(at) ? "" : when(at, nowMs, todayStart, yesterdayStart),
        attachment: r.queued.snapshot.attachments.length > 0,
        account: rows.length ? (accountNames.get(r.account) ?? "") : undefined,
      };
    });
  }, [outbox, opening, registry, sources, mail, nowMs, todayStart, yesterdayStart, rows.length, accountNames]);

  const listed = useMemo<MailSummary[]>(() => {
    if (outbox || opening) return [];
    const theirs = folder === "DraftsFolder" || folder === "SentFolder";
    const untitled = (subject: string | undefined) => subject === "" ? "(no subject)" : subject ?? "";
    const nameOf = mail?.nameOf ?? ((a: string) => a);
    const party = (c: MailContent | undefined): MailContact => {
      if (!theirs) return contact(c?.from ?? "", c?.fromAddress ?? "");
      const to = c?.to[0] ? named(c.to[0], nameOf) : "";
      const address = c?.to[0] ? addressOf(c.to[0]) : "";
      if (folder === "SentFolder" || !to) return contact(folder === "SentFolder" ? to : "No one yet", address || to);
      return { ...contact(`To ${to}`, address || to), mark: [...to][0]?.toUpperCase() };
    };
    return folderRows(registry, sources, folder).sort(newest(read)).map((r) => {
      const c = read(r.account, r.record.identity.ref);
      return {
        id: `${r.account}/${r.record.identity.ref}`,
        from: party(c),
        subject: r.record.answered && c?.replied ? `You replied: “${c.replied.slice(0, 28)}…”` : theirs ? untitled(c?.subject) : c?.subject ?? "",
        time: c ? when(c.receivedAt, nowMs, todayStart, yesterdayStart) : "",
        unread: r.record.unread,
        attachment: c?.attachment,
        account: rows.length ? (accountNames.get(r.account) ?? "") : undefined,
      };
    });
  }, [outbox, opening, folder, registry, sources, mail?.nameOf, read, nowMs, todayStart, yesterdayStart, rows.length, accountNames]);

  if (!workspace || !choices) return null;
  const online = workspace.device.connectivity === "Online";
  const fire = (event: WorkspaceEvent) => (can(event) ? () => void send(event) : undefined);
  const home: WorkspaceEvent = { type: "visit", destination: "Home" };
  const frame = { onClose: fire(home), closeLabel: close, ...props };
  const accountSettings: WorkspaceEvent = { type: "chooseSettingsPage", page: "EmailCalendarSettings" };
  if (showsConnect(registry))
    return <MailApp noAccount folder="inbox" messages={[]} onConnect={fire(accountSettings)} onAskGrace={askGrace("connectEmail")} {...frame} />;

  const currentNotice = mail?.note;
  const source = currentNotice?.source;
  const note = source && shown.some(({ id, state }) => id === source.id && state.owner === source.owner &&
    state.provider === source.provider && state.account === source.account) ? currentNotice : undefined;
  const name = (id: number) => accountNames.get(id) ?? "";
  const filter = (id: number) => { if (accountCan({ type: "filterInbox", id })) void accountSend({ type: "filterInbox", id }); };
  const renew = (id: number) => accountCan({ type: "signInAgain", id }) && can(accountSettings)
    ? () => void accountSend({ type: "signInAgain", id }).then((exit) => Exit.isSuccess(exit) && fire(accountSettings)?.())
    : undefined;
  const offer = (b: MailInstance, event: MailEvent) => (b.can(event) ? () => void b.send(event) : undefined);
  const sender = (b: MailInstance) => read(b.id, b.state.replyTo)?.from ?? "";

  const composing = shown.find((b) => b.state.composeVisible);
  if (mail && composing)
    return (
      <Suspense fallback={null}>
        <EmailCompose key={composing.id} registry={registry} boxes={shown} box={composing} mail={mail} sender={sender} frame={frame} />
      </Suspense>
    );

  if (opening) {
    const m = opening.state;
    const ready = m.view !== "Inbox";
    const ref = openingRef;
    const c = openingContent;
    const saver = saverOf(opening, mail, files);
    const unopened = m.view === "Message" && m.readKind === "OpenAttachment" && m.readStatus === "ReadFailed";
    const toast = unopened ? <Toast placement="screen">{unshown}</Toast> : note ? <Toast key={note.id} placement="screen">{note.text}</Toast> : undefined;
    if (m.view === "Attachment")
      return <Attachment box={opening} held={held} saver={saver} sender={c?.from ?? ""} subject={c?.subject ?? ""} toast={toast} frame={frame} />;
    const open: MailEvent = { type: "readMail", kind: "OpenMessage", ref, approved: true };
    const target = { ref, revision: messageRecord(m, ref).revision };
    const change = (kind: MessageChange) => offer(opening, { type: "changeSelectedMessage", target, change: kind });
    const body = parsedBody ?? [];
    const firstLink = body.find((part) => typeof part !== "string" && part.href !== undefined);
    const canForward = m.folder !== "DraftsFolder" && opening.can(forwardProbe);
    const onForward = canForward
      ? () => void opening.send({
          type: "forwardMessage",
          content: { ...emptyContent, subject: `Fwd: ${c?.subject ?? ""}`, body: body.map((part) => typeof part === "string" ? part : "(link removed)").join("") },
        })
      : undefined;
    const photos = photoAssets(m);
    const pdfs = m.assets.filter((a) => a.kind === "Pdf");
    const attachment = (file: SavedFile): MailEvent => ({ type: "readMail", kind: "OpenAttachment", ref: file.sourceRef, approved: true });
    const opener = (chosen: readonly SavedFile[]) => chosen.some((f) => opening.can(attachment(f))) ? (i: number) => { const f = chosen[i]; if (f) offer(opening, attachment(f))?.(); } : undefined;
    const allPhotos = photos.map((p) => p.sourceRef);
    const header = mail && headerFor(mail, kept(opening.id, m.messageRef), opening.id, m);
    const replying = mail && ready && answerable(m) && header && canReplyToMessage(m, header, "MailHost");
    const scam = showsScamWarning(m);
    const reviewed = kept(opening.id, ref)?.read;
    const linkSource = `${opening.id}|${ref}|${m.generation}|${reviewed?.version ?? ""}`;
    const follow = (link: string, choice: LinkChoice) => {
      if (!ready) return;
      setUnopenedLink(undefined);
      void runtime.runPromiseExit(chooseMailLink({ account: opening.id, ref, generation: m.generation, version: reviewed?.version, link, deviceVersion: workspace.device.contextVersion, browserRevision: workspace.browser.revision }, choice)).then((result) => {
        if (!Exit.isSuccess(result) || !result.value) setUnopenedLink(linkSource);
      });
    };
    const saveAll = saver.offer(allPhotos);
    const present: Record<Ringed, boolean> = {
      caution: scam, mbody: ready, saveall: ready && photos.length > 0 && saveAll !== undefined, file: ready && pdfs.length > 0, link: ready && firstLink !== undefined,
    };
    const pointing = aimed(guide((t) => (isRinged(t) && present[t] ? t : undefined)));
    return (
      <>
      <MailMessageView from={contact(c?.from ?? "", c?.fromAddress ?? "")} address={scam ? c?.fromAddress : undefined} time={c ? when(c.receivedAt, nowMs, todayStart, yesterdayStart) : ""} subject={c?.subject ?? ""} body={body.map((part) => {
          if (typeof part === "string") return part;
          const { href } = part;
          return href ? <MailLink key={part.start} guide={part === firstLink ? pointing.link : undefined} onOpen={() => follow(href, "open")}>{part.text}</MailLink> : part.text;
        })} guide={pointing.message}
        scam={scam} inTrash={messageRecord(m, ref).folder === "TrashFolder"}
        photos={ready ? photos.map((p) => picture(p, held(opening.id, p))) : undefined} onOpenPhoto={opener(photos)}
        onSaveAll={saveAll} saveAllStatus={saver.status(photos)} onRetrySaveAll={saver.offer(allPhotos)}
        files={ready ? pdfs.map((a) => ({ name: a.name, detail: pages(a.pages) })) : undefined} onOpenFile={opener(pdfs)}
        status={ready ? "ready" : m.readStatus === "Reading" ? "loading" : "failed"}
        onRetry={offer(opening, open)}
        onReply={replying ? () => void mail.reply(opening.id) : undefined}
        onForward={onForward}
        onDelete={change("TrashMessage")} onRestore={change("RestoreMessage")} onDeleteForever={change("PurgeMessage")}
        backLabel={backTo[m.folder]} onBack={offer(opening, { type: "showInbox" })} {...frame} />
      {ready && m.link.status === "LinkHeld" && <BrowserDialog title="Open this link?" tone="caution" onEscape={() => follow(m.link.link, "cancel")} actions={<>
        <Button variant="prominent" onClick={() => follow(m.link.link, "cancel")}>Stay in email</Button>
        <Button variant="capsule" onClick={() => follow(m.link.link, "confirm")}>Open in Browser</Button>
      </>}><BrowserDialogText className="break-all">{m.link.link}</BrowserDialogText></BrowserDialog>}
      {unopenedLink === linkSource && <Toast placement="screen">This link couldn’t open.</Toast>}
      {toast}
      </>
    );
  }

  const waitingCount = outboxCount(registry, sources);
  const shownBanners = banners(registry, sources, online);
  const notes = shownBanners.filter((b) => b.kind !== "OfflineBanner").map((b) => notices[b.kind](b, name(b.account), renew(b.account)));
  const failed = shown.filter((b) => b.state.readKind === "Search" && b.state.readStatus === "ReadFailed");
  const search = (query: string): MailEvent => ({ type: "readMail", kind: "Search", ref: query, approved: true });
  const undo = shown.flatMap((b) => undoable(b.state).map((r) => ({ b, event: { type: "undoMessageTrash", target: { ref: r.identity.ref, revision: r.undoRevision } } satisfies MailEvent })))[0];
  const toast = undo ? <Toast placement="screen" onUndo={offer(undo.b, undo.event)}>Moved to Trash</Toast>
    : note ? <Toast key={note.id} placement="screen">{note.text}</Toast> : undefined;
  const writable = mail && fromChoices(registry, sources).some((a) => shown.find((b) => b.id === a.id)?.can({ type: "startDraft", reply: false }));
  const replace = (b: MailInstance, event: MailEvent) => {
    const stop: MailEvent = { type: "showInbox" };
    if (b.can(event)) void b.send(event);
    else if (b.state.readStatus === "Reading" && b.state.readKind === "Search" && b.can(stop))
      void b.send(stop).then((exit) => { if (Exit.isSuccess(exit) && enabled(exit.value, event, "MailUser")) void b.send(event); });
  };
  const visibleMessages = outbox ? waiting : listed;
  const onScreen = new Set(visibleMessages.map((r) => r.id));
  const rowGuide = guide((target) => { const id = rowOf(target); return id !== undefined && onScreen.has(id) ? id : undefined; });
  const show = (chosen: Folder) => shown.forEach((b) => {
    if (b.state.folder !== chosen) replace(b, { type: "chooseFolder", folder: chosen });
    else if (b.state.query !== "") replace(b, search(""));
  });

  return (
    <MailApp folder={outbox ? "outbox" : folderOf(folder)} counts={{ inbox: unreadIn(registry, sources, 0), drafts: draftsIn(registry, sources), outbox: waitingCount }}
      guide={rowGuide} accounts={rows} account={registry.inboxFilter || undefined} banners={notes.length ? notes : undefined} messages={visibleMessages} toast={toast}
      onWrite={writable ? offer(shown.find((b) => b.id === startFrom(registry, sources, "")) ?? shown[0], { type: "startDraft", reply: false }) : undefined}
      status={shownBanners.some((b) => b.kind === "OfflineBanner") ? "offline" : failed.length ? "failed" : "ready"}
      query={lead?.query ?? ""}
      onQueryChange={(query) => shown.forEach((b) => replace(b, search(query)))}
      onRetry={failed.some((b) => b.can(search(b.state.query))) ? () => failed.forEach((b) => offer(b, search(b.state.query))?.()) : undefined}
      onSelectFolder={(chosen) => {
        void tell({ type: chosen === "outbox" ? "chooseOutbox" : "chooseFolderList" });
        if (chosen === "outbox") return;
        if (registry.inboxFilter !== 0) filter(0);
        show(folders[chosen]);
      }}
      onAccount={(id) => { void tell({ type: "chooseFolderList" }); filter(id); show("InboxFolder"); }}
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
  toast: ReactNode; frame: Frame;
};

function Attachment({ box, held, saver, sender, subject, toast, frame }: AttachmentProps) {
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
          {shown ? <object data={dataUrl(shown)} type={shown.mimeType} aria-label={file.name} className="h-[640px] w-full">{unrendered}</object> : unrendered}
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
        onForward={box.can(forward) ? () => void box.send(forward) : undefined} {...leave} />
      {toast}
    </>
  );
}

// spec/app/mailboxes.md, "Story: See all my email in one place"; spec/app/mailboxes.md, "All inboxes is the union of the shown accounts’ inboxes"; spec/app/mailboxes.md, "Each account’s banner shows its own state, and offline is not a broken account"; spec/app/mailboxes.md, "A switched-off or removed account shows nothing anywhere"; spec/app/email.md, "Story: Read an email and its original attachment"; spec/app/email.md, "Switching folders clears the old query and starts a scoped listing"
import { type HomeMail, MailApp, type MailFolder, MailMessageView, MailSignInBanner, type MailSummary, MailSyncingRow } from "@repo/ui";
import { Exit } from "effect";
import type { ReactNode } from "react";
import { type Accounts, mailAccounts } from "../gen/app__accounts.ts";
import { enabled, type Event as MailEvent, messageRecord, readable, showsScamWarning } from "../gen/app__email.ts";
import type { Folder } from "../gen/app__emailItem.ts";
import { type BannerKind, type MailBanner, type MailSource, type Row, accountRows, banners, folderRows, mailContext, openSource, outboxCount, showsMail, unreadIn } from "../gen/app__mailboxes.ts";
import type { Event as WorkspaceEvent } from "../gen/app__workspace.ts";
import type { MailContent } from "./connector.vibe";
import { type MailInstance, useAccounts, useMailContent, useWorkspace, WithMailboxes } from "./useApp.ts";

type Covered = { inert?: boolean; "aria-hidden"?: boolean };
type Read = (id: number, ref: string) => MailContent | undefined;

const folders: Record<Exclude<MailFolder, "outbox">, Folder> = { inbox: "InboxFolder", sent: "SentFolder", drafts: "DraftsFolder", trash: "TrashFolder" };
const folderOf = (folder: Folder) => (Object.keys(folders) as (keyof typeof folders)[]).find((f) => folders[f] === folder) ?? "inbox";
const sourcesOf = (boxes: readonly MailInstance[]): MailSource[] => boxes.map((b) => ({ account: b.id, mailbox: b.state }));
const pages = (n: number) => `${n} page${n === 1 ? "" : "s"}`;
const close = "Close Email";

function when(at: number, now: Date) {
  const day = new Date(at);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (day.toDateString() === now.toDateString()) return day.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (day.toDateString() === yesterday.toDateString()) return "Yesterday";
  return day.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
  if (!workspace) return null;
  const now = new Date();
  const fire = (event: WorkspaceEvent) => () => { if (can(event)) void send(event); };
  const frame = { onClose: fire({ type: "visit", destination: "Home" }), closeLabel: close, ...props };
  if (mailAccounts(registry).length === 0)
    return <MailApp noAccount folder="inbox" messages={[]} onConnect={fire({ type: "chooseSettingsPage", page: "EmailCalendarSettings" })} onAskGrace={fire({ type: "openGrace" })} {...frame} />;

  const sources = sourcesOf(boxes);
  const shown = boxes.filter((b) => showsMail(registry, b.id));
  const name = (id: number) => registry.accounts.find((a) => a.id === id)?.name ?? "";
  const filter = (id: number) => { if (account.can({ type: "filterInbox", id })) void account.send({ type: "filterInbox", id }); };

  const opening = shown.find((b) => b.id === openSource(registry, sources)) ?? shown.find((b) => b.state.readKind === "OpenMessage" && b.state.readStatus !== "ReadIdle");
  if (opening) {
    const m = opening.state;
    const ready = m.view !== "Inbox";
    const ref = ready ? m.messageRef : m.requestedRef;
    const c = read(opening.id, ref);
    const open: MailEvent = { type: "readMail", kind: "OpenMessage", ref, approved: true };
    return (
      <MailMessageView from={{ name: c?.from ?? "" }} address={showsScamWarning(m) ? c?.fromAddress : undefined} time={c ? when(c.receivedAt, now) : ""} subject={c?.subject ?? ""} body={c?.body ?? ""}
        scam={showsScamWarning(m)} inTrash={messageRecord(m, ref).folder === "TrashFolder"}
        files={ready ? m.assets.filter((a) => a.kind === "Pdf").map((a) => ({ name: a.name, detail: pages(a.pages) })) : undefined}
        status={ready ? "ready" : m.readStatus === "Reading" ? "loading" : "failed"}
        onRetry={() => { if (opening.can(open)) void opening.send(open); }}
        onBack={() => { if (opening.can({ type: "showInbox" })) void opening.send({ type: "showInbox" }); }} {...frame} />
    );
  }

  const lead = (shown.find((b) => readable(b.state)) ?? shown[0])?.state;
  const folder: Folder = lead?.folder ?? "InboxFolder";
  const rows = accountRows(registry, sources);
  const messages: MailSummary[] = folderRows(registry, sources, folder).sort(newest(read)).map((r) => {
    const c = read(r.account, r.record.identity.ref);
    return {
      id: `${r.account}/${r.record.identity.ref}`, from: { name: c?.from ?? "" }, subject: c?.subject ?? "", time: c ? when(c.receivedAt, now) : "",
      unread: r.record.unread, account: rows.length ? name(r.account) : undefined,
    };
  });
  const notices: Record<BannerKind, (b: MailBanner) => ReactNode> = {
    OfflineBanner: () => null,
    SignInBanner: (b) => <MailSignInBanner key={`sign-in-${b.account}`} name={name(b.account)} others={b.othersFine} />,
    SyncingRow: (b) => <MailSyncingRow key={`syncing-${b.account}`} name={name(b.account)} />,
  };
  const shownBanners = banners(registry, sources, workspace.device.connectivity === "Online");
  const notes = shownBanners.filter((b) => b.kind !== "OfflineBanner").map((b) => notices[b.kind](b));
  const failed = shown.filter((b) => b.state.readKind === "Search" && b.state.readStatus === "ReadFailed");
  const search = (query: string): MailEvent => ({ type: "readMail", kind: "Search", ref: query, approved: true });
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
    <MailApp folder={folderOf(folder)} counts={{ inbox: unreadIn(registry, sources, 0), outbox: outboxCount(registry, sources) }}
      accounts={rows} account={registry.inboxFilter || undefined} banners={notes.length ? notes : undefined} messages={messages}
      status={shownBanners.some((b) => b.kind === "OfflineBanner") ? "offline" : failed.length ? "failed" : "ready"}
      query={lead?.query ?? ""}
      onQueryChange={(query) => shown.forEach((b) => replace(b, search(query)))}
      onRetry={() => failed.forEach((b) => { const again = search(b.state.query); if (b.can(again)) void b.send(again); })}
      onSelectFolder={(chosen) => {
        if (chosen === "outbox") return;
        if (registry.inboxFilter !== 0) filter(0);
        show(folders[chosen]);
      }}
      onAccount={(id) => { filter(id); show("InboxFolder"); }}
      onOpen={(id) => {
        const [owner, ...ref] = id.split("/");
        const box = shown.find((b) => b.id === Number(owner));
        const event: MailEvent = { type: "readMail", kind: "OpenMessage", ref: ref.join("/"), approved: true };
        if (box?.can(event)) void box.send(event);
      }}
      onFixWifi={fire({ type: "chooseSettingsPage", page: "NetworkSettings" })} {...frame} />
  );
}

import type { ReactNode } from "react";
import { TriangleAlert, WifiOff } from "lucide-react";
import { AppWindow, type AppWindowProps } from "./AppWindow.tsx";
import { Banner, BannerButton, type BannerProps } from "./Banner.tsx";
import { Button } from "./Button.tsx";
import { appButton } from "./MailActionStatus.tsx";
import { MailFolderNav, type MailAccountRow, type MailFolder } from "./MailFolderNav.tsx";
import { MailMessageRow, mailIcons, type MailContact } from "./MailMessageRow.tsx";
import { MailNotice } from "./MailNotice.tsx";
import { ListRow } from "./ListRow.tsx";
import { PageHeading, PageText } from "./PageHeading.tsx";
import { Skeleton } from "./Skeleton.tsx";
import { Spinner } from "./Spinner.tsx";
import { SearchField } from "./TextField.tsx";

export type MailSummary = {
  id: string;
  from: MailContact;
  subject: string;
  time: string;
  unread?: boolean;
  attachment?: boolean;
  /** The account it came to, shown when there are several. */
  account?: string;
};

export type MailAppLabels = {
  title: string;
  write: string;
  search: string;
  found: (count: number) => string;
  empty: string;
  nothingFound: string;
  failed: string;
  retry: string;
  offline: string;
  offlineLine: string;
  fixWifi: string;
  loading: string;
  connectTitle: string;
  connectLine: string;
  connect: string;
  askGrace: string;
};

const mailAppLabels: MailAppLabels = {
  title: "Email",
  write: "Write",
  search: "Search email",
  found: (n) => `${n} email${n === 1 ? "" : "s"} found`,
  empty: "Nothing here.",
  nothingFound: "Nothing found. Try another word.",
  failed: "Your email couldn’t be loaded. Try again.",
  retry: "Try again",
  offline: "No internet right now",
  offlineLine: "You can still read your emails. What you send waits in Outbox and goes by itself when you’re back online.",
  fixWifi: "Fix Wi-Fi",
  loading: "Loading your email",
  connectTitle: "Get your email on this tablet",
  connectLine: "Sign in to the email you already use, like Gmail or Outlook. Its calendar and contacts can come too.",
  connect: "Connect your email",
  askGrace: "Ask Grace to help",
};

export type MailListStatus = "loading" | "failed" | "offline" | "ready";

export type MailAppProps = Omit<AppWindowProps, "title" | "icon" | "nav" | "actions" | "children" | "backLabel" | "onBack"> & {
  /** The folder open. */
  folder: MailFolder;
  /** Unread in Inbox, waiting in Drafts and Outbox. */
  counts?: Partial<Record<MailFolder, number>>;
  /** The email accounts that show mail; with two or more, Inbox reads "All inboxes" over a row for each. */
  accounts?: MailAccountRow[];
  /** The account whose inbox alone is open; none for every inbox. */
  account?: number;
  /** Called with the account whose row is tapped. */
  onAccount?: (id: number) => void;
  /** No email account shows mail: in place of the folders, a way to connect one. */
  noAccount?: boolean;
  /** Opens Settings › Email & calendar to connect an email. */
  onConnect?: () => void;
  /** Asks Grace to help connect an email. */
  onAskGrace?: () => void;
  /** What needs her above the search: a `MailSignInBanner` for each account whose sign-in ended, a `MailSyncingRow` while one is first fetched. */
  banners?: ReactNode;
  /** The open folder's emails that match the search, newest first. */
  messages: MailSummary[];
  /** The search typed; while there is one, the list says how many it found. */
  query?: string;
  /** Called as the search is typed. */
  onQueryChange?: (query: string) => void;
  /** Called with the folder tapped. */
  onSelectFolder?: (folder: MailFolder) => void;
  /** Called with the id of the email tapped. */
  onOpen?: (id: string) => void;
  /** Starts a new email. */
  onWrite?: () => void;
  /** `loading` shows placeholder rows; `failed` says so above the emails already shown, with Try again; `offline` keeps them readable under a banner with Fix Wi-Fi. */
  status?: MailListStatus;
  /** Loads the list or search again after it failed. */
  onRetry?: () => void;
  /** Opens Wi-Fi to get back online. */
  onFixWifi?: () => void;
  /** A note of what just happened, a `Toast` placed on the `screen` (with Undo after a delete). */
  toast?: ReactNode;
  /** The list's words, for another language. */
  labels?: Partial<MailAppLabels>;
};

/**
 * Email: the folders beside the open folder's emails, a search above them and Write as the one next step
 * (prototype `mailView()`, list); with no email account, a way to connect one (prototype `mailEmpty()`).
 * @model spec/app/email.md
 * @design packages/design-system/design.md#windows
 * @design packages/design-system/design.md#screens
 */
export function MailApp({
  folder,
  counts,
  accounts,
  account,
  onAccount,
  noAccount = false,
  onConnect,
  onAskGrace,
  banners,
  messages,
  query = "",
  onQueryChange,
  onSelectFolder,
  onOpen,
  onWrite,
  status = "ready",
  onRetry,
  onFixWifi,
  toast,
  labels,
  ...props
}: MailAppProps) {
  const l = { ...mailAppLabels, ...labels };
  const icon = <mailIcons.mail size={26} strokeWidth={2} aria-hidden />;
  if (noAccount)
    return (
      <AppWindow title={l.title} icon={icon} {...props}>
        <div className="mx-auto mt-14 flex max-w-[640px] flex-col items-center text-center">
          <span aria-hidden className="flex size-24 items-center justify-center rounded-card bg-accent text-primary">
            <mailIcons.mail size={48} strokeWidth={1.9} />
          </span>
          <PageHeading className="mt-[26px] text-display-sm leading-10">{l.connectTitle}</PageHeading>
          <PageText tone="secondary" className="mt-2.5 leading-[30px]">{l.connectLine}</PageText>
          <div className="mt-7 flex justify-center gap-3">
            <Button variant="prominent" size="pill" onClick={onConnect}>
              <mailIcons.mail size={22} strokeWidth={2.2} aria-hidden />
              {l.connect}
            </Button>
            <Button variant="capsule" size="pill" className={appButton} onClick={onAskGrace}>
              {l.askGrace}
            </Button>
          </div>
        </div>
      </AppWindow>
    );
  const loading = status === "loading";
  const note = !loading && query ? l.found(messages.length) : null;
  return (
    <>
      <AppWindow
        title={l.title}
        icon={icon}
        nav={<MailFolderNav folder={folder} counts={counts} accounts={accounts} account={account} onAccount={onAccount} onSelect={onSelectFolder} />}
        actions={
          <Button variant="prominent" size="compact" onClick={onWrite}>
            <mailIcons.pencil size={22} strokeWidth={2.2} aria-hidden />
            {l.write}
          </Button>
        }
        {...props}
      >
        {status === "offline" || banners ? (
          <div className="mb-4 flex flex-col gap-4">
            {status === "offline" && <Banner tone="dark" icon={<WifiOff size={28} strokeWidth={2} />} title={l.offline} line={l.offlineLine} actions={<BannerButton onClick={onFixWifi}>{l.fixWifi}</BannerButton>} />}
            {banners}
          </div>
        ) : null}
        <SearchField label={l.search} value={query} onChange={(event) => onQueryChange?.(event.target.value)} />
        <div className="mt-[18px]" aria-busy={loading || undefined}>
          {status === "failed" && (
            <MailNotice actionLabel={l.retry} onAction={onRetry} className="mb-[18px]">
              {l.failed}
            </MailNotice>
          )}
          {note && <PageText tone="secondary" className="mb-[18px]">{note}</PageText>}
          {loading ? (
            <ul aria-label={l.loading} className="m-0 flex list-none flex-col gap-3 p-0">
              {[0, 1, 2, 3].map((row) => (
                <li key={row}>
                  <Skeleton />
                </li>
              ))}
            </ul>
          ) : messages.length ? (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {messages.map(({ id, ...message }) => (
                <li key={id}>
                  <MailMessageRow {...message} onOpen={() => onOpen?.(id)} />
                </li>
              ))}
            </ul>
          ) : (
            <PageText tone="secondary" className="px-1 py-[30px]">{query ? l.nothingFound : l.empty}</PageText>
          )}
        </div>
      </AppWindow>
      {toast}
    </>
  );
}

export type MailSignInBannerLabels = { title: (name: string) => string; line: (name: string) => string; others: string; signIn: string };

const signInLabels: MailSignInBannerLabels = {
  title: (name) => `${name} needs you to sign in again`,
  line: (name) => `Your ${name} emails are still here. New ones arrive once you sign in.`,
  others: " Your other email is fine.",
  signIn: "Sign in again",
};

export type MailSignInBannerProps = Omit<BannerProps, "icon" | "title" | "line" | "tone" | "actions"> & {
  /** The account's name on the tablet: "Outlook". */
  name: string;
  /** Other email accounts show mail, and they are fine. */
  others?: boolean;
  /** Opens that account's sign-in again. */
  onSignIn?: () => void;
  /** Its words, for another language. */
  labels?: Partial<MailSignInBannerLabels>;
};

/** An email account whose sign-in ended: its mail stays readable, and Sign in again brings new mail (prototype `mailBanners()`). */
export function MailSignInBanner({ name, others = false, onSignIn, labels, ...props }: MailSignInBannerProps) {
  const l = { ...signInLabels, ...labels };
  return (
    <Banner
      tone="dark"
      icon={<TriangleAlert size={26} strokeWidth={2.2} />}
      title={l.title(name)}
      line={l.line(name) + (others ? l.others : "")}
      actions={<BannerButton onClick={onSignIn}>{l.signIn}</BannerButton>}
      {...props}
    />
  );
}

export type MailSyncingRowLabels = { title: (name: string) => string; line: string };

const syncingLabels: MailSyncingRowLabels = {
  title: (name) => `Getting your ${name} email…`,
  line: "The newest come first. Older ones keep arriving while you read.",
};

export type MailSyncingRowProps = {
  /** The account being fetched: "Outlook". */
  name: string;
  className?: string;
  /** Its words, for another language. */
  labels?: Partial<MailSyncingRowLabels>;
};

/** A newly connected account's first email on its way, newest first (prototype `mailBanners()`, syncing). */
export function MailSyncingRow({ name, className, labels }: MailSyncingRowProps) {
  const l = { ...syncingLabels, ...labels };
  return <ListRow role="status" leading={<Spinner size="lg" aria-hidden />} title={l.title(name)} subtitle={l.line} className={className} />;
}

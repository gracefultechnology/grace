import type { ReactNode } from "react";
import { Mail, Pencil } from "lucide-react";
import { AppWindow, type AppWindowProps } from "./AppWindow.tsx";
import { Button } from "./Button.tsx";
import { MailFolderNav, type MailFolder } from "./MailFolderNav.tsx";
import { MailMessageRow, type MailContact } from "./MailMessageRow.tsx";
import { PageText } from "./PageHeading.tsx";
import { SearchField } from "./TextField.tsx";

/** One email as a folder lists it. */
export type MailSummary = {
  /** The message reference the app opens it by. */
  id: string;
  /** Who sent it, or for a draft who it is to. */
  from: MailContact;
  /** The subject, or what stands in for it, such as "You replied: …". */
  subject: string;
  /** When it arrived: "2:15 PM", "Yesterday". */
  time: string;
  /** Not yet read. */
  unread?: boolean;
  /** It carries photos or files. */
  attachment?: boolean;
};

/** The words of Email's list, for another language. */
export type MailAppLabels = {
  title: string;
  write: string;
  search: string;
  /** The line over search results: "1 email found". */
  found: (count: number) => string;
  /** An empty folder. */
  empty: string;
  /** A search with no results. */
  nothingFound: string;
  /** Over the emails in Trash. */
  trashNote: string;
};

const mailAppLabels: MailAppLabels = {
  title: "Email",
  write: "Write",
  search: "Search email",
  found: (n) => `${n} email${n === 1 ? "" : "s"} found`,
  empty: "Nothing here.",
  nothingFound: "Nothing found. Try another word.",
  trashNote: "Emails in Trash are deleted for good after 30 days.",
};

export type MailAppProps = Omit<AppWindowProps, "title" | "icon" | "nav" | "actions" | "children" | "backLabel" | "onBack"> & {
  /** The folder open. */
  folder: MailFolder;
  /** Unread in Inbox, waiting in Drafts. */
  counts?: Partial<Record<MailFolder, number>>;
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
  /** A note of what just happened, a `Toast` (with Undo after a delete), centered at the bottom of the screen. */
  toast?: ReactNode;
  /** The list's words, for another language. */
  labels?: Partial<MailAppLabels>;
};

/**
 * Email: the folders beside the open folder's emails, a search above them and Write as the one next step
 * (prototype `mailView()`, list).
 * @model spec/app/email.md
 * @design packages/design-system/design.md#windows
 */
export function MailApp({ folder, counts, messages, query = "", onQueryChange, onSelectFolder, onOpen, onWrite, toast, labels, ...props }: MailAppProps) {
  const l = { ...mailAppLabels, ...labels };
  const note = query ? l.found(messages.length) : folder === "trash" && messages.length ? l.trashNote : null;
  return (
    <>
      <AppWindow
        title={l.title}
        icon={<Mail size={26} strokeWidth={2} aria-hidden />}
        nav={<MailFolderNav folder={folder} counts={counts} onSelect={onSelectFolder} />}
        actions={
          <Button variant="prominent" size="compact" className="pr-[26px] pl-[22px]" onClick={onWrite}>
            <Pencil size={22} strokeWidth={2.2} aria-hidden />
            {l.write}
          </Button>
        }
        {...props}
      >
        {/* Prototype `.a-search`; the list 18px under it. */}
        <SearchField label={l.search} value={query} onChange={(event) => onQueryChange?.(event.target.value)} />
        <div className="mt-[18px]">
          {note && <PageText tone="secondary" className={query ? "mb-[18px]" : "mb-3.5"}>{note}</PageText>}
          {messages.length ? (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {messages.map(({ id, ...message }) => (
                <li key={id}>
                  <MailMessageRow {...message} onOpen={onOpen && (() => onOpen(id))} />
                </li>
              ))}
            </ul>
          ) : (
            <PageText tone="secondary" className="px-1 py-[30px]">{query ? l.nothingFound : l.empty}</PageText>
          )}
        </div>
      </AppWindow>
      {toast != null && <div className="absolute bottom-6 left-1/2 z-[45] -translate-x-1/2">{toast}</div>}
    </>
  );
}

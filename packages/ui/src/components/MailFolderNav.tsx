import { Fragment, type ComponentProps, type ComponentType } from "react";
import { ArrowUp, Inbox, TriangleAlert } from "lucide-react";
import type { IconProps } from "../icons.tsx";
import { cn } from "../lib/cn.ts";
import { mailIcons } from "./MailMessageRow.tsx";
import { SideNav, SideNavItem, type SideNavProps } from "./SplitView.tsx";

export type MailFolder = "inbox" | "sent" | "drafts" | "trash" | "outbox";

const folders: [MailFolder, ComponentType<IconProps>][] = [
  ["inbox", Inbox],
  ["sent", mailIcons.sent],
  ["drafts", mailIcons.draft],
  ["trash", mailIcons.trash],
  ["outbox", ArrowUp],
];

export type MailFolderNavLabels = Record<MailFolder, string> & { allInboxes: string; needsSignIn: string };

const navLabels: MailFolderNavLabels = {
  inbox: "Inbox",
  sent: "Sent",
  drafts: "Drafts",
  trash: "Trash",
  outbox: "Outbox",
  allInboxes: "All inboxes",
  needsSignIn: "Needs you to sign in again",
};

const accountColours = ["bg-avatar-6", "bg-avatar-2", "bg-avatar-3", "bg-avatar-1", "bg-avatar-5"];

export type MailAccountDotProps = Omit<ComponentProps<"span">, "children"> & {
  /** The account's colour, given in turn as accounts are added: 0 to 4, then round again. */
  colour: number;
};

/** The small round mark of an email account's colour, beside its name (prototype `.acdot`). */
export function MailAccountDot({ colour, className, ...props }: MailAccountDotProps) {
  return <span aria-hidden className={cn("inline-block size-3.5 flex-none rounded-full", accountColours[colour % accountColours.length], className)} {...props} />;
}

export type MailAccountRow = {
  id: number;
  /** Its name on the tablet: "Gmail", "Outlook". */
  name: string;
  colour: number;
  /** Unread email in its inbox. */
  unread: number;
  /** Its sign-in has ended: an alert in place of the count. */
  needsSignIn: boolean;
};

export type MailFolderNavProps = Omit<SideNavProps, "onSelect"> & {
  /** The folder open beside the list. */
  folder: MailFolder;
  /** How many emails a folder holds that matter: unread in Inbox, waiting in Drafts and Outbox. None or 0 shows nothing; Outbox shows only while it holds some or is open. */
  counts?: Partial<Record<MailFolder, number>>;
  /** The email accounts that show mail. With two or more, Inbox reads "All inboxes" and each account has its own row under it. */
  accounts?: MailAccountRow[];
  /** The account whose inbox alone is open; none for every inbox. */
  account?: number;
  /** Called with the account whose row is tapped. */
  onAccount?: (id: number) => void;
  /** The list's words, for another language. */
  labels?: Partial<MailFolderNavLabels>;
  /** Called with the folder tapped. */
  onSelect?: (folder: MailFolder) => void;
};

/**
 * Email's folder list: Inbox, or All inboxes over each account's own, Sent, Drafts, Trash, and Outbox while email waits
 * in it, the open one raised (prototype `.a-split.mail .a-nav`, `.acsub`).
 * @model spec/app/email.md
 * @design packages/design-system/design.md#selected
 */
export function MailFolderNav({ folder, counts = {}, accounts = [], account, onAccount, labels, onSelect, "aria-label": ariaLabel = "Folders", ...props }: MailFolderNavProps) {
  const l = { ...navLabels, ...labels };
  const several = accounts.length > 1;
  const one = several && folder === "inbox" ? account : undefined;
  return (
    <SideNav aria-label={ariaLabel} {...props}>
      {folders
        .filter(([id]) => id !== "outbox" || folder === "outbox" || counts.outbox)
        .map(([id, Icon]) => (
          <Fragment key={id}>
            <SideNavItem
              icon={<Icon size={26} strokeWidth={2} aria-hidden />}
              count={counts[id] || undefined}
              selected={folder === id && one === undefined}
              onClick={() => onSelect?.(id)}
            >
              {id === "inbox" && several ? l.allInboxes : l[id]}
            </SideNavItem>
            {id === "inbox" &&
              several &&
              accounts.map((row) => (
                <SideNavItem
                  key={row.id}
                  icon={<MailAccountDot colour={row.colour} className="mx-1.5" />}
                  count={row.needsSignIn ? <TriangleAlert role="img" aria-label={l.needsSignIn} size={22} strokeWidth={2.2} /> : row.unread || undefined}
                  selected={one === row.id}
                  className="pl-[30px] text-body"
                  onClick={() => onAccount?.(row.id)}
                >
                  {row.name}
                </SideNavItem>
              ))}
          </Fragment>
        ))}
    </SideNav>
  );
}

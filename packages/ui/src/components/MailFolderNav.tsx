import type { ComponentType } from "react";
import { Inbox } from "lucide-react";
import type { IconProps } from "../icons.tsx";
import { mailIcons } from "./MailMessageRow.tsx";
import { SideNav, SideNavItem, type SideNavProps } from "./SplitView.tsx";

export type MailFolder = "inbox" | "sent" | "drafts" | "trash";

const folders: [MailFolder, ComponentType<IconProps>][] = [
  ["inbox", Inbox],
  ["sent", mailIcons.sent],
  ["drafts", mailIcons.draft],
  ["trash", mailIcons.trash],
];

const folderNames: Record<MailFolder, string> = { inbox: "Inbox", sent: "Sent", drafts: "Drafts", trash: "Trash" };

export type MailFolderNavProps = Omit<SideNavProps, "onSelect"> & {
  /** The folder open beside the list. */
  folder: MailFolder;
  /** How many emails a folder holds that matter: unread in Inbox, waiting in Drafts. None or 0 shows nothing. */
  counts?: Partial<Record<MailFolder, number>>;
  /** The folders' names, for another language. */
  labels?: Partial<Record<MailFolder, string>>;
  /** Called with the folder tapped. */
  onSelect?: (folder: MailFolder) => void;
};

/**
 * Email's folder list: Inbox, Sent, Drafts and Trash, the open one raised (prototype `.a-split.mail .a-nav`).
 * @model spec/app/email.md
 * @design packages/design-system/design.md#selected
 */
export function MailFolderNav({ folder, counts = {}, labels, onSelect, "aria-label": ariaLabel = "Folders", ...props }: MailFolderNavProps) {
  const names = { ...folderNames, ...labels };
  return (
    <SideNav aria-label={ariaLabel} {...props}>
      {folders.map(([id, Icon]) => (
        <SideNavItem key={id} icon={<Icon size={26} strokeWidth={2} aria-hidden />} count={counts[id] || undefined} selected={folder === id} onClick={() => onSelect?.(id)}>
          {names[id]}
        </SideNavItem>
      ))}
    </SideNav>
  );
}

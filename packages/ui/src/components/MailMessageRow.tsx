import type { ReactNode } from "react";
import { createLucideIcon, type LucideIconNode } from "lucide-react";
import { MailIcon, PencilIcon, TrashIcon } from "../icons.tsx";
import { Avatar, type AvatarProps } from "./Avatar.tsx";
import { ListRow, type ListRowProps } from "./ListRow.tsx";

const icon = (name: string, ...paths: string[]) => createLucideIcon(name, paths.map((d): LucideIconNode => ["path", { d, key: d }]));

export const mailIcons = {
  trash: TrashIcon,
  draft: icon("mail-draft", "M12 20h9", "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"),
  clip: icon("mail-clip", "m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l8.6-8.6a4 4 0 0 1 5.7 5.7l-8.6 8.6a2 2 0 0 1-2.8-2.8l8-8"),
  sent: icon("mail-sent", "m22 2-7 20-4-9-9-4Z", "M22 2 11 13"),
  pencil: PencilIcon,
  down: icon("mail-down", "M12 15V3", "m7 10 5 5 5-5", "M5 21h14"),
  file: icon("mail-file", "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", "M14 2v4a2 2 0 0 0 2 2h4", "M10 13h4M10 17h4"),
  mail: MailIcon,
  camera: createLucideIcon("mail-camera", [
    ["path", { d: "M4 8h3l2-3h6l2 3h3v11H4z", key: "body" }],
    ["circle", { cx: "12", cy: "13", r: "3.5", key: "lens" }],
  ]),
};

export type MailContact = {
  name: string;
  photo?: string;
  tone?: AvatarProps["tone"];
  mark?: ReactNode;
};

export type MailContactAvatarProps = Omit<AvatarProps, "name" | "src" | "tone" | "children"> & {
  /** Who it shows. */
  contact: MailContact;
};

/** A contact's round avatar: their photo, or their initial or mark on their tone (prototype `av()`). */
export function MailContactAvatar({ contact, ...props }: MailContactAvatarProps) {
  return (
    <Avatar name={contact.name} src={contact.photo} tone={contact.tone} {...props}>
      {contact.mark}
    </Avatar>
  );
}

export type MailMessageRowProps = Omit<ListRowProps, "title" | "subtitle" | "leading" | "time" | "onClick"> & {
  /** Who sent it, or for a draft who it is to. */
  from: MailContact;
  /** The subject, or what stands in for it, such as "You replied: …". */
  subject: string;
  /** When it arrived, as the app formats it: "2:15 PM", "Yesterday". */
  time: string;
  /** The email account it came to, under the time, when there are several (prototype `.actag`). */
  account?: string;
  /** It carries photos or files: a paperclip follows the subject. */
  attachment?: boolean;
  /** The accessible name of the paperclip. */
  attachmentLabel?: string;
  /** Opens the email. */
  onOpen?: () => void;
};

/**
 * One email in a folder: the sender's avatar, name and unread dot, the subject, when it came and, with several
 * accounts, which one it came to (prototype `mrow()`).
 * @model spec/app/emailItem.md
 * @design packages/design-system/design.md#windows
 */
export function MailMessageRow({ from, subject, time, account, attachment = false, attachmentLabel = "Has attachments", onOpen, ...props }: MailMessageRowProps) {
  return (
    <ListRow
      title={from.name}
      truncate
      subtitle={
        <>
          {subject}
          {attachment && (
            <>
              {" · "}
              <mailIcons.clip role="img" aria-label={attachmentLabel} size={18} strokeWidth={2.2} className="inline-block align-[-3px]" />
            </>
          )}
        </>
      }
      time={account ? undefined : time}
      trailing={
        account ? (
          <span className="flex flex-col items-end gap-1 self-start pt-1.5 whitespace-nowrap text-muted-foreground">
            <span className="text-control leading-6 font-medium">{time}</span>
            <span className="text-caption leading-5 font-semibold">{account}</span>
          </span>
        ) : undefined
      }
      leading={<MailContactAvatar contact={from} aria-hidden />}
      onClick={onOpen}
      {...props}
    />
  );
}

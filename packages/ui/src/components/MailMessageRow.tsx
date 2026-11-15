import type { ReactNode } from "react";
import { Paperclip } from "lucide-react";
import { Avatar, type AvatarProps } from "./Avatar.tsx";
import { ListRow, type ListRowProps } from "./ListRow.tsx";

/** Someone email comes from or goes to, as their avatar shows them. */
export type MailContact = {
  /** Their name, as Margaret knows them: "Susan", "Main St Clinic". */
  name: string;
  /** A photo of them. */
  photo?: string;
  /** The color behind their initial or mark, 1 to 6. */
  tone?: AvatarProps["tone"];
  /** A mark in place of the initial, such as the clinic's cross. */
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
  /** It carries photos or files: a paperclip follows the subject. */
  attachment?: boolean;
  /** The accessible name of the paperclip. */
  attachmentLabel?: string;
  /** Opens the email. */
  onOpen?: () => void;
};

/**
 * One email in a folder: the sender's avatar, name and unread dot, the subject and when it came (prototype `mrow()`).
 * @model spec/app/emailItem.md
 * @design packages/design-system/design.md#windows
 */
export function MailMessageRow({ from, subject, time, attachment = false, attachmentLabel = "Has attachments", onOpen, ...props }: MailMessageRowProps) {
  return (
    <ListRow
      title={from.name}
      subtitle={
        <>
          {subject}
          {attachment && (
            <>
              {" · "}
              <Paperclip role="img" aria-label={attachmentLabel} size={18} strokeWidth={2.2} className="inline-block align-[-3px]" />
            </>
          )}
        </>
      }
      time={time}
      leading={<MailContactAvatar contact={from} aria-hidden />}
      onClick={onOpen}
      {...props}
    />
  );
}

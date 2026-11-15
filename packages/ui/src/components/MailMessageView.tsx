import type { ComponentProps, ReactNode } from "react";
import { ArrowDownToLine, Forward, Paperclip, Reply, Trash, Undo2 } from "lucide-react";
import { cn, focusRing } from "../lib/cn.ts";
import { Alert } from "./Alert.tsx";
import { AppWindow, type AppWindowProps } from "./AppWindow.tsx";
import { Button } from "./Button.tsx";
import { MailAttachment } from "./MailAttachment.tsx";
import { MailContactAvatar, type MailContact } from "./MailMessageRow.tsx";
import { PageHeading, PageText } from "./PageHeading.tsx";

const pill = { size: 22, strokeWidth: 2.2, "aria-hidden": true } as const;

export type MailLinkProps = ComponentProps<"a">;

/** A link in an email's words: blue, underlined and bold (prototype `.a-link`). */
export function MailLink({ className, ...props }: MailLinkProps) {
  return <a className={cn(focusRing, "rounded-sm font-semibold text-link underline", className)} {...props} />;
}

/** A photo carried by an email. */
export type MailPhoto = {
  /** The photo. */
  src: string;
  /** What it shows, for a screen reader. */
  alt: string;
};

export type MailPhotoGridProps = Omit<ComponentProps<"ul">, "onSelect"> & {
  /** The photos, three to a row. */
  photos: MailPhoto[];
  /** Called with the index of the photo tapped, to open it large. */
  onSelect?: (index: number) => void;
};

/** An email's photos, three to a row, each opening the viewer (prototype `.a-photos`). */
export function MailPhotoGrid({ photos, onSelect, className, ...props }: MailPhotoGridProps) {
  return (
    <ul className={cn("m-0 grid list-none grid-cols-3 gap-4 p-0", className)} {...props}>
      {photos.map((photo, i) => (
        <li key={photo.src}>
          <button
            type="button"
            onClick={() => onSelect?.(i)}
            className={cn(focusRing, "block h-[190px] w-full cursor-pointer overflow-hidden rounded-photo shadow-panel transition-transform duration-press ease-spring active:scale-[.99]")}
          >
            <img src={photo.src} alt={photo.alt} className="size-full object-cover" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** A file attached to an email. */
export type MailFile = {
  /** The file's name: "Visit form.pdf". */
  name: string;
  /** What it holds: "2 pages". */
  detail?: string;
};

/** The words of an open email, for another language. */
export type MailMessageViewLabels = {
  title: string;
  reply: string;
  forward: string;
  delete: string;
  restore: string;
  deleteForever: string;
  /** Before the time when the email has no address shown: "To you". */
  toYou: string;
  /** Grace's warning over a scam. */
  scam: string;
  /** Over the photos: "3 photos". */
  photos: (count: number) => string;
  saveAll: string;
};

const viewLabels: MailMessageViewLabels = {
  title: "Email",
  reply: "Reply",
  forward: "Forward",
  delete: "Delete",
  restore: "Restore",
  deleteForever: "Delete forever",
  toYou: "To you",
  scam: "Grace thinks this email is a scam. Don’t tap its links.",
  photos: (n) => `${n} photo${n === 1 ? "" : "s"}`,
  saveAll: "Save all to Files",
};

export type MailMessageViewProps = Omit<AppWindowProps, "title" | "icon" | "nav" | "actions" | "children"> & {
  /** Who sent it. */
  from: MailContact;
  /** The sender's address, shown when Grace doubts it; otherwise the line reads "To you". */
  address?: string;
  /** When it arrived: "2:15 PM", "Yesterday". */
  time: string;
  /** The subject. */
  subject: string;
  /** The words, sanitized by the app; a link in them is a `MailLink`. */
  body: ReactNode;
  /** Grace thinks it is a scam: her warning stands above it. */
  scam?: boolean;
  /** It is in Trash: Restore and Delete forever in place of Reply, Forward and Delete. */
  inTrash?: boolean;
  /** Its photos. */
  photos?: MailPhoto[];
  /** Its files. */
  files?: MailFile[];
  onReply?: () => void;
  onForward?: () => void;
  /** Moves it to Trash. */
  onDelete?: () => void;
  /** Takes it out of Trash. */
  onRestore?: () => void;
  onDeleteForever?: () => void;
  /** Called with the index of the photo tapped. */
  onOpenPhoto?: (index: number) => void;
  /** Saves every photo to Files. */
  onSaveAll?: () => void;
  /** Called with the index of the file to open. */
  onOpenFile?: (index: number) => void;
  /** Called with the index of the file to print. */
  onPrintFile?: (index: number) => void;
  /** The view's words, for another language. */
  labels?: Partial<MailMessageViewLabels>;
};

/**
 * One email open: who sent it and when, the subject, the words, and its photos or files, with Reply as the one
 * next step and Grace's warning above a scam (prototype `mailView()`, read).
 * @model spec/app/emailItem.md
 * @design packages/design-system/design.md#windows
 */
export function MailMessageView({
  from,
  address,
  time,
  subject,
  body,
  scam = false,
  inTrash = false,
  photos,
  files,
  onReply,
  onForward,
  onDelete,
  onRestore,
  onDeleteForever,
  onOpenPhoto,
  onSaveAll,
  onOpenFile,
  onPrintFile,
  labels,
  backLabel = "Inbox",
  ...props
}: MailMessageViewProps) {
  const l = { ...viewLabels, ...labels };
  const action = (label: string, icon: ReactNode, onClick?: () => void, prominent = false) => (
    <Button variant={prominent ? "prominent" : "plain"} size="compact" className={prominent ? "pr-[26px] pl-[22px]" : "pr-5 pl-4 text-grace-ink"} onClick={onClick}>
      {icon}
      {label}
    </Button>
  );
  return (
    <AppWindow
      title={l.title}
      backLabel={backLabel}
      actions={
        inTrash ? (
          <>
            {action(l.restore, <Undo2 {...pill} />, onRestore)}
            {action(l.deleteForever, <Trash {...pill} />, onDeleteForever)}
          </>
        ) : (
          <>
            {action(l.reply, <Reply {...pill} />, onReply, true)}
            {action(l.forward, <Forward {...pill} />, onForward)}
            {action(l.delete, <Trash {...pill} />, onDelete)}
          </>
        )
      }
      {...props}
    >
      <article className="font-sans">
        {scam && (
          <Alert variant="caution" className="mb-5">
            {l.scam}
          </Alert>
        )}
        <div className="flex items-center gap-[18px]">
          <MailContactAvatar contact={from} aria-hidden />
          <div className="min-w-0">
            <div className="text-lead leading-[30px] font-bold text-chrome">{from.name}</div>
            <div className="mt-0.5 text-body leading-[26px] font-medium text-muted-foreground">
              {address ?? l.toYou} · {time}
            </div>
          </div>
        </div>
        <PageHeading className="mt-5 mb-2.5">{subject}</PageHeading>
        <PageText className="max-w-[880px]">{body}</PageText>
        {photos?.length ? (
          <>
            {/* Prototype `.a-attbar`. */}
            <div className="mt-[22px] mb-3 flex items-center gap-3.5 text-chrome">
              <Paperclip size={24} strokeWidth={2.2} aria-hidden />
              <span className="flex-1 text-body-lg leading-[30px] font-bold">{l.photos(photos.length)}</span>
              <Button variant="capsule" size="pill" className="pr-[26px] pl-[22px]" onClick={onSaveAll}>
                <ArrowDownToLine {...pill} />
                {l.saveAll}
              </Button>
            </div>
            <MailPhotoGrid photos={photos} onSelect={onOpenPhoto} />
          </>
        ) : null}
        {files?.map((file, i) => (
          <MailAttachment key={file.name} name={file.name} detail={file.detail} className="mt-[22px]" onOpen={() => onOpenFile?.(i)} onPrint={onPrintFile && (() => onPrintFile(i))} />
        ))}
      </article>
    </AppWindow>
  );
}

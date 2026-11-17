import type { ComponentProps, ReactNode } from "react";
import { Forward, Reply, Undo2 } from "lucide-react";
import { cn, focusRing } from "../lib/cn.ts";
import { Alert } from "./Alert.tsx";
import { GuideAnchor, type GuideAnchorProps } from "./GuideAnchor.tsx";
import { AppWindow, type AppWindowProps } from "./AppWindow.tsx";
import { BillOffer, type BillDetails, type BillOfferLabels } from "./BillOffer.tsx";
import { Button } from "./Button.tsx";
import { MailActionStatus, appButton, headerPill, pendingMark, type MailSaveStatus } from "./MailActionStatus.tsx";
import { MailAttachment } from "./MailAttachment.tsx";
import { MailContactAvatar, mailIcons, type MailContact } from "./MailMessageRow.tsx";
import { MailNotice } from "./MailNotice.tsx";
import { PageHeading, PageText } from "./PageHeading.tsx";
import { Skeleton } from "./Skeleton.tsx";

const pill = { size: 22, strokeWidth: 2.2, "aria-hidden": true } as const;

export type MailLinkProps = ComponentProps<"a">;

/** A link in an email's words: blue, underlined and bold (prototype `.a-link`). */
export function MailLink({ className, ...props }: MailLinkProps) {
  return <a className={cn(focusRing, "rounded-sm font-semibold text-link underline", className)} {...props} />;
}

export type MailPhoto = {
  src: string;
  alt: string;
};

export type MailPhotoGridProps = Omit<ComponentProps<"ul">, "onSelect"> & {
  /** The photos, three to a row. */
  photos: MailPhoto[];
  /** Called with the index of the photo tapped, to open it large. */
  onSelect?: (index: number) => void;
};

/** An email's photos, three to a row, each opening the viewer (prototype `.a-photos`; a `.a-photo` has no press scale). */
export function MailPhotoGrid({ photos, onSelect, className, ...props }: MailPhotoGridProps) {
  return (
    <ul className={cn("m-0 grid list-none grid-cols-3 gap-4 p-0", className)} {...props}>
      {photos.map((photo, i) => (
        <li key={photo.src}>
          <button
            type="button"
            onClick={() => onSelect?.(i)}
            className={cn(focusRing, "block h-[190px] w-full cursor-pointer overflow-hidden rounded-photo shadow-photo-tile")}
          >
            <img src={photo.src} alt={photo.alt} className="size-full object-cover" />
          </button>
        </li>
      ))}
    </ul>
  );
}

export type MailFile = {
  name: string;
  detail?: string;
};

export type MailReadStatus = "loading" | "failed" | "ready";

export type MailMessageViewLabels = {
  title: string;
  reply: string;
  forward: string;
  delete: string;
  restore: string;
  deleteForever: string;
  toYou: string;
  scam: string;
  photos: (count: number) => string;
  saveAll: string;
  failed: string;
  retry: string;
  loading: string;
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
  failed: "This message couldn’t be opened. Try again.",
  retry: "Try again",
  loading: "Opening the email",
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
  /** `loading` shows placeholder words and holds Reply and Forward until every attachment is known; `failed` says so with Try again. */
  status?: MailReadStatus;
  /** Opens it again after it failed. */
  onRetry?: () => void;
  /** What a failure says, in place of "This message couldn’t be opened. Try again.". */
  errorLabel?: ReactNode;
  /** What saving every photo to Files actually did. */
  saveAllStatus?: MailSaveStatus;
  /** Tries saving the photos again. */
  onRetrySaveAll?: () => void;
  /** A bill Grace found in it: "Is this your bill?", then Open bill. */
  bill?: BillDetails;
  /** The person says the bill is theirs; never a payment. */
  onConfirmBill?: () => void;
  /** Not now. */
  onDismissBill?: () => void;
  /** Opens the confirmed bill on its site; opening never pays. */
  onOpenBill?: () => void;
  /** The bill offer's words, for another language. */
  billLabels?: Partial<BillOfferLabels>;
  /** The view's words, for another language. */
  labels?: Partial<MailMessageViewLabels>;
  /** Grace pointing inside the email; the target `scam` is her warning above a scam. */
  guide?: Pick<GuideAnchorProps, "kind" | "title" | "onClose" | "closeLabel"> & { targetId: "scam" };
};

/**
 * One email open: who sent it and when, the subject, the words, and its photos or files, with Reply as the one
 * next step and Grace's warning above a scam (prototype `mailView()`, read).
 * @model spec/app/emailItem.md
 * @design packages/design-system/design.md#windows
 * @design packages/design-system/design.md#screens
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
  status = "ready",
  onRetry,
  errorLabel,
  saveAllStatus,
  onRetrySaveAll,
  bill,
  onConfirmBill,
  onDismissBill,
  onOpenBill,
  billLabels,
  labels,
  backLabel = "Inbox",
  guide,
  ...props
}: MailMessageViewProps) {
  const { targetId, ...pointing } = guide ?? {};
  const l = { ...viewLabels, ...labels };
  const held = status !== "ready";
  const action = (label: string, icon: ReactNode, onClick?: () => void, prominent = false, disabled = false) => (onClick || disabled) && (
    <Button variant={prominent ? "prominent" : "plain"} size="compact" className={prominent ? "disabled:text-primary-foreground disabled:opacity-100" : headerPill} disabled={disabled} onClick={onClick}>
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
            {action(l.deleteForever, <mailIcons.trash {...pill} />, onDeleteForever)}
          </>
        ) : (
          <>
            {action(l.reply, <Reply {...pill} />, onReply, true, held)}
            {action(l.forward, <Forward {...pill} />, onForward, false, held)}
            {action(l.delete, <mailIcons.trash {...pill} />, onDelete)}
          </>
        )
      }
      {...props}
    >
      <article className="font-sans" aria-busy={status === "loading" || undefined}>
        {scam &&
          (targetId === "scam" ? (
            <GuideAnchor radius={22} className="mb-5 flex" {...pointing}>
              <Alert variant="caution" className="flex-1">{l.scam}</Alert>
            </GuideAnchor>
          ) : (
            <Alert variant="caution" className="mb-5">{l.scam}</Alert>
          ))}
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
        {status === "loading" ? (
          <div role="status" aria-label={l.loading} className="flex max-w-[880px] flex-col gap-2 py-1">
            {["w-full", "w-11/12", "w-2/3"].map((width) => (
              <Skeleton key={width} className={cn("h-[22px] rounded-full", width)} />
            ))}
          </div>
        ) : status === "failed" ? (
          <MailNotice actionLabel={l.retry} onAction={onRetry} className="max-w-[880px]">
            {errorLabel ?? l.failed}
          </MailNotice>
        ) : (
          <PageText className="max-w-[880px]">{body}</PageText>
        )}
        {bill && !held && <BillOffer {...bill} onConfirm={onConfirmBill} onDismiss={onDismissBill} onOpen={onOpenBill} labels={billLabels} className="mt-[22px]" />}
        {!held && photos?.length ? (
          <>
            <div className="mt-[22px] mb-3 flex items-center gap-3.5 text-foreground">
              <mailIcons.clip size={24} strokeWidth={2.2} aria-hidden />
              <span className="flex-1 text-body-lg leading-[30px] font-bold text-chrome">{l.photos(photos.length)}</span>
              {saveAllStatus && <MailActionStatus status={saveAllStatus} onRetry={onRetrySaveAll} />}
              <Button variant="capsule" size="pill" className={appButton} aria-busy={saveAllStatus === "saving" || undefined} disabled={saveAllStatus === "saving"} onClick={onSaveAll}>
                {pendingMark(saveAllStatus === "saving", <mailIcons.down {...pill} />)}
                {l.saveAll}
              </Button>
            </div>
            <MailPhotoGrid photos={photos} onSelect={onOpenPhoto} />
          </>
        ) : null}
        {!held &&
          files?.map((file, i) => (
            <MailAttachment
              key={file.name}
              name={file.name}
              detail={file.detail}
              className="mt-[22px]"
              onOpen={() => onOpenFile?.(i)}
            />
          ))}
      </article>
    </AppWindow>
  );
}

import type { ComponentProps, ReactNode } from "react";
import { Forward, Reply, Undo2 } from "lucide-react";
import { cn, focusRing } from "../lib/cn.ts";
import { Alert } from "./Alert.tsx";
import { GuideAnchor, guided, type Guide, type GuidePointing } from "./GuideAnchor.tsx";
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

export type MailLinkProps = ComponentProps<"a"> & {
  onOpen?: () => void;
  /** Grace pointing at the link (prototype `link`). */
  guide?: GuidePointing;
};

/** A link in an email's words: blue, underlined and bold (prototype `.a-link`). */
export function MailLink({ guide, className, onOpen, children, ...props }: MailLinkProps) {
  const style = cn(focusRing, "rounded-sm font-semibold text-link underline", className);
  const link = onOpen ? <button type="button" role="link" className={style} onClick={onOpen}>{children}</button>
    : <a className={style} {...props}>{children}</a>;
  return guide ? <GuideAnchor radius={4} {...guide}>{link}</GuideAnchor> : link;
}

export type MailPhoto = {
  src: string;
  alt: string;
};

export type MailPhotoGridProps = Omit<ComponentProps<"ul">, "onSelect"> & {
  /** The photos, three to a row. */
  photos: MailPhoto[];
  /** Called with the index of the photo tapped, to open it large; without it the photos are only shown. */
  onSelect?: (index: number) => void;
};

const tile = "block h-[190px] w-full overflow-hidden rounded-photo shadow-photo-tile";

/** An email's photos, three to a row, each opening the viewer (prototype `.a-photos`; a `.a-photo` has no press scale). */
export function MailPhotoGrid({ photos, onSelect, className, ...props }: MailPhotoGridProps) {
  return (
    <ul className={cn("m-0 grid list-none grid-cols-3 gap-4 p-0", className)} {...props}>
      {photos.map((photo, i) => {
        const image = <img src={photo.src} alt={photo.alt} decoding="async" loading="lazy" className="size-full object-cover" />;
        return (
          <li key={photo.src}>
            {onSelect ? (
              <button type="button" onClick={() => onSelect(i)} className={cn(focusRing, tile, "cursor-pointer")}>
                {image}
              </button>
            ) : (
              <span className={tile}>{image}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export type MailFile = {
  name: string;
  detail?: string;
};

export type MailReadStatus = "loading" | "failed" | "ready";

/** What Grace can point at in an open email (prototype `data-t`): her scam warning, the words, Save all and the first file. A link in the words takes its own `guide`. */
export type MailMessageTarget = "caution" | "mbody" | "saveall" | "file";

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
  /** It is her own email in Sent: Forward and Delete, never Reply. */
  sent?: boolean;
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
  /** Called with the index of the photo tapped; without it the photos are only shown. */
  onOpenPhoto?: (index: number) => void;
  /** Saves every photo to Files; without it Save all to Files is not offered. */
  onSaveAll?: () => void;
  /** Called with the index of the file to open; without it the files offer no Open. */
  onOpenFile?: (index: number) => void;
  /** `loading` shows placeholder words and holds Reply and Forward until every attachment is known; `failed` says so with Try again. */
  status?: MailReadStatus;
  /** Opens it again after it failed; without it the failure offers no Try again. */
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
  /** Grace pointing inside the email. */
  guide?: Guide<MailMessageTarget>;
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
  sent = false,
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
            {!sent && action(l.reply, <Reply {...pill} />, onReply, true, held)}
            {action(l.forward, <Forward {...pill} />, onForward, sent, held)}
            {action(l.delete, <mailIcons.trash {...pill} />, onDelete)}
          </>
        )
      }
      {...props}
    >
      <article className="font-sans" aria-busy={status === "loading" || undefined}>
        {scam && <div className="mb-5 flex">{guided(guide, "caution", <Alert variant="caution" className="flex-1">{l.scam}</Alert>, { radius: 22, placement: "below", className: "flex flex-1" })}</div>}
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
          <MailNotice actionLabel={onRetry && l.retry} onAction={onRetry} className="max-w-[880px]">
            {errorLabel ?? l.failed}
          </MailNotice>
        ) : (
          guided(guide, "mbody", <PageText asChild className="max-w-[880px]"><div>{body}</div></PageText>, { radius: 12, placement: "below", className: "flex max-w-[880px]" })
        )}
        {bill && !held && <BillOffer {...bill} onConfirm={onConfirmBill} onDismiss={onDismissBill} onOpen={onOpenBill} labels={billLabels} className="mt-[22px]" />}
        {!held && photos?.length ? (
          <>
            <div className="mt-[22px] mb-3 flex items-center gap-3.5 text-foreground">
              <mailIcons.clip size={24} strokeWidth={2.2} aria-hidden />
              <span className="flex-1 text-body-lg leading-[30px] font-bold text-chrome">{l.photos(photos.length)}</span>
              {saveAllStatus && <MailActionStatus status={saveAllStatus} onRetry={onRetrySaveAll} />}
              {onSaveAll &&
                guided(
                  guide,
                  "saveall",
                  <Button variant="capsule" size="pill" className={appButton} aria-busy={saveAllStatus === "saving" || undefined} disabled={saveAllStatus === "saving"} onClick={onSaveAll}>
                    {pendingMark(saveAllStatus === "saving", <mailIcons.down {...pill} />)}
                    {l.saveAll}
                  </Button>,
                  { radius: 999 },
                )}
            </div>
            <MailPhotoGrid photos={photos} onSelect={onOpenPhoto} />
          </>
        ) : null}
        {!held &&
          files?.map((file, i) => {
            const attachment = <MailAttachment name={file.name} detail={file.detail} className="flex-1" onOpen={onOpenFile && (() => onOpenFile(i))} />;
            return (
              <div key={file.name} className="mt-[22px] flex max-w-[760px]">
                {i === 0 ? guided(guide, "file", attachment, { radius: 22, placement: "below", className: "flex flex-1" }) : attachment}
              </div>
            );
          })}
      </article>
    </AppWindow>
  );
}

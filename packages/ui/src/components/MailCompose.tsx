import { useId, type ComponentProps, type ReactNode } from "react";
import { ArrowUp, Image, Plus, X } from "lucide-react";
import { cn, focusRing } from "../lib/cn.ts";
import { AppWindow, type AppWindowProps } from "./AppWindow.tsx";
import { Button } from "./Button.tsx";
import { Menu, MenuOption } from "./Menu.tsx";
import { appButton, appProminent, headerPill, pendingMark } from "./MailActionStatus.tsx";
import { MailContactAvatar, mailIcons, type MailContact } from "./MailMessageRow.tsx";
import type { MailPhoto } from "./MailMessageView.tsx";
import { MailNotice } from "./MailNotice.tsx";

export type MailRecipientField = "to" | "cc" | "bcc";

export type MailSendStatus = "idle" | "sending" | "failed" | "unknown" | "saveFailed";

export type MailAttachSource = "camera" | "photos" | "file";

export type MailRecipientChipProps = ComponentProps<"span"> & {
  /** Who it is to. */
  contact: MailContact;
  /** Takes them off. */
  onRemove?: () => void;
  /** The ✕'s accessible name. */
  removeLabel?: string;
};

/** A recipient on a line of the email: their avatar and name, with ✕ (prototype `.a-chipc`). */
export function MailRecipientChip({ contact, onRemove, removeLabel = `Remove ${contact.name}`, className, ...props }: MailRecipientChipProps) {
  return (
    <span className={cn("inline-flex h-[60px] items-center gap-3 rounded-full bg-panel pr-5 pl-2 text-body-lg leading-none font-bold text-chrome", className)} {...props}>
      <MailContactAvatar contact={contact} size={46} style={{ fontSize: 18 }} aria-hidden data-prototype-ink />
      {contact.name}
      <button type="button" aria-label={removeLabel} onClick={onRemove} className={cn(focusRing, "-mr-2 ml-1 inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground")}>
        <X size={18} strokeWidth={2.4} aria-hidden />
      </button>
    </span>
  );
}

function Line({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  const Name = htmlFor ? "label" : "span";
  return (
    <div className="box-content flex min-h-[72px] items-center gap-4 border-b-[1.5px] border-primary/10">
      <Name htmlFor={htmlFor} className="w-[110px] flex-none text-body leading-none font-bold text-muted-foreground">{label}</Name>
      {children}
    </div>
  );
}

const addButton = cn(appButton, "size-[52px] p-0");

export type MailComposeLabels = {
  to: string;
  cc: string;
  bcc: string;
  ccBcc: string;
  add: string;
  addTo: (line: string) => string;
  subject: string;
  subjectPlaceholder: string;
  bodyPlaceholder: string;
  send: string;
  attach: string;
  camera: string;
  photos: string;
  file: string;
  discard: string;
  removeAttachment: string;
  sendFailed: string;
  sendUnknown: string;
  saveFailed: string;
  retry: string;
};

const composeLabels: MailComposeLabels = {
  to: "To",
  cc: "Cc",
  bcc: "Bcc",
  ccBcc: "Cc/Bcc",
  add: "Add",
  addTo: (line) => `Add to ${line}`,
  subject: "Subject",
  subjectPlaceholder: "What it’s about",
  bodyPlaceholder: "Write your message, or ask Grace to help",
  send: "Send",
  attach: "Attach",
  camera: "Take a photo",
  photos: "Choose from Photos",
  file: "Choose a file",
  discard: "Discard",
  removeAttachment: "Remove",
  sendFailed: "The email wasn’t sent. Check it and press Send again.",
  sendUnknown: "I’m not sure this email was sent. I’m checking before it can be sent again.",
  saveFailed: "Sent. Saving the record didn’t work.",
  retry: "Try again",
};

export type MailComposeProps = Omit<AppWindowProps, "icon" | "nav" | "actions" | "children" | "title"> & {
  /** The window's title: "New email", "Reply". */
  title?: string;
  /** Who it is to. */
  to: MailContact[];
  /** Who gets a copy. */
  cc?: MailContact[];
  /** Who gets a hidden copy. */
  bcc?: MailContact[];
  /** Shows the Cc and Bcc lines though both are empty. */
  ccOpen?: boolean;
  /** Opens the Cc and Bcc lines. */
  onOpenCc?: () => void;
  /** Opens the recipient picker for a line. */
  onAddRecipient?: (field: MailRecipientField) => void;
  /** Takes a recipient off a line. */
  onRemoveRecipient?: (field: MailRecipientField, index: number) => void;
  subject: string;
  onSubjectChange?: (subject: string) => void;
  body: string;
  onBodyChange?: (body: string) => void;
  /** Photos attached, as thumbnails. */
  attachments?: MailPhoto[];
  /** Called with the index of the attachment to take off. */
  onRemoveAttachment?: (index: number) => void;
  /** Sends it. */
  onSend?: () => void;
  /** Called with where to attach from: the camera, Photos or a file. */
  onAttach?: (source: MailAttachSource) => void;
  /** Whether Attach's menu is open, when the app controls it. */
  attachOpen?: boolean;
  onAttachOpenChange?: (open: boolean) => void;
  /** Throws the email away. */
  onDiscard?: () => void;
  /** Where sending stands; the draft stays editable after a failure. */
  sendStatus?: MailSendStatus;
  /** Saves the sent email's record again, without sending it again. */
  onRetrySave?: () => void;
  /** The draft could not be saved: what it says over the reopened draft, with Try again. */
  draftError?: ReactNode;
  /** Saves the draft again. */
  onRetryDraft?: () => void;
  /** The form's words, for another language. */
  labels?: Partial<MailComposeLabels>;
};

/**
 * Writing an email: To, Cc and Bcc as people, the subject and the words, photos attached, with Send as the one
 * next step and Attach beside it (prototype `mailView()`, compose).
 * @model spec/app/email.md
 * @design packages/design-system/design.md#windows
 * @design packages/design-system/design.md#screens
 */
export function MailCompose({
  title = "New email",
  to,
  cc = [],
  bcc = [],
  ccOpen = false,
  onOpenCc,
  onAddRecipient,
  onRemoveRecipient,
  subject,
  onSubjectChange,
  body,
  onBodyChange,
  attachments = [],
  onRemoveAttachment,
  onSend,
  onAttach,
  attachOpen,
  onAttachOpenChange,
  onDiscard,
  sendStatus = "idle",
  onRetrySave,
  draftError,
  onRetryDraft,
  labels,
  backLabel = "Inbox",
  ...props
}: MailComposeProps) {
  const l = { ...composeLabels, ...labels };
  const notices: Partial<Record<MailSendStatus, string>> = { failed: l.sendFailed, unknown: l.sendUnknown, saveFailed: l.saveFailed };
  const notice = notices[sendStatus];
  const sending = sendStatus === "sending";
  const subjectId = useId();
  const recipients = (field: MailRecipientField, people: MailContact[]) => (
    <Line label={l[field]}>
      <span className="flex flex-1 flex-wrap items-center gap-2.5 py-1.5">
        {people.map((person, i) => (
          <MailRecipientChip key={person.name} contact={person} onRemove={() => onRemoveRecipient?.(field, i)} />
        ))}
        <Button variant="capsule" size="compact-icon" className={addButton} aria-label={l.addTo(l[field])} onClick={() => onAddRecipient?.(field)}>
          <Plus size={20} strokeWidth={2.4} aria-hidden />
        </Button>
      </span>
    </Line>
  );
  return (
    <AppWindow
      title={title}
      backLabel={backLabel}
      actions={
        <Button variant="plain" size="compact" className={headerPill} onClick={onDiscard}>
          <mailIcons.trash size={22} strokeWidth={2.2} aria-hidden />
          {l.discard}
        </Button>
      }
      {...props}
    >
      <form className="font-sans" onSubmit={(event) => { event.preventDefault(); onSend?.(); }}>
        {draftError != null && (
          <MailNotice actionLabel={l.retry} onAction={onRetryDraft} className="mb-3">
            {draftError}
          </MailNotice>
        )}
        {recipients("to", to)}
        {ccOpen || cc.length || bcc.length ? (
          <>
            {recipients("cc", cc)}
            {recipients("bcc", bcc)}
          </>
        ) : (
          <Line label={l.ccBcc}>
            <Button variant="capsule" size="compact" className={cn(appButton, "h-[52px] gap-2.5 px-5")} onClick={onOpenCc}>
              <Plus size={20} strokeWidth={2.4} aria-hidden />
              {l.add}
            </Button>
          </Line>
        )}
        <Line label={l.subject} htmlFor={subjectId}>
          <input
            id={subjectId}
            value={subject}
            placeholder={l.subjectPlaceholder}
            onChange={(event) => onSubjectChange?.(event.target.value)}
            className="min-w-0 flex-1 bg-transparent px-0.5 py-px text-body-lg leading-[30px] text-foreground outline-none placeholder:text-field-placeholder"
          />
        </Line>
        <textarea
          aria-label={l.bodyPlaceholder}
          value={body}
          placeholder={l.bodyPlaceholder}
          onChange={(event) => onBodyChange?.(event.target.value)}
          className={cn("mt-[18px] box-border block w-full", notice || draftError != null ? "min-h-0" : "min-h-[154px]", "resize-none bg-transparent pt-1 pb-2 text-body-lg leading-8 text-foreground outline-none placeholder:text-field-placeholder")}
        />
        {attachments.length > 0 && (
          <ul className="m-0 mt-2.5 flex list-none gap-3 p-0">
            {attachments.map((photo, i) => (
              <li key={photo.src} className="relative h-[110px] w-[150px] overflow-hidden rounded-xl shadow-attachment">
                <img src={photo.src} alt={photo.alt} className="size-full object-cover" />
                <Button variant="capsule" size="compact-icon" className="absolute top-1.5 right-1.5 size-9 text-chrome transition-none active:scale-96" aria-label={`${l.removeAttachment} ${photo.alt}`} onClick={() => onRemoveAttachment?.(i)}>
                  <X size={20} strokeWidth={2.4} aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {notice && (
          <MailNotice actionLabel={sendStatus === "saveFailed" ? l.retry : undefined} onAction={onRetrySave} className="mt-[18px]">
            {notice}
          </MailNotice>
        )}
        <div className="mt-[18px] flex gap-3">
          <Button type="submit" variant="prominent" size="pill" className={appProminent} aria-busy={sending || undefined} disabled={sending || sendStatus === "unknown" || sendStatus === "saveFailed"}>
            {pendingMark(sending, <ArrowUp size={22} strokeWidth={2.4} aria-hidden />)}
            {l.send}
          </Button>
          <Menu
            open={attachOpen}
            onOpenChange={onAttachOpenChange}
            trigger={
              <Button variant="capsule" size="pill" className={cn(appButton, "data-[state=open]:text-primary")}>
                <mailIcons.clip size={22} strokeWidth={2.2} aria-hidden />
                {l.attach}
              </Button>
            }
            alignOffset={11}
            sideOffset={12}
            surface="page"
          >
            <MenuOption icon={<mailIcons.camera size={24} strokeWidth={2.2} aria-hidden />} onSelect={() => onAttach?.("camera")}>{l.camera}</MenuOption>
            <MenuOption icon={<Image size={24} strokeWidth={2.2} aria-hidden />} onSelect={() => onAttach?.("photos")}>{l.photos}</MenuOption>
            <MenuOption icon={<mailIcons.file size={24} strokeWidth={2.2} aria-hidden />} onSelect={() => onAttach?.("file")}>{l.file}</MenuOption>
          </Menu>
        </div>
      </form>
    </AppWindow>
  );
}

import { useId, type ComponentProps, type ReactNode } from "react";
import { ArrowUp, Camera, FileText, Image, Paperclip, Plus, Trash, X } from "lucide-react";
import { cn, focusRing } from "../lib/cn.ts";
import { AppWindow, type AppWindowProps } from "./AppWindow.tsx";
import { Button } from "./Button.tsx";
import { Menu, MenuOption } from "./Menu.tsx";
import { MailContactAvatar, type MailContact } from "./MailMessageRow.tsx";
import type { MailPhoto } from "./MailMessageView.tsx";

/** A line of recipients. */
export type MailRecipientField = "to" | "cc" | "bcc";

/** Where an attachment comes from. */
export type MailAttachSource = "camera" | "photos" | "file";

export type MailRecipientChipProps = ComponentProps<"span"> & {
  /** Who it is to. */
  contact: MailContact;
  /** Takes them off; without it there is no ✕. */
  onRemove?: () => void;
  /** The ✕'s accessible name. */
  removeLabel?: string;
};

/** A recipient on a line of the email: their avatar and name, with ✕ (prototype `.a-chipc`). */
export function MailRecipientChip({ contact, onRemove, removeLabel = `Remove ${contact.name}`, className, ...props }: MailRecipientChipProps) {
  return (
    <span className={cn("inline-flex h-[60px] items-center gap-3 rounded-full bg-panel pr-5 pl-2 text-body-lg leading-none font-bold text-chrome", className)} {...props}>
      <MailContactAvatar contact={contact} size={46} aria-hidden />
      {contact.name}
      {onRemove && (
        // Prototype `.rcx`.
        <button type="button" aria-label={removeLabel} onClick={onRemove} className={cn(focusRing, "-mr-2 ml-1 inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground")}>
          <X size={18} strokeWidth={2.4} aria-hidden />
        </button>
      )}
    </span>
  );
}

/** One line of the form: its name on the left, its value beside it, a rule under it (prototype `.a-frow`). */
function Line({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  const Name = htmlFor ? "label" : "span";
  return (
    <div className="box-content flex min-h-[72px] items-center gap-4 border-b-[1.5px] border-primary/10">
      <Name htmlFor={htmlFor} className="w-[110px] flex-none text-body leading-none font-bold text-muted-foreground">{label}</Name>
      {children}
    </div>
  );
}

/** The round capsule that adds a recipient (prototype `.a-btn.rcadd`). */
const addButton = "size-[52px] p-0";

/** The words of the email being written, for another language. */
export type MailComposeLabels = {
  to: string;
  cc: string;
  bcc: string;
  ccBcc: string;
  add: string;
  /** The accessible name of a line's +: "Add to To". */
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
  /** The form's words, for another language. */
  labels?: Partial<MailComposeLabels>;
};

/**
 * Writing an email: To, Cc and Bcc as people, the subject and the words, photos attached, with Send as the one
 * next step and Attach beside it (prototype `mailView()`, compose).
 * @model spec/app/email.md
 * @design packages/design-system/design.md#windows
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
  labels,
  backLabel = "Inbox",
  ...props
}: MailComposeProps) {
  const l = { ...composeLabels, ...labels };
  const subjectId = useId();
  const recipients = (field: MailRecipientField, people: MailContact[]) => (
    <Line label={l[field]}>
      <span className="flex flex-1 flex-wrap items-center gap-2.5 py-1.5">
        {people.map((person, i) => (
          <MailRecipientChip key={person.name} contact={person} onRemove={onRemoveRecipient && (() => onRemoveRecipient(field, i))} />
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
        onDiscard && (
          <Button variant="plain" size="compact" className="pr-5 pl-4 text-grace-ink" onClick={onDiscard}>
            <Trash size={22} strokeWidth={2.2} aria-hidden />
            {l.discard}
          </Button>
        )
      }
      {...props}
    >
      <form className="font-sans" onSubmit={(event) => { event.preventDefault(); onSend?.(); }}>
        {recipients("to", to)}
        {ccOpen || cc.length || bcc.length ? (
          <>
            {recipients("cc", cc)}
            {recipients("bcc", bcc)}
          </>
        ) : (
          <Line label={l.ccBcc}>
            <Button variant="capsule" size="compact" className="h-[52px] gap-2.5 px-5" onClick={onOpenCc}>
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
            className="min-w-0 flex-1 bg-transparent px-0.5 py-px text-body-lg leading-[30px] text-foreground outline-none placeholder:text-muted-foreground"
          />
        </Line>
        {/* Prototype: 150px, plus the 4px its inline textarea leaves beneath it. */}
        <textarea
          aria-label={l.bodyPlaceholder}
          value={body}
          placeholder={l.bodyPlaceholder}
          onChange={(event) => onBodyChange?.(event.target.value)}
          className="mt-[18px] box-border block min-h-[154px] w-full resize-none bg-transparent pt-1 pb-2 text-body-lg leading-8 text-foreground outline-none placeholder:text-muted-foreground"
        />
        {attachments.length > 0 && (
          // Prototype `.a-thumbs`.
          <ul className="m-0 mt-2.5 flex list-none gap-3 p-0">
            {attachments.map((photo, i) => (
              <li key={photo.src} className="relative h-[110px] w-[150px] overflow-hidden rounded-xl shadow-picture">
                <img src={photo.src} alt={photo.alt} className="size-full object-cover" />
                <Button variant="capsule" size="compact-icon" className="absolute top-1.5 right-1.5 size-9" aria-label={`${l.removeAttachment} ${photo.alt}`} onClick={() => onRemoveAttachment?.(i)}>
                  <X size={20} strokeWidth={2.4} aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-[18px] flex gap-3">
          <Button type="submit" variant="prominent" size="pill" className="pr-[26px] pl-[22px]">
            <ArrowUp size={22} strokeWidth={2.4} aria-hidden />
            {l.send}
          </Button>
          {/* Prototype `.apop` at left:150px, top:76px of `.a-btns`, 320px of options inside 8px of padding. */}
          <Menu
            open={attachOpen}
            onOpenChange={onAttachOpenChange}
            trigger={
              // Open, Attach is selected: the raised white platter with an indigo label.
              <Button variant="capsule" size="pill" className="pr-[26px] pl-[22px] data-[state=open]:bg-card data-[state=open]:text-primary data-[state=open]:shadow-raised">
                <Paperclip size={22} strokeWidth={2.2} aria-hidden />
                {l.attach}
              </Button>
            }
            alignOffset={11}
            sideOffset={12}
            className="min-w-[336px] bg-glass/95"
          >
            <MenuOption icon={<Camera size={24} strokeWidth={2.2} aria-hidden />} className="h-[60px] bg-panel" onSelect={() => onAttach?.("camera")}>{l.camera}</MenuOption>
            <MenuOption icon={<Image size={24} strokeWidth={2.2} aria-hidden />} className="h-[60px] bg-panel" onSelect={() => onAttach?.("photos")}>{l.photos}</MenuOption>
            <MenuOption icon={<FileText size={24} strokeWidth={2.2} aria-hidden />} className="h-[60px] bg-panel" onSelect={() => onAttach?.("file")}>{l.file}</MenuOption>
          </Menu>
        </div>
      </form>
    </AppWindow>
  );
}

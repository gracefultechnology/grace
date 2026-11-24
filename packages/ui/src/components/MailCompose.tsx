import { useId, type ComponentProps, type ReactNode } from "react";
import { ArrowUp, ChevronDown, Image, Plus, X } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn, focusRing } from "../lib/cn.ts";
import { AppWindow, type AppWindowProps } from "./AppWindow.tsx";
import { Button } from "./Button.tsx";
import { guided, type Guide } from "./GuideAnchor.tsx";
import { Menu, MenuLabel, MenuOption } from "./Menu.tsx";
import { appButton, appProminent, headerPill, pendingMark } from "./MailActionStatus.tsx";
import { MailContactAvatar, mailIcons, type MailContact } from "./MailMessageRow.tsx";
import type { MailPhoto } from "./MailMessageView.tsx";
import { MailNotice } from "./MailNotice.tsx";

export type MailRecipientField = "to" | "cc" | "bcc";

export type MailSendStatus = "idle" | "sending" | "failed" | "unknown" | "saveFailed";

export type MailAttachSource = "camera" | "photos" | "file";

/** What Grace can point at while an email is written (prototype `data-t`): the From line, the words and Send. */
export type MailComposeTarget = "from" | "body" | "send";

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
      {onRemove && (
        <button type="button" aria-label={removeLabel} onClick={onRemove} className={cn(focusRing, "-mr-2 ml-1 inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground")}>
          <X size={18} strokeWidth={2.4} aria-hidden />
        </button>
      )}
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

export type MailFromAccount = {
  id: number;
  /** The address it sends from. */
  address: string;
  /** Its name on the tablet: "Gmail". */
  name: string;
};

export type MailFromMenuLabels = { sendFrom: string; close: string };

export type MailFromMenuProps = {
  /** The email accounts that can send. */
  accounts: MailFromAccount[];
  /** The one it goes from. */
  selected: number;
  /** Called with the account chosen. */
  onSelect?: (id: number) => void;
  /** Whether the menu is open, when the app controls it. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Its words, for another language. */
  labels?: Partial<MailFromMenuLabels>;
};

/** The address an email goes from, opening "Send from" with each account's address and name (prototype `.rpop.acmenu`). */
export function MailFromMenu({ accounts, selected, onSelect, open, onOpenChange, labels }: MailFromMenuProps) {
  const l = { sendFrom: "Send from", close: "Close", ...labels };
  return (
    <Menu
      open={open}
      onOpenChange={onOpenChange}
      trigger={
        <Button variant="capsule" size="compact" className={cn(appButton, "h-14 gap-2.5 px-5 data-[state=open]:text-primary")}>
          {accounts.find((account) => account.id === selected)?.address}
          <ChevronDown size={20} strokeWidth={2.2} aria-hidden />
        </Button>
      }
      sideOffset={12}
      surface="page"
    >
      <div className="flex items-center justify-between gap-5 pl-3">
        <MenuLabel className="m-0 text-body-lg leading-7 tracking-[.01em] normal-case">{l.sendFrom}</MenuLabel>
        <DropdownMenu.Item asChild>
          <Button variant="capsule" size="compact-icon" aria-label={l.close} className={cn(focusRing, "size-13 text-chrome outline-none active:scale-96")}>
            <X size={22} strokeWidth={2} aria-hidden />
          </Button>
        </DropdownMenu.Item>
      </div>
      {accounts.map((account) => (
        <MenuOption key={account.id} selected={account.id === selected} className="h-auto min-h-[76px] justify-start rounded-row py-2.5" onSelect={() => onSelect?.(account.id)}>
          <span className="flex min-w-0 flex-col items-start">
            <span className="truncate">{account.address}</span>
            <span className="text-control leading-6 font-medium text-muted-foreground">{account.name}</span>
          </span>
        </MenuOption>
      ))}
    </Menu>
  );
}

export type MailComposeLabels = {
  from: string;
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
  from: "From",
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
  /** Which email it goes from: a From line, shown only when two or more accounts can send. */
  from?: Omit<MailFromMenuProps, "labels">;
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
  /** Sends it; without it Send is shown but cannot be pressed. */
  onSend?: () => void;
  /** One handler for each place Attach can take from: the camera, Photos or a file; a missing one is not offered. */
  onAttach?: Partial<Record<MailAttachSource, () => void>>;
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
  /** Grace pointing at the From line, the words or Send. */
  guide?: Guide<MailComposeTarget>;
};

/**
 * Writing an email: From when there are several accounts, To, Cc and Bcc as people, the subject and the words, photos attached, with Send as the one
 * next step and Attach beside it (prototype `mailView()`, compose).
 * @model spec/app/email.md
 * @design packages/design-system/design.md#windows
 * @design packages/design-system/design.md#screens
 */
export function MailCompose({
  title = "New email",
  from,
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
  guide,
  backLabel = "Inbox",
  onBack,
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
          <MailRecipientChip key={person.name} contact={person} onRemove={onRemoveRecipient && (() => onRemoveRecipient(field, i))} />
        ))}
        {onAddRecipient && (
          <Button variant="capsule" size="compact-icon" className={addButton} aria-label={l.addTo(l[field])} onClick={() => onAddRecipient(field)}>
            <Plus size={20} strokeWidth={2.4} aria-hidden />
          </Button>
        )}
      </span>
    </Line>
  );
  return (
    <AppWindow
      title={title}
      backLabel={onBack && backLabel}
      onBack={onBack}
      actions={
        onDiscard && (
          <Button variant="plain" size="compact" className={headerPill} onClick={onDiscard}>
            <mailIcons.trash size={22} strokeWidth={2.2} aria-hidden />
            {l.discard}
          </Button>
        )
      }
      {...props}
    >
      <form className="font-sans" onSubmit={(event) => { event.preventDefault(); onSend?.(); }}>
        {draftError != null && (
          <MailNotice actionLabel={onRetryDraft && l.retry} onAction={onRetryDraft} className="mb-3">
            {draftError}
          </MailNotice>
        )}
        {from && from.accounts.length > 1 && (
          <Line label={l.from}>
            {guided(guide, "from", <MailFromMenu {...from} />, { radius: 999 })}
          </Line>
        )}
        {recipients("to", to)}
        {ccOpen || cc.length || bcc.length ? (
          <>
            {recipients("cc", cc)}
            {recipients("bcc", bcc)}
          </>
        ) : onOpenCc && (
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
            readOnly={!onSubjectChange}
            onChange={(event) => onSubjectChange?.(event.target.value)}
            className="min-w-0 flex-1 bg-transparent px-0.5 py-px text-body-lg leading-[30px] text-foreground outline-none placeholder:text-field-placeholder"
          />
        </Line>
        <div className="mt-[18px] flex">
          {guided(
            guide,
            "body",
            <textarea
              aria-label={l.bodyPlaceholder}
              value={body}
              placeholder={l.bodyPlaceholder}
              readOnly={!onBodyChange}
              onChange={(event) => onBodyChange?.(event.target.value)}
              className={cn("box-border block w-full", notice || draftError != null ? "min-h-0" : "min-h-[154px]", "resize-none bg-transparent pt-1 pb-2 text-body-lg leading-8 text-foreground outline-none placeholder:text-field-placeholder")}
            />,
            { radius: 12, placement: "below", className: "flex flex-1" },
          )}
        </div>
        {attachments.length > 0 && (
          <ul className="m-0 mt-2.5 flex list-none gap-3 p-0">
            {attachments.map((photo, i) => (
              <li key={photo.src} className="relative h-[110px] w-[150px] overflow-hidden rounded-xl shadow-attachment">
                <img src={photo.src} alt={photo.alt} decoding="async" loading="lazy" className="size-full object-cover" />
                {onRemoveAttachment && (
                  <Button variant="capsule" size="compact-icon" className="absolute top-1.5 right-1.5 size-9 text-chrome transition-none active:scale-96" aria-label={`${l.removeAttachment} ${photo.alt}`} onClick={() => onRemoveAttachment(i)}>
                    <X size={20} strokeWidth={2.4} aria-hidden />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {notice && (
          <MailNotice actionLabel={sendStatus === "saveFailed" && onRetrySave ? l.retry : undefined} onAction={onRetrySave} className="mt-[18px]">
            {notice}
          </MailNotice>
        )}
        <div className="mt-[18px] flex gap-3">
          {guided(
            guide,
            "send",
            <Button type="submit" variant="prominent" size="pill" className={appProminent} aria-busy={sending || undefined} disabled={!onSend || sending || sendStatus === "unknown" || sendStatus === "saveFailed"}>
              {pendingMark(sending, <ArrowUp size={22} strokeWidth={2.4} aria-hidden />)}
              {l.send}
            </Button>,
            { radius: 999 },
          )}
          {onAttach && Object.values(onAttach).some(Boolean) && (
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
              {onAttach.camera && <MenuOption icon={<mailIcons.camera size={24} strokeWidth={2.2} aria-hidden />} onSelect={onAttach.camera}>{l.camera}</MenuOption>}
              {onAttach.photos && <MenuOption icon={<Image size={24} strokeWidth={2.2} aria-hidden />} onSelect={onAttach.photos}>{l.photos}</MenuOption>}
              {onAttach.file && <MenuOption icon={<mailIcons.file size={24} strokeWidth={2.2} aria-hidden />} onSelect={onAttach.file}>{l.file}</MenuOption>}
            </Menu>
          )}
        </div>
      </form>
    </AppWindow>
  );
}

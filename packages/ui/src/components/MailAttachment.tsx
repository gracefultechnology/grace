import type { ComponentProps } from "react";
import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";
import { MailActionStatus, appButton, type MailActionStatusLabels, type MailSaveStatus } from "./MailActionStatus.tsx";
import { mailIcons } from "./MailMessageRow.tsx";

export type MailAttachmentProps = ComponentProps<"div"> & {
  /** The file's name: "Visit form.pdf". */
  name: string;
  /** What it holds: "2 pages". */
  detail?: string;
  /** The type on the file's icon: "PDF". */
  kind?: string;
  /** Opens the file in the reader. */
  onOpen?: () => void;
  /** The Open button's words. */
  openLabel?: string;
  /** Whether the original can be opened. */
  openDisabled?: boolean;
  /** What saving it to Files actually did, shown in place of `detail`. */
  saveStatus?: MailSaveStatus;
  /** Tries the failed save again. */
  onRetry?: () => void;
  /** The status words, for another language. */
  statusLabels?: Partial<MailActionStatusLabels>;
};

/**
 * A file attached to an email, with Open (prototype `.a-att`).
 * @model spec/app/email.md
 * @design packages/design-system/design.md#windows
 */
export function MailAttachment({ name, detail, kind = "PDF", onOpen, openLabel = "Open", openDisabled, saveStatus, onRetry, statusLabels, className, ...props }: MailAttachmentProps) {
  return (
    <div className={cn("flex max-w-[760px] items-center gap-4 rounded-row bg-panel px-4 py-3.5 font-sans", className)} {...props}>
      <span aria-hidden className="flex h-16 w-14 flex-none flex-col items-center justify-center gap-1 rounded-lg bg-card text-caption leading-none font-bold text-destructive shadow-tile">
        <mailIcons.file size={26} strokeWidth={2} />
        {kind}
      </span>
      <div className="min-w-0">
        <div className="truncate text-body-lg leading-[30px] font-bold text-chrome">{name}</div>
        {saveStatus ? (
          <MailActionStatus status={saveStatus} onRetry={onRetry} labels={statusLabels} className="mt-0.5" />
        ) : (
          detail && <div className="mt-0.5 text-body leading-[26px] font-medium text-muted-foreground">{detail}</div>
        )}
      </div>
      <Button variant="capsule" size="pill" className={cn(appButton, "ml-auto")} onClick={onOpen} disabled={openDisabled}>
        {openLabel}
      </Button>
    </div>
  );
}

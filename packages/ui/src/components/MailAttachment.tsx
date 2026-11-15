import type { ComponentProps } from "react";
import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";
import { MailActionStatus, pendingMark, type MailActionStatusLabels, type MailPrintStatus, type MailSaveStatus } from "./MailActionStatus.tsx";
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
  /** Prints it; without it there is no Print. */
  onPrint?: () => void;
  /** The Open button's words. */
  openLabel?: string;
  /** The Print button's words. */
  printLabel?: string;
  /** What saving it to Files actually did, shown in place of `detail`. */
  saveStatus?: MailSaveStatus;
  /** What printing it actually did, shown in place of `detail`: Print waits while it is sent and while the printer's answer is unknown. */
  printStatus?: MailPrintStatus;
  /** Tries the failed save or print again. */
  onRetry?: () => void;
  /** The status words, for another language. */
  statusLabels?: Partial<MailActionStatusLabels>;
};

/**
 * A file attached to an email, with Open and Print (prototype `.a-att`).
 * @model spec/app/email.md
 * @design packages/design-system/design.md#windows
 */
export function MailAttachment({ name, detail, kind = "PDF", onOpen, onPrint, openLabel = "Open", printLabel = "Print", saveStatus, printStatus, onRetry, statusLabels, className, ...props }: MailAttachmentProps) {
  // spec/app/files.md, "Printing reports actual printer acceptance and preserves an uncertain request": the latest action reports.
  const report = printStatus ? ({ action: "print", status: printStatus } as const) : saveStatus ? ({ action: "save", status: saveStatus } as const) : null;
  return (
    <div className={cn("flex max-w-[760px] items-center gap-4 rounded-row bg-panel px-4 py-3.5 font-sans", className)} {...props}>
      {/* Prototype `.a-att .ft`: a white page with the file's type in red; its 800 draws at 700, the heaviest Figtree it loads. */}
      <span aria-hidden className="flex h-16 w-14 flex-none flex-col items-center justify-center gap-1 rounded-lg bg-card text-[13px] leading-none font-bold text-destructive shadow-tile">
        <mailIcons.file size={26} strokeWidth={2} />
        {kind}
      </span>
      <div className="min-w-0">
        <div className="truncate text-body-lg leading-[30px] font-bold text-chrome">{name}</div>
        {report ? (
          <MailActionStatus {...report} onRetry={onRetry} labels={statusLabels} className="mt-0.5" />
        ) : (
          detail && <div className="mt-0.5 text-body leading-[26px] font-medium text-muted-foreground">{detail}</div>
        )}
      </div>
      <span className="ml-auto flex gap-3">
        {/* Prototype `.a-att .a-btn:not(.prom)`: glass capsules on the panel, over the markup's inline white. */}
        <Button variant="capsule" size="pill" onClick={onOpen}>
          {openLabel}
        </Button>
        {onPrint && (
          <Button variant="capsule" size="pill" aria-busy={printStatus === "pending" || undefined} disabled={printStatus === "pending" || printStatus === "unknown"} onClick={onPrint}>
            {pendingMark(printStatus === "pending", <mailIcons.printer size={22} strokeWidth={2.2} aria-hidden />)}
            {printLabel}
          </Button>
        )}
      </span>
    </div>
  );
}

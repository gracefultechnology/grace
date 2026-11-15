import type { ComponentProps } from "react";
import { FileIcon } from "../icons.tsx";
import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";
import { MailActionStatus, pendingMark, type MailActionStatusLabels, type MailPrintStatus } from "./MailActionStatus.tsx";

export type FileDocumentRowProps = Omit<ComponentProps<"div">, "children"> & {
  /** The file's name, such as "Visit form.pdf". */
  name: string;
  /** Where it came from and when it was saved. */
  detail?: string;
  /** The word on the file's badge. */
  kind?: string;
  /** Called by Open. */
  onOpen?: () => void;
  /** Called by Print; without it there is no Print. */
  onPrint?: () => void;
  openLabel?: string;
  printLabel?: string;
  /** What the last Print actually did; it shows in place of the detail. */
  printStatus?: MailPrintStatus;
  /** Prints again after a failed print. */
  onRetryPrint?: () => void;
  /** The words of the print status, for another language. */
  statusLabels?: Partial<MailActionStatusLabels>;
};

/**
 * A saved document: a file badge, its name and where it came from, with Open and Print (prototype `.a-att` in Files).
 * @model spec/app/files.md
 * @design packages/design-system/design.md#windows
 */
export function FileDocumentRow({ name, detail, kind = "PDF", onOpen, onPrint, openLabel = "Open", printLabel = "Print", printStatus, onRetryPrint, statusLabels, className, ...props }: FileDocumentRowProps) {
  // spec/app/files.md, "Printing reports actual printer acceptance and preserves an uncertain request".
  const printing = printStatus === "pending";
  return (
    <div className={cn("flex items-center gap-4 rounded-row bg-panel px-4 py-3.5 font-sans", className)} {...props}>
      {/* Prototype `.a-att .ft`. */}
      <span aria-hidden className="flex h-16 w-14 flex-none flex-col items-center justify-center gap-1 rounded-lg bg-card text-[13px] leading-none font-extrabold text-destructive shadow-tile">
        <FileIcon className="size-[26px]" strokeWidth={2} />
        {kind}
      </span>
      <div className="min-w-0">
        <div className="truncate text-body-lg leading-[30px] font-bold text-chrome">{name}</div>
        {printStatus ? (
          <MailActionStatus action="print" status={printStatus} onRetry={onRetryPrint} labels={statusLabels} className="mt-0.5" />
        ) : detail ? (
          <div className="mt-0.5 truncate text-body leading-[26px] font-medium text-muted-foreground">{detail}</div>
        ) : null}
      </div>
      <div className="ml-auto flex flex-none gap-3">
        <Button variant="capsule" size="pill" className="pr-[26px] pl-[22px]" aria-label={`${openLabel} ${name}`} onClick={onOpen}>
          {openLabel}
        </Button>
        {onPrint && (
          <Button variant="capsule" size="pill" className="pr-[26px] pl-[22px]" aria-label={`${printLabel} ${name}`} aria-busy={printing || undefined} disabled={printing || printStatus === "unknown"} onClick={onPrint}>
            {pendingMark(
              printing,
              // Prototype `axi('printer',22,2.2)`: square corners, unlike Lucide's Printer.
              <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9V2h12v7" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>,
            )}
            {printLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

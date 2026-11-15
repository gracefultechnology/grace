import type { ComponentProps } from "react";
import { FileText, Printer } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";

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
};

/**
 * A file attached to an email, with Open and Print (prototype `.a-att`).
 * @model spec/app/email.md
 * @design packages/design-system/design.md#windows
 */
export function MailAttachment({ name, detail, kind = "PDF", onOpen, onPrint, openLabel = "Open", printLabel = "Print", className, ...props }: MailAttachmentProps) {
  return (
    <div className={cn("flex max-w-[760px] items-center gap-4 rounded-row bg-panel px-4 py-3.5 font-sans", className)} {...props}>
      {/* Prototype `.a-att .ft`: a white page with the file's type in red. */}
      <span aria-hidden className="flex h-16 w-14 flex-none flex-col items-center justify-center gap-1 rounded-lg bg-card text-[13px] leading-none font-extrabold text-destructive shadow-tile">
        <FileText size={26} strokeWidth={2} />
        {kind}
      </span>
      <div className="min-w-0">
        <div className="truncate text-body-lg leading-[30px] font-bold text-chrome">{name}</div>
        {detail && <div className="mt-0.5 text-body leading-[26px] font-medium text-muted-foreground">{detail}</div>}
      </div>
      <span className="ml-auto flex gap-3">
        {/* Prototype `.a-att .a-btn`: white capsules on the panel. */}
        <Button variant="capsule" size="pill" className="bg-card pr-[26px] pl-[22px]" onClick={onOpen}>
          {openLabel}
        </Button>
        {onPrint && (
          <Button variant="capsule" size="pill" className="bg-card pr-[26px] pl-[22px]" onClick={onPrint}>
            <Printer size={22} strokeWidth={2.2} aria-hidden />
            {printLabel}
          </Button>
        )}
      </span>
    </div>
  );
}

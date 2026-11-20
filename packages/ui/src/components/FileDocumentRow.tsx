import type { ComponentProps } from "react";
import { FileIcon } from "../icons.tsx";
import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";

export type FileDocumentRowProps = Omit<ComponentProps<"div">, "children"> & {
  /** The file's name, such as "Visit form.pdf". */
  name: string;
  /** Where it came from and when it was saved. */
  detail?: string;
  /** The word on the file's badge. */
  kind?: string;
  /** Called by Open. */
  onOpen?: () => void;
  openLabel?: string;
};

/**
 * A saved document: a file badge, its name and where it came from, with Open (prototype `.a-att` in Files).
 * @model spec/app/files.md
 * @design packages/design-system/design.md#windows
 */
export function FileDocumentRow({ name, detail, kind = "PDF", onOpen, openLabel = "Open", className, ...props }: FileDocumentRowProps) {
  return (
    <div className={cn("flex items-center gap-4 rounded-row bg-panel px-4 py-3.5 font-sans", className)} {...props}>
      <span aria-hidden className="flex h-16 w-14 flex-none flex-col items-center justify-center gap-1 rounded-lg bg-card text-mark leading-none font-extrabold text-destructive shadow-tile">
        <FileIcon className="size-[26px]" strokeWidth={2} />
        {kind}
      </span>
      <div className="min-w-0">
        <div className="truncate text-body-lg leading-[30px] font-bold text-chrome">{name}</div>
        {detail ? <div className="mt-0.5 truncate text-body leading-[26px] font-medium text-muted-foreground">{detail}</div> : null}
      </div>
      <Button variant="capsule" size="pill" className="ml-auto flex-none pr-[26px] pl-[22px] leading-none" aria-label={`${openLabel} ${name}`} onClick={onOpen}>
        {openLabel}
      </Button>
    </div>
  );
}

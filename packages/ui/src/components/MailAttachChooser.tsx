import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";
import { Dialog, DialogActions, DialogContent, DialogTitle, type DialogProps } from "./Dialog.tsx";
import type { FilesPhoto } from "./FilesApp.tsx";
import { FileTile } from "./FileTile.tsx";
import type { MailAttachSource } from "./MailCompose.tsx";
import { PageText } from "./PageHeading.tsx";
import { RetryNotice } from "./RetryNotice.tsx";

export type MailAttachChooserProps = Omit<DialogProps, "children"> & {
  /** Where Attach takes from: saved photos or saved files. */
  source: Exclude<MailAttachSource, "camera">;
  /** What this email can send from Files; while it is still being read, leave it out. */
  items?: FilesPhoto[];
  /** Files couldn't be read. */
  failed?: boolean;
  /** The last chosen one couldn't be added to the email. */
  refused?: boolean;
  /** Called with the chosen one's id. */
  onChoose?: (id: string) => void;
  /** Called by Try again after a failure. */
  onRetry?: () => void;
  /** Called by Cancel. */
  onCancel?: () => void;
  className?: string;
};

const words = {
  photos: {
    title: "Choose from Photos", refused: "That photo couldn’t be added. Choose another, or Cancel.", failed: "Your photos couldn’t be opened.",
    opening: "Opening your photos…", none: "No photos saved from this email are in Files yet.",
  },
  file: {
    title: "Choose a file", refused: "That file couldn’t be added. Choose another, or Cancel.", failed: "Your files couldn’t be opened.",
    opening: "Opening your files…", none: "No files saved from this email are in Files yet.",
  },
} satisfies Record<MailAttachChooserProps["source"], Record<string, string>>;

/**
 * Attach's Choose from Photos and Choose a file: what is saved in Files that this email can send, one tap to attach
 * (prototype `att:photos`, `att:file`).
 * @model spec/app/email.md
 * @design packages/design-system/design.md#windows
 */
export function MailAttachChooser({ source, items, failed, refused, onChoose, onRetry, onCancel, className, ...props }: MailAttachChooserProps) {
  const l = words[source];
  return (
    <Dialog {...props}>
      <DialogContent className={cn("gap-0", className)}>
        <DialogTitle>{l.title}</DialogTitle>
        {refused && <PageText role="status" className="mt-3.5">{l.refused}</PageText>}
        <div className="mt-3.5">
          {failed ? <RetryNotice onRetry={onRetry}>{l.failed}</RetryNotice>
            : items === undefined ? <PageText role="status">{l.opening}</PageText>
            : items.length === 0 ? <PageText tone="secondary">{l.none}</PageText>
            : (
              <div className="grid max-h-[60vh] grid-cols-3 gap-3 overflow-y-auto">
                {items.map((item) => <FileTile key={item.id} src={item.src} label={item.label} className="w-full" onClick={() => onChoose?.(item.id)} />)}
              </div>
            )}
        </div>
        <DialogActions>
          <Button variant="capsule" size="pill" onClick={onCancel}>Cancel</Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}

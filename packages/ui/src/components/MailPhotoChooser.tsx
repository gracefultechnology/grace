import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";
import { Dialog, DialogActions, DialogContent, DialogTitle, type DialogProps } from "./Dialog.tsx";
import type { FilesPhoto } from "./FilesApp.tsx";
import { FileTile } from "./FileTile.tsx";
import { PageText } from "./PageHeading.tsx";
import { RetryNotice } from "./RetryNotice.tsx";

export type MailPhotoChooserProps = Omit<DialogProps, "children"> & {
  /** The saved photos this email can send; while they are still being read, leave it out. */
  photos?: FilesPhoto[];
  /** Files couldn't be read. */
  failed?: boolean;
  /** The last chosen photo couldn't be added to the email. */
  refused?: boolean;
  /** Called with the chosen photo's id. */
  onChoose?: (id: string) => void;
  /** Called by Try again after a failure. */
  onRetry?: () => void;
  /** Called by Cancel. */
  onCancel?: () => void;
  className?: string;
};

/**
 * Attach's Choose from Photos: the photos saved in Files that this email can send, one tap to attach
 * (prototype `att:photos`).
 * @model spec/app/files.md
 * @design packages/design-system/design.md#windows
 */
export function MailPhotoChooser({ photos, failed, refused, onChoose, onRetry, onCancel, className, ...props }: MailPhotoChooserProps) {
  return (
    <Dialog {...props}>
      <DialogContent className={cn("gap-0", className)}>
        <DialogTitle>Choose from Photos</DialogTitle>
        {refused && <PageText role="status" className="mt-3.5">That photo couldn’t be added. Choose another, or Cancel.</PageText>}
        <div className="mt-3.5">
          {failed ? <RetryNotice onRetry={onRetry}>Your photos couldn’t be opened.</RetryNotice>
            : photos === undefined ? <PageText role="status">Opening your photos…</PageText>
            : photos.length === 0 ? <PageText tone="secondary">No photos saved from this email are in Files yet.</PageText>
            : (
              <div className="grid max-h-[60vh] grid-cols-3 gap-3 overflow-y-auto">
                {photos.map((photo) => <FileTile key={photo.id} src={photo.src} label={photo.label} className="w-full" onClick={() => onChoose?.(photo.id)} />)}
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

import type { ComponentProps, ReactNode } from "react";
import { ChevronLeft, ChevronRight, Forward } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { AppWindow, type AppWindowProps } from "./AppWindow.tsx";
import { Button } from "./Button.tsx";
import { headerPill } from "./MailActionStatus.tsx";
import { mailIcons } from "./MailMessageRow.tsx";
import { RetryNotice } from "./RetryNotice.tsx";

const pill = { size: 22, strokeWidth: 2.2, "aria-hidden": true } as const;

export type PhotoStageProps = Omit<ComponentProps<"div">, "children"> & {
  /** The photo. */
  src: string;
  /** What the photo shows, for a screen reader. */
  alt: string;
  /** Called by the previous arrow; without it the arrow is hidden (the first photo). */
  onPrevious?: () => void;
  /** Called by the next arrow; without it the arrow is hidden (the last photo). */
  onNext?: () => void;
  previousLabel?: string;
  nextLabel?: string;
};

/** The photo, large, between previous and next arrows (prototype `.a-view`); shared by the Files and Email viewers. */
export function PhotoStage({ src, alt, onPrevious, onNext, previousLabel = "Previous photo", nextLabel = "Next photo", className, ...props }: PhotoStageProps) {
  return (
    <div className={cn("flex items-center gap-5", className)} {...props}>
      <Button variant="capsule" size="pill-icon" aria-label={previousLabel} onClick={onPrevious} className={cn("text-chrome transition-none active:scale-96", !onPrevious && "invisible")}>
        <ChevronLeft size={30} strokeWidth={2.4} aria-hidden />
      </Button>
      <img alt={alt} src={src} className="h-[520px] w-[780px] flex-none rounded-day object-cover shadow-photo" />
      <Button variant="capsule" size="pill-icon" aria-label={nextLabel} onClick={onNext} className={cn("text-chrome transition-none active:scale-96", !onNext && "invisible")}>
        <ChevronRight size={30} strokeWidth={2.4} aria-hidden />
      </Button>
    </div>
  );
}

export type FilePhotoViewerProps = Omit<AppWindowProps, "icon" | "nav" | "actions" | "children"> &
  Pick<PhotoStageProps, "src" | "alt" | "onPrevious" | "onNext" | "previousLabel" | "nextLabel"> & {
  /** Where the photo is among the saved ones: "Photo 2 of 6". */
  title: string;
  /** The first photo: the previous arrow is hidden (prototype `fvprev` with `visibility:hidden` at 0). */
  first?: boolean;
  /** The last photo: the next arrow is hidden (prototype `fvnext` with `visibility:hidden` at n-1). */
  last?: boolean;
  /** Shares the photo. */
  onShare?: () => void;
  /** Deletes the photo from Files. */
  onDelete?: () => void;
  /** The Share button's words. */
  shareLabel?: string;
  /** The Delete button's words. */
  deleteLabel?: string;
  /** Why deleting the photo failed; the photo stays, with Try again under it. */
  deleteError?: ReactNode;
  /** Called by Try again on `deleteError`. */
  onRetryDelete?: () => void;
  retryLabel?: string;
};

/**
 * One saved photo, large, between previous and next arrows, in the Files window with Share and Delete
 * (prototype `filesView()`, `.a-view`).
 * @model spec/app/files.md
 * @design packages/design-system/design.md#windows
 * @design packages/design-system/design.md#screens
 */
export function FilePhotoViewer({
  src,
  alt,
  onPrevious,
  onNext,
  previousLabel,
  nextLabel,
  first = false,
  last = false,
  onShare,
  onDelete,
  shareLabel = "Share",
  deleteLabel = "Delete",
  deleteError,
  onRetryDelete,
  retryLabel,
  ...props
}: FilePhotoViewerProps) {
  return (
    <AppWindow
      actions={
        <>
          {onShare && <Button variant="plain" size="compact" className={headerPill} onClick={onShare}>
            <Forward {...pill} />
            {shareLabel}
          </Button>}
          {onDelete && <Button variant="plain" size="compact" className={headerPill} onClick={onDelete}>
            <mailIcons.trash {...pill} />
            {deleteLabel}
          </Button>}
        </>
      }
      {...props}
    >
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <PhotoStage src={src} alt={alt} onPrevious={first ? undefined : onPrevious} onNext={last ? undefined : onNext} previousLabel={previousLabel} nextLabel={nextLabel} />
        {deleteError != null && (
          <RetryNotice className="w-[780px]" onRetry={onRetryDelete} retryLabel={retryLabel}>
            {deleteError}
          </RetryNotice>
        )}
      </div>
    </AppWindow>
  );
}

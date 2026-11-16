import type { ReactNode } from "react";
import { Forward } from "lucide-react";
import { AppWindow, type AppWindowProps } from "./AppWindow.tsx";
import { Button } from "./Button.tsx";
import { PhotoStage } from "./FilePhotoViewer.tsx";
import { MailActionStatus, pendingMark, type MailActionStatusLabels, type MailSaveStatus } from "./MailActionStatus.tsx";
import { mailIcons } from "./MailMessageRow.tsx";
import type { MailReadStatus } from "./MailMessageView.tsx";
import { MailNotice } from "./MailNotice.tsx";
import { Skeleton } from "./Skeleton.tsx";

const pill = { size: 22, strokeWidth: 2.2, "aria-hidden": true } as const;

export type PhotoViewerLabels = {
  save: string;
  forward: string;
  previous: string;
  next: string;
  failed: string;
  retry: string;
  loading: string;
};

const viewerLabels: PhotoViewerLabels = {
  save: "Save to Files",
  forward: "Forward",
  previous: "Previous photo",
  next: "Next photo",
  failed: "This attachment couldn’t be shown. Try again.",
  retry: "Try again",
  loading: "Opening the photo",
};

export type PhotoViewerProps = Omit<AppWindowProps, "icon" | "nav" | "actions" | "children"> & {
  /** Which photo this is among them: "Photo 2 of 3". */
  title: string;
  /** The photo. */
  src: string;
  /** What it shows, for a screen reader. */
  alt: string;
  /** The first photo: the previous arrow is hidden (prototype `vprev` with `visibility:hidden` at 0). */
  first?: boolean;
  /** The last photo: the next arrow is hidden (prototype `vnext` with `visibility:hidden` at n-1). */
  last?: boolean;
  /** Shows the photo before. */
  onPrevious?: () => void;
  /** Shows the photo after. */
  onNext?: () => void;
  /** Saves it to Files, the one next step. */
  onSave?: () => void;
  /** Forwards it in a new email. */
  onForward?: () => void;
  /** `loading` a placeholder in the photo's place; `failed` says so with Try again. Save and Forward wait for the photo. */
  status?: MailReadStatus;
  /** Opens it again after it failed. */
  onRetry?: () => void;
  /** What a failure says, in place of "This attachment couldn’t be shown. Try again.". */
  errorLabel?: ReactNode;
  /** What saving it to Files actually did, under the photo. */
  saveStatus?: MailSaveStatus;
  /** Tries the failed save again. */
  onRetrySave?: () => void;
  /** The save status's words, for another language. */
  statusLabels?: Partial<MailActionStatusLabels>;
  /** The viewer's words, for another language. */
  labels?: Partial<PhotoViewerLabels>;
};

/**
 * A photo from an email, large, with arrows to the others and Save to Files as the one next step
 * (prototype `mailView()`, viewer, `.a-view`); the photo and arrows are the Files viewer's.
 * @model spec/app/email.md
 * @design packages/design-system/design.md#windows
 */
export function PhotoViewer({ src, alt, first = false, last = false, onPrevious, onNext, onSave, onForward, status = "ready", onRetry, errorLabel, saveStatus, onRetrySave, statusLabels, labels, ...props }: PhotoViewerProps) {
  const l = { ...viewerLabels, ...labels };
  const held = status !== "ready";
  return (
    <AppWindow
      actions={
        <>
          <Button variant="prominent" size="compact" aria-busy={saveStatus === "saving" || undefined} disabled={held || saveStatus === "saving"} onClick={onSave}>
            {pendingMark(saveStatus === "saving", <mailIcons.down {...pill} />)}
            {l.save}
          </Button>
          <Button variant="plain" size="compact" className="text-grace-ink" disabled={held} onClick={onForward}>
            <Forward {...pill} />
            {l.forward}
          </Button>
        </>
      }
      {...props}
    >
      {status === "ready" ? (
        <div className="relative h-full">
          <PhotoStage src={src} alt={alt} onPrevious={first ? undefined : onPrevious} onNext={last ? undefined : onNext} previousLabel={l.previous} nextLabel={l.next} className="h-full justify-center" />
          {saveStatus && (
            <MailActionStatus action="save" status={saveStatus} onRetry={onRetrySave} labels={statusLabels} className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full bg-glass/85 py-2 pr-2 pl-5 whitespace-nowrap shadow-capsule backdrop-blur-capsule [&:not(:has(button))]:pr-5" />
          )}
        </div>
      ) : (
        <div className="flex h-full items-center justify-center">
          {status === "loading" ? (
            <Skeleton role="status" aria-hidden={false} aria-label={l.loading} className="h-[520px] w-[780px] rounded-day" />
          ) : (
            <MailNotice actionLabel={l.retry} onAction={onRetry} className="w-[780px]">
              {errorLabel ?? l.failed}
            </MailNotice>
          )}
        </div>
      )}
    </AppWindow>
  );
}

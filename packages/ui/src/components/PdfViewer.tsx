import type { ReactNode } from "react";
import { AppWindow, type AppWindowProps } from "./AppWindow.tsx";
import { Button } from "./Button.tsx";
import { MailActionStatus, pendingMark, type MailActionStatusLabels, type MailSaveStatus } from "./MailActionStatus.tsx";
import { mailIcons } from "./MailMessageRow.tsx";
import type { MailReadStatus } from "./MailMessageView.tsx";
import { MailNotice } from "./MailNotice.tsx";
import { PageText } from "./PageHeading.tsx";
import { Skeleton } from "./Skeleton.tsx";

const pill = { size: 22, strokeWidth: 2.2, "aria-hidden": true } as const;

export type PdfViewerProps = Omit<AppWindowProps, "icon" | "nav" | "actions" | "children"> & {
  /** The file's name: "Visit form.pdf". */
  title: string;
  /** The page shown, as the app renders it; not needed while it loads or after it failed. */
  children?: ReactNode;
  /** Where the page is in the file: "Page 1 of 2". */
  pageLabel?: string;
  /** It has Save to Files, its one action; a file opened from Files has none. */
  savable?: boolean;
  /** Saves it to Files. */
  onSave?: () => void;
  /** The Save button's words. */
  saveLabel?: string;
  /** `loading` a blank page; `failed` (unreadable, unsupported or corrupt content) says so with Try again. Save waits for the page. */
  status?: MailReadStatus;
  /** Opens it again after it failed. */
  onRetry?: () => void;
  /** What a failure says: "This PDF can’t be shown on this tablet.". */
  errorLabel?: ReactNode;
  /** The Try again button's words. */
  retryLabel?: string;
  /** For assistive technology while the page loads. */
  loadingLabel?: string;
  /** What saving it to Files actually did. */
  saveStatus?: MailSaveStatus;
  /** Tries the failed save again. */
  onRetryAction?: () => void;
  /** The status words, for another language. */
  statusLabels?: Partial<MailActionStatusLabels>;
};

/**
 * A PDF open to read, from an email or from Files: its page on a tinted desk, with Save to Files from an email
 * (prototype `mailView()` and `filesView()`, pdf, `.a-pdf`).
 * @model spec/app/email.md, spec/app/files.md
 * @design packages/design-system/design.md#windows
 * @design packages/design-system/design.md#screens
 */
export function PdfViewer({
  children,
  pageLabel,
  savable = false,
  onSave,
  saveLabel = "Save to Files",
  status = "ready",
  onRetry,
  errorLabel = "This attachment couldn’t be shown. Try again.",
  retryLabel = "Try again",
  loadingLabel = "Opening the file",
  saveStatus,
  onRetryAction,
  statusLabels,
  ...props
}: PdfViewerProps) {
  const held = status !== "ready";
  return (
    <AppWindow
      actions={
        savable && (
          <Button variant="plain" size="compact" className="text-grace-ink" aria-busy={saveStatus === "saving" || undefined} disabled={held || saveStatus === "saving"} onClick={onSave}>
            {pendingMark(saveStatus === "saving", <mailIcons.down {...pill} />)}
            {saveLabel}
          </Button>
        )
      }
      {...props}
    >
      <div className="-mx-6 -mt-6 box-border min-h-full bg-panel p-7">
        {status === "failed" ? (
          <MailNotice actionLabel={retryLabel} onAction={onRetry} className="mx-auto w-[620px]">
            {errorLabel}
          </MailNotice>
        ) : status === "loading" ? (
          <Skeleton role="status" aria-hidden={false} aria-label={loadingLabel} className="mx-auto h-[352px] w-[520px] rounded-sm bg-card shadow-paper" />
        ) : (
          <>
            <div className="mx-auto box-border w-[520px] rounded-sm bg-card px-12 py-11 font-sans shadow-paper">{children}</div>
            {pageLabel && <PageText tone="secondary" className="mt-3.5 text-center">{pageLabel}</PageText>}
            {saveStatus && <MailActionStatus status={saveStatus} onRetry={onRetryAction} labels={statusLabels} className="mx-auto mt-3.5 w-max" />}
          </>
        )}
      </div>
    </AppWindow>
  );
}

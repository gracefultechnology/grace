import type { ReactNode } from "react";
import { AppWindow, type AppWindowProps } from "./AppWindow.tsx";
import { Button } from "./Button.tsx";
import { MailActionStatus, pendingMark, type MailActionStatusLabels, type MailPrintStatus, type MailSaveStatus } from "./MailActionStatus.tsx";
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
  /** Prints the file, the one next step. */
  onPrint?: () => void;
  /** Saves it to Files; without it there is no Save (a file opened from Files). */
  onSave?: () => void;
  /** The Print button's words. */
  printLabel?: string;
  /** The Save button's words. */
  saveLabel?: string;
  /** `loading` a blank page; `failed` (unreadable, unsupported or corrupt content) says so with Try again. Print and Save wait for the page. */
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
  /** What printing it actually did: Print waits while it is sent and while the printer's answer is unknown. */
  printStatus?: MailPrintStatus;
  /** Tries the failed save or print again. */
  onRetryAction?: () => void;
  /** The status words, for another language. */
  statusLabels?: Partial<MailActionStatusLabels>;
};

/**
 * A PDF open to read, from an email or from Files: its page on a tinted desk, with Print as the one next step
 * (prototype `mailView()` and `filesView()`, pdf, `.a-pdf`).
 * @model spec/app/email.md, spec/app/files.md
 * @design packages/design-system/design.md#windows
 */
export function PdfViewer({
  children,
  pageLabel,
  onPrint,
  onSave,
  printLabel = "Print",
  saveLabel = "Save to Files",
  status = "ready",
  onRetry,
  errorLabel = "This attachment couldn’t be shown. Try again.",
  retryLabel = "Try again",
  loadingLabel = "Opening the file",
  saveStatus,
  printStatus,
  onRetryAction,
  statusLabels,
  ...props
}: PdfViewerProps) {
  const held = status !== "ready";
  // spec/app/files.md, "Printing reports actual printer acceptance and preserves an uncertain request": the latest action reports.
  const report = printStatus ? ({ action: "print", status: printStatus } as const) : saveStatus ? ({ action: "save", status: saveStatus } as const) : null;
  return (
    <AppWindow
      actions={
        <>
          <Button variant="prominent" size="compact" aria-busy={printStatus === "pending" || undefined} disabled={held || printStatus === "pending" || printStatus === "unknown"} onClick={onPrint}>
            {pendingMark(printStatus === "pending", <mailIcons.printer {...pill} />)}
            {printLabel}
          </Button>
          {/* Prototype `filesView()` pdf (JS 1985): a file already in Files has no Save. */}
          {onSave && (
            <Button variant="plain" size="compact" className="text-grace-ink" aria-busy={saveStatus === "saving" || undefined} disabled={held || saveStatus === "saving"} onClick={onSave}>
              {pendingMark(saveStatus === "saving", <mailIcons.down {...pill} />)}
              {saveLabel}
            </Button>
          )}
        </>
      }
      {...props}
    >
      {/* The desk reaches the window's sides, under the header; prototype `#awin .pg>*:last-child{margin-bottom:0}` keeps the page's bottom padding white. */}
      <div className="-mx-6 -mt-6 box-border min-h-full bg-panel p-7">
        {status === "failed" ? (
          // spec/app/files.md, "Opening a file verifies that exact content before presenting a preview".
          <MailNotice actionLabel={retryLabel} onAction={onRetry} className="mx-auto w-[620px]">
            {errorLabel}
          </MailNotice>
        ) : status === "loading" ? (
          // The prototype's one-page form is 352px tall.
          <Skeleton role="status" aria-hidden={false} aria-label={loadingLabel} className="mx-auto h-[352px] w-[520px] rounded-sm bg-card shadow-paper" />
        ) : (
          <>
            <div className="mx-auto box-border w-[520px] rounded-sm bg-card px-12 py-11 font-sans shadow-paper">{children}</div>
            {pageLabel && <PageText tone="secondary" className="mt-3.5 text-center">{pageLabel}</PageText>}
            {/* Under the page, so the page stays where it was. */}
            {report && <MailActionStatus {...report} onRetry={onRetryAction} labels={statusLabels} className="mx-auto mt-3.5 w-max" />}
          </>
        )}
      </div>
    </AppWindow>
  );
}

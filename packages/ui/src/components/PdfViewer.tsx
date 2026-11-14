import type { ReactNode } from "react";
import { ArrowDownToLine, Printer } from "lucide-react";
import { AppWindow, type AppWindowProps } from "./AppWindow.tsx";
import { Button } from "./Button.tsx";
import { PageText } from "./PageHeading.tsx";

const pill = { size: 22, strokeWidth: 2.2, "aria-hidden": true } as const;

export type PdfViewerProps = Omit<AppWindowProps, "icon" | "nav" | "actions" | "children"> & {
  /** The file's name: "Visit form.pdf". */
  title: string;
  /** The page shown, as the app renders it. */
  children: ReactNode;
  /** Where the page is in the file: "Page 1 of 2". */
  pageLabel?: string;
  /** Prints the file, the one next step. */
  onPrint?: () => void;
  /** Saves it to Files. */
  onSave?: () => void;
  /** The Print button's words. */
  printLabel?: string;
  /** The Save button's words. */
  saveLabel?: string;
};

/**
 * A file from an email open to read: its page on a tinted desk, with Print as the one next step
 * (prototype `mailView()`, pdf, `.a-pdf`).
 * @model spec/app/email.md
 * @design packages/design-system/design.md#windows
 */
export function PdfViewer({ children, pageLabel, onPrint, onSave, printLabel = "Print", saveLabel = "Save to Files", ...props }: PdfViewerProps) {
  return (
    <AppWindow
      actions={
        <>
          <Button variant="prominent" size="compact" className="pr-[26px] pl-[22px]" onClick={onPrint}>
            <Printer {...pill} />
            {printLabel}
          </Button>
          <Button variant="plain" size="compact" className="pr-5 pl-4 text-grace-ink" onClick={onSave}>
            <ArrowDownToLine {...pill} />
            {saveLabel}
          </Button>
        </>
      }
      {...props}
    >
      {/* The desk reaches the window's edges, under the header. */}
      <div className="-mx-6 -mt-6 -mb-6 box-border min-h-[calc(100%+48px)] bg-panel p-7">
        <div className="mx-auto box-border w-[520px] rounded-sm bg-card px-12 py-11 font-sans shadow-paper">{children}</div>
        {pageLabel && <PageText tone="secondary" className="mt-3.5 text-center">{pageLabel}</PageText>}
      </div>
    </AppWindow>
  );
}

import { FileUp, FolderOpen } from "lucide-react";
import { Button } from "./Button.tsx";
import { BrowserDialog } from "./BrowserNoticeDialog.tsx";
import { PageText } from "./PageHeading.tsx";

/** What the website asks for, as its upload button says: photos, documents, or either. */
export type WebsiteFileAccept = "photos" | "documents" | "any";

/** The words of the request. */
export type WebsiteFileRequestLabels = {
  /** The title, given the site and what it accepts: "chase.com wants a photo or document". */
  title: (site: string, accept: WebsiteFileAccept) => string;
  /** What happens next. */
  note: string;
  choose: string;
  cancel: string;
};

export type WebsiteFileRequestDialogProps = {
  /** The website, as the address shows it. */
  site: string;
  accept?: WebsiteFileAccept;
  /** Called by Choose a file: the tablet's own picker opens. */
  onChoose: () => void;
  /** Called by Cancel and Escape: the website gets no file. */
  onCancel: () => void;
  /** The request is showing. */
  open?: boolean;
  /** Words to replace, for another language; the rest keep their defaults. */
  labels?: Partial<WebsiteFileRequestLabels>;
  className?: string;
};

const wanted: Record<WebsiteFileAccept, string> = { photos: "a photo", documents: "a document", any: "a photo or document" };

const defaultLabels: WebsiteFileRequestLabels = {
  title: (site, accept) => `${site} wants ${wanted[accept]}`,
  note: "You choose the file. Only that file goes to the website.",
  choose: "Choose a file",
  cancel: "Cancel",
};

/**
 * Asks after a person taps a website's upload button: Choose a file opens the tablet's picker; Cancel sends
 * nothing.
 * @model spec/app/websiteRequests.md
 * @design packages/design-system/design.md#windows
 */
export function WebsiteFileRequestDialog({ site, accept = "any", onChoose, onCancel, open = true, labels: words, className }: WebsiteFileRequestDialogProps) {
  const labels = { ...defaultLabels, ...words };
  return (
    <BrowserDialog
      open={open}
      title={labels.title(site, accept)}
      icon={<FileUp size={28} strokeWidth={2.2} />}
      onEscape={onCancel}
      className={className}
      actions={
        <>
          {/* spec/app/websiteRequests.md, "The file picker opens only after my tap and my choice to choose a file". */}
          <Button variant="prominent" size="pill" onClick={onChoose}>
            <FolderOpen size={22} strokeWidth={2.2} aria-hidden />
            {labels.choose}
          </Button>
          <Button variant="capsule" size="pill" onClick={onCancel}>{labels.cancel}</Button>
        </>
      }
    >
      <PageText className="mt-3.5">{labels.note}</PageText>
    </BrowserDialog>
  );
}

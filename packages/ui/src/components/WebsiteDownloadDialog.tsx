import { Download, FileText } from "lucide-react";
import { Button } from "./Button.tsx";
import { BrowserDialog } from "./BrowserNoticeDialog.tsx";
import { PageText } from "./PageHeading.tsx";
import { Panel } from "./Panel.tsx";

export type WebsiteDownloadOffer = {
  site: string;
  name: string;
  size?: string;
};

export type WebsiteDownloadLabels = {
  title: (site: string) => string;
  fromWebsite: string;
  save: string;
  decline: string;
};

export type WebsiteDownloadDialogProps = {
  offer: WebsiteDownloadOffer;
  /** Called by Save: the person's choice to download it. */
  onSave: () => void;
  /** Called by Don't save and Escape: nothing is downloaded. */
  onDecline: () => void;
  /** The offer is showing. */
  open?: boolean;
  /** Words to replace, for another language; the rest keep their defaults. */
  labels?: Partial<WebsiteDownloadLabels>;
  className?: string;
};

const defaultLabels: WebsiteDownloadLabels = {
  title: (site) => `${site} offers a file`,
  fromWebsite: "The name and size are the website’s.",
  save: "Save",
  decline: "Don’t save",
};

/**
 * A file a website offers: its name and size as the website gives them, and Save or Don't save. Nothing is
 * downloaded until the person saves it.
 * @model spec/app/websiteRequests.md
 * @design packages/design-system/design.md#windows
 */
export function WebsiteDownloadDialog({ offer, onSave, onDecline, open = true, labels: words, className }: WebsiteDownloadDialogProps) {
  const labels = { ...defaultLabels, ...words };
  return (
    <BrowserDialog
      open={open}
      title={labels.title(offer.site)}
      icon={<Download size={28} strokeWidth={2} />}
      onEscape={onDecline}
      className={className}
      actions={
        <>
          <Button variant="prominent" size="pill" onClick={onSave}>
            <Download size={22} strokeWidth={2.2} aria-hidden />
            {labels.save}
          </Button>
          <Button variant="capsule" size="pill" onClick={onDecline}>{labels.decline}</Button>
        </>
      }
    >
      <Panel className="mt-3.5 flex items-center gap-4 px-5 py-4">
        <FileText size={30} strokeWidth={2} aria-hidden className="shrink-0 text-primary" />
        <div className="min-w-0">
          <div className="truncate text-body-lg leading-[30px] font-bold text-chrome">{offer.name}</div>
          {offer.size && <div className="text-body leading-[26px] font-medium text-muted-foreground">{offer.size}</div>}
        </div>
      </Panel>
      <PageText tone="secondary" className="mt-3.5">{labels.fromWebsite}</PageText>
    </BrowserDialog>
  );
}

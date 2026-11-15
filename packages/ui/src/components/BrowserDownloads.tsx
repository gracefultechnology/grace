import type { ComponentProps } from "react";
import * as Popover from "@radix-ui/react-popover";
import { CircleAlert, Download, FileText, FolderOpen, X } from "lucide-react";
import { cn, focusRing } from "../lib/cn.ts";
import { Button } from "./Button.tsx";
import { BrowserPopoverContent } from "./BrowserTabStrip.tsx";
import { Panel } from "./Panel.tsx";
import { Progress } from "./Progress.tsx";

/** Where a download stands: being saved, saved, failed, or not saved (declined or ended with its page). */
export type BrowserDownloadStatus = "saving" | "saved" | "failed" | "not-saved";

/** One file a website offered, as the downloads list shows it. */
export type BrowserDownload = {
  /** The request's number in the website-requests model. */
  id: number;
  /** The file's name, as the website gave it. */
  name: string;
  status: BrowserDownloadStatus;
  /** How much is saved, from 0 to 100, while saving; leave out while unknown. */
  progress?: number;
};

/** The words of the list. */
export type BrowserDownloadsLabels = {
  /** The button's accessible name and the list's heading. */
  title: string;
  empty: string;
  saved: string;
  failed: string;
  notSaved: string;
  /** What a screen reader hears for a save in progress, given the file's name. */
  saving: (name: string) => string;
  open: string;
  /** The accessible name of a finished entry's ✕, given the file's name. */
  dismiss: (name: string) => string;
};

export type BrowserDownloadsProps = Omit<ComponentProps<"button">, "children"> & {
  /** Every file offered this session, newest first, each with its status. */
  downloads: BrowserDownload[];
  /** Called with a saved file's id by Open in Files. */
  onOpen?: (id: number) => void;
  /** Called with a finished entry's id by its ✕. */
  onDismiss?: (id: number) => void;
  /** The list is open; leave out to let the button open and close it. */
  open?: boolean;
  /** Called when the list opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /** Words to replace, for another language; the rest keep their defaults. */
  labels?: Partial<BrowserDownloadsLabels>;
};

const defaultLabels: BrowserDownloadsLabels = {
  title: "Downloads",
  empty: "No files yet.",
  saved: "Saved",
  failed: "Couldn’t save",
  notSaved: "Not saved",
  saving: (name) => `Saving ${name}`,
  open: "Open in Files",
  dismiss: (name) => `Remove ${name} from the list`,
};

/**
 * The browser's downloads: a toolbar button that opens the list of files websites offered, each saving (with
 * its progress), saved (Open in Files), failed or not saved. A finished entry can be dismissed.
 * @model spec/app/websiteRequests.md
 * @design packages/design-system/design.md#glass
 */
export function BrowserDownloads({ downloads, onOpen, onDismiss, open, onOpenChange, labels: words, className, ...props }: BrowserDownloadsProps) {
  const labels = { ...defaultLabels, ...words };
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      {/* Prototype `.pill.icon` in `.bz-bar`: a 64px round capsule. */}
      <Popover.Trigger asChild>
        <Button variant="capsule" size="pill-icon" aria-label={labels.title} className={className} {...props}>
          <Download size={22} strokeWidth={2.2} aria-hidden />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <BrowserPopoverContent aria-label={labels.title} align="end" className="w-[520px] gap-0 p-4">
          <h2 className="mx-2 mt-1 mb-3 text-title-sm leading-8 font-bold text-chrome">{labels.title}</h2>
          {downloads.length === 0 ? (
            <p className="mx-2 mb-2 text-body leading-[26px] font-medium text-muted-foreground">{labels.empty}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {downloads.map((d) => (
                // spec/app/websiteRequests.md, "A download is saved with a visible status or visibly not saved".
                <li key={d.id}>
                  <Panel variant="white" className="flex items-center gap-3.5 py-3.5 pr-2.5 pl-4">
                    <FileText size={28} strokeWidth={2} aria-hidden className="shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-body leading-[26px] font-bold text-chrome">{d.name}</div>
                      {d.status === "saving" ? (
                        <Progress value={d.progress} aria-label={labels.saving(d.name)} className="mt-2 h-2" />
                      ) : (
                        <div className={cn("flex items-center gap-1.5 text-label leading-6 font-semibold", d.status === "failed" ? "text-destructive" : d.status === "saved" ? "text-ok" : "text-muted-foreground")}>
                          {d.status === "failed" && <CircleAlert size={18} strokeWidth={2.4} aria-hidden />}
                          {{ saved: labels.saved, failed: labels.failed, "not-saved": labels.notSaved }[d.status]}
                        </div>
                      )}
                    </div>
                    {d.status === "saved" && onOpen && (
                      <Button variant="capsule" size="compact" className="h-12 shrink-0 pr-4 pl-3.5 text-label" onClick={() => onOpen(d.id)}>
                        <FolderOpen size={20} strokeWidth={2.2} aria-hidden />
                        {labels.open}
                      </Button>
                    )}
                    {d.status !== "saving" && onDismiss && (
                      <button
                        type="button"
                        aria-label={labels.dismiss(d.name)}
                        onClick={() => onDismiss(d.id)}
                        className={cn(focusRing, "flex size-12 shrink-0 items-center justify-center rounded-full text-chrome-muted active:bg-chrome/8")}
                      >
                        <X size={22} strokeWidth={2} aria-hidden />
                      </button>
                    )}
                  </Panel>
                </li>
              ))}
            </ul>
          )}
        </BrowserPopoverContent>
      </Popover.Portal>
    </Popover.Root>
  );
}

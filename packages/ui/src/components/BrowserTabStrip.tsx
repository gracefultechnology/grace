import type { ComponentProps } from "react";
import { Plus, X } from "lucide-react";
import { cn, focusRing } from "../lib/cn.ts";
import { BrowserTab, type BrowserTabProps } from "./BrowserTab.tsx";

/** One open tab, as the strip shows it. */
export type BrowserTabItem = Pick<BrowserTabProps, "title" | "favicon" | "initial" | "closeLabel"> & {
  /** The tab's identity in the browser model. */
  id: number;
};

export type BrowserTabStripProps = ComponentProps<"div"> & {
  /** The open tabs, in opening order. */
  tabs: BrowserTabItem[];
  /** The id of the tab shown in the window. */
  selectedId: number;
  /** Called with a tab's id when it is tapped. */
  onSelectTab?: (id: number) => void;
  /** Called with a tab's id by its ✕. */
  onCloseTab?: (id: number) => void;
  /** Called by +. */
  onNewTab?: () => void;
  /** Called by the strip's ✕, which closes the whole browser. */
  onCloseBrowser?: () => void;
  /** The accessible name of +. */
  newTabLabel?: string;
  /** The accessible name of the strip's ✕. */
  closeBrowserLabel?: string;
};

// Prototype `.bz-ic` / `.bz-close`: plain 48px buttons, 8px above the strip's foot to sit on the tab's row.
const plain = cn(focusRing, "mb-2 flex size-12 shrink-0 items-center justify-center rounded-xl active:bg-chrome/8");

/**
 * The browser's tab strip: the tabs, + for a new tab, and ✕ at the far end to close the browser.
 * @model spec/app/browser.md
 */
export function BrowserTabStrip({
  tabs,
  selectedId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onCloseBrowser,
  newTabLabel = "Open a new tab",
  closeBrowserLabel = "Close browser",
  className,
  ...props
}: BrowserTabStripProps) {
  return (
    // Prototype `.bz-strip`: 64px, the tabs standing on its foot.
    <div className={cn("relative z-[1] flex h-16 items-end gap-1 pt-2 pr-3 pl-4", className)} {...props}>
      {tabs.map((tab) => (
        <BrowserTab
          key={tab.id}
          title={tab.title}
          favicon={tab.favicon}
          initial={tab.initial}
          selected={tab.id === selectedId}
          onSelect={() => onSelectTab?.(tab.id)}
          onClose={() => onCloseTab?.(tab.id)}
          closeLabel={tab.closeLabel}
        />
      ))}
      <button type="button" aria-label={newTabLabel} onClick={onNewTab} className={cn(plain, "ml-2.5 text-chrome-muted")}>
        <Plus size={24} strokeWidth={2} aria-hidden />
      </button>
      <button type="button" aria-label={closeBrowserLabel} onClick={onCloseBrowser} className={cn(plain, "ml-auto text-chrome")}>
        <X size={24} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}

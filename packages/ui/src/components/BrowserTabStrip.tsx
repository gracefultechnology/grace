import type { ComponentProps } from "react";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, Plus, X } from "lucide-react";
import { cn, focusRing } from "../lib/cn.ts";
import { BrowserTab, type BrowserTabProps, TabFavicon } from "./BrowserTab.tsx";

export type BrowserTabStripLabels = {
  more: (n: number) => string;
  moreTabs: string;
};

const defaultLabels: BrowserTabStripLabels = { more: (n) => `${n} more`, moreTabs: "More tabs" };

export type BrowserTabItem = Pick<BrowserTabProps, "title" | "favicon" | "initial" | "pageLoading" | "closeLabel"> & {
  id: number;
};

export type BrowserTabStripProps = ComponentProps<"div"> & {
  /** The tabs that fit the strip's readable width, in opening order: the selected one and the most recently used others. */
  tabs: BrowserTabItem[];
  /** The tabs that do not fit, in opening order, behind "{n} more". A width change never closes one. */
  overflow?: BrowserTabItem[];
  /** The id of the tab shown in the window. */
  selectedId: number;
  /** Called with a tab's id when it is tapped, in the strip or in the list of more tabs. */
  onSelectTab?: (id: number) => void;
  /** Called with a tab's id by its ✕. */
  onCloseTab?: (id: number) => void;
  /** Called by +. */
  onNewTab?: () => void;
  /** Called by the strip's ✕, which closes the whole browser. */
  onCloseBrowser?: () => void;
  /** The list of more tabs is open; leave out to let the "{n} more" pill open and close it. */
  overflowOpen?: boolean;
  /** Called when the list of more tabs opens or closes. */
  onOverflowOpenChange?: (open: boolean) => void;
  /** Words of the list of more tabs to replace, for another language. */
  labels?: Partial<BrowserTabStripLabels>;
  /** The accessible name of +. */
  newTabLabel?: string;
  /** The accessible name of the strip's ✕. */
  closeBrowserLabel?: string;
};

const plain = cn(focusRing, "mb-2 flex size-12 shrink-0 items-center justify-center rounded-xl");

/**
 * The browser's tab strip: the tabs, "{n} more" for those that do not fit, + for a new tab, and ✕ at the far
 * end to close the browser.
 * @model spec/app/browser.md
 */
export function BrowserTabStrip({
  tabs,
  overflow = [],
  selectedId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onCloseBrowser,
  overflowOpen,
  onOverflowOpenChange,
  labels: words,
  newTabLabel = "Open a new tab",
  closeBrowserLabel = "Close browser",
  className,
  ...props
}: BrowserTabStripProps) {
  const labels = { ...defaultLabels, ...words };
  return (
    <div className={cn("relative z-[1] flex h-16 items-end gap-1 pt-2 pr-3 pl-4", className)} {...props}>
      {tabs.map((tab) => (
        <BrowserTab
          key={tab.id}
          title={tab.title}
          favicon={tab.favicon}
          initial={tab.initial}
          pageLoading={tab.pageLoading}
          selected={tab.id === selectedId}
          onSelect={() => onSelectTab?.(tab.id)}
          onClose={() => onCloseTab?.(tab.id)}
          closeLabel={tab.closeLabel}
        />
      ))}
      {overflow.length > 0 && (
        <Popover.Root open={overflowOpen} onOpenChange={onOverflowOpenChange}>
          <Popover.Trigger
            className={cn(
              focusRing,
              "mb-2 ml-2.5 flex h-12 shrink-0 items-center gap-1.5 rounded-full bg-glass/62 pr-4 pl-5 text-body font-semibold whitespace-nowrap text-chrome shadow-capsule backdrop-blur-capsule backdrop-saturate-160 transition-transform duration-press ease-spring active:scale-97 motion-reduce:active:scale-100",
            )}
          >
            {labels.more(overflow.length)}
            <ChevronDown size={20} strokeWidth={2.4} aria-hidden />
          </Popover.Trigger>
          <Popover.Portal>
            <BrowserPopoverContent aria-label={labels.moreTabs} align="start" className="w-[380px]">
              <p className="mt-1.5 ml-4 text-label leading-5 font-bold tracking-[.04em] text-label-ink uppercase">{labels.moreTabs}</p>
              <ul className="flex flex-col gap-2">
                {overflow.map((tab) => (
                  <li key={tab.id} className="flex h-16 items-center rounded-full bg-glass/70 pr-2">
                    <Popover.Close
                      onClick={() => onSelectTab?.(tab.id)}
                      className={cn(focusRing, "flex min-w-0 flex-1 items-center gap-3 self-stretch rounded-full pl-[22px] text-left text-chrome")}
                    >
                      <TabFavicon favicon={tab.favicon} initial={tab.initial} pageLoading={tab.pageLoading} />
                      <span className="min-w-0 flex-1 truncate text-body font-bold text-popover-foreground">{tab.title}</span>
                    </Popover.Close>
                    <button
                      type="button"
                      aria-label={tab.closeLabel ?? `Close ${tab.title}`}
                      onClick={() => onCloseTab?.(tab.id)}
                      className={cn(focusRing, "flex size-12 shrink-0 items-center justify-center rounded-full text-chrome-muted active:bg-chrome/8")}
                    >
                      <X size={22} strokeWidth={2} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </BrowserPopoverContent>
          </Popover.Portal>
        </Popover.Root>
      )}
      <button type="button" aria-label={newTabLabel} onClick={onNewTab} className={cn(plain, overflow.length > 0 ? "ml-1" : "ml-2.5", "text-chrome-muted")}>
        <Plus size={24} strokeWidth={2} aria-hidden />
      </button>
      <button type="button" aria-label={closeBrowserLabel} onClick={onCloseBrowser} className={cn(plain, "ml-auto text-chrome active:bg-chrome/8")}>
        <X size={24} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}

export type BrowserPopoverContentProps = ComponentProps<typeof Popover.Content>;

/**
 * The browser's popover panel, Grace's menu glass (prototype `.spdpop`), 8px from the control that opens it.
 * Like the prototype's popovers it is not modal: a tap elsewhere closes it.
 */
export function BrowserPopoverContent({ sideOffset = 8, className, ...props }: BrowserPopoverContentProps) {
  return (
    <Popover.Content
      sideOffset={sideOffset}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        (event.currentTarget as HTMLElement).focus();
      }}
      collisionPadding={6}
      className={cn("z-50 box-border flex max-h-[min(560px,var(--radix-popover-content-available-height))] flex-col gap-2 overflow-y-auto rounded-menu bg-glass/86 p-2 font-sans text-chrome shadow-menu backdrop-blur-panel backdrop-saturate-160 outline-none", className)}
      {...props}
    />
  );
}

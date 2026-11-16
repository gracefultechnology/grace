import type { ComponentProps, ReactNode } from "react";
import { ArrowLeft, ArrowRight, RotateCw, X } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";

export type BrowserToolbarProps = ComponentProps<"div"> & {
  /** The tab has a page to go back to. */
  canGoBack?: boolean;
  /** The tab has a page to go forward to. */
  canGoForward?: boolean;
  /** There is an address to go to. */
  canGo?: boolean;
  /** The toolbar has Reload (Stop while the page loads); the prototype's new tab has none. */
  reloadable?: boolean;
  /** The tab's page is loading: Reload becomes Stop. Back, Forward and the address still work. */
  pageLoading?: boolean;
  /** Called by Reload, which loads the page again. */
  onReload?: () => void;
  /** Called by Stop while the page loads. */
  onStop?: () => void;
  /** Controls after Go, such as `BrowserDownloads`. */
  trailing?: ReactNode;
  /** Called by Back. */
  onBack?: () => void;
  /** Called by Forward. */
  onForward?: () => void;
  /** Called by Go. */
  onGo?: () => void;
  /** The label of Back. */
  backLabel?: string;
  /** The label of Forward. */
  forwardLabel?: string;
  /** The label of Go. */
  goLabel?: string;
  /** The accessible name of Reload. */
  reloadLabel?: string;
  /** The accessible name of Stop. */
  stopLabel?: string;
};

const arrow = { size: 22, strokeWidth: 2.2, "aria-hidden": true } as const;

/**
 * The browser's toolbar under the tabs: Back, Forward, Reload when `reloadable` (Stop while the page loads), the address (its
 * children, an `AddressBar`), Go and any `trailing` controls.
 * A control with nowhere to go keeps its glass and dims its label.
 * @model spec/app/browser.md
 * @design packages/design-system/design.md#buttons
 */
export function BrowserToolbar({
  canGoBack = false,
  canGoForward = false,
  canGo = false,
  reloadable = false,
  pageLoading = false,
  onReload,
  onStop,
  trailing,
  onBack,
  onForward,
  onGo,
  backLabel = "Back",
  forwardLabel = "Forward",
  goLabel = "Go",
  reloadLabel = "Reload",
  stopLabel = "Stop",
  className,
  children,
  ...props
}: BrowserToolbarProps) {
  return (
    <div className={cn("relative z-[1] flex h-20 items-center gap-2 border-b border-glass/70 bg-glass/78 px-4", className)} {...props}>
      <Button variant="capsule" size="pill" disabled={!canGoBack} onClick={onBack}>
        <ArrowLeft {...arrow} />
        {backLabel}
      </Button>
      <Button variant="capsule" size="pill" disabled={!canGoForward} onClick={onForward}>
        <ArrowRight {...arrow} />
        {forwardLabel}
      </Button>
      {reloadable && (
        <Button variant="capsule" size="pill-icon" aria-label={pageLoading ? stopLabel : reloadLabel} onClick={pageLoading ? onStop : onReload}>
          {pageLoading ? <X {...arrow} /> : <RotateCw {...arrow} />}
        </Button>
      )}
      {children}
      <Button variant="capsule" size="pill" disabled={!canGo} onClick={onGo}>
        {goLabel}
        <ArrowRight {...arrow} strokeWidth={2.4} />
      </Button>
      {trailing}
    </div>
  );
}

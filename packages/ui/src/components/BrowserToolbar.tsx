import type { ComponentProps } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";

export type BrowserToolbarProps = ComponentProps<"div"> & {
  /** The tab has a page to go back to. */
  canGoBack?: boolean;
  /** The tab has a page to go forward to. */
  canGoForward?: boolean;
  /** There is an address to go to. */
  canGo?: boolean;
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
};

// Prototype `.pill.main` in `.bz-bar`: the capsule's glass, padded 0 26px 0 22px (Go too); disabled, the label at 32% (line 674).
const pill = "pr-[26px] pl-[22px] disabled:text-grace-ink/32";
const arrow = { size: 22, strokeWidth: 2.2, "aria-hidden": true } as const;

/**
 * The browser's toolbar under the tabs: Back, Forward, the address (its children, an `AddressBar`) and Go.
 * A control with nowhere to go keeps its glass and dims its label.
 * @model spec/app/browser.md
 * @design packages/design-system/design.md#buttons
 */
export function BrowserToolbar({
  canGoBack = false,
  canGoForward = false,
  canGo = false,
  onBack,
  onForward,
  onGo,
  backLabel = "Back",
  forwardLabel = "Forward",
  goLabel = "Go",
  className,
  children,
  ...props
}: BrowserToolbarProps) {
  return (
    // Prototype `.bz-bar`: 80px of white glass joined to the selected tab.
    <div className={cn("relative z-[1] flex h-20 items-center gap-2 border-b border-glass/70 bg-glass/78 px-4", className)} {...props}>
      <Button variant="capsule" size="pill" className={pill} disabled={!canGoBack} onClick={onBack}>
        <ArrowLeft {...arrow} />
        {backLabel}
      </Button>
      <Button variant="capsule" size="pill" className={pill} disabled={!canGoForward} onClick={onForward}>
        <ArrowRight {...arrow} />
        {forwardLabel}
      </Button>
      {children}
      <Button variant="capsule" size="pill" className={pill} disabled={!canGo} onClick={onGo}>
        {goLabel}
        <ArrowRight {...arrow} strokeWidth={2.4} />
      </Button>
    </div>
  );
}

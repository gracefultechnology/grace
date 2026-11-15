import type { ComponentProps, ReactNode } from "react";
import { ArrowLeft, X } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Button, press } from "./Button.tsx";

type HeaderMode = "icon" | "large" | "none";

export type AppTitleProps = ComponentProps<"span"> & {
  /** The app's icon, a Lucide icon at 26px, shown on an accent tile. */
  icon?: ReactNode;
  /** The smaller title beside a Back pill. */
  small?: boolean;
};

/** An app window's title on the header's row, with the app's icon tile. */
export function AppTitle({ icon, small = false, className, children, ...props }: AppTitleProps) {
  return (
    // Prototype `#awin.icmode .aphdr .aptl`, `.apic`; beside Back, `.hgrp+.aptl`.
    <span
      className={cn(
        "flex min-w-0 items-center gap-3.5 font-sans font-bold text-chrome",
        small ? "pl-4 text-lead leading-[34px]" : "pl-1 text-title leading-[34px]",
        className,
      )}
      {...props}
    >
      {icon != null && <span className="flex size-12 shrink-0 items-center justify-center rounded-tile bg-accent text-primary [&_svg]:size-[26px]">{icon}</span>}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** One glass capsule of header controls (prototype `#awin .aphdr .hgrp`). */
const capsule = "pointer-events-auto flex h-16 shrink-0 items-center gap-0.5 rounded-full bg-glass/62 p-1 shadow-capsule backdrop-blur-capsule backdrop-saturate-160";

export type AppHeaderProps = Omit<ComponentProps<"header">, "title" | "children"> & {
  /** The window's title: the app's name, or the page's when the title is large. */
  title: string;
  /** The app's icon, shown on a tile before the title in `icon` mode. */
  icon?: ReactNode;
  /** `icon` an icon tile and title on the header's row; `large` a large title in the page that collapses into a centred title; `none` no title. */
  mode?: HeaderMode;
  /** Where Back goes, shown on the Back pill, such as "Calendar"; without it there is no Back. */
  backLabel?: string;
  /** Called by the Back pill. */
  onBack?: () => void;
  /** The accessible name of the Back pill. */
  backAriaLabel?: string;
  /** The header's actions, before ✕ in the same capsule: `Button`s of variant `plain` and size `compact`, one `prominent`. */
  actions?: ReactNode;
  /** Called by ✕. */
  onClose?: () => void;
  /** The accessible name of ✕. */
  closeLabel?: string;
  /** The page has scrolled past its large title: the header becomes a bar with the title centred. */
  collapsed?: boolean;
  /** The header spans the page column of a split window, beside its side list, rather than the whole window under a white fade. */
  split?: boolean;
};

/**
 * An app window's header: glass capsules floating over the page, Back on the left, the title, and the
 * actions with ✕ on the right.
 * @design packages/design-system/design.md#windows
 */
export function AppHeader({
  title,
  icon,
  mode = "icon",
  backLabel,
  onBack,
  backAriaLabel = backLabel ? `Back to ${backLabel}` : "Back",
  actions,
  onClose,
  closeLabel = `Close ${title}`,
  collapsed = false,
  split = false,
  className,
  ...props
}: AppHeaderProps) {
  const bar = mode === "large" && collapsed;
  return (
    // Prototype `#awin .aphdr`: 24px in, 10px between groups; `.aphdr.bar` once the large title has scrolled away, its top
    // corners the window's (`#awin.splitw .aphdr.bar`: the right one only).
    <header
      className={cn(
        "pointer-events-none relative isolate flex items-center gap-2.5 p-6 font-sans transition-colors duration-quick ease-css-default",
        // Its line is `box-shadow: 0 1px 0`, just below the bar.
        bar && "bg-background/92 backdrop-blur-frost backdrop-saturate-160 shadow-hairline",
        bar && (split ? "rounded-tr-window" : "rounded-t-window"),
        className,
      )}
      {...props}
    >
      {!split && !bar && (
        // Prototype `#awin .aphdr::before`: content fades out under the capsules (`#awin.splitw .aphdr::before` has none).
        <span aria-hidden className="absolute inset-x-0 top-0 -bottom-10 -z-10 rounded-t-window bg-linear-to-b from-background/75 via-background/35 via-60% to-transparent" />
      )}
      {backLabel && (
        <div className={capsule}>
          {/* `#awin .aphdr .hgrp .pill:not(.prom)` with `#ahdr .pill:not(.prom):active`: it sinks to 97% and stays clear. */}
          <Button variant="plain" size="compact" className={cn(press, "text-grace-ink active:scale-97 active:bg-transparent")} aria-label={backAriaLabel} onClick={onBack}>
            <ArrowLeft size={22} strokeWidth={2.2} aria-hidden />
            {backLabel}
          </Button>
        </div>
      )}
      {mode === "icon" && (
        <AppTitle icon={backLabel ? undefined : icon} small={!!backLabel} role="heading" aria-level={1}>
          {title}
        </AppTitle>
      )}
      <span className="flex-1" />
      {mode === "large" && (
        // Prototype `#awin .aphdr .ctitle`.
        <span
          aria-hidden
          className={cn(
            "absolute top-1/2 left-1/2 -translate-1/2 text-body-lg leading-7 font-bold whitespace-nowrap text-foreground transition-opacity duration-quick ease-css-default",
            bar ? "opacity-100" : "opacity-0",
          )}
        >
          {title}
        </span>
      )}
      <div className={capsule}>
        {actions}
        {/* `#awin .aphdr .hgrp .winx`, in every header hdr() draws: transparent even while pressed. */}
        <Button variant="plain" size="compact-icon" aria-label={closeLabel} onClick={onClose} className="active:bg-transparent">
          <X size={24} strokeWidth={1.75} aria-hidden />
        </Button>
      </div>
    </header>
  );
}

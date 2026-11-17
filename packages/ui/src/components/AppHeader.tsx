import type { ComponentProps, ReactNode } from "react";
import { ArrowLeft, X } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Button, press } from "./Button.tsx";

export type AppTitleProps = ComponentProps<"span"> & {
  /** The app's icon, a Lucide icon at 26px, shown on an accent tile. */
  icon?: ReactNode;
  /** The smaller title beside a Back pill. */
  small?: boolean;
};

/** An app window's title on the header's row, with the app's icon tile. */
export function AppTitle({ icon, small = false, className, children, ...props }: AppTitleProps) {
  return (
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

const capsule = "pointer-events-auto flex h-16 shrink-0 items-center gap-0.5 rounded-full bg-glass/62 p-1 shadow-capsule backdrop-blur-capsule backdrop-saturate-160";

export type AppHeaderProps = Omit<ComponentProps<"header">, "title" | "children"> & {
  /** The window's title: the app's name, or the page's beside a Back pill. */
  title: string;
  /** The app's icon, shown on a tile before the title. */
  icon?: ReactNode;
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
  backLabel,
  onBack,
  backAriaLabel = backLabel ? `Back to ${backLabel}` : "Back",
  actions,
  onClose,
  closeLabel = `Close ${title}`,
  split = false,
  className,
  ...props
}: AppHeaderProps) {
  return (
    <header
      className={cn(
        "pointer-events-none relative isolate flex items-center gap-2.5 p-6 font-sans",
        className,
      )}
      {...props}
    >
      {!split && (
        <span aria-hidden className="absolute inset-x-0 top-0 -bottom-10 -z-10 rounded-t-window bg-linear-to-b from-background/75 via-background/35 via-60% to-transparent" />
      )}
      {backLabel && (
        <div className={capsule}>
          <Button variant="plain" size="compact" className={cn(press, "text-grace-ink active:scale-97 active:bg-transparent")} aria-label={backAriaLabel} onClick={onBack}>
            <ArrowLeft size={22} strokeWidth={2.2} aria-hidden />
            {backLabel}
          </Button>
        </div>
      )}
      <AppTitle icon={backLabel ? undefined : icon} small={!!backLabel} role="heading" aria-level={1}>
        {title}
      </AppTitle>
      <span className="flex-1" />
      <div className={capsule}>
        {actions}
        <Button variant="plain" size="compact-icon" aria-label={closeLabel} onClick={onClose} className="active:bg-transparent">
          <X size={24} strokeWidth={1.75} aria-hidden />
        </Button>
      </div>
    </header>
  );
}

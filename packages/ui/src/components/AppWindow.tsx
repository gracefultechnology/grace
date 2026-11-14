import { useRef, useState, type ComponentProps, type ReactNode, type UIEvent } from "react";
import { ArrowLeft, X } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";
import { PageHeading } from "./PageHeading.tsx";
import { SplitView } from "./SplitView.tsx";

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
        small ? "pl-4 text-2xl leading-[34px]" : "pl-1 text-title leading-[34px]",
        className,
      )}
      {...props}
    >
      {icon != null && <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-primary [&_svg]:size-[26px]">{icon}</span>}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** One glass capsule of header controls (prototype `#awin .aphdr .hgrp`). */
const capsule = "pointer-events-auto flex h-16 shrink-0 items-center gap-0.5 rounded-full bg-glass/62 p-1 shadow-capsule backdrop-blur-capsule backdrop-saturate-160";

export type AppHeaderProps = Omit<ComponentProps<"header">, "title"> & {
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
  /** A white fade under the header, where content scrolls beneath it across the whole window. */
  fade?: boolean;
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
  fade = false,
  className,
  ...props
}: AppHeaderProps) {
  const bar = mode === "large" && collapsed;
  return (
    // Prototype `#awin .aphdr`: 24px in, 10px between groups; `.aphdr.bar` once the large title has scrolled away.
    <header
      className={cn(
        "pointer-events-none relative isolate flex items-center gap-2.5 p-6 font-sans transition-colors duration-slow",
        bar && "border-b border-primary/10 bg-background/92 backdrop-blur-frost backdrop-saturate-160",
        className,
      )}
      {...props}
    >
      {fade && !bar && (
        // Prototype `#awin .aphdr::before`: content fades out under the capsules.
        <span aria-hidden className="absolute inset-x-0 top-0 -bottom-10 -z-10 bg-linear-to-b from-background/75 via-background/35 via-60% to-transparent" />
      )}
      {backLabel && (
        <div className={capsule}>
          <Button variant="plain" size="compact" className="text-grace-ink" aria-label={backAriaLabel} onClick={onBack}>
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
            "absolute top-1/2 left-1/2 -translate-1/2 text-body-lg leading-7 font-bold whitespace-nowrap text-foreground transition-opacity duration-slow",
            bar ? "opacity-100" : "opacity-0",
          )}
        >
          {title}
        </span>
      )}
      <div className={capsule}>
        {actions}
        {onClose && (
          <Button variant="plain" size="compact-icon" aria-label={closeLabel} onClick={onClose}>
            <X size={24} strokeWidth={1.75} aria-hidden />
          </Button>
        )}
      </div>
    </header>
  );
}

export type AppWindowProps = Omit<ComponentProps<"section">, "title"> &
  Pick<AppHeaderProps, "title" | "icon" | "backLabel" | "onBack" | "backAriaLabel" | "actions" | "onClose" | "closeLabel"> & {
    /** How the title shows: `icon` on the header's row with the app's tile, `large` at the top of the page (collapsing as it scrolls), `none` not at all. */
    headerMode?: HeaderMode;
    /** A side list, a `SideNav`: the window splits into the list and the page beside it. */
    nav?: ReactNode;
    /** `screen` places the window on a `TabletScreen`, right of the rail; `inline` fills its container. */
    placement?: "screen" | "inline";
  };

/**
 * An app's floating window (Calendar, Email, Files, Settings): white, 6px from the rail and the screen's
 * edges, with its header floating over the page that scrolls beneath it.
 * @model spec/app/workspace.md
 * @design packages/design-system/design.md#windows
 */
export function AppWindow({
  title,
  icon,
  headerMode = "icon",
  backLabel,
  onBack,
  backAriaLabel,
  actions,
  onClose,
  closeLabel,
  nav,
  placement = "screen",
  className,
  children,
  ...props
}: AppWindowProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [scroll, setScroll] = useState({ collapsed: false, opacity: 1 });
  const large = headerMode === "large";
  // Prototype lgtScroll(): the large title fades as it rises and the header becomes a bar once it has passed.
  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const t = headingRef.current;
    if (!t) return;
    const top = event.currentTarget.scrollTop;
    const limit = nav ? t.offsetHeight : t.offsetTop + t.offsetHeight - 96;
    const collapsed = top > limit;
    setScroll({ collapsed, opacity: collapsed ? 0 : Math.max(0, 1 - top / Math.max(1, limit + 16)) });
  };
  const header = (
    <AppHeader
      title={title}
      icon={icon}
      mode={headerMode}
      backLabel={backLabel}
      onBack={onBack}
      backAriaLabel={backAriaLabel}
      actions={actions}
      onClose={onClose}
      closeLabel={closeLabel}
      collapsed={scroll.collapsed}
      fade={!nav}
    />
  );
  const page = (
    <>
      {large && (
        <PageHeading ref={headingRef} level="large" className="mb-4 transition-opacity duration-base" style={{ opacity: scroll.opacity }}>
          {title}
        </PageHeading>
      )}
      {children}
    </>
  );
  // The page clears the header's row unless the large title sits beside ✕ (prototype `#awin.lgmode`).
  const belowHeader = !large || !!backLabel;
  return (
    // Prototype `.bwin.appw#awin`: 144px from the left (the rail and its gap) and 6px from the other edges, 1130 wide on a landscape tablet.
    <section
      aria-label={title}
      className={cn(
        "overflow-hidden rounded-window bg-background font-sans text-foreground shadow-float ring-1 ring-glass/55 transition-[bottom] duration-window motion-reduce:transition-none",
        placement === "screen" ? "absolute top-1.5 bottom-1.5 left-[144px] z-[2] right-1.5" : "relative size-full",
        className,
      )}
      {...props}
    >
      {nav ? (
        <SplitView nav={nav} header={header} belowHeader={belowHeader} onPageScroll={large ? onScroll : undefined}>
          {page}
        </SplitView>
      ) : (
        <>
          <div
            onScroll={large ? onScroll : undefined}
            className={cn("absolute inset-0 overflow-y-auto px-6 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", belowHeader ? "pt-[104px]" : "pt-7")}
          >
            {page}
          </div>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10">{header}</div>
        </>
      )}
    </section>
  );
}

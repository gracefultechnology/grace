import { useRef, useState, type ComponentProps, type ReactNode, type UIEvent } from "react";
import { cn } from "../lib/cn.ts";
import { AppHeader, type AppHeaderProps } from "./AppHeader.tsx";
import { PageHeading } from "./PageHeading.tsx";
import { SplitView } from "./SplitView.tsx";

export type AppWindowProps = Omit<ComponentProps<"section">, "title"> &
  Pick<AppHeaderProps, "title" | "icon" | "backLabel" | "onBack" | "backAriaLabel" | "actions" | "onClose" | "closeLabel"> & {
    /** How the title shows: `icon` on the header's row with the app's tile, `large` at the top of the page (collapsing as it scrolls), `none` not at all. */
    headerMode?: AppHeaderProps["mode"];
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
      split={!!nav}
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
        "overflow-hidden rounded-window bg-background font-sans text-foreground shadow-pane transition-[bottom] duration-slow ease-settle motion-reduce:transition-none",
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

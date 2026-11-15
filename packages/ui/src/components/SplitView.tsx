import type { ComponentProps, ReactNode, Ref, UIEventHandler } from "react";
import { cn, focusRing } from "../lib/cn.ts";

export type SplitViewProps = ComponentProps<"div"> & {
  /** The side list, a `SideNav`: it stays still while the page beside it scrolls. */
  nav: ReactNode;
  /** The window's header, an `AppHeader`: it floats over the top of the page column, not over the side list. */
  header?: ReactNode;
  /**
   * Where the page column starts: `header` below the header's row (an icon title, or Back), `beside` level with the ✕
   * (a large title), `clear` just under the window's top (no title), `clearBack` below a Back with no title.
   */
  pageTop?: "header" | "beside" | "clear" | "clearBack";
  /** Called as the page column scrolls, for a large title that collapses into the header. */
  onPageScroll?: UIEventHandler<HTMLDivElement>;
  /** The page column, the element that scrolls. */
  pageRef?: Ref<HTMLDivElement>;
};

// Prototype `#awin.splitw .a-split>div:last-child`: `.icmode` and `.lgmode.hasback` 84px, `.lgmode` 12px, none 18px, none `.hasback` 88px.
const pageTops = { header: "pt-[84px]", beside: "pt-3", clear: "pt-[18px]", clearBack: "pt-[88px]" } as const;

/**
 * An app window split into a side list and the page it opens, as Email and Settings are.
 * @design packages/design-system/design.md#windows
 */
export function SplitView({ nav, header, pageTop = "header", onPageScroll, pageRef, className, children, ...props }: SplitViewProps) {
  return (
    // Prototype `#awin.splitw .pg.hassplit` and `.a-split`: 16px around, a 270px list, 24px apart; the page column
    // reaches the window's edge (`margin:0 -24px 0 0; padding-right:24px`).
    <div className={cn("relative grid h-full grid-cols-[270px_minmax(0,1fr)] gap-6 px-4 pt-4", className)} {...props}>
      {nav}
      <div
        ref={pageRef}
        onScroll={onPageScroll}
        className={cn("-mr-6 min-h-0 overflow-y-auto pr-6 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", pageTops[pageTop])}
      >
        {children}
      </div>
      {/* Prototype `#awin.splitw .aphdr`: the header spans the page column only. */}
      {header != null && <div className="pointer-events-none absolute top-0 right-0 left-[310px]">{header}</div>}
    </div>
  );
}

export type SideNavProps = ComponentProps<"nav">;

/** The side list of a split app window: lighter glass floating inside the window, with a bright rim. */
export function SideNav({ className, children, ...props }: SideNavProps) {
  return (
    // Prototype `#awin.splitw .a-split>.a-nav`, last rule.
    <nav
      className={cn(
        "flex h-[calc(100%-16px)] flex-col gap-1.5 rounded-window bg-sidebar/92 p-3 shadow-sidebar backdrop-blur-frost backdrop-saturate-160",
        className,
      )}
      {...props}
    >
      {children}
    </nav>
  );
}

export type SideNavItemProps = ComponentProps<"button"> & {
  /** The item's icon, a Lucide icon at 26px. */
  icon?: ReactNode;
  /** A count after the label, such as unread email. */
  count?: ReactNode;
  /** The page shown beside the list: a raised white platter with an indigo label. */
  selected?: boolean;
};

/** One place in a `SideNav`: an icon, a label and an optional count. */
export function SideNavItem({ icon, count, selected = false, type = "button", className, children, ...props }: SideNavItemProps) {
  return (
    // Prototype `.a-nav .a-ni`, selected as `.a-nav .a-ni.sel` (the shared selected platter).
    <button
      type={type}
      aria-current={selected ? "page" : undefined}
      className={cn(
        focusRing,
        "flex h-[72px] w-full shrink-0 items-center gap-3.5 rounded-row px-5 text-left font-sans text-[21px] leading-[26px] font-bold text-chrome [&_svg]:size-[26px] [&_svg]:shrink-0 [&_svg]:text-primary",
        selected && "bg-card text-primary shadow-raised",
        className,
      )}
      {...props}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {count != null && <span className="text-lg leading-none font-bold text-muted-foreground">{count}</span>}
    </button>
  );
}

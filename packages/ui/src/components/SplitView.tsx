import type { ComponentProps, ReactNode, Ref } from "react";
import { cn, focusRing } from "../lib/cn.ts";

export type SplitViewProps = ComponentProps<"div"> & {
  /** The side list, a `SideNav`: it scrolls independently of the page beside it. */
  nav: ReactNode;
  /** The window's header, an `AppHeader`: it floats over the top of the page column, not over the side list. */
  header?: ReactNode;
  /** The page column, the element that scrolls. */
  pageRef?: Ref<HTMLDivElement>;
};

/**
 * An app window split into a side list and the page it opens, as Email and Settings are.
 * @design packages/design-system/design.md#windows
 */
export function SplitView({ nav, header, pageRef, className, children, ...props }: SplitViewProps) {
  return (
    <div className={cn("relative grid h-full grid-cols-[270px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] gap-6 px-4 pt-4", className)} {...props}>
      {nav}
      <div
        ref={pageRef}
        className="-mr-6 min-h-0 overflow-y-auto pt-[84px] pr-6 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {header != null && <div className="pointer-events-none absolute top-0 right-0 left-[310px]">{header}</div>}
    </div>
  );
}

export type SideNavProps = ComponentProps<"nav">;

/** The side list of a split app window: lighter glass floating inside the window, with a bright rim. */
export function SideNav({ className, children, ...props }: SideNavProps) {
  return (
    <nav
      className={cn(
        "flex h-[calc(100%-16px)] min-h-0 flex-col gap-1.5 overflow-y-auto rounded-window bg-sidebar/92 p-3 shadow-elevation-sidebar backdrop-blur-panel backdrop-saturate-160",
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

import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn.ts";

export type BrowserWindowProps = ComponentProps<"section"> & {
  /** The tab strip, a `BrowserTabStrip`. */
  tabStrip: ReactNode;
  /** The toolbar, a `BrowserToolbar` holding an `AddressBar`. */
  toolbar: ReactNode;
  /** `screen` places the window on a `TabletScreen`, right of the rail; `inline` fills its container. */
  placement?: "screen" | "inline";
};

/**
 * The browser's floating window: the tab strip and toolbar on glass, and the website below them, its
 * children (the selected tab's page, or a `NewTabPage`).
 * @model spec/app/browser.md
 * @design packages/design-system/design.md#windows
 */
export function BrowserWindow({ tabStrip, toolbar, placement = "screen", className, children, ...props }: BrowserWindowProps) {
  return (
    // Prototype `.bwin`: 144px from the left and 6px from the other edges, 1130 wide on a landscape tablet; light glass with a bright rim and a brighter top line.
    <section
      className={cn(
        "isolate flex flex-col overflow-hidden rounded-window bg-glass/42 font-sans text-chrome shadow-pane transition-[bottom] duration-slow ease-settle motion-reduce:transition-none",
        placement === "screen" ? "absolute top-1.5 bottom-1.5 left-[144px] z-[1] right-1.5" : "relative size-full",
        className,
      )}
      {...props}
    >
      {tabStrip}
      {toolbar}
      {/* Prototype `.site`: the website, under the toolbar. Clear, because the app's native page is drawn below it
          (apps/app/src/PageLayer.tsx, PageArea); a page Grace draws itself, such as NewTabPage, brings its own grey. */}
      <div className="relative min-h-0 flex-1 overflow-hidden">{children}</div>
    </section>
  );
}

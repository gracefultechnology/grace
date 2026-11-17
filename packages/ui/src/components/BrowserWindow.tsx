import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn.ts";

export type BrowserWindowProps = ComponentProps<"section"> & {
  /** The tab strip, a `BrowserTabStrip`. */
  tabStrip: ReactNode;
  /** The toolbar, a `BrowserToolbar` holding an `AddressBar`. */
  toolbar: ReactNode;
};

/**
 * The browser's floating window: the tab strip and toolbar on glass, and the website below them, its
 * children (the selected tab's page, or a `NewTabPage`). It fills the place it is given, a `ScreenSlot` on the tablet.
 * @model spec/app/browser.md
 * @design packages/design-system/design.md#windows
 * @design packages/design-system/design.md#screens
 */
export function BrowserWindow({ tabStrip, toolbar, className, children, ...props }: BrowserWindowProps) {
  return (
    <section
      className={cn(
        "relative isolate flex size-full flex-col overflow-hidden rounded-window bg-glass/42 font-sans text-chrome shadow-pane",
        className,
      )}
      {...props}
    >
      {tabStrip}
      {toolbar}
      <div className="relative min-h-0 flex-1 overflow-hidden">{children}</div>
    </section>
  );
}

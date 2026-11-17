import type { ComponentProps } from "react";
import { cn } from "../lib/cn.ts";

export type TabletScreenProps = ComponentProps<"div"> & {
  /** The wash behind everything: `soft` is Grace's washes at half strength over white (Home, apps); `frame` the full-strength one. */
  background?: "soft" | "frame";
  /** Draws the tablet's dark bezel around the screen. */
  device?: boolean;
};

export const besideRail = "absolute right-1.5 left-[144px]";

/**
 * Where a window or Grace sits on the tablet's screen: right of the rail, 6px from the screen's edges. What it holds fills it.
 * @design packages/design-system/design.md#screens
 */
export function ScreenSlot({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn(besideRail, "inset-y-1.5", className)} {...props} />;
}

/**
 * The tablet's 1280×800 screen: what every screen-level view is drawn on. Its children are placed absolutely,
 * as the rail, windows and Grace are.
 * @model spec/app/shell.md
 * @design packages/design-system/design.md#glass
 * @design packages/design-system/design.md#screens
 */
export function TabletScreen({ background = "soft", device = false, className, children, ...props }: TabletScreenProps) {
  const screen = (
    <div
      className={cn(
        "relative isolate h-[800px] w-[1280px] shrink-0 overflow-hidden rounded-screen bg-screen font-sans text-grace-ink",
        background === "soft" ? "bg-gradient-frame-soft" : "bg-gradient-frame",
        !device && className,
      )}
      {...(device ? {} : props)}
    >
      {children}
    </div>
  );
  if (!device) return screen;
  return (
    <div className={cn("box-content w-[1280px] shrink-0 rounded-device bg-device p-[18px] shadow-elevation-device", className)} {...props}>
      {screen}
    </div>
  );
}

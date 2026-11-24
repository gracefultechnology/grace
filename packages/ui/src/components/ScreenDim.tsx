import type { ComponentProps } from "react";
import { cn } from "../lib/cn.ts";

export type ScreenDimProps = Omit<ComponentProps<"div">, "children"> & {
  /** The screen's brightness in percent, 20 to 100: the lower it is, the darker the layer. */
  brightness: number;
};

/**
 * The darkness laid over the whole tablet screen as its brightness is lowered, rail and Grace included; taps pass
 * through it. Placed last in a `TabletScreen`.
 * @model spec/app/preferences.md
 * @design packages/design-system/design.md#glass
 */
export function ScreenDim({ brightness, className, style, ...props }: ScreenDimProps) {
  if (brightness >= 100) return null;
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 z-60 bg-dim", className)}
      style={{ opacity: ((100 - brightness) / 100) * 0.6, ...style }}
      {...props}
    />
  );
}

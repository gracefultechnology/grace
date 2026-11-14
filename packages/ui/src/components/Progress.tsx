import type { ComponentProps } from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "../lib/cn.ts";

export type ProgressProps = Omit<ComponentProps<typeof ProgressPrimitive.Root>, "children"> & {
  /** How much is done, from 0 to `max`; leave out while the amount is unknown. */
  value?: number | null;
  /** The value that means done. */
  max?: number;
};

/**
 * A bar for work whose length is known, the indigo fill of the prototype's `.vol .tr`. Name it with `aria-label`.
 * @design packages/design-system/design.md#selected
 */
export function Progress({ value, max = 100, className, ...props }: ProgressProps) {
  // Radix reads a value outside 0 to `max` as unknown, so it is given the one the bar shows.
  const done = value == null ? null : Math.min(Math.max(value, 0), max);
  return (
    <ProgressPrimitive.Root value={done} max={max} className={cn("h-3 w-full overflow-hidden rounded-full bg-primary/12", className)} {...props}>
      <ProgressPrimitive.Indicator
        className={cn("size-full origin-left rounded-full bg-primary transition-transform duration-slow", done === null && "animate-pulse motion-reduce:animate-none")}
        style={done === null ? undefined : { transform: `translateX(${(done / max - 1) * 100}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

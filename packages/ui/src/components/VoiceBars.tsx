import type { ComponentProps } from "react";
import { cn } from "../lib/cn.ts";

const bars = [8, 20, 13, 17];

export type VoiceBarsProps = Omit<ComponentProps<"span">, "children"> & {
  /** `live` while Grace speaks; `idle` while she listens and waits. */
  state?: "live" | "idle";
};

/**
 * Grace's lavender voice bars, moving while she speaks. Decorative: the words beside them say what she says.
 * @design packages/design-system/design.md#grace
 */
export function VoiceBars({ state = "live", className, ...props }: VoiceBarsProps) {
  const live = state === "live";
  return (
    <span aria-hidden className={cn("flex h-8 w-[25px] flex-none items-center gap-[3px]", className)} {...props}>
      {bars.map((height, i) => (
        <span
          key={height}
          className={cn("w-1 rounded-full bg-lavender motion-reduce:animate-none", live ? "animate-eq" : "scale-y-[.65] opacity-75")}
          style={live ? { height, animationDelay: `${i * 0.15}s` } : { height }}
        />
      ))}
    </span>
  );
}

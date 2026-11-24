import type { ComponentProps } from "react";
import { cn } from "../lib/cn.ts";

export type GuideRect = { x: number; y: number; width: number; height: number };

export type GuideGap = number | { top: number; right: number; bottom: number; left: number };

export type GuideRingProps = Omit<ComponentProps<"div">, "children"> & {
  /** The target Grace points at; the ring is drawn in the margin around it. Without it the ring follows the positioned element it sits in, as axGuide() anchors it inside the apps. */
  rect?: GuideRect;
  /** How far outside the target the ring's line sits, on every side or per side: half the gap to the nearest neighbour less 4, from -6 to 8. */
  gap?: GuideGap;
  /** Corner radius of the ring in pixels: the target's own radius plus `gap` follows its shape. */
  radius?: number;
  /** `guide` for something to look at or tap; `ok` once it is done. */
  tone?: "guide" | "ok";
  /** Close neighbours: the 4px line alone, with no glow spilling onto them. */
  tight?: boolean;
  /** `pulse` beats three times, `tap` pulses until it is tapped, `still` holds (chosen, or Grace working in it). */
  motion?: "pulse" | "tap" | "still";
};

const looks = {
  guide: { base: "shadow-elevation-guide", peak: "shadow-guide-peak", tight: "shadow-guide-tight" },
  ok: { base: "shadow-guide-ok", peak: "shadow-guide-peak-ok", tight: "shadow-guide-tight-ok" },
} as const;

/**
 * Grace's ring around the thing she means on the page, in the empty margin around it so it never covers its neighbours.
 * @model spec/app/execution.md
 * @design packages/design-system/design.md#guidance
 */
export function GuideRing({ rect, gap = 8, radius = 12, tone = "guide", tight = false, motion = "pulse", className, style, ...props }: GuideRingProps) {
  const { top, right, bottom, left } = typeof gap === "number" ? { top: gap, right: gap, bottom: gap, left: gap } : gap;
  const look = looks[tone];
  const active = motion !== "still";
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute",
        tight ? look.tight : look.base,
        tight && active && "animate-guide-pulse-tight motion-reduce:animate-none",
        tight && motion === "pulse" && "[animation-iteration-count:3]",
        className,
      )}
      style={{
        ...(rect ? { left: rect.x - left, top: rect.y - top, width: rect.width + left + right, height: rect.height + top + bottom } : { left: -left, top: -top, right: -right, bottom: -bottom }),
        borderRadius: radius,
        ...style,
      }}
      {...props}
    >
      {!tight && active && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 [border-radius:inherit] animate-guide-pulse motion-reduce:animate-none",
            look.peak,
            motion === "pulse" && "[animation-iteration-count:3]",
          )}
        />
      )}
    </div>
  );
}

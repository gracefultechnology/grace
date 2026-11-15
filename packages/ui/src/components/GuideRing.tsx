import type { ComponentProps } from "react";
import { cn } from "../lib/cn.ts";

/** A box on the page, in pixels from the top-left corner of the layer the guidance is drawn on. */
export type GuideRect = { x: number; y: number; width: number; height: number };

/** How far outside each edge of the target the ring's line sits; negative sits inside it. */
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

// Prototype `.gring`, `.gring.ok`, `.gring.tight`, `.gring.tight.ok`: the ring's shadow token and its pulse, by tone and spacing.
// The shadow is set alone, not through `shadow-*` and its four empty layers, so each pulse keyframe changes it layer for layer.
const looks = {
  guide: [["--shadow-guide", "animate-guide-pulse"], ["--shadow-guide-tight", "animate-guide-pulse-tight"]],
  ok: [["--shadow-guide-ok", "animate-guide-pulse-ok"], ["--shadow-guide-tight-ok", "animate-guide-pulse-tight-ok"]],
} as const;

/**
 * Grace's ring around the thing she means on the page, in the empty margin around it so it never covers its neighbours.
 * @model spec/app/execution.md
 * @design packages/design-system/design.md#guidance
 */
export function GuideRing({ rect, gap = 8, radius = 12, tone = "guide", tight = false, motion = "pulse", className, style, ...props }: GuideRingProps) {
  // Prototype ringBox(): each edge offset on its own.
  const { top, right, bottom, left } = typeof gap === "number" ? { top: gap, right: gap, bottom: gap, left: gap } : gap;
  const [shadow, pulse] = looks[tone][Number(tight)];
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute motion-reduce:animate-none",
        pulse,
        // `.gring` beats three times; `.gring.tapt` until it is tapped; `.gring.sel` and `.gring.dash` hold still.
        motion === "pulse" && "[animation-iteration-count:3]",
        motion === "still" && "animate-none",
        className,
      )}
      style={{
        // `.gring.anch`: inset by the gap from its element's edges, whatever size it takes.
        ...(rect ? { left: rect.x - left, top: rect.y - top, width: rect.width + left + right, height: rect.height + top + bottom } : { left: -left, top: -top, right: -right, bottom: -bottom }),
        borderRadius: radius,
        boxShadow: `var(${shadow})`,
        ...style,
      }}
      {...props}
    />
  );
}

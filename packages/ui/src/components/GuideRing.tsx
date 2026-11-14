import type { ComponentProps } from "react";
import { cn } from "../lib/cn.ts";

/** A box on the page, in pixels from the top-left corner of the layer the guidance is drawn on. */
export type GuideRect = { x: number; y: number; width: number; height: number };

export type GuideRingProps = Omit<ComponentProps<"div">, "children"> & {
  /** The target Grace points at; the ring is drawn in the margin around it. */
  rect: GuideRect;
  /** How far outside the target the ring's line sits: half the gap to its nearest neighbour, at most 8. */
  gap?: number;
  /** Corner radius of the ring in pixels: the target's own radius plus `gap` follows its shape. */
  radius?: number;
  /** `guide` for something to look at or tap; `ok` once it is done. */
  tone?: "guide" | "ok";
  /** Close neighbours: the 4px line alone, with no glow spilling onto them. */
  tight?: boolean;
  /** `pulse` beats three times, `tap` pulses until it is tapped, `still` holds (chosen, or Grace working in it). */
  motion?: "pulse" | "tap" | "still";
};

// Prototype `.gring`, `.gring.tight`, `.gring.ok`: the glowing ring and its pulse, by tone and spacing.
// The glowing ring sets box-shadow to the token alone, not through `shadow-*`'s empty ring layers, so the pulse keyframe grows its line and glow layer for layer.
const looks = {
  guide: ["[box-shadow:var(--shadow-guide)] animate-guide-pulse", "ring-4 ring-guide animate-guide-pulse-tight"],
  ok: ["[box-shadow:var(--shadow-guide-ok)] animate-guide-pulse-ok", "ring-4 ring-ok animate-none"],
} as const;

/**
 * Grace's ring around the thing she means on the page, in the empty margin around it so it never covers its neighbours.
 * @model spec/app/execution.md
 * @design packages/design-system/design.md#guidance
 */
export function GuideRing({ rect, gap = 8, radius = 12, tone = "guide", tight = false, motion = "pulse", className, style, ...props }: GuideRingProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute motion-reduce:animate-none",
        looks[tone][Number(tight)],
        // `.gring` beats three times; `.gring.tapt` until it is tapped; `.gring.sel` and `.gring.dash` hold still.
        motion === "pulse" && "[animation-iteration-count:3]",
        motion === "still" && "animate-none",
        className,
      )}
      style={{ left: rect.x - gap, top: rect.y - gap, width: rect.width + 2 * gap, height: rect.height + 2 * gap, borderRadius: radius, ...style }}
      {...props}
    />
  );
}

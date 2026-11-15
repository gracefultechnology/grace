import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn.ts";
import { GuideLabel } from "./GuideLabel.tsx";
import { GuideRing } from "./GuideRing.tsx";

export type GuideAnchorProps = Omit<ComponentProps<"span">, "title"> & {
  /** The thing Grace points at inside an app: a row, an option, a button. */
  children: ReactNode;
  /** The target's own corner radius in pixels; the ring, 8px outside it, adds the 8 so it follows its shape. */
  radius?: number;
  /** `point`: what Grace is talking about, in a violet ring that beats three times; `instruction`: Margaret's turn, the violet ring
   * pulsing until tapped, and `title` beside it; `confirm`: done, in a green ring that beats three times. */
  kind?: "point" | "instruction" | "confirm";
  /** What to do, on Grace's label to the right of the target: "Tap Largest". */
  title?: string;
  /** Dismisses the label and its ring; without it the label has no close button. */
  onClose?: () => void;
  /** The close button's accessible name. */
  closeLabel?: string;
};

// Prototype axGuide(): the ring 8px outside the element.
const gap = 8;

/**
 * Grace pointing inside an app window: her ring round the target and her label beside it, anchored to the element so they
 * follow it whatever the text size (prototype `.anch-w`, `.gring.anch`, `.glab.anch`).
 * @model spec/app/workspace.md
 * @design packages/design-system/design.md#guidance
 */
export function GuideAnchor({ children, radius = 12, kind = "point", title, onClose, closeLabel, className, ...props }: GuideAnchorProps) {
  const instruction = kind === "instruction";
  return (
    <span className={cn("relative inline-flex", className)} {...props}>
      {children}
      <GuideRing gap={gap} radius={Math.min(radius + gap, 999)} tone={kind === "confirm" ? "ok" : "guide"} motion={instruction ? "tap" : "pulse"} />
      {instruction && title && (
        // `.glab.anch`: 22px right of the target, its bottom 22px below the target's middle (at most 40px down).
        <GuideLabel
          title={title}
          onClose={onClose}
          closeLabel={closeLabel}
          className="absolute top-[calc(min(50%,40px)+22px)] left-[calc(100%+22px)] z-6 -translate-y-full"
        />
      )}
    </span>
  );
}

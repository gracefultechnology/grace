import type { ComponentProps } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import { cn } from "../lib/cn.ts";

const arrows = { up: ArrowUp, down: ArrowDown, left: ArrowLeft, right: ArrowRight } as const;
// Prototype `.gjump`: centred on the edge of the page frame the target lies beyond, 16px in.
const edges = {
  up: "inset-x-0 top-4 mx-auto",
  down: "inset-x-0 bottom-4 mx-auto",
  left: "inset-y-0 left-4 my-auto",
  right: "inset-y-0 right-4 my-auto",
} as const;

export type GuideOffscreenTargetProps = Omit<ComponentProps<"button">, "children" | "onSelect"> & {
  /** Where the thing is, in words: "Continue is below". */
  label: string;
  /** Which way the target lies beyond the visible page. */
  direction?: "up" | "down" | "left" | "right";
  /** Brings the target into view. */
  onSelect?: () => void;
};

/**
 * What Grace points at is off the page: a pill at the page's edge that names where it is and scrolls there on a tap.
 * @model spec/app/execution.md
 * @design packages/design-system/design.md#guidance
 */
export function GuideOffscreenTarget({ label, direction = "down", onSelect, onClick, className, ...props }: GuideOffscreenTargetProps) {
  const Arrow = arrows[direction];
  return (
    <button
      type="button"
      onClick={(event) => { onClick?.(event); onSelect?.(); }}
      className={cn(
        // Its edge is a ring, so keyboard focus shows as an outline instead.
        "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        // A white 64 pill in the guide label's 3px violet edge, in the Label style (20/700) of every control.
        "absolute flex h-16 w-max items-center gap-2.5 rounded-full bg-glass pr-[26px] pl-[18px] text-body leading-6 font-bold whitespace-nowrap text-grace-ink shadow-tag ring-3 ring-guide ring-inset",
        "animate-label-in transition-transform duration-press ease-spring active:scale-[.97] motion-reduce:animate-none",
        edges[direction],
        className,
      )}
      {...props}
    >
      <Arrow size={26} strokeWidth={2.5} aria-hidden className="text-primary" />
      {label}
    </button>
  );
}

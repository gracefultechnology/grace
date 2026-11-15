import type { ComponentProps } from "react";
import { cn } from "../lib/cn.ts";
import { GraceMark } from "./GraceOrb.tsx";

export type GraceCursorProps = Omit<ComponentProps<"div">, "children"> & {
  /** The centre of Grace's G, in pixels from the top-left corner of the layer it moves on. */
  x: number;
  /** See `x`. */
  y: number;
  /** What she is doing, on a tag beside her G: "Paused" while her work is held. */
  tag?: string;
  /** She is pressing: the G shrinks and a ring ripples out. */
  pressed?: boolean;
  /** Her work is held: the G fades and the tag turns white. */
  paused?: boolean;
  /** Near the right edge: the tag goes on the left of the G. */
  flip?: boolean;
};

/**
 * Grace's hand on the page: her G, gliding to each thing she taps, with what she is doing beside it.
 * @model spec/app/execution.md
 * @design packages/design-system/design.md#grace
 */
export function GraceCursor({ x, y, tag, pressed = false, paused = false, flip = false, className, style, ...props }: GraceCursorProps) {
  return (
    // Prototype `.gcur`: it glides 1.4s from step to step, above the page and its guidance.
    <div
      role="status"
      className={cn("pointer-events-none absolute z-6 size-0 transition-[left,top] duration-[1400ms] ease-standard motion-reduce:transition-none", className)}
      style={{ left: x, top: y, ...style }}
      {...props}
    >
      {pressed && !paused && <span aria-hidden className="absolute -top-7 -left-7 size-14 rounded-full border-4 border-guide animate-ripple motion-reduce:animate-none" />}
      <GraceMark
        size="sm"
        className={cn(
          "absolute -top-7 -left-7 shadow-cursor animate-orb-in transition-[scale] duration-[180ms] ease-spring motion-reduce:animate-none",
          pressed && "scale-[.82]",
          paused && "opacity-80 saturate-30",
        )}
      />
      {tag && (
        // `.gcur .ctag`: indigo, 22px corners and a 6px one toward the G; `.gcur.paused .ctag`: white with an indigo edge.
        <span
          className={cn(
            "absolute top-[22px] flex h-11 items-center gap-2 rounded-row px-[18px] text-body font-bold whitespace-nowrap transition-colors duration-quick",
            flip ? "right-[30px] rounded-br-tag" : "left-[30px] rounded-bl-tag",
            paused ? "bg-glass text-primary shadow-cursor-tag-paused" : "bg-primary text-primary-foreground shadow-cursor-tag",
          )}
        >
          {tag}
        </span>
      )}
    </div>
  );
}

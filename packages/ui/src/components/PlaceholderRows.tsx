import type { ComponentProps } from "react";
import { cn } from "../lib/cn.ts";

export type PlaceholderRowsProps = Omit<ComponentProps<"div">, "children"> & {
  /** How many faded rows. */
  count?: number;
  /** What leads each row: a day tile, as Calendar's events, or a round avatar, as Email's senders. */
  mark?: "day" | "avatar";
};

/**
 * The shape of a card's rows with nothing in them yet, faded, so an empty card keeps its look instead of going blank.
 * Hidden from assistive technology; the card's status says it is empty.
 * @design packages/design-system/design.md#empty-states
 */
export function PlaceholderRows({ count = 2, mark = "day", className, ...props }: PlaceholderRowsProps) {
  return (
    <div aria-hidden className={cn("flex flex-col gap-3.5 opacity-55", className)} {...props}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <span className={cn("size-[58px] flex-none bg-accent", mark === "day" ? "rounded-tab" : "rounded-full")} />
          <span className="flex-1">
            <span className={cn("block h-3.5 rounded-full bg-border", i % 2 ? "w-3/5" : "w-[70%]")} />
            <span className={cn("mt-2.5 block h-3 rounded-full bg-site-line", i % 2 ? "w-2/5" : "w-[45%]")} />
          </span>
        </div>
      ))}
    </div>
  );
}

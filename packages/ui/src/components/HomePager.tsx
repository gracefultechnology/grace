import type { ComponentProps } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn, focusRing } from "../lib/cn.ts";
import { Button } from "./Button.tsx";

export type HomePagerProps = Omit<ComponentProps<"div">, "children"> & {
  /** The page in view, from 0. */
  page: number;
  /** How many pages Home has. */
  count?: number;
  /** Asks for another page: a dot or an arrow was tapped. */
  onPageChange?: (page: number) => void;
  /** The accessible name of the arrow to the next page. */
  nextLabel?: string;
  /** The accessible name of the arrow back to the first page. */
  backLabel?: string;
  /** The accessible name of a dot, before its number: "Page". */
  pageLabel?: string;
};

/**
 * Home's page controls: a dot per page under the cards, the current one a long indigo dash, and a round glass arrow at
 * the edge toward the other page. Drawn over Home's whole area.
 * @model spec/app/shell.md
 * @design packages/design-system/design.md#buttons
 */
export function HomePager({ page, count = 2, onPageChange, nextLabel = "More apps", backLabel = "Back to the first page", pageLabel = "Page", className, ...props }: HomePagerProps) {
  const arrow = "pointer-events-auto absolute top-[402px] size-[76px] p-0 text-chrome";
  return (
    <div className={cn("pointer-events-none absolute inset-0 z-[300]", className)} {...props}>
      {/* Prototype `.harrow`, `#hArrowL` (lines 627, 653): halfway down the cards, at either edge. */}
      {page > 0 && (
        <Button variant="capsule" aria-label={backLabel} onClick={() => onPageChange?.(0)} className={cn(arrow, "left-[156px]")}>
          <ChevronLeft aria-hidden size={34} strokeWidth={2.6} />
        </Button>
      )}
      {page < count - 1 && (
        <Button variant="capsule" aria-label={nextLabel} onClick={() => onPageChange?.(page + 1)} className={cn(arrow, "right-[18px]")}>
          <ChevronRight aria-hidden size={34} strokeWidth={2.6} />
        </Button>
      )}
      {/* Prototype `.hpager` (lines 630–633, 648): under the cards' column, 18px from the bottom. */}
      <div className="absolute bottom-[18px] left-[182px] flex w-[1042px] items-center justify-center gap-1.5">
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`${pageLabel} ${i + 1}`}
            aria-current={i === page || undefined}
            onClick={() => onPageChange?.(i)}
            className={cn(
              focusRing,
              "pointer-events-auto flex size-11 cursor-pointer items-center justify-center rounded-full after:h-4 after:rounded-full after:transition-[width,background-color] after:duration-slow after:ease-spring after:content-['']",
              i === page ? "after:w-14 after:bg-primary" : "after:w-4 after:bg-pager",
            )}
          />
        ))}
      </div>
    </div>
  );
}

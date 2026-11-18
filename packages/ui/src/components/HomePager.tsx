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
  /** The accessible name of the arrow to the previous page. */
  backLabel?: string;
  /** The accessible name of a dot, before its number: "Page". */
  pageLabel?: string;
  /** Above Grace's compact window, only the arrows appear, centered vertically. */
  compact?: boolean;
  /** The round arrows at the edges; left out when the cards are hidden. */
  arrows?: boolean;
};

/**
 * Home's page controls: a dot per page under the cards, the current one a long indigo dash, and a round glass arrow at
 * each edge that has a page beyond it. Drawn over Home's whole area.
 * @model spec/app/shell.md
 * @design packages/design-system/design.md#buttons
 */
export function HomePager({ page, count = 2, onPageChange, nextLabel = "More apps", backLabel = "Previous page", pageLabel = "Page", compact = false, arrows = true, className, ...props }: HomePagerProps) {
  const arrow = cn("pointer-events-auto absolute size-[76px] p-0 text-chrome transition-none active:scale-96", compact ? "top-1/2 -translate-y-1/2" : "top-[402px]");
  return (
    <div className={cn("pointer-events-none absolute inset-0 z-[300]", className)} {...props}>
      {arrows && page > 0 && (
        <Button variant="capsule" aria-label={backLabel} onClick={() => onPageChange?.(page - 1)} className={cn(arrow, "left-[156px]")}>
          <ChevronLeft aria-hidden size={34} strokeWidth={2.6} />
        </Button>
      )}
      {arrows && page < count - 1 && (
        <Button variant="capsule" aria-label={nextLabel} onClick={() => onPageChange?.(page + 1)} className={cn(arrow, "right-[18px]")}>
          <ChevronRight aria-hidden size={34} strokeWidth={2.6} />
        </Button>
      )}
      {!compact && (
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
                "pointer-events-auto flex size-11 cursor-pointer items-center justify-center rounded-full after:h-4 after:rounded-full after:transition-[width,background-color] after:duration-slow after:[transition-timing-function:var(--ease-settle),var(--ease-css-default)] after:content-['']",
                i === page ? "after:w-14 after:bg-primary" : "after:w-4 after:bg-pager",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

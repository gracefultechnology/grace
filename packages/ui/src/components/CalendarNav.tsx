import type { ComponentProps } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";
import { SegmentedControl } from "./SegmentedControl.tsx";

export type CalendarMode = "week" | "month";

export type CalendarNavProps = ComponentProps<"div"> & {
  /** The period shown: "November 9 – 15", "November 2026". */
  period: string;
  /** Week or month. */
  mode: CalendarMode;
  /** Called with the view a person chooses; without it Week and Month are not offered. */
  onModeChange?: (mode: CalendarMode) => void;
  /** Goes to the period before; without it ‹ is not offered. */
  onPrevious?: () => void;
  /** Goes to the period after; without it › is not offered. */
  onNext?: () => void;
  /** The accessible name of ‹: "Previous week". */
  previousLabel?: string;
  /** The accessible name of ›: "Next week". */
  nextLabel?: string;
  /** The words on the two views. */
  modeLabels?: Record<CalendarMode, string>;
  /** The accessible name of the Week and Month choice. */
  modeGroupLabel?: string;
};

/**
 * The period's title between ‹ and ›, with Week and Month beside it, each offered only with its handler (prototype `.a-mhead`).
 * @model spec/app/calendarView.md
 * @design packages/design-system/design.md#selected
 */
export function CalendarNav({
  period,
  mode,
  onModeChange,
  onPrevious,
  onNext,
  previousLabel = mode === "week" ? "Previous week" : "Previous month",
  nextLabel = mode === "week" ? "Next week" : "Next month",
  modeLabels = { week: "Week", month: "Month" },
  modeGroupLabel = "View",
  className,
  ...props
}: CalendarNavProps) {
  const arrow = { size: 28, strokeWidth: 2.4, "aria-hidden": true } as const;
  return (
    <div className={cn("flex items-center gap-3.5 font-sans", className)} {...props}>
      {onPrevious && (
        <Button variant="capsule" size="pill-icon" className="text-chrome transition-none active:scale-96" aria-label={previousLabel} onClick={onPrevious}>
          <ChevronLeft {...arrow} />
        </Button>
      )}
      <h2 className="m-0 text-title leading-[34px] font-bold text-chrome">{period}</h2>
      {onNext && (
        <Button variant="capsule" size="pill-icon" className="text-chrome transition-none active:scale-96" aria-label={nextLabel} onClick={onNext}>
          <ChevronRight {...arrow} />
        </Button>
      )}
      {onModeChange && (
        <SegmentedControl
          size="md"
          aria-label={modeGroupLabel}
          className="ml-auto w-[332px] p-1.5 [&>button]:h-13"
          value={mode}
          onValueChange={(value) => value && onModeChange(value as CalendarMode)}
          options={(["week", "month"] as const).map((value) => ({
            value,
            label: modeLabels[value],
          }))}
        />
      )}
    </div>
  );
}

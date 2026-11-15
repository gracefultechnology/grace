import type { ComponentProps } from "react";
import { cn, focusRing } from "../lib/cn.ts";

export interface CalendarMonthDay {
  /** Identifies the day to `onSelect`, such as its ISO date. */
  key: string;
  /** The date's number: "13". */
  day: string;
  /** The month's name, which a screen reader says before the date: "November". */
  month?: string;
  /** A day of the month before or after: pale, with no tile. */
  outside?: boolean;
  /** The current day: its number is red. */
  today?: boolean;
  /** The chosen day: a raised white platter. */
  selected?: boolean;
  /** The day's first event, shortened: "Doctor". */
  event?: string;
  /** Marks that event as one not to miss with a red bar. */
  important?: boolean;
}

export type CalendarMonthProps = Omit<ComponentProps<"div">, "onSelect"> & {
  /** The weekdays over the columns, Monday first: "Mon". */
  weekdays: string[];
  /** Every day of the grid's weeks, Monday first, row by row. */
  days: CalendarMonthDay[];
  /** Called with the key of the day a person taps. */
  onSelect?: (key: string) => void;
};

/**
 * A month as a grid of days, each with its first event (prototype `.a-month`).
 * @model spec/app/calendarView.md
 * @design packages/design-system/design.md#selected
 */
export function CalendarMonth({ weekdays, days, onSelect, className, ...props }: CalendarMonthProps) {
  return (
    <div className={cn("grid grid-cols-7 gap-2 font-sans", className)} {...props}>
      {weekdays.map((w) => (
        <div key={w} aria-hidden className="text-center text-label leading-6 font-bold tracking-[.06em] text-muted-foreground uppercase">
          {w}
        </div>
      ))}
      {days.map((d) => (
        <button
          key={d.key}
          type="button"
          data-prototype-ink={d.outside ? "" : undefined}
          aria-pressed={!!d.selected}
          onClick={() => onSelect?.(d.key)}
          className={cn(
            focusRing,
            "relative box-border flex h-[78px] items-start cursor-pointer rounded-tab bg-panel px-3 py-2 text-left text-body-lg leading-[26px] font-bold text-chrome",
            // Prototype `.a-month .d.o`, in its own pale ink by the user's choice (.storybook/preview.ts, `data-prototype-ink`).
            d.outside && "bg-transparent text-outside-day",
            d.selected && "bg-card text-primary shadow-raised",
            d.today && "text-alert",
          )}
        >
          {d.month && <span className="sr-only">{d.month} </span>}
          {d.day}
          {d.event && !d.outside && (
            // Prototype `.a-month .d em`.
            <em
              className={cn(
                "absolute right-2 bottom-2 left-3 truncate border-l-3 pl-2 text-caption leading-[18px] font-semibold text-primary not-italic",
                d.important ? "border-alert" : "border-lavender",
              )}
            >
              {d.event}
            </em>
          )}
        </button>
      ))}
    </div>
  );
}

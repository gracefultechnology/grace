import type { ComponentProps } from "react";
import { cn, focusRing } from "../lib/cn.ts";

export interface CalendarMonthDay {
  key: string;
  day: string;
  month?: string;
  outside?: boolean;
  today?: boolean;
  selected?: boolean;
  event?: string;
  important?: boolean;
}

export type CalendarMonthProps = Omit<ComponentProps<"div">, "onSelect"> & {
  /** The weekdays over the columns, Monday first: "Mon". */
  weekdays: string[];
  /** Every day of the grid's weeks, Monday first, row by row. */
  days: CalendarMonthDay[];
  /** Called with the key of the day a person taps; without it the days are only read. */
  onSelect?: (key: string) => void;
};

/**
 * A month as a grid of days, each with its first event (prototype `.a-month`).
 * @model spec/app/calendarView.md
 * @design packages/design-system/design.md#selected
 */
export function CalendarMonth({ weekdays, days, onSelect, className, ...props }: CalendarMonthProps) {
  const Day = onSelect ? "button" : "div";
  return (
    <div className={cn("grid grid-cols-7 gap-2 font-sans", className)} {...props}>
      {weekdays.map((w) => (
        <div key={w} aria-hidden className="text-center text-label leading-6 font-bold tracking-[.06em] text-muted-foreground uppercase">
          {w}
        </div>
      ))}
      {days.map((d) => (
        <Day
          key={d.key}
          data-prototype-ink={d.outside ? "" : undefined}
          {...(onSelect && { type: "button", "aria-pressed": !!d.selected, onClick: () => onSelect(d.key) })}
          className={cn(
            onSelect && [focusRing, "cursor-pointer"],
            "relative box-border flex h-[78px] items-start rounded-tab bg-panel px-3 py-2 text-left text-body-lg leading-[26px] font-bold text-chrome",
            d.outside && "bg-transparent text-outside-day",
            d.selected && "bg-card text-primary shadow-raised",
            d.today && "text-alert",
          )}
        >
          {d.month && <span className="sr-only">{d.month} </span>}
          {d.day}
          {d.event && !d.outside && (
            <em
              className={cn(
                "absolute right-2 bottom-2 left-3 truncate border-l-3 pl-2 text-caption leading-[18px] font-semibold text-primary not-italic",
                d.important ? "border-alert" : "border-lavender",
              )}
            >
              {d.event}
            </em>
          )}
        </Day>
      ))}
    </div>
  );
}

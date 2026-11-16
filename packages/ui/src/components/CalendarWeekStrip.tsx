import type { ComponentProps } from "react";
import { cn, focusRing } from "../lib/cn.ts";

export interface CalendarWeekDay {
  key: string;
  weekday: string;
  day: string;
  month?: string;
  today?: boolean;
  selected?: boolean;
  busy?: boolean;
}

export type CalendarWeekStripProps = Omit<ComponentProps<"div">, "onSelect"> & {
  /** The week's seven days, Monday first. */
  days: CalendarWeekDay[];
  /** Called with the key of the day a person taps. */
  onSelect?: (key: string) => void;
  /** What a screen reader adds for a day with events. */
  busyLabel?: string;
};

/**
 * The week's seven days side by side; the chosen one is raised (prototype `.a-week`, `.a-day`).
 * @model spec/app/calendarView.md
 * @design packages/design-system/design.md#selected
 */
export function CalendarWeekStrip({ days, onSelect, busyLabel = "has plans", className, ...props }: CalendarWeekStripProps) {
  return (
    <div className={cn("grid grid-cols-7 gap-2.5 font-sans", className)} {...props}>
      {days.map((d) => (
        <button
          key={d.key}
          type="button"
          aria-pressed={!!d.selected}
          onClick={() => onSelect?.(d.key)}
          className={cn(focusRing, "relative flex h-24 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-day bg-panel", d.selected && "bg-card text-primary shadow-raised")}
        >
          <span
            data-prototype-ink={d.today ? "" : undefined}
            className={cn("text-label leading-5 font-bold tracking-[.06em] uppercase", d.today ? "text-alert" : "text-muted-foreground")}
          >
            {d.weekday}
          </span>
          <span className="text-title leading-[34px] font-bold text-chrome">{d.day}</span>
          <span className="sr-only">{[d.month, d.busy && busyLabel].filter(Boolean).join(", ")}</span>
          {d.busy && <i aria-hidden className="absolute bottom-3 size-2 rounded-full bg-lavender" />}
        </button>
      ))}
    </div>
  );
}

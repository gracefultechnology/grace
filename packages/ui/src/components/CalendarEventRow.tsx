import type { ComponentProps } from "react";
import { ChevronRight } from "lucide-react";
import { cn, focusRing } from "../lib/cn.ts";

export type CalendarEventRowProps = Omit<ComponentProps<"button">, "title" | "children" | "type"> & {
  /** The event's name: "Doctor’s appointment". */
  title: string;
  /** The day, short, over the time: "Sat", or "Today". */
  dayLabel: string;
  /** When it starts, as the app formats it: "10 am". */
  startLabel: string;
  /** Who it is with: "Dr. Patel". */
  who?: string;
  /** Where it is: "Main St clinic · 214 Main Street". */
  where?: string;
  /** How it repeats, when it does: "Every week". */
  repeat?: string;
  /** Marks the event as one not to miss with a red bar. */
  important?: boolean;
  /** The word a screen reader says for the red bar. */
  importantLabel?: string;
  /** Grace has proposed it and it is not saved yet: a dashed outline, and `draftNote` in place of the details. */
  draft?: boolean;
  /** The line a draft shows under its title. */
  draftNote?: string;
};

/**
 * One event in a list: its day and time, a colored bar, the title and its details; it opens the event (prototype `calRow`, `.a-row`).
 * @model spec/app/calendarView.md
 * @design packages/design-system/design.md#windows
 */
export function CalendarEventRow({
  title,
  dayLabel,
  startLabel,
  who,
  where,
  repeat,
  important = false,
  importantLabel = "Important",
  draft = false,
  draftNote = "Not added yet · Grace is asking you",
  className,
  ...props
}: CalendarEventRowProps) {
  const details = draft ? draftNote : [who, where, repeat].filter(Boolean).join(" · ");
  return (
    // Prototype `.a-row`, `.a-row[data-ax]:active`, `[aria-disabled]` at .4; a draft is `.a-new`.
    <button
      type="button"
      className={cn(
        focusRing,
        "box-border flex min-h-24 w-full cursor-pointer items-center gap-5 rounded-row bg-panel px-[22px] py-4 text-left font-sans transition-transform duration-press ease-spring active:scale-[.99] motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100",
        draft && "bg-background outline-[2.5px] -outline-offset-[2.5px] outline-guide outline-dashed",
        className,
      )}
      {...props}
    >
      {/* Prototype `.a-when`. */}
      <span className="w-[92px] flex-none text-center">
        <span className="block text-lg leading-[22px] font-bold tracking-[.06em] text-muted-foreground uppercase">{dayLabel}</span>
        <span className="block text-body-lg leading-7 font-bold text-chrome">{startLabel}</span>
      </span>
      {/* Prototype `.a-bar`, `.a-bar.red`. */}
      <span className={cn("w-[3px] flex-none self-stretch rounded-xs", important ? "bg-alert" : "bg-lavender")}>{important && <span className="sr-only">{importantLabel}</span>}</span>
      <span className="min-w-0">
        <span className="block text-lead leading-[30px] font-bold text-chrome">{title}</span>
        {details && <span className="mt-0.5 block truncate text-body leading-[26px] font-medium text-muted-foreground">{details}</span>}
      </span>
      <ChevronRight aria-hidden size={26} strokeWidth={2.4} className="ml-auto flex-none text-chevron" />
    </button>
  );
}

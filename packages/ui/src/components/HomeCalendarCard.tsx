import { Sparkle } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { CalendarIcon } from "./CalendarIcon.tsx";
import { HomeEventRow, type HomeEventRowProps } from "./HomeEventRow.tsx";
import { HomeWaiting } from "./HomeWaiting.tsx";
import { LauncherCard, type LauncherCardProps, LauncherRows } from "./LauncherCard.tsx";
import { PlaceholderRows } from "./PlaceholderRows.tsx";

export type HomeEvent = Omit<HomeEventRowProps, "className" | "id"> & { id: string | number };

export type HomeCalendarCardProps = Omit<LauncherCardProps, "title" | "children" | "art" | "size"> & {
  /** The app's name. */
  title?: string;
  /** Today's weekday on the tear-off page, in capitals: "FRI". */
  weekday: string;
  /** Today's day of the month. */
  day: number | string;
  /** The next events, soonest first; three fit. One with `onClick` opens it. With none, faded rows keep the card's shape. */
  events: HomeEvent[];
  /** With no events, what Grace can do, under her sparkle: "Ask Grace to add an appointment." */
  hint?: string;
  /** A narrow column above Grace's compact window: a smaller page at the corner and a 26px title. */
  compact?: boolean;
};

/**
 * Home's Calendar card: today on a tear-off page at its corner, and the next three events, the soonest in rose. The
 * card opens Calendar and each event opens itself: its rows are buttons beside the card's, never inside it. With
 * nothing coming, faded rows and, given one, Grace's hint.
 * @model spec/app/calendarView.md
 * @design packages/design-system/design.md#glass
 * @design packages/design-system/design.md#empty-states
 */
export function HomeCalendarCard({ title = "Calendar", weekday, day, events, hint, compact = false, className, ...props }: HomeCalendarCardProps) {
  return (
    <div role="group" aria-label={title} className={cn("relative", className)}>
      <LauncherCard
        compact={compact}
        title={title}
        titleClassName={compact ? "text-title-sm leading-8" : undefined}
        art={<CalendarIcon weekday={weekday} day={day} size={compact ? 84 : 120} aria-hidden />}
        className="size-full"
        {...props}
      />
      <div className="pointer-events-none absolute inset-x-6 top-[116px] bottom-6 flex flex-col [&_button]:pointer-events-auto">
        {events.length ? (
          <LauncherRows className="-mb-3 gap-y-3.5 pt-1">
            {events.slice(0, 3).map(({ id, ...event }) => (
              <HomeEventRow key={id} {...event} />
            ))}
          </LauncherRows>
        ) : (
          <>
            <PlaceholderRows className="pt-1" />
            {hint && <HomeWaiting message={hint} icon={<Sparkle aria-hidden size={26} strokeWidth={2} className="text-lavender" />} className="mt-auto" />}
          </>
        )}
      </div>
    </div>
  );
}

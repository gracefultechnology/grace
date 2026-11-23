import { cn } from "../lib/cn.ts";
import { CalendarIcon } from "./CalendarIcon.tsx";
import { HomeEventRow, type HomeEventRowProps } from "./HomeEventRow.tsx";
import { LauncherCard, type LauncherCardProps, LauncherRows, turnsNear } from "./LauncherCard.tsx";

export type HomeEvent = Omit<HomeEventRowProps, "className" | "id"> & { id: string | number };

export type HomeCalendarCardProps = Omit<LauncherCardProps, "title" | "children" | "art" | "size"> & {
  /** The app's name. */
  title?: string;
  /** Today's weekday on the tear-off page, in capitals: "FRI". */
  weekday: string;
  /** Today's day of the month. */
  day: number | string;
  /** The next events, soonest first; three fit. One with `onClick` opens it. */
  events: HomeEvent[];
  /** A narrow column above Grace's compact window: a smaller page at the corner and a 26px title. */
  compact?: boolean;
};

/**
 * Home's Calendar card: today on a tear-off page at its corner, and the next three events, the soonest in rose. The
 * card opens Calendar and each event opens itself: its rows are buttons beside the card's, never inside it; as the
 * card turns away round Home's drum they fade, and a picture of them blurs with the card's far side.
 * @model spec/app/calendarView.md
 * @design packages/design-system/design.md#glass
 */
export function HomeCalendarCard({ title = "Calendar", weekday, day, events, compact = false, className, ...props }: HomeCalendarCardProps) {
  const rows = (live: boolean) => (
    <LauncherRows className="-mb-3 gap-y-3.5 pt-1">
      {events.slice(0, 3).map(({ id, onClick, ...event }) => (
        <HomeEventRow key={id} {...event} onClick={live ? onClick : undefined} />
      ))}
    </LauncherRows>
  );
  return (
    <div role="group" aria-label={title} className={cn("relative", className)}>
      <LauncherCard
        compact={compact}
        title={title}
        titleClassName={compact ? "text-title-sm leading-8" : undefined}
        art={<CalendarIcon weekday={weekday} day={day} size={compact ? 84 : 120} aria-hidden />}
        picture={rows(false)}
        className="size-full"
        {...props}
      />
      <div {...turnsNear} className={cn("pointer-events-none absolute inset-x-6 top-[116px] bottom-6 flex flex-col [&_button]:pointer-events-auto", turnsNear.className)}>{rows(true)}</div>
    </div>
  );
}

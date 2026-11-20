import { cn } from "../lib/cn.ts";
import { CalendarIcon } from "./CalendarIcon.tsx";
import { HomeEventRow, type HomeEventRowProps } from "./HomeEventRow.tsx";
import { LauncherCard, type LauncherCardProps, LauncherRows } from "./LauncherCard.tsx";

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
 * card opens Calendar and each event opens itself: while the card lies flat its rows are buttons beside the card's,
 * never inside it; turning away round Home's drum, they blur with the card as a picture.
 * @model spec/app/calendarView.md
 * @design packages/design-system/design.md#glass
 */
export function HomeCalendarCard({ title = "Calendar", weekday, day, events, compact = false, turn = 0, className, ...props }: HomeCalendarCardProps) {
  const flat = turn === 0;
  const rows = (
    <LauncherRows className="-mb-3 gap-y-3.5 pt-1">
      {events.slice(0, 3).map(({ id, onClick, ...event }) => (
        <HomeEventRow key={id} {...event} onClick={flat ? onClick : undefined} />
      ))}
    </LauncherRows>
  );
  return (
    <div role="group" aria-label={title} className={cn("relative", className)}>
      <LauncherCard
        compact={compact}
        title={title}
        turn={turn}
        titleClassName={compact ? "text-title-sm leading-8" : undefined}
        art={<CalendarIcon weekday={weekday} day={day} size={compact ? 84 : 120} aria-hidden />}
        className="size-full"
        {...props}
      >
        {flat ? undefined : rows}
      </LauncherCard>
      {flat && <div className="pointer-events-none absolute inset-x-6 top-[116px] bottom-6 flex flex-col [&_button]:pointer-events-auto">{rows}</div>}
    </div>
  );
}

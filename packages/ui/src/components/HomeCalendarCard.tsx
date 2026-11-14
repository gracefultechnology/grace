import { CalendarIcon } from "./CalendarIcon.tsx";
import { HomeEventRow, type HomeEventRowProps } from "./HomeEventRow.tsx";
import { LauncherCard, type LauncherCardProps } from "./LauncherCard.tsx";

/** One coming event on the card. */
export type HomeEvent = Omit<HomeEventRowProps, "className" | "id"> & { id: string | number };

export type HomeCalendarCardProps = Omit<LauncherCardProps, "title" | "children" | "art"> & {
  /** The app's name. */
  title?: string;
  /** Today's weekday on the tear-off page, in capitals: "FRI". */
  weekday: string;
  /** Today's day of the month. */
  day: number | string;
  /** The next events, soonest first; three fit. */
  events: HomeEvent[];
};

/**
 * Home's Calendar card: today on a tear-off page at its corner, and the next three events, the soonest in rose.
 * @model spec/app/calendarView.md
 * @design packages/design-system/design.md#glass
 */
export function HomeCalendarCard({ title = "Calendar", weekday, day, events, size = "large", ...props }: HomeCalendarCardProps) {
  // Prototype markup line ~818 and `homeCards()`: the rows start 120px down, 14px apart.
  return (
    <LauncherCard title={title} size={size} art={<CalendarIcon weekday={weekday} day={day} aria-hidden />} {...props}>
      <span className="flex flex-col gap-3.5 pt-1">
        {events.slice(0, 3).map(({ id, ...event }) => (
          <HomeEventRow key={id} {...event} />
        ))}
      </span>
    </LauncherCard>
  );
}

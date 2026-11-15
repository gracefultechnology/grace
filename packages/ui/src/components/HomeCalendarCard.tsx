import { CalendarIcon } from "./CalendarIcon.tsx";
import { HomeEventRow, type HomeEventRowProps } from "./HomeEventRow.tsx";
import { LauncherCard, type LauncherCardProps, LauncherRows } from "./LauncherCard.tsx";

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
  /** A narrow column above Grace's compact window: a smaller page at the corner and a 26px title. */
  compact?: boolean;
};

/**
 * Home's Calendar card: today on a tear-off page at its corner, and the next three events, the soonest in rose.
 * @model spec/app/calendarView.md
 * @design packages/design-system/design.md#glass
 */
export function HomeCalendarCard({ title = "Calendar", weekday, day, events, compact = false, size = "large", ...props }: HomeCalendarCardProps) {
  // Prototype markup line ~818 and `homeCards()`: the rows start 120px down, 14px apart, and keep to 12px above the
  // card's bottom; `.home.cmp .lc[data-app="Calendar"]` (lines 399–400): an 84px page and a 26/32px title.
  return (
    <LauncherCard
      title={title}
      size={size}
      titleClassName={compact ? "text-title-sm leading-8" : undefined}
      art={<CalendarIcon weekday={weekday} day={day} size={compact ? 84 : 120} aria-hidden />}
      {...props}
    >
      <LauncherRows className="-mb-3 gap-y-3.5 pt-1">
        {events.slice(0, 3).map(({ id, ...event }) => (
          <HomeEventRow key={id} {...event} />
        ))}
      </LauncherRows>
    </LauncherCard>
  );
}

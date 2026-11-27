import { Fragment, type ReactNode } from "react";
import { Check, Plus, TriangleAlert } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Alert } from "./Alert.tsx";
import { AppWindow, type AppWindowProps } from "./AppWindow.tsx";
import { Button, press } from "./Button.tsx";
import { CalendarEventDetail, type CalendarEventDetailProps } from "./CalendarEventDetail.tsx";
import { CalendarEventForm, type CalendarEventFormProps } from "./CalendarEventForm.tsx";
import { CalendarGlyph } from "./CalendarIcon.tsx";
import { CalendarEventRow, type CalendarEventRowProps } from "./CalendarEventRow.tsx";
import { CalendarMonth, type CalendarMonthProps } from "./CalendarMonth.tsx";
import { CalendarNav, type CalendarMode, type CalendarNavProps } from "./CalendarNav.tsx";
import { CalendarWeekStrip, type CalendarWeekStripProps } from "./CalendarWeekStrip.tsx";
import { guided, type Guide } from "./GuideAnchor.tsx";
import { PageHeading, PageText } from "./PageHeading.tsx";

export type CalendarEventItem = Omit<CalendarEventRowProps, "onClick"> & {
  id: string;
};

export type CalendarAppProps = Omit<AppWindowProps, "title" | "icon" | "actions" | "backLabel" | "onBack" | "nav" | "children"> & {
  /** What the window shows: the week or month, one event, or the form. */
  view: CalendarMode | "detail" | "form";
  /** The app's name, and where Back goes from an event or the form. */
  title?: string;
  /** A notice above the week or month, such as the dark banner asking her to connect her email's calendar. */
  banner?: ReactNode;
  /** The browsing views' ‹ period › row and its Week and Month choice. */
  nav: Omit<CalendarNavProps, "mode">;
  /** The week's days, in the week view. */
  week: CalendarWeekStripProps["days"];
  /** The month's grid, in the month view. */
  month: Pick<CalendarMonthProps, "weekdays" | "days">;
  /** Called with the key of the day a person taps, in the week or the month. */
  onSelectDay?: (key: string) => void;
  /** The chosen day, said relative to today: "Today", "Tuesday". */
  dayHeading: string;
  /** The chosen day's events, in the week view. */
  dayEvents: CalendarEventItem[];
  /** What the chosen day says when it has none. */
  emptyLabel?: string;
  /** The events of the next two weeks, in the week view. */
  upcoming: CalendarEventItem[];
  upcomingHeading?: string;
  /** Called with the id of the event a person opens; without it the rows are only read, as a draft's is. */
  onOpenEvent?: (id: string) => void;
  /** Goes back to today; without it Today is not offered. */
  onToday?: () => void;
  /** Opens the form for a new event; without it Add is shown but cannot be pressed. */
  onAdd?: () => void;
  /** The open event, in the detail view: its title and details. */
  event?: CalendarEventDetailProps & { title: string };
  /** The form, in the form view, with its heading: "New appointment", "Edit appointment". */
  form?: CalendarEventFormProps & { heading: string };
  /** The form can be saved: it has a title. */
  canSave?: boolean;
  /** Saves the form. */
  onSave?: () => void;
  /** The storage's answer to Save: still saving (the fields wait), or failed (the draft stays to try again). */
  saveStatus?: "saving" | "failed";
  /** What a failed save says above the form. */
  saveError?: ReactNode;
  /** Leaves the event or the form for the calendar. */
  onBack?: () => void;
  /** The words of the header's buttons. */
  labels?: { today: string; add: string; save: string };
  /** Grace pointing at an event of the day or of what is coming up, by its id (prototype `ev<id>`): `confirm` once she has added it. */
  guide?: Guide<string>;
};

const pill = { size: 22, strokeWidth: 2.2, "aria-hidden": true } as const;
const defaultLabels = { today: "Today", add: "Add", save: "Save" };

/**
 * The Calendar app's window: an optional banner over the week with the chosen day and what is coming up, the month, one event,
 * or the form (prototype `calView`, `calBanner`).
 * @model spec/app/calendarView.md
 * @design packages/design-system/design.md#windows
 * @design packages/design-system/design.md#screens
 */
export function CalendarApp({
  view,
  title = "Calendar",
  banner,
  nav,
  week,
  month,
  onSelectDay,
  dayHeading,
  dayEvents,
  emptyLabel = "Nothing planned",
  upcoming,
  upcomingHeading = "Coming up",
  onOpenEvent,
  onToday,
  onAdd,
  event,
  form,
  canSave = false,
  onSave,
  saveStatus,
  saveError = "This wasn’t saved. Press Save to try again.",
  onBack,
  labels = defaultLabels,
  guide,
  ...props
}: CalendarAppProps) {
  const rows = (items: CalendarEventItem[]) =>
    items.length > 0 && (
      <div className="flex flex-col gap-3">
        {items.map(({ id, ...item }) => (
          <Fragment key={id}>
            {guided(
              guide,
              id,
              <CalendarEventRow
                {...item}
                {...(onOpenEvent
                  ? {
                      className: guide?.targetId === id ? undefined : "[content-visibility:auto] [contain-intrinsic-size:auto_96px]",
                      onClick: () => onOpenEvent(id),
                    }
                  : {
                      "aria-disabled": true,
                      className: guide?.targetId === id ? "cursor-default active:scale-100" : "cursor-default active:scale-100 [content-visibility:auto] [contain-intrinsic-size:auto_96px]",
                    })}
              />,
              { radius: 22, placement: "below", className: "flex" },
            )}
          </Fragment>
        ))}
      </div>
    );

  if (view === "detail" && event) {
    const { title: eventTitle, ...detail } = event;
    return (
      <AppWindow title={eventTitle} backLabel={title} onBack={onBack} {...props}>
        <CalendarEventDetail {...detail} />
      </AppWindow>
    );
  }
  if (view === "form" && form) {
    const { heading, ...fields } = form;
    const saving = saveStatus === "saving";
    return (
      <AppWindow
        title={heading}
        backLabel={title}
        onBack={onBack}
        actions={
          <Button variant="prominent" size="compact" className="pr-[26px] pl-[22px] active:bg-primary disabled:text-primary-foreground [&>svg]:size-[22px] [&>svg]:text-primary-foreground" disabled={!canSave} loading={saving} onClick={onSave}>
            {!saving && <Check {...pill} />}
            {labels.save}
          </Button>
        }
        {...props}
      >
        {saveStatus === "failed" && (
          <Alert variant="caution" icon={<TriangleAlert size={26} strokeWidth={2.2} />} className="mb-[18px]">
            {saveError}
          </Alert>
        )}
        <CalendarEventForm disabled={saving} {...fields} />
      </AppWindow>
    );
  }
  const mode = view === "month" ? "month" : "week";
  return (
    <AppWindow
      title={title}
      icon={<CalendarGlyph name="calendar" size={26} strokeWidth={2} />}
      actions={
        <>
          {onToday && (
            <Button variant="plain" size="compact" className={cn(press, "text-grace-ink active:scale-97 active:bg-transparent")} onClick={onToday}>
              {labels.today}
            </Button>
          )}
          <Button variant="prominent" size="compact" className="pr-[26px] pl-[22px] active:bg-primary" disabled={!onAdd} onClick={onAdd}>
            <Plus {...pill} />
            {labels.add}
          </Button>
        </>
      }
      {...props}
    >
      {banner != null && <div className="mb-4">{banner}</div>}
      <CalendarNav mode={mode} className="mb-4" {...nav} />
      {mode === "month" ? (
        <CalendarMonth {...month} onSelect={onSelectDay} />
      ) : (
        <>
          <CalendarWeekStrip days={week} onSelect={onSelectDay} />
          <div className="mt-[26px] mb-3.5 flex items-baseline gap-3.5">
            <PageHeading level="title">{dayHeading}</PageHeading>
            {dayEvents.length === 0 && <PageText tone="secondary">{emptyLabel}</PageText>}
          </div>
          {rows(dayEvents)}
          {upcoming.length > 0 && (
            <>
              <PageHeading level="title" className="mt-6 mb-3.5">
                {upcomingHeading}
              </PageHeading>
              {rows(upcoming)}
            </>
          )}
        </>
      )}
    </AppWindow>
  );
}

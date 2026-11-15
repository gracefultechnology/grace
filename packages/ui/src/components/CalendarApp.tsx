import type { ReactNode } from "react";
import { Check, Plus, TriangleAlert } from "lucide-react";
import { Alert } from "./Alert.tsx";
import { AppWindow, type AppWindowProps } from "./AppWindow.tsx";
import { Button } from "./Button.tsx";
import { CalendarEventDetail, type CalendarEventDetailProps } from "./CalendarEventDetail.tsx";
import { CalendarEventForm, type CalendarEventFormProps } from "./CalendarEventForm.tsx";
import { CalendarGlyph } from "./CalendarIcon.tsx";
import { CalendarEventRow, type CalendarEventRowProps } from "./CalendarEventRow.tsx";
import { CalendarMonth, type CalendarMonthProps } from "./CalendarMonth.tsx";
import { CalendarNav, type CalendarMode, type CalendarNavProps } from "./CalendarNav.tsx";
import { CalendarWeekStrip, type CalendarWeekStripProps } from "./CalendarWeekStrip.tsx";
import { PageHeading, PageText } from "./PageHeading.tsx";

/** An event in a list, with the id `onOpenEvent` is called with. */
export type CalendarEventItem = Omit<CalendarEventRowProps, "onClick"> & {
  id: string;
};

export type CalendarAppProps = Omit<AppWindowProps, "title" | "icon" | "actions" | "backLabel" | "onBack" | "nav" | "headerMode" | "children"> & {
  /** What the window shows: the week or month, one event, or the form. */
  view: CalendarMode | "detail" | "form";
  /** The app's name, and where Back goes from an event or the form. */
  title?: string;
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
  /** Called with the id of the event a person opens. */
  onOpenEvent?: (id: string) => void;
  /** Goes back to today. */
  onToday?: () => void;
  /** Opens the form for a new event. */
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
};

const pill = { size: 22, strokeWidth: 2.2, "aria-hidden": true } as const;
const defaultLabels = { today: "Today", add: "Add", save: "Save" };

/**
 * The Calendar app's window: the week with the chosen day and what is coming up, the month, one event, or the form
 * (prototype `calView`).
 * @model spec/app/calendarView.md
 * @design packages/design-system/design.md#windows
 */
export function CalendarApp({
  view,
  title = "Calendar",
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
  ...props
}: CalendarAppProps) {
  const rows = (items: CalendarEventItem[]) =>
    items.length > 0 && (
      <div className="flex flex-col gap-3">
        {items.map(({ id, ...item }) => (
          <CalendarEventRow key={id} {...item} onClick={() => onOpenEvent?.(id)} />
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
          // Prototype `#ahdr .pill.prom` (line 673) keeps its indigo and white words while `aria-disabled`; its spinner is white on a filled surface (line 434), the check's size.
          <Button variant="prominent" size="compact" className="pr-[26px] pl-[22px] disabled:text-primary-foreground disabled:opacity-100 [&>svg]:size-[22px] [&>svg]:text-primary-foreground" disabled={!canSave} loading={saving} onClick={onSave}>
            {!saving && <Check {...pill} />}
            {labels.save}
          </Button>
        }
        {...props}
      >
        {/* Prototype `.a-caution`, as the Wi-Fi password's refusal shows it (line 2006). */}
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
          <Button variant="plain" size="compact" className="text-grace-ink" onClick={onToday}>
            {labels.today}
          </Button>
          <Button variant="prominent" size="compact" className="pr-[26px] pl-[22px]" onClick={onAdd}>
            <Plus {...pill} />
            {labels.add}
          </Button>
        </>
      }
      {...props}
    >
      <CalendarNav mode={mode} className="mb-4" {...nav} />
      {mode === "month" ? (
        <CalendarMonth {...month} onSelect={onSelectDay} />
      ) : (
        <>
          <CalendarWeekStrip days={week} onSelect={onSelectDay} />
          {/* Prototype: the day's heading at `margin:26px 0 14px`, "Coming up" at `24px 0 14px`. */}
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

import type { ReactNode } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { Banner, BannerButton } from "./Banner.tsx";
import type { CalendarAppProps, CalendarEventItem } from "./CalendarApp.tsx";
import type { CalendarEventDetailProps } from "./CalendarEventDetail.tsx";
import type { CalendarEventFormProps } from "./CalendarEventForm.tsx";
import { CalendarGlyph } from "./CalendarIcon.tsx";
import type { CalendarMonthDay } from "./CalendarMonth.tsx";
import type { CalendarWeekDay } from "./CalendarWeekStrip.tsx";
import { Rail } from "./Rail.tsx";
import { homeRail } from "./Rail.meta.tsx";
import { ScreenSlot, TabletScreen } from "./TabletScreen.tsx";

export const onTablet = (story: () => ReactNode) => (
  <TabletScreen>
    <Rail {...homeRail(null)} />
    <ScreenSlot>{story()}</ScreenSlot>
  </TabletScreen>
);

export const onWindow = (story: () => ReactNode) => <div className="w-[1082px] bg-background p-6">{story()}</div>;

export const doctor: CalendarEventItem = {
  id: "1",
  title: "Doctor’s appointment",
  dayLabel: "Sat",
  startLabel: "10 am",
  who: "Dr. Patel",
  where: "Main St clinic · 214 Main Street",
  important: true,
};
export const upcoming: CalendarEventItem[] = [
  doctor,
  {
    id: "2",
    title: "Lunch with Susan",
    dayLabel: "Mon",
    startLabel: "12 pm",
    where: "She’ll pick you up",
  },
  {
    id: "3",
    title: "Hair appointment",
    dayLabel: "Wed",
    startLabel: "3 pm",
    where: "Linda’s salon",
  },
];
const tags = ["Gmail", "Gmail", "On this tablet"];
export const taggedUpcoming: CalendarEventItem[] = upcoming.map((item, i) => ({ ...item, tag: tags[i] }));
const connect = fn();
const notNow = fn();
export const connectBanner = (
  <Banner
    tone="dark"
    icon={<CalendarGlyph name="calendar" size={26} strokeWidth={2} />}
    title="Connect your email to keep your calendar up to date"
    line="Appointments from your email show up here automatically."
    actions={<BannerButton onClick={connect}>Connect email</BannerButton>}
    onDismiss={notNow}
  />
);
export const bridgeDraft: CalendarEventItem = {
  id: "9",
  title: "Bridge club",
  dayLabel: "Today",
  startLabel: "2 pm",
  draft: true,
};

export const week: CalendarWeekDay[] = [
  ["Mon", "9"],
  ["Tue", "10"],
  ["Wed", "11"],
  ["Thu", "12"],
  ["Today", "13"],
  ["Sat", "14"],
  ["Sun", "15"],
].map(([weekday, day]) => ({
  key: `2026-11-${day.padStart(2, "0")}`,
  weekday,
  day,
  month: "November",
  today: day === "13",
  selected: day === "13",
  busy: day === "14",
}));

const monthEvents: Record<string, [string, boolean?]> = {
  "14": ["Doctor", true],
  "16": ["Lunch with Susan"],
  "18": ["Hair"],
};
export const monthDays: CalendarMonthDay[] = Array.from({ length: 35 }, (_, i) => {
  const outside = i < 6;
  const day = String(outside ? 26 + i : i - 5);
  const [event, important] = outside ? [] : (monthEvents[day] ?? []);
  return {
    key: outside ? `2026-10-${day}` : `2026-11-${day.padStart(2, "0")}`,
    day,
    month: outside ? "October" : "November",
    outside,
    today: !outside && day === "13",
    selected: !outside && day === "13",
    event,
    important,
  };
});
export const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const detail: CalendarEventDetailProps & { title: string } = {
  title: "Doctor’s appointment",
  when: "Saturday, November 14 · 10 am to 11 am",
  where: "Main St clinic · 214 Main Street",
  who: "Dr. Patel",
  reminder: "Reminder day before",
  repeat: "Doesn’t repeat",
  note: "From the clinic’s email · Visit form attached",
  onEdit: fn(),
  onDelete: fn(),
};

const times = Array.from({ length: 25 }, (_, i) => {
  const m = 420 + i * 30;
  const h = Math.floor(m / 60);
  return {
    value: String(m),
    label: `${((h + 11) % 12) + 1}${m % 60 ? ":30" : ""} ${h < 12 ? "am" : "pm"}`,
  };
});
const days = [
  "Today · Nov 13",
  "Tomorrow · Nov 14",
  "Sunday · Nov 15",
  "Monday · Nov 16",
  "Tuesday · Nov 17",
  "Wednesday · Nov 18",
  "Thursday · Nov 19",
  "Friday, November 20",
  "Saturday, November 21",
  "Sunday, November 22",
  "Monday, November 23",
  "Tuesday, November 24",
  "Wednesday, November 25",
  "Thursday, November 26",
  "Friday, November 27",
  "Saturday, November 28",
  "Sunday, November 29",
  "Monday, November 30",
  "Tuesday, December 1",
  "Wednesday, December 2",
  "Thursday, December 3",
].map((label, i) => ({ value: String(13 + i), label }));

export const form: CalendarEventFormProps & { heading: string } = {
  heading: "New appointment",
  title: "",
  where: "",
  day: {
    value: "Friday, November 13",
    choices: days,
    selected: "13",
    open: false,
  },
  time: {
    value: "10 am to 11 am",
    choices: times,
    selected: "600",
    open: false,
  },
  repeat: { options: ["Never", "Every week", "Every month"], value: "Never" },
  remind: {
    options: ["No", "Day before", "1 hour before"],
    value: "1 hour before",
  },
};

const openEvent = fn();
const onMode = fn();
const save = fn();
const previous = fn();
const snooze = fn();
const step = { onModeChange: onMode, onPrevious: previous, onNext: fn() };
const lunch = { ...form, title: "Lunch", time: { ...form.time, value: "12 pm to 1 pm", selected: "720" }, remind: { ...form.remind, value: "No" } };

export const meta: ComponentMeta<CalendarAppProps> = {
  args: {
    view: "week",
    nav: { period: "November 9 – 15", ...step },
    week,
    month: { weekdays, days: monthDays },
    dayHeading: "Today",
    dayEvents: [],
    upcoming,
    onOpenEvent: openEvent,
    onToday: fn(),
    onAdd: fn(),
    event: detail,
    form,
    onClose: fn(),
  },
  examples: {
    Month: { view: "month", nav: { period: "November 2026", ...step } },
    "Grace points at an appointment": {
      upcoming: taggedUpcoming,
      guide: { targetId: doctor.id, kind: "instruction", title: "Tap Doctor’s appointment", onClose: fn() },
    },
    "With connect banner": { banner: connectBanner },
    "Detail, reminder showing": { view: "detail", event: { ...detail, onDismissReminder: fn(), onSnoozeReminder: snooze } },
    Form: { view: "form" },
    "Form, picking a time": {
      view: "form",
      form: {
        ...form,
        title: "Bridge club",
        time: { ...form.time, open: true },
      },
      canSave: true,
    },
    "Form, saving": { view: "form", form: lunch, canSave: true, saveStatus: "saving" },
    "Form, save failed": { view: "form", form: lunch, canSave: true, saveStatus: "failed", onSave: save },
    "With a draft": {
      dayEvents: [bridgeDraft],
      week: week.map((d) => (d.today ? { ...d, busy: true } : d)),
    },
    "Opening refused": {
      nav: { period: "November 9 – 15" },
      onSelectDay: undefined,
      onOpenEvent: undefined,
      onToday: undefined,
      onAdd: undefined,
    },
    "Added By Margaret": {
      dayEvents: [{ ...bridgeDraft, draft: false }],
      week: week.map((d) => (d.today ? { ...d, busy: true } : d)),
      guide: { targetId: bridgeDraft.id, kind: "confirm" },
    },
  },
  decorator: onTablet,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole("button", { name: /Doctor’s appointment/ }));
      await expect(openEvent).toHaveBeenCalledWith("1");
      await userEvent.click(canvas.getByRole("button", { name: "Previous week" }));
      await expect(previous).toHaveBeenCalled();
      await userEvent.click(canvas.getByRole("radio", { name: "Month" }));
      await expect(onMode).toHaveBeenCalledWith("month");
    },
    "Opening refused": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      for (const { title } of upcoming) await expect(canvas.getByRole("button", { name: new RegExp(title) })).toHaveAttribute("aria-disabled", "true");
      await expect(canvas.queryByRole("button", { name: /^Sat\s*14/ })).toBeNull();
      await expect(canvas.queryByRole("button", { name: "Previous week" })).toBeNull();
      await expect(canvas.queryByRole("button", { name: "Next week" })).toBeNull();
      await expect(canvas.queryByRole("radio", { name: "Month" })).toBeNull();
      await expect(canvas.queryByRole("button", { name: "Today" })).toBeNull();
      await expect(canvas.getByRole("button", { name: "Add" })).toBeDisabled();
    },
    "Grace points at an appointment": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await waitFor(() => expect(canvas.getByText("Tap Doctor’s appointment")).toBeVisible());
      await expect(canvas.getByRole("button", { name: /Doctor’s appointment/ })).toHaveTextContent("Gmail");
    },
    "Detail, reminder showing": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole("button", { name: "Snooze" }));
      await expect(snooze).toHaveBeenCalled();
      await expect(canvas.getByRole("button", { name: "Dismiss" })).toBeEnabled();
      await expect(canvas.getByRole("button", { name: "Edit" })).toBeEnabled();
    },
    "With connect banner": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole("button", { name: "Connect email" }));
      await expect(connect).toHaveBeenCalled();
      await userEvent.click(canvas.getByRole("button", { name: "Not now" }));
      await expect(notNow).toHaveBeenCalled();
    },
    "Form, saving": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await expect(canvas.getByLabelText("What")).toBeDisabled();
      await expect(canvas.getByRole("button", { name: "Change Day" })).toBeDisabled();
      await expect(canvas.getByRole("radio", { name: "Every week" })).toBeDisabled();
      await expect(canvas.getByRole("button", { name: /Save/ })).toBeDisabled();
    },
    "Form, save failed": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await expect(canvas.getByRole("alert")).toHaveTextContent("This wasn’t saved");
      await expect(canvas.getByLabelText("What")).toHaveValue("Lunch");
      await userEvent.click(canvas.getByRole("button", { name: "Save" }));
      await expect(save).toHaveBeenCalled();
    },
  },
};

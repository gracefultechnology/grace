import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { HomeCalendarCardProps } from "./HomeCalendarCard.tsx";

export const calendar: HomeCalendarCardProps = {
  status: "Nothing else today",
  weekday: "FRI",
  day: 13,
  events: [
    { id: 1, weekday: "SAT", time: "10 am", title: "Doctor’s appointment", detail: "Dr. Patel · Main St clinic", next: true },
    { id: 2, weekday: "MON", time: "12 pm", title: "Lunch with Susan", detail: "She’ll pick you up" },
    { id: 3, weekday: "WED", time: "3 pm", title: "Hair appointment", detail: "Linda’s salon" },
  ],
};

const openCalendar = fn();
const openEvent = fn();

export const calendarEmpty: HomeCalendarCardProps = { ...calendar, status: "Nothing planned", events: [], hint: "Ask Grace to add an appointment." };

export const meta: ComponentMeta<HomeCalendarCardProps> = {
  args: { ...calendar, className: "h-[560px] w-[480px]" },
  examples: {
    Compact: { compact: true, className: "h-[402px] w-[334px]" },
    Today: { ...calendar, status: "Today", events: [{ id: 4, weekday: "TODAY", time: "4 pm", title: "Call with Dana", next: true }, ...calendar.events.slice(1)] },
    "Events open": { ...calendar, className: "h-[560px] w-[480px]", onClick: openCalendar, events: calendar.events.map((e) => ({ ...e, onClick: openEvent })) },
  },
  states: { Empty: { ...calendarEmpty, className: "h-[560px] w-[480px]" } },
  decorator: (story) => <div className="bg-gradient-frame-soft p-12">{story()}</div>,
  play: {
    "Events open": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole("button", { name: /Lunch with Susan/ }));
      await expect(openEvent).toHaveBeenCalledTimes(1);
      await expect(openCalendar).not.toHaveBeenCalled();
      await userEvent.click(canvas.getByText("Calendar", { exact: true }));
      await expect(openCalendar).toHaveBeenCalledTimes(1);
      await userEvent.tab();
      await expect(canvas.getByRole("button", { name: /Doctor’s appointment/ })).toHaveFocus();
      await userEvent.keyboard("{Enter}");
      await expect(openEvent).toHaveBeenCalledTimes(2);
      await expect(openCalendar).toHaveBeenCalledTimes(1);
      canvas.getByRole("button", { name: /Doctor’s appointment/ }).blur();
    },
  },
};

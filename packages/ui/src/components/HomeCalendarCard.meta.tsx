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

export const meta: ComponentMeta<HomeCalendarCardProps> = {
  args: { ...calendar, className: "h-[560px] w-[480px]" },
  examples: {
    Compact: { compact: true, className: "h-[402px] w-[334px]" },
    Today: { ...calendar, status: "Today", events: [{ id: 4, weekday: "TODAY", time: "4 pm", title: "Call with Dana", next: true }, ...calendar.events.slice(1)] },
  },
  states: { Empty: { ...calendar, className: "h-[560px] w-[480px]", events: [] } },
  decorator: (story) => <div className="bg-gradient-frame-soft p-12">{story()}</div>,
};

import type { ComponentMeta } from "vibestack/stories";
import type { HomeCalendarCardProps } from "./HomeCalendarCard.tsx";

// Prototype `homeCards()` on Friday, November 13: the next three events, the doctor's in rose.
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
  // 480×560 as on Home.
  args: { ...calendar, className: "h-[560px] w-[480px]" },
  examples: {
    // Prototype `.home.cmp`: a 334px column, as tall as the grid above Grace's compact window (402px).
    Compact: { compact: true, className: "h-[402px] w-[334px]" },
    Today: { ...calendar, status: "Today", events: [{ id: 4, weekday: "TODAY", time: "4 pm", title: "Call with Dana", next: true }, ...calendar.events.slice(1)] },
  },
  states: { Empty: { ...calendar, className: "h-[560px] w-[480px]", events: [] } },
  // The card's glass needs Home's wash behind it, with room for the page over its corner.
  decorator: (story) => <div className="bg-gradient-frame-soft p-12">{story()}</div>,
};

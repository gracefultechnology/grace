import type { ComponentMeta } from "vibestack/stories";
import type { HomeEventRowProps } from "./HomeEventRow.tsx";

export const meta: ComponentMeta<HomeEventRowProps> = {
  // Prototype `homeCards()`: the doctor's appointment, the next event.
  args: { weekday: "SAT", time: "10 am", title: "Doctor’s appointment", detail: "Dr. Patel · Main St clinic", next: true },
  examples: {
    Later: { weekday: "MON", time: "12 pm", title: "Lunch with Susan", detail: "She’ll pick you up" },
  },
  decorator: (story) => <div className="w-[480px] bg-gradient-frame-soft p-6">{story()}</div>,
};

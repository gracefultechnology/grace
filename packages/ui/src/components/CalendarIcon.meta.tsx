import type { ComponentMeta } from "vibestack/stories";
import type { CalendarIconProps } from "./CalendarIcon.tsx";

export const meta: ComponentMeta<CalendarIconProps> = {
  args: { weekday: "FRI", day: 13 },
  decorator: (story) => <div className="p-12">{story()}</div>,
};

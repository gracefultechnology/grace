import { CalendarCheck, CircleX, Clock, Pause } from "lucide-react";
import type { ComponentMeta } from "vibestack/stories";
import type { StatusTagProps } from "./StatusTag.tsx";

export const meta: ComponentMeta<StatusTagProps> = {
  args: { icon: CalendarCheck, tone: "ok", children: "Booked for Dec 7" },
  examples: {
    Waiting: { icon: Clock, tone: "warn", children: "Waiting for Main St Clinic to confirm" },
    Paused: { icon: Pause, tone: "accent", children: "Paused" },
    Failed: { icon: CircleX, tone: "caution", children: "Didn’t go through" },
  },
  decorator: (story) => <div className="group/grace bg-background p-6">{story()}</div>,
};

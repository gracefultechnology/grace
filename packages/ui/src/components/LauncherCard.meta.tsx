import type { ComponentMeta } from "vibestack/stories";
import { CalendarIcon } from "./CalendarIcon.tsx";
import type { LauncherCardProps } from "./LauncherCard.tsx";

export const meta: ComponentMeta<LauncherCardProps> = {
  // Prototype `.lc`: the Calendar card's glass, title, status and tear-off page, before its rows.
  args: { title: "Calendar", status: "Nothing else today", art: <CalendarIcon weekday="FRI" day={13} aria-hidden />, children: undefined },
  examples: {
    Medium: { title: "Email", status: "2 new", size: "medium" },
    // Rolling off the right edge of Home's first page, as the Files card does (prototype `hmLayers`).
    Turned: { title: "Calendar", status: "Nothing else today", turn: 0.65 },
  },
  bounds: { turn: [-1, 1] },
  decorator: (story) => (
    <div className="bg-gradient-frame-soft p-12">
      <div className="h-[300px] w-[480px] *:size-full">{story()}</div>
    </div>
  ),
};

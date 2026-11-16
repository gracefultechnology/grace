import type { ComponentMeta } from "vibestack/stories";
import type { SleepScreenProps } from "./SleepScreen.tsx";
import { TabletScreen } from "./TabletScreen.tsx";

export const meta: ComponentMeta<SleepScreenProps> = {
  args: { time: "8:57", date: "Friday, November 13", next: "Tomorrow: Doctor’s appointment, 10 am", hint: "Touch the screen to wake it" },
  examples: {
    "Nothing next": { next: undefined },
  },
  decorator: (story) => <TabletScreen>{story()}</TabletScreen>,
};

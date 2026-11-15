import type { ComponentMeta } from "vibestack/stories";
import type { SleepScreenProps } from "./SleepScreen.tsx";
import { TabletScreen } from "./TabletScreen.tsx";

// Prototype `drawSleep()` at 8:57 PM on Friday, November 13.
export const meta: ComponentMeta<SleepScreenProps> = {
  args: { time: "8:57", date: "Friday, November 13", next: "Tomorrow: Doctor’s appointment, 10 am", hint: "Say “Hey Grace”, or touch the screen" },
  examples: {
    "Wake word off": { hint: "Touch the screen to wake it" },
    "Nothing next": { next: undefined },
  },
  decorator: (story) => <TabletScreen>{story()}</TabletScreen>,
};

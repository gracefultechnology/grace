import type { ComponentMeta } from "vibestack/stories";
import type { HomeGreetingProps } from "./HomeGreeting.tsx";

export const meta: ComponentMeta<HomeGreetingProps> = {
  args: { greeting: "Good evening", name: "Margaret", line: "Here’s your day" },
  examples: {
    Morning: { greeting: "Good morning", name: "Margaret", line: "Here’s your day" },
    Compact: { greeting: "Good evening", name: "Margaret", line: "Here’s your day", compact: true },
  },
  decorator: (story) => <div className="bg-gradient-frame-soft p-10">{story()}</div>,
};

import { fn } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { onTablet } from "./CalendarApp.meta.tsx";
import { TaskCard } from "./TaskCard.tsx";
import type { TasksScreenProps } from "./TasksScreen.tsx";

const groups = [
  {
    id: "waiting",
    title: "Waiting on you",
    cards: (
      <>
        <TaskCard status="paused" when="Today, 10:42" title="Pay the water bill" line="Waiting for you to check the amount." onResume={fn()} onStop={fn()} />
        <TaskCard status="waiting" when="Today, 9:15" title="Book the eye appointment" line="Grace is waiting for the clinic to reply." onAsk={fn()} onStop={fn()} />
      </>
    ),
  },
  {
    id: "done",
    title: "Finished",
    cards: <TaskCard status="done" when="Yesterday" title="Pay the phone bill" line="Paid $42.10 to Coast Mobile." onAsk={fn()} onRemove={fn()} />,
  },
];

export const meta: ComponentMeta<TasksScreenProps> = {
  args: { groups, onClose: fn() },
  decorator: onTablet,
  examples: {
    Empty: { groups: [], emptyText: "When Grace starts something for you, it shows here." },
  },
};

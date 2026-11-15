import { fn } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { TaskCardProps } from "./TaskCard.tsx";

// The original app's task list (senior-care apps/app/src/TasksScreen.tsx): one card per task Grace started.
const actions = { onResume: fn(), onAsk: fn(), onStop: fn(), onConfirmStop: fn(), onKeep: fn(), onRemove: fn(), onConfirmRemove: fn() };

export const meta: ComponentMeta<TaskCardProps> = {
  args: { status: "paused", when: "Today, 10:42", title: "Pay the water bill", line: "Waiting for you to check the amount.", ...actions },
  examples: {
    Waiting: { status: "waiting", line: "Grace is waiting for the code the bank sent you." },
    Done: { status: "done", when: "Yesterday", line: "Paid $42.10 to City Water." },
    "Stop this task?": { asking: "stop" },
    Stopping: { asking: "stop", stopping: true },
    "Remove from list?": { status: "done", when: "Yesterday", line: "Paid $42.10 to City Water.", asking: "remove" },
    "Resume blocked": { resumeBlocked: true },
    Checking: { pending: true },
    Ended: { ended: true },
  },
};

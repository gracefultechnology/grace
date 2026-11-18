import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { TaskCardProps } from "./TaskCard.tsx";

const actions = { onResume: fn(), onAsk: fn(), onStop: fn(), onConfirmStop: fn(), onKeep: fn(), onRemove: fn(), onConfirmRemove: fn() };
type Action = keyof typeof actions;

const card = (canvasElement: HTMLElement) => {
  for (const spy of Object.values(actions)) spy.mockClear();
  const canvas = within(canvasElement);
  const button = (name: string) => canvas.getByRole<HTMLButtonElement>("button", { name });
  const press = async (name: string, action: Action) => {
    await userEvent.click(button(name));
    await expect(actions[action]).toHaveBeenCalledTimes(1);
  };
  const refused = (...names: string[]) => expect(names.map((name) => button(name).disabled)).toEqual(names.map(() => true));
  return { canvas, button, press, refused };
};

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
    Booking: { status: "waiting", title: "Book the follow-up with Dr. Patel", line: "Waiting for Main St Clinic to confirm Monday at 2." },
  },
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const { press } = card(canvasElement);
      await press("Resume", "onResume");
      await press("Stop this task", "onStop");
    },
    Waiting: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const { canvas, press } = card(canvasElement);
      await press("Ask Grace", "onAsk");
      await expect(canvas.queryByRole("button", { name: "Resume" })).toBeNull();
    },
    Done: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const { canvas, press } = card(canvasElement);
      await press("Remove from list", "onRemove");
      await expect(canvas.queryByRole("button", { name: "Stop this task" })).toBeNull();
    },
    "Stop this task?": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const { canvas, press } = card(canvasElement);
      await expect(canvas.getByText(/^Stop this task\?/)).toHaveFocus();
      await press("Yes, stop it", "onConfirmStop");
      await press("Keep it", "onKeep");
    },
    Stopping: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const { canvas, refused } = card(canvasElement);
      await refused("Yes, stop it", "Keep it");
      await expect(canvas.getByRole("article").getAttribute("aria-busy")).toBe("true");
    },
    "Remove from list?": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const { canvas, press } = card(canvasElement);
      await expect(canvas.getByText("Remove this task from the list?")).toHaveFocus();
      await press("Yes, remove it", "onConfirmRemove");
    },
    "Resume blocked": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const { press, refused } = card(canvasElement);
      await refused("Resume");
      await press("Stop this task", "onStop");
    },
    Checking: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const { canvas, refused } = card(canvasElement);
      await refused("Resume", "Stop this task");
      await expect(canvas.getByRole("article").getAttribute("aria-busy")).toBe("true");
    },
    Ended: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const { press, refused } = card(canvasElement);
      await refused("Stop this task");
      await press("Resume", "onResume");
    },
  },
};

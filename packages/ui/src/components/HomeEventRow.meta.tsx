import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { HomeEventRowProps } from "./HomeEventRow.tsx";

const open = fn();

export const meta: ComponentMeta<HomeEventRowProps> = {
  args: { weekday: "SAT", time: "10 am", title: "Doctor’s appointment", detail: "Dr. Patel · Main St clinic", next: true },
  examples: {
    Later: { weekday: "MON", time: "12 pm", title: "Lunch with Susan", detail: "She’ll pick you up" },
    Opens: { onClick: open },
  },
  decorator: (story) => <div className="w-[480px] bg-gradient-frame-soft p-6">{story()}</div>,
  play: {
    Opens: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const row = within(canvasElement).getByRole("button", { name: /Doctor’s appointment/ });
      await userEvent.click(row);
      await expect(open).toHaveBeenCalled();
      row.blur();
    },
  },
};

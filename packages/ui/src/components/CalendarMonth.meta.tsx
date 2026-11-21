import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { monthDays, onWindow, weekdays } from "./CalendarApp.meta.tsx";
import type { CalendarMonthProps } from "./CalendarMonth.tsx";

export const meta: ComponentMeta<CalendarMonthProps> = {
  args: { weekdays, days: monthDays, onSelect: fn() },
  decorator: onWindow,
  examples: {
    "Another Day Chosen": { days: monthDays.map((d) => ({ ...d, selected: !d.outside && d.day === "16" })) },
    "Choosing refused": { onSelect: undefined },
  },
  play: {
    Default: async ({ args, canvasElement }: { args: CalendarMonthProps; canvasElement: HTMLElement }) => {
      await userEvent.click(
        within(canvasElement).getByRole("button", {
          name: /^November\s*16\s*Lunch with Susan$/,
        }),
      );
      await expect(args.onSelect).toHaveBeenCalledWith("2026-11-16");
    },
    "Choosing refused": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await expect(canvas.getByText("Lunch with Susan")).toBeVisible();
      await expect(canvas.queryByRole("button")).toBeNull();
    },
  },
};

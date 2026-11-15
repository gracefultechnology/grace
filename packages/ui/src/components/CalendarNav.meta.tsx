import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { onWindow } from "./CalendarApp.meta.tsx";
import type { CalendarNavProps } from "./CalendarNav.tsx";

export const meta: ComponentMeta<CalendarNavProps> = {
  args: {
    period: "November 9 – 15",
    mode: "week",
    onPrevious: fn(),
    onNext: fn(),
    onModeChange: fn(),
  },
  examples: { Month: { period: "November 2026", mode: "month" } },
  decorator: onWindow,
  play: {
    Default: async ({ args, canvasElement }: { args: CalendarNavProps; canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole("button", { name: "Next week" }));
      await expect(args.onNext).toHaveBeenCalled();
      await userEvent.click(canvas.getByRole("radio", { name: "Month" }));
      await expect(args.onModeChange).toHaveBeenCalledWith("month");
    },
  },
};

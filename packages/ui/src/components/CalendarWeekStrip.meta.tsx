import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { onWindow, week } from "./CalendarApp.meta.tsx";
import type { CalendarWeekStripProps } from "./CalendarWeekStrip.tsx";

export const meta: ComponentMeta<CalendarWeekStripProps> = {
  args: { days: week, onSelect: fn() },
  examples: {
    "Another day chosen": {
      days: week.map((d) => ({ ...d, selected: d.day === "14" })),
    },
  },
  decorator: onWindow,
  play: {
    Default: async ({ args, canvasElement }: { args: CalendarWeekStripProps; canvasElement: HTMLElement }) => {
      await userEvent.click(
        within(canvasElement).getByRole("button", {
          name: /^Sat\s*14\s*November, has plans$/,
        }),
      );
      await expect(args.onSelect).toHaveBeenCalledWith("2026-11-14");
    },
  },
};

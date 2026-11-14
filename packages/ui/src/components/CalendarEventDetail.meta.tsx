import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { detail, onWindow } from "./CalendarApp.meta.tsx";
import type { CalendarEventDetailProps } from "./CalendarEventDetail.tsx";

const { title: _title, ...doctor } = detail;

export const meta: ComponentMeta<CalendarEventDetailProps> = {
  args: { ...doctor, onEdit: fn(), onDelete: fn() },
  examples: {
    "Without a note": {
      ...doctor,
      who: undefined,
      note: undefined,
      where: "She’ll pick you up",
      when: "Monday, November 16 · 12 pm to 1:30 pm",
      reminder: "Reminder 1 hour before",
    },
  },
  decorator: onWindow,
  play: {
    Default: async ({ args, canvasElement }: { args: CalendarEventDetailProps; canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Delete" }));
      await expect(args.onDelete).toHaveBeenCalled();
    },
  },
};

import { expect, fn, screen, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { form, onWindow } from "./CalendarApp.meta.tsx";
import type { CalendarEventFormProps } from "./CalendarEventForm.tsx";

const { heading: _heading, ...fields } = form;
const pick = fn();

export const meta: ComponentMeta<CalendarEventFormProps> = {
  args: {
    ...fields,
    onTitleChange: fn(),
    repeat: { ...fields.repeat, onChange: fn() },
  },
  examples: {
    "Picking a day": {
      ...fields,
      title: "Bridge club",
      day: { ...fields.day, open: true, onPick: pick },
    },
    "Picking a time": {
      ...fields,
      title: "Bridge club",
      time: { ...fields.time, open: true },
    },
  },
  decorator: onWindow,
  play: {
    Default: async ({ args, canvasElement }: { args: CalendarEventFormProps; canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await userEvent.type(canvas.getByLabelText("What"), "B");
      await expect(args.onTitleChange).toHaveBeenCalledWith("B");
      await userEvent.click(canvas.getByRole("radio", { name: "Every week" }));
      await expect(args.repeat.onChange).toHaveBeenCalledWith("Every week");
    },
    "Picking a day": async () => {
      await userEvent.click(await screen.findByRole("button", { name: "Tomorrow · Nov 14" }));
      await expect(pick).toHaveBeenCalledWith("14");
    },
  },
};

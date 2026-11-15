import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { bridgeDraft, doctor, onWindow, upcoming } from "./CalendarApp.meta.tsx";
import type { CalendarEventRowProps } from "./CalendarEventRow.tsx";

const { id: _doctor, ...important } = doctor;
const { id: _lunch, ...lunch } = upcoming[1];
const { id: _bridge, ...draft } = bridgeDraft;

export const meta: ComponentMeta<CalendarEventRowProps> = {
  args: { ...important, onClick: fn() },
  examples: {
    Lunch: lunch,
    Draft: draft,
    Repeating: {
      ...lunch,
      title: "Bridge club",
      where: "Community hall",
      repeat: "Every week",
    },
  },
  decorator: onWindow,
  play: {
    Default: async ({ args, canvasElement }: { args: CalendarEventRowProps; canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: /Important/ }));
      await expect(args.onClick).toHaveBeenCalled();
    },
  },
};

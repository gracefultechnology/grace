import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { bridgeDraft, doctor, onWindow, upcoming } from "./CalendarApp.meta.tsx";
import type { CalendarEventRowProps } from "./CalendarEventRow.tsx";

const { id: _doctor, ...important } = doctor;
const { id: _lunch, ...lunch } = upcoming[1];
const { id: _hair, ...hair } = upcoming[2];
const { id: _bridge, ...draft } = bridgeDraft;
const openDraft = fn();

export const meta: ComponentMeta<CalendarEventRowProps> = {
  args: { ...important, onClick: fn() },
  examples: {
    Lunch: lunch,
    Draft: { ...draft, onClick: openDraft },
    Tagged: { ...important, tag: "Gmail" },
    "On this tablet": { ...hair, tag: "On this tablet" },
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
    Draft: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: /Bridge club/ }));
      await expect(openDraft).not.toHaveBeenCalled();
    },
  },
};

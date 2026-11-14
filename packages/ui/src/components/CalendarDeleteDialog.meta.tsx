import { expect, fn, screen, userEvent } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { CalendarDeleteDialogProps } from "./CalendarDeleteDialog.tsx";

export const meta: ComponentMeta<CalendarDeleteDialogProps> = {
  // Prototype `calDlg` for the doctor's appointment, which does not repeat.
  args: {
    open: true,
    title: "Delete Doctor’s appointment?",
    description: "Saturday, November 14 at 10 am.",
    onDelete: fn(),
    onKeep: fn(),
  },
  examples: {
    Repeating: {
      title: "Delete Bridge club?",
      description: "It repeats every week.",
      repeating: true,
    },
  },
  play: {
    Repeating: async ({ args }: { args: CalendarDeleteDialogProps }) => {
      await userEvent.click(await screen.findByRole("button", { name: "Delete only this one" }));
      await expect(args.onDelete).toHaveBeenCalledWith("occurrence");
    },
  },
};

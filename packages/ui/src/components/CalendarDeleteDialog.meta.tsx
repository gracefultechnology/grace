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
    // spec/app/calendar.md, "Deleting an occurrence requires confirmation and leaves payment records alone": a failed deletion asks again.
    "Delete failed": { error: "This wasn’t deleted. Choose again, or keep it." },
  },
  play: {
    Repeating: async ({ args }: { args: CalendarDeleteDialogProps }) => {
      await userEvent.click(await screen.findByRole("button", { name: "Delete only this one" }));
      await expect(args.onDelete).toHaveBeenCalledWith("occurrence");
    },
    "Delete failed": async ({ args }: { args: CalendarDeleteDialogProps }) => {
      await expect(await screen.findByRole("alert")).toHaveTextContent("This wasn’t deleted");
      await userEvent.click(screen.getByRole("button", { name: "Delete it" }));
      await expect(args.onDelete).toHaveBeenCalledWith("occurrence");
    },
  },
};

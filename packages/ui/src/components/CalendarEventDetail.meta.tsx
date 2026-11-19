import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { detail, onWindow } from "./CalendarApp.meta.tsx";
import type { CalendarEventDetailProps } from "./CalendarEventDetail.tsx";
import { waterBill } from "./BillOffer.meta.tsx";
import { PaymentStatusBadge } from "./PaymentStatusBadge.tsx";

const { title: _title, ...doctor } = detail;
const dismissReminder = fn();
const snoozeReminder = fn();

export const meta: ComponentMeta<CalendarEventDetailProps> = {
  args: { ...doctor, onEdit: fn(), onDelete: fn() },
  examples: {
    "Reminder showing": { ...doctor, onDismissReminder: dismissReminder, onSnoozeReminder: snoozeReminder },
    "Without a note": {
      ...doctor,
      who: undefined,
      note: undefined,
      where: "She’ll pick you up",
      when: "Monday, November 16 · 12 pm to 1:30 pm",
      reminder: "Reminder 1 hour before",
    },
    "Edit and Delete refused": { onEdit: undefined, onDelete: undefined },
    Bill: {
      ...doctor,
      who: undefined,
      where: undefined,
      when: "Saturday, November 28 · All day",
      reminder: "Reminder day before",
      note: "From City Water’s email",
      bill: { ...waterBill, status: <PaymentStatusBadge status="pending" />, onOpen: fn() },
    },
  },
  decorator: onWindow,
  play: {
    Default: async ({ args, canvasElement }: { args: CalendarEventDetailProps; canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Delete" }));
      await expect(args.onDelete).toHaveBeenCalled();
    },
    "Edit and Delete refused": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await expect(canvas.getByText("Saturday, November 14 · 10 am to 11 am")).toBeTruthy();
      await expect(canvas.queryByRole("button", { name: "Edit" })).toBeNull();
      await expect(canvas.queryByRole("button", { name: "Delete" })).toBeNull();
    },
    "Reminder showing": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole("button", { name: "Snooze" }));
      await expect(snoozeReminder).toHaveBeenCalled();
      await userEvent.click(canvas.getByRole("button", { name: "Dismiss" }));
      await expect(dismissReminder).toHaveBeenCalled();
    },
  },
};

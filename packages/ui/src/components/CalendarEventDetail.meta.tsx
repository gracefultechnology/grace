import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { detail, onWindow } from "./CalendarApp.meta.tsx";
import type { CalendarEventDetailProps } from "./CalendarEventDetail.tsx";
import { waterBill } from "./BillOffer.meta.tsx";
import { PaymentStatusBadge } from "./PaymentStatusBadge.tsx";

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
    // spec/app/handoffs.md, "Story: Return to the bill and see its actual result".
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
  },
};

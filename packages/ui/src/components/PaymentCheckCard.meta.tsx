import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { inGrace } from "./BillSummaryCard.meta.tsx";
import type { PaymentCheckCardProps } from "./PaymentCheckCard.tsx";

const check = fn();
const openSite = fn();
const retrySave = fn();

export const meta: ComponentMeta<PaymentCheckCardProps> = {
  args: { site: "chase.com", onCheck: check, onOpenSite: openSite, onRetrySave: undefined },
  examples: {
    "Save failed": { message: "Chase accepted the payment. Saving the record didn’t work.", onRetrySave: retrySave },
    Resolved: { title: "It went through", message: "Chase has your payment.", result: { status: "scheduled", date: "Nov 12", reference: "4F7K-22Q" } },
  },
  decorator: inGrace,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole("button", { name: "Check again" }));
      await userEvent.click(canvas.getByRole("button", { name: "Open chase.com" }));
      await expect([check.mock.calls.length > 0, openSite.mock.calls.length > 0]).toEqual([true, true]);
    },
    "Save failed": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await expect(canvas.getAllByRole("button").map((button) => button.textContent)).toEqual(["Try saving again"]);
      await userEvent.click(canvas.getByRole("button"));
      await expect(retrySave).toHaveBeenCalled();
    },
    Resolved: ({ canvasElement }: { canvasElement: HTMLElement }) => expect(within(canvasElement).queryAllByRole("button")).toEqual([]),
  },
};

import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { inGrace } from "./BillSummaryCard.meta.tsx";
import type { PaymentCheckCardProps } from "./PaymentCheckCard.tsx";

const check = fn();
const openSite = fn();
const retrySave = fn();

// Coming back to the prototype's Chase bill after its payment was submitted but no confirmation was seen.
export const meta: ComponentMeta<PaymentCheckCardProps> = {
  args: { site: "chase.com", onCheck: check, onOpenSite: openSite, onRetrySave: undefined },
  examples: {
    // Chase's result was seen but the record could not be saved: only saving again is offered, never paying again.
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

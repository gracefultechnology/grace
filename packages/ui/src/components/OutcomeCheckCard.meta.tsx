import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { billCheckLabels, bookingCheckLabels, type OutcomeCheckCardProps } from "./OutcomeCheckCard.tsx";
import { inGrace } from "./TaskFactsCard.meta.tsx";

const check = fn();
const openSite = fn();
const retrySave = fn();

export const meta: ComponentMeta<OutcomeCheckCardProps> = {
  args: { site: "chase.com", labels: billCheckLabels, onCheck: check, onOpenSite: openSite, onRetrySave: undefined },
  examples: {
    "Save failed": { message: "Chase accepted the payment. Saving the record didn’t work.", onRetrySave: retrySave },
    Resolved: { title: "It went through", message: "Chase has your payment.", result: { status: "scheduled", date: "Nov 12", reference: "4F7K-22Q" } },
    Booking: { site: "mainstclinic.org", labels: bookingCheckLabels },
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

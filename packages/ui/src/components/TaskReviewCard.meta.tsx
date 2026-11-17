import { expect, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { inGrace } from "./TaskFactsCard.meta.tsx";
import { billReviewLabels, bookingReviewLabels, type TaskReviewCardProps } from "./TaskReviewCard.tsx";

export const meta: ComponentMeta<TaskReviewCardProps> = {
  args: {
    who: "Chase",
    rows: [
      { label: "Amount", value: "$84.20" },
      { label: "Payment date", value: "Fri, Nov 13" },
      { label: "Pay from", value: "Checking ••4821" },
      { label: "Fee", value: "None" },
      { label: "Card", value: "Credit card ••7731" },
    ],
    labels: billReviewLabels,
  },
  examples: {
    Booking: {
      who: "Main St Clinic",
      labels: bookingReviewLabels,
      rows: [
        { label: "Visit", value: "Follow-up with Dr. Patel" },
        { label: "Time", value: "Mon, Dec 7, 2:00 PM" },
        { label: "Place", value: "Main St Clinic, 40 Main Street" },
        { label: "Shared", value: "Your name and phone number" },
        { label: "Price", value: "The website doesn’t show a price" },
      ],
    },
  },
  decorator: inGrace,
  play: {
    Stale: ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      return expect([canvas.getByRole("group").getAttribute("aria-busy"), canvas.getByRole("status").textContent]).toEqual(["true", "These details changed"]);
    },
  },
};

import { expect, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { inGrace } from "./BillSummaryCard.meta.tsx";
import type { PaymentReviewCardProps } from "./PaymentReviewCard.tsx";

export const meta: ComponentMeta<PaymentReviewCardProps> = {
  args: {
    company: "Chase",
    rows: [
      { label: "Amount", value: "$84.20" },
      { label: "Payment date", value: "Fri, Nov 13" },
      { label: "Pay from", value: "Checking ••4821" },
      { label: "Fee", value: "None" },
      { label: "Card", value: "Credit card ••7731" },
    ],
    note: "Nothing is paid until you say yes.",
  },
  decorator: inGrace,
  play: {
    Stale: ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      return expect([canvas.getByRole("group").getAttribute("aria-busy"), canvas.getByRole("status").textContent]).toEqual(["true", "These details changed"]);
    },
  },
};

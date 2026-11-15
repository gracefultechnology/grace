import type { ComponentMeta } from "vibestack/stories";
import type { AccountFactsProps } from "./AccountFacts.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

// The original app's invoice and estimate lines (senior-care AccountInvoices.tsx, PlanChange.tsx).
export const meta: ComponentMeta<AccountFactsProps> = {
  args: {
    facts: [
      { label: "Invoice number", value: "GR-2026-0114" },
      { label: "Issued", value: "Nov 1, 2026" },
      { label: "Invoice amount", value: "$25.00" },
      { label: "Amount paid", value: "$25.00" },
    ],
  },
  decorator: settingsPage,
  examples: {
    Estimate: {
      title: "Payment due now",
      total: true,
      facts: [
        { label: "Subtotal", value: "$12.50" },
        { label: "Discounts", value: "$0.00" },
        { label: "Tax", value: "$0.00" },
        { label: "Starting account balance", value: "$0.00" },
        { label: "Estimated payment", value: "$12.50" },
      ],
    },
    "With note": {
      title: "Automatic credit purchase: what you paid for",
      total: true,
      facts: [
        { label: "Credit added", value: "$20.00" },
        { label: "Service fee", value: "$1.00" },
        { label: "Handling fee", value: "$0.50" },
        { label: "Total charged", value: "$21.50" },
      ],
      note: "Fees are part of the charge, not additional credit.",
    },
  },
};

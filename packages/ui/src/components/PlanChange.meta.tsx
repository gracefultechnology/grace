import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { ConfirmIdentity } from "./ConfirmIdentity.tsx";
import type { PlanChangeProps, PlanChangeReview } from "./PlanChange.tsx";
import { gracePlans, sampleQr } from "./PlanChoice.meta.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

const renewal = [
  { label: "Subtotal", value: "$50.00" },
  { label: "Discounts", value: "$0.00" },
  { label: "Tax", value: "$0.00" },
  { label: "Starting account balance", value: "$0.00" },
  { label: "Estimated payment", value: "$50.00" },
];
const upgrade: PlanChangeReview = {
  plan: "Grace Pro",
  kind: "upgrade",
  baseRate: "$50.00",
  allowance: "Included help balance: $60.00 each paid period. It is not cash. Unused help ends with each billing period and does not carry over.",
  additionalAllowance: "Additional help balance for the rest of this paid period: $17.50, available only after the upgrade is confirmed.",
  date: "Dec 1, 2026",
  dueNow: [
    { label: "Subtotal", value: "$12.50" },
    { label: "Discounts", value: "$0.00" },
    { label: "Tax", value: "$0.00" },
    { label: "Starting account balance", value: "$0.00" },
    { label: "Estimated payment", value: "$12.50" },
  ],
  renewal,
};
const review = fn();

export const meta: ComponentMeta<PlanChangeProps> = {
  args: {
    view: "choose",
    current: { plan: "Grace Plus", periodEnd: "Dec 1, 2026" },
    plans: gracePlans.slice(1),
    onCheck: fn(),
    onReview: review,
    onKeep: fn(),
    onConfirm: fn(),
    onCheckPayment: fn(),
    onOpenPayment: fn(),
    onCheckMore: fn(),
  },
  decorator: settingsPage,
  examples: {
    Closed: { view: "idle" },
    Checking: { view: "loading" },
    "Confirm it’s you": { view: "verify", identity: <ConfirmIdentity step="start" purpose="changing your plan" /> },
    "Lower plan scheduled": { scheduled: "Grace Plus" },
    Upgrade: { view: "review", review: upgrade },
    "Lower plan": {
      view: "review",
      review: { plan: "Grace Plus", kind: "downgrade", baseRate: "$25.00", allowance: "Included help balance: $25.00 each paid period. Help balance terms are unavailable in this review.", date: "Dec 1, 2026", renewal },
    },
    Sending: { view: "sending" },
    Pending: { view: "pending", pending: [{ id: "cmd_1", plan: "Grace Pro", upgrade: true }], paymentDue: "$12.50", notice: "Review the amount below before opening the secure payment page." },
    "Pay on your phone": {
      view: "pending",
      pending: [{ id: "cmd_1", plan: "Grace Pro", upgrade: true }],
      paymentDue: "$12.50",
      phoneQr: sampleQr,
      notice: "This tablet couldn’t open the payment page. You can open it on your phone instead with the code below.",
    },
    "Result unknown": { view: "unknown", notice: "The result is not confirmed. Check your plan changes before trying anything else." },
  },
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Review Grace Pro" }));
      await expect(review).toHaveBeenCalledWith("grace_pro");
    },
  },
};

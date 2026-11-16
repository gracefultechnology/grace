import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { ConfirmIdentity } from "./ConfirmIdentity.tsx";
import type { GracePlan, PlanChoiceProps } from "./PlanChoice.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

export const gracePlans: GracePlan[] = [
  { key: "grace_plus", name: "Grace Plus", price: "$25.00", period: "a month", includes: "Includes $25.00 of help each month. It is not cash. Unused help ends with each billing period and does not carry over." },
  { key: "grace_pro", name: "Grace Pro", price: "$50.00", period: "a month", includes: "Includes $60.00 of help each month." },
];

const cells = Array.from({ length: 21 * 21 }, (_, index) => index).filter((index) => (index * 7 + (index % 21) * 3) % 5 < 2);
export const sampleQr = (
  <svg viewBox="0 0 21 21" className="text-foreground" aria-hidden>
    {cells.map((index) => (
      <rect key={index} x={index % 21} y={Math.floor(index / 21)} width="1" height="1" fill="currentColor" />
    ))}
  </svg>
);

const choose = fn();

export const meta: ComponentMeta<PlanChoiceProps> = {
  args: {
    view: "summary",
    plans: gracePlans,
    account: "margaret.s@example.com",
    onChoose: choose,
    onFamily: fn(),
    onOthers: fn(),
    onSummary: fn(),
    onPayHere: fn(),
    onCheckAgain: fn(),
    onSwitchAccount: fn(),
    onLater: fn(),
    onRetry: fn(),
  },
  decorator: settingsPage,
  examples: {
    "Loading plans": { view: "loading", plans: [] },
    "Plans failed": { view: "failed", plans: [] },
    "Card form": { view: "pay", checkout: <div className="h-[320px] rounded-tile bg-card shadow-tile" /> },
    "Card form loading": { view: "pay", formLoading: true },
    "Card form failed": { view: "pay", problem: "The secure card form could not load. Check the internet connection and try again." },
    "Confirm it’s you": { view: "pay", identity: <ConfirmIdentity step="start" /> },
    "Someone else pays": { view: "family", qr: sampleQr, linkUntil: "Tuesday 3:40 PM", linkIssued: true, locked: true },
    "Link check failed": { view: "summary", linkIssued: true, locked: true, checkFailed: true },
    "Other plans": { view: "others" },
    Confirming: { view: "submitted" },
    "Not confirmed yet": { view: "submitted", slow: true },
  },
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Choose this plan" }));
      await expect(choose).toHaveBeenCalledWith("grace_plus");
    },
  },
};

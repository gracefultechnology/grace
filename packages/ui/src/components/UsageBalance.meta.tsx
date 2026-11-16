import { fn } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { PlanAllowance, UsageBalanceProps } from "./UsageBalance.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

const allowance: PlanAllowance = {
  period: "Nov 1 to Dec 1, 2026",
  included: "$25.00",
  used: "$8.60",
  left: "$16.40",
  usedShare: 0.344,
  endsOn: "Dec 1, 2026",
  added: "$0.00",
  reserved: "$0.20",
  expired: "$3.10",
  takenBack: "$0.00",
};

export const meta: ComponentMeta<UsageBalanceProps> = {
  args: {
    allowance,
    credit: "$12.40",
    autoTopUp: false,
    categories: {
      included: ["Help from Grace", "Voice", "Search", "Storage"],
      notIncluded: ["Image and media creation"],
      otherIncluded: ["Online computing"],
      otherNotIncluded: ["Domain names", "Payouts and transfers"],
    },
    checkedAt: "Nov 15, 2026, 9:40 AM",
    onRefresh: fn(),
    onBack: fn(),
  },
  decorator: settingsPage,
  examples: {
    "Needs a fresh check": { stale: true },
    "No monthly plan": { allowance: "none", autoTopUp: true },
    "Period ended": { allowance: { ...allowance, ended: true } },
    "Left unknown": { allowance: { ...allowance, left: undefined, usedShare: undefined } },
    "Could not load": { allowance: undefined, credit: undefined, autoTopUp: undefined, categories: undefined, problem: "Usage and balance could not be checked. Try again." },
    Refreshing: { busy: true },
  },
};

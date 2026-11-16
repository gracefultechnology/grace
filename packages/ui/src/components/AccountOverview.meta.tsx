import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { AccountOverviewProps } from "./AccountOverview.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

const subscription = { plan: "Grace Plus", status: "Active", periodEnd: "Dec 1, 2026" };
const open = fn();

export const meta: ComponentMeta<AccountOverviewProps> = {
  args: { access: "active", account: "margaret.s@example.com", subscription, onOpen: open, onCheckAgain: fn(), onSignOut: fn(), onConfirmSignOut: fn(), onStay: fn() },
  decorator: settingsPage,
  examples: {
    "Renewal cancelled": { subscription: { ...subscription, cancelled: true } },
    "Payment needs attention": { access: "funding_required", subscription: { ...subscription, status: "Past due" } },
    "Payment being checked": { access: "payment_pending", subscription: undefined },
    Unavailable: { access: "unavailable", subscription: undefined },
    "Review sign-out": {
      reviewSignOut: true,
      signOutEffects: [
        "Gmail stays connected to your Grace account, but Grace can’t read it on this tablet while you’re signed out.",
        "Websites you signed in to while using Grace are signed out on this tablet.",
        "Passwords saved on this tablet stay here and lock when you sign out.",
      ],
    },
    "Signing out": { reviewSignOut: true, busy: true },
    "Sign-out not finished": { reviewSignOut: true, notice: "We couldn’t finish signing out yet. Try again when you’re connected." },
  },
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Usage and balance" }));
      await expect(open).toHaveBeenCalledWith("usage");
    },
  },
};

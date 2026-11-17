import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { AccountOverviewProps } from "./AccountOverview.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

const signOut = fn();
const checkAgain = fn();
const confirmSignOut = fn();
const stay = fn();
const effects = ["Grace can’t read your email or calendar until you sign in again.", "Grace can’t talk or think until you sign in again."];

export const meta: ComponentMeta<AccountOverviewProps> = {
  args: {
    access: "active",
    account: "margaret.s@example.com",
    mailConnected: true,
    support: "help@example.com",
    onCheckAgain: checkAgain,
    onSignOut: signOut,
    onConfirmSignOut: confirmSignOut,
    onStay: stay,
  },
  decorator: settingsPage,
  examples: {
    "Review sign-out": { reviewSignOut: true, signOutEffects: effects },
    "Signing out": { reviewSignOut: true, signOutEffects: effects, busy: true },
    "Sign-out not finished": { reviewSignOut: true, notice: "We couldn’t finish signing out yet. Try again when you’re connected." },
  },
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Sign out" }));
      await expect(signOut).toHaveBeenCalled();
    },
    "Access Attention": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Check again" }));
      await expect(checkAgain).toHaveBeenCalled();
    },
    "Review sign-out": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const page = within(canvasElement);
      await userEvent.click(page.getByRole("button", { name: "Stay signed in" }));
      await expect(stay).toHaveBeenCalled();
      await userEvent.click(page.getByRole("button", { name: "Confirm sign out" }));
      await expect(confirmSignOut).toHaveBeenCalled();
    },
  },
};

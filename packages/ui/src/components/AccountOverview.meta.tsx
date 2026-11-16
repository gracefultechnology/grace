import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { AccountOverviewProps } from "./AccountOverview.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

const signOut = fn();

export const meta: ComponentMeta<AccountOverviewProps> = {
  args: {
    access: "active",
    account: "margaret.s@gmail.com",
    mailConnected: true,
    support: "help@example.com",
    onCheckAgain: fn(),
    onSignOut: signOut,
    onConfirmSignOut: fn(),
    onStay: fn(),
  },
  decorator: settingsPage,
  examples: {
    "Review sign-out": {
      reviewSignOut: true,
      signOutEffects: ["Grace can’t read your email or calendar until you sign in again.", "Grace can’t talk or think until you sign in again."],
    },
    "Sign-out not finished": { reviewSignOut: true, notice: "We couldn’t finish signing out yet. Try again when you’re connected." },
  },
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Sign out" }));
      await expect(signOut).toHaveBeenCalled();
    },
  },
};

import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { WifiJoinFormProps } from "./WifiJoinForm.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

const join = fn();
const show = fn();

export const meta: ComponentMeta<WifiJoinFormProps> = {
  // Prototype `wifiPage()` with `X.wifi.join`: a home router's password.
  args: { network: "NETGEAR-4F2", userPlaceholder: "For example: margaret", onJoin: join, onShowPasswordChange: show, onCancel: fn() },
  examples: {
    Typed: { password: "garden2024" },
    Shown: { password: "garden2024", showPassword: true },
    Account: { network: "Sunrise Community Center", account: true },
  },
  states: {
    Error: {
      network: "Sunrise Community Center",
      account: true,
      error: "That account name or password didn’t work. Check both and try again.",
      onAskGrace: fn(),
    },
  },
  decorator: settingsPage,
  play: {
    // Join waits for the password.
    Default: ({ canvasElement }: { canvasElement: HTMLElement }) => expect(within(canvasElement).getByRole<HTMLButtonElement>("button", { name: "Join" }).disabled).toBe(true),
    Typed: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole("button", { name: "Show" }));
      await expect(show).toHaveBeenCalledWith(true);
      await userEvent.click(canvas.getByRole("button", { name: "Join" }));
      await expect(join).toHaveBeenCalled();
    },
  },
};

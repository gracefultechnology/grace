import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { WifiJoinFormProps } from "./WifiJoinForm.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

const join = fn();
const show = fn();
const user = fn();
const password = fn();

export const meta: ComponentMeta<WifiJoinFormProps> = {
  args: { network: "NETGEAR-4F2", userPlaceholder: "For example: margaret", onJoin: join, onShowPasswordChange: show, onPasswordChange: password, onCancel: fn() },
  examples: {
    Typed: { password: "garden2024" },
    Shown: { password: "garden2024", showPassword: true },
    Account: { network: "Sunrise Community Center", account: true, onUserChange: user },
  },
  states: {
    Error: {
      network: "Sunrise Community Center",
      account: true,
      error: "That account name or password didn’t work. Check both and try again.",
      askGrace: true,
      onAskGrace: fn(),
    },
  },
  decorator: settingsPage,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      password.mockClear();
      const canvas = within(canvasElement);
      await expect(canvas.getByRole<HTMLButtonElement>("button", { name: "Join" }).disabled).toBe(true);
      await userEvent.type(canvas.getByLabelText("Password"), "g");
      await expect(password).toHaveBeenCalledWith("g");
    },
    Account: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      user.mockClear();
      await userEvent.type(within(canvasElement).getByRole("textbox", { name: "Account name" }), "m");
      await expect(user).toHaveBeenCalledWith("m");
    },
    Typed: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole("button", { name: "Show" }));
      await expect(show).toHaveBeenCalledWith(true);
      await userEvent.click(canvas.getByRole("button", { name: "Join" }));
      await expect(join).toHaveBeenCalled();
    },
  },
};

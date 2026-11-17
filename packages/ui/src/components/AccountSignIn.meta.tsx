import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { AccountSignInProps } from "./AccountSignIn.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

const proceed = fn();
const cancel = fn();
const checkAgain = fn();
const later = fn();

export const meta: ComponentMeta<AccountSignInProps> = {
  args: { state: "ready", onContinue: proceed, onCancel: cancel, onCheckAgain: checkAgain, onLater: undefined },
  decorator: settingsPage,
  examples: {
    "During set-up": { onLater: later },
  },
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Continue with Google" }));
      await expect(proceed).toHaveBeenCalled();
    },
    "State Waiting": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Cancel" }));
      await expect(cancel).toHaveBeenCalled();
    },
    "State Attention": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Check again" }));
      await expect(checkAgain).toHaveBeenCalled();
    },
    "State Failed": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Check again" }));
      await expect(checkAgain).toHaveBeenCalled();
    },
    "During set-up": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Not now" }));
      await expect(later).toHaveBeenCalled();
    },
  },
};

import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { AccountSignInProps } from "./AccountSignIn.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

const proceed = fn();
const cancel = fn();

export const meta: ComponentMeta<AccountSignInProps> = {
  args: { state: "ready", onContinue: proceed, onCancel: cancel, onCheckAgain: fn() },
  decorator: settingsPage,
  examples: {
    "During set-up": { onLater: fn() },
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
  },
};

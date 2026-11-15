import { expect, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { AccountHelpProps } from "./AccountHelp.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

export const meta: ComponentMeta<AccountHelpProps> = {
  args: {},
  decorator: settingsPage,
  examples: {
    Open: { defaultOpen: true },
    "Sign-in help": { signIn: true, defaultOpen: true },
  },
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      const row = canvas.getByRole("button", { name: "Account help" });
      await userEvent.click(row);
      await expect(row).toHaveAttribute("aria-expanded", "true");
    },
  },
};

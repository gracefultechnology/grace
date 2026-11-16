import { expect, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { AccountHelpProps } from "./AccountHelp.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

export const meta: ComponentMeta<AccountHelpProps> = {
  args: { support: "help@example.com" },
  decorator: settingsPage,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const row = within(canvasElement).getByRole("button", { name: "Account help" });
      await userEvent.click(row);
      await expect(row).toHaveAttribute("aria-expanded", "true");
    },
  },
};

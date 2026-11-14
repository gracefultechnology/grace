import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { textSizePreview, textSizes } from "./SettingsApp.meta.tsx";
import type { SettingsTextSizeProps } from "./SettingsTextSize.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

const choose = fn();

export const meta: ComponentMeta<SettingsTextSizeProps> = {
  args: { sizes: textSizes, value: "Normal", onValueChange: choose, ...textSizePreview },
  examples: { Largest: { value: "Largest" } },
  decorator: settingsPage,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("radio", { name: "Larger" }));
      await expect(choose).toHaveBeenCalledWith("Larger");
    },
  },
};

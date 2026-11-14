import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { SettingsSwitchRowProps } from "./SettingsSwitchRow.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

const change = fn();

export const meta: ComponentMeta<SettingsSwitchRowProps> = {
  args: { title: "Dim the screen at night", subtitle: "From 9 pm to 7 am, easier on the eyes", checked: true, onCheckedChange: change },
  examples: { "Title only": { title: "Grace speaks out loud", subtitle: undefined, className: "min-h-[76px]" } },
  decorator: settingsPage,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("switch", { name: "Dim the screen at night" }));
      await expect(change).toHaveBeenCalledWith(false);
    },
  },
};

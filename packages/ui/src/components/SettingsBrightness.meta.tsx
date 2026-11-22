import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { SettingsBrightnessProps } from "./SettingsBrightness.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

const dim = fn();
const bright = fn();

export const meta: ComponentMeta<SettingsBrightnessProps> = {
  args: { brightness: 100, nightDim: true, nightDimHint: "From 9 pm to 7 am, easier on the eyes", onNightDimChange: dim, onBrightnessChange: bright, onBrightnessStep: undefined },
  bounds: { brightness: [20, 100] },
  examples: { Evening: { brightness: 40, nightDim: false } },
  decorator: settingsPage,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByText("Dim the screen at night"));
      await expect(dim).toHaveBeenCalledWith(false);
      await userEvent.click(canvas.getByRole("button", { name: "Dimmer" }));
      await expect(bright).toHaveBeenCalledWith(90);
    },
  },
};

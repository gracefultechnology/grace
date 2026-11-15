import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { speeds } from "./SettingsApp.meta.tsx";
import type { SettingsVoiceProps } from "./SettingsVoice.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

const sample = fn();
const wake = fn();

export const meta: ComponentMeta<SettingsVoiceProps> = {
  args: { speeds, speed: "1", speaks: true, wake: true, onPlaySample: sample, onWakeChange: wake },
  examples: { Quiet: { speed: "0.8", speaks: false, wake: false } },
  decorator: settingsPage,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole("button", { name: "Play a sample" }));
      await expect(sample).toHaveBeenCalled();
      await userEvent.click(canvas.getByRole("switch", { name: "Listen for “Hey Grace”" }));
      await expect(wake).toHaveBeenCalledWith(false);
    },
  },
};

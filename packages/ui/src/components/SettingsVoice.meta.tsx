import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { speeds } from "./SettingsApp.meta.tsx";
import type { SettingsVoiceProps } from "./SettingsVoice.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

const sample = fn();
const wake = fn();
const allow = fn();
const speed = fn();
const speaks = fn();

export const meta: ComponentMeta<SettingsVoiceProps> = {
  args: { speeds, speed: "1", speaks: true, wake: "unavailable", onPlaySample: sample, onWakeChange: wake, onFixWake: allow, onSpeedChange: speed, onSpeaksChange: speaks },
  examples: {
    Quiet: { speed: "0.8", speaks: false },
  },
  decorator: settingsPage,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      speed.mockClear();
      speaks.mockClear();
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole("button", { name: "Play a sample" }));
      await expect(sample).toHaveBeenCalled();
      await expect(canvas.getByRole("switch", { name: "Listen for “Hey Grace”" })).toBeDisabled();
      const normal = canvas.getByRole("radio", { name: "Normal" });
      await expect(normal.getAttribute("aria-checked")).toBe("true");
      await userEvent.click(normal);
      await userEvent.click(canvas.getByRole("radio", { name: "Faster" }));
      await userEvent.click(canvas.getByRole("switch", { name: "Grace speaks out loud" }));
      await expect([speed.mock.calls, speaks.mock.calls]).toEqual([[["1.15"]], [[false]]]);
    },
    "wake on": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("switch", { name: "Listen for “Hey Grace”" }));
      await expect(wake).toHaveBeenCalledWith(false);
    },
    "wake noMicrophone": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Allow microphone" }));
      await expect(allow).toHaveBeenCalled();
    },
  },
};

import { expect, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { SettingsAboutProps, VoiceCredit } from "./SettingsAbout.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

// Sample on-device speech components, as the app would list them.
export const voiceCredits: VoiceCredit[] = [
  { name: "Kokoro-82M", by: "hexgrad", part: "Grace’s voice", license: "Apache License 2.0", links: ["https://huggingface.co/hexgrad/Kokoro-82M"] },
  { name: "Whisper", by: "OpenAI", part: "Hearing what you say", license: "MIT License", links: ["https://github.com/openai/whisper"] },
  { name: "Silero VAD", by: "Silero Team", part: "Noticing when you speak", license: "MIT License", links: ["https://github.com/snakers4/silero-vad"] },
];

export const meta: ComponentMeta<SettingsAboutProps> = {
  args: { device: "Grace tablet · Prototype", status: "Everything is up to date." },
  examples: {
    "Voice software": { credits: voiceCredits },
    "Voice software open": { credits: voiceCredits, defaultCreditsOpen: true },
  },
  decorator: settingsPage,
  play: {
    "Voice software": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      const toggle = canvas.getByRole("button", { name: "Voice software and licences" });
      await expect(canvas.queryByText("Kokoro-82M")).toBeNull();
      await userEvent.click(toggle);
      await expect(toggle.getAttribute("aria-expanded")).toBe("true");
      await expect(canvas.getByText("Kokoro-82M")).toBeVisible();
    },
  },
};

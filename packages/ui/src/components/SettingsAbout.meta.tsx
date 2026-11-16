import { expect, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { SettingsAboutProps, VoiceCredit } from "./SettingsAbout.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

export const voiceCredits: VoiceCredit[] = [
  {
    name: "Phonon-2",
    by: "Fermion Research",
    part: "Listening",
    license: "CC BY 4.0",
    note: "Made from Parakeet TDT 0.6B v3 by NVIDIA (CC BY 4.0). Fermion Research changed the model; this app repacks it to run on the tablet.",
    links: ["https://huggingface.co/FermionResearch/Phonon-2", "https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3", "https://creativecommons.org/licenses/by/4.0/"],
  },
  { name: "Paradee-8M v1.2", by: "Sahil Mahendrakar", part: "Speaking in English", license: "Apache 2.0", links: ["https://huggingface.co/sahilmahendrakar/Paradee-8M-v1.2"] },
  { name: "misaki", by: "hexgrad", part: "Speaking in English", license: "Apache 2.0", links: ["https://github.com/hexgrad/misaki"] },
  {
    name: "Delibes-8M-esES",
    by: "Lapis Labs",
    part: "Speaking in Spanish",
    license: "Apache 2.0",
    note: "Adapted from Paradee by Sahil Mahendrakar and trained from the Kokoro-82M voice em_alex by hexgrad (both Apache 2.0). Kokoro credits its training audio to Koniwa by tnc (CC BY 3.0) and the SIWIS corpus (CC BY 4.0); the training text includes sentences by Tatoeba contributors (CC BY 2.0 FR).",
    links: ["https://huggingface.co/lapislabsai/Delibes-8M-esES", "https://huggingface.co/hexgrad/Kokoro-82M", "https://github.com/koniwa/koniwa", "https://datashare.ed.ac.uk/handle/10283/2353", "https://tatoeba.org"],
  },
  { name: "eSpeak NG 1.52.0", by: "the eSpeak NG authors", part: "Speaking", license: "GPL 3.0 or later", note: "Its English and Spanish data are under the same licence.", links: ["https://github.com/espeak-ng/espeak-ng"] },
  { name: "libelizainference (llama.cpp)", by: "elizaOS", part: "Engine", license: "MIT, shared under the GPL", links: ["https://github.com/elizaOS/llama.cpp", "https://github.com/elizaOS/eliza"] },
];

export const voiceCreditsIntro = "Grace speaks and listens on this tablet with this open-source software. Nothing here uses the internet.";

export const meta: ComponentMeta<SettingsAboutProps> = {
  args: { device: "Grace tablet · Prototype", status: "Everything is up to date." },
  examples: {
    "Voice software": { credits: voiceCredits, creditsIntro: voiceCreditsIntro },
    "Voice software open": { credits: voiceCredits, creditsIntro: voiceCreditsIntro, defaultCreditsOpen: true },
  },
  decorator: settingsPage,
  play: {
    "Voice software": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      const toggle = canvas.getByRole("button", { name: "Voice software and licences" });
      await expect(canvas.queryByText("Phonon-2")).toBeNull();
      await userEvent.click(toggle);
      await expect(toggle.getAttribute("aria-expanded")).toBe("true");
      await expect(canvas.getByText("Phonon-2")).toBeVisible();
    },
  },
};

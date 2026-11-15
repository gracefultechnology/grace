import { expect, fn, screen, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { GraceCapsule } from "./GraceHeader.tsx";
import type { GraceVoiceMenuProps } from "./GraceVoiceMenu.tsx";

const voice = fn();
const speed = fn();

// Prototype `#spdPop`: voice on, Normal speed, opening downward as in the expanded window.
export const meta: ComponentMeta<GraceVoiceMenuProps> = {
  args: { voiceOn: true, speed: "normal", side: "bottom", onVoiceChange: voice, onSpeedChange: speed },
  examples: { Open: { defaultOpen: true }, "Voice off": { voiceOn: false, defaultOpen: true } },
  decorator: (story) => (
    <div className="h-[460px] w-[560px] bg-gradient-frame-soft p-6">
      <GraceCapsule className="w-max">{story()}</GraceCapsule>
    </div>
  ),
  play: {
    // The pill opens the menu; the switch keeps it open; a speed closes it.
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      voice.mockClear();
      speed.mockClear();
      await userEvent.click(within(canvasElement).getByRole("button", { name: /voice/i }));
      await userEvent.click(await screen.findByRole("menuitemcheckbox", { name: /voice on/i }));
      await expect(voice).toHaveBeenCalledWith(false);
      await expect((await screen.findByRole("menuitemradio", { name: "Normal" })).getAttribute("aria-checked")).toBe("true");
      await userEvent.click(screen.getByRole("menuitemradio", { name: "Faster" }));
      await expect(speed).toHaveBeenCalledWith("faster");
      await expect(screen.queryByRole("menu")).toBeNull();
    },
  },
};

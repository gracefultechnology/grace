import { expect, fn, screen, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { GraceCapsule } from "./GraceHeader.tsx";
import type { GraceVoiceMenuProps } from "./GraceVoiceMenu.tsx";

const voice = fn();
const speed = fn();
const repeat = fn();
const fresh = fn();

export const meta: ComponentMeta<GraceVoiceMenuProps> = {
  args: { voiceOn: true, speed: "normal", side: "bottom", onVoiceChange: voice, onSpeedChange: speed },
  examples: {
    Open: { defaultOpen: true },
    "Voice off": { voiceOn: false, defaultOpen: true },
    "With conversation": { voiceOn: false, defaultOpen: true, canRepeat: true, onRepeat: repeat, canStartOver: true, onNewConversation: fresh },
    "Nothing to repeat": { defaultOpen: true, canRepeat: false },
  },
  decorator: (story) => (
    <div className="h-[640px] w-[560px] bg-gradient-frame-soft p-6">
      <GraceCapsule className="w-max">{story()}</GraceCapsule>
    </div>
  ),
  play: {
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
    "With conversation": async () => {
      repeat.mockClear();
      fresh.mockClear();
      await userEvent.click(await screen.findByRole("menuitem", { name: "Say it again" }));
      await expect(repeat).toHaveBeenCalled();
      await expect(fresh).not.toHaveBeenCalled();
    },
    "Nothing to repeat": async () => {
      await expect((await screen.findByRole("menuitem", { name: "Say it again" })).getAttribute("aria-disabled")).toBe("true");
      await expect(screen.queryByRole("menuitem", { name: "New conversation" })).toBeNull();
    },
  },
};

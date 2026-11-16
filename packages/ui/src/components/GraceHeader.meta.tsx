import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { GraceHeaderProps } from "./GraceHeader.tsx";
import { GraceVoiceMenu } from "./GraceVoiceMenu.tsx";

const resize = fn();
const pause = fn();
const showGuide = fn();

export const meta: ComponentMeta<GraceHeaderProps> = {
  args: { pause: "live", voice: <GraceVoiceMenu />, onExpandedChange: resize, onPause: pause, onShowGuide: showGuide },
  examples: {
    Expanded: { expanded: true, voice: <GraceVoiceMenu side="bottom" /> },
    "Expanded nudge": { expanded: true, nudge: true, voice: <GraceVoiceMenu side="bottom" /> },
    Paused: { pause: "paused" },
    "Show guidance": { showGuide: true },
    "Nothing to pause": { pause: "idle" },
  },
  decorator: (story) => <div className="w-[1130px] bg-background p-4">{story()}</div>,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      resize.mockClear();
      pause.mockClear();
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole("button", { name: "Pause Grace" }));
      await expect(pause).toHaveBeenCalled();
      await userEvent.click(canvas.getByRole("button", { name: "Expand" }));
      await expect(resize).toHaveBeenCalledWith(true);
    },
    "Show guidance": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      showGuide.mockClear();
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Show me again" }));
      await expect(showGuide).toHaveBeenCalledTimes(1);
    },
  },
};

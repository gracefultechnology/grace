import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { GraceHeaderProps } from "./GraceHeader.tsx";
import { GraceVoiceMenu } from "./GraceVoiceMenu.tsx";

const resize = fn();
const pause = fn();
const showGuide = fn();
const resume = fn();
const close = fn();

export const meta: ComponentMeta<GraceHeaderProps> = {
  args: { pause: "live", voice: <GraceVoiceMenu />, onExpandedChange: resize, onPause: pause, onResume: resume, onShowGuide: showGuide, onClose: close },
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
      close.mockClear();
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole("button", { name: "Pause Grace" }));
      await expect(pause).toHaveBeenCalled();
      const size = canvas.getByRole("button", { name: "Expand" });
      await expect(size.getAttribute("aria-expanded")).toBe("false");
      await userEvent.click(size);
      await expect(resize).toHaveBeenCalledWith(true);
      await userEvent.click(canvas.getByRole("button", { name: "Close Grace" }));
      await expect(close).toHaveBeenCalledTimes(1);
    },
    Paused: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      resume.mockClear();
      pause.mockClear();
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Resume Grace" }));
      await expect([resume, pause].map((spy) => spy.mock.calls.length)).toEqual([1, 0]);
    },
    "Nothing to pause": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      pause.mockClear();
      const button = within(canvasElement).getByRole("button", { name: "Pause Grace" });
      await expect(button.getAttribute("aria-disabled")).toBe("true");
      await userEvent.click(button);
      await expect(pause).not.toHaveBeenCalled();
    },
    "Show guidance": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      showGuide.mockClear();
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Show me again" }));
      await expect(showGuide).toHaveBeenCalledTimes(1);
    },
  },
};

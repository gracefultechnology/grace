import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { GraceHeaderProps } from "./GraceHeader.tsx";
import { GraceVoiceMenu } from "./GraceVoiceMenu.tsx";

const resize = fn();
const pause = fn();
const showGuide = fn();

// Prototype `#gwin .hdr` while Grace greets Margaret in the compact window (ref grace-compact).
export const meta: ComponentMeta<GraceHeaderProps> = {
  args: { pause: "live", voice: <GraceVoiceMenu />, onExpandedChange: resize, onPause: pause, onShowGuide: showGuide },
  examples: {
    Expanded: { expanded: true, voice: <GraceVoiceMenu side="bottom" /> },
    // Prototype nudgeCollapse(): Grace asks Margaret to collapse the window so she can watch the page.
    "Expanded nudge": { expanded: true, nudge: true, voice: <GraceVoiceMenu side="bottom" /> },
    Paused: { pause: "paused" },
    // spec/app/assistant.md, "Dismiss hides only the label and Show restores only a still-current target": Margaret closed the tip.
    "Show guidance": { showGuide: true },
    "Nothing to pause": { pause: "idle" },
  },
  decorator: (story) => <div className="w-[1130px] bg-background p-4">{story()}</div>,
  play: {
    // Pause stops her; Expand asks for the full screen.
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

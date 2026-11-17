import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { CaptionStripProps } from "./CaptionStrip.tsx";

const show = fn();
const showGuide = fn();

export const meta: ComponentMeta<CaptionStripProps> = {
  args: { who: "grace", activity: "speaking", text: "Tap the password box, then type your password.", onShowChat: show, onShowGuide: showGuide },
  examples: {
    Margaret: { who: "you", activity: "listening", text: "Can you help me pay my Chase bill?" },
    "Margaret, Grace thinking": { who: "you", activity: undefined, text: "Can you help me pay my Chase bill?" },
    Thinking: { activity: "thinking", text: "" },
    Working: { activity: "working", text: "Opening Chase for you." },
    Answers: { activity: undefined, answers: ["Yes, carry on", "No, thanks"] },
    "Show guidance": { showGuide: true },
    "Long line": { text: "Chase's sign-in page is open. I'll take you through it step by step. Tap the password box, then type your password." },
  },
  decorator: (story) => (
    <div className="group/grace w-[1170px] bg-gradient-frame-soft p-5">
      {story()}
    </div>
  ),
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      show.mockClear();
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Show chat" }));
      await expect(show).toHaveBeenCalledTimes(1);
    },
    "Show guidance": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      show.mockClear();
      showGuide.mockClear();
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Show me again" }));
      await expect(showGuide).toHaveBeenCalledTimes(1);
      await expect(show).not.toHaveBeenCalled();
    },
  },
};

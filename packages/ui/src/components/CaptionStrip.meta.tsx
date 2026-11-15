import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { CaptionStripProps } from "./CaptionStrip.tsx";

const show = fn();
const showGuide = fn();

// Prototype `.capstrip` over the keyboard while Margaret fills in Chase's sign-in (lines from the prototype's prompt).
export const meta: ComponentMeta<CaptionStripProps> = {
  args: { placement: "inline", who: "grace", activity: "speaking", text: "Tap the password box, then type your password.", onShowChat: show, onShowGuide: undefined },
  examples: {
    Margaret: { who: "you", activity: "listening", text: "Can you help me pay my Chase bill?" },
    // Prototype renderStrip() while Grace thinks: Margaret's words stay on the line, then her dots alone.
    "Margaret, Grace thinking": { who: "you", activity: undefined, text: "Can you help me pay my Chase bill?" },
    Thinking: { activity: "thinking", text: "" },
    // Prototype renderStrip() while she works: the spinner (`SPIN`) before her words.
    Working: { activity: "working", text: "Opening Chase for you." },
    Answers: { activity: undefined, answers: ["Yes, carry on", "No, thanks"] },
    // spec/app/assistant.md, "Dismiss hides only the label and Show restores only a still-current target": Margaret closed the tip.
    "Show guidance": { onShowGuide: showGuide },
    "Long line": { text: "Chase's sign-in page is open. I'll take you through it step by step. Tap the password box, then type your password." },
  },
  decorator: (story) => (
    <div className="group/grace w-[1170px] bg-gradient-frame-soft p-5" data-surface="white">
      {story()}
    </div>
  ),
  play: {
    // Show chat brings back the conversation.
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      show.mockClear();
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Show chat" }));
      await expect(show).toHaveBeenCalledTimes(1);
    },
    // Show me again brings back the tip and leaves the chat hidden.
    "Show guidance": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      show.mockClear();
      showGuide.mockClear();
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Show me again" }));
      await expect(showGuide).toHaveBeenCalledTimes(1);
      await expect(show).not.toHaveBeenCalled();
    },
  },
};

import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { CaptionStripProps } from "./CaptionStrip.tsx";

const show = fn();

// Prototype `.capstrip` over the keyboard while Margaret fills in Chase's sign-in.
export const meta: ComponentMeta<CaptionStripProps> = {
  args: { placement: "inline", who: "grace", activity: "speaking", text: "Tap the box that says Username, and type the name you use for Chase.", onShowChat: show },
  examples: {
    Margaret: { who: "you", activity: "listening", text: "What was my username again" },
    Answers: { activity: undefined, answers: ["Yes, carry on", "No, thanks"] },
    "Long line": { text: "I’ve filled in your username. Now tap the box that says Password, and type your password. I won’t look at what you type, and I won’t keep it anywhere." },
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
  },
};

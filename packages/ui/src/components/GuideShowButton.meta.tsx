import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { GuideShowButtonProps } from "./GuideShowButton.tsx";

const show = fn();

export const meta: ComponentMeta<GuideShowButtonProps> = {
  args: { onSelect: show },
  examples: { Header: { surface: "header" } },
  // `.capstrip` on the frame: the pale strip's glass, the button at its right end where Show chat sits.
  decorator: (story) => (
    <div className="flex h-[120px] w-[600px] items-center bg-gradient-frame p-5">
      <div className="flex h-20 flex-1 items-center justify-end rounded-segment bg-glass/62 pr-2 shadow-raised inset-ring inset-ring-glass/75">
        {story()}
      </div>
    </div>
  ),
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Show me again" }));
      await expect(show).toHaveBeenCalled();
    },
  },
};

import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { FundingPromptProps } from "./FundingPrompt.tsx";

const setUp = fn();

// The original app's words (senior-care funding-gate.ts).
export const meta: ComponentMeta<FundingPromptProps> = {
  args: { kind: "plan", onSetUp: setUp, onLater: fn() },
  decorator: (story) => <div className="group/grace w-[1130px] bg-background p-6" data-surface="white">{story()}</div>,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Set it up now" }));
      await expect(setUp).toHaveBeenCalled();
    },
  },
};

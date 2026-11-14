import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { AnswerChips, type AnswerChipProps } from "./AnswerChip.tsx";

const chose = fn();

// Prototype `.sugg`: the answers to Grace's question, read from the right.
export const meta: ComponentMeta<AnswerChipProps> = {
  args: { children: "Full balance", onClick: chose },
  examples: {
    Longer: { children: "A different amount" },
    // A chip without words is named by `aria-label`.
    Empty: { children: undefined, "aria-label": "Full balance" },
  },
  decorator: (story) => (
    <div className="group/grace w-[1130px] bg-background p-6" data-surface="white">
      <AnswerChips>{story()}</AnswerChips>
    </div>
  ),
  play: {
    // A tap is Margaret's answer.
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      chose.mockClear();
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Full balance" }));
      await expect(chose).toHaveBeenCalled();
    },
  },
};

import { fn } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { tapCalls } from "./Button.meta.tsx";
import { AnswerChips, type AnswerChipProps } from "./AnswerChip.tsx";

const chose = fn();

export const meta: ComponentMeta<AnswerChipProps> = {
  args: { children: "Yes, show me", onClick: chose },
  examples: {
    Longer: { children: "Yes, pay $84.20 today" },
    Empty: { children: undefined, "aria-label": "Yes, show me" },
  },
  decorator: (story) => (
    <div className="group/grace w-[1130px] bg-background p-6">
      <AnswerChips>{story()}</AnswerChips>
    </div>
  ),
  play: {
    Default: tapCalls("Yes, show me", chose),
  },
};

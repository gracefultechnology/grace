import { fn } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { tapCalls } from "./Button.meta.tsx";
import type { HomePagerProps } from "./HomePager.tsx";

const onPageChange = fn();

export const meta: ComponentMeta<HomePagerProps> = {
  args: { page: 0, count: 2, onPageChange },
  examples: {
    "Second page": { page: 1, count: 2 },
    Compact: { compact: true, className: "bottom-[266px]" },
  },
  bounds: { page: [0, 1], count: [2, 3] },
  decorator: (story) => <div className="relative h-[788px] w-[1268px] bg-gradient-frame-soft">{story()}</div>,
  play: {
    Default: tapCalls("More apps", onPageChange, { args: [1], rest: true }),
  },
};

import { fn } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { tapCalls } from "./Button.meta.tsx";
import type { HomePagerProps } from "./HomePager.tsx";

const onPageChange = fn();

export const meta: ComponentMeta<HomePagerProps> = {
  // Prototype `#hPager`, `#hArrowR` on Home's first page.
  args: { page: 0, count: 2, onPageChange },
  examples: {
    "Second page": { page: 1, count: 2 },
    // Prototype `.home.cmp`: Home ends 6px above Grace's 260px compact window, 522px tall.
    Compact: { compact: true, className: "bottom-[266px]" },
  },
  bounds: { page: [0, 1], count: [2, 3] },
  // Drawn over Home's area, 1268×788 inside the screen.
  decorator: (story) => <div className="relative h-[788px] w-[1268px] bg-gradient-frame-soft">{story()}</div>,
  play: {
    Default: tapCalls("More apps", onPageChange, { args: [1], rest: true }),
  },
};

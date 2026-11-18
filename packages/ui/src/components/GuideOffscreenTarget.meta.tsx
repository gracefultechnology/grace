import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { onChase } from "./GuideRing.meta.tsx";
import type { GuideOffscreenTargetProps } from "./GuideOffscreenTarget.tsx";

const select = fn();

export const meta: ComponentMeta<GuideOffscreenTargetProps> = {
  args: { label: "Continue is below", onSelect: select },
  examples: { "Direction up": { label: "Continue is above", direction: "up" } },
  decorator: (story) => onChase("pay", true)(story),
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Continue is below" }));
      await expect(select).toHaveBeenCalled();
    },
  },
};

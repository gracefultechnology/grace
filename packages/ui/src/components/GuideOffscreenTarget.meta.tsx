import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { onChase, payPage } from "./GuideRing.meta.tsx";
import type { GuideOffscreenTargetProps } from "./GuideOffscreenTarget.tsx";

const select = fn();

export const meta: ComponentMeta<GuideOffscreenTargetProps> = {
  // `renderOverlay` with Continue below the fold of the payment form, Grace's window open under the browser: "<NAMES.continue> is below".
  args: { label: "Continue is below", onSelect: select },
  examples: { "Direction up": { label: "Continue is above", direction: "up" } },
  decorator: (story) => onChase({ title: "Pay your card · Chase", address: "chase.com/pay", page: payPage, short: true })(story),
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Continue is below" }));
      await expect(select).toHaveBeenCalled();
    },
  },
};

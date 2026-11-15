import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { AskGraceButtonProps } from "./AskGraceButton.tsx";

export const meta: ComponentMeta<AskGraceButtonProps> = {
  args: { onClick: fn() },
  examples: {
    // Prototype `#askRing.halo`: the start-up pulse that invites the first tap.
    Welcome: { glow: "welcome" },
    "Grace open": { selected: true, glow: "off" },
  },
  decorator: (story) => <div className="inline-flex rounded-window bg-gradient-frame-soft p-2">{story()}</div>,
  play: {
    Default: async ({ args, canvasElement }: { args: AskGraceButtonProps; canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Ask Grace" }));
      await expect(args.onClick).toHaveBeenCalled();
    },
  },
};

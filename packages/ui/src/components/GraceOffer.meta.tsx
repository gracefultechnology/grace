import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { GraceOfferProps } from "./GraceOffer.tsx";

const add = fn();

export const passwordsOffer: GraceOfferProps = { message: "Grace offers to save them as you sign in", action: "Add one", onAction: add };

export const meta: ComponentMeta<GraceOfferProps> = {
  args: passwordsOffer,
  examples: { "Without a step": { message: "Ask Grace to add an appointment." } },
  decorator: (story) => <div className="w-[453px] bg-gradient-frame-soft p-6">{story()}</div>,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Add one" }));
      await expect(add).toHaveBeenCalled();
    },
  },
};

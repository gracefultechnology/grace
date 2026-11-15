import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { TabletScreen } from "./TabletScreen.tsx";
import type { GuideOffscreenTargetProps } from "./GuideOffscreenTarget.tsx";

const select = fn();

export const meta: ComponentMeta<GuideOffscreenTargetProps> = {
  // Prototype `NAMES.continue`: "<name> is below", at the bottom of the page frame.
  args: { label: "Continue is below", onSelect: select },
  examples: { "Direction up": { label: "Your balance is above", direction: "up" } },
  decorator: (story) => (
    <TabletScreen>
      <div className="absolute rounded-md bg-card shadow-panel" style={{ left: 185, top: 235, width: 518, height: 600 }} />
      {story()}
    </TabletScreen>
  ),
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Continue is below" }));
      await expect(select).toHaveBeenCalled();
    },
  },
};

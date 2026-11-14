import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { GuideRing } from "./GuideRing.tsx";
import { TabletScreen } from "./TabletScreen.tsx";
import type { GuideLabelProps } from "./GuideLabel.tsx";

// The prototype's Chase account page: Pay card, its ring, and the label 22px to its right with its tail at the target's middle.
const target = { x: 185, y: 480, width: 126, height: 48 };
const close = fn();

export const meta: ComponentMeta<GuideLabelProps> = {
  args: { title: "Tap Pay card", onClose: close, className: "absolute left-[333px] bottom-[274px]" },
  examples: {
    // `GTXT.password`: a field to type in.
    Field: { title: "Tap here, then type", mark: "keyboard" },
    // `GTXT.balance` as a confirmation.
    Detail: { tone: "ok", title: "Statement balance: $84.20", detail: "Due Nov 12" },
  },
  decorator: (story) => (
    <TabletScreen>
      <div className="absolute rounded-md bg-card shadow-panel" style={{ left: 185, top: 243, width: 560, height: 215 }} />
      <div className="absolute flex items-center justify-center rounded-md bg-primary text-lg font-bold text-primary-foreground" style={{ left: target.x, top: target.y, width: target.width, height: target.height }}>Pay card</div>
      <GuideRing rect={target} tight motion="still" />
      {story()}
    </TabletScreen>
  ),
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Close this tip" }));
      await expect(close).toHaveBeenCalled();
    },
  },
};

import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { onAccount } from "./GuideRing.meta.tsx";
import type { GuideLabelProps } from "./GuideLabel.tsx";

// `renderOverlay` on the Chase card page: the label 22px right of its target, its bottom 22px below the target's middle
// (at most 40px down), on the website's 644px-tall layer.
const close = fn();
const select = fn();
const besidePayCard = "absolute left-[189px] bottom-[268px]";

export const meta: ComponentMeta<GuideLabelProps> = {
  // `GTXT.paycard`: Pay card, Grace's turn for Margaret.
  args: { title: "Tap Pay card", onSelect: undefined, onClose: close, className: besidePayCard },
  examples: {
    // `.glab.tap` for a field (`GTXT.password`): the words themselves are the thing to tap.
    Field: { title: "Tap here, then type", mark: "keyboard", onSelect: select },
    // `TYPE_TXT.password`, once the field is chosen.
    "Field chosen": { title: "Type your password, then tap Done", mark: "keyboard" },
    // `.glab.ok` for the confirmed bill (`GTXT.balance`), beside the statement balance row.
    Detail: { tone: "ok", title: "Statement balance: $84.20", detail: "Due Nov 12", className: "absolute left-[598px] bottom-[491.5px]" },
  },
  decorator: (story) => onAccount(story),
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Close this tip" }));
      await expect(close).toHaveBeenCalled();
    },
    Field: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Tap here, then type" }));
      await expect(select).toHaveBeenCalled();
    },
  },
};

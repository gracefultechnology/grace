import { fn } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { tapCalls } from "./Button.meta.tsx";
import { onAccount } from "./GuideRing.meta.tsx";
import type { GuideLabelProps } from "./GuideLabel.tsx";

// `renderOverlay` on the Chase card page: the label 22px right of its target, its bottom 22px below the target's middle
// (at most 40px down), on the website's 644px-tall layer.
const close = fn();
const select = fn();
const besidePayCard = "absolute left-[189px] bottom-[268px]";

export const meta: ComponentMeta<GuideLabelProps> = {
  // `GTXT.paycard`: Pay card, Grace's turn for Margaret.
  args: { title: "Tap Pay card", closable: true, onClose: close, className: besidePayCard },
  examples: {
    // `.glab.tap` for a field (`GTXT.password`): the words themselves are the thing to tap.
    Field: { title: "Tap here, then type", mark: "keyboard", selectable: true, onSelect: select },
    // `TYPE_TXT.password`, once the field is chosen.
    "Field chosen": { title: "Type your password, then tap Done", mark: "keyboard" },
    // Under a control at the right edge, as the set-up header's Close: the tail out of the top-right corner, pointing up at it.
    "Below end": { placement: "below-end", title: "Tap here", closable: false, className: "absolute top-[84px] right-[72px]" },
    // Grace at work under the same control: filled violet, the tail turned up out of the top-right corner.
    "Working below end": { placement: "below-end", tone: "working", title: "Closing this for you", closable: false, className: "absolute top-[84px] right-[72px]" },
    // `.glab.ok` for the confirmed bill (`GTXT.balance`), beside the statement balance row.
    Detail: { tone: "ok", title: "Statement balance: $84.20", detail: "Due Nov 12", className: "absolute left-[598px] bottom-[491.5px]" },
  },
  decorator: (story) => onAccount(story),
  play: {
    Default: tapCalls("Close this tip", close),
    Field: tapCalls("Tap here, then type", select),
  },
};

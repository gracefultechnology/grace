import { fn } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { tapCalls } from "./Button.meta.tsx";
import { onAccount } from "./GuideRing.meta.tsx";
import type { GuideLabelProps } from "./GuideLabel.tsx";

const close = fn();
const select = fn();
const besidePayCard = "absolute left-[189px] bottom-[268px]";

export const meta: ComponentMeta<GuideLabelProps> = {
  args: { title: "Tap Pay card", closable: true, onClose: close, className: besidePayCard },
  examples: {
    Field: { title: "Tap here, then type", mark: "keyboard", selectable: true, onSelect: select },
    "Field chosen": { title: "Type your password, then tap Done", mark: "keyboard" },
    "Below end": { placement: "below-end", title: "Tap here", closable: false, className: "absolute top-[84px] right-[72px]" },
    "Working below end": { placement: "below-end", tone: "working", title: "Closing this for you", closable: false, className: "absolute top-[84px] right-[72px]" },
    Detail: { tone: "ok", title: "Statement balance: $84.20", detail: "Due Nov 12", className: "absolute left-[598px] bottom-[491.5px]" },
  },
  decorator: (story) => onAccount(story),
  play: {
    Default: tapCalls("Close this tip", close),
    Field: tapCalls("Tap here, then type", select),
  },
};

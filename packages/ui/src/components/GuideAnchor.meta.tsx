import { fn } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { tapCalls } from "./Button.meta.tsx";
import { Button } from "./Button.tsx";
import { upcoming } from "./CalendarApp.meta.tsx";
import { CalendarEventRow } from "./CalendarEventRow.tsx";
import type { GuideAnchorProps } from "./GuideAnchor.tsx";

const close = fn();
const { id: _lunch, ...lunch } = upcoming[1];

export const meta: ComponentMeta<GuideAnchorProps> = {
  args: {
    kind: "instruction",
    title: "Tap Largest",
    radius: 999,
    onClose: close,
    children: <Button variant="plain" size="compact" className="px-[22px] text-grace-ink">Largest</Button>,
  },
  examples: {
    Point: { kind: "point", title: undefined },
    "Added by Margaret": { kind: "confirm", title: undefined, radius: 22, className: "flex", children: <CalendarEventRow {...lunch} /> },
  },
  decorator: (story) => (
    <div className="w-[1130px] bg-background px-6 py-10">
      <div className="has-[>.inline-flex]:flex has-[>.inline-flex]:rounded-segment has-[>.inline-flex]:bg-panel has-[>.inline-flex]:p-2">
        {story()}
      </div>
    </div>
  ),
  play: {
    Default: tapCalls("Close this tip", close),
  },
};

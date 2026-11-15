import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { Button } from "./Button.tsx";
import { upcoming } from "./CalendarApp.meta.tsx";
import { CalendarEventRow } from "./CalendarEventRow.tsx";
import type { GuideAnchorProps } from "./GuideAnchor.tsx";

const close = fn();
const { id: _lunch, ...lunch } = upcoming[1];

export const meta: ComponentMeta<GuideAnchorProps> = {
  // `X.guide={target:'ts-Largest',kind:'instruction',title:'Tap Largest'}`: the Text size option, a 56px pill (radius 999).
  args: {
    kind: "instruction",
    title: "Tap Largest",
    radius: 999,
    onClose: close,
    children: <Button variant="plain" size="compact" className="px-[22px] text-grace-ink">Largest</Button>,
  },
  examples: {
    // `X.guide.kind` 'point' (axGuide()): what Grace is talking about, her ring alone, beating three times.
    Point: { kind: "point", title: undefined },
    // After `formsave`, `X.guide={target:'ev'+ev.id,kind:'confirm'}`: the appointment Margaret just added, in a green ring.
    "Added by Margaret": { kind: "confirm", title: undefined, radius: 22, className: "flex", children: <CalendarEventRow {...lunch} /> },
  },
  // `#apg`: the app window's white page, 24px in from its sides, wide enough for the label beside the target. An inline target
  // (`.anch-w`) sits on the Text size `.a-seg` track, which shows through it.
  decorator: (story) => (
    <div className="w-[1130px] bg-background px-6 py-10">
      <div className="has-[>.inline-flex]:flex has-[>.inline-flex]:rounded-segment has-[>.inline-flex]:bg-panel has-[>.inline-flex]:p-2">
        {story()}
      </div>
    </div>
  ),
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Close this tip" }));
      await expect(close).toHaveBeenCalled();
    },
  },
};

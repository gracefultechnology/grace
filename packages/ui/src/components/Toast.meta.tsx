import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { TabletScreen } from "./TabletScreen.tsx";
import type { ToastProps } from "./Toast.tsx";

const undo = fn();

export const compactGrace = { height: 260, standIn: <div aria-hidden className="absolute right-1.5 bottom-1.5 left-[144px] z-[3] hidden h-[260px] rounded-device bg-background shadow-window group-has-[.above-grace]/tablet:block" /> };

export const meta: ComponentMeta<ToastProps> = {
  args: { children: "Saved to your calendar", onUndo: undefined },
  examples: {
    Undo: { children: "Moved to Trash", onUndo: undo },
    "On the screen": { children: "Connected to Home Network", placement: "screen" },
    "Above Grace": { placement: "screen", above: compactGrace.height, className: "above-grace" },
  },
  decorator: (story) => (
    <TabletScreen className="group/tablet">
      <div className="p-6">{story()}</div>
      {compactGrace.standIn}
    </TabletScreen>
  ),
  play: {
    Undo: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const button = within(canvasElement).getByRole("button", { name: "Undo" });
      await userEvent.click(button);
      await expect(undo).toHaveBeenCalled();
      button.blur();
    },
  },
};

import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { cn } from "../lib/cn.ts";
import { besideRail, TabletScreen } from "./TabletScreen.tsx";
import type { ToastProps } from "./Toast.tsx";

const undo = fn();
const dismiss = fn();

export const compactGrace = { height: 260, standIn: <div aria-hidden className={cn(besideRail, "bottom-1.5 z-[3] hidden h-[260px] rounded-window bg-background shadow-window group-has-[.above-grace]/tablet:block")} /> };

export const meta: ComponentMeta<ToastProps> = {
  args: { children: "Saved to your calendar", onUndo: undefined },
  examples: {
    Undo: { children: "Moved to Trash", onUndo: undo },
    Reminder: { children: "Reminder: Doctor’s appointment tomorrow at 10 am", onDismiss: dismiss, placement: "screen" },
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
    Reminder: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const button = within(canvasElement).getByRole("button", { name: "Dismiss" });
      await userEvent.click(button);
      await expect(dismiss).toHaveBeenCalled();
      button.blur();
    },
  },
};

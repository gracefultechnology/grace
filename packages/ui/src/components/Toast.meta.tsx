import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { TabletScreen } from "./TabletScreen.tsx";
import type { ToastProps } from "./Toast.tsx";

const undo = fn();

/**
 * A stand-in for compact Grace at her 260px height (prototype `.gwin`), drawn only on a screen whose story is
 * marked `above-grace`.
 */
export const compactGrace = { height: 260, standIn: <div aria-hidden className="absolute right-1.5 bottom-1.5 left-[144px] z-[3] hidden h-[260px] rounded-device bg-frost/86 shadow-banner backdrop-blur-2xl group-has-[.above-grace]/tablet:block" /> };

export const meta: ComponentMeta<ToastProps> = {
  // Prototype `axToast()`: what Calendar says after saving, and Email after a delete it can take back.
  args: { children: "Saved to your calendar", onUndo: undefined },
  examples: {
    Undo: { children: "Moved to Trash", onUndo: undo },
    // Prototype `axToast()` on `#screen`: centered 24px above the bottom, over the windows.
    "On the screen": { children: "Connected to Home Network", placement: "screen" },
    // Prototype `axToast()` while compact Grace is open: 24px above her window.
    "Above Grace": { placement: "screen", above: compactGrace.height, className: "above-grace" },
  },
  // The padding holds an inline toast; one on the `screen` is placed against the TabletScreen.
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

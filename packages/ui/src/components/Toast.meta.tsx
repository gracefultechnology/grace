import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { TabletScreen } from "./TabletScreen.tsx";
import type { ToastProps } from "./Toast.tsx";

const undo = fn();

export const meta: ComponentMeta<ToastProps> = {
  // Prototype `axToast()`: what Calendar says after saving, and Email after a delete it can take back.
  args: { children: "Saved to your calendar", onUndo: undefined },
  examples: {
    Undo: { children: "Moved to Trash", onUndo: undo },
    // Prototype `axToast()` on `#screen`: centered 24px above the bottom, over the windows.
    "On the screen": { children: "Connected to Home Network", placement: "screen" },
  },
  // The padding holds an inline toast; one on the `screen` is placed against the TabletScreen.
  decorator: (story) => (
    <TabletScreen>
      <div className="p-6">{story()}</div>
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

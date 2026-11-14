import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { ToastProps } from "./Toast.tsx";

const undo = fn();

export const meta: ComponentMeta<ToastProps> = {
  args: { children: "Sent to Dana" },
  examples: { Undo: { children: "Moved to Trash", onUndo: undo } },
  decorator: (story) => <div className="p-6">{story()}</div>,
  play: {
    Undo: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Undo" }));
      await expect(undo).toHaveBeenCalled();
    },
  },
};

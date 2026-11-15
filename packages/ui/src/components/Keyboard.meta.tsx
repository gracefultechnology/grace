import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { KeyboardProps } from "./Keyboard.tsx";
import { TabletScreen } from "./TabletScreen.tsx";

// Prototype `openKb('grace')`: an empty message starts in capitals.
export const meta: ComponentMeta<KeyboardProps> = {
  args: { shift: true, onKey: fn() },
  examples: {
    Typing: { shift: false, ready: true },
    Numbers: { layout: "numbers", shift: false },
    Symbols: { layout: "symbols", shift: false },
    "Website field": { shift: false, labels: { go: "Done" } },
  },
  decorator: (story) => <TabletScreen>{story()}</TabletScreen>,
  play: {
    Default: async ({ args, canvasElement }: { args: KeyboardProps; canvasElement: HTMLElement }) => {
      const keys = within(canvasElement);
      await userEvent.click(keys.getByRole("button", { name: "Q" }));
      await userEvent.click(keys.getByRole("button", { name: "Delete" }));
      await expect(args.onKey).toHaveBeenNthCalledWith(1, "Q");
      await expect(args.onKey).toHaveBeenNthCalledWith(2, "backspace");
    },
  },
};

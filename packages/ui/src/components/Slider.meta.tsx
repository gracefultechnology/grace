import { expect, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { SliderProps } from "./Slider.tsx";

export const meta: ComponentMeta<SliderProps> = {
  // prototype Settings › Brightness.
  args: { label: "Screen brightness", decreaseLabel: "Dimmer", increaseLabel: "Brighter", defaultValue: 70 },
  examples: { Volume: { label: "Volume", decreaseLabel: "Quieter", increaseLabel: "Louder", defaultValue: 40 } },
  bounds: { defaultValue: [0, 100] },
  decorator: (story) => <div className="w-[740px] rounded-row bg-panel p-6">{story()}</div>,
  play: {
    // − and + step by ten; at an end, the button for that end refuses.
    Default: async ({ args, canvasElement }: { args: SliderProps; canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole("button", { name: "Brighter" }));
      await userEvent.click(canvas.getByRole("button", { name: "Brighter" }));
      await userEvent.click(canvas.getByRole("button", { name: "Dimmer" }));
      await expect(canvas.getByRole("slider", { name: "Screen brightness" }).getAttribute("aria-valuenow")).toBe("80");
      await expect(args.onValueChange).toHaveBeenLastCalledWith(80);
    },
    "defaultValue max": ({ canvasElement }: { canvasElement: HTMLElement }) => expect(within(canvasElement).getByRole("button", { name: "Brighter" }).hasAttribute("disabled")).toBe(true),
  },
};

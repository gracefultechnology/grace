import { expect, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { SliderProps } from "./Slider.tsx";

export const meta: ComponentMeta<SliderProps> = {
  args: { label: "Screen brightness", decreaseLabel: "Dimmer", increaseLabel: "Brighter", defaultValue: 100 },
  examples: { Volume: { label: "Volume", decreaseLabel: "Quieter", increaseLabel: "Louder", defaultValue: 60 } },
  bounds: { defaultValue: [0, 100] },
  decorator: (story) => <div className="w-[804px] rounded-window bg-panel px-7 py-[26px]">{story()}</div>,
  play: {
    Default: async ({ args, canvasElement }: { args: SliderProps; canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole("button", { name: "Brighter" }));
      await userEvent.click(canvas.getByRole("button", { name: "Dimmer" }));
      await userEvent.click(canvas.getByRole("button", { name: "Dimmer" }));
      await expect(canvas.getByRole("slider", { name: "Screen brightness" }).getAttribute("aria-valuenow")).toBe("80");
      await expect(args.onValueChange).toHaveBeenLastCalledWith(80);
      await userEvent.click(canvas.getByRole("button", { name: "Brighter" }));
      await userEvent.click(canvas.getByRole("button", { name: "Brighter" }));
      await expect(canvas.getByRole("slider", { name: "Screen brightness" }).getAttribute("aria-valuenow")).toBe("100");
    },
  },
};

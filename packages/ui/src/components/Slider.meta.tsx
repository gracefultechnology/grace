import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { SliderProps } from "./Slider.tsx";

const changed = fn();

export const meta: ComponentMeta<SliderProps> = {
  args: { label: "Screen brightness", decreaseLabel: "Dimmer", increaseLabel: "Brighter", defaultValue: 100, onValueChange: changed },
  examples: { Volume: { label: "Volume", decreaseLabel: "Quieter", increaseLabel: "Louder", defaultValue: 60 } },
  bounds: { defaultValue: [0, 100] },
  decorator: (story) => <div className="w-[804px] rounded-window bg-panel px-7 py-[26px]">{story()}</div>,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      changed.mockClear();
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole("button", { name: "Brighter" }));
      await userEvent.click(canvas.getByRole("button", { name: "Dimmer" }));
      await userEvent.click(canvas.getByRole("button", { name: "Dimmer" }));
      await expect(canvas.getByRole("slider", { name: "Screen brightness" }).getAttribute("aria-valuenow")).toBe("80");
      await expect(changed).toHaveBeenLastCalledWith(80);
      await userEvent.click(canvas.getByRole("button", { name: "Brighter" }));
      await userEvent.click(canvas.getByRole("button", { name: "Brighter" }));
      const slider = canvas.getByRole("slider", { name: "Screen brightness" });
      await expect(slider.getAttribute("aria-valuenow")).toBe("100");
      changed.mockClear();
      const track = slider.parentElement?.closest<HTMLElement>("[data-orientation]");
      if (!track) throw new Error("no slider track");
      const { left, width, top, height } = track.getBoundingClientRect();
      const at = (part: number) => ({ target: track, coords: { clientX: left + width * part, clientY: top + height / 2 } });
      await userEvent.pointer([{ keys: "[MouseLeft>]", ...at(0.9) }, at(0.7), at(0.5), { keys: "[/MouseLeft]", ...at(0.5) }]);
      await expect(changed).toHaveBeenCalledTimes(1);
      await expect(changed).toHaveBeenLastCalledWith(Number(slider.getAttribute("aria-valuenow")));
    },
  },
};

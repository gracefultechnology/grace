import { expect, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { SegmentedControlProps } from "./SegmentedControl.tsx";

const sizes = ["Smaller", "Normal", "Larger", "Largest"].map((t) => ({ value: t, label: t }));

export const meta: ComponentMeta<SegmentedControlProps> = {
  // prototype Settings › Text size.
  args: { "aria-label": "Text size", options: sizes, defaultValue: "Normal" },
  examples: {
    // prototype Calendar › New appointment, "Repeats".
    "In a field": { "aria-label": "Repeats", size: "sm", className: "w-[527px]", options: ["Never", "Every week", "Every month"].map((t) => ({ value: t, label: t })), defaultValue: "Never" },
  },
  // prototype Settings › Text size: the control spans the 804px page.
  decorator: (story) => <div className="w-[852px] bg-background p-6">{story()}</div>,
  play: {
    Default: async ({ args, canvasElement }: { args: SegmentedControlProps; canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole("radio", { name: "Larger" }));
      await userEvent.click(canvas.getByRole("radio", { name: "Larger" }));
      await expect(canvas.getByRole("radio", { name: "Larger" }).getAttribute("aria-checked")).toBe("true");
      await expect(args.onValueChange).toHaveBeenCalledTimes(1);
      await userEvent.click(canvas.getByRole("radio", { name: "Normal" }));
      await expect(args.onValueChange).toHaveBeenLastCalledWith("Normal");
    },
  },
};

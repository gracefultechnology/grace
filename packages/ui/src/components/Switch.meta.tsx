import { expect, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { SwitchProps } from "./Switch.tsx";

export const meta: ComponentMeta<SwitchProps> = {
  args: { "aria-label": "Dim the screen at night", defaultChecked: true },
  examples: {
    Off: { defaultChecked: false },
    Small: { size: "sm" },
    "Small off": { size: "sm", defaultChecked: false },
  },
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const control = within(canvasElement).getByRole("switch", { name: "Dim the screen at night" });
      await userEvent.click(control);
      await expect(control.getAttribute("aria-checked")).toBe("false");
      await userEvent.keyboard(" ");
      await expect(control.getAttribute("aria-checked")).toBe("true");
    },
  },
};

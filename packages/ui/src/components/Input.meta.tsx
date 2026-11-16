import { expect, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { InputProps } from "./Input.tsx";

export const meta: ComponentMeta<InputProps> = {
  args: { "aria-label": "What", placeholder: "For example: Bridge club" },
  decorator: (story) => <div className="w-[1130px] bg-background p-6">{story()}</div>,
  play: {
    Error: ({ canvasElement }: { canvasElement: HTMLElement }) => expect(within(canvasElement).getByRole("textbox", { name: "What" }).getAttribute("aria-invalid")).toBe("true"),
  },
};

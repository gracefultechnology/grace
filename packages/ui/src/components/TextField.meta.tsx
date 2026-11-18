import { Calendar } from "lucide-react";
import { expect, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { Button } from "./Button.tsx";
import type { TextFieldProps } from "./TextField.tsx";

export const meta: ComponentMeta<TextFieldProps> = {
  args: { label: "What", placeholder: "For example: Bridge club" },
  examples: {
    "With action": {
      label: "Day",
      readOnly: true,
      defaultValue: "Friday, November 13",
      icon: <Calendar size={24} strokeWidth={2} aria-hidden className="shrink-0" />,
      action: <Button variant="capsule" size="compact" className="h-12 px-[18px] text-control">Change</Button>,
    },
  },
  decorator: (story) => <div className="w-[575px] bg-background p-6">{story()}</div>,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByText("What"));
      await userEvent.keyboard("Bridge club");
      await expect(canvas.getByRole<HTMLInputElement>("textbox", { name: "What" }).value).toBe("Bridge club");
    },
    Error: ({ canvasElement }: { canvasElement: HTMLElement }) => expect(within(canvasElement).getByRole("textbox", { name: "What" }).getAttribute("aria-invalid")).toBe("true"),
  },
};

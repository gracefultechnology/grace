import { CalendarDays } from "lucide-react";
import { expect, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { Button } from "./Button.tsx";
import type { TextFieldProps } from "./TextField.tsx";

// prototype Calendar › New appointment.
export const meta: ComponentMeta<TextFieldProps> = {
  args: { label: "What", placeholder: "For example: Bridge club" },
  examples: {
    "With action": {
      label: "Day",
      readOnly: true,
      defaultValue: "Friday, November 13",
      icon: <CalendarDays size={24} strokeWidth={2} aria-hidden className="shrink-0" />,
      action: <Button variant="capsule" size="compact" className="h-12 px-[18px] text-lg">Change</Button>,
    },
  },
  decorator: (story) => <div className="w-[540px] bg-background p-6">{story()}</div>,
  play: {
    // The label names the field: a tap on it puts the words there.
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByText("What"));
      await userEvent.keyboard("Bridge club");
      await expect(canvas.getByRole<HTMLInputElement>("textbox", { name: "What" }).value).toBe("Bridge club");
    },
    Error: ({ canvasElement }: { canvasElement: HTMLElement }) => expect(within(canvasElement).getByRole("textbox", { name: "What" }).getAttribute("aria-invalid")).toBe("true"),
  },
};

import { expect, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { SearchFieldProps } from "./TextField.tsx";

export const meta: ComponentMeta<SearchFieldProps> = {
  args: { label: "Search email" },
  examples: {
    Searching: { defaultValue: "Susan" },
    "Recipient picker": { label: "Who is it to?", placeholder: "Type a name or email address" },
  },
  decorator: (story) => <div className="w-[840px] bg-background p-6">{story()}</div>,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const field = within(canvasElement).getByRole<HTMLInputElement>("searchbox", { name: "Search email" });
      await userEvent.type(field, "Susan");
      await expect(field.value).toBe("Susan");
    },
  },
};

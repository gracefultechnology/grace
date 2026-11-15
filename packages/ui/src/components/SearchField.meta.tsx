import { expect, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { SearchFieldProps } from "./TextField.tsx";

// prototype Email › Inbox.
export const meta: ComponentMeta<SearchFieldProps> = {
  args: { label: "Search email" },
  decorator: (story) => <div className="w-[840px] bg-background p-6">{story()}</div>,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const field = within(canvasElement).getByRole<HTMLInputElement>("searchbox", { name: "Search email" });
      await userEvent.type(field, "Susan");
      await expect(field.value).toBe("Susan");
    },
  },
};

import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { NewTabPageProps } from "./NewTabPage.tsx";

const open = fn();

export const meta: ComponentMeta<NewTabPageProps> = {
  examples: {
    "Recent websites": {
      shortcuts: [
        { url: "https://chase.com", title: "Chase" },
        { url: "https://riversidelibrary.org", title: "Riverside Library" },
        { url: "https://weather.gov", title: "Weather" },
      ],
      onOpenShortcut: open,
    },
  },
  // Prototype `.site`: the page area under the toolbar, 1130×644.
  decorator: (story) => <div className="h-[644px] w-[1130px]">{story()}</div>,
  play: {
    "Recent websites": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Chase" }));
      await expect(open).toHaveBeenCalledWith("https://chase.com");
    },
  },
};

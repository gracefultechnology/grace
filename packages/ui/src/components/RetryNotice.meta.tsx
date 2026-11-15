import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { RetryNoticeProps } from "./RetryNotice.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

const retry = fn();

export const meta: ComponentMeta<RetryNoticeProps> = {
  args: { children: "Your choices aren’t saved yet. They’re still in use on this tablet.", onRetry: retry },
  examples: {
    "No retry": { children: "The screen brightness couldn’t be changed.", onRetry: undefined },
  },
  decorator: settingsPage,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Try again" }));
      await expect(retry).toHaveBeenCalled();
    },
  },
};

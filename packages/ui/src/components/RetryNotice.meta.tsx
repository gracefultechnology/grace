import { fn } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { tapCalls } from "./Button.meta.tsx";
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
    Default: tapCalls("Try again", retry),
  },
};

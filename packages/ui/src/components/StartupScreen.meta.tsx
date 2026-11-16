import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { StartupScreenProps } from "./StartupScreen.tsx";
import { TabletScreen } from "./TabletScreen.tsx";

const onRetry = fn();

const failed: StartupScreenProps = { state: "failed", message: "The tablet couldn’t reach Grace’s service. Your calendar, email and files are safe.", onRetry };

export const meta: ComponentMeta<StartupScreenProps> = {
  args: { state: "starting" },
  examples: { "State Failed": failed },
  decorator: (story) => <TabletScreen background="frame">{story()}</TabletScreen>,
  play: {
    "State Failed": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const retry = within(canvasElement).getByRole("button", { name: "Try again" });
      await userEvent.click(retry);
      await expect(onRetry).toHaveBeenCalled();
      retry.blur();
    },
  },
};

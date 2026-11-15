import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { BrowserPageStateProps } from "./BrowserPageState.tsx";
import { unfocus } from "./MailApp.meta.tsx";

const retry = fn();
const back = fn();

export const meta: ComponentMeta<BrowserPageStateProps> = {
  // The prototype's one website, which did not answer.
  args: { kind: "failed", site: "chase.com", message: "The website took too long to answer.", onRetry: retry },
  examples: {
    Offline: { kind: "offline", message: "Websites will open once the tablet is back on Wi-Fi.", onFixWifi: fn() },
    // The prototype's scam email's website, reported as harmful: Back, and no way past it.
    Blocked: { kind: "blocked", site: "acc0unt-help.co", message: "This website has been reported as harmful. Grace won’t open it.", onBack: back },
    Checking: { kind: "checking" },
  },
  // Prototype `.site`: the page area under the toolbar, 1130×644.
  decorator: (story) => <div className="h-[644px] w-[1130px]">{story()}</div>,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      retry.mockClear();
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Try again" }));
      await expect(retry).toHaveBeenCalledTimes(1);
      unfocus();
    },
    // Back is the only way out of a blocked page.
    Blocked: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const page = within(canvasElement);
      await expect(page.getAllByRole("button").map((b) => b.textContent)).toEqual(["Back"]);
      await userEvent.click(page.getByRole("button", { name: "Back" }));
      await expect(back).toHaveBeenCalled();
      unfocus();
    },
  },
};

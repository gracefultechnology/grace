import { expect, fn, screen, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { BrowserNoticeDialogProps } from "./BrowserNoticeDialog.tsx";
import { onBrowser } from "./BrowserWindow.meta.tsx";

const close = fn();
const retry = fn();

export const meta: ComponentMeta<BrowserNoticeDialogProps> = {
  // Android refused the camera and microphone the person allowed.
  args: { title: "The tablet didn’t allow the camera", message: "chase.com can’t use the camera or microphone. You can allow them in Settings.", onClose: close },
  examples: {
    "App not opened": { title: "Maps didn’t open", message: "No app on this tablet could open the place." },
    "No file picker": { title: "Files didn’t open", message: "The website got no file." },
    // Clearing browsing data did not finish: Try again, or close the notice.
    "Not cleared": { title: "Your browsing data wasn’t cleared", message: "Websites may still have you signed in.", actionLabel: "Try again", onAction: retry },
  },
  decorator: (story) => onBrowser(story),
  play: {
    // It stays until closed: Close and Escape both close it.
    Default: async () => {
      close.mockClear();
      await userEvent.click(within(screen.getByRole("dialog", { name: "The tablet didn’t allow the camera" })).getByRole("button", { name: "Close" }));
      await userEvent.keyboard("{Escape}");
      await expect(close).toHaveBeenCalledTimes(2);
    },
    "Not cleared": async () => {
      retry.mockClear();
      await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Try again" }));
      await expect(retry).toHaveBeenCalledTimes(1);
    },
  },
};

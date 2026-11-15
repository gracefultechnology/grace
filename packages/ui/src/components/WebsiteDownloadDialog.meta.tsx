import { expect, fn, screen, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { onBrowser } from "./BrowserWindow.meta.tsx";
import type { WebsiteDownloadDialogProps } from "./WebsiteDownloadDialog.tsx";
import { unfocus } from "./MailApp.meta.tsx";

const save = fn();
const decline = fn();

export const meta: ComponentMeta<WebsiteDownloadDialogProps> = {
  // The prototype's bank offers a document, named as in Files (`FILES`).
  args: { offer: { site: "chase.com", name: "Medicare summary.pdf", size: "240 KB" }, onSave: save, onDecline: decline },
  examples: { "Without size": { offer: { site: "chase.com", name: "Visit form.pdf" } } },
  decorator: (story) => onBrowser(story),
  play: {
    // Nothing is saved but by Save; Escape is Don't save.
    Default: async () => {
      save.mockClear();
      decline.mockClear();
      const offer = within(screen.getByRole("dialog", { name: "chase.com offers a file" }));
      await userEvent.click(offer.getByRole("button", { name: "Save" }));
      await userEvent.keyboard("{Escape}");
      await expect([save.mock.calls.length, decline.mock.calls.length]).toEqual([1, 1]);
      unfocus();
    },
  },
};

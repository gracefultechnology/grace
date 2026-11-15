import { expect, fn, screen, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { onBrowser } from "./BrowserWindow.meta.tsx";
import type { WebsiteFileRequestDialogProps } from "./WebsiteFileRequestDialog.tsx";

const choose = fn();
const cancel = fn();

export const meta: ComponentMeta<WebsiteFileRequestDialogProps> = {
  args: { site: "chase.com", onChoose: choose, onCancel: cancel },
  decorator: (story) => onBrowser(story),
  play: {
    Default: async () => {
      choose.mockClear();
      cancel.mockClear();
      const request = within(screen.getByRole("dialog", { name: "chase.com wants a photo or document" }));
      await userEvent.click(request.getByRole("button", { name: "Choose a file" }));
      await userEvent.click(request.getByRole("button", { name: "Cancel" }));
      await expect([choose.mock.calls.length, cancel.mock.calls.length]).toEqual([1, 1]);
    },
  },
};

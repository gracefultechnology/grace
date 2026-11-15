import { expect, fn, screen, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { onBrowser } from "./BrowserWindow.meta.tsx";
import type { SitePermissionDialogProps } from "./SitePermissionDialog.tsx";
import { unfocus } from "./MailApp.meta.tsx";

const allow = fn();
const deny = fn();

export const meta: ComponentMeta<SitePermissionDialogProps> = {
  // A video visit on the prototype's bank's website: camera and microphone, answered together.
  args: { site: "chase.com", devices: ["camera", "microphone"], onAllow: allow, onDeny: deny },
  examples: {
    Location: { devices: ["location"] },
  },
  decorator: (story) => onBrowser(story),
  play: {
    Default: async () => {
      allow.mockClear();
      deny.mockClear();
      const question = within(screen.getByRole("dialog", { name: "chase.com wants to use your camera and microphone" }));
      await userEvent.click(question.getByRole("button", { name: "Allow" }));
      await userEvent.keyboard("{Escape}");
      await expect([allow.mock.calls.length, deny.mock.calls.length]).toEqual([1, 1]);
      unfocus();
    },
    // While Android asks, neither answer can be given again.
    Waiting: async () => {
      const question = within(screen.getByRole("dialog"));
      await expect([question.getByRole("status").textContent, question.getByRole("button", { name: "Don’t allow" }).hasAttribute("disabled")]).toEqual(["Asking the tablet…", true]);
      unfocus();
    },
  },
};

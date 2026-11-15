import { expect, fn, screen, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { onBrowser } from "./BrowserWindow.meta.tsx";
import type { RefusedSignInDialogProps } from "./RefusedSignInDialog.tsx";

const go = fn();
const stay = fn();

export const meta: ComponentMeta<RefusedSignInDialogProps> = {
  args: { provider: "Google", site: "chase.com", onContinue: go, onCancel: stay },
  examples: { Facebook: { provider: "Facebook" } },
  decorator: (story) => onBrowser(story, "chase.com"),
  play: {
    Default: async () => {
      go.mockClear();
      stay.mockClear();
      const question = within(screen.getByRole("dialog", { name: "Sign in with Google won’t work inside Grace" }));
      await userEvent.click(question.getByRole("button", { name: "Continue in the phone’s browser" }));
      await userEvent.keyboard("{Escape}");
      await expect([go.mock.calls.length, stay.mock.calls.length]).toEqual([1, 1]);
    },
  },
};

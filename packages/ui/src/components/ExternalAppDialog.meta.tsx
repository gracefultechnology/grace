import { expect, fn, screen, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { onBrowser } from "./BrowserWindow.meta.tsx";
import type { ExternalAppDialogProps } from "./ExternalAppDialog.tsx";
import { unfocus } from "./MailApp.meta.tsx";

const go = fn();
const stay = fn();

export const meta: ComponentMeta<ExternalAppDialogProps> = {
  // A phone number tapped on the prototype's bank's website.
  args: { kind: "call", target: "555-0100", canOpen: true, onContinue: go, onCancel: stay },
  examples: {
    Map: { kind: "map", target: "Main St Clinic" },
    "Cannot open": { kind: "other", target: "intent://grace", canOpen: false },
  },
  decorator: (story) => onBrowser(story),
  play: {
    Default: async () => {
      go.mockClear();
      stay.mockClear();
      const question = within(screen.getByRole("dialog", { name: "Call 555-0100?" }));
      await userEvent.click(question.getByRole("button", { name: "Continue" }));
      await userEvent.click(question.getByRole("button", { name: "Cancel" }));
      await expect([go.mock.calls.length, stay.mock.calls.length]).toEqual([1, 1]);
      unfocus();
    },
    // Never a Continue that would fail.
    "Cannot open": async () => {
      await expect(within(screen.getByRole("dialog")).getAllByRole("button").map((b) => b.textContent)).toEqual(["Close"]);
      unfocus();
    },
  },
};

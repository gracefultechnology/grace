import { expect, fn, screen, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { onBrowser } from "./BrowserWindow.meta.tsx";
import type { WebsiteMessageDialogProps } from "./WebsiteMessageDialog.tsx";
import { unfocus } from "./MailApp.meta.tsx";

const answer = fn();
const typed = fn();
const left = fn();

const dialog = () => within(screen.getByRole("dialog"));

export const meta: ComponentMeta<WebsiteMessageDialogProps> = {
  // The prototype's bank, on its payment page, warns that the session is ending.
  args: { kind: "alert", site: "chase.com", message: "For your security, you will be signed out in 2 minutes.", onAnswer: answer },
  examples: {
    Question: { kind: "confirm", message: "Cancel this payment?" },
    "Text box": { kind: "prompt", message: "Give this card a nickname.", defaultText: "My card", onAnswer: typed },
    "Leave page": { kind: "beforeunload", message: "Changes you made may not be saved.", onAnswer: left },
  },
  decorator: (story) => onBrowser(story),
  play: {
    // An alert's only answer is OK; Escape is OK too.
    Default: async () => {
      answer.mockClear();
      await expect(dialog().getAllByRole("button").map((b) => b.textContent)).toEqual(["OK"]);
      await userEvent.keyboard("{Escape}");
      await expect(answer.mock.calls).toEqual([[true, undefined]]);
      unfocus();
    },
    "Text box": async () => {
      typed.mockClear();
      const field = dialog().getByRole("textbox", { name: "Your answer" });
      await userEvent.clear(field);
      await userEvent.type(field, "Visa");
      await userEvent.click(dialog().getByRole("button", { name: "OK" }));
      await expect(typed.mock.calls).toEqual([[true, "Visa"]]);
      unfocus();
    },
    // Escape keeps the page, as Stay does.
    "Leave page": async () => {
      left.mockClear();
      await expect(screen.getByRole("dialog", { name: "Leave this page?" })).toBeTruthy();
      await userEvent.keyboard("{Escape}");
      await expect(left.mock.calls).toEqual([[false, undefined]]);
      unfocus();
    },
  },
};

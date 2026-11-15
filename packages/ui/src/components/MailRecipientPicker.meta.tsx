import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { mailScreen, people, unfocus } from "./MailApp.meta.tsx";
import type { MailRecipientPickerProps } from "./MailRecipientPicker.tsx";

const pick = fn();
// The prototype's PEOPLE.
const everyone = [people.susan, people.david, people.clinic, people.linda, people.book, people.joan];

export const meta: ComponentMeta<MailRecipientPickerProps> = {
  args: { people: everyone, onPick: pick, onBack: fn(), onClose: fn(), onQueryChange: fn() },
  examples: {
    Searching: { query: "jo", people: [people.joan] },
    "A copy": { question: "Who should get a copy?", backLabel: "New email" },
  },
  decorator: mailScreen,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "David" }));
      await expect(pick).toHaveBeenCalledWith(people.david);
      unfocus();
    },
  },
};

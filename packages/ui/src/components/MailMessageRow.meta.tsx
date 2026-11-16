import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { inbox, people, unfocus } from "./MailApp.meta.tsx";
import type { MailMessageRowProps } from "./MailMessageRow.tsx";

const open = fn();

export const meta: ComponentMeta<MailMessageRowProps> = {
  args: { from: people.susan, subject: "Photos from Lily’s recital", time: "2:15 PM", unread: true, attachment: true, onOpen: open },
  examples: {
    Clinic: { ...inbox[1], onOpen: open },
    Read: { ...inbox[2], onOpen: open },
    Replied: { from: people.susan, subject: "You replied: “See you on Sunday! Love, Mo…”", time: "2:15 PM", onOpen: open },
  },
  decorator: (story) => <div className="w-[852px] bg-background p-6">{story()}</div>,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: /Susan/ }));
      await expect(open).toHaveBeenCalled();
      unfocus();
    },
  },
};

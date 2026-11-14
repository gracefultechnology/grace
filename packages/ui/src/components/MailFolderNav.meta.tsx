import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { MailFolderNavProps } from "./MailFolderNav.tsx";

const select = fn();

export const meta: ComponentMeta<MailFolderNavProps> = {
  args: { folder: "inbox", counts: { inbox: 2 }, onSelect: select },
  examples: { "With drafts": { folder: "drafts", counts: { inbox: 2, drafts: 1 } } },
  // Prototype `#awin.splitw .a-split>.a-nav`: 270px wide, the window's height less 32px.
  decorator: (story) => <div className="h-[788px] w-[302px] bg-background p-4">{story()}</div>,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: /Trash/ }));
      await expect(select).toHaveBeenCalledWith("trash");
    },
  },
};

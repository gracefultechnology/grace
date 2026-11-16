import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { unfocus } from "./MailApp.meta.tsx";
import type { MailFolderNavProps } from "./MailFolderNav.tsx";

const select = fn();

export const meta: ComponentMeta<MailFolderNavProps> = {
  args: { folder: "inbox", counts: { inbox: 2 }, onSelect: select },
  examples: { "With drafts": { folder: "drafts", counts: { inbox: 2, drafts: 1 } } },
  decorator: (story) => <div className="h-[804px] w-[302px] bg-background p-4">{story()}</div>,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: /Trash/ }));
      await expect(select).toHaveBeenCalledWith("trash");
      unfocus();
    },
  },
};

import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { mailAccounts, unfocus } from "./MailApp.meta.tsx";
import type { MailFolderNavProps } from "./MailFolderNav.tsx";

const select = fn();
const account = fn();

export const meta: ComponentMeta<MailFolderNavProps> = {
  args: { folder: "inbox", counts: { inbox: 2 }, onSelect: select, onAccount: account },
  examples: {
    "With drafts": { folder: "drafts", counts: { inbox: 2, drafts: 1 } },
    Outbox: { folder: "outbox", counts: { inbox: 2, outbox: 1 } },
    "All inboxes": { counts: { inbox: 3 }, accounts: mailAccounts },
    "One account": { counts: { inbox: 3 }, accounts: mailAccounts, account: 2 },
    "Account needs sign-in": { counts: { inbox: 2 }, accounts: [mailAccounts[0], { ...mailAccounts[1], needsSignIn: true }] },
  },
  decorator: (story) => <div className="h-[804px] w-[302px] bg-background p-4">{story()}</div>,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole("button", { name: /Trash/ }));
      await expect(select).toHaveBeenCalledWith("trash");
      await expect(canvas.queryByRole("button", { name: /Outbox/ })).toBeNull();
      unfocus();
    },
    "All inboxes": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole("button", { name: /Outlook/ }));
      await expect(account).toHaveBeenCalledWith(2);
      await expect(canvas.getByRole("button", { name: /All inboxes/ }).getAttribute("aria-current")).toBe("page");
      unfocus();
    },
    "One account": ({ canvasElement }: { canvasElement: HTMLElement }) =>
      expect(within(canvasElement).getByRole("button", { name: /Outlook/ }).getAttribute("aria-current")).toBe("page"),
    "Account needs sign-in": ({ canvasElement }: { canvasElement: HTMLElement }) =>
      expect(within(canvasElement).getByRole("img", { name: "Needs you to sign in again" })).toBeTruthy(),
  },
};

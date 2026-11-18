import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { AccountUses, EmailAccountRowProps } from "./EmailAccountRow.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

export const allUses: AccountUses = { mail: true, calendar: true, contacts: true };

const open = fn();

export const meta: ComponentMeta<EmailAccountRowProps> = {
  args: { address: "margaret.h@gmail.com", provider: "gmail", uses: allUses, status: "connected", colour: 1, onOpen: open },
  examples: {
    "Needs sign in": { address: "margaret@outlook.com", provider: "outlook", colour: 2, status: "needsSignIn" },
    "Nothing turned on": { uses: { mail: false, calendar: false, contacts: false } },
    "Grace points at it": { status: "needsSignIn", address: "margaret@outlook.com", provider: "outlook", colour: 2, guide: { kind: "instruction", title: "Tap your Outlook email", onClose: fn() } },
    "Other email": { address: "margaret@riverview.net", provider: "other", colour: 3, uses: { ...allUses, calendar: false } },
  },
  decorator: settingsPage,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      open.mockClear();
      const row = within(canvasElement).getByRole("button", { name: /margaret\.h@gmail\.com/ });
      await expect(row).toHaveTextContent("Gmail · Email, calendar, contacts");
      await userEvent.click(row);
      await expect(open).toHaveBeenCalled();
    },
    "Needs sign in": ({ canvasElement }: { canvasElement: HTMLElement }) =>
      expect(within(canvasElement).getByRole("button", { name: /margaret@outlook\.com/ })).toHaveTextContent("Outlook · Needs you to sign in again"),
  },
};

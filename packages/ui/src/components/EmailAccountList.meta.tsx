import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { EmailAccountListProps } from "./EmailAccountList.tsx";
import { EmailAccountRow } from "./EmailAccountRow.tsx";
import { allUses } from "./EmailAccountRow.meta.tsx";
import { ProviderGrid } from "./ProviderGrid.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

export const twoAccounts = (
  <>
    <EmailAccountRow address="margaret.h@gmail.com" provider="gmail" uses={allUses} status="connected" colour={1} onOpen={fn()} />
    <EmailAccountRow address="margaret@outlook.com" provider="outlook" uses={{ ...allUses, contacts: false }} status="needsSignIn" colour={2} onOpen={fn()} />
  </>
);

const add = fn();

export const meta: ComponentMeta<EmailAccountListProps> = {
  args: { children: twoAccounts, onAdd: add },
  examples: {
    "No email yet": { empty: true, children: <ProviderGrid onChoose={fn()} onAskGrace={fn()} /> },
    "Grace points at Add": { guide: { targetId: "add", kind: "instruction", title: "Tap Add another email", onClose: fn() } },
    "Add refused": { onAdd: undefined },
  },
  decorator: settingsPage,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      add.mockClear();
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Add another email" }));
      await expect(add).toHaveBeenCalled();
    },
    "Add refused": ({ canvasElement }: { canvasElement: HTMLElement }) => expect(within(canvasElement).getByRole("button", { name: "Add another email" })).toBeDisabled(),
    "No email yet": ({ canvasElement }: { canvasElement: HTMLElement }) => expect(within(canvasElement).queryByRole("button", { name: "Add another email" })).toBeNull(),
  },
};

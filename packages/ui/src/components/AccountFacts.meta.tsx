import type { ComponentMeta } from "vibestack/stories";
import type { AccountFactsProps } from "./AccountFacts.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

export const meta: ComponentMeta<AccountFactsProps> = {
  args: {
    facts: [
      { label: "Signed in", value: "margaret.s@gmail.com" },
      { label: "Email", value: "Connected" },
    ],
  },
  decorator: settingsPage,
};

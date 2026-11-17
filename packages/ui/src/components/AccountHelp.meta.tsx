import type { ComponentMeta } from "vibestack/stories";
import type { AccountHelpProps } from "./AccountHelp.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

export const meta: ComponentMeta<AccountHelpProps> = {
  args: { support: "help@example.com" },
  decorator: settingsPage,
};

import type { ComponentMeta } from "vibestack/stories";
import type { WifiNetworkRowProps } from "./WifiNetworkRow.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

export const meta: ComponentMeta<WifiNetworkRowProps> = {
  // A locked network nearby (prototype `X.wifi.nets`).
  args: { name: "Sunrise Community Center", signal: 2, locked: true, onClick: () => {} },
  examples: {
    Open: { name: "Riverside Library Guest", locked: false },
    Weak: { name: "Xfinity WiFi", signal: 1, locked: false },
  },
  states: {
    Connected: { name: "Home Network", signal: 3, connected: true, onClick: undefined },
  },
  decorator: settingsPage,
};

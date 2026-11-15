import type { ComponentMeta } from "vibestack/stories";
import type { SettingsPageHeadingProps } from "./SettingsPageHeading.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

export const meta: ComponentMeta<SettingsPageHeadingProps> = {
  args: { children: "Text size" },
  decorator: settingsPage,
};

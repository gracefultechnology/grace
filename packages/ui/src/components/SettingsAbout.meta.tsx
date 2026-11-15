import type { ComponentMeta } from "vibestack/stories";
import type { SettingsAboutProps } from "./SettingsAbout.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

export const meta: ComponentMeta<SettingsAboutProps> = {
  args: { device: "Grace tablet · Prototype", status: "Everything is up to date." },
  decorator: settingsPage,
};

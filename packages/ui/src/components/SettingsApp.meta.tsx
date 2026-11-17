import type { ReactNode } from "react";
import { House, Settings, Volume2, Wifi } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { AccountOverview } from "./AccountOverview.tsx";
import { AskGraceButton } from "./AskGraceButton.tsx";
import { Rail, RailButton } from "./Rail.tsx";
import { SettingsApp, type SettingsAppProps, type SettingsPage } from "./SettingsApp.tsx";
import { SettingsBrightness } from "./SettingsBrightness.tsx";
import { SettingsPrivacy } from "./SettingsPrivacy.tsx";
import { savedDetails } from "./SettingsPrivacy.meta.tsx";
import { SettingsTextSize } from "./SettingsTextSize.tsx";
import { SettingsVoice } from "./SettingsVoice.tsx";
import { TabletScreen } from "./TabletScreen.tsx";
import { WifiJoinForm } from "./WifiJoinForm.tsx";
import { WifiNetworkList } from "./WifiNetworkList.tsx";
import { current, nearby } from "./WifiNetworkList.meta.tsx";

const icon = { size: 28, strokeWidth: 1.9, "aria-hidden": true } as const;

export const onTablet = (story: () => ReactNode, open?: "Settings") => (
  <TabletScreen>
    <Rail
      battery={75}
      time="8:57"
      period="PM"
      date="Fri, Nov 13"
      aria-label="Tablet"
      status={<RailButton icon={<Wifi {...icon} />} label="Wi-Fi" />}
      footer={<RailButton icon={<Settings {...icon} />} label="Settings" selected={open === "Settings"} />}
      ask={<AskGraceButton />}
    >
      <RailButton icon={<House {...icon} />} label="Home" />
      <RailButton icon={<Volume2 {...icon} />} label="Volume" />
    </Rail>
    {story()}
  </TabletScreen>
);

export const overWifiPage = (story: () => ReactNode) =>
  onTablet(
    () => (
      <>
        <SettingsApp page="wifi" onClose={() => {}}>
          <WifiNetworkList current={current} networks={nearby} />
        </SettingsApp>
        {story()}
      </>
    ),
    "Settings",
  );

export const textSizes = ["Smaller", "Normal", "Larger", "Largest"];
export const speeds = [
  { value: "0.8", label: "Slower" },
  { value: "1", label: "Normal" },
  { value: "1.15", label: "Faster" },
];
export const textSizePreview = { greeting: "Good morning, Margaret", eventWhen: "SAT 10 am", eventTitle: "Doctor’s appointment", graceMessage: "Your doctor’s appointment is tomorrow at 10 am." };

const pick = fn();
const retrySave = fn();
const appPages: SettingsPage[] = ["text-size", "brightness", "voice", "wifi", "account", "privacy", "about"];

export const meta: ComponentMeta<SettingsAppProps> = {
  args: { page: "text-size", onPageChange: pick, onClose: fn(), children: <SettingsTextSize sizes={textSizes} value="Normal" {...textSizePreview} /> },
  examples: {
    Voice: { page: "voice", children: <SettingsVoice speeds={speeds} speed="1" speaks wake="unavailable" /> },
    "Wi-Fi": { page: "wifi", children: <WifiNetworkList current={current} networks={nearby} /> },
    "Wi-Fi join": {
      page: "wifi",
      backLabel: "Wi-Fi",
      onBack: fn(),
      children: <WifiJoinForm network="Sunrise Community Center" account userPlaceholder="For example: margaret" error="That account name or password didn’t work. Check both and try again." askGrace onAskGrace={fn()} />,
    },
    "Grace Points At Largest": {
      children: (
        <SettingsTextSize sizes={textSizes} value="Normal" {...textSizePreview} guide={{ targetId: "Largest", kind: "instruction", title: "Tap Largest", onClose: fn() }} />
      ),
    },
    "Header Mode Large": { headerMode: "large" },
    "Header Mode Large, Wi-Fi join": { headerMode: "large", page: "wifi", pageTitle: "Join Home Network", backLabel: "Wi-Fi", onBack: fn(), children: <WifiJoinForm network="Home Network" /> },
    "Header Mode None": { headerMode: "none", page: "wifi", backLabel: "Wi-Fi", onBack: fn(), children: <WifiJoinForm network="Home Network" /> },
    "Not saved": { saveError: "Your choices aren’t saved yet. They’re still in use on this tablet.", onRetrySave: retrySave },
    "Brightness not changed": {
      page: "brightness",
      saveError: "The screen brightness couldn’t be changed.",
      children: <SettingsBrightness brightness={100} nightDim nightDimHint="From 9 pm to 7 am, easier on the eyes" />,
    },
    Account: {
      page: "account",
      pages: appPages,
      children: <AccountOverview access="active" account="margaret.s@example.com" mailConnected support="help@example.com" onSignOut={fn()} />,
    },
    "Saved details": { page: "privacy", pages: appPages, children: <SettingsPrivacy details={savedDetails} /> },
  },
  decorator: (story) => onTablet(story, "Settings"),
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const list = within(within(canvasElement).getByRole("navigation", { name: "Settings" }));
      await expect(list.getByRole("button", { name: "Text size" }).getAttribute("aria-current")).toBe("page");
      await userEvent.click(list.getByRole("button", { name: "Wi-Fi" }));
      await expect(pick).toHaveBeenCalledWith("wifi");
    },
    "Header Mode Large": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await expect(canvas.getAllByRole("heading", { name: "Text size" })).toHaveLength(1);
      await expect(canvas.getByRole("button", { name: "Close Settings" })).toBeVisible();
    },
    "Not saved": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Try again" }));
      await expect(retrySave).toHaveBeenCalled();
    },
  },
};

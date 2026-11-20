import type { ReactNode } from "react";
import { House, Settings, Volume2, Wifi } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { AccountOverview } from "./AccountOverview.tsx";
import { AskGraceButton } from "./AskGraceButton.tsx";
import { EmailAccountList } from "./EmailAccountList.tsx";
import { twoAccounts } from "./EmailAccountList.meta.tsx";
import { EmailAccountPage } from "./EmailAccountPage.tsx";
import { allUses } from "./EmailAccountRow.meta.tsx";
import { OtherEmailForm } from "./OtherEmailForm.tsx";
import { ProviderGrid } from "./ProviderGrid.tsx";
import { Rail, RailButton } from "./Rail.tsx";
import { SettingsApp, type SettingsAppProps, type SettingsPage } from "./SettingsApp.tsx";
import { SettingsBrightness } from "./SettingsBrightness.tsx";
import { SettingsPrivacy } from "./SettingsPrivacy.tsx";
import { savedDetails } from "./SettingsPrivacy.meta.tsx";
import { SettingsTextSize } from "./SettingsTextSize.tsx";
import { SettingsVoice } from "./SettingsVoice.tsx";
import { ScreenSlot, TabletScreen } from "./TabletScreen.tsx";
import { WifiJoinForm } from "./WifiJoinForm.tsx";
import { WifiNetworkList } from "./WifiNetworkList.tsx";
import { current, nearby } from "./WifiNetworkList.meta.tsx";

const icon = { size: 28, strokeWidth: 1.9, "aria-hidden": true } as const;

export const onTablet = (story: () => ReactNode, open?: "Settings", over?: ReactNode) => (
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
    <ScreenSlot>{story()}</ScreenSlot>
    {over}
  </TabletScreen>
);

export const overWifiPage = (story: () => ReactNode) =>
  onTablet(
    () => (
      <SettingsApp page="wifi" onClose={() => {}}>
        <WifiNetworkList current={current} networks={nearby} />
      </SettingsApp>
    ),
    "Settings",
    story(),
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
const appPages: SettingsPage[] = ["text-size", "brightness", "voice", "wifi", "email-calendar", "account", "privacy", "about"];
const emailBack = { backLabel: "Email & calendar", onBack: fn() };

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
    "Email & calendar": { page: "email-calendar", children: <EmailAccountList onAdd={fn()}>{twoAccounts}</EmailAccountList> },
    "No email yet": {
      page: "email-calendar",
      children: (
        <EmailAccountList empty>
          <ProviderGrid onChoose={fn()} onAskGrace={fn()} />
        </EmailAccountList>
      ),
    },
    "Add an email": { page: "email-calendar", pageTitle: "Add an email", ...emailBack, children: <ProviderGrid bare onChoose={fn()} /> },
    "Email account": {
      page: "email-calendar",
      pageTitle: "Gmail",
      ...emailBack,
      children: <EmailAccountPage address="margaret.h@gmail.com" provider="gmail" status="connected" uses={allUses} colour={1} onUseChange={fn()} onRemove={fn()} />,
    },
    "Other email": { page: "email-calendar", pageTitle: "Other email", backLabel: "Add an email", onBack: fn(), children: <OtherEmailForm defaultName="Margaret Hill" onNext={fn()} onCancel={fn()} /> },
    "Grace Points At Largest": {
      children: (
        <SettingsTextSize sizes={textSizes} value="Normal" {...textSizePreview} guide={{ targetId: "Largest", kind: "instruction", title: "Tap Largest", onClose: fn() }} />
      ),
    },
    "Grace points at Email & calendar": { guide: { targetId: "email-calendar", kind: "instruction", title: "Tap Email & calendar", onClose: fn() } },
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
      await userEvent.click(list.getByRole("button", { name: "Email & calendar" }));
      await expect(pick).toHaveBeenCalledWith("email-calendar");
    },
    "Not saved": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Try again" }));
      await expect(retrySave).toHaveBeenCalled();
    },
  },
};

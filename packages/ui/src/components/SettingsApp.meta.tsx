import type { ReactNode } from "react";
import { House, Settings, Volume2, Wifi } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { AskGraceButton } from "./AskGraceButton.tsx";
import { Rail, RailButton } from "./Rail.tsx";
import type { SettingsAppProps, SettingsPage } from "./SettingsApp.tsx";
import { SettingsAbout } from "./SettingsAbout.tsx";
import { voiceCredits } from "./SettingsAbout.meta.tsx";
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

/** The prototype's screen at 8:57 PM on Friday, November 13: the rail, with Settings raised while it is open. */
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

// Prototype `TS` and `[['Slower',.8],['Normal',1],['Faster',1.15]]`.
export const textSizes = ["Smaller", "Normal", "Larger", "Largest"];
export const speeds = [
  { value: "0.8", label: "Slower" },
  { value: "1", label: "Normal" },
  { value: "1.15", label: "Faster" },
];
// The preview on Friday evening: tomorrow is Saturday.
export const textSizePreview = { greeting: "Good morning, Margaret", eventWhen: "SAT 10 am", eventTitle: "Doctor’s appointment", graceMessage: "Your doctor’s appointment is tomorrow at 10 am." };

const pick = fn();
const retrySave = fn();
// The app's side list: the prototype's pages, with saved details before About.
const appPages: SettingsPage[] = ["text-size", "brightness", "voice", "wifi", "privacy", "about"];

export const meta: ComponentMeta<SettingsAppProps> = {
  args: { page: "text-size", onPageChange: pick, onClose: fn(), children: <SettingsTextSize sizes={textSizes} value="Normal" {...textSizePreview} /> },
  examples: {
    Brightness: { page: "brightness", children: <SettingsBrightness brightness={100} nightDim nightDimHint="From 9 pm to 7 am, easier on the eyes" /> },
    Voice: { page: "voice", children: <SettingsVoice speeds={speeds} speed="1" speaks wake /> },
    "Wi-Fi": { page: "wifi", children: <WifiNetworkList current={current} networks={nearby} /> },
    "Wi-Fi join": {
      page: "wifi",
      backLabel: "Wi-Fi",
      onBack: fn(),
      children: <WifiJoinForm network="Sunrise Community Center" account userPlaceholder="For example: margaret" error="That account name or password didn’t work. Check both and try again." onAskGrace={fn()} />,
    },
    // Prototype axGuide() with kind `instruction` on a size (JS 2072-2079): Margaret makes the words bigger herself.
    "Grace Points At Largest": {
      children: (
        <SettingsTextSize sizes={textSizes} value="Normal" {...textSizePreview} guide={{ targetId: "Largest", kind: "instruction", title: "Tap Largest", onClose: fn() }} />
      ),
    },
    // Prototype `X.hdrMode`: the large title names the page and the page leaves out its own (`axRender()`).
    "Header Mode Large": { headerMode: "large" },
    "Header Mode Large, Wi-Fi join": { headerMode: "large", page: "wifi", pageTitle: "Join Home Network", backLabel: "Wi-Fi", onBack: fn(), children: <WifiJoinForm network="Home Network" /> },
    "Header Mode None": { headerMode: "none", page: "wifi", children: <WifiNetworkList current={current} networks={nearby} /> },
    "Header Mode None, Wi-Fi join": { headerMode: "none", page: "wifi", backLabel: "Wi-Fi", onBack: fn(), children: <WifiJoinForm network="Home Network" /> },
    // spec/app/preferences.md, "Only the current storage acknowledgement confirms persistence".
    "Not saved": { saveError: "Your choices aren’t saved yet. They’re still in use on this tablet.", onRetrySave: retrySave },
    // spec/app/preferences.md, "Night dimming and sound samples use the current preference without rewriting it".
    "Brightness not changed": {
      page: "brightness",
      saveError: "The screen brightness couldn’t be changed.",
      children: <SettingsBrightness brightness={100} nightDim nightDimHint="From 9 pm to 7 am, easier on the eyes" />,
    },
    "Saved details": { page: "privacy", pages: appPages, children: <SettingsPrivacy details={savedDetails} /> },
    // Prototype "About this tablet" with the credits the app always ships; the bare page is SettingsAbout's Default.
    "About with voice software": {
      page: "about",
      pages: appPages,
      children: <SettingsAbout device="Grace tablet · Prototype" status="Everything is up to date." credits={voiceCredits} />,
    },
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

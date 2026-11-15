import type { ReactNode } from "react";
import { Info, Shield, Wifi } from "lucide-react";
import { GearIcon, SpeakerIcon } from "../icons.tsx";
import { AppWindow, type AppWindowProps } from "./AppWindow.tsx";
import { RetryNotice } from "./RetryNotice.tsx";
import { SunIcon } from "./SettingsBrightness.tsx";
import { SettingsLargeTitleContext } from "./SettingsPageHeading.tsx";
import { SideNav, SideNavItem } from "./SplitView.tsx";

/** Settings' pages, in the side list's order. */
export type SettingsPage = "text-size" | "brightness" | "voice" | "wifi" | "privacy" | "about";

const icons: Record<SettingsPage, ReactNode> = {
  "text-size": (
    // Prototype `AXP.type`: square corners, unlike Lucide's Type.
    <svg aria-hidden width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7V4h16v3" />
      <path d="M9 20h6" />
      <path d="M12 4v16" />
    </svg>
  ),
  brightness: <SunIcon size={26} />,
  voice: <SpeakerIcon className="size-[26px]" strokeWidth={2} />,
  wifi: <Wifi size={26} strokeWidth={2} aria-hidden />,
  privacy: <Shield size={26} strokeWidth={2} aria-hidden />,
  about: <Info size={26} strokeWidth={2} aria-hidden />,
};

/** The prototype's side list (`setView()`); the app adds "privacy" where saved details are kept. */
const prototypePages: SettingsPage[] = ["text-size", "brightness", "voice", "wifi", "about"];

const defaultLabels: Record<SettingsPage, string> = {
  "text-size": "Text size",
  brightness: "Brightness",
  voice: "Grace’s voice",
  wifi: "Wi-Fi",
  privacy: "Privacy",
  about: "About this tablet",
};

export type SettingsAppProps = Omit<AppWindowProps, "title" | "icon" | "nav" | "actions"> & {
  /** The page open beside the list. */
  page: SettingsPage;
  /** The pages in the side list, in order. */
  pages?: SettingsPage[];
  /** The large title, where it differs from the page's name in the list, such as "Join Home Network". */
  pageTitle?: string;
  /** Why the latest choices were not saved, across the top of the page; the choices stay in use. */
  saveError?: ReactNode;
  /** Called by Try again on `saveError`. */
  onRetrySave?: () => void;
  /** The words of Try again. */
  retryLabel?: string;
  /** Called with the page a person picks in the list. */
  onPageChange?: (page: SettingsPage) => void;
  /** The window's title. */
  title?: string;
  /** The side list's words, by page. */
  labels?: Partial<Record<SettingsPage, string>>;
  /** The open page: `SettingsTextSize`, `SettingsBrightness`, `SettingsVoice`, `WifiNetworkList` or `WifiJoinForm`, `SettingsPrivacy`, `SettingsAbout`. */
  children: ReactNode;
};

/**
 * The Settings window: its pages in a side list, the open one beside it (prototype `setView()`). With a large title the
 * title is the open page's name and the page leaves out its own (prototype `axRender()`).
 * @model spec/app/preferences.md
 * @design packages/design-system/design.md#windows
 */
export function SettingsApp({
  page,
  pages = prototypePages,
  onPageChange,
  pageTitle,
  saveError,
  onRetrySave,
  retryLabel,
  title = "Settings",
  labels,
  headerMode,
  children,
  ...props
}: SettingsAppProps) {
  const words = { ...defaultLabels, ...labels };
  const large = headerMode === "large";
  return (
    <AppWindow
      title={large ? (pageTitle ?? words[page]) : title}
      aria-label={title}
      closeLabel={`Close ${title}`}
      headerMode={headerMode}
      icon={
        <GearIcon className="size-[26px]" strokeWidth={2} />
      }
      nav={
        <SideNav aria-label={title}>
          {pages.map((item) => (
            <SideNavItem key={item} icon={icons[item]} selected={item === page} onClick={() => onPageChange?.(item)}>
              {words[item]}
            </SideNavItem>
          ))}
        </SideNav>
      }
      {...props}
    >
      {saveError != null && (
        <RetryNotice className="mb-[18px]" onRetry={onRetrySave} retryLabel={retryLabel}>
          {saveError}
        </RetryNotice>
      )}
      <SettingsLargeTitleContext value={large}>{children}</SettingsLargeTitleContext>
    </AppWindow>
  );
}

import { Fragment, type ReactNode } from "react";
import { CircleUserRound, Info, Mail, Shield, Wifi } from "lucide-react";
import { GearIcon, SpeakerIcon } from "../icons.tsx";
import { AppWindow, type AppWindowProps } from "./AppWindow.tsx";
import { guided, type Guide } from "./GuideAnchor.tsx";
import { RetryNotice } from "./RetryNotice.tsx";
import { SunIcon } from "./SettingsBrightness.tsx";
import { SideNav, SideNavItem } from "./SplitView.tsx";

export type SettingsPage = "text-size" | "brightness" | "voice" | "wifi" | "email-calendar" | "account" | "privacy" | "about";

const icons: Record<SettingsPage, ReactNode> = {
  "text-size": (
    <svg aria-hidden width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7V4h16v3" />
      <path d="M9 20h6" />
      <path d="M12 4v16" />
    </svg>
  ),
  brightness: <SunIcon size={26} />,
  voice: <SpeakerIcon className="size-[26px]" strokeWidth={2} />,
  wifi: <Wifi size={26} strokeWidth={2} aria-hidden />,
  "email-calendar": <Mail size={26} strokeWidth={2} aria-hidden />,
  account: <CircleUserRound size={26} strokeWidth={2} aria-hidden />,
  privacy: <Shield size={26} strokeWidth={2} aria-hidden />,
  about: <Info size={26} strokeWidth={2} aria-hidden />,
};

const prototypePages: SettingsPage[] = ["text-size", "brightness", "voice", "wifi", "email-calendar", "about"];

const defaultLabels: Record<SettingsPage, string> = {
  "text-size": "Text size",
  brightness: "Brightness",
  voice: "Grace’s voice",
  wifi: "Wi-Fi",
  "email-calendar": "Email & calendar",
  account: "Account",
  privacy: "Privacy",
  about: "About this tablet",
};

export type SettingsAppProps = Omit<AppWindowProps, "title" | "icon" | "nav" | "actions"> & {
  /** The page open beside the list. */
  page: SettingsPage;
  /** The pages in the side list, in order. */
  pages?: SettingsPage[];
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
  /** A sub-page's title in the header in place of the window's, beside its Back pill: "Add an email", or an email's name. */
  pageTitle?: string;
  /** The side list's words, by page. */
  labels?: Partial<Record<SettingsPage, string>>;
  /** Grace pointing at a page in the side list (prototype `nav-<page>`). */
  guide?: Guide<SettingsPage>;
  /** The open page: `SettingsTextSize`, `SettingsBrightness`, `SettingsVoice`, `WifiNetworkList` or `WifiJoinForm`, `EmailAccountList`, `EmailAccountPage`, `OtherEmailForm` or `MailServersForm`, `AccountOverview`, `SettingsPrivacy`, `SettingsAbout`. */
  children: ReactNode;
};

/**
 * The Settings window: its pages in a side list, the open one beside it (prototype `setView()`).
 * @model spec/app/preferences.md
 * @design packages/design-system/design.md#windows
 * @design packages/design-system/design.md#screens
 */
export function SettingsApp({
  page,
  pages = prototypePages,
  onPageChange,
  saveError,
  onRetrySave,
  retryLabel,
  title = "Settings",
  pageTitle,
  labels,
  guide,
  children,
  ...props
}: SettingsAppProps) {
  const words = { ...defaultLabels, ...labels };
  return (
    <AppWindow
      title={pageTitle ?? title}
      closeLabel={`Close ${title}`}
      icon={<GearIcon className="size-[26px]" strokeWidth={2} />}
      nav={
        <SideNav aria-label={title}>
          {pages.map((item) => (
            <Fragment key={item}>
              {guided(
                guide,
                item,
                <SideNavItem icon={icons[item]} selected={item === page} onClick={() => onPageChange?.(item)}>
                  {words[item]}
                </SideNavItem>,
                { radius: 22, className: "flex" },
              )}
            </Fragment>
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
      {children}
    </AppWindow>
  );
}

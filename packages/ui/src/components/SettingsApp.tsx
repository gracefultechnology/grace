import type { ReactNode } from "react";
import { Info, Sun, Type, Wifi } from "lucide-react";
import { AppWindow, type AppWindowProps } from "./AppWindow.tsx";
import { SideNav, SideNavItem } from "./SplitView.tsx";

/** Settings' pages, in the side list's order. */
export type SettingsPage = "text-size" | "brightness" | "voice" | "wifi" | "about";

const pages: { page: SettingsPage; icon: ReactNode }[] = [
  { page: "text-size", icon: <Type size={26} strokeWidth={2} aria-hidden /> },
  { page: "brightness", icon: <Sun size={26} strokeWidth={2} aria-hidden /> },
  {
    page: "voice",
    // Prototype `AXP.spk`: the older speaker with wider waves than Lucide's Volume2.
    icon: (
      <svg aria-hidden width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 5 6 9H3v6h3l5 4z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M19 5a10 10 0 0 1 0 14" />
      </svg>
    ),
  },
  { page: "wifi", icon: <Wifi size={26} strokeWidth={2} aria-hidden /> },
  { page: "about", icon: <Info size={26} strokeWidth={2} aria-hidden /> },
];

const defaultLabels: Record<SettingsPage, string> = {
  "text-size": "Text size",
  brightness: "Brightness",
  voice: "Grace’s voice",
  wifi: "Wi-Fi",
  about: "About this tablet",
};

export type SettingsAppProps = Omit<AppWindowProps, "title" | "icon" | "nav" | "headerMode" | "actions"> & {
  /** The page open beside the list. */
  page: SettingsPage;
  /** Called with the page a person picks in the list. */
  onPageChange?: (page: SettingsPage) => void;
  /** The window's title. */
  title?: string;
  /** The side list's words, by page. */
  labels?: Partial<Record<SettingsPage, string>>;
  /** The open page: `SettingsTextSize`, `SettingsBrightness`, `SettingsVoice`, `WifiNetworkList` or `WifiJoinForm`, `SettingsAbout`. */
  children: ReactNode;
};

/**
 * The Settings window: its pages in a side list, the open one beside it (prototype `setView()`).
 * @model spec/app/preferences.md
 * @design packages/design-system/design.md#windows
 */
export function SettingsApp({ page, onPageChange, title = "Settings", labels, children, ...props }: SettingsAppProps) {
  const words = { ...defaultLabels, ...labels };
  return (
    <AppWindow
      title={title}
      icon={
        // Prototype `AXP.gear`: the older gear outline, not Lucide's Settings.
        <svg aria-hidden width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      }
      nav={
        <SideNav aria-label={title}>
          {pages.map((item) => (
            <SideNavItem key={item.page} icon={item.icon} selected={item.page === page} onClick={() => onPageChange?.(item.page)}>
              {words[item.page]}
            </SideNavItem>
          ))}
        </SideNav>
      }
      {...props}
    >
      {children}
    </AppWindow>
  );
}

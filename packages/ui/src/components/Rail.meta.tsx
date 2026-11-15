import { House, Wifi } from "lucide-react";
import type { ComponentMeta } from "vibestack/stories";
import { GearIcon, SpeakerIcon, SpeakerOffIcon } from "../icons.tsx";
import { AskGraceButton } from "./AskGraceButton.tsx";
import { RailButton, type RailProps, WifiSlash } from "./Rail.tsx";
import { TabletScreen } from "./TabletScreen.tsx";

const tile = { size: 28, strokeWidth: 1.9 };
// Prototype `axi(…, 28, 1.9)`: the rail's own outlines (speaker, gear) at the Lucide icons' size.
const icon = { className: "size-7", strokeWidth: 1.9 };

type RailOptions = {
  online?: boolean;
  muted?: boolean;
  /** Classes for Wi-Fi and Volume, for a decorator that raises the button whose popover its story opens. */
  raise?: { wifi?: string; volume?: string };
  /** Classes that hide the Wi-Fi glyph and show it struck through, for a decorator whose story may be offline. */
  offline?: { wifi: string; slash: string };
};

/** The rail as Home draws it (prototype `#rail` and `railWifi()`), with one button raised. */
export const homeRail = (on: "Home" | "Wi-Fi" | "Volume" | "Settings" | "Grace" | null, { online = true, muted = false, raise = {}, offline }: RailOptions = {}): RailProps => ({
  battery: 75,
  time: "8:56",
  period: "PM",
  date: "Fri, Nov 13",
  "aria-label": "Tablet",
  status: (
    <RailButton
      icon={
        offline ? (
          <>
            <Wifi {...tile} className={offline.wifi} />
            <WifiSlash className={offline.slash} />
          </>
        ) : online ? (
          <Wifi {...tile} />
        ) : (
          <WifiSlash />
        )
      }
      label="Wi-Fi"
      aria-label={online ? "Wi-Fi" : "Wi-Fi, not connected"}
      selected={on === "Wi-Fi"}
      className={raise.wifi}
    />
  ),
  children: (
    <>
      <RailButton icon={<House {...tile} />} label="Home" selected={on === "Home"} />
      <RailButton icon={muted ? <SpeakerOffIcon {...icon} /> : <SpeakerIcon {...icon} />} label="Volume" selected={on === "Volume"} className={raise.volume} />
    </>
  ),
  footer: <RailButton icon={<GearIcon {...icon} />} label="Settings" selected={on === "Settings"} />,
  ask: <AskGraceButton selected={on === "Grace"} glow={on === "Grace" ? "off" : "rest"} />,
});

export const meta: ComponentMeta<RailProps> = {
  // Prototype `#rail` at 8:56 PM on Friday, November 13.
  args: homeRail("Home"),
  states: {
    "Volume open": homeRail("Volume"),
    "Wi-Fi open": homeRail("Wi-Fi"),
    "Grace open": homeRail("Grace"),
    // Prototype `railSel()` with the Settings app open.
    "Settings open": homeRail("Settings"),
    Offline: homeRail("Home", { online: false }),
    Muted: homeRail("Home", { muted: true }),
  },
  decorator: (story) => <TabletScreen>{story()}</TabletScreen>,
};

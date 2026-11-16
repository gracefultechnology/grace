import { House, Wifi } from "lucide-react";
import type { ComponentMeta } from "vibestack/stories";
import { GearIcon, SpeakerIcon, SpeakerOffIcon } from "../icons.tsx";
import { AskGraceButton } from "./AskGraceButton.tsx";
import { RailButton, type RailProps, WifiSlash } from "./Rail.tsx";
import { TabletScreen } from "./TabletScreen.tsx";

const tile = { size: 28, strokeWidth: 1.9 };
const icon = { className: "size-7", strokeWidth: 1.9 };

type RailOptions = {
  online?: boolean;
  muted?: boolean;
  raise?: { wifi?: string; volume?: string };
  offline?: { wifi: string; slash: string };
  grace?: { rest: string; compact: string };
};

export const homeRail = (on: "Home" | "Wi-Fi" | "Volume" | "Settings" | "Grace" | "Grace compact" | null, { online = true, muted = false, raise = {}, offline, grace }: RailOptions = {}): RailProps => {
  const home = on === "Home" || on === "Grace compact";
  const open = on === "Grace" || on === "Grace compact";
  return {
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
      <RailButton icon={<House {...tile} />} label="Home" selected={home} />
      <RailButton icon={muted ? <SpeakerOffIcon {...icon} /> : <SpeakerIcon {...icon} />} label="Volume" selected={on === "Volume"} className={raise.volume} />
    </>
  ),
  footer: <RailButton icon={<GearIcon {...icon} />} label="Settings" selected={on === "Settings"} />,
  ask: grace ? (
    <>
      <AskGraceButton className={grace.rest} />
      <AskGraceButton selected glow="off" className={grace.compact} />
    </>
  ) : (
    <AskGraceButton selected={open} glow={open ? "off" : "rest"} />
  ),
  };
};

export const meta: ComponentMeta<RailProps> = {
  args: homeRail("Home"),
  states: {
    "Volume open": homeRail("Volume"),
    "Wi-Fi open": homeRail("Wi-Fi"),
    "Grace open": homeRail("Grace"),
    "Grace compact": homeRail("Grace compact"),
    "Settings open": homeRail("Settings"),
    Offline: homeRail("Home", { online: false }),
    Muted: homeRail("Home", { muted: true }),
  },
  decorator: (story) => <TabletScreen>{story()}</TabletScreen>,
};

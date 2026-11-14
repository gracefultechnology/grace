import { House, Settings, Volume2, VolumeX, Wifi } from "lucide-react";
import type { ComponentMeta } from "vibestack/stories";
import { AskGraceButton } from "./AskGraceButton.tsx";
import { RailButton, type RailProps, WifiSlash } from "./Rail.tsx";
import { TabletScreen } from "./TabletScreen.tsx";

const icon = { size: 28, strokeWidth: 1.9 };
// Prototype `#rail` at 9:09 PM on Friday, November 13.
const rail = (on: "Home" | "Wi-Fi" | "Volume" | "Grace" | null, { online = true, muted = false } = {}): RailProps => ({
  battery: 75,
  time: "9:09",
  period: "PM",
  date: "Fri, Nov 13",
  "aria-label": "Tablet",
  status: <RailButton icon={online ? <Wifi {...icon} /> : <WifiSlash />} label="Wi-Fi" aria-label={online ? "Wi-Fi" : "Wi-Fi, not connected"} selected={on === "Wi-Fi"} />,
  children: (
    <>
      <RailButton icon={<House {...icon} />} label="Home" selected={on === "Home"} />
      <RailButton icon={muted ? <VolumeX {...icon} /> : <Volume2 {...icon} />} label="Volume" selected={on === "Volume"} />
    </>
  ),
  footer: <RailButton icon={<Settings {...icon} />} label="Settings" />,
  ask: <AskGraceButton selected={on === "Grace"} glow={on === "Grace" ? "off" : "rest"} />,
});

export const meta: ComponentMeta<RailProps> = {
  args: rail("Home"),
  states: {
    "Volume open": rail("Volume"),
    "Wi-Fi open": rail("Wi-Fi"),
    "Grace open": rail("Grace"),
    Offline: rail("Home", { online: false }),
    Muted: rail("Home", { muted: true }),
  },
  decorator: (story) => <TabletScreen>{story()}</TabletScreen>,
};

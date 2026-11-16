import { AlarmClockPlus, Wifi, X } from "lucide-react";
import type { ComponentMeta } from "vibestack/stories";
import { BellIcon } from "../icons.tsx";
import type { BannerProps } from "./Banner.tsx";
import { Button } from "./Button.tsx";
import { WifiSlash } from "./Rail.tsx";

export const reminder: BannerProps = {
  icon: <span className="flex text-alert"><BellIcon className="size-7.5" /></span>,
  title: "Doctor’s appointment",
  line: "Tomorrow at 10 am · Main St clinic",
  actions: (
    <>
      <Button variant="prominent" size="compact">See details</Button>
      <Button variant="plain" size="compact-icon" aria-label="Dismiss">
        <X aria-hidden size={24} strokeWidth={1.75} />
      </Button>
    </>
  ),
};

export const reminderSnooze: BannerProps = {
  ...reminder,
  actions: (
    <>
      <Button variant="prominent" size="compact">See details</Button>
      <Button variant="capsule" size="compact-icon" aria-label="Snooze">
        <AlarmClockPlus aria-hidden size={24} strokeWidth={2} />
      </Button>
      <Button variant="plain" size="compact-icon" aria-label="Dismiss">
        <X aria-hidden size={24} strokeWidth={1.75} />
      </Button>
    </>
  ),
};

export const offline: BannerProps = {
  icon: <WifiSlash size={30} />,
  title: "Not connected to the internet",
  line: "Grace can help you reconnect.",
  actions: (
    <Button variant="prominent" size="compact">
      <Wifi aria-hidden size={22} strokeWidth={2.2} />
      Fix Wi-Fi
    </Button>
  ),
};

export const meta: ComponentMeta<BannerProps> = {
  args: reminder,
  examples: { Snooze: reminderSnooze, Offline: offline },
  decorator: (story) => <div className="w-[682px] bg-gradient-frame-soft p-6">{story()}</div>,
};

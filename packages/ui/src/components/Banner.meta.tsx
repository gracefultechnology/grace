import { Bell, Wifi, X } from "lucide-react";
import type { ComponentMeta } from "vibestack/stories";
import type { BannerProps } from "./Banner.tsx";
import { Button } from "./Button.tsx";

export const meta: ComponentMeta<BannerProps> = {
  // The reminder on Home (prototype `drawBanner`, X.banner = "rem").
  args: {
    icon: <Bell size={30} strokeWidth={2.2} className="text-alert" />,
    title: "Doctor’s appointment",
    line: "Tomorrow at 10 am · Main St clinic",
    actions: (
      <>
        <Button variant="prominent" size="compact">See details</Button>
        <Button variant="plain" size="compact-icon" aria-label="Dismiss">
          <X size={24} strokeWidth={1.75} />
        </Button>
      </>
    ),
  },
  examples: {
    Offline: {
      icon: <Wifi size={30} strokeWidth={2} className="text-offline" />,
      title: "Not connected to the internet",
      line: "Grace can help you reconnect.",
      actions: (
        <Button variant="prominent" size="compact">
          <Wifi size={22} strokeWidth={2.2} />
          Fix Wi-Fi
        </Button>
      ),
    },
  },
  decorator: (story) => <div className="w-[634px] bg-gradient-frame p-6">{story()}</div>,
};

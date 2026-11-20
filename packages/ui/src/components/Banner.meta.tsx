import { CalendarDays, Wifi, X } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { BellIcon } from "../icons.tsx";
import { BannerButton, type BannerProps } from "./Banner.tsx";
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

const dismiss = fn();

export const connectCalendar: BannerProps = {
  tone: "dark",
  icon: <CalendarDays aria-hidden size={26} strokeWidth={2} />,
  title: "Connect your email to keep your calendar up to date",
  line: "Appointments from your email show up here automatically.",
  actions: <BannerButton>Connect email</BannerButton>,
  onDismiss: dismiss,
};

export const meta: ComponentMeta<BannerProps> = {
  args: reminder,
  examples: { Offline: offline, "Dark with Not now": connectCalendar },
  decorator: (story) => <div className="w-[682px] bg-gradient-frame-soft p-6">{story()}</div>,
  play: {
    "Dark with Not now": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Not now" }));
      await expect(dismiss).toHaveBeenCalled();
      (document.activeElement as HTMLElement | null)?.blur();
    },
  },
};

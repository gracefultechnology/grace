import { MessageSquare, Phone } from "lucide-react";
import { fn } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { onTablet } from "./CalendarApp.meta.tsx";
import type { DeviceAppHandoffProps } from "./DeviceAppHandoff.tsx";

// The original app's words (senior-care DeviceApplication.tsx).
export const meta: ComponentMeta<DeviceAppHandoffProps> = {
  args: {
    title: "Phone",
    icon: <Phone size={26} strokeWidth={2} aria-hidden />,
    text: "Choose who to call in your phone app.",
    openLabel: "Open phone",
    onOpen: fn(),
    onClose: fn(),
  },
  decorator: onTablet,
  examples: {
    Opened: { notice: "Phone app opened. Choose and confirm any call there." },
    Messages: {
      title: "Messages",
      icon: <MessageSquare size={26} strokeWidth={2} aria-hidden />,
      text: "Read or write a message in your messaging app.",
      openLabel: "Open messages",
      notice: "Messaging app opened. Review and send any message there.",
    },
    Failed: { error: "The phone app didn’t open.", errorHelp: "You can try again or close this view and continue using Grace." },
    Busy: { busy: true },
  },
};

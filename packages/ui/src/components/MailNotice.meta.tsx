import { fn } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { tapCalls } from "./Button.meta.tsx";
import type { MailNoticeProps } from "./MailNotice.tsx";

const retry = fn();

export const meta: ComponentMeta<MailNoticeProps> = {
  // A list that could not be loaded.
  args: { children: "Your email couldn’t be loaded. Try again.", actionLabel: "Try again", onAction: retry },
  examples: {
    Offline: { tone: "offline", children: "Email needs the internet to check for new mail.", actionLabel: "Fix Wi-Fi" },
    "No action": { children: "I’m not sure this email was sent. I’m checking before it can be sent again.", actionLabel: undefined },
  },
  // As wide as an email's page, on the white window.
  decorator: (story) => <div className="w-[1000px] bg-background p-6">{story()}</div>,
  play: {
    Default: tapCalls("Try again", retry, { rest: true }),
  },
};

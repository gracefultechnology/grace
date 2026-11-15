import { fn } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { BillDiscoverySettingProps } from "./BillDiscoverySetting.tsx";

// The words of the original app (senior-care apps/app/src/bill-discovery-copy.ts).
const companies = {
  about: "When this is on, Grace checks your Gmail for new bills from your bill companies, even when you haven’t asked for help. When a new bill arrives, Grace asks you on the home screen whether to pay it.",
  limits: "Grace only reads these emails, through Eliza Cloud, as for a task. Grace never starts paying a bill by itself: you decide, and you press Pay yourself on the company’s website. You can turn this off at any time.",
};
const anySender = {
  about: "When this is on, Grace looks through your new emails for anything that looks like a bill, from any company, even when you haven’t asked for help. Grace sends the likely ones through Eliza Cloud to read. Emails with a sign-in code are never sent.",
  limits: "The first time a company appears, Grace asks you on the home screen whether you pay it. Grace never starts paying a bill by itself: you decide, and you press Pay yourself on the company’s website. You can turn this off at any time.",
};

export const meta: ComponentMeta<BillDiscoverySettingProps> = {
  args: { title: "Look for new bills", ...companies, checked: false, onCheckedChange: fn() },
  decorator: (story) => <div className="w-[760px] bg-background p-6">{story()}</div>,
  examples: {
    On: { checked: true },
    "Any sender": { ...anySender, checked: true },
    "Asked again": { ...anySender, askedAgain: "Grace now looks for bills from any company, so this is off until you turn it on again." },
    Busy: { busy: true },
    "Needs Gmail": { notice: "Connect Gmail first, then turn this on." },
    Failed: { notice: "That didn’t change. Please try again in a minute.", onRetry: fn() },
  },
};

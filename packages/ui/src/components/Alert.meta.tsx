import type { ComponentMeta } from "vibestack/stories";
import type { AlertProps } from "./Alert.tsx";

export const meta: ComponentMeta<AlertProps> = {
  args: { children: "Saved to Files" },
  examples: {
    // A scam email (prototype `.a-caution`).
    Caution: { variant: "caution", children: "Grace thinks this email is a scam. Don’t tap its links." },
  },
  // The width of a read email's page.
  decorator: (story) => <div className="w-[1130px] bg-background p-6">{story()}</div>,
};

import { fn } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { ConfirmIdentityProps } from "./ConfirmIdentity.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

// The original app's words (senior-care ConfirmIdentity.tsx).
export const meta: ComponentMeta<ConfirmIdentityProps> = {
  args: { step: "start", onSend: fn(), onConfirm: fn(), onResend: fn(), onBack: fn(), onCodeChange: fn() },
  decorator: settingsPage,
  examples: {
    "Changing sign-in methods": { purpose: "changing your sign-in methods" },
    Code: { step: "code", sentTo: "m•••@example.com", code: "4829" },
    "New code sent": { step: "code", sentTo: "m•••@example.com", notice: "A new code is on its way. Use the newest one." },
    "Wrong code": { step: "code", sentTo: "m•••@example.com", problem: "That code didn’t work. Check it or send a new one." },
    "Text check": { step: "verification", checkBy: "sms" },
    "Authenticator check": { step: "verification", checkBy: "totp", code: "482913" },
    Passkey: { step: "passkey" },
    Busy: { step: "code", sentTo: "m•••@example.com", code: "482913", busy: true },
  },
};

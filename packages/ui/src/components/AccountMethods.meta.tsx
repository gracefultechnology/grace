import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { AccountMethodsProps } from "./AccountMethods.tsx";
import { ConfirmIdentity } from "./ConfirmIdentity.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

const methods = [
  { id: "email", label: "margaret.s@example.com", primary: true },
  { id: "phone", label: "(555) 214-0187", removable: true },
];
const remove = fn();

export const meta: ComponentMeta<AccountMethodsProps> = {
  args: {
    phase: "methods",
    methods,
    onCheck: fn(),
    onRemove: remove,
    onConfirmRemove: fn(),
    onKeep: fn(),
    onAddPhone: fn(),
    onVerifySecurity: fn(),
    onSecurityCheck: fn(),
    onSetUpCodes: fn(),
    onSendPhoneCode: fn(),
    onVerifyCode: fn(),
    onPhoneChange: fn(),
    onCodeChange: fn(),
  },
  decorator: settingsPage,
  examples: {
    "Not checked": { phase: "idle" },
    "Result unknown": { phase: "unknown", problem: "The change was not confirmed. Check your sign-in methods before trying again." },
    "Confirm it’s you": { phase: "verify", identity: <ConfirmIdentity step="start" purpose="changing your sign-in methods" /> },
    "Security check needed": { securityCheckRequired: true },
    "Choose a check": { phase: "security", securityChecks: ["totp", "sms"] },
    "Set up codes": { phase: "security", securityChecks: [] },
    "Link a phone": { phase: "phone", phone: "555 0123", problem: "Enter a mobile number, like (555) 555-0123. For a number outside the US, start with + and the country code." },
    Code: { phase: "code", codeFor: "phone", sentTo: "(555) 214-0187", code: "4829" },
    Remove: { phase: "remove", removing: "phone" },
    Linked: { phase: "idle", notice: "Your phone sign-in was linked. Check your methods to see the current list." },
  },
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Remove (555) 214-0187" }));
      await expect(remove).toHaveBeenCalledWith("phone");
    },
  },
};

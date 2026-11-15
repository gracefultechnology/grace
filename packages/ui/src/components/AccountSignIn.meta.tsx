import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { AccountSignInProps } from "./AccountSignIn.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

const choose = fn();

// The original app's words (senior-care NativeCloudSignIn.tsx, GoogleSignIn.tsx, account-effects.ts).
export const meta: ComponentMeta<AccountSignInProps> = {
  args: {
    step: "choose",
    google: true,
    onChoose: choose,
    onLater: fn(),
    onAddressChange: fn(),
    onCodeChange: fn(),
    onSendCode: fn(),
    onVerify: fn(),
    onResend: fn(),
    onOpenGoogle: fn(),
    onBack: fn(),
  },
  decorator: settingsPage,
  examples: {
    "Sign in again": { notice: "Grace needs you to sign in again on this tablet. Sign in with the same email address or phone number as before to keep going.", google: false },
    Email: { step: "start", method: "email", address: "margaret.s@example.com", notice: "Enter your email address. We’ll email you a 6-digit code." },
    Code: { step: "code", method: "phone", sentTo: "(555) 214-0187", code: "48", expiresIn: 9, resendIn: 24, notice: "Check your text messages and enter the six-digit sign-in code." },
    Expired: { step: "code", method: "email", sentTo: "margaret.s@example.com", code: "482913", expiresIn: 0, problem: "That code didn’t work. Check it or send a new one." },
    "Extra check": { step: "code", method: "google", verification: true, expiresIn: 5, notice: "Enter the 6-digit code from your authenticator app." },
    Passkey: {
      step: "code",
      method: "email",
      verification: true,
      passkey: true,
      notice: "This account uses a passkey for its extra check, and Grace can’t use passkeys yet, so nothing was paid or changed. To go on here, switch that check to a text message code, or turn it off, wherever you set up the passkey, then try again.",
    },
    Unavailable: { step: "unavailable", method: "phone", onRetryCheck: fn(), problem: "Account sign-in is unavailable. Check the internet connection and try again." },
    "Google waiting": { step: "waiting", method: "google", notice: "Choose your Google account in the window that opened. Grace comes back here by itself." },
    "Google closed": { step: "start", method: "google", again: true, notice: "The Google window closed before signing in. Try again, or use email or phone." },
    Saved: { step: "saved", method: "email", onFinishSaved: fn(), notice: "A saved sign-in can be finished or cancelled." },
    "Finish signing out": { step: "signing-out", onFinishSignOut: fn(), problem: "We couldn’t finish signing out yet. Try again when you’re connected." },
  },
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Continue with phone" }));
      await expect(choose).toHaveBeenCalledWith("phone");
    },
  },
};

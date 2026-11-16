import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";
import { PageHeading, PageText } from "./PageHeading.tsx";
import { RetryNotice } from "./RetryNotice.tsx";
import { SignInCodeField } from "./SignInCodeField.tsx";

export type ConfirmIdentityStep = "start" | "code" | "verification" | "passkey";

export type ConfirmIdentityLabels = {
  title: string;
  intro: (purpose: string) => string;
  send: string;
  sentTo: (destination: string) => string;
  anyDestination: string;
  textCode: string;
  authenticatorCode: string;
  confirm: string;
  resend: string;
  back: string;
  passkey: string;
};

export const confirmIdentityLabels: ConfirmIdentityLabels = {
  title: "Confirm it’s you",
  intro: (purpose) => `Before ${purpose}, we’ll send a 6-digit code to the email or phone on your account.`,
  send: "Send me a code",
  sentTo: (destination) => `Code sent to ${destination}`,
  anyDestination: "the email or phone on your account",
  textCode: "Text message verification code",
  authenticatorCode: "Authenticator code",
  confirm: "Confirm",
  resend: "Send a new code",
  back: "Back",
  passkey: "This account uses a passkey for its extra check, and Grace can’t use passkeys yet, so nothing was paid or changed. To go on here, switch that check to a text message code, or turn it off, wherever you set up the passkey, then try again. Everything else in Grace keeps working meanwhile.",
};

export type ConfirmIdentityProps = Omit<ComponentProps<"section">, "onSubmit"> & {
  step: ConfirmIdentityStep;
  /** What needs the check, inside the intro: "paying", "changing your plan", "changing your sign-in methods". */
  purpose?: string;
  /** Where the code went: "m•••@example.com". */
  sentTo?: string;
  /** The extra check's kind, which names its field. */
  checkBy?: "sms" | "totp";
  code?: string;
  onCodeChange?: (code: string) => void;
  /** A request is under way: the buttons wait. */
  busy?: boolean;
  /** What happened: "A new code is on its way. Use the newest one." */
  notice?: ReactNode;
  /** What went wrong: "That code didn’t work. Check it or send a new one." */
  problem?: ReactNode;
  onSend?: () => void;
  onConfirm?: () => void;
  onResend?: () => void;
  /** Leaves the extra check or the passkey notice. */
  onBack?: () => void;
  labels?: Partial<ConfirmIdentityLabels>;
};

/**
 * Confirms the signed-in person before a payment or an account change, outside chat and speech (senior-care
 * ConfirmIdentity.tsx): send a code, enter it, and the account's extra check where it has one.
 * @design packages/design-system/design.md#windows
 */
export function ConfirmIdentity({ step, purpose = "paying", sentTo, checkBy = "sms", code = "", onCodeChange, busy = false, notice, problem, onSend, onConfirm, onResend, onBack, labels, className, ...props }: ConfirmIdentityProps) {
  const l = { ...confirmIdentityLabels, ...labels };
  const headingId = useId();
  const back = (
    <Button variant="capsule" size="pill" disabled={busy} onClick={onBack}>
      {l.back}
    </Button>
  );
  return (
    <section aria-labelledby={headingId} aria-busy={busy || undefined} data-sensitive="true" className={cn("flex flex-col gap-4 rounded-window bg-panel px-7 py-[26px] font-sans", className)} {...props}>
      <PageHeading level="section" id={headingId}>{l.title}</PageHeading>
      {step === "start" ? (
        <>
          <PageText>{l.intro(purpose)}</PageText>
          <div>
            <Button variant="prominent" size="pill" loading={busy} onClick={onSend}>{l.send}</Button>
          </div>
        </>
      ) : step === "passkey" ? (
        <>
          <PageText>{l.passkey}</PageText>
          <div>{back}</div>
        </>
      ) : (
        <form
          className="flex flex-col items-start gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onConfirm?.();
          }}
        >
          <SignInCodeField
            label={step === "verification" ? (checkBy === "sms" ? l.textCode : l.authenticatorCode) : l.sentTo(sentTo ?? l.anyDestination)}
            value={code}
            onValueChange={onCodeChange}
            disabled={busy}
            autoFocus
            className="w-[360px] max-w-full"
          />
          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="prominent" size="pill" loading={busy}>{l.confirm}</Button>
            {step === "verification" ? back : <Button variant="capsule" size="pill" disabled={busy} onClick={onResend}>{l.resend}</Button>}
          </div>
        </form>
      )}
      <div role="status" aria-live="polite" className="text-body leading-[26px] font-medium text-muted-foreground empty:hidden">
        {notice}
      </div>
      {problem == null ? null : <RetryNotice>{problem}</RetryNotice>}
    </section>
  );
}

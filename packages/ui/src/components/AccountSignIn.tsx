import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn.ts";
import { AccountHelp, type AccountHelpLabels } from "./AccountHelp.tsx";
import { Button } from "./Button.tsx";
import { PageText } from "./PageHeading.tsx";
import { RetryNotice } from "./RetryNotice.tsx";
import { SettingsAccountPage } from "./SettingsPageHeading.tsx";
import { SignInCodeField } from "./SignInCodeField.tsx";
import { TextField } from "./TextField.tsx";

export type SignInMethod = "email" | "phone" | "google";

export type AccountSignInStep = "choose" | "start" | "waiting" | "code" | "saved" | "unavailable" | "signing-out";

export type AccountSignInLabels = {
  chooseTitle: string;
  chooseText: string;
  chooseTextGoogle: string;
  email: string;
  phone: string;
  google: string;
  later: string;
  privacy: string;
  title: Record<SignInMethod, string>;
  address: Record<"email" | "phone", string>;
  sendCode: Record<"email" | "phone", string>;
  openGoogle: string;
  tryGoogleAgain: string;
  sentTo: (address: string) => string;
  expiresIn: (minutes: number) => string;
  expired: string;
  expiredVerification: string;
  codeLabel: Record<"email" | "phone", string>;
  verificationLabel: string;
  verify: string;
  resend: string;
  resendIn: (seconds: number) => string;
  finishSaved: string;
  retryCheck: string;
  back: string;
  signingOutTitle: string;
  signingOutText: string;
  finishSignOut: string;
};

export const accountSignInLabels: AccountSignInLabels = {
  chooseTitle: "Sign in to Grace",
  chooseText: "Use your email or mobile phone. We’ll send you a code; everything happens here on the tablet. If you already pay for Grace, use the same email address or phone number as before.",
  chooseTextGoogle: "Use your email, mobile phone or Google account. Email and phone get a code; Google opens its own sign-in and comes straight back here. If you already pay for Grace, use the same email address or phone number as before.",
  email: "Continue with email",
  phone: "Continue with phone",
  google: "Continue with Google",
  later: "Not now",
  privacy: "Signing in doesn’t let Grace read your email. Gmail is a separate choice later.",
  title: { email: "Sign in with email", phone: "Sign in with phone", google: "Sign in with Google" },
  address: { email: "Email address", phone: "Mobile number" },
  sendCode: { email: "Email me a code", phone: "Text me a code" },
  openGoogle: "Open Google sign-in",
  tryGoogleAgain: "Try Google again",
  sentTo: (address) => `Code sent to ${address}`,
  expiresIn: (minutes) => (minutes === 1 ? "Sign-in expires in 1 minute." : `Sign-in expires in ${minutes} minutes.`),
  expired: "This sign-in has expired. Request another code or go Back to start again.",
  expiredVerification: "This sign-in has expired. Go Back to start again.",
  codeLabel: { email: "Email sign-in code", phone: "Text message sign-in code" },
  verificationLabel: "Verification code",
  verify: "Verify code",
  resend: "Resend code",
  resendIn: (seconds) => `Resend code in ${seconds}s`,
  finishSaved: "Finish saved sign-in",
  retryCheck: "Retry sign-in check",
  back: "Back",
  signingOutTitle: "Finish signing out",
  signingOutText: "Your account is disconnected on this device. Reconnect to the internet to finish signing out of this tablet.",
  finishSignOut: "Finish signing out",
};

export type AccountSignInProps = Omit<ComponentProps<"section">, "onSubmit"> & {
  step: AccountSignInStep;
  /** The method chosen; not needed while choosing. */
  method?: SignInMethod;
  /** Google is offered on this tablet. */
  google?: boolean;
  /** The email address or phone number typed. */
  address?: string;
  onAddressChange?: (address: string) => void;
  /** Where the code went, as the app writes it: "(555) 214-0187". */
  sentTo?: string;
  /** The code typed so far. */
  code?: string;
  onCodeChange?: (code: string) => void;
  /** The code is the account's extra check (an authenticator or text), not the sign-in code. */
  verification?: boolean;
  /** The extra check is a passkey, which the tablet cannot use: no field, `notice` says what to do. */
  passkey?: boolean;
  /** Minutes until the sign-in expires; 0 when it has. */
  expiresIn?: number;
  /** Seconds before another code can be sent; 0 when it can. */
  resendIn?: number;
  /** Google's page closed or failed before signing in, so it can be opened again. */
  again?: boolean;
  /** A request is under way: the buttons wait. */
  busy?: boolean;
  /** What is happening, read out as it changes: "Check your email and enter the six-digit sign-in code." */
  notice?: ReactNode;
  /** What went wrong: "That code didn’t work. Check it or send a new one." */
  problem?: ReactNode;
  onChoose?: (method: SignInMethod) => void;
  /** After set-up only: leaves signing in for later. */
  onLater?: () => void;
  onSendCode?: () => void;
  onOpenGoogle?: () => void;
  onVerify?: () => void;
  onResend?: () => void;
  onFinishSaved?: () => void;
  onRetryCheck?: () => void;
  onFinishSignOut?: () => void;
  /** Closes the method at once; the app drops the unfinished sign-in in the background. */
  onBack?: () => void;
  /** Help folded at the foot of the choice. */
  help?: boolean;
  /** The help's words, for another language. */
  helpLabels?: Partial<AccountHelpLabels>;
  labels?: Partial<AccountSignInLabels>;
};

const column = "flex flex-col items-start gap-3";

/**
 * Signing in to Grace on the tablet: the choice of email, phone or Google, the address, then the code with its expiry
 * and resend, and every state between. Codes stay in this form, out of the chat.
 * @design packages/design-system/design.md#windows
 */
export function AccountSignIn({
  step,
  method = "email",
  google = false,
  address = "",
  onAddressChange,
  sentTo,
  code = "",
  onCodeChange,
  verification = false,
  passkey = false,
  expiresIn,
  resendIn = 0,
  again = false,
  busy = false,
  notice,
  problem,
  onChoose,
  onLater,
  onSendCode,
  onOpenGoogle,
  onVerify,
  onResend,
  onFinishSaved,
  onRetryCheck,
  onFinishSignOut,
  onBack,
  help = true,
  helpLabels,
  labels,
  className,
  ...props
}: AccountSignInProps) {
  const l = { ...accountSignInLabels, ...labels };
  const byCode = method === "google" ? "email" : method;
  const expired = expiresIn === 0;
  const status = (
    <div role="status" aria-live="polite" className="text-body leading-[26px] font-medium text-muted-foreground empty:hidden">
      {notice}
    </div>
  );
  const trouble = problem == null ? null : <RetryNotice role="status">{problem}</RetryNotice>;
  const back = (
    <Button variant="capsule" size="pill" onClick={onBack}>
      {l.back}
    </Button>
  );
  const title = step === "choose" ? l.chooseTitle : step === "signing-out" ? l.signingOutTitle : l.title[method];

  let body: ReactNode;
  if (step === "choose")
    body = (
      <>
        {status}
        <PageText>{google ? l.chooseTextGoogle : l.chooseText}</PageText>
        <div className={column}>
          <Button variant="prominent" size="pill" onClick={() => onChoose?.("email")}>{l.email}</Button>
          <Button variant="capsule" size="pill" onClick={() => onChoose?.("phone")}>{l.phone}</Button>
          {google ? <Button variant="capsule" size="pill" onClick={() => onChoose?.("google")}>{l.google}</Button> : null}
          {onLater ? <Button variant="capsule" size="pill" onClick={onLater}>{l.later}</Button> : null}
        </div>
        <PageText tone="secondary">{l.privacy}</PageText>
        {help ? <AccountHelp signIn labels={helpLabels} /> : null}
      </>
    );
  else if (step === "signing-out")
    body = (
      <>
        <PageText>{l.signingOutText}</PageText>
        <div className={column}>
          <Button variant="prominent" size="pill" loading={busy} onClick={onFinishSignOut}>{l.finishSignOut}</Button>
        </div>
        {trouble}
      </>
    );
  else if (step === "start" && method === "google")
    body = (
      <div className={column}>
        <Button variant="prominent" size="pill" loading={busy} onClick={onOpenGoogle}>{again ? l.tryGoogleAgain : l.openGoogle}</Button>
        {back}
      </div>
    );
  else if (step === "start")
    body = (
      <form
        className={column}
        onSubmit={(event) => {
          event.preventDefault();
          onSendCode?.();
        }}
      >
        <TextField
          label={l.address[byCode]}
          type={byCode === "phone" ? "tel" : "email"}
          autoComplete={byCode === "phone" ? "tel" : "email"}
          required
          maxLength={254}
          disabled={busy}
          value={address}
          onChange={(event) => onAddressChange?.(event.target.value)}
          className="w-[560px] max-w-full"
        />
        <Button type="submit" variant="prominent" size="pill" loading={busy}>{l.sendCode[byCode]}</Button>
        {back}
      </form>
    );
  else if (step === "code")
    body = (
      <form
        className={column}
        onSubmit={(event) => {
          event.preventDefault();
          if (!expired) onVerify?.();
        }}
      >
        {!verification && sentTo ? <PageText className="font-bold">{l.sentTo(sentTo)}</PageText> : null}
        {expiresIn == null ? null : (
          <PageText tone="secondary" className={cn(expired && "text-destructive")}>
            {expired ? (verification ? l.expiredVerification : l.expired) : l.expiresIn(expiresIn)}
          </PageText>
        )}
        {passkey ? null : (
          <>
            <SignInCodeField label={verification ? l.verificationLabel : l.codeLabel[byCode]} value={code} onValueChange={onCodeChange} disabled={busy} autoFocus className="w-[360px] max-w-full" />
            <Button type="submit" variant="prominent" size="pill" loading={busy} disabled={expired}>{l.verify}</Button>
          </>
        )}
        {verification ? null : (
          <Button variant="capsule" size="pill" disabled={busy || resendIn > 0} onClick={onResend}>
            {resendIn > 0 ? l.resendIn(resendIn) : l.resend}
          </Button>
        )}
        {back}
      </form>
    );
  else
    body = (
      <div className={column}>
        {step === "saved" ? <Button variant="prominent" size="pill" loading={busy} onClick={onFinishSaved}>{l.finishSaved}</Button> : null}
        {step === "unavailable" ? <Button variant="prominent" size="pill" loading={busy} onClick={onRetryCheck}>{l.retryCheck}</Button> : null}
        {back}
      </div>
    );

  return (
    <SettingsAccountPage title={title} busy={busy} className={className} {...props}>
      {body}
      {step === "choose" ? null : status}
      {step === "signing-out" ? null : trouble}
    </SettingsAccountPage>
  );
}

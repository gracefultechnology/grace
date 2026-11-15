import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";
import { Dialog, DialogActions, DialogContent, DialogTitle } from "./Dialog.tsx";
import { ListRow } from "./ListRow.tsx";
import { PageText } from "./PageHeading.tsx";
import { RetryNotice } from "./RetryNotice.tsx";
import { SettingsPageHeading } from "./SettingsPageHeading.tsx";
import { SignInCodeField } from "./SignInCodeField.tsx";
import { TextField } from "./TextField.tsx";

/** One way Margaret signs in to her account. */
export interface AccountSignInMethod {
  id: string;
  /** "margaret.s@example.com" or "(555) 214-0187". */
  label: string;
  /** The account's main sign-in. */
  primary?: boolean;
  /** It can be removed, leaving another. */
  removable?: boolean;
}

/**
 * Where the page stands: `idle` and `unknown` (a change's result is not known) offer a check; `verify` confirms it is
 * her; `methods` the list; `security` the extra check before a change; `phone` and `enroll` a number to link or to
 * receive security codes; `code` the code sent; `remove` the question before one is removed.
 */
export type AccountMethodsPhase = "idle" | "unknown" | "verify" | "methods" | "security" | "phone" | "enroll" | "code" | "remove";

export type AccountMethodsLabels = {
  title: string;
  intro: string;
  checking: string;
  unknown: string;
  check: string;
  primary: string;
  remove: string;
  removeName: (method: string) => string;
  securityNeeded: string;
  verifySecurity: string;
  addPhone: string;
  refresh: string;
  chooseCheck: string;
  authenticator: string;
  sendSecurityCode: string;
  enrollIntro: string;
  setUpCodes: string;
  phoneIntro: string;
  enrollPhoneIntro: string;
  mobileNumber: string;
  phoneHint: string;
  sendPhoneCode: string;
  sendSetupCode: string;
  sentTo: (destination: string) => string;
  anyCode: string;
  codeLabel: string;
  confirmPhone: string;
  enableCodes: string;
  verifyCode: string;
  removeTitle: (method: string) => string;
  removeText: string;
  confirmRemove: string;
  keep: string;
  back: string;
};

export const accountMethodsLabels: AccountMethodsLabels = {
  title: "Sign-in methods",
  intro: "Manage how you sign in to Grace. Gmail access is a separate choice.",
  checking: "Checking securely…",
  unknown: "We need to check the current result before another change. No change will be repeated automatically.",
  check: "Check sign-in methods",
  primary: "Primary sign-in",
  remove: "Remove",
  removeName: (method) => `Remove ${method}`,
  securityNeeded: "A security check is needed before adding or removing a sign-in method.",
  verifySecurity: "Verify account security",
  addPhone: "Add phone sign-in",
  refresh: "Refresh sign-in methods",
  chooseCheck: "Choose how to complete your security check.",
  authenticator: "Use authenticator code",
  sendSecurityCode: "Send security code",
  enrollIntro: "Set up security codes on a phone you control before changing your sign-in methods. This enables an extra sign-in check; it does not add a phone sign-in.",
  setUpCodes: "Set up security codes",
  phoneIntro: "We’ll verify this phone before linking it as a sign-in method.",
  enrollPhoneIntro: "We’ll verify this phone before enabling extra security codes. You will need to confirm your identity again afterward.",
  mobileNumber: "Mobile number",
  phoneHint: "A US number like (555) 555-0123 works as written. For another country, start with + and the country code.",
  sendPhoneCode: "Send phone-link code",
  sendSetupCode: "Send security setup code",
  sentTo: (destination) => `Enter the code sent to ${destination}.`,
  anyCode: "Enter the six-digit code from your authenticator or security text.",
  codeLabel: "Security or sign-in code",
  confirmPhone: "Confirm phone sign-in",
  enableCodes: "Enable security codes",
  verifyCode: "Verify security code",
  removeTitle: (method) => `Remove ${method}?`,
  removeText: "You’ll need another sign-in method and must confirm your identity again.",
  confirmRemove: "Confirm removal",
  keep: "Keep this method",
  back: "Back to sign-in methods",
};

export type AccountMethodsProps = ComponentProps<"section"> & {
  phase: AccountMethodsPhase;
  /** The methods, once checked. */
  methods?: readonly AccountSignInMethod[];
  /** A security check must come before any change. */
  securityCheckRequired?: boolean;
  /** The extra checks the account can do; none means codes must be set up first. */
  securityChecks?: readonly ("totp" | "sms")[];
  /** What the code in `code` is for. */
  codeFor?: "security" | "phone" | "enroll";
  /** Where the code went. */
  sentTo?: string;
  phone?: string;
  onPhoneChange?: (phone: string) => void;
  code?: string;
  onCodeChange?: (code: string) => void;
  /** The method asked about in `remove`. */
  removing?: string;
  /** The identity check in `verify`: a `ConfirmIdentity`. */
  identity?: ReactNode;
  /** A request is under way. */
  busy?: boolean;
  /** What happened: "Your phone sign-in was linked. Check your methods to see the current list." */
  notice?: ReactNode;
  /** What went wrong, such as a mobile number that cannot be used. */
  problem?: ReactNode;
  onCheck?: () => void;
  onRemove?: (id: string) => void;
  onConfirmRemove?: () => void;
  onKeep?: () => void;
  onVerifySecurity?: () => void;
  onAddPhone?: () => void;
  onSecurityCheck?: (check: "totp" | "sms") => void;
  onSetUpCodes?: () => void;
  onSendPhoneCode?: () => void;
  onVerifyCode?: () => void;
  labels?: Partial<AccountMethodsLabels>;
};

const actions = "flex flex-wrap gap-3";

/**
 * Settings' page for how Margaret signs in to her account (senior-care AccountMethods.tsx): the methods, a security check
 * before a change, linking a phone, setting up security codes and removing a method after one question.
 * @design packages/design-system/design.md#windows
 */
export function AccountMethods({
  phase,
  methods = [],
  securityCheckRequired = false,
  securityChecks = [],
  codeFor = "security",
  sentTo,
  phone = "",
  onPhoneChange,
  code = "",
  onCodeChange,
  removing,
  identity,
  busy = false,
  notice,
  problem,
  onCheck,
  onRemove,
  onConfirmRemove,
  onKeep,
  onVerifySecurity,
  onAddPhone,
  onSecurityCheck,
  onSetUpCodes,
  onSendPhoneCode,
  onVerifyCode,
  labels,
  className,
  ...props
}: AccountMethodsProps) {
  const l = { ...accountMethodsLabels, ...labels };
  const asked = methods.find((method) => method.id === removing);
  const back = phase === "security" || phase === "phone" || phase === "enroll" || phase === "code";
  const list = phase === "methods" || phase === "remove";
  return (
    <section aria-label={l.title} aria-busy={busy || undefined} data-sensitive="true" className={cn("flex flex-col gap-5 font-sans", className)} {...props}>
      <SettingsPageHeading>{l.title}</SettingsPageHeading>
      <PageText>{l.intro}</PageText>
      {busy ? <PageText role="status" tone="secondary">{l.checking}</PageText> : null}
      {phase === "verify" ? identity : null}
      {phase === "idle" || phase === "unknown" ? (
        <>
          {phase === "unknown" ? <PageText>{l.unknown}</PageText> : null}
          <div>
            <Button variant="prominent" size="pill" disabled={busy} onClick={onCheck}>{l.check}</Button>
          </div>
        </>
      ) : null}
      {list ? (
        <>
          <div className="flex flex-col gap-2.5">
            {methods.map((method) => (
              <ListRow
                key={method.id}
                className="min-h-[76px]"
                title={method.label}
                subtitle={method.primary ? l.primary : undefined}
                trailing={
                  method.removable && !securityCheckRequired ? (
                    <Button variant="capsule" size="pill" className="h-13" aria-label={l.removeName(method.label)} disabled={busy} onClick={() => onRemove?.(method.id)}>
                      {l.remove}
                    </Button>
                  ) : undefined
                }
              />
            ))}
          </div>
          {securityCheckRequired ? <PageText tone="secondary">{l.securityNeeded}</PageText> : null}
          <div className={actions}>
            {securityCheckRequired ? (
              <Button variant="prominent" size="pill" disabled={busy} onClick={onVerifySecurity}>{l.verifySecurity}</Button>
            ) : (
              <Button variant="prominent" size="pill" disabled={busy} onClick={onAddPhone}>{l.addPhone}</Button>
            )}
            <Button variant="capsule" size="pill" disabled={busy} onClick={onCheck}>{l.refresh}</Button>
          </div>
        </>
      ) : null}
      {phase === "security" ? (
        securityChecks.length ? (
          <>
            <PageText>{l.chooseCheck}</PageText>
            <div className={actions}>
              {securityChecks.map((check) => (
                <Button key={check} variant="capsule" size="pill" disabled={busy} onClick={() => onSecurityCheck?.(check)}>
                  {check === "totp" ? l.authenticator : l.sendSecurityCode}
                </Button>
              ))}
            </div>
          </>
        ) : (
          <>
            <PageText>{l.enrollIntro}</PageText>
            <div>
              <Button variant="prominent" size="pill" disabled={busy} onClick={onSetUpCodes}>{l.setUpCodes}</Button>
            </div>
          </>
        )
      ) : null}
      {phase === "phone" || phase === "enroll" ? (
        <form
          className="flex flex-col items-start gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSendPhoneCode?.();
          }}
        >
          <PageText>{phase === "phone" ? l.phoneIntro : l.enrollPhoneIntro}</PageText>
          <TextField label={l.mobileNumber} type="tel" inputMode="tel" autoComplete="tel" maxLength={32} required disabled={busy} invalid={problem != null} value={phone} onChange={(event) => onPhoneChange?.(event.target.value)} className="w-[560px] max-w-full" />
          <PageText tone="secondary" className="pl-[26px]">{l.phoneHint}</PageText>
          <Button type="submit" variant="prominent" size="pill" loading={busy}>{phase === "phone" ? l.sendPhoneCode : l.sendSetupCode}</Button>
        </form>
      ) : null}
      {phase === "code" ? (
        <form
          className="flex flex-col items-start gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onVerifyCode?.();
          }}
        >
          <PageText>{sentTo ? l.sentTo(sentTo) : l.anyCode}</PageText>
          <SignInCodeField label={l.codeLabel} value={code} onValueChange={onCodeChange} disabled={busy} autoFocus className="w-[360px] max-w-full" />
          <Button type="submit" variant="prominent" size="pill" loading={busy}>{codeFor === "phone" ? l.confirmPhone : codeFor === "enroll" ? l.enableCodes : l.verifyCode}</Button>
        </form>
      ) : null}
      {back ? (
        <div>
          <Button variant="capsule" size="pill" disabled={busy} onClick={onCheck}>{l.back}</Button>
        </div>
      ) : null}
      <div role="status" aria-live="polite" className="text-body leading-[26px] font-medium text-muted-foreground empty:hidden">
        {notice}
      </div>
      {problem == null ? null : <RetryNotice>{problem}</RetryNotice>}
      <Dialog open={phase === "remove" && asked != null} onOpenChange={(open) => (open ? undefined : onKeep?.())}>
        <DialogContent>
          <DialogTitle>{asked ? l.removeTitle(asked.label) : null}</DialogTitle>
          <PageText>{l.removeText}</PageText>
          <DialogActions>
            <Button variant="warn" size="pill" loading={busy} onClick={onConfirmRemove}>{l.confirmRemove}</Button>
            <Button variant="capsule" size="pill" disabled={busy} onClick={onKeep}>{l.keep}</Button>
          </DialogActions>
        </DialogContent>
      </Dialog>
    </section>
  );
}

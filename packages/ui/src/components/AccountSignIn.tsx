import { useId, type ComponentProps } from "react";
import { Button } from "./Button.tsx";
import { PageText } from "./PageHeading.tsx";
import { RetryNotice } from "./RetryNotice.tsx";
import { SettingsAccountPage } from "./SettingsPageHeading.tsx";

export type AccountSignInProblem = "cancelled" | "offline" | "attention" | "mailDenied";

export type AccountSignInState = "ready" | "waiting" | AccountSignInProblem;

const permissions = ["Read your email", "Send the emails you choose to send", "Move email to Trash", "See and change your calendar events"];

const problems: Record<AccountSignInProblem, string> = {
  cancelled: "Google’s page closed before you finished signing in.",
  offline: "Signing in needs the internet. Connect to Wi-Fi, then try again.",
  attention: "You’re signed in, but your account needs attention. Ask the person who helps you with Grace.",
  mailDenied: "Google didn’t let Grace read your email. Continue with Google again and allow it.",
};

export type AccountSignInProps = Omit<ComponentProps<"section">, "title"> & {
  /** Where signing in stands: ready, waiting for Google's page, or what went wrong. */
  state: AccountSignInState;
  /** Opens Google's own sign-in, which creates the Grace account and connects her email. */
  onContinue?: () => void;
  /** Stops waiting for Google's page. */
  onCancel?: () => void;
  /** Asks the account again, once it needed attention. */
  onCheckAgain?: () => void;
  /** During set-up only: leaves signing in for later. */
  onLater?: () => void;
};

/**
 * Signing in with Google: one sentence on what it does, the permissions Google will ask for, Continue with Google, and
 * what went wrong with the one action that fixes it.
 * @design packages/design-system/design.md#windows
 */
export function AccountSignIn({ state, onContinue, onCancel, onCheckAgain, onLater, ...props }: AccountSignInProps) {
  const waiting = state === "waiting";
  const problem = state === "ready" || waiting ? null : problems[state];
  const leadId = useId();
  return (
    <SettingsAccountPage title="Sign in with Google" busy={waiting} {...props}>
      <PageText id={leadId}>This creates your Grace account and connects your email, so Grace can:</PageText>
      <ul aria-labelledby={leadId} className="m-0 flex flex-col gap-3 rounded-window bg-panel py-[26px] pr-7 pl-12">
        {permissions.map((permission) => (
          <li key={permission} className="text-body-lg leading-[30px] text-foreground">{permission}</li>
        ))}
      </ul>
      {problem ? <RetryNotice role="status">{problem}</RetryNotice> : null}
      <div className="flex flex-wrap gap-3">
        {state === "attention" ? (
          <Button variant="prominent" size="pill" onClick={onCheckAgain}>Check again</Button>
        ) : (
          <Button variant="prominent" size="pill" loading={waiting} onClick={onContinue}>Continue with Google</Button>
        )}
        {waiting ? <Button variant="capsule" size="pill" onClick={onCancel}>Cancel</Button> : null}
        {onLater && !waiting ? <Button variant="capsule" size="pill" onClick={onLater}>Not now</Button> : null}
      </div>
    </SettingsAccountPage>
  );
}

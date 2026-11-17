import { useId, type ComponentProps } from "react";
import { Button } from "./Button.tsx";
import { PageText } from "./PageHeading.tsx";
import { RetryNotice } from "./RetryNotice.tsx";
import { SettingsAccountPage } from "./SettingsPageHeading.tsx";

export type AccountSignInState = "ready" | "waiting" | "cancelled" | "offline" | "attention" | "mailDenied" | "ended";

type Wording = { title: string; lead: string | null; notice: string | null };

const signIn = { title: "Sign in with Google", lead: "This creates your Grace account and connects your email, so Grace can:" };
const reconnect = { title: "Allow Grace to read your email", lead: "Continue with Google and allow all of these, so Grace can:" };

const wording: Record<AccountSignInState, Wording> = {
  ready: { ...signIn, notice: null },
  waiting: { ...signIn, notice: null },
  cancelled: { ...signIn, notice: "Google’s page closed before you finished signing in." },
  offline: { ...signIn, notice: "Signing in needs the internet. Connect to Wi-Fi, then try again." },
  attention: { title: "Your Grace account", lead: null, notice: "You’re signed in, but your account needs attention. Ask the person who helps you with Grace." },
  mailDenied: { ...reconnect, notice: "Google didn’t let Grace read your email." },
  ended: { ...reconnect, notice: "Email access ended. Reconnect to read your email." },
};

const permissions = ["Read your email", "Send the emails you choose to send", "Move email to Trash", "See and change your calendar events"];

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
 * Signing in with Google, or allowing email again once access was refused or ended: what it lets Grace do, the
 * permissions Google will ask for, Continue with Google, and what went wrong with the one action that fixes it.
 * @design packages/design-system/design.md#windows
 */
export function AccountSignIn({ state, onContinue, onCancel, onCheckAgain, onLater, ...props }: AccountSignInProps) {
  const { title, lead, notice } = wording[state];
  const waiting = state === "waiting";
  const leadId = useId();
  return (
    <SettingsAccountPage title={title} busy={waiting} {...props}>
      {lead ? (
        <>
          <PageText id={leadId}>{lead}</PageText>
          <ul aria-labelledby={leadId} className="m-0 flex flex-col gap-3 rounded-window bg-panel py-[26px] pr-7 pl-12">
            {permissions.map((permission) => (
              <li key={permission} className="text-body-lg leading-[30px] text-foreground">{permission}</li>
            ))}
          </ul>
        </>
      ) : null}
      {waiting ? <PageText tone="secondary">Finish on Google’s page. Grace comes back here by itself.</PageText> : null}
      {notice ? (
        <RetryNotice role="status" onRetry={state === "attention" ? onCheckAgain : undefined} retryLabel="Check again">
          {notice}
        </RetryNotice>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {state === "attention" ? null : (
          <Button variant="prominent" size="pill" loading={waiting} onClick={onContinue}>Continue with Google</Button>
        )}
        {waiting ? <Button variant="capsule" size="pill" onClick={onCancel}>Cancel</Button> : null}
        {onLater && !waiting ? <Button variant="capsule" size="pill" onClick={onLater}>Not now</Button> : null}
      </div>
    </SettingsAccountPage>
  );
}

import type { ComponentProps, ReactNode } from "react";
import { AccountFacts } from "./AccountFacts.tsx";
import { AccountHelp } from "./AccountHelp.tsx";
import { Button } from "./Button.tsx";
import { PageText } from "./PageHeading.tsx";
import { RetryNotice } from "./RetryNotice.tsx";
import { SettingsAccountPage } from "./SettingsPageHeading.tsx";

export type AccountAccess = "active" | "attention" | "unavailable";

const problems: Record<Exclude<AccountAccess, "active">, string> = {
  attention: "Your account needs attention, so Grace can’t talk or think yet. Ask the person who helps you with Grace.",
  unavailable: "We couldn’t check your account. Check the internet and try again.",
};

export type AccountOverviewProps = Omit<ComponentProps<"section">, "title"> & {
  /** Where the account stands: working, needing attention, or not answering. */
  access: AccountAccess;
  /** The Google account signed in: "margaret.s@gmail.com". */
  account: string;
  /** Grace can read this account's email. */
  mailConnected: boolean;
  /** Where to write to have the account deleted: "help@example.com". */
  support: string;
  /** Asks before signing out, in place of the page. */
  reviewSignOut?: boolean;
  /** What signing out changes, one sentence each. */
  signOutEffects?: readonly string[];
  busy?: boolean;
  /** What happened, or why signing out did not finish. */
  notice?: ReactNode;
  onCheckAgain?: () => void;
  /** Sign out: the app asks first, with `reviewSignOut`. */
  onSignOut?: () => void;
  onConfirmSignOut?: () => void;
  onStay?: () => void;
};

/**
 * Settings' account page: who is signed in, whether email is connected, Sign out, which asks first and says what it
 * changes, and where to ask for the account to be deleted.
 * @design packages/design-system/design.md#windows
 */
export function AccountOverview({
  access,
  account,
  mailConnected,
  support,
  reviewSignOut = false,
  signOutEffects = [],
  busy = false,
  notice,
  onCheckAgain,
  onSignOut,
  onConfirmSignOut,
  onStay,
  className,
  ...props
}: AccountOverviewProps) {
  const status = notice == null ? null : <RetryNotice role="status">{notice}</RetryNotice>;
  if (reviewSignOut)
    return (
      <SettingsAccountPage title="Sign out of Grace?" className={className} {...props}>
        <PageText>This signs this tablet out of Grace. It pauses your current task and stops voice.</PageText>
        {signOutEffects.length ? (
          <ul className="m-0 flex flex-col gap-3 rounded-window bg-panel py-[26px] pr-7 pl-12">
            {signOutEffects.map((effect) => (
              <li key={effect} className="text-body-lg leading-[30px] text-foreground">{effect}</li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button variant="prominent" size="pill" disabled={busy} onClick={onStay}>Stay signed in</Button>
          <Button variant="warn" size="pill" loading={busy} onClick={onConfirmSignOut}>{busy ? "Signing out…" : "Confirm sign out"}</Button>
        </div>
        {status}
      </SettingsAccountPage>
    );
  return (
    <SettingsAccountPage title="Account" busy={busy} className={className} {...props}>
      <AccountFacts
        facts={[
          { label: "Signed in", value: account },
          { label: "Email", value: mailConnected ? "Connected" : "Not connected" },
        ]}
      />
      {access === "active" ? null : (
        <RetryNotice role="status" onRetry={onCheckAgain} retryLabel="Check again" retrying={busy}>
          {problems[access]}
        </RetryNotice>
      )}
      <Button variant="warn" size="pill" disabled={busy} onClick={onSignOut} className="self-start">Sign out</Button>
      {status}
      <AccountHelp support={support} />
    </SettingsAccountPage>
  );
}

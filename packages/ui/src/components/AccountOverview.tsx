import type { ComponentProps, ReactNode } from "react";
import { CircleCheck, CircleHelp, Clock, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { AccountHelp, type AccountHelpLabels } from "./AccountHelp.tsx";
import { Alert } from "./Alert.tsx";
import { Button } from "./Button.tsx";
import { ListRow } from "./ListRow.tsx";
import { PageHeading, PageText } from "./PageHeading.tsx";
import { RetryNotice } from "./RetryNotice.tsx";
import { SettingsPageHeading } from "./SettingsPageHeading.tsx";

/** What the account check last said: in use, a payment needs attention, a payment is being checked, or no answer. */
export type AccountAccess = "active" | "funding_required" | "payment_pending" | "unavailable";

/** The plan the account pays for, written as the app shows it. */
export interface AccountSubscription {
  /** "Grace Plus". */
  plan: string;
  /** "Active", "Past due". */
  status: string;
  /** When the paid period ends: "Dec 1, 2026". */
  periodEnd: string;
  /** Renewal is cancelled: the plan ends with the period. */
  cancelled?: boolean;
}

/** Where the account's own pages open from. */
export type AccountPage = "methods" | "plan" | "usage" | "invoices";

export type AccountOverviewLabels = {
  title: Record<AccountAccess, string>;
  unavailable: string;
  pending: string;
  planStatus: (status: string) => string;
  renews: (date: string) => string;
  cancelled: (date: string) => string;
  pages: Record<AccountPage, string>;
  checkAgain: string;
  signOut: string;
  notCancelled: string;
  reviewTitle: string;
  reviewText: string;
  stay: string;
  confirmSignOut: string;
  signingOut: string;
};

export const accountOverviewLabels: AccountOverviewLabels = {
  title: { active: "Account and plan", funding_required: "Your payment needs attention", payment_pending: "Your payment is being checked", unavailable: "We couldn’t check your account" },
  unavailable: "Nothing has changed with your account or plan. The connection to your account isn’t answering right now, so check the internet and try again. Everything else on this tablet keeps working.",
  pending: "We have not confirmed the result yet. Do not make another purchase. Check the same account again.",
  planStatus: (status) => `Status: ${status}`,
  renews: (date) => `Current period ends: ${date}`,
  cancelled: (date) => `Renewal cancelled. Paid period ends: ${date}`,
  pages: { methods: "Sign-in methods", plan: "Change your plan", usage: "Usage and balance", invoices: "Invoices and receipts" },
  checkAgain: "Check again",
  signOut: "Sign out",
  notCancelled: "Signing out does not cancel your subscription.",
  reviewTitle: "Sign out of Grace?",
  reviewText: "This signs this tablet out of Grace. It pauses your current task and stops voice.",
  stay: "Stay signed in",
  confirmSignOut: "Confirm sign out",
  signingOut: "Signing out…",
};

// The state's mark beside the account, which the page's title says in words: only `active` is settled.
const marks: Record<AccountAccess, { icon: LucideIcon; tone: string }> = {
  active: { icon: CircleCheck, tone: "text-ok" },
  funding_required: { icon: TriangleAlert, tone: "text-destructive" },
  payment_pending: { icon: Clock, tone: "text-warn" },
  unavailable: { icon: CircleHelp, tone: "text-warn" },
};

export type AccountOverviewProps = ComponentProps<"section"> & {
  access: AccountAccess;
  /** The account signed in: "margaret.s@example.com". */
  account?: string;
  subscription?: AccountSubscription;
  /** The pages offered, in order; each opens with `onOpen`. */
  pages?: readonly AccountPage[];
  onOpen?: (page: AccountPage) => void;
  /** Billing parts the app adds under the plan, such as a payment that needs attention. */
  children?: ReactNode;
  /** Asks before signing out, in place of the page. */
  reviewSignOut?: boolean;
  /** What signing out changes, one sentence each: Gmail, websites, saved passwords. */
  signOutEffects?: readonly string[];
  busy?: boolean;
  /** What happened, or why signing out did not finish. */
  notice?: ReactNode;
  onCheckAgain?: () => void;
  /** Sign out: the app asks first, with `reviewSignOut`. */
  onSignOut?: () => void;
  onConfirmSignOut?: () => void;
  onStay?: () => void;
  /** Help folded at the foot. */
  help?: boolean;
  /** The help's words, for another language. */
  helpLabels?: Partial<AccountHelpLabels>;
  labels?: Partial<AccountOverviewLabels>;
};

/**
 * Settings' account page (senior-care AccountSetup.tsx `AccountBilling`): the account and where it stands, its plan, the
 * account's own pages, Check again and Sign out, which asks first and says what it changes.
 * @design packages/design-system/design.md#windows
 */
export function AccountOverview({
  access,
  account,
  subscription,
  pages = ["methods", "plan", "usage", "invoices"],
  onOpen,
  children,
  reviewSignOut = false,
  signOutEffects = [],
  busy = false,
  notice,
  onCheckAgain,
  onSignOut,
  onConfirmSignOut,
  onStay,
  help = true,
  helpLabels,
  labels,
  className,
  ...props
}: AccountOverviewProps) {
  const l = { ...accountOverviewLabels, ...labels };
  const status = notice == null ? null : <RetryNotice role="status">{notice}</RetryNotice>;
  if (reviewSignOut)
    return (
      <section aria-label={l.reviewTitle} className={cn("flex flex-col gap-5 font-sans", className)} {...props}>
        <SettingsPageHeading>{l.reviewTitle}</SettingsPageHeading>
        <PageText>{l.reviewText}</PageText>
        {signOutEffects.length ? (
          <ul className="m-0 flex flex-col gap-3 rounded-window bg-panel py-[26px] pr-7 pl-12">
            {signOutEffects.map((effect) => (
              <li key={effect} className="text-body-lg leading-[30px] text-foreground">{effect}</li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button variant="prominent" size="pill" disabled={busy} onClick={onStay}>{l.stay}</Button>
          <Button variant="warn" size="pill" loading={busy} onClick={onConfirmSignOut}>{busy ? l.signingOut : l.confirmSignOut}</Button>
        </div>
        {status}
      </section>
    );
  const { icon: Mark, tone } = marks[access];
  const settled = access !== "unavailable";
  return (
    <section aria-label={l.title[access]} className={cn("flex flex-col gap-5 font-sans", className)} {...props}>
      <SettingsPageHeading>{l.title[access]}</SettingsPageHeading>
      {account ? (
        <ListRow
          className="min-h-[76px]"
          leading={<Mark aria-hidden size={28} strokeWidth={2.2} className={cn("flex-none", tone)} />}
          title={account}
        />
      ) : null}
      {access === "unavailable" ? <PageText>{l.unavailable}</PageText> : null}
      {access === "payment_pending" ? <Alert variant="caution">{l.pending}</Alert> : null}
      {subscription ? (
        <div className="flex flex-col gap-1.5 rounded-window bg-panel px-7 py-[26px]">
          <PageHeading level="section" className="text-chrome">{subscription.plan}</PageHeading>
          <PageText>{l.planStatus(subscription.status)}</PageText>
          <PageText tone="secondary">{subscription.cancelled ? l.cancelled(subscription.periodEnd) : l.renews(subscription.periodEnd)}</PageText>
        </div>
      ) : null}
      {children}
      {account && settled && pages.length ? (
        <div className="flex flex-col gap-2.5">
          {pages
            .filter((page) => page !== "plan" || subscription != null)
            .map((page) => (
              <ListRow key={page} className="min-h-[76px]" title={l.pages[page]} chevron onClick={() => onOpen?.(page)} />
            ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button variant="capsule" size="pill" loading={busy} onClick={onCheckAgain}>{l.checkAgain}</Button>
        {settled ? <Button variant="warn" size="pill" disabled={busy} onClick={onSignOut}>{l.signOut}</Button> : null}
      </div>
      {status}
      <PageText tone="secondary">{l.notCancelled}</PageText>
      {help ? <AccountHelp labels={helpLabels} /> : null}
    </section>
  );
}

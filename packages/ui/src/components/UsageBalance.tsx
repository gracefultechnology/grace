import type { ComponentProps, ReactNode } from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { AccountFacts } from "./AccountFacts.tsx";
import { AccountFold } from "./AccountHelp.tsx";
import { Button } from "./Button.tsx";
import { ListRow } from "./ListRow.tsx";
import { PageHeading, PageText } from "./PageHeading.tsx";
import { Progress } from "./Progress.tsx";
import { RetryNotice } from "./RetryNotice.tsx";
import { SettingsAccountPage } from "./SettingsPageHeading.tsx";

export interface PlanAllowance {
  period: string;
  included: string;
  used: string;
  left?: string;
  usedShare?: number;
  endsOn: string;
  ended?: boolean;
  added: string;
  reserved: string;
  expired: string;
  takenBack: string;
}

export interface UsageCategories {
  included: readonly string[];
  notIncluded: readonly string[];
  otherIncluded?: readonly string[];
  otherNotIncluded?: readonly string[];
}

export type UsageBalanceLabels = {
  title: string;
  stale: string;
  helpTitle: string;
  helpUnavailable: string;
  noPlan: string;
  left: string;
  leftUnknown: string;
  usedBar: string;
  usedOf: (used: string, included: string) => string;
  period: string;
  includedThisMonth: string;
  used: string;
  endsOn: string;
  ended: string;
  details: string;
  added: string;
  reserved: string;
  expired: string;
  takenBack: string;
  detailsNote: string;
  credit: string;
  creditUnavailable: string;
  topUp: string;
  topUpOn: string;
  topUpOff: string;
  topUpUnavailable: string;
  topUpNote: string;
  whatsIncluded: string;
  included: string;
  notIncluded: string;
  otherCategories: string;
  categoriesNote: string;
  categoriesUnavailable: string;
  spendingLimit: string;
  checkedAt: (time: string) => string;
  refresh: string;
  refreshing: string;
  back: string;
};

export const usageBalanceLabels: UsageBalanceLabels = {
  title: "Usage and balance",
  stale: "These figures need a fresh check. Refresh usage and balance.",
  helpTitle: "Help included with your plan",
  helpUnavailable: "Couldn’t load the help included with your plan.",
  noPlan: "Your account doesn’t have a monthly plan right now.",
  left: "Left this month",
  leftUnknown: "We couldn’t confirm how much is left.",
  usedBar: "Help used this month",
  usedOf: (used, included) => `${used} of ${included}`,
  period: "This month",
  includedThisMonth: "Included this month",
  used: "Used so far",
  endsOn: "This month’s help ends on",
  ended: "This month’s plan period has ended. Refresh to check again.",
  details: "Details",
  added: "Extra help added",
  reserved: "Set aside for requests still in progress",
  expired: "Unused at the end of a past month",
  takenBack: "Taken back",
  detailsNote: "Help set aside for a request in progress hasn’t been charged. Unused or taken-back help isn’t money you spent.",
  credit: "Prepaid credit",
  creditUnavailable: "Couldn’t load your prepaid credit.",
  topUp: "Automatic top-up",
  topUpOn: "On",
  topUpOff: "Off",
  topUpUnavailable: "Couldn’t check the automatic top-up setting.",
  topUpNote: "Viewing this screen does not change automatic top-up.",
  whatsIncluded: "What’s included",
  included: "Included",
  notIncluded: "Not included",
  otherCategories: "Other account categories",
  categoriesNote: "These categories don’t guarantee a service is available. Grace checks your account before each request. Seeing something listed as not included doesn’t mean you’ll be charged for it.",
  categoriesUnavailable: "We couldn’t confirm what’s included. Refresh to check again.",
  spendingLimit: "Any separate spending limit could not be confirmed here.",
  checkedAt: (time) => `Last checked: ${time}`,
  refresh: "Refresh usage and balance",
  refreshing: "Checking usage…",
  back: "Back to account",
};

export type UsageBalanceProps = ComponentProps<"section"> & {
  /** The figures are past their time and need a fresh check. */
  stale?: boolean;
  /** The help included with the plan: `none` when there is no monthly plan; left out when it could not load. */
  allowance?: PlanAllowance | "none";
  /** Prepaid credit: "$12.40"; left out when it could not load. */
  credit?: string;
  /** The saved automatic top-up setting; left out when it could not be checked. */
  autoTopUp?: boolean;
  /** What the help may be spent on; left out when it could not be confirmed. */
  categories?: UsageCategories;
  /** When the figures were read: "Nov 15, 2026, 9:40 AM". */
  checkedAt?: string;
  busy?: boolean;
  /** "Usage and balance could not be checked. Try again." */
  problem?: ReactNode;
  onRefresh?: () => void;
  onBack?: () => void;
  labels?: Partial<UsageBalanceLabels>;
};

function CategoryList({ title, items, included }: { title: string; items: readonly string[]; included: boolean }) {
  if (!items.length) return null;
  const Icon = included ? Check : Minus;
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-body leading-[26px] font-bold text-foreground">{title}</p>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2.5 text-body-lg leading-7 text-foreground">
            <Icon aria-hidden size={22} strokeWidth={2.4} className={cn("flex-none", included ? "text-ok" : "text-muted-foreground")} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Settings' read-only usage and balance (senior-care UsageBalance.tsx): the help left this month large over a bar, the
 * prepaid credit, the automatic top-up setting and what the help may be spent on. Viewing it changes and spends nothing.
 * @design packages/design-system/design.md#windows
 */
export function UsageBalance({ stale = false, allowance, credit, autoTopUp, categories, checkedAt, busy = false, problem, onRefresh, onBack, labels, className, ...props }: UsageBalanceProps) {
  const l = { ...usageBalanceLabels, ...labels };
  const section = "mt-1 -mb-2.5";
  return (
    <SettingsAccountPage title={l.title} busy={busy} className={className} {...props}>
      {stale ? <PageText role="status" className="font-semibold text-warn">{l.stale}</PageText> : null}
      <PageHeading level="section" className={section}>{l.helpTitle}</PageHeading>
      {allowance == null || stale ? (
        <PageText tone="secondary">{l.helpUnavailable}</PageText>
      ) : allowance === "none" ? (
        <PageText tone="secondary">{l.noPlan}</PageText>
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-window bg-panel px-7 py-[26px]">
            <p className="m-0 text-body leading-[26px] font-medium text-muted-foreground">{l.left}</p>
            <p className="m-0 text-display leading-[48px] font-bold text-foreground">{!allowance.ended && allowance.left ? allowance.left : <span className="text-body-lg leading-7 text-muted-foreground">{l.leftUnknown}</span>}</p>
            {allowance.usedShare == null ? null : <Progress value={allowance.usedShare * 100} aria-label={l.usedBar} aria-valuetext={l.usedOf(allowance.used, allowance.included)} className="mt-1" />}
          </div>
          <AccountFacts
            facts={[
              { label: l.period, value: allowance.period },
              { label: l.includedThisMonth, value: allowance.included },
              { label: l.used, value: allowance.used },
              { label: l.endsOn, value: allowance.endsOn },
            ]}
          />
          {allowance.ended ? <PageText role="status" className="font-semibold text-warn">{l.ended}</PageText> : null}
          <AccountFold title={l.details}>
            <AccountFacts
              className="bg-card px-5 py-4"
              note={l.detailsNote}
              facts={[
                { label: l.added, value: allowance.added },
                { label: l.reserved, value: allowance.reserved },
                { label: l.expired, value: allowance.expired },
                { label: l.takenBack, value: allowance.takenBack },
              ]}
            />
          </AccountFold>
        </>
      )}
      <ListRow className="min-h-[76px]" title={l.credit} trailing={credit != null && !stale ? <span className="text-lead leading-[30px] font-bold text-foreground">{credit}</span> : undefined} subtitle={credit != null && !stale ? undefined : l.creditUnavailable} />
      <ListRow
        className="min-h-[76px]"
        title={l.topUp}
        subtitle={<span className="whitespace-normal">{autoTopUp != null && !stale ? l.topUpNote : l.topUpUnavailable}</span>}
        trailing={autoTopUp != null && !stale ? <span className="text-lead leading-[30px] font-bold text-foreground">{autoTopUp ? l.topUpOn : l.topUpOff}</span> : undefined}
      />
      <PageHeading level="section" className={section}>{l.whatsIncluded}</PageHeading>
      {categories && !stale ? (
        <div className="flex flex-col gap-4 rounded-window bg-panel px-7 py-[26px]">
          <CategoryList title={l.included} items={categories.included} included />
          <CategoryList title={l.notIncluded} items={categories.notIncluded} included={false} />
          {categories.otherIncluded?.length || categories.otherNotIncluded?.length ? (
            <AccountFold title={l.otherCategories} className="bg-card">
              <CategoryList title={l.included} items={categories.otherIncluded ?? []} included />
              <CategoryList title={l.notIncluded} items={categories.otherNotIncluded ?? []} included={false} />
            </AccountFold>
          ) : null}
          <PageText tone="secondary">{l.categoriesNote}</PageText>
        </div>
      ) : (
        <PageText tone="secondary">{l.categoriesUnavailable}</PageText>
      )}
      <PageText tone="secondary">{l.spendingLimit}</PageText>
      {checkedAt ? <PageText tone="secondary">{l.checkedAt(checkedAt)}</PageText> : null}
      {problem == null ? null : <RetryNotice>{problem}</RetryNotice>}
      <div className="flex flex-wrap gap-3">
        <Button variant="capsule" size="pill" loading={busy} onClick={onRefresh}>{busy ? l.refreshing : l.refresh}</Button>
        <Button variant="capsule" size="pill" onClick={onBack}>{l.back}</Button>
      </div>
    </SettingsAccountPage>
  );
}

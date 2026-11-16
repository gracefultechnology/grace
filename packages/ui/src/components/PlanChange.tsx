import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn.ts";
import { AccountFacts, type AccountFact } from "./AccountFacts.tsx";
import { Button } from "./Button.tsx";
import { ListRow } from "./ListRow.tsx";
import { PageHeading, PageText } from "./PageHeading.tsx";
import { PlanCard, PlanWait, type GracePlan } from "./PlanChoice.tsx";
import { SettingsPageHeading } from "./SettingsPageHeading.tsx";

export interface PlanChangeReview {
  plan: string;
  kind: "upgrade" | "downgrade";
  baseRate: string;
  allowance: string;
  additionalAllowance?: string;
  date: string;
  dueNow?: readonly AccountFact[];
  renewal: readonly AccountFact[];
}

export interface PendingPlanChange {
  id: string;
  plan: string;
  upgrade?: boolean;
}

export type PlanChangeView = "idle" | "unknown" | "loading" | "sending" | "verify" | "choose" | "review" | "pending";

export type PlanChangeLabels = {
  title: string;
  reviewChoices: string;
  checkChanges: string;
  checking: string;
  sending: string;
  current: (plan: string, periodEnd: string) => string;
  scheduled: (plan: string, date: string) => string;
  cancelled: string;
  noPlans: string;
  review: (plan: string) => string;
  keep: string;
  baseRate: (amount: string) => string;
  downgrade: (date: string) => string;
  upgrade: (date: string) => string;
  dueNow: string;
  renewal: (date: string) => string;
  renewalNote: string;
  confirmUpgrade: string;
  confirmDowngrade: string;
  doNotChange: string;
  pendingIntro: string;
  awaiting: (plan: string) => string;
  checkPayment: string;
  paymentDue: (amount: string) => string;
  openPayment: string;
  phoneTitle: string;
  phoneText: string;
  phoneQr: string;
  phonePage: string;
  checkMore: string;
};

export const planChangeLabels: PlanChangeLabels = {
  title: "Change your plan",
  reviewChoices: "Review plan choices",
  checkChanges: "Check plan changes",
  checking: "Checking current plan details…",
  sending: "Sending your confirmed plan change…",
  current: (plan, periodEnd) => `Your current plan is ${plan}. The paid period ends on ${periodEnd}.`,
  scheduled: (plan, date) => `A change to ${plan} is already scheduled for ${date}. Your current paid plan stays in place until then.`,
  cancelled: "Renewal is cancelled. Review subscription renewal before requesting a different plan.",
  noPlans: "Plan choices could not load. Use Check again to refresh them.",
  review: (plan) => `Review ${plan}`,
  keep: "Keep my current plan",
  baseRate: (amount) => `Base rate: ${amount} per month.`,
  downgrade: (date) => `No payment now. Your current plan stays active until ${date}. The lower plan is scheduled to begin then.`,
  upgrade: (date) => `The upgrade takes effect only after payment is confirmed. It applies to the rest of the paid period ending ${date}.`,
  dueNow: "Payment due now",
  renewal: (date) => `Estimated renewal on ${date}`,
  renewalNote: "Renewal estimates can change. Review the final amount on any secure payment page before paying.",
  confirmUpgrade: "Confirm upgrade request",
  confirmDowngrade: "Confirm lower plan at period end",
  doNotChange: "Do not change my plan",
  pendingIntro: "A plan change is still being confirmed. Checking it will not submit it again.",
  awaiting: (plan) => `${plan} — awaiting confirmation.`,
  checkPayment: "Check payment action",
  paymentDue: (amount) => `Payment requiring your attention: ${amount}.`,
  openPayment: "Open secure payment",
  phoneTitle: "Open the payment page on your phone",
  phoneText: "Point your phone’s camera at this code to open the same payment page there. Check the amount on the page before paying.",
  phoneQr: "Payment page QR code",
  phonePage: "The code opens your secure Stripe payment page at invoice.stripe.com. Only use it on your own phone.",
  checkMore: "Check more plan changes",
};

export type PlanChangeProps = ComponentProps<"section"> & {
  view: PlanChangeView;
  /** The plan now and the end of its paid period, in `choose`. */
  current?: { plan: string; periodEnd: string };
  /** A lower plan already scheduled: no other change is offered. */
  scheduled?: string;
  /** Renewal is cancelled: no other change is offered. */
  cancelled?: boolean;
  /** The plans she can change to. */
  plans?: readonly GracePlan[];
  /** The terms in `review`. */
  review?: PlanChangeReview;
  /** The changes in `pending`. */
  pending?: readonly PendingPlanChange[];
  /** A payment an upgrade waits on: "$12.50". */
  paymentDue?: string;
  /** The payment page's code, for her phone, when the tablet could not open it. */
  phoneQr?: ReactNode;
  /** More pending changes can be checked. */
  more?: boolean;
  /** A confirmation of identity, in `verify`: a `ConfirmIdentity`. */
  identity?: ReactNode;
  /** What happened: "Your plan change is confirmed. Check your current plan details." */
  notice?: ReactNode;
  /** Checks the plan or its pending changes; never sends one again. */
  onCheck?: () => void;
  onReview?: (key: string) => void;
  onKeep?: () => void;
  onConfirm?: () => void;
  onCheckPayment?: (id: string) => void;
  onOpenPayment?: () => void;
  onCheckMore?: () => void;
  labels?: Partial<PlanChangeLabels>;
};

const actions = "flex flex-wrap gap-3";

/**
 * Changing the plan: the other plans, one change's terms from the saved quote with what is due now and at renewal,
 * then the wait while it is confirmed, and a payment it may need.
 * @design packages/design-system/design.md#windows
 */
export function PlanChange({
  view,
  current,
  scheduled,
  cancelled = false,
  plans = [],
  review,
  pending = [],
  paymentDue,
  phoneQr,
  more = false,
  identity,
  notice,
  onCheck,
  onReview,
  onKeep,
  onConfirm,
  onCheckPayment,
  onOpenPayment,
  onCheckMore,
  labels,
  className,
  ...props
}: PlanChangeProps) {
  const l = { ...planChangeLabels, ...labels };
  const wait = (words: string) => <PlanWait>{words}</PlanWait>;
  let body: ReactNode;
  if (view === "verify") body = identity;
  else if (view === "loading" || view === "sending") body = wait(view === "sending" ? l.sending : l.checking);
  else if (view === "choose")
    body = (
      <>
        {current ? <PageText>{l.current(current.plan, current.periodEnd)}</PageText> : null}
        {scheduled && current ? (
          <PageText>{l.scheduled(scheduled, current.periodEnd)}</PageText>
        ) : cancelled ? (
          <PageText>{l.cancelled}</PageText>
        ) : plans.length ? (
          plans.map((plan) => (
            <PlanCard key={plan.key} plan={plan} action={<Button variant="capsule" size="pill" onClick={() => onReview?.(plan.key)}>{l.review(plan.name)}</Button>} />
          ))
        ) : (
          <PageText tone="secondary">{l.noPlans}</PageText>
        )}
        <div>
          <Button variant="capsule" size="pill" onClick={onKeep}>{l.keep}</Button>
        </div>
      </>
    );
  else if (view === "review" && review)
    body = (
      <>
        <PageHeading level="section">{l.review(review.plan)}</PageHeading>
        <PageText className="font-bold">{l.baseRate(review.baseRate)}</PageText>
        <PageText>{review.allowance}</PageText>
        {review.kind === "downgrade" ? (
          <PageText>{l.downgrade(review.date)}</PageText>
        ) : (
          <>
            <PageText>{l.upgrade(review.date)}</PageText>
            {review.additionalAllowance ? <PageText>{review.additionalAllowance}</PageText> : null}
            {review.dueNow ? <AccountFacts title={l.dueNow} total facts={review.dueNow} /> : null}
          </>
        )}
        <AccountFacts title={l.renewal(review.date)} total facts={review.renewal} note={l.renewalNote} />
        <div className="flex flex-col items-start gap-3">
          <Button variant="prominent" size="pill" onClick={onConfirm}>{review.kind === "upgrade" ? l.confirmUpgrade : l.confirmDowngrade}</Button>
          <Button variant="capsule" size="pill" onClick={onKeep}>{l.doNotChange}</Button>
        </div>
      </>
    );
  else if (view === "pending")
    body = (
      <>
        <PageText>{l.pendingIntro}</PageText>
        <div className="flex flex-col gap-2.5">
          {pending.map((change) => (
            <ListRow
              key={change.id}
              className="min-h-[76px]"
              title={l.awaiting(change.plan)}
              trailing={change.upgrade ? <Button variant="capsule" size="pill" className="h-13" onClick={() => onCheckPayment?.(change.id)}>{l.checkPayment}</Button> : undefined}
            />
          ))}
        </div>
        {paymentDue ? (
          <div className="flex flex-col items-start gap-3">
            <PageText className="font-bold">{l.paymentDue(paymentDue)}</PageText>
            <Button variant="prominent" size="pill" onClick={onOpenPayment}>{l.openPayment}</Button>
          </div>
        ) : null}
        {phoneQr == null ? null : (
          <section aria-label={l.phoneTitle} className="flex flex-col items-start gap-3">
            <PageText>{l.phoneText}</PageText>
            <div role="img" aria-label={l.phoneQr} className="rounded-tile bg-card p-4 shadow-tile [&_svg]:block [&_svg]:size-60">
              {phoneQr}
            </div>
            <PageText tone="secondary">{l.phonePage}</PageText>
          </section>
        )}
        <div className={actions}>
          <Button variant="capsule" size="pill" onClick={onCheck}>{l.checkChanges}</Button>
          {more ? <Button variant="capsule" size="pill" onClick={onCheckMore}>{l.checkMore}</Button> : null}
        </div>
      </>
    );
  else
    body = (
      <div>
        <Button variant="capsule" size="pill" onClick={onCheck}>{view === "unknown" ? l.checkChanges : l.reviewChoices}</Button>
      </div>
    );
  return (
    <section aria-label={l.title} className={cn("flex flex-col gap-5 font-sans", className)} {...props}>
      <SettingsPageHeading>{l.title}</SettingsPageHeading>
      {body}
      <div role="status" aria-live="polite" className="text-body leading-[26px] font-medium text-muted-foreground empty:hidden">
        {notice}
      </div>
    </section>
  );
}

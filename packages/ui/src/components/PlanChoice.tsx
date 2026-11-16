import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "../lib/cn.ts";
import { Alert } from "./Alert.tsx";
import { Button } from "./Button.tsx";
import { PageHeading, PageText } from "./PageHeading.tsx";
import { RetryNotice } from "./RetryNotice.tsx";
import { SettingsPageHeading } from "./SettingsPageHeading.tsx";
import { Spinner } from "./Spinner.tsx";

export interface GracePlan {
  key: string;
  name: string;
  price: string;
  period: string;
  includes?: string;
}

export type PlanCardProps = Omit<ComponentProps<"div">, "children"> & {
  plan: GracePlan;
  /** A line under what it includes: "Cancel any time in Settings." */
  note?: string;
  /** Its button, such as "Choose this plan". */
  action?: ReactNode;
};

/** One plan on the tinted panel: its name, the price large, what it includes (prototype `.a-panel`). */
export function PlanCard({ plan, note, action, className, ...props }: PlanCardProps) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className={cn("flex flex-col items-start gap-3 rounded-window bg-panel px-7 py-[26px] font-sans", className)} {...props}>
      <PageHeading level="section" id={id} className="text-chrome">{plan.name}</PageHeading>
      <p className="m-0 flex items-baseline gap-2.5 text-foreground">
        <span className="text-display-sm leading-10 font-bold">{plan.price}</span>
        <span className="text-body-lg leading-7 font-medium text-muted-foreground">{plan.period}</span>
      </p>
      {plan.includes ? <PageText>{plan.includes}</PageText> : null}
      {note ? <PageText tone="secondary">{note}</PageText> : null}
      {action}
    </div>
  );
}

export type PlanChoiceView = "loading" | "failed" | "summary" | "pay" | "family" | "others" | "submitted";

export type PlanChoiceLabels = {
  title: string;
  loadingTitle: string;
  failedTitle: string;
  loading: string;
  failed: string;
  confirmingTitle: string;
  slowTitle: string;
  confirming: string;
  slow: string;
  signedInAs: (account: string) => string;
  cancelAnyTime: string;
  choose: string;
  chooseOther: (plan: string) => string;
  otherPlans: string;
  seeOthers: string;
  family: string;
  familyText: (plan: GracePlan) => string;
  qr: string;
  familyPage: string;
  linkUntil: (time: string) => string;
  waiting: string;
  makingLink: string;
  loadingForm: string;
  nothingCharged: string;
  payHere: string;
  linkWarning: string;
  checkFailed: string;
  checkAgain: string;
  checking: string;
  alreadyPay: string;
  switchAccount: string;
  later: string;
  back: string;
  tryAgain: string;
};

export const planChoiceLabels: PlanChoiceLabels = {
  title: "Start your Grace plan",
  loadingTitle: "Checking plans…",
  failedTitle: "Plans couldn’t load",
  loading: "Loading your plan options…",
  failed: "Your account hasn’t changed and nothing was charged. Check the connection and try again.",
  confirmingTitle: "Confirming your plan…",
  slowTitle: "Your payment isn’t confirmed yet",
  confirming: "We’re checking your payment. This takes a moment. Please don’t pay again.",
  slow: "This is taking longer than usual. The payment may still go through, so please don’t pay again. We’ll keep checking.",
  signedInAs: (account) => `Signed in as ${account}.`,
  cancelAnyTime: "Cancel any time in Settings.",
  choose: "Choose this plan",
  chooseOther: (plan) => `Choose ${plan}`,
  otherPlans: "Other plans",
  seeOthers: "See other plans",
  family: "Someone else will pay",
  familyText: (plan) => `Show this code to the person paying. They point their phone’s camera at it and pay there for ${plan.name}, ${plan.price} ${plan.period}. They don’t need an account.`,
  qr: "Payment QR code",
  familyPage: "The code opens a secure Stripe payment page at checkout.stripe.com.",
  linkUntil: (time) => `This link works until ${time}.`,
  waiting: "Waiting for payment. This tablet continues by itself when it’s confirmed.",
  makingLink: "Making a secure payment link…",
  loadingForm: "Loading the secure card form…",
  nothingCharged: "Nothing is charged until you finish the secure payment form above and press its pay button.",
  payHere: "Pay on this tablet instead",
  linkWarning: "If someone already paid using the link, don’t pay here — tap Check again first.",
  checkFailed: "We couldn’t check your account",
  checkAgain: "Check again",
  checking: "Checking…",
  alreadyPay: "I already pay for Grace",
  switchAccount: "Use a different account",
  later: "Not now",
  back: "Back",
  tryAgain: "Try again",
};

export type PlanChoiceProps = ComponentProps<"section"> & {
  view: PlanChoiceView;
  /** The plans, the recommended one first. */
  plans: readonly GracePlan[];
  /** The plan chosen; the first by default. */
  selected?: string;
  /** The account signed in: "margaret.s@example.com". */
  account?: string;
  /** `pay` or `family` is still loading. */
  formLoading?: boolean;
  /** Stripe's own secure card form, in `pay` once loaded. Card details go only to Stripe. */
  checkout?: ReactNode;
  /** The payment QR code, in `family` once made. */
  qr?: ReactNode;
  /** When the family link stops working: "Tuesday 3:40 PM". */
  linkUntil?: string;
  /** A confirmation of identity in place of the form or the code: a `ConfirmIdentity`. */
  identity?: ReactNode;
  /** A family link was made, so someone may have paid: paying here waits for one successful Check again. */
  linkIssued?: boolean;
  /** Paying here is locked until Check again succeeds. */
  locked?: boolean;
  /** Check again is under way. */
  checking?: boolean;
  /** The last Check again could not reach the account. */
  checkFailed?: boolean;
  /** `submitted` has waited past the usual time. */
  slow?: boolean;
  /** What could not be done: "The secure card form could not load. Try again." */
  problem?: ReactNode;
  onRetry?: () => void;
  onChoose?: (key: string) => void;
  onFamily?: () => void;
  onOthers?: () => void;
  /** From the other plans, back to the plan offered. */
  onSummary?: () => void;
  /** From `family`, back to paying on the tablet. */
  onPayHere?: () => void;
  /** Reads the account again; never starts a payment. */
  onCheckAgain?: () => void;
  onSwitchAccount?: () => void;
  /** After set-up only: leaves the plan for later. */
  onLater?: () => void;
  labels?: Partial<PlanChoiceLabels>;
};

const actions = "flex flex-wrap gap-3";

/** A wait the plan pages read out: a small spinner and what is happening. */
export function PlanWait({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="m-0 flex items-center gap-3 text-body leading-[26px] font-medium text-muted-foreground">
      <Spinner size="sm" aria-hidden />
      {children}
    </p>
  );
}

/**
 * Starting a Grace plan: the recommended plan with its price and what it includes, paying on Stripe's secure form on the
 * tablet or by a code someone else scans, the other plans, and the wait while the payment is confirmed. Once a family
 * link exists, paying here waits for one successful check.
 * @design packages/design-system/design.md#windows
 */
export function PlanChoice({
  view,
  plans,
  selected,
  account,
  formLoading = false,
  checkout,
  qr,
  linkUntil,
  identity,
  linkIssued = false,
  locked = false,
  checking = false,
  checkFailed = false,
  slow = false,
  problem,
  onRetry,
  onChoose,
  onFamily,
  onOthers,
  onSummary,
  onPayHere,
  onCheckAgain,
  onSwitchAccount,
  onLater,
  labels,
  className,
  ...props
}: PlanChoiceProps) {
  const l = { ...planChoiceLabels, ...labels };
  const plan = plans.find((item) => item.key === selected) ?? plans[0];
  const later = onLater ? <Button variant="capsule" size="pill" onClick={onLater}>{l.later}</Button> : null;
  const trouble = problem == null ? null : <RetryNotice onRetry={onRetry} retryLabel={l.tryAgain}>{problem}</RetryNotice>;
  const wait = (words: string) => <PlanWait>{words}</PlanWait>;
  const guard = linkIssued ? (
    <div className="flex flex-col items-start gap-3">
      <Alert variant="caution" role="note">{l.linkWarning}</Alert>
      {checkFailed ? <p role="alert" className="m-0 text-body leading-[26px] font-semibold text-destructive">{l.checkFailed}</p> : null}
      <Button variant="capsule" size="pill" loading={checking} onClick={onCheckAgain}>{checking ? l.checking : l.checkAgain}</Button>
    </div>
  ) : null;

  const title = !plan ? (view === "loading" ? l.loadingTitle : l.failedTitle) : view === "submitted" ? (slow ? l.slowTitle : l.confirmingTitle) : l.title;
  let body: ReactNode;
  if (!plan || view === "loading" || view === "failed")
    body = (
      <>
        {view === "loading" ? wait(l.loading) : <PageText>{l.failed}</PageText>}
        <div className={actions}>
          {view === "loading" ? null : <Button variant="prominent" size="pill" onClick={onRetry}>{l.tryAgain}</Button>}
          <Button variant="capsule" size="pill" onClick={onSwitchAccount}>{l.switchAccount}</Button>
          {later}
        </div>
      </>
    );
  else if (view === "submitted")
    body = (
      <>
        {wait(slow ? l.slow : l.confirming)}
        <div className={actions}>
          <Button variant="capsule" size="pill" loading={checking} onClick={onCheckAgain}>{l.checkAgain}</Button>
          {slow && onLater ? <Button variant="capsule" size="pill" onClick={onLater}>{l.back}</Button> : null}
        </div>
      </>
    );
  else
    body = (
      <>
        {view === "others" ? null : <PlanCard plan={plan} note={l.cancelAnyTime} />}
        {view === "summary" || view === "others" ? guard : null}
        {view === "summary" ? (
          <div>
            <Button variant="prominent" size="pill" disabled={locked} onClick={() => onChoose?.(plan.key)}>{l.choose}</Button>
          </div>
        ) : null}
        {view === "pay" ? (
          <div data-sensitive="true" className="flex flex-col gap-4">
            {identity ?? (
              <>
                {formLoading ? wait(l.loadingForm) : checkout}
                {trouble}
              </>
            )}
            {!formLoading && checkout != null ? <PageText tone="secondary">{l.nothingCharged}</PageText> : null}
          </div>
        ) : null}
        {view === "family" ? (
          <section aria-label={l.family} className="flex flex-col items-start gap-4">
            <PageHeading level="section">{l.family}</PageHeading>
            {identity ??
              (formLoading ? (
                wait(l.makingLink)
              ) : qr == null ? (
                trouble
              ) : (
                <>
                  <PageText>{l.familyText(plan)}</PageText>
                  <div role="img" aria-label={l.qr} className="rounded-tile bg-card p-4 shadow-tile [&_svg]:block [&_svg]:size-60">
                    {qr}
                  </div>
                  <PageText tone="secondary">{l.familyPage}</PageText>
                  {linkUntil ? <PageText tone="secondary">{l.linkUntil(linkUntil)}</PageText> : null}
                  {wait(l.waiting)}
                </>
              ))}
            {guard}
            <Button variant="capsule" size="pill" disabled={locked} onClick={onPayHere}>{l.payHere}</Button>
          </section>
        ) : null}
        {view === "others" ? (
          <section aria-label={l.otherPlans} className="flex flex-col gap-3">
            <PageHeading level="section">{l.otherPlans}</PageHeading>
            {plans
              .filter((item) => item.key !== plan.key)
              .map((item) => (
                <PlanCard
                  key={item.key}
                  plan={item}
                  action={<Button variant="capsule" size="pill" disabled={locked} onClick={() => onChoose?.(item.key)}>{l.chooseOther(item.name)}</Button>}
                />
              ))}
            <div>
              <Button variant="capsule" size="pill" onClick={onSummary}>{l.back}</Button>
            </div>
          </section>
        ) : null}
        <div className={actions}>
          {view === "family" ? null : <Button variant="capsule" size="pill" onClick={onFamily}>{l.family}</Button>}
          {(view === "summary" || view === "pay") && plans.length > 1 ? <Button variant="capsule" size="pill" onClick={onOthers}>{l.seeOthers}</Button> : null}
        </div>
        <div className={actions}>
          <Button variant="capsule" size="pill" onClick={onCheckAgain}>{l.alreadyPay}</Button>
          <Button variant="capsule" size="pill" onClick={onSwitchAccount}>{l.switchAccount}</Button>
          {later}
        </div>
      </>
    );

  return (
    <section aria-label={title} className={cn("flex flex-col gap-5 font-sans", className)} {...props}>
      <SettingsPageHeading>{title}</SettingsPageHeading>
      {account ? <PageText tone="secondary">{l.signedInAs(account)}</PageText> : null}
      {body}
    </section>
  );
}

import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";
import { Panel, type PanelProps } from "./Panel.tsx";
import { bookingStatusLabels, PaymentStatusBadge, paymentStatusLabels, type PaymentStatusBadgeProps, type PaymentStatusLabels } from "./PaymentStatusBadge.tsx";

export type OutcomeCheckLabels = {
  title: string;
  message: string;
  check: string;
  open: string;
  retrySave: string;
  status: PaymentStatusLabels;
};

export const billCheckLabels: OutcomeCheckLabels = {
  title: "Let’s check whether it went through",
  message: "Please don’t pay again until you’ve checked {site}.",
  check: "Check again",
  open: "Open {site}",
  retrySave: "Try saving again",
  status: paymentStatusLabels,
};

export const bookingCheckLabels: OutcomeCheckLabels = {
  ...billCheckLabels,
  message: "Please don’t book again until you’ve checked {site}.",
  status: bookingStatusLabels,
};

export type OutcomeCheckCardProps = Omit<PanelProps, "variant" | "children" | "title"> & {
  /** The task's website: "chase.com". */
  site: string;
  /** The heading, unless the default. */
  title?: string;
  /** What Margaret is told, unless the default, such as "Chase accepted the payment. Saving the record didn’t work." */
  message?: string;
  /** Looks at the website again for the result; it never pays or books. */
  onCheck?: () => void;
  /** Opens the task's website. */
  onOpenSite?: () => void;
  /** Saves the result already seen again; it never pays or books again. */
  onRetrySave?: () => void;
  /** A check is under way. */
  checking?: boolean;
  /** The result, once found: the card shows it in place of its actions. */
  result?: Omit<PaymentStatusBadgeProps, "labels">;
  /** The task kind's words, such as `billCheckLabels`. */
  labels: OutcomeCheckLabels;
};

/**
 * The calm card for a task whose result is not known, or not saved, on coming back to it: it asks Margaret not to pay
 * or book again, and offers only to look (Check again, Open the website) or to save what was seen (Try saving again).
 * @model spec/app/payment.md
 * @design packages/design-system/design.md#grace
 */
export function OutcomeCheckCard({ site, title, message, onCheck, onOpenSite, onRetrySave, checking = false, result, labels, className, ...props }: OutcomeCheckCardProps) {
  const fill = (template: string) => template.replaceAll("{site}", site);
  const heading = title ?? labels.title;
  const actions = !result && (onRetrySave || onCheck || onOpenSite);
  return (
    <Panel
      role="group"
      aria-label={heading}
      aria-busy={checking || undefined}
      className={cn("flex flex-col gap-4", className)}
      {...props}
    >
      <p className="m-0 text-title-sm leading-8 font-bold text-chrome">{heading}</p>
      <p className="m-0 text-body-lg leading-[30px] font-normal text-foreground">{fill(message ?? labels.message)}</p>
      {result && <PaymentStatusBadge className="self-start" {...result} labels={labels.status} />}
      {actions && (
        <div className="mt-1 flex flex-wrap gap-3">
          {onRetrySave ? (
            <Button variant="prominent" size="pill" onClick={onRetrySave}>
              {labels.retrySave}
            </Button>
          ) : (
            <>
              {onCheck && (
                <Button variant="prominent" size="pill" loading={checking} onClick={onCheck}>
                  {labels.check}
                </Button>
              )}
              {onOpenSite && (
                <Button variant="capsule" size="pill" onClick={onOpenSite}>
                  {fill(labels.open)}
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </Panel>
  );
}

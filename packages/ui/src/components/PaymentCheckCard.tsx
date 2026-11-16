import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";
import { Panel, type PanelProps } from "./Panel.tsx";
import { PaymentStatusBadge, type PaymentStatusBadgeProps } from "./PaymentStatusBadge.tsx";

export type PaymentCheckLabels = {
  title: string;
  message: string;
  check: string;
  open: string;
  retrySave: string;
};

export const paymentCheckLabels: PaymentCheckLabels = {
  title: "Let’s check whether it went through",
  message: "Please don’t pay again until you’ve checked {site}.",
  check: "Check again",
  open: "Open {site}",
  retrySave: "Try saving again",
};

export type PaymentCheckCardProps = Omit<PanelProps, "variant" | "children" | "title"> & {
  /** The bill's website: "chase.com". */
  site: string;
  /** The heading, unless the default. */
  title?: string;
  /** What Margaret is told, unless the default, such as "Chase accepted the payment. Saving the record didn’t work." */
  message?: string;
  /** Looks at the website again for the result; it never pays. */
  onCheck?: () => void;
  /** Opens the bill's website. */
  onOpenSite?: () => void;
  /** Saves the result already seen again; it never pays again. */
  onRetrySave?: () => void;
  /** A check is under way. */
  checking?: boolean;
  /** The result, once found: the card shows it in place of its actions. */
  result?: PaymentStatusBadgeProps;
  /** Words to use instead of the defaults, to localize. */
  labels?: Partial<PaymentCheckLabels>;
};

/**
 * The calm card for a payment whose result is not known, or not saved, on coming back to a bill: it asks Margaret not to
 * pay again, and offers only to look (Check again, Open the website) or to save what was seen (Try saving again).
 * @model spec/app/payment.md
 * @design packages/design-system/design.md#grace
 */
export function PaymentCheckCard({ site, title, message, onCheck, onOpenSite, onRetrySave, checking = false, result, labels, className, ...props }: PaymentCheckCardProps) {
  const words = { ...paymentCheckLabels, ...labels };
  const fill = (template: string) => template.replaceAll("{site}", site);
  const heading = title ?? words.title;
  const actions = !result && (onRetrySave || onCheck || onOpenSite);
  return (
    <Panel
      role="group"
      aria-label={heading}
      aria-busy={checking || undefined}
      className={cn("flex flex-col gap-4 group-data-[surface=frost]/grace:bg-card group-data-[surface=frost]/grace:shadow-float", className)}
      {...props}
    >
      <p className="m-0 text-title-sm leading-8 font-bold text-chrome">{heading}</p>
      <p className="m-0 text-body-lg leading-[30px] font-normal text-foreground">{fill(message ?? words.message)}</p>
      {result && <PaymentStatusBadge className="self-start" {...result} />}
      {actions && (
        <div className="mt-1 flex flex-wrap gap-3">
          {onRetrySave ? (
            <Button variant="prominent" size="pill" onClick={onRetrySave}>
              {words.retrySave}
            </Button>
          ) : (
            <>
              {onCheck && (
                <Button variant="prominent" size="pill" loading={checking} onClick={onCheck}>
                  {words.check}
                </Button>
              )}
              {onOpenSite && (
                <Button variant="capsule" size="pill" onClick={onOpenSite}>
                  {fill(words.open)}
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </Panel>
  );
}

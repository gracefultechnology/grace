import type { ReactNode } from "react";
import { cn } from "../lib/cn.ts";
import { Alert } from "./Alert.tsx";
import { Button } from "./Button.tsx";
import { Panel, type PanelProps } from "./Panel.tsx";
import { PaymentStatusBadge, type PaymentStatusBadgeProps } from "./PaymentStatusBadge.tsx";

/** One fact read from the bill's website. */
export type BillFact = {
  /** What it is: "Statement balance". */
  label: string;
  /** What the website shows: "$84.20". Left out when the website does not show it. */
  value?: string;
  /** What to say when the website does not show it; never "$0". */
  unknownLabel?: string;
};

export type BillSummaryCardProps = Omit<PanelProps, "variant" | "children"> & {
  /** The company the bill is from: "Chase". */
  company: string;
  /** The account, by its last digits: "••7731". */
  account?: string;
  /** The facts as last read from the website, in order. */
  rows: BillFact[];
  /** A payment the website already shows for this bill; without one, `noPaymentLabel`. */
  existing?: PaymentStatusBadgeProps;
  /** Opens the bill on its website: the one next step. */
  onOpen?: () => void;
  /** Reads the website again, to settle facts that disagree or are missing. */
  onRecheck?: () => void;
  /** Why the facts cannot be trusted yet, such as two different amounts; shown as a caution. */
  conflict?: ReactNode;
  /** The label of the existing-payment row. */
  paymentLabel?: string;
  /** What the existing-payment row says when there is none. */
  noPaymentLabel?: string;
  /** What a fact says when the website does not show it, unless the fact has its own. */
  unknownLabel?: string;
  /** The words of the open action. */
  openLabel?: string;
  /** The words of the check-again action. */
  recheckLabel?: string;
};

/**
 * Grace's own read-out of a bill's current facts as seen on its website: company and account, then a row for each fact,
 * and whether a payment already exists. It is Grace's summary, not the website restyled.
 * @model spec/app/billpay.md
 * @design packages/design-system/design.md#windows
 */
export function BillSummaryCard({
  company,
  account,
  rows,
  existing,
  onOpen,
  onRecheck,
  conflict,
  paymentLabel = "Payment",
  noPaymentLabel = "No payment scheduled",
  unknownLabel = "Not shown on the website",
  openLabel = "Open bill",
  recheckLabel = "Check website again",
  className,
  ...props
}: BillSummaryCardProps) {
  const title = [company, account].filter(Boolean).join(" ");
  return (
    <Panel
      role="group"
      aria-label={title}
      // On Grace's frosted window the panel is white and lifted, as her bubbles are (GraceBubble).
      className={cn("flex flex-col gap-5 group-data-[surface=frost]/grace:bg-card group-data-[surface=frost]/grace:shadow-float", className)}
      {...props}
    >
      <p className="m-0 text-lead leading-[30px] font-bold text-chrome">
        {company}
        {account && <span className="ml-2.5 font-semibold text-muted-foreground">{account}</span>}
      </p>
      {conflict ? <Alert variant="caution">{conflict}</Alert> : null}
      {/* spec/app/billpay.md, "Current bill facts distinguish payment choices, no payment due and an existing payment" */}
      <dl className="m-0 grid grid-cols-[auto_1fr] items-baseline gap-x-8 gap-y-3">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-body leading-[26px] font-medium whitespace-nowrap text-muted-foreground">{row.label}</dt>
            <dd className={cn("m-0 text-right text-body-lg leading-7", row.value ? "font-bold text-foreground" : "font-medium text-muted-foreground")}>
              {row.value ?? row.unknownLabel ?? unknownLabel}
            </dd>
          </div>
        ))}
        <div className="contents">
          <dt className="text-body leading-[26px] font-medium whitespace-nowrap text-muted-foreground">{paymentLabel}</dt>
          {existing ? (
            <dd className="col-span-2 m-0 -mt-1 min-w-0">
              <PaymentStatusBadge {...existing} />
            </dd>
          ) : (
            <dd className="m-0 text-right text-body-lg leading-7 font-medium text-muted-foreground">{noPaymentLabel}</dd>
          )}
        </div>
      </dl>
      {(onOpen || onRecheck) && (
        <div className="flex flex-wrap gap-3">
          {onOpen && (
            <Button variant="prominent" size="pill" onClick={onOpen}>
              {openLabel}
            </Button>
          )}
          {onRecheck && (
            <Button variant="capsule" size="pill" onClick={onRecheck}>
              {recheckLabel}
            </Button>
          )}
        </div>
      )}
    </Panel>
  );
}

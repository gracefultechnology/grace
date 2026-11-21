import type { ReactNode } from "react";
import { cn } from "../lib/cn.ts";
import { FactRow, factLabel, factList, factValue } from "../lib/facts.tsx";
import { Alert } from "./Alert.tsx";
import { Button } from "./Button.tsx";
import { Panel, type PanelProps } from "./Panel.tsx";
import { bookingStatusLabels, PaymentStatusBadge, paymentStatusLabels, type PaymentStatusBadgeProps, type PaymentStatusLabels } from "./PaymentStatusBadge.tsx";

export type TaskFact = {
  label: string;
  value?: string;
  unknownLabel?: string;
};

export type TaskFactsLabels = {
  outcome: string;
  noOutcome: string;
  unknown: string;
  open: string;
  recheck: string;
  status: PaymentStatusLabels;
};

export const billFactsLabels: TaskFactsLabels = {
  outcome: "Payment",
  noOutcome: "No payment scheduled",
  unknown: "Not shown on the website",
  open: "Open bill",
  recheck: "Check website again",
  status: paymentStatusLabels,
};

export const bookingFactsLabels: TaskFactsLabels = {
  ...billFactsLabels,
  outcome: "Booking",
  noOutcome: "Nothing booked yet",
  open: "Open website",
  status: bookingStatusLabels,
};

export type TaskFactsCardProps = Omit<PanelProps, "variant" | "children"> & {
  /** Who the task is with: "Chase", "Main St Clinic". */
  who: string;
  /** The account, by its last digits: "••7731". */
  account?: string;
  /** The facts as last read from the website, in order. */
  rows: TaskFact[];
  /** A result the website already shows for this task; without one, the kind's `noOutcome`. */
  existing?: Omit<PaymentStatusBadgeProps, "labels">;
  /** Opens the task on its website: the one next step. */
  onOpen?: () => void;
  /** Reads the website again, to settle facts that disagree or are missing. */
  onRecheck?: () => void;
  /** Why the facts cannot be trusted yet, such as two different amounts; shown as a caution. */
  conflict?: ReactNode;
  /** The task kind's words, such as `billFactsLabels`. */
  labels: TaskFactsLabels;
};

/**
 * Grace's own read-out of a task's current facts as seen on its website: who and which account, then a row for each
 * fact, and whether a result already exists. It is Grace's summary, not the website restyled.
 * @model spec/app/prep.md
 * @design packages/design-system/design.md#windows
 */
export function TaskFactsCard({ who, account, rows, existing, onOpen, onRecheck, conflict, labels, className, ...props }: TaskFactsCardProps) {
  return (
    <Panel role="group" aria-label={[who, account].filter(Boolean).join(" ")} className={cn("flex flex-col gap-5", className)} {...props}>
      <p className="m-0 text-lead leading-[30px] font-bold text-chrome">
        {who}
        {account && <span className="ml-2.5 font-semibold text-muted-foreground">{account}</span>}
      </p>
      {conflict ? <Alert variant="caution">{conflict}</Alert> : null}
      <dl className={factList}>
        {rows.map((row) => (
          <FactRow key={row.label} label={row.label} className={row.value ? "font-bold text-foreground" : "font-medium text-muted-foreground"}>
            {row.value ?? row.unknownLabel ?? labels.unknown}
          </FactRow>
        ))}
        <div className="contents">
          <dt className={cn(factLabel, "font-medium text-muted-foreground")}>{labels.outcome}</dt>
          {existing ? (
            <dd className="col-span-2 m-0 -mt-1 min-w-0">
              <PaymentStatusBadge {...existing} labels={labels.status} />
            </dd>
          ) : (
            <dd className={cn(factValue, "font-medium text-muted-foreground")}>{labels.noOutcome}</dd>
          )}
        </div>
      </dl>
      {(onOpen || onRecheck) && (
        <div className="flex flex-wrap gap-3">
          {onOpen && (
            <Button variant="prominent" size="pill" onClick={onOpen}>
              {labels.open}
            </Button>
          )}
          {onRecheck && (
            <Button variant="capsule" size="pill" onClick={onRecheck}>
              {labels.recheck}
            </Button>
          )}
        </div>
      )}
    </Panel>
  );
}

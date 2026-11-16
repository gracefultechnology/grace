import type { ReactNode } from "react";
import { cn } from "../lib/cn.ts";
import { factLabel, factList, factValue } from "../lib/facts.tsx";
import { Panel, type PanelProps } from "./Panel.tsx";

/** One line of an account record: "Amount paid" and "$25.00". */
export interface AccountFact {
  label: string;
  value: ReactNode;
}

export type AccountFactsProps = Omit<PanelProps, "variant" | "children" | "title"> & {
  /** The lines, in reading order. */
  facts: readonly AccountFact[];
  /** The record's name over its lines: "Payment due now". */
  title?: string;
  /** The last line is the total, set apart in bold (an estimate's amount due). */
  total?: boolean;
  /** One line under the record: "Fees are part of the charge, not additional credit." */
  note?: ReactNode;
};

/**
 * The lines of an account record, a label and its value on each row, on the tinted panel: an invoice, a plan change's
 * estimate, what a plan includes (senior-care AccountInvoices.tsx, PlanChange.tsx `Estimate`, UsageBalance.tsx).
 * @design packages/design-system/design.md#windows
 */
export function AccountFacts({ facts, title, total = false, note, className, ...props }: AccountFactsProps) {
  return (
    <Panel role={title ? "group" : undefined} aria-label={title} className={cn("flex flex-col gap-4 font-sans", className)} {...props}>
      {/* Prototype `.a-ttl` over the lines, and `.a-s` for each label and the note. */}
      {title ? <p className="m-0 text-lead leading-[30px] font-bold text-chrome">{title}</p> : null}
      <dl className={factList}>
        {facts.map((fact, index) => {
          // The total under a rule, as the prototype's `.a-frow` divides a form: 1.5px of the border's lilac grey.
          const last = total && index === facts.length - 1;
          return (
            <div key={fact.label} className={cn("contents", last && "[&>*]:border-t-[1.5px] [&>*]:border-border [&>*]:pt-3")}>
              <dt className={cn(factLabel, last ? "font-bold text-foreground" : "font-medium text-muted-foreground")}>{fact.label}</dt>
              <dd className={cn(factValue, "font-bold text-foreground")}>{fact.value}</dd>
            </div>
          );
        })}
      </dl>
      {note ? <p className="m-0 text-body leading-[26px] font-medium text-muted-foreground">{note}</p> : null}
    </Panel>
  );
}

import type { ReactNode } from "react";
import { cn } from "./cn.ts";

/** A list of facts, a label and its value on each row (AccountFacts, BillSummaryCard, PaymentReviewCard). */
export const factList = "m-0 grid grid-cols-[auto_1fr] items-baseline gap-x-8 gap-y-3";
/** A fact's label: `.a-s`. */
export const factLabel = "text-body leading-[26px] whitespace-nowrap";
/** A fact's value, at the row's end. */
export const factValue = "m-0 text-right text-body-lg leading-7";

/** One row of a fact list: its muted label, then its value in `className`. */
export function FactRow({ label, className, children }: { label: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className={cn(factLabel, "font-medium text-muted-foreground")}>{label}</dt>
      <dd className={cn(factValue, className)}>{children}</dd>
    </div>
  );
}

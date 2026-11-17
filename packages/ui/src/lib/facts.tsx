import type { ReactNode } from "react";
import { cn } from "./cn.ts";

export const factList = "m-0 grid grid-cols-[auto_1fr] items-baseline gap-x-8 gap-y-3";
export const factLabel = "text-body leading-[26px] whitespace-nowrap";
export const factValue = "m-0 text-right text-body-lg leading-7";

export type FactRowProps = { label: ReactNode; className?: string; children: ReactNode };

/** One row of a fact list, inside its `<dl className={factList}>`: its muted label, then its value in `className`. */
export function FactRow({ label, className, children }: FactRowProps) {
  return (
    <div className="contents">
      <dt className={cn(factLabel, "font-medium text-muted-foreground")}>{label}</dt>
      <dd className={cn(factValue, className)}>{children}</dd>
    </div>
  );
}

import type { ReactNode } from "react";
import { cn } from "../lib/cn.ts";
import { FactRow, factList } from "../lib/facts.tsx";
import { Panel, type PanelProps } from "./Panel.tsx";

export interface AccountFact {
  label: string;
  value: ReactNode;
}

export type AccountFactsProps = Omit<PanelProps, "variant" | "children" | "title"> & {
  /** The lines, in reading order. */
  facts: readonly AccountFact[];
};

/**
 * The lines of the account, a label and its value on each row, on the tinted panel: who is signed in, and whether
 * email is connected.
 * @design packages/design-system/design.md#windows
 */
export function AccountFacts({ facts, className, ...props }: AccountFactsProps) {
  return (
    <Panel className={cn("font-sans", className)} {...props}>
      <dl className={factList}>
        {facts.map((fact) => (
          <FactRow key={fact.label} label={fact.label} className="font-bold text-foreground">
            {fact.value}
          </FactRow>
        ))}
      </dl>
    </Panel>
  );
}

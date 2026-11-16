import type { ComponentProps } from "react";
import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";
import { TaskProblem } from "./TaskProblem.tsx";
import { TextField } from "./TextField.tsx";

export type PaymentAmountChoiceLabels = {
  question: string;
  use: string;
  keep: string;
  failed: string;
  tryAgain: string;
};

export const paymentAmountChoiceLabels: Omit<PaymentAmountChoiceLabels, "question"> = {
  use: "Use this amount",
  keep: "Keep the bill amount",
  failed: "I couldn't change the amount.",
  tryAgain: "Shall we try again?",
};

export type PaymentAmountChoiceProps = Omit<ComponentProps<"section">, "onChange"> & {
  /** What Margaret has typed. */
  value: string;
  onValueChange?: (value: string) => void;
  /** Why the typed amount cannot be used, such as more than the bill. */
  problem?: string;
  /** The amount read back once it can be used: "You’ll pay $30.00 of the $84.20 bill." */
  readBack?: string;
  /** The last change did not go through. */
  failed?: boolean;
  /** While the change is being made. */
  busy?: boolean;
  onUse?: () => void;
  onKeep?: () => void;
  labels: Pick<PaymentAmountChoiceLabels, "question"> & Partial<PaymentAmountChoiceLabels>;
};

/**
 * Paying other than the bill's amount: the amount asked for, why it can't be used or what it comes to, then Use this
 * amount or Keep the bill amount. Opened by "Pay a different amount".
 * @design packages/design-system/design.md#windows
 */
export function PaymentAmountChoice({ value, onValueChange, problem, readBack, failed = false, busy = false, onUse, onKeep, labels, className, ...props }: PaymentAmountChoiceProps) {
  const l = { ...paymentAmountChoiceLabels, ...labels };
  return (
    <section aria-label={l.question} className={cn("flex flex-col gap-4 font-sans", className)} {...props}>
      <TextField label={l.question} inputMode="decimal" autoComplete="off" value={value} invalid={!!problem} onChange={(event) => onValueChange?.(event.target.value)} />
      {problem && <p role="alert" className="pl-[26px] text-body leading-[26px] font-medium text-destructive">{problem}</p>}
      {readBack && !problem && <p role="status" className="pl-[26px] text-body leading-[26px] font-bold text-foreground">{readBack}</p>}
      {failed && <TaskProblem text={l.failed} question={l.tryAgain} />}
      <div className="flex flex-wrap gap-3">
        <Button variant="prominent" size="pill" disabled={!readBack || !!problem} loading={busy} onClick={onUse}>
          {l.use}
        </Button>
        <Button variant="capsule" size="pill" onClick={onKeep}>
          {l.keep}
        </Button>
      </div>
    </section>
  );
}

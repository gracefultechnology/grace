import type { ComponentProps } from "react";
import { cn } from "../lib/cn.ts";
import { Progress } from "./Progress.tsx";

export type ProgressStripProps = Omit<ComponentProps<"div">, "title"> & {
  /** The set-up step Margaret is on, such as "Text size". */
  title: string;
  /** Which step it is, from 1; held between 1 and `total`. */
  step: number;
  /** How many steps set-up shows: 10. */
  total: number;
  /** "Step {step} of {total}", for another language. */
  countLabel?: (step: number, total: number) => string;
  /** What the bar is, for assistive technology. */
  progressLabel?: string;
};

/**
 * How far set-up has come: the step's name and "Step 3 of 10" over a thin bar. It sits in Grace's header, so it
 * has no surface of its own.
 * @model spec/app/setup.md
 * @design packages/design-system/design.md#grace
 */
export function ProgressStrip({ title, step, total, countLabel = (s, n) => `Step ${s} of ${n}`, progressLabel = "Set-up progress", className, ...props }: ProgressStripProps) {
  const count = Math.max(1, Math.floor(total));
  const current = Math.min(count, Math.max(1, Math.round(step)));
  return (
    <div className={cn("flex w-full flex-col gap-2 font-sans", className)} {...props}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-label leading-[22px] font-bold text-foreground">{title}</span>
        <span className="text-label leading-[22px] whitespace-nowrap text-muted-foreground">{countLabel(current, count)}</span>
      </div>
      <Progress value={current} max={count} aria-label={progressLabel} aria-valuetext={`${title}, ${countLabel(current, count)}`} className="h-1.5" />
    </div>
  );
}

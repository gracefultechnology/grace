import { cn } from "../lib/cn.ts";
import { GuideLabel, type GuideLabelProps } from "./GuideLabel.tsx";

export type WorkingLabelProps = Omit<GuideLabelProps, "title" | "detail" | "tone" | "mark" | "onClose" | "closeLabel"> & {
  /** Who is doing it, never what she types (the field shows that): "Grace is typing". */
  text: string;
  /** Grace's work is held: a pause sign and `pausedText` in place of the spinner and `text`. */
  paused?: boolean;
  /** The words while paused. */
  pausedText?: string;
};

/**
 * The violet label beside (or under) a field Grace is filling in, so "Grace is doing this" reads apart from "your turn".
 * @model spec/app/execution.md
 * @design packages/design-system/design.md#guidance
 */
export function WorkingLabel({ text, paused = false, pausedText = "Paused", className, ...props }: WorkingLabelProps) {
  // Prototype `showWork`: the text and an ellipsis, or "Paused" with the pause sign.
  return (
    <GuideLabel
      role="status"
      tone="working"
      mark={paused ? "paused" : "working"}
      title={paused ? pausedText : `${text}…`}
      className={cn("pointer-events-none", className)}
      {...props}
    />
  );
}

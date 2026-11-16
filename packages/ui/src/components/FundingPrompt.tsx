import { useEffect, useRef, type ComponentProps } from "react";
import { cn } from "../lib/cn.ts";
import { AnswerChip, AnswerChips } from "./AnswerChip.tsx";
import { GraceBubble } from "./GraceBubble.tsx";

export type FundingPromptKind = "plan" | "account";

export type FundingPromptLabels = Record<FundingPromptKind, { name: string; line: string; detail: string }> & {
  setUp: string;
  later: string;
};

export const fundingPromptLabels: FundingPromptLabels = {
  plan: { name: "Your Grace plan", line: "To keep talking, Grace needs a plan.", detail: "Nothing is charged until you choose a plan and agree to it." },
  account: { name: "Your account", line: "To keep talking, Grace needs your account.", detail: "It takes a minute. There’s no password to remember, and nothing is charged." },
  setUp: "Set it up now",
  later: "Later",
};

export type FundingPromptProps = ComponentProps<"section"> & {
  kind?: FundingPromptKind;
  /** Opens the plan screen, or resumes set-up's account step. Nothing is bought from here. */
  onSetUp?: () => void;
  /** Only closes the prompt. */
  onLater?: () => void;
  labels?: Partial<FundingPromptLabels>;
};

/**
 * Grace's calm word in place of a refused turn: the conversation needs a plan or her account, nothing is charged,
 * and two answers. Her line takes focus as it appears, so a screen reader lands on it.
 * @model spec/app/conversation.md
 * @design packages/design-system/design.md#grace
 */
export function FundingPrompt({ kind = "plan", onSetUp, onLater, labels, className, ...props }: FundingPromptProps) {
  const l = { ...fundingPromptLabels, ...labels };
  const lineRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    lineRef.current?.focus({ preventScroll: true });
  }, [kind]);
  return (
    <section role="group" aria-label={l[kind].name} className={cn("flex flex-col gap-4 font-sans", className)} {...props}>
      <GraceBubble>
        <span ref={lineRef} tabIndex={-1} role="status" className="outline-none">
          {l[kind].line}
        </span>
      </GraceBubble>
      <p className="m-0 pl-10 text-body leading-[26px] font-medium text-muted-foreground">{l[kind].detail}</p>
      <AnswerChips>
        <AnswerChip onClick={onSetUp}>{l.setUp}</AnswerChip>
        <AnswerChip onClick={onLater}>{l.later}</AnswerChip>
      </AnswerChips>
    </section>
  );
}

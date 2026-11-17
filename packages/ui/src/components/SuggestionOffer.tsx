import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn.ts";
import { ValueCards, type ValueCardOption } from "./ValueCards.tsx";

export type SuggestionOfferProps = Omit<ComponentProps<"section">, "title"> & {
  /** Grace's question, unless the message above already asks it: "Use your saved address?" */
  title?: string;
  /** A line under it: "From your saved details." */
  detail?: string;
  /** A value of several lines, shown whole, such as an address. */
  block?: string;
  /** Saved values to pick from, each with what it is kept for. */
  options?: readonly ValueCardOption[];
  onPick?: (option: ValueCardOption) => void;
  /** What the values are, for assistive technology: "Choices". */
  optionsLabel?: string;
  /** The other answers, as `AnswerChip`s in `AnswerChips`: "Yes", "I’ll type it". */
  answers?: ReactNode;
};

/**
 * Grace offers a value she has saved for the field Margaret is filling, or the choices a website gives, such as
 * appointment times: her question, the value or the values with their purpose, and the answers.
 * @model spec/app/conversation.md
 * @design packages/design-system/design.md#grace
 */
export function SuggestionOffer({ title, detail, block, options = [], onPick, optionsLabel = "Choices", answers, className, ...props }: SuggestionOfferProps) {
  return (
    <section className={cn("flex flex-col items-end gap-4 font-sans", className)} {...props}>
      {title || detail ? (
        <div className="self-start">
          {title && <p className="text-lead leading-8 font-bold text-grace-ink">{title}</p>}
          {detail && <p className="text-body leading-[26px] font-medium text-muted-foreground">{detail}</p>}
        </div>
      ) : null}
      {block && <p className="self-start whitespace-pre-line text-body-lg leading-[30px] font-bold text-user-ink">{block}</p>}
      {options.length ? <ValueCards label={optionsLabel} options={options} onPick={onPick} /> : null}
      {answers}
    </section>
  );
}

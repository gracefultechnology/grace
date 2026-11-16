import type { ComponentProps } from "react";
import { cn, focusRing } from "../lib/cn.ts";

export interface ValueCardOption {
  id: string;
  value: string;
  detail?: string;
  tag?: string;
}

export type ValueCardsProps = Omit<ComponentProps<"div">, "onSelect"> & {
  /** The offers, strongest first. */
  options: readonly ValueCardOption[];
  /** Called with the offer tapped: it is her answer. */
  onPick?: (option: ValueCardOption) => void;
  /** What the offers are, for assistive technology: "Networks". */
  label: string;
};

/**
 * Values Grace offers in the chat for Margaret to tap as her answer (senior-care ui/onboarding/ValueCards.tsx), drawn
 * in her ink like the prototype's answer chips (`.uchip`), one per row, with a line under each.
 * @model spec/app/conversation.md
 * @design packages/design-system/design.md#grace
 */
export function ValueCards({ options, onPick, label, className, ...props }: ValueCardsProps) {
  return (
    <div role="group" aria-label={label} className={cn("flex flex-col items-end gap-3 font-sans", className)} {...props}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onPick?.(option)}
          className={cn(
            focusRing,
            "flex min-h-16 min-w-[280px] cursor-pointer flex-col items-start gap-0.5 rounded-row px-6 py-3 text-left text-user-ink inset-ring-[1.5px] inset-ring-user-ink/70 transition-transform duration-press ease-spring active:scale-97 active:bg-user-ink active:text-primary-foreground motion-reduce:active:scale-100",
          )}
        >
          <span className="flex items-center gap-3">
            <span className="text-body-lg leading-7 font-bold">{option.value}</span>
            {option.tag && <span className="rounded-tag px-2 text-caption leading-6 font-bold inset-ring inset-ring-current/40">{option.tag}</span>}
          </span>
          {option.detail && <span className="text-body leading-[26px] font-medium opacity-80">{option.detail}</span>}
        </button>
      ))}
    </div>
  );
}

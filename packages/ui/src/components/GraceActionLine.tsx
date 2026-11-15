import type { ComponentProps, ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "../lib/cn.ts";

export type GraceActionLineProps = Omit<ComponentProps<"div">, "children"> & {
  /** What Margaret did herself, such as "You tapped Sign in." */
  children: ReactNode;
  /** The mark before the words; a check by default (prototype ICON.check, 20px at stroke 2.4). */
  icon?: ReactNode;
};

/**
 * A tap Margaret made herself, logged in the conversation between Grace's messages: a check and her action, centred,
 * with no bubble (prototype `.act`, actLine()).
 * @model spec/app/conversation.md
 * @design packages/design-system/design.md#grace
 */
export function GraceActionLine({ icon = <Check size={20} strokeWidth={2.4} aria-hidden />, className, children, ...props }: GraceActionLineProps) {
  return (
    <div className={cn("flex items-center justify-center gap-2 text-body leading-7 font-medium text-label-ink", className)} {...props}>
      {icon}
      <span className="min-w-0 select-text">{children}</span>
    </div>
  );
}

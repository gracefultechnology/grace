import type { ComponentProps } from "react";
import { Sparkle } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";

export type GraceOfferProps = Omit<ComponentProps<"div">, "children"> & {
  /** What Grace can do for the person here, in one line: "Grace offers to save them as you sign in". */
  message: string;
  /** The one step that starts it: "Add one". */
  action?: string;
  /** Takes that step. */
  onAction?: () => void;
};

/**
 * Grace teaching what she can do: her sparkle on a lavender tile, one line and at most one step, on a soft lavender
 * strip. Lavender is Grace's own colour, as on the Ask Grace orb; a problem that needs the person stays a plum
 * `Banner`.
 * @design packages/design-system/design.md#grace-offers
 */
export function GraceOffer({ message, action, onAction, className, ...props }: GraceOfferProps) {
  return (
    <div className={cn("flex items-center gap-3 rounded-row bg-lavender/20 py-2.5 pr-2.5 pl-3 font-sans text-primary", className)} {...props}>
      <span aria-hidden className="flex size-11 flex-none items-center justify-center rounded-tile bg-lavender text-primary-foreground">
        <Sparkle size={24} strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1 text-control leading-[23px] font-bold">{message}</span>
      {action && (
        <Button variant="prominent" size="compact" onClick={onAction} className="shadow-none">
          {action}
        </Button>
      )}
    </div>
  );
}

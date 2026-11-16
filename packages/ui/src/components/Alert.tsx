import type { ComponentProps, ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn.ts";

const alertVariants = cva("rounded-md border-l-4 bg-muted px-4 py-3 text-sm text-foreground", {
  variants: {
    variant: {
      info: "border-border",
      ok: "border-ok",
      warn: "border-warn",
      destructive: "border-destructive",
      caution: "flex items-center gap-4 rounded-row border-0 bg-caution px-5 py-4 text-[21px] leading-7 font-semibold inset-ring-[1.5px] inset-ring-destructive/22",
    },
  },
  defaultVariants: { variant: "info" },
});

export type AlertProps = ComponentProps<"div"> &
  VariantProps<typeof alertVariants> & {
    /** The mark before the words; `caution` shows a warning triangle unless given another. */
    icon?: ReactNode;
  };

/**
 * A message about what just happened. `warn`, `destructive` and `caution` interrupt a screen reader; the others wait their turn.
 * @design packages/design-system/design.md#windows
 */
export function Alert({ variant, icon, className, children, ...props }: AlertProps) {
  const urgent = variant === "warn" || variant === "destructive" || variant === "caution";
  const mark = icon ?? (variant === "caution" && <TriangleAlert size={28} strokeWidth={2.2} />);
  return (
    <div role={urgent ? "alert" : "status"} className={cn(alertVariants({ variant }), className)} {...props}>
      {mark ? <span aria-hidden className="flex flex-none text-destructive">{mark}</span> : null}
      {children}
    </div>
  );
}

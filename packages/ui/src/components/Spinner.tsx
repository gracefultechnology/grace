import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn.ts";

const spinnerVariants = cva("flex-none animate-spin motion-reduce:animate-spin-slow", {
  variants: { size: { sm: "size-4", md: "size-[22px]", lg: "size-[26px]" } },
  defaultVariants: { size: "md" },
});

export type SpinnerProps = Omit<ComponentProps<"svg">, "children"> &
  VariantProps<typeof spinnerVariants> & {
    /** What is loading, for assistive technology. */
    label?: string;
  };

/**
 * A turning lavender arc for work whose length is unknown (prototype `SPIN`); `currentColor` recolors it.
 * @design packages/design-system/design.md#grace
 */
export function Spinner({ size, label = "Loading", className, ...props }: SpinnerProps) {
  return (
    <svg role="status" aria-label={label} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className={cn(spinnerVariants({ size }), "text-lavender", className)} {...props}>
      <circle cx="12" cy="12" r="9" strokeOpacity=".25" />
      <path d="M12 3a9 9 0 0 1 9 9" />
    </svg>
  );
}

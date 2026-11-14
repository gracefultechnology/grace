import type { ComponentProps } from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { cn, focusRing } from "../lib/cn.ts";

export type CheckboxProps = Omit<ComponentProps<typeof CheckboxPrimitive.Root>, "children"> & {
  /** Marks the choice as refused, visibly and through `aria-invalid`. */
  invalid?: boolean;
};

/** A yes-or-no choice: a white box with the field's outline, indigo with a check when chosen. Name it with a `Label` or `aria-label`. */
export function Checkbox({ invalid = false, className, ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      aria-invalid={invalid || undefined}
      className={cn(
        focusRing,
        "peer inline-flex size-7 shrink-0 items-center justify-center rounded-sm bg-card shadow-field disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:shadow-none aria-invalid:ring-[2.5px] aria-invalid:ring-destructive data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:shadow-none",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        {/* prototype ICON.chk2: a check, stroke 3. */}
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="size-5">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

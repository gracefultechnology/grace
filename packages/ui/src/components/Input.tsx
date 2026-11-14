import type { ComponentProps } from "react";
import { cn } from "../lib/cn.ts";

/** The look of a text field: Grace's message field, a fully round glass capsule, 64px, with an indigo ring while focused (prototype "Text fields"). */
export const fieldCapsule =
  "flex h-16 w-full items-center gap-3.5 rounded-full bg-glass/62 px-[26px] text-body-lg text-foreground shadow-capsule backdrop-blur-capsule backdrop-saturate-160 has-[input:disabled]:opacity-40 has-aria-invalid:ring-[2.5px] has-aria-invalid:ring-destructive";
/** The input inside a capsule: no box of its own. */
export const bareInput = "h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed [&::-webkit-search-cancel-button]:appearance-none";

export type InputProps = Omit<ComponentProps<"input">, "children"> & {
  /** Marks the value as refused, visibly and through `aria-invalid`. */
  invalid?: boolean;
};

/**
 * A single-line text field. Name it with a `Label` or `aria-label`.
 * @design packages/design-system/design.md#buttons
 */
export function Input({ invalid = false, className, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(fieldCapsule, bareInput, "focus:shadow-field-focus disabled:opacity-40 aria-invalid:ring-[2.5px] aria-invalid:ring-destructive", className)}
      {...props}
    />
  );
}

import type { ComponentProps } from "react";
import { cn } from "../lib/cn.ts";

/** The look of a text field: a fully round glass capsule, 64px, with an indigo ring while focused (prototype "#awin .a-fld .v, #awin input.v": no blur of its own). */
export const fieldCapsule =
  "flex h-16 w-full items-center gap-3 rounded-full bg-glass/62 px-[26px] text-body-lg leading-none font-normal text-foreground shadow-capsule has-[input:disabled]:opacity-40 has-aria-invalid:shadow-field-error";
// An input's own text: no outline, and the browser's grey placeholder, as the prototype leaves it.
const words = "min-w-0 outline-none placeholder:text-field-placeholder disabled:cursor-not-allowed [&::-webkit-search-cancel-button]:appearance-none";
/** The input inside a capsule: no box of its own. */
export const bareInput = cn(words, "h-full flex-1 bg-transparent");

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
      className={cn(fieldCapsule, words, "focus:shadow-field-focus disabled:opacity-40 aria-invalid:shadow-field-error aria-invalid:focus:shadow-field-error", className)}
      {...props}
    />
  );
}

import type { ComponentProps } from "react";
import { cn } from "../lib/cn.ts";

export type UnreadDotProps = Omit<ComponentProps<"span">, "children"> & {
  /** What the dot means, for assistive technology. */
  label?: string;
};

/**
 * The violet dot beside something not yet read (prototype `.a-dot`).
 * @design packages/design-system/design.md#selected
 */
export function UnreadDot({ label = "Unread", className, ...props }: UnreadDotProps) {
  return <span role="img" aria-label={label} className={cn("inline-block size-3.5 flex-none rounded-full bg-unread", className)} {...props} />;
}

import type { ComponentProps } from "react";
import { cn } from "../lib/cn.ts";

export type SkeletonProps = Omit<ComponentProps<"div">, "children">;

/**
 * A placeholder in the shape of content still loading, the tint of a row (prototype `.a-row`); size it with `className`.
 * @design packages/design-system/design.md#windows
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return <div aria-hidden className={cn("h-24 w-full animate-pulse rounded-row bg-panel motion-reduce:animate-none", className)} {...props} />;
}

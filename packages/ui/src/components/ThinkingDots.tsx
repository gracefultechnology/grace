import type { ComponentProps } from "react";
import { cn } from "../lib/cn.ts";

export type ThinkingDotsProps = Omit<ComponentProps<"span">, "children"> & {
  /** What the dots mean, for assistive technology. */
  label?: string;
};

/**
 * Three lavender dots bobbing in turn while Grace thinks (prototype `DOTS`).
 * @design packages/design-system/design.md#grace
 */
export function ThinkingDots({ label = "Grace is thinking", className, ...props }: ThinkingDotsProps) {
  return (
    <span role="img" aria-label={label} className={cn("flex h-8 w-[25px] flex-none items-center justify-between", className)} {...props}>
      {[0, 0.15, 0.3].map((delay) => (
        <span key={delay} className="size-1.5 animate-bob rounded-full bg-lavender motion-reduce:animate-none" style={{ animationDelay: `${delay}s` }} />
      ))}
    </span>
  );
}

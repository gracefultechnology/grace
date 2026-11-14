import type { ComponentProps } from "react";
import { cn } from "../lib/cn.ts";

export type CardProps = ComponentProps<"div">;
export type CardTitleProps = ComponentProps<"h3">;

/**
 * A white card that groups what belongs to one thing, floating on the screen's glass.
 * @design packages/design-system/design.md#windows
 */
export function Card({ className, ...props }: CardProps) {
  return <div className={cn("flex flex-col gap-4 rounded-card bg-card p-7 text-card-foreground shadow-float", className)} {...props} />;
}

/** The name of what a `Card` holds (prototype `.lc .ttl`). */
export function CardTitle({ className, ...props }: CardTitleProps) {
  return <h3 className={cn("text-title-sm leading-8 font-bold", className)} {...props} />;
}

/** The actions of a `Card`, in a row at its end. */
export function CardFooter({ className, ...props }: CardProps) {
  return <div className={cn("flex flex-wrap items-center justify-end gap-3", className)} {...props} />;
}

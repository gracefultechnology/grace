import type { ComponentProps } from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "../lib/cn.ts";

export type LabelProps = ComponentProps<typeof LabelPrimitive.Root>;

/** The name of a control, bold above or beside it (prototype .a-fld .l): point `htmlFor` at the control's id, or wrap the control. */
export function Label({ className, ...props }: LabelProps) {
  return (
    <LabelPrimitive.Root
      className={cn("flex items-center gap-3 text-[19px] leading-6 font-bold text-muted-foreground has-disabled:opacity-40 peer-disabled:opacity-40", className)}
      {...props}
    />
  );
}

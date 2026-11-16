import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn.ts";

const panelVariants = cva("box-border min-w-0 text-foreground", {
  variants: {
    variant: {
      tinted: "rounded-window bg-panel px-7 py-[26px]",
      white: "rounded-row bg-card/88 px-5 py-4 shadow-panel",
    },
  },
  defaultVariants: { variant: "tinted" },
});

export type PanelProps = ComponentProps<"div"> & VariantProps<typeof panelVariants>;

/**
 * A plain surface that groups content: tinted on a white window, white on glass.
 * @design packages/design-system/design.md#windows
 */
export function Panel({ variant, className, ...props }: PanelProps) {
  return <div className={cn(panelVariants({ variant }), className)} {...props} />;
}

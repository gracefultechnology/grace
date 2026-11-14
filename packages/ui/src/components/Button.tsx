import type { ComponentProps, MouseEvent } from "react";
import { Slot, Slottable } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn, focusRing } from "../lib/cn.ts";
import { Spinner } from "./Spinner.tsx";

// prototype .pill / .a-btn: a tap grows the button by 5% on a spring (.pill:active); reduced motion keeps it still.
const press = "transition-[transform,background-color,box-shadow] duration-press ease-spring active:scale-105 motion-reduce:active:scale-100";
// prototype "#ahdr [aria-disabled]": the label fades to 38% ink and the button keeps its glass.
const fades = "disabled:text-grace-ink/38 disabled:opacity-100 aria-disabled:text-grace-ink/38 aria-disabled:opacity-100";

const buttonVariants = cva(
  [focusRing, "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50"],
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        // .pill: clear glass, a bright rim and no lift; pressed, brighter glass (.pill:not(.prom):active).
        glass: cn(press, fades, "rounded-full bg-glass/10 text-grace-ink shadow-glass backdrop-blur-glass backdrop-brightness-106 backdrop-saturate-115 active:bg-glass/42 active:shadow-glass-pressed"),
        // .a-btn: the glass capsule of app windows and popovers, where clear glass would vanish on white.
        capsule: cn(press, fades, "rounded-full bg-glass/62 text-grace-ink shadow-capsule backdrop-blur-capsule backdrop-saturate-160 active:bg-glass/85"),
        // .a-btn.warn: a capsule whose words warn, such as Delete.
        warn: cn(press, "rounded-full bg-glass/62 text-destructive shadow-capsule backdrop-blur-capsule backdrop-saturate-160 active:bg-glass/85"),
        // .pill.prom / .a-btn.prom: the one next step, flat indigo.
        prominent: cn(press, "rounded-full bg-primary text-primary-foreground shadow-prominent active:bg-primary-pressed disabled:opacity-40 aria-disabled:opacity-40"),
        // .winx: no fill, for ✕; a tap shows a faint disc.
        plain: cn(press, fades, "rounded-full bg-transparent text-chrome active:bg-chrome/8"),
      },
      size: {
        sm: "h-8 px-3",
        md: "h-9 px-4",
        lg: "h-10 px-6",
        icon: "size-9",
        // .pill: 64px, the height of every button on the tablet.
        pill: "h-16 gap-2.5 pr-6 pl-5 text-body font-bold",
        // .pill.icon: round.
        "pill-icon": "size-16 p-0 text-body font-bold",
        // .hgrp .pill: 56px, inside a header capsule.
        compact: "h-14 gap-2.5 pr-5 pl-4 text-body font-bold",
        // .gl, .hgrp .winx: round, 56px.
        "compact-icon": "size-14 p-0 text-body font-bold",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Shows a spinner and refuses clicks while work is in flight. */
    loading?: boolean;
    /** Renders the single child element with the button's styles, for a link that looks like a button. */
    asChild?: boolean;
  };

/**
 * An action a person can take. Give one without text, such as an icon, an `aria-label`.
 * On the tablet: `glass`, `capsule` or `warn`, `prominent` and `plain`, at `pill` size, with a Lucide icon (22px, stroke 2.2) as a child.
 * @design packages/design-system/design.md#buttons
 */
export function Button({ variant, size, loading = false, asChild = false, type = "button", disabled, className, children, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  const off = disabled || loading;
  // The child of `asChild`, a link, has no `disabled`: it is marked, leaves the tab order and refuses activation.
  const state = asChild ? off && { "aria-disabled": true, tabIndex: -1, onClickCapture: (event: MouseEvent) => { event.preventDefault(); event.stopPropagation(); } } : { type, disabled: off };
  return (
    <Comp aria-busy={loading || undefined} className={cn(buttonVariants({ variant, size }), className)} {...props} {...state}>
      {loading && <Spinner size="sm" aria-hidden />}
      <Slottable>{children}</Slottable>
    </Comp>
  );
}

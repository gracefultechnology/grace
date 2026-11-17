import type { ComponentProps, MouseEvent } from "react";
import { Slot, Slottable } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn, focusRing } from "../lib/cn.ts";
import { Spinner } from "./Spinner.tsx";

export const press = "[transition:transform_var(--transition-duration-press)_var(--ease-spring),background-color_var(--transition-duration-press)_ease,box-shadow_var(--transition-duration-press)_ease] active:scale-105 motion-reduce:active:scale-100";
const sink = "active:scale-97 motion-reduce:active:scale-100";
const fades = "disabled:text-grace-ink/32 disabled:opacity-100 aria-disabled:text-grace-ink/32 aria-disabled:opacity-100";

const buttonVariants = cva(
  [focusRing, "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50"],
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground transition-colors hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground transition-colors hover:bg-secondary/80",
        outline: "border border-input bg-background transition-colors hover:bg-accent hover:text-accent-foreground",
        ghost: "transition-colors hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive text-destructive-foreground transition-colors hover:bg-destructive/90",
        glass: cn(press, fades, "rounded-full bg-glass/10 text-grace-ink shadow-elevation-glass backdrop-blur-glass backdrop-brightness-106 backdrop-saturate-115 active:bg-glass/42 active:shadow-glass-pressed"),
        capsule: cn(sink, fades, "rounded-full bg-glass/62 text-grace-ink shadow-capsule backdrop-blur-capsule backdrop-saturate-160 active:bg-glass/85"),
        warn: cn(sink, "rounded-full bg-glass/62 text-destructive shadow-capsule backdrop-blur-capsule backdrop-saturate-160 active:bg-glass/85"),
        prominent: "rounded-full bg-primary text-primary-foreground shadow-prominent disabled:opacity-40 aria-disabled:opacity-40",
        plain: cn(fades, "rounded-full bg-transparent text-chrome active:bg-chrome/8"),
      },
      size: {
        sm: "h-8 px-3",
        md: "h-9 px-4",
        lg: "h-10 px-6",
        icon: "size-9",
        pill: "h-16 gap-2.5 pr-[26px] pl-[22px] text-body font-bold",
        "pill-icon": "size-16 p-0 text-body font-bold",
        compact: "h-14 gap-2.5 pr-5 pl-4 text-body font-bold",
        "compact-icon": "size-14 p-0 text-body font-bold",
      },
    },
    compoundVariants: [
      { variant: "glass", size: "pill", class: "pr-6 pl-5" },
      { variant: "prominent", size: "compact", class: cn(press, "pr-[26px] pl-[22px]") },
    ],
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
  const state = asChild ? off && { "aria-disabled": true, tabIndex: -1, onClickCapture: (event: MouseEvent) => { event.preventDefault(); event.stopPropagation(); } } : { type, disabled: off };
  return (
    <Comp aria-busy={loading || undefined} className={cn(buttonVariants({ variant, size }), className)} {...props} {...state}>
      {loading && <Spinner size="sm" aria-hidden />}
      <Slottable>{children}</Slottable>
    </Comp>
  );
}

export type GracePillProps = Omit<ButtonProps, "variant" | "size">;

export const pillPress = cn(press, "active:bg-transparent");

/** A pill inside a `GraceCapsule`: no fill of its own, 56px tall (prototype `.gwin .hgrp .pill`). */
export function GracePill({ className, ...props }: GracePillProps) {
  return <Button variant="plain" size="compact" className={cn("text-grace-ink", pillPress, className)} {...props} />;
}

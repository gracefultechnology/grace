import type { ComponentProps } from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cva } from "class-variance-authority";
import { cn, focusRing } from "../lib/cn.ts";

type Size = "sm" | "md";

// prototype .trk (sm: in Grace's Voice and Mic pills) and .a-sw (md: settings rows): indigo when on, grey when off.
const track = cva("group inline-flex shrink-0 items-center rounded-full bg-primary transition-colors duration-slow", {
  variants: {
    size: {
      sm: "h-[26px] w-11 p-[3px] data-[state=unchecked]:bg-track-off",
      md: "h-[38px] w-16 p-1 data-[state=unchecked]:bg-switch-off",
    },
  },
});
const knob = cva("block rounded-full bg-card transition-transform duration-base ease-standard motion-reduce:transition-none", {
  variants: {
    size: {
      sm: "size-5 group-data-[state=checked]:translate-x-[18px]",
      md: "size-[30px] group-data-[state=checked]:translate-x-[26px]",
    },
  },
});

export type SwitchProps = Omit<ComponentProps<typeof SwitchPrimitive.Root>, "children"> & {
  /** `md` for a settings row; `sm` for the track inside one of Grace's pills. */
  size?: Size;
};

/**
 * An on-or-off setting, such as "Dim the screen at night". Name it with a `Label` or `aria-label`.
 * @design packages/design-system/design.md#buttons
 */
export function Switch({ size = "md", className, ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Root className={cn(focusRing, track({ size }), "disabled:cursor-not-allowed disabled:opacity-40", className)} {...props}>
      <SwitchPrimitive.Thumb className={knob({ size })} />
    </SwitchPrimitive.Root>
  );
}

export type SwitchTrackProps = Omit<ComponentProps<"span">, "children"> & {
  /** Whether the setting it shows is on. */
  checked: boolean;
  size?: Size;
};

/** The look of a switch with no control of its own, for a button that is the switch, such as Grace's "Mic on" pill (`role="switch"` on the button). */
export function SwitchTrack({ checked, size = "sm", className, ...props }: SwitchTrackProps) {
  return (
    <span aria-hidden data-state={checked ? "checked" : "unchecked"} className={cn(track({ size }), className)} {...props}>
      <span className={knob({ size })} />
    </span>
  );
}

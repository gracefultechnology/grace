import { createContext, use, type ComponentProps, type ReactElement, type ReactNode } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cva } from "class-variance-authority";
import { Check } from "lucide-react";
import { cn, focusRing } from "../lib/cn.ts";

export type MenuSurface = "glass" | "page";

export const menuPanel = cva("z-50 flex flex-col gap-2 rounded-menu p-2 outline-none", {
  variants: {
    surface: {
      glass: "min-w-[286px] bg-glass/86 shadow-menu backdrop-blur-frost backdrop-saturate-160",
      page: "min-w-[336px] bg-glass/95 shadow-popover",
    },
  },
  defaultVariants: { surface: "glass" },
});

export const menuOption = cva(
  [focusRing, "flex w-full cursor-pointer items-center gap-2 rounded-full px-[22px] text-body font-bold text-grace-ink outline-none select-none data-[disabled]:text-grace-ink/38"],
  {
    variants: {
      surface: {
        glass: "h-16 bg-glass/70 data-[highlighted]:bg-glass",
        page: "h-15 flex-none justify-start bg-panel",
      },
      selected: { true: "bg-card text-primary shadow-raised data-[highlighted]:bg-card", false: "" },
    },
    defaultVariants: { surface: "glass", selected: false },
  },
);

const SurfaceContext = createContext<MenuSurface>("glass");

export type MenuProps = Omit<MenuPopoverProps, "asChild"> & {
  /** The button that opens the menu, such as Grace's Voice pill. */
  trigger: ReactElement;
  /** Its `MenuLabel`s, `MenuOption`s and any control that belongs in it. */
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/**
 * A short list of choices that opens from a button: Grace's speed and Attach menus (prototype .spdpop).
 * Like the prototype's popover it is not modal: the rest of the screen stays reachable, and a tap elsewhere closes it.
 * @design packages/design-system/design.md#selected
 */
export function Menu({ trigger, children, open, defaultOpen, onOpenChange, ...props }: MenuProps) {
  return (
    <DropdownMenu.Root modal={false} open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <MenuPopover {...props}>{children}</MenuPopover>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export type MenuPopoverProps = ComponentProps<typeof DropdownMenu.Content> & {
  /** `glass` over the frame (prototype .spdpop); `page` over an app window (.apop), whose options are 60px on a pale panel. */
  surface?: MenuSurface;
};

/** The menu's panel, 8px from a 64px button. */
export function MenuPopover({ surface = "glass", className, sideOffset = 8, align = "start", ...props }: MenuPopoverProps) {
  return (
    <SurfaceContext value={surface}>
      <DropdownMenu.Content sideOffset={sideOffset} align={align} className={cn(menuPanel({ surface }), className)} {...props} />
    </SurfaceContext>
  );
}

export type MenuLabelProps = ComponentProps<typeof DropdownMenu.Label>;

/** A small uppercase heading over a group of options, such as "Speed" (prototype .spdl). */
export function MenuLabel({ className, ...props }: MenuLabelProps) {
  return <DropdownMenu.Label className={cn("mt-1.5 ml-4 text-label leading-5 font-bold tracking-[.04em] text-label-ink uppercase", className)} {...props} />;
}

export type MenuOptionProps = ComponentProps<typeof DropdownMenu.Item> & {
  /** A Lucide icon (24px, stroke 2.2) before the words; the option then reads from the left, as Attach's do. */
  icon?: ReactNode;
  /** For one choice of several: whether it is the current one, shown as a raised white platter with a check. */
  selected?: boolean;
};

/** One choice in a menu: a round option (prototype .spdo), as tall as its panel's `surface` makes it. */
export function MenuOption({ icon, selected, className, children, ...props }: MenuOptionProps) {
  const surface = use(SurfaceContext);
  const choice = selected !== undefined && { role: "menuitemradio", "aria-checked": selected };
  return (
    <DropdownMenu.Item
      className={cn(icon ? "justify-start" : "justify-center", menuOption({ surface, selected: !!selected }), className)}
      {...choice}
      {...props}
    >
      {selected && <Check size={20} strokeWidth={2.4} aria-hidden />}
      {icon}
      {children}
    </DropdownMenu.Item>
  );
}

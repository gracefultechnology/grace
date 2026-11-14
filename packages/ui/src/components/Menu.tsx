import type { ComponentProps, ReactElement, ReactNode } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import { cn, focusRing } from "../lib/cn.ts";

export type MenuProps = Omit<ComponentProps<typeof DropdownMenu.Content>, "asChild"> & {
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

export type MenuPopoverProps = ComponentProps<typeof DropdownMenu.Content>;

/** The menu's frosted glass panel, 8px under its button (prototype .spdpop). */
export function MenuPopover({ className, sideOffset = 8, align = "start", ...props }: MenuPopoverProps) {
  return (
    <DropdownMenu.Content
      sideOffset={sideOffset}
      align={align}
      className={cn("z-50 flex min-w-[270px] flex-col gap-2 rounded-menu bg-glass/86 p-2 shadow-menu backdrop-blur-frost backdrop-saturate-160 outline-none", className)}
      {...props}
    />
  );
}

export type MenuLabelProps = ComponentProps<typeof DropdownMenu.Label>;

/** A small uppercase heading over a group of options, such as "Speed" (prototype .spdl). */
export function MenuLabel({ className, ...props }: MenuLabelProps) {
  return <DropdownMenu.Label className={cn("mt-1.5 ml-4 text-label font-bold tracking-[.04em] text-label-ink uppercase", className)} {...props} />;
}

export type MenuOptionProps = ComponentProps<typeof DropdownMenu.Item> & {
  /** A Lucide icon (24px, stroke 2.2) before the words; the option then reads from the left, as Attach's do. */
  icon?: ReactNode;
  /** For one choice of several: whether it is the current one, shown as a raised white platter with a check. */
  selected?: boolean;
};

/** One choice in a menu: a 64px round option (prototype .spdo). */
export function MenuOption({ icon, selected, className, children, ...props }: MenuOptionProps) {
  const choice = selected !== undefined && { role: "menuitemradio", "aria-checked": selected };
  return (
    <DropdownMenu.Item
      className={cn(
        focusRing,
        "flex h-16 w-full cursor-pointer items-center gap-2 rounded-full bg-glass/70 px-[22px] text-body font-bold text-grace-ink outline-none select-none data-[disabled]:text-grace-ink/38 data-[highlighted]:bg-glass",
        icon ? "justify-start" : "justify-center",
        selected && "bg-card text-primary shadow-raised data-[highlighted]:bg-card",
        className,
      )}
      {...choice}
      {...props}
    >
      {selected && <Check size={22} strokeWidth={2.2} aria-hidden />}
      {icon}
      {children}
    </DropdownMenu.Item>
  );
}

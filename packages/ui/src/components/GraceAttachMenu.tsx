import type { ReactNode } from "react";
import { cn } from "../lib/cn.ts";
import { GracePill } from "./GraceHeader.tsx";
import { Menu, MenuOption, type MenuProps } from "./Menu.tsx";

// Prototype #addB's paperclip, 24px.
const paperclip = (
  <svg aria-hidden width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l8.6-8.6a4 4 0 0 1 5.7 5.7l-8.6 8.6a2 2 0 0 1-2.8-2.8l8-8" />
  </svg>
);

export type AttachOption = {
  id: string;
  /** The option's words, such as "Take a photo". */
  label: string;
  /** A 24px line icon, stroke 2.2. */
  icon?: ReactNode;
};

export type GraceAttachMenuProps = Omit<MenuProps, "trigger" | "children"> & {
  /** What Margaret can attach. */
  options: AttachOption[];
  /** Called with the chosen option's `id`. */
  onChoose?: (id: string) => void;
  /** The pill's words. */
  label?: string;
};

/**
 * The Attach pill of Grace's answer row and its menu, opening upward (prototype `#addB`, `.addpop`).
 * @model spec/app/conversation.md
 * @design packages/design-system/design.md#grace
 */
export function GraceAttachMenu({ options, onChoose, label = "Attach", side = "top", align = "start", sideOffset = 16, className, ...props }: GraceAttachMenuProps) {
  return (
    // .addpop: 16px above the pill and, as .spdpop's left:0 outranks .addpop's right:0, its left edge on the pill's; the
    // panel is .spdpop's 286px and its rows are 280px, so they reach 2px into its right padding.
    <Menu
      side={side}
      align={align}
      sideOffset={sideOffset}
      className={cn("w-[286px]", className)}
      trigger={
        <GracePill>
          {paperclip}
          {label}
        </GracePill>
      }
      {...props}
    >
      {options.map((option) => (
        <MenuOption key={option.id} icon={option.icon} className="min-w-[280px]" onSelect={() => onChoose?.(option.id)}>
          {option.label}
        </MenuOption>
      ))}
    </Menu>
  );
}

import type { ComponentProps, ReactNode } from "react";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { cn, focusRing } from "../lib/cn.ts";

export interface SegmentedOption {
  value: string;
  label: ReactNode;
  icon?: ReactNode;
}

export type SegmentedControlProps = Omit<ComponentProps<"div">, "defaultValue" | "dir" | "children"> & {
  /** The choices, in order. */
  options: SegmentedOption[];
  /** The chosen value, for a control its owner keeps. */
  value?: string;
  /** The first choice, for a control that keeps its own. */
  defaultValue?: string;
  /** Called with the value a person chooses; choosing the chosen one again changes nothing. */
  onValueChange?: (value: string) => void;
  /** `md` on a page; `sm` inside a form field (prototype .a-fld .a-seg). */
  size?: "md" | "sm";
  disabled?: boolean;
};

/**
 * One choice of a few, side by side: the chosen one is a raised white platter with an indigo label (prototype .a-seg).
 * @design packages/design-system/design.md#selected
 */
export function SegmentedControl({ options, value, defaultValue, onValueChange, size = "md", disabled, className, ...props }: SegmentedControlProps) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
      rovingFocus={!disabled}
      className={cn("flex gap-2.5 rounded-segment bg-panel", size === "md" ? "p-2" : "p-1.5", disabled && "opacity-40", className)}
      {...props}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          onClick={(event) => event.currentTarget.dataset.state === "on" && event.preventDefault()}
          className={cn(
            focusRing,
            "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-transparent font-bold whitespace-nowrap text-grace-ink data-[state=on]:bg-card data-[state=on]:text-primary data-[state=on]:shadow-raised",
            size === "md" ? "h-14 px-[22px] text-body" : "h-14 px-2.5 text-[19px]",
          )}
        >
          {option.icon}
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

import { useId } from "react";
import { cn } from "../lib/cn.ts";
import { ListRow, type ListRowProps } from "./ListRow.tsx";
import { Switch } from "./Switch.tsx";

export type SettingsSwitchRowProps = Omit<ListRowProps, "title" | "trailing" | "onClick" | "chevron" | "time" | "unread" | "onChange"> & {
  /** The setting's name, which also names the switch. */
  title: string;
  /** Whether the setting is on. */
  checked: boolean;
  /** Called with the new value when the row or its switch is tapped. */
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
};

/**
 * A setting that is on or off: its name and a line under it, with a switch at the end; tapping anywhere on the row
 * flips it (prototype `.a-row` with `.a-sw`).
 * @design packages/design-system/design.md#windows
 */
export function SettingsSwitchRow({ title, subtitle, checked, onCheckedChange, disabled, className, ...props }: SettingsSwitchRowProps) {
  const id = useId();
  return (
    <ListRow
      title={
        <label htmlFor={id} className="cursor-pointer after:absolute after:inset-0 after:rounded-row">
          {title}
        </label>
      }
      subtitle={subtitle ? <span className="whitespace-normal">{subtitle}</span> : undefined}
      trailing={<Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />}
      className={cn(!disabled && "active:scale-[.99]", className)}
      {...props}
      onClick={undefined}
    />
  );
}

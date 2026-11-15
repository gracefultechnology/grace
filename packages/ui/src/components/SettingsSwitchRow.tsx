import { useId } from "react";
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
      // The label stretches over the row, so the whole row is the switch's target; the switch sits above it.
      title={
        <label htmlFor={id} className="cursor-pointer after:absolute after:inset-0 after:rounded-row">
          {title}
        </label>
      }
      // A setting's hint wraps rather than being cut short (ListRow truncates its subtitle).
      subtitle={subtitle ? <span className="whitespace-normal">{subtitle}</span> : undefined}
      trailing={<Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />}
      className={className}
      {...props}
      // The label is the row's target: the row never becomes a button of its own.
      onClick={undefined}
    />
  );
}

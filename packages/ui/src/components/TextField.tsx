import { useId, type ComponentProps, type ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { bareInput, fieldCapsule } from "./Input.tsx";
import { Label } from "./Label.tsx";

type Field = Omit<ComponentProps<"input">, "children"> & {
  /** A Lucide icon at the start (24px), such as a calendar for a day. */
  icon?: ReactNode;
  /** A control at the end of the capsule, such as a "Change" button. */
  action?: ReactNode;
  /** Marks the value as refused, visibly and through `aria-invalid`. */
  invalid?: boolean;
};

function Capsule({ icon, action, invalid = false, className, ...props }: Field) {
  return (
    <div className={cn(fieldCapsule, "focus-within:shadow-field-focus", className)}>
      {icon}
      <input aria-invalid={invalid || undefined} className={bareInput} {...props} />
      {action ? <span className="-mr-[18px] flex shrink-0">{action}</span> : null}
    </div>
  );
}

export type TextFieldProps = Field & {
  /** The field's name, shown above it, such as "What". */
  label: string;
};

/**
 * A labelled text field of an app's form: the name above, the round glass capsule below (prototype .a-fld).
 * @design packages/design-system/design.md#buttons
 */
export function TextField({ label, id, className, ...props }: TextFieldProps) {
  const ownId = useId();
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id ?? ownId} className="pl-[26px]">{label}</Label>
      <Capsule id={id ?? ownId} {...props} />
    </div>
  );
}

export type SearchFieldProps = Omit<Field, "icon" | "type"> & {
  /** The field's name for a screen reader; the placeholder shows it. */
  label?: string;
};

/** A search capsule with an indigo magnifier, such as "Search email" (prototype .a-search). */
export function SearchField({ label = "Search", placeholder, className, ...props }: SearchFieldProps) {
  return <Capsule type="search" aria-label={label} placeholder={placeholder ?? label} icon={<Search size={26} strokeWidth={2.2} aria-hidden className="shrink-0 text-primary" />} className={cn("gap-3.5 [&_input]:px-0.5", className)} {...props} />;
}

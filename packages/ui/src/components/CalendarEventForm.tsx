import { useId, type ComponentProps, type ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import { cn } from "../lib/cn.ts";
import { usePortalContainer } from "../lib/portal.tsx";
import { Button } from "./Button.tsx";
import { CalendarGlyph } from "./CalendarIcon.tsx";
import { fieldCapsule } from "./Input.tsx";
import { Label } from "./Label.tsx";
import { menuOption, menuPanel } from "./Menu.tsx";
import { SegmentedControl } from "./SegmentedControl.tsx";
import { Switch } from "./Switch.tsx";
import { TextField } from "./TextField.tsx";

export interface CalendarChoice {
  value: string;
  label: string;
}

export type CalendarPickerFieldProps = {
  /** The field's name: "Day". */
  label: string;
  /** The value, as the app formats it: "Friday, November 13". */
  value: string;
  /** The icon before it, 24px. */
  icon: ReactNode;
  /** What a person can choose. */
  choices: CalendarChoice[];
  /** The chosen choice's value. */
  selected?: string;
  /** Whether the list is open. */
  open: boolean;
  /** Called when the list opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /** Called with the value a person picks. */
  onPick?: (value: string) => void;
  /** The words on the button that opens the list. */
  changeLabel?: string;
  /** The field waits, faded, while the form is being saved. */
  disabled?: boolean;
};

/** A form field whose value is picked from a list under it: Day and Time (prototype `.a-fld` with `.apop`). */
export function CalendarPickerField({ label, value, icon, choices, selected, open, onOpenChange, onPick, changeLabel = "Change", disabled = false }: CalendarPickerFieldProps) {
  const id = useId();
  const portalContainer = usePortalContainer();
  return (
    <div role="group" aria-labelledby={id} aria-disabled={disabled || undefined} className="flex flex-col gap-2">
      <Label id={id} className="pl-[26px]">
        {label}
      </Label>
      <Popover.Root open={open} onOpenChange={onOpenChange}>
        <Popover.Anchor className={cn(fieldCapsule, "gap-3", disabled && "opacity-40")}>
          <span className="flex shrink-0">{icon}</span>
          <span className="min-w-0 flex-1 truncate py-1 leading-none">{value}</span>
          <Popover.Trigger asChild>
            <Button variant="capsule" size="compact" className="-mr-[18px] h-12 px-[18px] text-control leading-none transition-none disabled:text-grace-ink" aria-label={`${changeLabel} ${label}`} disabled={disabled}>
              {changeLabel}
            </Button>
          </Popover.Trigger>
        </Popover.Anchor>
        <Popover.Portal container={portalContainer ?? undefined}>
          <Popover.Content
            side="bottom"
            align="start"
            sideOffset={-20}
            aria-label={label}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              (event.currentTarget as HTMLElement).focus();
            }}
            onCloseAutoFocus={(event) => event.preventDefault()}
            className={cn(menuPanel({ surface: "page" }), "max-h-[376px] overflow-auto font-sans [scrollbar-width:none]")}
          >
            {choices.map((choice) => (
              <button
                key={choice.value}
                type="button"
                aria-pressed={choice.value === selected}
                onClick={() => onPick?.(choice.value)}
                className={cn(menuOption({ surface: "page", selected: choice.value === selected }))}
              >
                {choice.label}
              </button>
            ))}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

type Choices = {
  options: string[];
  value: string;
  onChange?: (value: string) => void;
};

export type CalendarEventFormProps = Omit<ComponentProps<"div">, "title"> & {
  /** The event's name as typed. */
  title: string;
  /** Called as the name is typed. */
  onTitleChange?: (title: string) => void;
  /** The place as typed. */
  where: string;
  /** Called as the place is typed. */
  onWhereChange?: (where: string) => void;
  /** The Day field: its value, choices and list. */
  day: Omit<CalendarPickerFieldProps, "label" | "icon">;
  /** The Time field: its value, choices and list. */
  time: Omit<CalendarPickerFieldProps, "label" | "icon">;
  /** How it repeats: "Never", "Every week", "Every month". */
  repeat: Choices;
  /** When to remind: "No", "Day before", "1 hour before". */
  remind: Choices;
  /** Whether it is marked important, drawn in red on the calendar; without it the switch is not offered. */
  important?: { checked: boolean; onCheckedChange?: (checked: boolean) => void };
  /** Every field waits, faded, while the appointment is being saved. */
  disabled?: boolean;
  /** The fields' names and the title's example. */
  labels?: {
    title: string;
    titlePlaceholder: string;
    day: string;
    time: string;
    where: string;
    wherePlaceholder: string;
    repeat: string;
    remind: string;
    important: string;
    importantLine: string;
  };
};

const defaultLabels = {
  title: "What",
  titlePlaceholder: "For example: Bridge club",
  day: "Day",
  time: "Time",
  where: "Where (optional)",
  wherePlaceholder: "Add a place",
  repeat: "Repeats",
  remind: "Remind me",
  important: "Important",
  importantLine: "Shows in red on your calendar",
};

function ChoiceField({ label, options, value, onChange, disabled }: Choices & { label: string; disabled: boolean }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <Label id={id} className="pl-[26px]">
        {label}
      </Label>
      <SegmentedControl
        aria-labelledby={id}
        className="p-1.5 [&>button]:px-2.5 [&>button]:text-control [&>button]:leading-[normal]"
        value={value}
        disabled={disabled}
        onValueChange={(v) => v && onChange?.(v)}
        options={options.map((o) => ({ value: o, label: o }))}
      />
    </div>
  );
}

function ImportantField({ label, line, checked, onCheckedChange, disabled }: NonNullable<CalendarEventFormProps["important"]> & { label: string; line: string; disabled: boolean }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} aria-disabled={disabled || undefined} className="col-span-2 flex flex-col gap-2">
      <Label id={id} className="pl-[26px]">
        {label}
      </Label>
      <div className={cn(fieldCapsule, "justify-between pr-3", disabled && "opacity-40")}>
        <span className="flex items-center gap-3">
          <span aria-hidden className={cn("h-7 w-[3px] rounded-full", checked ? "bg-alert" : "bg-lavender")} />
          {line}
        </span>
        <Switch aria-labelledby={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled || !onCheckedChange} />
      </div>
    </div>
  );
}

/**
 * A new or changed appointment: what, day, time, where, how it repeats, when to remind and whether it is important
 * (prototype `calForm`, with the owner's Important switch for the prototype's red marking).
 * @model spec/app/calendar.md
 * @design packages/design-system/design.md#windows
 */
export function CalendarEventForm({ title, onTitleChange, where, onWhereChange, day, time, repeat, remind, important, disabled = false, labels = defaultLabels, className, ...props }: CalendarEventFormProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-x-7 gap-y-4 font-sans", className)} {...props}>
      <TextField className="col-span-2" label={labels.title} placeholder={labels.titlePlaceholder} value={title} disabled={disabled} onChange={(e) => onTitleChange?.(e.target.value)} />
      <CalendarPickerField label={labels.day} icon={<CalendarGlyph name="calendar" strokeWidth={2} />} disabled={disabled} {...day} />
      <CalendarPickerField label={labels.time} icon={<CalendarGlyph name="clock" strokeWidth={2} />} disabled={disabled} {...time} />
      <TextField className="col-span-2" label={labels.where} placeholder={labels.wherePlaceholder} value={where} disabled={disabled} onChange={(e) => onWhereChange?.(e.target.value)} />
      <ChoiceField label={labels.repeat} disabled={disabled} {...repeat} />
      <ChoiceField label={labels.remind} disabled={disabled} {...remind} />
      {important && <ImportantField label={labels.important} line={labels.importantLine} disabled={disabled} {...important} />}
    </div>
  );
}

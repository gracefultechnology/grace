import { useId, type ComponentProps, type ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Calendar, Clock } from "lucide-react";
import { cn, focusRing } from "../lib/cn.ts";
import { Button } from "./Button.tsx";
import { fieldCapsule } from "./Input.tsx";
import { Label } from "./Label.tsx";
import { SegmentedControl } from "./SegmentedControl.tsx";
import { TextField } from "./TextField.tsx";

export interface CalendarChoice {
  value: string;
  /** What the option says: "Tomorrow · Nov 14", "10:30 am". */
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
};

/** A form field whose value is picked from a list under it: Day and Time (prototype `.a-fld` with `.apop`). */
export function CalendarPickerField({ label, value, icon, choices, selected, open, onOpenChange, onPick, changeLabel = "Change" }: CalendarPickerFieldProps) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="flex flex-col gap-2">
      <Label id={id} className="pl-[26px]">
        {label}
      </Label>
      <Popover.Root open={open} onOpenChange={onOpenChange}>
        {/* Prototype `.a-fld .v`: 12px between icon, value and Change. */}
        <Popover.Anchor className={cn(fieldCapsule, "gap-3")}>
          <span className="flex shrink-0">{icon}</span>
          <span className="min-w-0 flex-1 truncate">{value}</span>
          <Popover.Trigger asChild>
            {/* Prototype `.a-fld .v .a-btn`: 48px, 18px words, its edge 8px from the capsule's. */}
            <Button variant="capsule" size="compact" className="-mr-[18px] h-12 px-[18px] text-lg" aria-label={`${changeLabel} ${label}`}>
              {changeLabel}
            </Button>
          </Popover.Trigger>
        </Popover.Anchor>
        <Popover.Portal>
          {/* Prototype `.apop` at `left:0;top:76px` of the field: 20px over the capsule's foot. */}
          <Popover.Content
            side="bottom"
            align="start"
            sideOffset={-20}
            aria-label={label}
            // The list opens at its top, as the prototype's does; Tab moves into the choices.
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              (event.currentTarget as HTMLElement).focus();
            }}
            // `.apop` `min-width:320px;max-height:360px;padding:8px`, content-box: 336px wide, at most 376px tall.
            className="z-50 flex max-h-[376px] min-w-[336px] flex-col gap-2 overflow-auto rounded-menu bg-glass/95 p-2 font-sans shadow-popover outline-none [scrollbar-width:none]"
          >
            {choices.map((choice) => (
              <button
                key={choice.value}
                type="button"
                aria-pressed={choice.value === selected}
                onClick={() => onPick?.(choice.value)}
                className={cn(
                  focusRing,
                  "flex h-15 flex-none cursor-pointer items-center rounded-full bg-panel px-[22px] text-body font-bold text-grace-ink",
                  choice.value === selected && "bg-card text-primary shadow-raised",
                )}
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
};

/** A labelled choice of a few, side by side (prototype `.a-fld .a-seg`). */
function ChoiceField({ label, options, value, onChange }: Choices & { label: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <Label id={id} className="pl-[26px]">
        {label}
      </Label>
      <SegmentedControl
        aria-labelledby={id}
        className="p-1.5 [&>button]:px-2.5 [&>button]:text-[19px]"
        value={value}
        onValueChange={(v) => v && onChange?.(v)}
        options={options.map((o) => ({ value: o, label: o }))}
      />
    </div>
  );
}

/**
 * A new or changed appointment: what, day, time, where, how it repeats and when to remind (prototype `calForm`).
 * @model spec/app/calendar.md
 * @design packages/design-system/design.md#windows
 */
export function CalendarEventForm({ title, onTitleChange, where, onWhereChange, day, time, repeat, remind, labels = defaultLabels, className, ...props }: CalendarEventFormProps) {
  const glyph = { size: 24, strokeWidth: 2, "aria-hidden": true } as const;
  return (
    // Prototype `.a-form`: two columns, 16px between rows and 28px between columns.
    <div className={cn("grid grid-cols-2 gap-x-7 gap-y-4 font-sans", className)} {...props}>
      <TextField className="col-span-2" label={labels.title} placeholder={labels.titlePlaceholder} value={title} onChange={(e) => onTitleChange?.(e.target.value)} />
      <CalendarPickerField label={labels.day} icon={<Calendar {...glyph} />} {...day} />
      <CalendarPickerField label={labels.time} icon={<Clock {...glyph} />} {...time} />
      <TextField className="col-span-2" label={labels.where} placeholder={labels.wherePlaceholder} value={where} onChange={(e) => onWhereChange?.(e.target.value)} />
      <ChoiceField label={labels.repeat} {...repeat} />
      <ChoiceField label={labels.remind} {...remind} />
    </div>
  );
}

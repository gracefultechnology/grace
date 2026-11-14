import type { ComponentProps, ReactNode } from "react";
import { Bell, Clock, Mail, MapPin, Pencil, Repeat, Trash, User } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";
import { Panel } from "./Panel.tsx";

export type CalendarEventDetailProps = ComponentProps<"div"> & {
  /** When it is: "Saturday, November 14 · 10 am to 11 am". */
  when: string;
  /** Where it is: "Main St clinic · 214 Main Street". */
  where?: string;
  /** Who it is with: "Dr. Patel". */
  who?: string;
  /** Its reminder: "Reminder day before", "No reminder". */
  reminder: string;
  /** How it repeats: "Doesn’t repeat", "Repeats every week". */
  repeat: string;
  /** Where it came from: "From the clinic’s email · Visit form attached". */
  note?: string;
  /** Opens the event in the form. */
  onEdit?: () => void;
  /** Asks whether to delete it. */
  onDelete?: () => void;
  editLabel?: string;
  deleteLabel?: string;
};

const icon = { size: 28, strokeWidth: 2, "aria-hidden": true } as const;
const pill = { size: 22, strokeWidth: 2.2, "aria-hidden": true } as const;

/**
 * One event's details, a line each with its icon, then Edit and Delete (prototype `calView` detail).
 * @model spec/app/calendarView.md
 * @design packages/design-system/design.md#windows
 */
export function CalendarEventDetail({ when, where, who, reminder, repeat, note, onEdit, onDelete, editLabel = "Edit", deleteLabel = "Delete", className, ...props }: CalendarEventDetailProps) {
  const lines: [ReactNode, string | undefined][] = [
    [<Clock key="when" {...icon} />, when],
    [<MapPin key="where" {...icon} />, where],
    [<User key="who" {...icon} />, who],
    [<Bell key="reminder" {...icon} />, reminder],
    [<Repeat key="repeat" {...icon} />, repeat],
    [<Mail key="note" {...icon} />, note],
  ];
  return (
    <div className={cn("font-sans", className)} {...props}>
      {/* Prototype `.a-panel` with `max-width:880px;padding-top:8px`. */}
      <Panel className="max-w-[880px] pt-2">
        <ul className="m-0 list-none p-0">
          {lines.map(([glyph, text]) =>
            text ? (
              <li key={text} className="mt-4 flex items-center gap-4 text-body-lg leading-[30px] text-foreground">
                <span className="flex text-primary">{glyph}</span>
                {text}
              </li>
            ) : null,
          )}
        </ul>
      </Panel>
      {/* Prototype `.a-btns` with `margin-top:22px`. */}
      <div className="mt-[22px] flex flex-wrap gap-3">
        <Button variant="capsule" size="pill" className="pr-[26px] pl-[22px]" onClick={onEdit}>
          <Pencil {...pill} />
          {editLabel}
        </Button>
        <Button variant="warn" size="pill" className="pr-[26px] pl-[22px]" onClick={onDelete}>
          <Trash {...pill} />
          {deleteLabel}
        </Button>
      </div>
    </div>
  );
}

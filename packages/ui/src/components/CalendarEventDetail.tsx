import type { ComponentProps } from "react";
import { AlarmClockPlus, X } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { BillOffer, type BillOfferProps } from "./BillOffer.tsx";
import { Button } from "./Button.tsx";
import { CalendarGlyph } from "./CalendarIcon.tsx";
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
  /** Its reminder is showing now: the bell turns red, with Dismiss beside it. */
  onDismissReminder?: () => void;
  /** Its reminder is showing now and can come back later: Snooze beside the bell. */
  onSnoozeReminder?: () => void;
  dismissReminderLabel?: string;
  snoozeReminderLabel?: string;
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
  /** The bill a bill occurrence was saved from: already confirmed, so Open bill beside its payment status. */
  bill?: Omit<BillOfferProps, "confirmed" | "onConfirm" | "onDismiss">;
};

/**
 * One event's details, a line each with its icon, then Edit and Delete (prototype `calView` detail). While its reminder
 * is showing, Dismiss and Snooze stand on the reminder's line.
 * @model spec/app/calendarView.md
 * @design packages/design-system/design.md#windows
 */
export function CalendarEventDetail({
  when,
  where,
  who,
  reminder,
  onDismissReminder,
  onSnoozeReminder,
  dismissReminderLabel = "Dismiss",
  snoozeReminderLabel = "Snooze",
  repeat,
  note,
  onEdit,
  onDelete,
  editLabel = "Edit",
  deleteLabel = "Delete",
  bill,
  className,
  ...props
}: CalendarEventDetailProps) {
  const due = Boolean(onDismissReminder ?? onSnoozeReminder);
  const lines = [
    ["clock", when],
    ["pin", where],
    ["person", who],
    ["bell", reminder],
    ["repeat", repeat],
    ["mail", note],
  ] as const;
  return (
    <div className={cn("font-sans", className)} {...props}>
      <Panel className="max-w-[880px] pt-2">
        <ul className="m-0 list-none p-0">
          {lines.map(([glyph, text]) =>
            text ? (
              <li key={glyph} className="mt-4 flex flex-wrap items-center gap-4 text-body-lg leading-[30px] text-foreground">
                <span className={cn("flex", glyph === "bell" && due ? "text-alert" : "text-primary")}>
                  <CalendarGlyph name={glyph} size={28} strokeWidth={2} />
                </span>
                {text}
                {glyph === "bell" && due && (
                  <span className="ml-auto flex gap-3">
                    {onSnoozeReminder && (
                      <Button variant="capsule" size="compact" onClick={onSnoozeReminder}>
                        <AlarmClockPlus aria-hidden size={22} strokeWidth={2.2} />
                        {snoozeReminderLabel}
                      </Button>
                    )}
                    {onDismissReminder && (
                      <Button variant="capsule" size="compact" onClick={onDismissReminder}>
                        <X aria-hidden size={22} strokeWidth={2.2} />
                        {dismissReminderLabel}
                      </Button>
                    )}
                  </span>
                )}
              </li>
            ) : null,
          )}
        </ul>
      </Panel>
      {bill && <BillOffer confirmed {...bill} className="mt-3.5 max-w-[880px]" />}
      <div className="mt-[22px] flex flex-wrap gap-3">
        <Button variant="capsule" size="pill" className="pr-[26px] pl-[22px] leading-none transition-none" onClick={onEdit}>
          <CalendarGlyph name="pencil" size={22} />
          {editLabel}
        </Button>
        <Button variant="warn" size="pill" className="pr-[26px] pl-[22px] leading-none transition-none" onClick={onDelete}>
          <CalendarGlyph name="trash" size={22} />
          {deleteLabel}
        </Button>
      </div>
    </div>
  );
}

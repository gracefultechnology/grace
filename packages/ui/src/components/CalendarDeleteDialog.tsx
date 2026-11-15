import { Trash } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";
import { Dialog, DialogContent, DialogTitle, type DialogProps } from "./Dialog.tsx";

/** What a deletion removes: the chosen occurrence, or every occurrence of its repeating event. */
export type CalendarDeleteScope = "occurrence" | "series";

export type CalendarDeleteDialogProps = Omit<DialogProps, "children"> & {
  /** The question: "Delete Doctor’s appointment?". */
  title: string;
  /** What is deleted: "Saturday, November 14 at 10 am." or "It repeats every week.". */
  description: string;
  /** The event repeats: offer this one or every one, instead of just "Delete it". */
  repeating?: boolean;
  /** Called with what a person chose to delete; this is their approval. */
  onDelete?: (scope: CalendarDeleteScope) => void;
  /** Called by Keep it. */
  onKeep?: () => void;
  /** The deletion is being saved: the choices wait. */
  pending?: boolean;
  /** The words on the choices. */
  labels?: { one: string; occurrence: string; series: string; keep: string };
  className?: string;
};

const defaultLabels = {
  one: "Delete it",
  occurrence: "Delete only this one",
  series: "Delete every one",
  keep: "Keep it",
};

/**
 * The question before an event is deleted: this one or every one, or keep it (prototype `calDlg`).
 * @model spec/app/calendarView.md
 * @design packages/design-system/design.md#windows
 */
export function CalendarDeleteDialog({ title, description, repeating = false, onDelete, onKeep, pending = false, labels = defaultLabels, className, ...props }: CalendarDeleteDialogProps) {
  const choice = (scope: CalendarDeleteScope, label: string) => (
    <Button key={scope} variant="warn" size="pill" className="w-full" loading={pending} onClick={() => onDelete?.(scope)}>
      {!pending && <Trash size={22} strokeWidth={2.2} aria-hidden />}
      {label}
    </Button>
  );
  return (
    <Dialog {...props}>
      {/* Prototype `.a-dlg`: `width:560px;padding:32px` content-box, 624px across, (Keep it closes it). Focus starts on the panel, not on a deletion. */}
      <DialogContent
        className={cn("gap-0", className)}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement).focus();
        }}
      >
        <DialogTitle>{title}</DialogTitle>
        <p className="m-0 mt-2 text-body-lg leading-[30px] text-muted-foreground">{description}</p>
        {/* Prototype `.a-dlg .a-btns`: a column of full-width buttons. */}
        <div className="mt-6 flex flex-col gap-3">
          {repeating ? [choice("occurrence", labels.occurrence), choice("series", labels.series)] : choice("occurrence", labels.one)}
          <Button variant="capsule" size="pill" className="w-full" disabled={pending} onClick={onKeep}>
            {labels.keep}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

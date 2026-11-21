import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Alert } from "./Alert.tsx";
import { Button } from "./Button.tsx";
import { CalendarGlyph } from "./CalendarIcon.tsx";
import { Dialog, DialogActions, DialogContent, DialogTitle, type DialogProps } from "./Dialog.tsx";

export type CalendarDeleteScope = "occurrence" | "series";

export type CalendarDeleteDialogProps = Omit<DialogProps, "children"> & {
  /** The question: "Delete Doctor’s appointment?". */
  title: string;
  /** What is deleted: "Saturday, November 14 at 10 am." or "It repeats every week.". */
  description: string;
  /** The event repeats: offer this one or every one, instead of just "Delete it". */
  repeating?: boolean;
  /** Called with what a person chose to delete; this is their approval. Without it no Delete choice is offered. */
  onDelete?: (scope: CalendarDeleteScope) => void;
  /** Called by Keep it; without it Keep it is not offered. */
  onKeep?: () => void;
  /** The deletion failed: what it says above the choices, which stay to choose again. */
  error?: ReactNode;
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
export function CalendarDeleteDialog({ title, description, repeating = false, onDelete, onKeep, error, pending = false, labels = defaultLabels, className, ...props }: CalendarDeleteDialogProps) {
  const choice = (remove: (scope: CalendarDeleteScope) => void, scope: CalendarDeleteScope, label: string) => (
    <Button key={scope} variant="warn" size="pill" className="leading-none transition-none" loading={pending} onClick={() => remove(scope)}>
      {!pending && <CalendarGlyph name="trash" size={22} />}
      {label}
    </Button>
  );
  return (
    <Dialog {...props}>
      <DialogContent
        className={cn("gap-0", className)}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement).focus();
        }}
      >
        <DialogTitle>{title}</DialogTitle>
        <p className="m-0 mt-2 text-body-lg leading-[30px] text-muted-foreground">{description}</p>
        {error != null && (
          <Alert variant="caution" icon={<TriangleAlert size={26} strokeWidth={2.2} />} className="mt-5">
            {error}
          </Alert>
        )}
        {(onDelete ?? onKeep) && (
          <DialogActions>
            {onDelete && (repeating ? [choice(onDelete, "occurrence", labels.occurrence), choice(onDelete, "series", labels.series)] : choice(onDelete, "occurrence", labels.one))}
            {onKeep && (
              <Button variant="capsule" size="pill" className="leading-none transition-none" disabled={pending} onClick={onKeep}>
                {labels.keep}
              </Button>
            )}
          </DialogActions>
        )}
      </DialogContent>
    </Dialog>
  );
}

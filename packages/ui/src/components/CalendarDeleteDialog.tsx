import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Alert } from "./Alert.tsx";
import { Button } from "./Button.tsx";
import { CalendarGlyph } from "./CalendarIcon.tsx";
import { Dialog, DialogActions, DialogContent, DialogTitle, type DialogProps } from "./Dialog.tsx";

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
  const choice = (scope: CalendarDeleteScope, label: string) => (
    // Prototype `.a-btn`: `20px/1`, no transition.
    <Button key={scope} variant="warn" size="pill" className="leading-none transition-none" loading={pending} onClick={() => onDelete?.(scope)}>
      {!pending && <CalendarGlyph name="trash" size={22} />}
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
        {error != null && (
          // Prototype `.a-caution` of a refusal (line 2006): a 26px mark.
          <Alert variant="caution" icon={<TriangleAlert size={26} strokeWidth={2.2} />} className="mt-5">
            {error}
          </Alert>
        )}
        <DialogActions>
          {repeating ? [choice("occurrence", labels.occurrence), choice("series", labels.series)] : choice("occurrence", labels.one)}
          <Button variant="capsule" size="pill" className="leading-none transition-none" disabled={pending} onClick={onKeep}>
            {labels.keep}
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}

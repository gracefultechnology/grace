import type { ComponentProps, ReactNode } from "react";
import { Check, TriangleAlert } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Button, press } from "./Button.tsx";
import { Spinner } from "./Spinner.tsx";

/** Where saving to Files stands: only `saved` once the store acknowledged it. */
export type MailSaveStatus = "saving" | "saved" | "failed";

/** Where a print stands: `accepted` only once the printer took the job; `unknown` while that is not yet known. */
export type MailPrintStatus = "pending" | "accepted" | "failed" | "unknown";

/** The words of what a save or print did, for another language. */
export type MailActionStatusLabels = Record<`save-${MailSaveStatus}` | `print-${MailPrintStatus}`, string> & { retry: string };

export const mailActionStatusLabels: MailActionStatusLabels = {
  "save-saving": "Saving to Files…",
  "save-saved": "Saved to Files",
  "save-failed": "Couldn’t save. Try again.",
  "print-pending": "Sending to the printer…",
  "print-accepted": "Sent to the printer",
  "print-failed": "Couldn’t print. Try again.",
  "print-unknown": "Still checking the printer…",
  retry: "Try again",
};

/** A capsule inside an app window (prototype `.a-btn`): `20px/1` words, a press that snaps, and faded whole when disabled (`#awin .a-btn[aria-disabled="true"]`). */
export const appButton = "leading-none transition-none disabled:text-grace-ink disabled:opacity-40";

/** The one next step inside an app window (prototype `.a-btn.prom`): its indigo is `!important` and it has no press. */
export const appProminent = "leading-none active:scale-100 active:bg-primary";

/** A pill in an app window's header (prototype `#awin .aphdr .hgrp .pill:not(.prom)`): clear, pressed it sinks to 97% (`#ahdr .pill:not(.prom):active`). */
export const headerPill = cn(press, "text-grace-ink active:scale-97 active:bg-transparent");

/** A button's icon while its action is in flight: the spinner takes the icon's 22px, so the button keeps its width. */
export const pendingMark = (pending: boolean, icon: ReactNode) => (pending ? <Spinner size="md" aria-hidden /> : icon);

export type MailActionStatusProps = Omit<ComponentProps<"div">, "children"> & {
  /** Which action it reports. */
  action: "save" | "print";
  /** What actually happened to it. */
  status: MailSaveStatus | MailPrintStatus;
  /** Tries again after a failure, by the Try again its words offer. */
  onRetry?: () => void;
  /** Its words, for another language. */
  labels?: Partial<MailActionStatusLabels>;
};

/**
 * What saving an attachment to Files or printing it actually did, in place of the prototype's always-successful toast
 * (`axToast('Saved to Files')`, `'Sent to the printer'`): working, done in green, or failed in red with Try again.
 * @model spec/app/files.md
 * @design packages/design-system/design.md#windows
 */
export function MailActionStatus({ action, status, onRetry, labels, className, ...props }: MailActionStatusProps) {
  const l = { ...mailActionStatusLabels, ...labels };
  const text = l[`${action}-${status}` as keyof MailActionStatusLabels];
  const failed = status === "failed";
  const done = status === "saved" || status === "accepted";
  return (
    <div
      role={failed ? "alert" : "status"}
      className={cn("flex items-center gap-2.5 text-body leading-[26px] font-semibold", failed ? "text-destructive" : done ? "text-ok" : "text-muted-foreground", className)}
      {...props}
    >
      {failed ? <TriangleAlert size={22} strokeWidth={2.2} aria-hidden /> : done ? <Check size={22} strokeWidth={2.6} aria-hidden /> : <Spinner size="md" aria-hidden />}
      {text}
      {failed && (
        <Button variant="capsule" size="compact" className={cn(appButton, "ml-1.5 h-12 px-5 text-grace-ink")} onClick={onRetry}>
          {l.retry}
        </Button>
      )}
    </div>
  );
}

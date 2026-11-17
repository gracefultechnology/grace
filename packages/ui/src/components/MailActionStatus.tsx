import type { ComponentProps, ReactNode } from "react";
import { Check, TriangleAlert } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Button, press } from "./Button.tsx";
import { Spinner } from "./Spinner.tsx";

export type MailSaveStatus = "saving" | "saved" | "failed";

export type MailActionStatusLabels = Record<MailSaveStatus, string> & { retry: string };

export const mailActionStatusLabels: MailActionStatusLabels = {
  saving: "Saving to Files…",
  saved: "Saved to Files",
  failed: "Couldn’t save. Try again.",
  retry: "Try again",
};

export const appButton = "leading-none transition-none disabled:text-grace-ink disabled:opacity-40";

export const appProminent = "leading-none active:scale-100 active:bg-primary";

export const headerPill = cn(press, "text-grace-ink active:scale-97 active:bg-transparent");

export const pendingMark = (pending: boolean, icon: ReactNode) => (pending ? <Spinner size="md" aria-hidden /> : icon);

export type MailActionStatusProps = Omit<ComponentProps<"div">, "children"> & {
  /** The action it reports: saving to Files, the only one. */
  action?: "save";
  /** What saving actually did. */
  status: MailSaveStatus;
  /** Tries again after a failure, by the Try again its words offer. */
  onRetry?: () => void;
  /** Its words, for another language. */
  labels?: Partial<MailActionStatusLabels>;
};

/**
 * What saving an attachment to Files actually did, in place of the prototype's always-successful toast
 * (`axToast('Saved to Files')`): working, done in green, or failed in red with Try again.
 * @model spec/app/files.md
 * @design packages/design-system/design.md#windows
 */
export function MailActionStatus({ action: _action, status, onRetry, labels, className, ...props }: MailActionStatusProps) {
  const l = { ...mailActionStatusLabels, ...labels };
  const failed = status === "failed";
  const done = status === "saved";
  return (
    <div
      role={failed ? "alert" : "status"}
      className={cn("flex items-center gap-2.5 text-body leading-[26px] font-semibold", failed ? "text-destructive" : done ? "text-ok" : "text-muted-foreground", className)}
      {...props}
    >
      {failed ? <TriangleAlert size={22} strokeWidth={2.2} aria-hidden /> : done ? <Check size={22} strokeWidth={2.6} aria-hidden /> : <Spinner size="md" aria-hidden />}
      {l[status]}
      {failed && (
        <Button variant="capsule" size="compact" className={cn(appButton, "ml-1.5 h-12 px-5 text-grace-ink")} onClick={onRetry}>
          {l.retry}
        </Button>
      )}
    </div>
  );
}

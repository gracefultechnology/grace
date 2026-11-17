import type { ComponentProps } from "react";
import { CalendarCheck, CircleCheck, CircleHelp, CircleX, Clock, Undo2, type LucideIcon } from "lucide-react";
import { cn } from "../lib/cn.ts";

export type TagTone = "accent" | "ok" | "warn" | "caution";

const tagTones: Record<TagTone, string> = {
  accent: "bg-card text-primary inset-ring-primary/30",
  ok: "bg-card text-ok inset-ring-ok/30",
  warn: "bg-card text-warn inset-ring-warn/30",
  caution: "bg-caution text-destructive inset-ring-destructive/22",
};

export type StatusTagProps = ComponentProps<"span"> & {
  icon: LucideIcon;
  tone: TagTone;
};

/** An icon and a word on a small tag, in one of the shared tones; a task's status and its outcome both draw one. */
export function StatusTag({ icon: Icon, tone, children, className, ...props }: StatusTagProps) {
  return (
    <span
      className={cn("inline-flex min-h-9 max-w-full items-start gap-2 rounded-tag px-3 py-[7px] text-left text-label leading-[22px] font-semibold inset-ring-[1.5px]", tagTones[tone], className)}
      {...props}
    >
      <Icon aria-hidden size={20} strokeWidth={2.2} className="mt-px flex-none" />
      <span className="min-w-0 break-words">{children}</span>
    </span>
  );
}

export type PaymentStatus = "unknown" | "pending" | "scheduled" | "accepted" | "completed" | "failed" | "returned";

export type PaymentStatusLabels = Record<PaymentStatus, string> & {
  reference: string;
  name: string;
};

export const paymentStatusLabels: PaymentStatusLabels = {
  unknown: "Not checked yet",
  pending: "Waiting for the company",
  scheduled: "Scheduled for {date}",
  accepted: "Accepted by {company}",
  completed: "Paid {date}",
  failed: "Didn’t go through",
  returned: "Returned",
  reference: "Confirmation {reference}",
  name: "Payment",
};

export const bookingStatusLabels: PaymentStatusLabels = {
  unknown: "Not checked yet",
  pending: "Waiting for {company} to confirm",
  scheduled: "Booked for {date}",
  accepted: "Accepted by {company}",
  completed: "Confirmed for {date}",
  failed: "Didn’t go through",
  returned: "Cancelled",
  reference: "Confirmation {reference}",
  name: "Booking",
};

const statuses: Record<PaymentStatus, { icon: LucideIcon; tone: TagTone }> = {
  unknown: { icon: CircleHelp, tone: "warn" },
  pending: { icon: Clock, tone: "warn" },
  scheduled: { icon: CalendarCheck, tone: "ok" },
  accepted: { icon: CircleCheck, tone: "ok" },
  completed: { icon: CircleCheck, tone: "ok" },
  failed: { icon: CircleX, tone: "caution" },
  returned: { icon: Undo2, tone: "caution" },
};

const fill = (template: string, values: Record<string, string | undefined>) => template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");

export type PaymentStatusBadgeProps = Omit<ComponentProps<"span">, "children"> & {
  /** The task's result as last saved. */
  status: PaymentStatus;
  /** The day it is scheduled or booked for, or was paid: "Nov 12". */
  date?: string;
  /** Who accepted it: "Chase", "Main St Clinic". */
  company?: string;
  /** The confirmation, shown after the status: "4F7K-22Q". */
  reference?: string;
  /** The task kind's words, such as `bookingStatusLabels`; a bill's by default. */
  labels?: Partial<PaymentStatusLabels>;
};

/**
 * The result of one task, wherever it appears (a calendar occurrence, a bill email, Grace's messages): an icon and a
 * word on a small tag, in `ok`, `warn` or `caution`, its whole meaning, named by its kind, in its accessible name.
 * @model spec/app/commitment.md
 * @design packages/design-system/design.md#grace
 */
export function PaymentStatusBadge({ status, date, company, reference, labels, ...props }: PaymentStatusBadgeProps) {
  const words = { ...paymentStatusLabels, ...labels };
  const text = fill(words[status], { date, company });
  const confirmation = reference ? fill(words.reference, { reference }) : undefined;
  return (
    <StatusTag role="status" aria-label={`${words.name}: ${[text, confirmation].filter(Boolean).join(", ")}`} {...statuses[status]} {...props}>
      {text}
      {confirmation && (
        <>
          {", "}
          <span className="inline-block font-medium">{confirmation}</span>
        </>
      )}
    </StatusTag>
  );
}

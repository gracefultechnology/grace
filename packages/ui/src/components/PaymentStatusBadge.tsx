import type { ComponentProps } from "react";
import { CalendarCheck, CircleCheck, CircleHelp, CircleX, Clock, Undo2, type LucideIcon } from "lucide-react";
import { StatusTag, type TagTone } from "./StatusTag.tsx";

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
  ...paymentStatusLabels,
  pending: "Waiting for {company} to confirm",
  scheduled: "Booked for {date}",
  accepted: "Request received by {company}",
  completed: "Visit kept {date}",
  returned: "Cancelled",
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
  /** The day it is scheduled or booked for, was paid, or the visit was kept: "Nov 12". */
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

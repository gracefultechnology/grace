import type { ComponentProps } from "react";
import { CalendarCheck, CircleCheck, CircleHelp, CircleX, Clock, Undo2, type LucideIcon } from "lucide-react";
import { cn } from "../lib/cn.ts";

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

const tones: Record<PaymentStatus, { icon: LucideIcon; tone: string }> = {
  unknown: { icon: CircleHelp, tone: "bg-card text-warn inset-ring-[1.5px] inset-ring-warn/30" },
  pending: { icon: Clock, tone: "bg-card text-warn inset-ring-[1.5px] inset-ring-warn/30" },
  scheduled: { icon: CalendarCheck, tone: "bg-card text-ok inset-ring-[1.5px] inset-ring-ok/30" },
  accepted: { icon: CircleCheck, tone: "bg-card text-ok inset-ring-[1.5px] inset-ring-ok/30" },
  completed: { icon: CircleCheck, tone: "bg-card text-ok inset-ring-[1.5px] inset-ring-ok/30" },
  failed: { icon: CircleX, tone: "bg-caution text-destructive inset-ring-[1.5px] inset-ring-destructive/22" },
  returned: { icon: Undo2, tone: "bg-caution text-destructive inset-ring-[1.5px] inset-ring-destructive/22" },
};

const fill = (template: string, values: Record<string, string | undefined>) => template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");

export type PaymentStatusBadgeProps = Omit<ComponentProps<"span">, "children"> & {
  /** The payment's result as last saved. */
  status: PaymentStatus;
  /** The day it is scheduled for or was paid: "Nov 12". */
  date?: string;
  /** The company that accepted it: "Chase". */
  company?: string;
  /** The company's confirmation, shown after the status: "4F7K-22Q". */
  reference?: string;
  /** Words to use instead of the defaults, to localize. */
  labels?: Partial<PaymentStatusLabels>;
};

/**
 * The result of one bill's payment, wherever the bill appears (a calendar occurrence, a bill email, Grace's messages):
 * an icon and a word on a small tag, in `ok`, `warn` or `caution`, its whole meaning in its accessible name.
 * @model spec/app/commitment.md
 * @design packages/design-system/design.md#grace
 */
export function PaymentStatusBadge({ status, date, company, reference, labels, className, ...props }: PaymentStatusBadgeProps) {
  const words = { ...paymentStatusLabels, ...labels };
  const { icon: Icon, tone } = tones[status];
  const text = fill(words[status], { date, company });
  const confirmation = reference ? fill(words.reference, { reference }) : undefined;
  return (
    <span
      role="status"
      aria-label={`${words.name}: ${[text, confirmation].filter(Boolean).join(", ")}`}
      className={cn("inline-flex min-h-9 max-w-full items-start gap-2 rounded-tag px-3 py-[7px] text-left text-label leading-[22px] font-semibold", tone, className)}
      {...props}
    >
      <Icon aria-hidden size={20} strokeWidth={2.2} className="mt-px flex-none" />
      <span className="min-w-0 break-words">
        {text}
        {confirmation && (
          <>
            {", "}
            <span className="inline-block font-medium">{confirmation}</span>
          </>
        )}
      </span>
    </span>
  );
}

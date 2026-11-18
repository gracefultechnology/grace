import { RefreshCw } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { FactRow, factList } from "../lib/facts.tsx";
import { Panel, type PanelProps } from "./Panel.tsx";
import { VoiceBars } from "./VoiceBars.tsx";

export type TaskReviewRow = {
  label: string;
  value: string;
};

export type TaskReviewLabels = {
  heading: string;
  note: string;
  stale: string;
};

export const billReviewLabels: TaskReviewLabels = {
  heading: "Pay {who}",
  note: "Nothing is paid until you say yes.",
  stale: "These details changed",
};

export const bookingReviewLabels: TaskReviewLabels = {
  ...billReviewLabels,
  heading: "Book with {who}",
  note: "Nothing is booked until you say yes.",
};

export type TaskReviewCardProps = Omit<PanelProps, "variant" | "children" | "title"> & {
  /** Who the task is with: "Chase", "Main St Clinic". */
  who: string;
  /** Every detail of what she agrees to, in the order Grace reads them. */
  rows: TaskReviewRow[];
  /** The details changed and are being checked again: they fade and cannot be approved. */
  stale?: boolean;
  /** Grace is reading the details aloud. */
  reading?: boolean;
  /** The task kind's words, such as `billReviewLabels`; `{who}` in the heading is filled in. */
  labels: TaskReviewLabels;
};

/**
 * The review shown before Margaret approves a task by voice or tap: "Pay Chase" or "Book with Main St Clinic", then each
 * detail, the same that Grace reads aloud. Its answers, naming the whole action ("Yes, pay it", "Yes, book it",
 * "Change something"), are `AnswerChip`s after it, and her own tap on the website's button approves as well.
 * @model spec/app/commitment.md
 * @design packages/design-system/design.md#grace
 */
export function TaskReviewCard({ who, rows, stale = false, reading = false, labels, className, ...props }: TaskReviewCardProps) {
  const heading = labels.heading.replace("{who}", who);
  return (
    <Panel
      role="group"
      aria-label={heading}
      aria-busy={stale || undefined}
      className={cn(
        "flex flex-col gap-5 transition-[background-color,box-shadow] duration-base",
        reading && !stale && "bg-card shadow-raised inset-ring-2 inset-ring-lavender",
        className,
      )}
      {...props}
    >
      <p className="m-0 flex items-center gap-3 text-title-sm leading-8 font-bold text-chrome">
        {reading && !stale && <VoiceBars />}
        {heading}
      </p>
      <dl className={factList}>
        {rows.map((row) => (
          <FactRow key={row.label} label={row.label} className={cn("font-bold", stale ? "text-muted-foreground" : "text-foreground")}>
            {row.value}
          </FactRow>
        ))}
      </dl>
      {stale ? (
        <p role="status" className="m-0 flex items-center gap-2.5 text-body leading-[26px] font-semibold text-warn">
          <RefreshCw aria-hidden size={22} strokeWidth={2.2} className="animate-spin-slow motion-reduce:animate-none" />
          {labels.stale}
        </p>
      ) : (
        <p className="m-0 text-body leading-[26px] font-medium text-muted-foreground">{labels.note}</p>
      )}
    </Panel>
  );
}

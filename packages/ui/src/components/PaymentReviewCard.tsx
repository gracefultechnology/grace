import { RefreshCw } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { FactRow, factList } from "../lib/facts.tsx";
import { Panel, type PanelProps } from "./Panel.tsx";
import { VoiceBars } from "./VoiceBars.tsx";

export type PaymentReviewRow = {
  label: string;
  value: string;
};

export type PaymentReviewCardProps = Omit<PanelProps, "variant" | "children" | "title"> & {
  /** The company to be paid: "Chase". */
  company: string;
  /** Every detail of the proposal, in the order Grace reads them: amount, date, pay from, fee, account. */
  rows: PaymentReviewRow[];
  /** One line under the details: "Nothing is paid until you say yes." */
  note?: string;
  /** The details changed and are being checked again: they fade and cannot be approved. */
  stale?: boolean;
  /** Grace is reading the details aloud. */
  reading?: boolean;
  /** The heading; `{company}` is filled in. */
  title?: string;
  /** What a stale card says. */
  staleLabel?: string;
};

/**
 * The review shown before Margaret approves a payment by voice or tap: "Pay Chase", then each detail of the proposal,
 * the same that Grace reads aloud. Its answers ("Yes, pay it", "Change something") are `AnswerChip`s after it.
 * @model spec/app/payment.md
 * @design packages/design-system/design.md#grace
 */
export function PaymentReviewCard({
  company,
  rows,
  note,
  stale = false,
  reading = false,
  title = "Pay {company}",
  staleLabel = "These details changed",
  className,
  ...props
}: PaymentReviewCardProps) {
  const heading = title.replace("{company}", company);
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
          {staleLabel}
        </p>
      ) : (
        note && <p className="m-0 text-body leading-[26px] font-medium text-muted-foreground">{note}</p>
      )}
    </Panel>
  );
}

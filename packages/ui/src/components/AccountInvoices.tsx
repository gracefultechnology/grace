import type { ComponentProps, ReactNode } from "react";
import { CircleCheck, CircleSlash, Clock, FilePen, type LucideIcon } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { AccountFacts } from "./AccountFacts.tsx";
import { Alert } from "./Alert.tsx";
import { Button } from "./Button.tsx";
import { EmptyState } from "./EmptyState.tsx";
import { ListRow } from "./ListRow.tsx";
import { PageText } from "./PageHeading.tsx";
import { RetryNotice } from "./RetryNotice.tsx";
import { SettingsAccountPage } from "./SettingsPageHeading.tsx";

export type InvoiceStatus = "draft" | "open" | "paid" | "void" | "uncollectible";

export interface InvoiceSummary {
  id: string;
  date: string;
  status: InvoiceStatus;
}

export interface InvoiceDetail extends InvoiceSummary {
  number?: string;
  amount: string;
  paid: string;
  dueDate?: string;
  paidOn?: string;
  breakdown?: { credit: string; serviceFee: string; handlingFee: string; total: string };
  pdf?: boolean;
  merchantPage?: boolean;
}

export type AccountInvoicesLabels = {
  title: string;
  paidTitle: string;
  detailTitle: string;
  status: Record<InvoiceStatus, string>;
  checking: string;
  empty: string;
  refresh: string;
  tryAgain: string;
  close: string;
  number: string;
  statusLabel: string;
  issued: string;
  amount: string;
  amountPaid: string;
  dueDate: string;
  paidOn: string;
  breakdown: string;
  credit: string;
  serviceFee: string;
  handlingFee: string;
  total: string;
  feesNote: string;
  notPaid: string;
  openPdf: string;
  pdfNote: string;
  noPdf: string;
  openMerchant: string;
  merchantNote: string;
  noMerchant: string;
  refreshInvoice: string;
  back: string;
};

export const accountInvoicesLabels: AccountInvoicesLabels = {
  title: "Invoices and receipts",
  paidTitle: "Paid invoice",
  detailTitle: "Invoice details",
  status: { draft: "Not sent yet", open: "Open — not confirmed paid", paid: "Paid", void: "Cancelled — nothing to pay", uncollectible: "Not collected — no payment was taken" },
  checking: "Checking invoice details…",
  empty: "No invoices found.",
  refresh: "Refresh invoices",
  tryAgain: "Try again",
  close: "Close invoices",
  number: "Invoice number",
  statusLabel: "Status",
  issued: "Issued",
  amount: "Invoice amount",
  amountPaid: "Amount paid",
  dueDate: "Due date",
  paidOn: "Paid on",
  breakdown: "Automatic credit purchase: what you paid for",
  credit: "Credit added",
  serviceFee: "Service fee",
  handlingFee: "Handling fee",
  total: "Total charged",
  feesNote: "Fees are part of the charge, not additional credit.",
  notPaid: "This invoice is not confirmed paid. Check the billing company’s current record before any payment.",
  openPdf: "Open invoice PDF",
  pdfNote: "If this stored link has expired, use Manage billing to find the invoice on the secure billing page.",
  noPdf: "A PDF link is not available for this record.",
  openMerchant: "Open the billing company’s invoice",
  merchantNote: "The billing company’s page may offer a PDF or payment options. Review any action there before confirming it.",
  noMerchant: "A link to the billing company’s invoice is not available for this record.",
  refreshInvoice: "Refresh invoice",
  back: "Back to invoices",
};

const tones: Record<InvoiceStatus, { icon: LucideIcon; tone: string }> = {
  paid: { icon: CircleCheck, tone: "text-ok inset-ring-ok/30" },
  open: { icon: Clock, tone: "text-warn inset-ring-warn/30" },
  draft: { icon: FilePen, tone: "text-muted-foreground inset-ring-border" },
  void: { icon: CircleSlash, tone: "text-muted-foreground inset-ring-border" },
  uncollectible: { icon: CircleSlash, tone: "text-muted-foreground inset-ring-border" },
};

/** An invoice's status: an icon and its words on a small tag. */
export function InvoiceStatusTag({ status, label, className }: { status: InvoiceStatus; label: string; className?: string }) {
  const { icon: Icon, tone } = tones[status];
  return (
    <span className={cn("inline-flex min-h-9 items-center gap-2 rounded-tag bg-card px-3 text-label leading-[22px] font-semibold inset-ring-[1.5px]", tone, className)}>
      <Icon aria-hidden size={20} strokeWidth={2.2} className="flex-none" />
      {label}
    </span>
  );
}

export type AccountInvoicesProps = ComponentProps<"section"> & {
  /** `closed` a row that opens the list; `list` the invoices; `detail` one invoice. */
  view: "closed" | "list" | "detail";
  /** The invoices; left out while they load or when they could not. */
  invoices?: readonly InvoiceSummary[];
  /** The invoice open in `detail`; left out while it loads or when it could not. */
  invoice?: InvoiceDetail;
  busy?: boolean;
  /** What could not be done: "These invoice details could not be checked. Try again." */
  problem?: ReactNode;
  onOpenList?: () => void;
  onOpenInvoice?: (id: string) => void;
  /** Checks the list, or the open invoice, again. */
  onRefresh?: () => void;
  onClose?: () => void;
  onBack?: () => void;
  onOpenPdf?: () => void;
  onOpenMerchant?: () => void;
  labels?: Partial<AccountInvoicesLabels>;
};

const actions = "flex flex-wrap gap-3";

/**
 * Settings' read-only invoices: the list by date and status, then one invoice line by line, with its PDF and the
 * billing company's own page. Nothing here pays.
 * @design packages/design-system/design.md#windows
 */
export function AccountInvoices({ view, invoices, invoice, busy = false, problem, onOpenList, onOpenInvoice, onRefresh, onClose, onBack, onOpenPdf, onOpenMerchant, labels, className, ...props }: AccountInvoicesProps) {
  const l = { ...accountInvoicesLabels, ...labels };
  if (view === "closed")
    return (
      <section aria-label={l.title} className={cn("font-sans", className)} {...props}>
        <ListRow className="min-h-[76px]" title={l.title} chevron onClick={onOpenList} />
      </section>
    );
  const title = view === "list" ? l.title : invoice?.status === "paid" ? l.paidTitle : l.detailTitle;
  const status = (
    <>
      {busy ? <PageText role="status" tone="secondary">{l.checking}</PageText> : null}
      {problem == null ? null : <RetryNotice>{problem}</RetryNotice>}
    </>
  );
  return (
    <SettingsAccountPage title={title} busy={busy} className={className} {...props}>
      {status}
      {view === "list" ? (
        <>
          {invoices?.length === 0 ? <EmptyState title={l.empty} className="py-2" /> : null}
          {invoices?.length ? (
            <div className="flex flex-col gap-2.5">
              {invoices.map((item) => (
                <ListRow
                  key={item.id}
                  className="min-h-[76px]"
                  title={item.date}
                  trailing={<InvoiceStatusTag status={item.status} label={l.status[item.status]} />}
                  chevron
                  onClick={busy ? undefined : () => onOpenInvoice?.(item.id)}
                />
              ))}
            </div>
          ) : null}
          <div className={actions}>
            <Button variant="capsule" size="pill" disabled={busy} onClick={onRefresh}>{invoices ? l.refresh : l.tryAgain}</Button>
            <Button variant="capsule" size="pill" onClick={onClose}>{l.close}</Button>
          </div>
        </>
      ) : (
        <>
          {invoice ? (
            <>
              <AccountFacts
                facts={[
                  ...(invoice.number ? [{ label: l.number, value: invoice.number }] : []),
                  { label: l.statusLabel, value: <InvoiceStatusTag status={invoice.status} label={l.status[invoice.status]} /> },
                  { label: l.issued, value: invoice.date },
                  { label: l.amount, value: invoice.amount },
                  { label: l.amountPaid, value: invoice.paid },
                  ...(invoice.dueDate ? [{ label: l.dueDate, value: invoice.dueDate }] : []),
                  ...(invoice.paidOn ? [{ label: l.paidOn, value: invoice.paidOn }] : []),
                ]}
              />
              {invoice.breakdown ? (
                <AccountFacts
                  title={l.breakdown}
                  total
                  note={l.feesNote}
                  facts={[
                    { label: l.credit, value: invoice.breakdown.credit },
                    { label: l.serviceFee, value: invoice.breakdown.serviceFee },
                    { label: l.handlingFee, value: invoice.breakdown.handlingFee },
                    { label: l.total, value: invoice.breakdown.total },
                  ]}
                />
              ) : null}
              {invoice.status === "paid" ? null : <Alert variant="caution">{l.notPaid}</Alert>}
              <div className="flex flex-col items-start gap-2">
                {invoice.pdf ? <Button variant="capsule" size="pill" disabled={busy} onClick={onOpenPdf}>{l.openPdf}</Button> : null}
                <PageText tone="secondary">{invoice.pdf ? l.pdfNote : l.noPdf}</PageText>
              </div>
              <div className="flex flex-col items-start gap-2">
                {invoice.merchantPage ? <Button variant="capsule" size="pill" disabled={busy} onClick={onOpenMerchant}>{l.openMerchant}</Button> : null}
                <PageText tone="secondary">{invoice.merchantPage ? l.merchantNote : l.noMerchant}</PageText>
              </div>
            </>
          ) : null}
          <div className={actions}>
            <Button variant="capsule" size="pill" disabled={busy} onClick={onRefresh}>{invoice ? l.refreshInvoice : l.tryAgain}</Button>
            <Button variant="capsule" size="pill" onClick={onBack}>{l.back}</Button>
          </div>
        </>
      )}
    </SettingsAccountPage>
  );
}

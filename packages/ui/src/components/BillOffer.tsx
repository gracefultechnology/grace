import type { ReactNode } from "react";
import { ExternalLink, ReceiptText } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";
import { Panel, type PanelProps } from "./Panel.tsx";

export type BillDetails = {
  /** Who it is from: "City Water". */
  company: string;
  /** What it asks for, as the app formats it: "$64.20". */
  amount?: string;
  /** When it is due, as the app formats it: "Nov 28". */
  due?: string;
  /** Where its pay link really goes: "citywater.gov". */
  site?: string;
  /** The person said it is theirs: Open bill in place of the question. */
  confirmed?: boolean;
  /** Its one payment record, a `PaymentStatusBadge`, once confirmed. */
  status?: ReactNode;
};

export type BillOfferLabels = {
  heading: (company: string) => string;
  due: (due: string) => string;
  payLink: (site: string) => string;
  question: string;
  yes: string;
  notNow: string;
  open: string;
};

const billLabels: BillOfferLabels = {
  heading: (company) => `This looks like a bill from ${company}`,
  due: (due) => `Due ${due}`,
  payLink: (site) => `Its pay link goes to ${site}`,
  question: "Is this your bill?",
  yes: "Yes",
  notNow: "Not now",
  open: "Open bill",
};

export type BillOfferProps = Omit<PanelProps, "children"> &
  BillDetails & {
    /** The person says it is their bill; this confirms only that, never a payment. */
    onConfirm?: () => void;
    /** Not now: the offer goes away. */
    onDismiss?: () => void;
    /** Opens the bill on its site. Opening never pays. */
    onOpen?: () => void;
    /** Its words, for another language. */
    labels?: Partial<BillOfferLabels>;
  };

/**
 * A bill Grace found, on the window's tint: who it is from, the amount and due date and where its pay link goes, then
 * "Is this your bill?" or, once confirmed, Open bill as the one next step beside its payment status. Nothing here pays.
 * @model spec/app/email.md
 * @design packages/design-system/design.md#windows
 */
export function BillOffer({ company, amount, due, site, confirmed = false, status, onConfirm, onDismiss, onOpen, labels, className, ...props }: BillOfferProps) {
  const l = { ...billLabels, ...labels };
  return (
    <Panel role="group" aria-label={l.heading(company)} className={cn("max-w-[760px] font-sans", className)} {...props}>
      <div className="flex items-center gap-3.5 text-lead leading-[30px] font-bold text-chrome">
        <ReceiptText size={26} strokeWidth={2.2} aria-hidden className="flex-none text-primary" />
        {l.heading(company)}
      </div>
      {(amount || due) && (
        <div className="mt-3 flex items-baseline gap-4">
          {amount && <span className="text-title-lg leading-[38px] font-bold text-chrome">{amount}</span>}
          {due && <span className="text-body leading-[26px] font-bold text-alert">{l.due(due)}</span>}
        </div>
      )}
      {site && <p className="m-0 mt-1.5 text-body leading-[26px] font-medium text-muted-foreground">{l.payLink(site)}</p>}
      {confirmed ? (
        <div className="mt-5 flex items-center gap-4">
          <Button variant="prominent" size="pill" onClick={onOpen}>
            <ExternalLink size={22} strokeWidth={2.2} aria-hidden />
            {l.open}
          </Button>
          {status}
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="mr-2 text-body-lg leading-[30px] font-bold text-chrome">{l.question}</span>
          <Button variant="prominent" size="pill" onClick={onConfirm}>
            {l.yes}
          </Button>
          <Button variant="capsule" size="pill" onClick={onDismiss}>
            {l.notNow}
          </Button>
        </div>
      )}
    </Panel>
  );
}

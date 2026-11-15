import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { AccountInvoicesProps, InvoiceDetail, InvoiceSummary } from "./AccountInvoices.tsx";
import { settingsPage } from "./WifiNetworkList.meta.tsx";

const list: InvoiceSummary[] = [
  { id: "in_3", date: "Nov 1, 2026", status: "paid" },
  { id: "in_2", date: "Oct 1, 2026", status: "paid" },
  { id: "in_1", date: "Sep 12, 2026", status: "open" },
];
const paid: InvoiceDetail = { id: "in_3", date: "Nov 1, 2026", status: "paid", number: "GR-2026-0114", amount: "$25.00", paid: "$25.00", paidOn: "Nov 1, 2026", pdf: true, merchantPage: true };
const openInvoice = fn();

// The original app's words (senior-care AccountInvoices.tsx, account-money.ts).
export const meta: ComponentMeta<AccountInvoicesProps> = {
  args: { view: "list", invoices: list, onOpenList: fn(), onOpenInvoice: openInvoice, onRefresh: fn(), onClose: fn(), onBack: fn(), onOpenPdf: fn(), onOpenMerchant: fn() },
  decorator: settingsPage,
  examples: {
    Closed: { view: "closed" },
    Loading: { invoices: undefined, busy: true },
    "Could not load": { invoices: undefined, problem: "These invoice details could not be checked. Try again." },
    "No invoices": { invoices: [] },
    Paid: { view: "detail", invoice: paid },
    "Credit purchase": {
      view: "detail",
      invoice: { ...paid, number: "GR-2026-0121", amount: "$21.50", paid: "$21.50", breakdown: { credit: "$20.00", serviceFee: "$1.00", handlingFee: "$0.50", total: "$21.50" } },
    },
    "Not confirmed paid": { view: "detail", invoice: { id: "in_1", date: "Sep 12, 2026", status: "open", amount: "$25.00", paid: "$0.00", dueDate: "Sep 26, 2026", merchantPage: true } },
    "Detail failed": { view: "detail", invoice: undefined, problem: "The invoice PDF could not open. Try again." },
  },
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Oct 1, 2026" }));
      await expect(openInvoice).toHaveBeenCalledWith("in_2");
    },
  },
};

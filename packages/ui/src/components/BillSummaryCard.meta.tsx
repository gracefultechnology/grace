import type { ReactNode } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { BillFact, BillSummaryCardProps } from "./BillSummaryCard.tsx";

const chase: BillFact[] = [
  { label: "Statement balance", value: "$84.20" },
  { label: "Minimum payment due", value: "$35.00" },
  { label: "Payment due date", value: "Nov 12, 2026" },
  { label: "Current balance", value: "$112.55" },
];

const open = fn();
const recheck = fn();

export const inGrace = (story: () => ReactNode) => (
  <div className="group/grace w-[720px] bg-background p-6">
    {story()}
  </div>
);

export const meta: ComponentMeta<BillSummaryCardProps> = {
  args: { company: "Chase", account: "••7731", rows: chase, onOpen: open, onRecheck: undefined },
  examples: {
    "Fee unknown": { rows: [...chase, { label: "Fee" }] },
    "No payment due": {
      rows: [{ label: "Statement balance", value: "$0.00" }, { label: "Current balance", value: "$0.00" }],
      onOpen: undefined,
    },
    "Payment scheduled": { existing: { status: "scheduled", date: "Nov 12", reference: "4F7K-22Q" }, onOpen: undefined },
    Conflicting: {
      conflict: "Conflicting bill details: the website shows two different amounts.",
      rows: [{ label: "Statement balance", value: "$84.20" }, { label: "Statement balance on the bill email", value: "$48.20" }],
      onOpen: undefined,
      onRecheck: recheck,
    },
  },
  decorator: inGrace,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Open bill" }));
      await expect(open).toHaveBeenCalled();
    },
    "Fee unknown": ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      return expect([canvas.getByText("Not shown on the website").previousElementSibling?.textContent, canvas.queryByText(/\$0/)]).toEqual(["Fee", null]);
    },
    "Payment scheduled": ({ canvasElement }: { canvasElement: HTMLElement }) =>
      expect(within(canvasElement).getByRole("status").getAttribute("aria-label")).toBe("Payment: Scheduled for Nov 12, Confirmation 4F7K-22Q"),
    Conflicting: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await expect(canvas.getByRole("alert").textContent).toContain("Conflicting bill details");
      await userEvent.click(canvas.getByRole("button", { name: "Check website again" }));
      await expect(recheck).toHaveBeenCalled();
    },
  },
};

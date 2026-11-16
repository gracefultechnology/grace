import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { BillOfferProps } from "./BillOffer.tsx";
import { unfocus } from "./MailApp.meta.tsx";
import { PaymentStatusBadge } from "./PaymentStatusBadge.tsx";

const confirm = fn();
const open = fn();

export const waterBill = { company: "City Water", amount: "$64.20", due: "Nov 28", site: "citywater.gov" };

export const meta: ComponentMeta<BillOfferProps> = {
  args: { ...waterBill, onConfirm: confirm, onDismiss: fn(), onOpen: open },
  examples: {
    Confirmed: { confirmed: true, status: <PaymentStatusBadge status="unknown" /> },
  },
  decorator: (story) => <div className="w-[860px] bg-background p-6">{story()}</div>,
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Yes" }));
      await expect(confirm).toHaveBeenCalled();
      unfocus();
    },
    Confirmed: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole("button", { name: "Open bill" }));
      await expect(open).toHaveBeenCalled();
      await expect(canvas.queryByRole("button", { name: /pay/i })).toBeNull();
      unfocus();
    },
  },
};

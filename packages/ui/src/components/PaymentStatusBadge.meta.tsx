import { expect, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { bookingStatusLabels, type PaymentStatusBadgeProps } from "./PaymentStatusBadge.tsx";

export const meta: ComponentMeta<PaymentStatusBadgeProps> = {
  args: { status: "scheduled", date: "Nov 12", company: "Chase", reference: "4F7K-22Q" },
  examples: {
    Unknown: { status: "unknown", reference: undefined },
    Booking: { status: "pending", company: "Main St Clinic", reference: undefined, labels: bookingStatusLabels },
    "Booking request received": { status: "accepted", company: "Main St Clinic", reference: "MS-2210", labels: bookingStatusLabels },
    "Visit kept": { status: "completed", date: "Dec 7", reference: undefined, labels: bookingStatusLabels },
  },
  decorator: (story) => <div className="group/grace bg-background p-6">{story()}</div>,
  play: {
    Default: ({ canvasElement }: { canvasElement: HTMLElement }) =>
      expect(within(canvasElement).getByRole("status").getAttribute("aria-label")).toBe("Payment: Scheduled for Nov 12, Confirmation 4F7K-22Q"),
    Unknown: ({ canvasElement }: { canvasElement: HTMLElement }) => expect(within(canvasElement).getByRole("status").getAttribute("aria-label")).toBe("Payment: Not checked yet"),
    "Visit kept": ({ canvasElement }: { canvasElement: HTMLElement }) => expect(within(canvasElement).getByRole("status").getAttribute("aria-label")).toBe("Booking: Visit kept Dec 7"),
  },
};

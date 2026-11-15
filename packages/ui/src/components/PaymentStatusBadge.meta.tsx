import { expect, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { PaymentStatusBadgeProps } from "./PaymentStatusBadge.tsx";

// The prototype's Chase card: the payment scheduled on chase.com/pay/done ("Confirmation 4F7K-22Q").
export const meta: ComponentMeta<PaymentStatusBadgeProps> = {
  args: { status: "scheduled", date: "Nov 12", company: "Chase", reference: "4F7K-22Q" },
  examples: {
    // An attempt whose result was never seen says so; it never says "unpaid".
    Unknown: { status: "unknown", reference: undefined },
  },
  decorator: (story) => <div className="group/grace bg-background p-6" data-surface="white">{story()}</div>,
  play: {
    // The tag's colour carries nothing a screen reader misses.
    Default: ({ canvasElement }: { canvasElement: HTMLElement }) =>
      expect(within(canvasElement).getByRole("status").getAttribute("aria-label")).toBe("Payment: Scheduled for Nov 12, Confirmation 4F7K-22Q"),
    Unknown: ({ canvasElement }: { canvasElement: HTMLElement }) => expect(within(canvasElement).getByRole("status").getAttribute("aria-label")).toBe("Payment: Not checked yet"),
  },
};

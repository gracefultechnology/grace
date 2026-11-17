import { expect, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { PaymentStatusBadgeProps } from "./PaymentStatusBadge.tsx";

export const meta: ComponentMeta<PaymentStatusBadgeProps> = {
  args: { status: "scheduled", date: "Nov 12", company: "Chase", reference: "4F7K-22Q" },
  examples: {
    Unknown: { status: "unknown", reference: undefined },
  },
  decorator: (story) => <div className="group/grace bg-background p-6">{story()}</div>,
  play: {
    Default: ({ canvasElement }: { canvasElement: HTMLElement }) =>
      expect(within(canvasElement).getByRole("status").getAttribute("aria-label")).toBe("Payment: Scheduled for Nov 12, Confirmation 4F7K-22Q"),
    Unknown: ({ canvasElement }: { canvasElement: HTMLElement }) => expect(within(canvasElement).getByRole("status").getAttribute("aria-label")).toBe("Payment: Not checked yet"),
  },
};

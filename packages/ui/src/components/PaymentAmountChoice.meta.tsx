import { fn } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { PaymentAmountChoiceProps } from "./PaymentAmountChoice.tsx";

export const meta: ComponentMeta<PaymentAmountChoiceProps> = {
  args: { value: "", labels: { question: "How much do you want to pay City Water?" }, onValueChange: fn(), onUse: fn(), onKeep: fn() },
  decorator: (story) => <div className="w-[760px] bg-background p-6">{story()}</div>,
  examples: {
    "Read back": { value: "30", readBack: "You’ll pay $30.00 of the $84.20 bill." },
    "Too much": { value: "120", problem: "That’s more than the bill, $84.20." },
    Busy: { value: "30", readBack: "You’ll pay $30.00 of the $84.20 bill.", busy: true },
    Failed: { value: "30", readBack: "You’ll pay $30.00 of the $84.20 bill.", failed: true },
  },
};

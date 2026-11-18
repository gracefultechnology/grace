import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { PaymentAmountChoiceProps } from "./PaymentAmountChoice.tsx";

const type = fn();
const use = fn();
const keep = fn();
const question = "How much do you want to pay City Water?";

const choice = (canvasElement: HTMLElement) => {
  for (const spy of [type, use, keep]) spy.mockClear();
  const canvas = within(canvasElement);
  return { canvas, field: canvas.getByRole("textbox", { name: question }), use: canvas.getByRole<HTMLButtonElement>("button", { name: "Use this amount" }) };
};

export const meta: ComponentMeta<PaymentAmountChoiceProps> = {
  args: { value: "", labels: { question }, onValueChange: type, onUse: use, onKeep: keep },
  decorator: (story) => <div className="w-[760px] bg-background p-6">{story()}</div>,
  examples: {
    "Read back": { value: "30", readBack: "You’ll pay $30.00 of the $84.20 bill." },
    "Too much": { value: "120", problem: "That’s more than the bill, $84.20." },
    Busy: { value: "30", readBack: "You’ll pay $30.00 of the $84.20 bill.", busy: true },
    Failed: { value: "30", readBack: "You’ll pay $30.00 of the $84.20 bill.", failed: true },
  },
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const { canvas, field, use } = choice(canvasElement);
      await expect(use.disabled).toBe(true);
      await userEvent.type(field, "3");
      await expect(type).toHaveBeenCalledWith("3");
      await userEvent.click(canvas.getByRole("button", { name: "Keep the bill amount" }));
      await expect(keep).toHaveBeenCalledTimes(1);
    },
    "Read back": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const { use: button } = choice(canvasElement);
      await userEvent.click(button);
      await expect(use).toHaveBeenCalledTimes(1);
    },
    "Too much": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const { canvas, field, use } = choice(canvasElement);
      await expect([field.getAttribute("aria-invalid"), use.disabled, canvas.queryByRole("alert") !== null]).toEqual(["true", true, true]);
    },
    Busy: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const { use: button } = choice(canvasElement);
      await expect([button.disabled, button.getAttribute("aria-busy")]).toEqual([true, "true"]);
      await userEvent.click(button, { pointerEventsCheck: 0 });
      await expect(use).not.toHaveBeenCalled();
    },
  },
};

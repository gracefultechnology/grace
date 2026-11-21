import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { AddressBarProps } from "./AddressBar.tsx";

const edit = fn();
const submit = fn();
const draft = fn();

export const meta: ComponentMeta<AddressBarProps> = {
  args: { value: "" },
  examples: {
    Address: { value: "https://chase.com/pay", secureAddress: "https://chase.com/pay" },
    Guided: { value: "chase.com", guided: true },
    Editable: { value: "", onValueChange: edit, onSubmit: submit },
    "Empty Go": { value: "", notice: "Type a website or what you’re looking for.", onValueChange: draft },
  },
  decorator: (story) => (
    <div className="flex w-[640px] bg-gradient-frame p-6 pb-24">
      {story()}
    </div>
  ),
  play: {
    "Empty Go": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const field = within(canvasElement).getByRole("textbox", { name: "Address" });
      await expect(field).toHaveAccessibleDescription("Type a website or what you’re looking for.");
      await userEvent.type(field, "c");
      await expect(draft).toHaveBeenCalledWith("c");
    },
    Editable: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.type(within(canvasElement).getByRole("textbox", { name: "Address" }), "a{Enter}");
      await expect([edit.mock.calls[0], submit.mock.calls.length]).toEqual([["a"], 1]);
    },
  },
};

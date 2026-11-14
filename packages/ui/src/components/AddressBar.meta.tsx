import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { AddressBarProps } from "./AddressBar.tsx";

const edit = fn();
const submit = fn();

export const meta: ComponentMeta<AddressBarProps> = {
  // Prototype `.addr`: empty on a new tab.
  args: { value: "" },
  examples: {
    Address: { value: "chase.com/pay" },
    // Prototype `.addr.typing`: Grace types the address.
    Guided: { value: "chase.com", guided: true },
    Editable: { value: "", onValueChange: edit, onSubmit: submit },
  },
  decorator: (story) => (
    <div className="flex w-[640px] bg-gradient-frame p-6">
      {story()}
    </div>
  ),
  play: {
    Editable: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await userEvent.type(within(canvasElement).getByRole("textbox", { name: "Address" }), "a{Enter}");
      await expect([edit.mock.calls[0], submit.mock.calls.length]).toEqual([["a"], 1]);
    },
  },
};

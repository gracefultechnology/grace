import { fn } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { SignInCodeFieldProps } from "./SignInCodeField.tsx";

export const meta: ComponentMeta<SignInCodeFieldProps> = {
  args: { label: "Sign-in code", value: "", onValueChange: fn() },
  decorator: (story) => <div className="w-[560px] bg-background p-6">{story()}</div>,
  examples: {
    Typed: { value: "482913" },
    Partly: { value: "48" },
    Refused: { value: "482913", invalid: true },
    Disabled: { value: "482913", disabled: true },
  },
};

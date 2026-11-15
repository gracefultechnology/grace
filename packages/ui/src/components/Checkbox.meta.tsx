import type { ComponentMeta } from "vibestack/stories";
import type { CheckboxProps } from "./Checkbox.tsx";

export const meta: ComponentMeta<CheckboxProps> = {
  // prototype Settings › Wi-Fi, the library's sign-in page: the one checkbox on the tablet, ticked.
  args: { "aria-label": "I agree to the library’s internet use policy", defaultChecked: true },
};

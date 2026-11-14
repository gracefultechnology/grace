import type { ComponentMeta } from "vibestack/stories";
import type { SpinnerProps } from "./Spinner.tsx";

export const meta: ComponentMeta<SpinnerProps> = {
  args: { label: "Grace is working on it" },
  decorator: (story) => <div className="p-6">{story()}</div>,
};

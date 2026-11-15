import type { ComponentMeta } from "vibestack/stories";
import type { WifiSignalProps } from "./WifiSignal.tsx";

export const meta: ComponentMeta<WifiSignalProps> = {
  args: { strength: 3, label: "Strong signal" },
  bounds: { strength: [0, 3] },
  examples: {
    Good: { strength: 2, label: "Good signal" },
    Weak: { strength: 1, label: "Weak signal" },
  },
};

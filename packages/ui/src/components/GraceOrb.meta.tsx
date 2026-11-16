import type { ComponentMeta } from "vibestack/stories";
import type { GraceOrbProps } from "./GraceOrb.tsx";

export const meta: ComponentMeta<GraceOrbProps> = {
  bounds: { size: [48, 160] },
  examples: {
    Welcome: { glow: "welcome" },
    Open: { glow: "off" },
  },
  decorator: (story) => <div className="inline-flex bg-gradient-frame-soft p-8">{story()}</div>,
};

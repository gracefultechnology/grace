import type { ComponentMeta } from "vibestack/stories";
import type { GraceOrbProps } from "./GraceOrb.tsx";

export const meta: ComponentMeta<GraceOrbProps> = {
  bounds: { size: [48, 160] },
  examples: {
    // Prototype `.orb-w.halo`: the start-up pulse and its spreading ring.
    Welcome: { glow: "welcome" },
    // Grace is open: no glow; her washes still drift.
    Open: { glow: "off" },
  },
  decorator: (story) => <div className="inline-flex bg-gradient-frame-soft p-8">{story()}</div>,
};

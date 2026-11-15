import type { ComponentMeta } from "vibestack/stories";
import { TabletScreen } from "./TabletScreen.tsx";
import type { GuideRingProps } from "./GuideRing.tsx";

// The prototype's Chase account page: Grace rings Pay card (`renderOverlay`, target `paycard`).
const target = { x: 185, y: 480, width: 126, height: 48 };

export const meta: ComponentMeta<GuideRingProps> = {
  args: { rect: target, motion: "tap" },
  examples: {
    // `.gring.tight.ok`: a done fact between close neighbours.
    "Tight done": { tone: "ok", tight: true, motion: "still" },
  },
  decorator: (story) => (
    <TabletScreen>
      <div className="absolute rounded-md bg-card shadow-panel" style={{ left: 185, top: 243, width: 560, height: 215 }} />
      <div className="absolute flex items-center justify-center rounded-md bg-primary text-lg font-bold text-primary-foreground" style={{ left: target.x, top: target.y, width: target.width, height: target.height }}>Pay card</div>
      {story()}
    </TabletScreen>
  ),
};

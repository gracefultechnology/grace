import type { ComponentMeta } from "vibestack/stories";
import { TabletScreen } from "./TabletScreen.tsx";
import type { GraceCursorProps } from "./GraceCursor.tsx";

// The prototype's Chase payment form: Grace's G on Continue (`curTo`, `curTag`).
const button = { x: 208, y: 596, width: 128, height: 48 };

export const meta: ComponentMeta<GraceCursorProps> = {
  args: { x: button.x + button.width / 2, y: button.y + button.height / 2, tag: "Tapping Continue" },
  examples: {
    Pressed: { pressed: true },
    Paused: { tag: "Paused", paused: true },
  },
  decorator: (story) => (
    <TabletScreen>
      <div className="absolute rounded-md bg-card shadow-panel" style={{ left: 185, top: 235, width: 518, height: 430 }} />
      <div className="absolute flex items-center justify-center rounded-md bg-primary text-lg font-bold text-primary-foreground" style={{ left: button.x, top: button.y, width: button.width, height: button.height }}>Continue</div>
      {story()}
    </TabletScreen>
  ),
};

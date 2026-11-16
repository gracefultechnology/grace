import type { ComponentMeta } from "vibestack/stories";
import { onChase, payPage } from "./GuideRing.meta.tsx";
import type { GraceCursorProps } from "./GraceCursor.tsx";
import { compactGrace } from "./Toast.meta.tsx";

const onPay = onChase({ title: "Pay your card · Chase", address: "chase.com/pay", page: payPage });

export const meta: ComponentMeta<GraceCursorProps> = {
  args: { x: 273, y: 620, className: "z-2" },
  examples: {
    Pressed: { pressed: true },
    Paused: { tag: "Paused", paused: true },
    "Paused flipped": { tag: "Paused", paused: true, flip: true, x: 1180 },
    Dragging: { dragging: true, x: 792, y: 590 },
    "Above Grace": { top: true, x: 700, y: 640, className: "above-grace" },
  },
  decorator: (story) =>
    onPay(
      () => null,
      () => (
        <div className="group/tablet contents">
          {story()}
          {compactGrace.standIn}
        </div>
      ),
    ),
};

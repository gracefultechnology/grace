import type { ComponentMeta } from "vibestack/stories";
import { onChase, payPage } from "./GuideRing.meta.tsx";
import type { GraceCursorProps } from "./GraceCursor.tsx";

// curTo() on the Chase payment form: Grace's G at the middle of Continue, 208,596 on the tablet and 130×48.
const onPay = onChase({ title: "Pay your card · Chase", address: "chase.com/pay", page: payPage });

export const meta: ComponentMeta<GraceCursorProps> = {
  // `.scur`: on the tablet, over the browser and under Grace's window.
  args: { x: 273, y: 620, className: "z-2" },
  examples: {
    // curTap(): the G pressed and a ring rippling out.
    Pressed: { pressed: true },
    // pauseAct(): `.gcur.paused` and curTag("Paused").
    Paused: { tag: "Paused", paused: true },
  },
  decorator: (story) => onPay(() => null, story),
};

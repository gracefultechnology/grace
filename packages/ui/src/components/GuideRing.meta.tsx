import type { ReactNode } from "react";
import type { ComponentMeta } from "vibestack/stories";
import { BrowserWindow } from "./BrowserWindow.tsx";
import { chase } from "./BrowserWindow.meta.tsx";
import { Rail } from "./Rail.tsx";
import { homeRail } from "./Rail.meta.tsx";
import { ScreenSlot, TabletScreen } from "./TabletScreen.tsx";
import type { GuideRingProps } from "./GuideRing.tsx";

export const onChase = (page: Parameters<typeof chase>[0], short = false) =>
  function OnChase(overlay: () => ReactNode, screen?: () => ReactNode) {
    const { tabStrip, toolbar, children } = chase(page);
    return (
      <TabletScreen>
        <Rail {...homeRail(null)} />
        <ScreenSlot className={short ? "bottom-[272px]" : undefined}>
          <BrowserWindow aria-label="Browser" tabStrip={tabStrip} toolbar={toolbar}>
            {children}
            {overlay()}
          </BrowserWindow>
        </ScreenSlot>
        {screen?.()}
      </TabletScreen>
    );
  };

export const onAccount = onChase("account");

export const meta: ComponentMeta<GuideRingProps> = {
  args: { rect: { x: 40, y: 330, width: 127, height: 48 }, gap: { top: 7, right: 8, bottom: 8, left: 8 }, tight: true, motion: "tap" },
  examples: {
    Glow: { tight: false },
    Done: { rect: { x: 64, y: 112, width: 512, height: 37 }, gap: { top: 8, right: 8, bottom: -4, left: 8 }, tone: "ok", motion: "pulse" },
  },
  decorator: (story) => onAccount(story),
};

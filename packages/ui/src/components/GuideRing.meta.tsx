import type { ReactNode } from "react";
import type { ComponentMeta } from "vibestack/stories";
import { AddressBar } from "./AddressBar.tsx";
import { BrowserTabStrip } from "./BrowserTabStrip.tsx";
import { BrowserToolbar } from "./BrowserToolbar.tsx";
import { BrowserWindow } from "./BrowserWindow.tsx";
import { Rail } from "./Rail.tsx";
import { homeRail } from "./Rail.meta.tsx";
import { TabletScreen } from "./TabletScreen.tsx";
import type { GuideRingProps } from "./GuideRing.tsx";

const card = "absolute rounded-sm bg-card px-6 py-5 text-grace-ink shadow-sm";
const button = "absolute flex h-12 items-center rounded-tag bg-site-brand px-7 text-[17px] font-bold text-primary-foreground";
const row = "flex justify-between border-b border-border py-2 text-[17px] [&>span]:text-chrome-muted";
const label = "mt-3.5 mb-1.5 block text-[16px] text-chrome-muted";
const field = "flex h-[46px] items-center rounded-tag border border-input bg-card px-3 text-[18px]";

export const accountPage = (
  <>
    <div className={card} style={{ left: 40, top: 92, width: 560 }}>
      {[["Statement balance", "$84.20"], ["Minimum payment due", "$35.00"], ["Payment due date", "Nov 12, 2026"], ["Current balance", "$112.55"]].map(([name, value]) => (
        <div key={name} className={row}><span>{name}</span><b>{value}</b></div>
      ))}
      <div className="pt-2.5 text-[16px] text-chrome-muted">No payment scheduled</div>
    </div>
    <div className={button} style={{ left: 40, top: 330 }}>Pay card</div>
  </>
);

export const payPage = (
  <div className={card} style={{ left: 40, top: 84, width: 520 }}>
    <div className="text-[22px] font-bold">Pay your card</div>
    <span className={label}>Pay from</span>
    <div className={field}>Checking ••4821</div>
    <span className={label}>Amount</span>
    {["Statement balance $84.20", "Minimum payment $35.00"].map((amount) => (
      <div key={amount} className="mt-1.5 flex items-center gap-2.5 rounded-tag border border-input bg-card px-3 py-2.5 text-[17px]">
        <i className="size-[18px] flex-none rounded-full border-2 border-chrome-muted" />
        {amount}
      </div>
    ))}
    <span className={label}>Payment date</span>
    <div className={field}>MM/DD/YYYY</div>
    <div className="relative mt-5 h-12"><div className={button}>Continue</div></div>
  </div>
);

export const onChase = ({ title, address, page, short = false }: { title: string; address: string; page: ReactNode; short?: boolean }) =>
  function OnChase(overlay: () => ReactNode, screen?: () => ReactNode) {
    return (
      <TabletScreen>
        <Rail {...homeRail(null)} />
        <BrowserWindow
          aria-label="Browser"
          className={short ? "bottom-[272px]" : undefined}
          tabStrip={<BrowserTabStrip tabs={[{ id: 1, title, initial: "C" }]} selectedId={1} />}
          toolbar={(
            <BrowserToolbar canGoBack canGo>
              <AddressBar value={address} />
            </BrowserToolbar>
          )}
        >
          <div className="absolute inset-0 font-[Arial,sans-serif] leading-[normal] text-grace-ink">
            <div className="flex h-16 items-center justify-between bg-site-brand px-10 text-[22px] font-bold text-primary-foreground">
              Credit card ••7731<span className="text-[15px] font-normal opacity-85">Website mock · not a real page</span>
            </div>
            {page}
          </div>
          {overlay()}
        </BrowserWindow>
        {screen?.()}
      </TabletScreen>
    );
  };

export const onAccount = onChase({ title: "Credit card · Chase", address: "chase.com/card", page: accountPage });

export const meta: ComponentMeta<GuideRingProps> = {
  args: { rect: { x: 40, y: 330, width: 127, height: 48 }, gap: { top: 7, right: 8, bottom: 8, left: 8 }, tight: true, motion: "tap" },
  examples: {
    Glow: { tight: false },
    Done: { rect: { x: 64, y: 112, width: 512, height: 37 }, gap: { top: 8, right: 8, bottom: -4, left: 8 }, tone: "ok", motion: "pulse" },
  },
  decorator: (story) => onAccount(story),
};

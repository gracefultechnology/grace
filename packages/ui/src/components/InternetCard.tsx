import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";
import { LauncherCard, type LauncherCardProps } from "./LauncherCard.tsx";

export type InternetCardProps = Omit<LauncherCardProps, "title" | "children" | "art"> & {
  /** The app's name. */
  title?: string;
  /** A picture of the page the browser last showed, drawn by the app; the frame stays empty without one. */
  preview?: string;
  /** The word on the card's indigo button. */
  openLabel?: string;
  /** The tablet is offline: the button greys out. */
  offline?: boolean;
  /**
   * A narrow column above Grace's compact window: the preview stands upright under the status at full size, and is
   * left out when the card is too short to keep it clear of the button.
   */
  compact?: boolean;
};

const frame = "block h-[206px] w-[240px] rounded-tile bg-site shadow-preview ring-1 ring-thumb-ring/8";

/**
 * Home's Internet card: a status line, a tilted preview of the browser's page and an Open button. The whole card opens
 * the browser.
 * @model spec/app/browser.md
 * @design packages/design-system/design.md#glass
 */
export function InternetCard({ title = "Internet", preview, openLabel = "Open", offline = false, compact = false, size = "medium", ...props }: InternetCardProps) {
  // Prototype markup line ~818: the title keeps to 200px, clear of the preview.
  return (
    <LauncherCard title={title} size={size} compact={compact} headClassName="w-[200px]" {...props}>
      {/*
        Prototype `#netThumb`, `#thLive`: 240×206, tilted 2° and drawn at 88% from its top-right corner. Compact
        (`.home.cmp #netThumb`, `fitTops()`, `fitCards()`): full size, 22px from the right and 96px down, hidden when it
        would come within 12px of the button, that is when the card is under 398px tall.
      */}
      <span className={cn("absolute inset-0", compact && "[container-type:size]")}>
        <span className={cn("absolute right-0 w-[240px] rotate-2", compact ? "-top-1 [@container(max-height:276px)]:invisible" : "bottom-0 origin-top-right scale-[.88]")}>
          {preview ? <img src={preview} alt="" className={cn(frame, "object-cover object-left-top")} /> : <span className={frame} />}
        </span>
      </span>
      {/* Prototype `.lbtn`, greyed while offline (`homeCards`, netBtn). The card is the button, so this is its look only. */}
      <Button asChild variant="prominent" size="compact" className={cn("mt-auto mb-0.5 ml-1 self-start px-[26px] leading-none shadow-none", offline && "bg-primary/10 text-grace-ink/38")}>
        <span>{openLabel}</span>
      </Button>
    </LauncherCard>
  );
}

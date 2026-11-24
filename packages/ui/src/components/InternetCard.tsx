import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";
import { LauncherCard, type LauncherCardProps } from "./LauncherCard.tsx";

export type InternetCardProps = Omit<LauncherCardProps, "title" | "children" | "art"> & {
  /** The app's name. */
  title?: string;
  /** A picture of the page the browser last showed, drawn by the app; a miniature new-tab frame shows without one. */
  preview?: string;
  /** The word on the card's indigo button. */
  openLabel?: string;
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
export function InternetCard({ title = "Internet", preview, openLabel = "Open", compact = false, size = "medium", ...props }: InternetCardProps) {
  return (
    <LauncherCard title={title} size={size} compact={compact} headClassName="w-[200px]" {...props}>
      <span className={cn("absolute inset-0", compact && "[container-type:size]")}>
        <span className={cn("absolute right-0 w-[240px] rotate-2", compact ? "-top-1 [@container(max-height:276px)]:invisible" : "bottom-0 origin-top-right scale-[.88]")}>
          {preview ? (
            <img src={preview} alt="" decoding="async" className={cn(frame, "object-cover object-left-top")} />
          ) : (
            <span className={cn(frame, "overflow-hidden")}>
              <span className="block h-[22%] bg-accent" />
              <span className="mx-auto mt-[14%] block h-6 w-[76%] rounded-full bg-card ring-1 ring-thumb-ring/8" />
              <span className="mx-auto mt-[12%] block h-2.5 w-[52%] rounded-full bg-border" />
              <span className="mx-auto mt-1.5 block h-2.5 w-[38%] rounded-full bg-site-line" />
            </span>
          )}
        </span>
      </span>
      <Button asChild variant="prominent" size="compact" className={cn("mt-auto mb-0.5 ml-1 self-start px-[26px] leading-none shadow-none active:scale-100")}>
        <span>{openLabel}</span>
      </Button>
    </LauncherCard>
  );
}

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
};

/**
 * Home's Internet card: a status line, a tilted preview of the browser's page and an Open button. The whole card opens
 * the browser.
 * @model spec/app/browser.md
 * @design packages/design-system/design.md#glass
 */
export function InternetCard({ title = "Internet", preview, openLabel = "Open", offline = false, size = "medium", ...props }: InternetCardProps) {
  return (
    <LauncherCard title={title} size={size} {...props}>
      {/* Prototype `#netThumb`: 240×206, tilted 2° and drawn at 88% from its top-right corner. */}
      <span className="absolute right-0 bottom-0 h-[206px] w-[240px] origin-top-right scale-[.88] rotate-2 overflow-hidden rounded-tile bg-card shadow-preview ring-1 ring-grace-ink/8">
        {preview && <img src={preview} alt="" className="block size-full object-cover object-left-top" />}
      </span>
      {/* Prototype `.lbtn`, greyed while offline (`homeCards`, netBtn). The card is the button, so this is its look only. */}
      <Button asChild variant="prominent" size="compact" className={cn("mt-auto mb-0.5 ml-1 self-start px-[26px] shadow-none", offline && "bg-primary/10 text-grace-ink/38")}>
        <span>{openLabel}</span>
      </Button>
    </LauncherCard>
  );
}

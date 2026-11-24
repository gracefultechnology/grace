import { Check, Plus, Sparkle } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";
import { GraceOffer, type GraceOfferProps } from "./GraceOffer.tsx";
import { LauncherCard, type LauncherCardProps } from "./LauncherCard.tsx";

export type PasswordsCardProps = Omit<LauncherCardProps, "title" | "children" | "art"> & {
  /** The app's name. */
  title?: string;
  /** While none are saved: Grace's offer to save them as the person signs in, in place of Open. */
  offer?: Pick<GraceOfferProps, "message" | "action" | "onAction">;
  /** The word on the card's indigo button. */
  openLabel?: string;
  /** Adds a password by hand: a round + beside Open. */
  onAdd?: () => void;
  /** The + button's accessible name. */
  addLabel?: string;
  /** The line in the picture of a sign-in that Grace keeps. */
  savedLabel?: string;
  /** A narrow column above Grace's compact window: the picture is left out. */
  compact?: boolean;
};

/**
 * Home's Passwords card, half the height of Files: how many are saved and where, a tilted picture of a sign-in with
 * “Saved by Grace” under it, and Open. While none are saved, Grace's lavender offer takes Open's place. It never
 * names a site or an account. The whole card opens Passwords; Add one and + are buttons beside it, never inside.
 * @model spec/app/shell.md
 * @design packages/design-system/design.md#empty-states
 * @design packages/design-system/design.md#grace-offers
 */
export function PasswordsCard({ title = "Passwords", offer, openLabel = "Open", onAdd, addLabel = "Add a password", savedLabel = "Saved by Grace", compact = false, size = "medium", className, ...props }: PasswordsCardProps) {
  const open = (
    <Button asChild variant="prominent" size="compact" className="shadow-none active:scale-100">
      <span>{openLabel}</span>
    </Button>
  );
  return (
    <div role="group" aria-label={title} className={cn("relative", className)}>
      <LauncherCard title={title} size={size} compact={compact} headClassName="w-[230px]" className="size-full" {...props}>
        {!compact && (
          <span className={cn("absolute right-0 w-[206px] rotate-2 overflow-hidden rounded-tile bg-site p-3.5 shadow-preview ring-1 ring-thumb-ring/8", offer ? "-top-[82px] h-[120px]" : "bottom-0 h-[196px]")}>
            {!offer && <span className="mb-2.5 block h-2.5 w-1/2 rounded-full bg-border" />}
            <span className="block h-[22px] rounded-sm bg-card ring-1 ring-thumb-ring/8" />
            <span className="mt-2 flex h-[22px] items-center rounded-sm bg-card pl-2 text-detail tracking-[3px] text-muted-foreground ring-1 ring-thumb-ring/8">••••••</span>
            <span className="absolute inset-x-0 bottom-0 flex items-center gap-2 rounded-t-tile bg-card px-3 py-2.5 shadow-sm">
              <Sparkle size={16} strokeWidth={2} className="flex-none text-lavender" />
              <span className="flex-1 text-mark font-bold text-muted-foreground">{savedLabel}</span>
              <Check size={16} strokeWidth={2.6} className="flex-none text-ok" />
            </span>
          </span>
        )}
        {!offer && <span className="mt-auto mb-0.5 ml-1 flex">{open}</span>}
      </LauncherCard>
      {(offer || onAdd) && (
        <div className="pointer-events-none absolute inset-x-[22px] bottom-[22px] flex items-center gap-3 pl-1 [&_button]:pointer-events-auto">
          {offer ? (
            <GraceOffer {...offer} className="flex-1 -ml-1" />
          ) : (
            <>
              <span aria-hidden className="invisible">{open}</span>
              <Button variant="glass" size="compact-icon" aria-label={addLabel} onClick={onAdd}>
                <Plus aria-hidden size={24} strokeWidth={2.4} />
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

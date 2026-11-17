import type { ComponentProps, ReactNode } from "react";
import { cva } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Button, type ButtonProps } from "./Button.tsx";

const banner = cva("box-border flex items-center", {
  variants: {
    tone: {
      light: "min-h-[104px] gap-[18px] rounded-card bg-glass/62 px-[22px] py-5 shadow-banner",
      dark: "min-h-[92px] gap-5 rounded-row bg-primary px-[22px] py-4 shadow-raised",
    },
  },
});

const tile = cva("flex flex-none items-center justify-center", {
  variants: {
    tone: {
      light: "size-[60px] rounded-tab bg-card text-chrome shadow-badge",
      dark: "size-[52px] rounded-tile bg-primary-foreground/14 text-primary-foreground",
    },
  },
});

export type BannerTone = "light" | "dark";

export type BannerProps = Omit<ComponentProps<"div">, "title"> & {
  /** The mark in the tile at the start: a bell for a reminder, Wi-Fi off. */
  icon: ReactNode;
  /** What it is about, in bold. */
  title: string;
  /** One line under the title. */
  line?: string;
  /** `light` on Home's glass (prototype `.hban`); `dark` inside an app window, for what needs her: offline, sign in again, connect email (prototype `.acban`). */
  tone?: BannerTone;
  /** The banner's buttons at its end: one prominent, or a `BannerButton` on a dark banner. */
  actions?: ReactNode;
  /** Puts it away for now: a round ✕ after the actions. */
  onDismiss?: () => void;
  /** The ✕'s accessible name. */
  dismissLabel?: string;
};

/**
 * A notice above what it is about: on Home, on the cards' glass (prototype `.hban`, `drawBanner`), or dark in an app window
 * (prototype `acBan()`).
 * @model spec/app/surface.md
 * @design packages/design-system/design.md#glass
 */
export function Banner({ icon, title, line, tone = "light", actions, onDismiss, dismissLabel = "Not now", className, ...props }: BannerProps) {
  const dark = tone === "dark";
  return (
    <div role="status" className={cn(banner({ tone }), className)} {...props}>
      <span aria-hidden className={tile({ tone })}>
        {icon}
      </span>
      <span className="min-w-0">
        <b className={cn("block text-lead leading-[30px] font-bold", dark ? "text-primary-foreground" : "text-foreground")}>{title}</b>
        {line && <span className={cn("mt-0.5 block text-body leading-[26px] font-medium", dark ? "text-primary-foreground/80" : "text-muted-foreground")}>{line}</span>}
      </span>
      {actions || onDismiss ? (
        <span className="ml-auto flex flex-none items-center gap-3">
          {actions}
          {onDismiss && (
            <Button
              variant="plain"
              size="compact-icon"
              aria-label={dismissLabel}
              onClick={onDismiss}
              className={dark ? "size-[52px] bg-primary-foreground/14 text-primary-foreground active:bg-primary-foreground/24" : undefined}
            >
              <X aria-hidden size={dark ? 22 : 24} strokeWidth={dark ? 2 : 1.75} />
            </Button>
          )}
        </span>
      ) : null}
    </div>
  );
}

export type BannerButtonProps = Omit<ButtonProps, "variant" | "size">;

/** A dark banner's button: white, with the banner's ink (prototype `.acban .a-btn`). */
export function BannerButton({ className, ...props }: BannerButtonProps) {
  return <Button variant="plain" size="compact" className={cn("bg-card px-6 text-primary active:bg-card/85", className)} {...props} />;
}

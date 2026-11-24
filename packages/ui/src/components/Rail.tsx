import { type ComponentProps, type ReactNode, useId } from "react";
import { cn, focusRing } from "../lib/cn.ts";

export type RailProps = ComponentProps<"nav"> & {
  /** Battery charge, 0 to 100; no glyph while the charge is unknown. */
  battery?: number;
  /** The battery's accessible name; by default "Battery N percent". */
  batteryLabel?: string;
  /** The clock without its period, as the app formats it: "9:09". */
  time: string;
  /** The clock's period under it: "AM" or "PM". */
  period?: string;
  /** The short date under the clock: "Fri, Nov 13". */
  date: string;
  /** Status buttons under the clock, above the first divider: Wi-Fi. */
  status?: ReactNode;
  /** The footer buttons, at the bottom above the last divider: Settings. */
  footer?: ReactNode;
  /** What closes the rail under the last divider: the Ask Grace button. */
  ask?: ReactNode;
};

/**
 * The left rail: battery, clock and date, then the rail's buttons, with Ask Grace at the bottom. Glass over Home,
 * 6px from the screen's edges. Its children are the main buttons (Home, Volume).
 * @model spec/app/shell.md
 * @design packages/design-system/design.md#glass
 */
export function Rail({ battery, batteryLabel, time, period, date, status, footer, ask, className, children, ...props }: RailProps) {
  return (
    <nav
      className={cn(
        "absolute top-1.5 bottom-1.5 left-1.5 z-[4] flex w-[132px] flex-col items-center rounded-window bg-glass/62 pt-3.5 text-foreground shadow-capsule backdrop-blur-capsule backdrop-saturate-160",
        className,
      )}
      {...props}
    >
      {battery !== undefined && <Battery level={battery} label={batteryLabel} className="mt-3.5" />}
      <div className={cn(battery !== undefined ? "mt-3" : "mt-7", "text-title-lg leading-[34px] font-medium")}>{time}</div>
      {period && <div className="text-label leading-[22px] font-medium">{period}</div>}
      <div className="mt-2 text-center text-control leading-[22px] font-semibold text-muted-foreground">{date}</div>
      {status ? <div className="mt-3 flex flex-col gap-3">{status}</div> : null}
      <RailDivider className="my-4" />
      <div className="flex flex-col gap-3">{children}</div>
      <div className="flex-1" />
      {footer ? <div className="flex flex-col gap-3">{footer}</div> : null}
      <RailDivider className="mt-[18px] mb-[22px]" />
      {ask}
      <div className="h-3.5 shrink-0" />
    </nav>
  );
}

const RailDivider = ({ className }: { className?: string }) => <div className={cn("h-px w-[84px] shrink-0 bg-foreground/10", className)} />;

function Battery({ level, label, className }: { level: number; label?: string; className?: string }) {
  const charge = Math.max(0, Math.min(100, level));
  return (
    <svg role="img" aria-label={label ?? `Battery ${Math.round(charge)} percent`} width="40" height="24" viewBox="0 0 30 18" fill="none" className={cn("shrink-0 text-chrome", className)}>
      <rect x="1" y="1" width="25" height="16" rx="3.5" stroke="currentColor" strokeWidth="1.67" />
      <rect x="3.5" y="3.5" width={(20 * charge) / 100} height="11" rx="1.5" fill="currentColor" />
      <path d="M28 6.5v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export type RailButtonProps = ComponentProps<"button"> & {
  /** A 28px icon, stroke 1.9: `<House size={28} strokeWidth={1.9} />`. */
  icon: ReactNode;
  /** The word under the icon. */
  label: string;
  /** Raised on the white platter with an indigo label: the current view, or the button whose popover is open. */
  selected?: boolean;
};

/** One of the rail's buttons: an icon over its word. */
export function RailButton({ icon, label, selected = false, type = "button", className, ...props }: RailButtonProps) {
  return (
    <button
      type={type}
      aria-current={selected || undefined}
      className={cn(
        focusRing,
        "flex h-[76px] w-[116px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl text-body leading-6 font-bold text-chrome transition-colors duration-press ease-css-default [&_svg]:shrink-0",
        selected ? "bg-card text-primary shadow-raised" : "active:bg-glass/72 active:shadow-tile-pressed",
        className,
      )}
      {...props}
    >
      {icon}
      {label}
    </button>
  );
}

export type WifiSlashProps = ComponentProps<"svg"> & {
  /** Width and height in pixels. */
  size?: number;
};

/** The Wi-Fi glyph struck through in red: not connected. Decorative; name the state on what it sits in. */
export function WifiSlash({ size = 28, ...props }: WifiSlashProps) {
  const mask = `wifi${useId().replace(/[^\w-]/g, "")}`;
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <defs>
        <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <rect width="24" height="24" fill="var(--glass)" />
          <path d="M3 3l18 18" stroke="var(--dim)" strokeWidth="4.2" />
        </mask>
      </defs>
      <g mask={`url(#${mask})`} stroke="currentColor" strokeWidth="1.9">
        <path d="M12 20h.01" />
        <path d="M2 8.82a15 15 0 0 1 20 0" />
        <path d="M5 12.859a10 10 0 0 1 14 0" />
        <path d="M8.5 16.429a5 5 0 0 1 7 0" />
      </g>
      <path d="M3 3l18 18" stroke="var(--offline)" strokeWidth="2.2" />
    </svg>
  );
}

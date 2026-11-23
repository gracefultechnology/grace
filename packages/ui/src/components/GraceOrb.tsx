import { type ComponentProps, useId } from "react";
import { cva } from "class-variance-authority";
import { cn } from "../lib/cn.ts";

const top = "M-10 -10H130V40C100 30 84 62 60 60S20 30 -10 52Z";
const bottom = "M130 130H-10V96C20 86 40 110 66 100S110 70 130 84Z";
const streak = "M14 96C34 70 52 74 62 50S78 18 96 10";
const sheen = "M8 46C30 40 46 58 70 54S104 38 116 50";
const white = "var(--glass)";
const wash = "absolute inset-0 size-full animate-sway overflow-visible motion-reduce:animate-none";
const disc = "4 4 112 112";

export type GraceOrbProps = ComponentProps<"span"> & {
  /** `welcome`: the start-up pulses; `rest`: a steady soft glow while Grace is closed; `off`: no glow, while she is open. */
  glow?: "welcome" | "rest" | "off";
  /** Width and height of the orb's box in pixels; the orb itself fills three quarters of it. */
  size?: number;
};

/**
 * Grace's living orb: violet glass with drifting washes and a light streak, and the glow that invites a tap. Each wash
 * is its own layer that sways whole, so the orb moves without repainting.
 * @model spec/app/shell.md
 * @design packages/design-system/design.md#grace
 */
export function GraceOrb({ glow = "rest", size = 96, className, style, ...props }: GraceOrbProps) {
  const id = `orb${useId().replace(/[^\w-]/g, "")}`;
  const ref = (name: string) => `url(#${id}${name})`;
  return (
    <span aria-hidden className={cn("relative flex shrink-0 items-center justify-center", className)} style={{ width: size, height: size, ...style }} {...props}>
      <i
        className={cn(
          "pointer-events-none absolute inset-0 rounded-full bg-radial from-lavender/85 from-35% via-lavender/45 via-55% to-lavender/0 to-72% opacity-0 transition-opacity duration-glow ease-css-default motion-reduce:animate-none",
          glow === "welcome" && "animate-glow opacity-100",
          glow === "rest" && "scale-[1.28] opacity-70",
        )}
      />
      <i className={cn("pointer-events-none absolute inset-[10.4%] rounded-full opacity-0 ring-3 ring-lavender/55 transition-opacity duration-glow ease-css-default motion-reduce:animate-none", glow === "welcome" && "animate-glow-ring")} />
      <svg className="relative" width={size} height={size} viewBox="-14 -14 148 148">
        <defs>
          <clipPath id={`${id}clip`}><circle cx="60" cy="60" r="56" /></clipPath>
          <radialGradient id={`${id}body`} cx="42%" cy="40%" r="70%"><stop offset="0" stopColor="var(--orb-light)" /><stop offset=".55" stopColor="var(--orb-mid)" /><stop offset="1" stopColor="var(--orb-deep)" /></radialGradient>
          <linearGradient id={`${id}tint`} x1="0" y1="0" x2="1" y2="1"><stop offset=".1" stopColor="var(--orb-blue)" /><stop offset=".42" stopColor="var(--lavender)" stopOpacity="0" /><stop offset=".62" stopColor="var(--lavender)" stopOpacity="0" /><stop offset=".92" stopColor="var(--orb-pink)" /></linearGradient>
          <radialGradient id={`${id}edgeFade`} cx="50%" cy="50%" r="50%"><stop offset=".5" stopColor={white} stopOpacity="0" /><stop offset=".9" stopColor={white} /></radialGradient>
          <mask id={`${id}edge`} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120"><circle cx="60" cy="60" r="56" fill={ref("edgeFade")} /></mask>
          <radialGradient id={`${id}rim`} cx="50%" cy="50%" r="50%"><stop offset=".82" stopColor={white} stopOpacity="0" /><stop offset=".98" stopColor={white} stopOpacity=".75" /><stop offset="1" stopColor={white} stopOpacity=".5" /></radialGradient>
          <linearGradient id={`${id}top`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--orb-haze)" stopOpacity="0" /><stop offset=".7" stopColor="var(--orb-veil)" stopOpacity=".55" /><stop offset="1" stopColor={white} stopOpacity=".85" /></linearGradient>
          <linearGradient id={`${id}bottom`} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="var(--orb-violet)" stopOpacity="0" /><stop offset=".75" stopColor="var(--orb-glow)" stopOpacity=".45" /><stop offset="1" stopColor={white} stopOpacity=".7" /></linearGradient>
          <filter id={`${id}blur`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.2" /></filter>
          <filter id={`${id}soft`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.1" /></filter>
          <radialGradient id={`${id}aura`} cx="50%" cy="50%" r="50%"><stop offset=".7" stopColor={white} stopOpacity=".95" /><stop offset=".82" stopColor="var(--orb-mist)" stopOpacity=".6" /><stop offset="1" stopColor="var(--orb-mist)" stopOpacity="0" /></radialGradient>
          <linearGradient id={`${id}streak`} x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor={white} stopOpacity="0" /><stop offset=".35" stopColor={white} /><stop offset=".7" stopColor={white} stopOpacity=".9" /><stop offset="1" stopColor={white} stopOpacity="0" /></linearGradient>
        </defs>
        <circle cx="60" cy="60" r="74" fill={ref("aura")} />
        <g clipPath={ref("clip")}>
          <rect x="-10" y="-10" width="140" height="140" fill={ref("body")} />
        </g>
      </svg>
      <span className="absolute inset-[12.16%] overflow-hidden rounded-full">
        <svg viewBox={disc} className={wash}>
          <path d={top} fill={ref("top")} filter={ref("soft")} />
        </svg>
        <svg viewBox={disc} className={wash} style={{ animationDuration: "12s", animationDelay: "-5s" }}>
          <path d={bottom} fill={ref("bottom")} filter={ref("soft")} />
        </svg>
        <svg viewBox={disc} className={wash} style={{ animationDuration: "13s", animationDelay: "-2s" }}>
          <g mask={ref("edge")}>
            <circle cx="60" cy="60" r="56" fill={ref("tint")} />
          </g>
        </svg>
        <svg viewBox={disc} className={wash} style={{ animationDuration: "9s", animationDelay: "-7s" }}>
          <path d={streak} fill="none" stroke={ref("streak")} strokeWidth="7" opacity=".55" filter={ref("blur")} />
          <path d={streak} fill="none" stroke={ref("streak")} strokeWidth="1.6" opacity=".95" filter={ref("soft")} />
        </svg>
        <svg viewBox={disc} className={wash} style={{ animationDuration: "11s", animationDelay: "-3s" }}>
          <path d={sheen} fill="none" stroke={white} strokeWidth="6" opacity=".35" filter={ref("blur")} />
          <path d={sheen} fill="none" stroke={white} strokeWidth="1.2" opacity=".6" filter={ref("soft")} />
        </svg>
        <svg viewBox={disc} className="absolute inset-0 size-full">
          <circle cx="60" cy="60" r="56" fill={ref("rim")} />
        </svg>
      </span>
    </span>
  );
}

const markVariants = cva("flex shrink-0 items-center justify-center rounded-full bg-gradient-ring transition-shadow duration-slow ease-css-default", {
  variants: { size: { md: "size-[76px]", sm: "size-14" }, halo: { true: "shadow-elevation-halo" } },
  defaultVariants: { size: "md" },
});
const discVariants = { md: "size-16 text-4xl", sm: "size-[46px] text-lead" } as const;

export type GraceMarkProps = ComponentProps<"span"> & {
  /** `md` is the 76px mark; `sm` the 56px one on Grace's pointer. */
  size?: "md" | "sm";
  /** Rings the mark with Grace's lilac halo. */
  halo?: boolean;
  /** The letter on the disc. */
  initial?: string;
};

/** Grace's simple mark: a white disc with her initial in a gradient ring, as on her pointing hand. */
export function GraceMark({ size = "md", halo = false, initial = "G", className, ...props }: GraceMarkProps) {
  return (
    <span aria-hidden className={cn(markVariants({ size, halo }), className)} {...props}>
      <span className={cn("flex items-center justify-center rounded-full bg-glass font-bold text-primary", discVariants[size])}>{initial}</span>
    </span>
  );
}

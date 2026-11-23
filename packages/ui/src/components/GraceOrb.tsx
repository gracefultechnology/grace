import { type ComponentProps, useId } from "react";
import { cva } from "class-variance-authority";
import { cn } from "../lib/cn.ts";
import { useReducedMotion } from "../lib/motion.ts";

const top = ["M-10 -10H130V40C100 30 84 62 60 60S20 30 -10 52Z", "M-10 -10H130V54C104 40 80 50 58 70S16 44 -10 40Z", "M-10 -10H130V34C96 44 86 70 62 52S24 22 -10 60Z"];
const bottom = ["M130 130H-10V96C20 86 40 110 66 100S110 70 130 84Z", "M130 130H-10V104C24 96 44 96 70 108S106 84 130 76Z", "M130 130H-10V90C18 100 46 118 62 96S112 62 130 92Z"];
const streak = ["M14 96C34 70 52 74 62 50S78 18 96 10", "M10 84C36 74 48 88 66 60S88 26 104 20", "M18 100C30 76 58 66 64 44S74 16 90 6"];
const sheen = ["M8 46C30 40 46 58 70 54S104 38 116 50", "M6 56C28 44 50 46 72 60S100 52 118 40", "M10 40C34 50 44 66 68 48S102 30 116 58"];
const white = "var(--glass)";

function Morph({ shapes, dur, still, ...props }: ComponentProps<"path"> & { shapes: string[]; dur: string; still: boolean }) {
  return (
    <path d={shapes[0]} {...props}>
      {!still && <animate attributeName="d" values={[...shapes, shapes[0]].join(";")} dur={dur} repeatCount="indefinite" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1;.45 0 .55 1" />}
    </path>
  );
}

export type GraceOrbProps = ComponentProps<"span"> & {
  /** `welcome`: the start-up pulses; `rest`: a steady soft glow while Grace is closed; `off`: no glow, while she is open. */
  glow?: "welcome" | "rest" | "off";
  /** Width and height of the orb's box in pixels; the orb itself fills three quarters of it. */
  size?: number;
};

/**
 * Grace's living orb: violet glass with drifting washes and a light streak, and the glow that invites a tap.
 * @model spec/app/shell.md
 * @design packages/design-system/design.md#grace
 */
export function GraceOrb({ glow = "rest", size = 96, className, style, ...props }: GraceOrbProps) {
  const id = `orb${useId().replace(/[^\w-]/g, "")}`;
  const ref = (name: string) => `url(#${id}${name})`;
  const still = useReducedMotion();
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
      <svg className="relative will-change-transform" width={size} height={size} viewBox="-14 -14 148 148">
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
          <Morph fill={ref("top")} filter={ref("soft")} shapes={top} dur="10s" still={still} />
          <Morph fill={ref("bottom")} filter={ref("soft")} shapes={bottom} dur="12s" still={still} />
          <g mask={ref("edge")}>
            <circle cx="60" cy="60" r="56" fill={ref("tint")}>
              {!still && <animateTransform attributeName="transform" type="rotate" values="0 60 60;40 60 60;-20 60 60;0 60 60" dur="13s" repeatCount="indefinite" />}
            </circle>
          </g>
          <Morph fill="none" stroke={ref("streak")} strokeWidth="7" opacity=".55" filter={ref("blur")} shapes={streak} dur="9s" still={still} />
          <Morph fill="none" stroke={ref("streak")} strokeWidth="1.6" opacity=".95" filter={ref("soft")} shapes={streak} dur="9s" still={still} />
          <Morph fill="none" stroke={white} strokeWidth="6" opacity=".35" filter={ref("blur")} shapes={sheen} dur="11s" still={still} />
          <Morph fill="none" stroke={white} strokeWidth="1.2" opacity=".6" filter={ref("soft")} shapes={sheen} dur="11s" still={still} />
          <circle cx="60" cy="60" r="56" fill={ref("rim")} />
        </g>
      </svg>
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

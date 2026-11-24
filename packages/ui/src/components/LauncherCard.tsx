import { useId, type ComponentProps, type ReactNode } from "react";
import { cn, focusRing } from "../lib/cn.ts";

export type LauncherCardProps = Omit<ComponentProps<"button">, "title"> & {
  /** The app's name, in bold at the top left. */
  title: string;
  /** One line under the title: what is new, or why the app waits. */
  status?: string;
  /** `large` for the tall cards (Calendar, Files): a 30px title and a 24px margin; `medium` for the stacked ones (Email, Internet). */
  size?: "large" | "medium";
  /** Artwork hanging over the top-right corner, such as the Calendar's tear-off page. */
  art?: ReactNode;
  /** Laid out flat above Grace's compact window rather than on Home's drum: the glass's own edge light and shadow. */
  compact?: boolean;
  /** Classes for the title and status, such as a width that keeps them clear of a preview. */
  headClassName?: string;
  /** Classes for the title alone, such as the smaller title of a narrow card above Grace's compact window. */
  titleClassName?: string;
  /** What the card shows under its title: rows, photos, a preview. */
  children?: ReactNode;
};

const heads = {
  large: { head: "top-[26px] left-7", title: "text-title-lg leading-9", body: "inset-x-6 top-[116px] bottom-6" },
  medium: { head: "top-[22px] left-[26px]", title: "text-title-sm leading-8", body: "inset-x-[22px] top-[100px] bottom-[22px]" },
};

const fading = "transition-opacity duration-slow ease-out-cubic will-change-[opacity] group-data-dragging/home:transition-none motion-reduce:transition-none";

export const turnsNear = { "data-turn": "near", className: fading } as const;
export const turnsFar = { "data-turn": "far", className: cn("invisible opacity-0 group-data-dragging/home:visible group-data-turning/home:visible", fading) } as const;

export type Turning = { near: HTMLElement[]; far: HTMLElement[] };

const turned = (card: Element, part: "near" | "far") => [...card.querySelectorAll<HTMLElement>(`[data-turn=${part}]`)];

export const turningOf = (card: Element): Turning => ({ near: turned(card, "near"), far: turned(card, "far") });

export function showTurn({ near, far }: Turning, away: number, side: 1 | -1) {
  const shown = Math.max(0, 1 - away * 3).toFixed(3);
  const blurred = away.toFixed(3);
  const toward = side > 0 ? "90deg" : "270deg";
  for (const part of near) part.style.opacity = shown;
  for (const part of far) {
    part.style.opacity = blurred;
    if (part.style.getPropertyValue("--far") !== toward) part.style.setProperty("--far", toward);
  }
}

/**
 * A Home launcher card: clear glass that opens its app, with the app's name, a status line and a preview of what is
 * in it. A slow sheen crosses it. Its name is its title and status; the preview describes it. On Home's drum,
 * `showTurn` shows a card `away` round the edge, from 0 (flat, in view) to 1 (turned off it), on its left (-1) or
 * right (1): what `turnsFar` marks, the blur Home lays over the card's far side while its cards move, fades in, and
 * what `turnsNear` marks (art, sheen) fades out at three times the pace. Only opacity changes, so a turning card
 * repaints nothing.
 * @model spec/app/shell.md
 * @design packages/design-system/design.md#glass
 */
export function LauncherCard({ title, status, size = "large", art, compact = false, headClassName, titleClassName, type = "button", className, children, ...props }: LauncherCardProps) {
  const head = heads[size];
  const previewId = useId();
  return (
    <button
      type={type}
      aria-describedby={children ? previewId : undefined}
      className={cn(
        focusRing,
        "relative block cursor-pointer rounded-card bg-glass/40 p-0 text-left font-sans text-foreground",
        compact ? "shadow-launcher" : "shadow-float",
        className,
      )}
      {...props}
    >
      <span aria-hidden {...turnsNear} className={cn("pointer-events-none absolute inset-0 overflow-hidden rounded-card", turnsNear.className)}>
        <span className="absolute inset-0 animate-sheen-pan bg-gradient-sheen bg-size-[400%_100%] bg-position-[50%_0] bg-no-repeat group-data-dragging/home:[animation-play-state:paused] motion-reduce:animate-none" />
      </span>
      {art ? <span {...turnsNear} className={cn("absolute", compact ? "top-2 right-2" : "-top-[34px] -right-5", turnsNear.className)}>{art}</span> : null}
      <span className={cn("absolute", head.head, headClassName)}>
        <span className={cn("block font-bold", head.title, titleClassName)}>{title}</span>
        {status && <span className="mt-0.5 block text-body leading-[26px] font-medium text-muted-foreground">{status}</span>}
      </span>
      {children ? (
        <span id={previewId} aria-hidden className={cn("absolute flex flex-col", head.body)}>
          {children}
        </span>
      ) : null}
    </button>
  );
}

export type LauncherRowsProps = ComponentProps<"span">;

/**
 * A card's rows, whole ones only: a row that would end within 12px of the card's bottom wraps out of sight instead of
 * being cut (prototype `fitCards()`, `.lpanel.fitoff`). Place it last in the card, where it takes the height left.
 */
export function LauncherRows({ className, ...props }: LauncherRowsProps) {
  return <span className={cn("flex min-h-0 flex-1 flex-col flex-wrap content-start gap-x-24 overflow-clip [overflow-clip-margin:16px] *:w-full *:shrink-0", className)} {...props} />;
}

import { useId, type ComponentProps, type CSSProperties, type ReactNode } from "react";
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
  /**
   * How far the card has turned away round the edge of Home's pages, from -1 (off the left) through 0 (flat, in view)
   * to 1 (off the right): its far side blurs progressively, its sheen stops and its art fades.
   */
  turn?: number;
  /** Laid out flat above Grace's compact window rather than on Home's 3D pages: the glass's own edge light and shadow. */
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

/**
 * A Home launcher card: clear glass that opens its app, with the app's name, a status line and a preview of what is
 * in it. A slow sheen crosses it. Its name is its title and status; the preview describes it.
 * @model spec/app/shell.md
 * @design packages/design-system/design.md#glass
 */
export function LauncherCard({ title, status, size = "large", art, turn = 0, compact = false, headClassName, titleClassName, type = "button", className, style, children, ...props }: LauncherCardProps) {
  const away = Math.min(1, Math.abs(turn));
  const head = heads[size];
  const previewId = useId();
  const content = (main = true) => (
    <>
      {art ? (
        <span className="absolute -top-[34px] -right-5" style={away ? { opacity: Math.max(0, 1 - away * 3) } : undefined}>
          {art}
        </span>
      ) : null}
      <span className={cn("absolute", head.head, headClassName)}>
        <span className={cn("block font-bold", head.title, titleClassName)}>{title}</span>
        {status && <span className="mt-0.5 block text-body leading-[26px] font-medium text-muted-foreground">{status}</span>}
      </span>
      {children ? (
        <span id={main ? previewId : undefined} aria-hidden className={cn("absolute flex flex-col", head.body)}>
          {children}
        </span>
      ) : null}
    </>
  );
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
      // eslint-disable-next-line design-system/no-literal-colors -- the primary token faded toward transparent by the turn, which no token can hold.
      style={away ? { boxShadow: `0 1px 2px color-mix(in srgb, var(--primary) 5%, transparent), 0 4px 14px color-mix(in srgb, var(--primary) ${(6 * (1 - away)).toFixed(1)}%, transparent)`, ...style } : style}
      {...props}
    >
      {!away && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 animate-sheen-pan rounded-card bg-gradient-sheen bg-size-[400%_100%] bg-position-[100%_0] bg-no-repeat motion-reduce:animate-none"
        />
      )}
      {away > 0.02 ? <Blurred turn={turn}>{content}</Blurred> : content()}
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

function Blurred({ turn, children }: { turn: number; children: (main: boolean) => ReactNode }) {
  const away = Math.min(1, Math.abs(turn));
  const near = 0.15 + 0.35 * (1 - away);
  const at = (t: number) => `calc(80px + (100% - 160px) * ${(near + (1 - near) * t).toFixed(3)})`;
  const ramp = (...stops: string[]) => `linear-gradient(${turn > 0 ? "to right" : "to left"}, ${stops.join(", ")})`;
  const masks = [
    ramp("black 0", `black ${at(0)}`, `transparent ${at(0.34)}`),
    ramp(`transparent ${at(0)}`, `black ${at(0.34)}`, `transparent ${at(0.67)}`),
    ramp(`transparent ${at(0.34)}`, `black ${at(0.67)}`, `transparent ${at(1)}`),
    // eslint-disable-next-line design-system/no-literal-colors -- a mask reads only the alpha of its stops; no one sees this black.
    ramp(`transparent ${at(0.67)}`, `color-mix(in srgb, black ${Math.round((1 - 0.3 * away) * 100)}%, transparent) ${at(1)}`),
  ];
  return [0, 1.2, 3, 6.5].map((blur, k) => {
    const style: CSSProperties = { maskImage: masks[k], WebkitMaskImage: masks[k], filter: blur ? `blur(${(blur * (0.4 + 0.6 * away)).toFixed(1)}px)` : undefined };
    return (
      <span key={blur} aria-hidden={k > 0 || undefined} inert={k > 0 || undefined} className="pointer-events-none absolute -inset-20" style={style}>
        <span className="absolute inset-20">{children(k === 0)}</span>
      </span>
    );
  });
}

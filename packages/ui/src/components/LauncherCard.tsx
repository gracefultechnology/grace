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
  /** What the card shows under its title: rows, photos, a preview. */
  children?: ReactNode;
};

// Prototype `.lc .ttl`, `.lc .st`; Calendar and Files use a 30px title (markup line ~818, `hmFilesInner`).
const heads = {
  large: { head: "top-[26px] left-7", title: "text-title-lg leading-9", body: "inset-x-6 top-[116px] bottom-6" },
  medium: { head: "top-[22px] left-[26px]", title: "text-title-sm leading-8", body: "inset-x-[22px] top-[100px] bottom-[22px]" },
};

/**
 * A Home launcher card: clear glass that opens its app, with the app's name, a status line and a preview of what is
 * in it. A slow sheen crosses it and a bright rim turns round its edge. Its name is its title and status; the preview
 * describes it.
 * @model spec/app/shell.md
 * @design packages/design-system/design.md#glass
 */
export function LauncherCard({ title, status, size = "large", art, turn = 0, type = "button", className, children, ...props }: LauncherCardProps) {
  const away = Math.min(1, Math.abs(turn));
  const head = heads[size];
  const previewId = useId();
  // Only the first copy carries the preview's id; `Blurred` stacks more.
  const content = (main = true) => (
    <>
      {/* Prototype: the corner art fades out three times as fast as the card turns (`hmApply`, stk opacity). */}
      {art ? (
        <span className="absolute -top-[34px] -right-5" style={away ? { opacity: Math.max(0, 1 - away * 3) } : undefined}>
          {art}
        </span>
      ) : null}
      <span className={cn("absolute", head.head)}>
        <span className={cn("block font-bold", head.title)}>{title}</span>
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
        // Prototype `.lc` as Home's 3D pages draw it: clear glass, the float shadow, a 2% spring on a tap.
        "relative block cursor-pointer rounded-card bg-glass/40 p-0 text-left font-sans text-foreground shadow-float backdrop-blur-nav backdrop-saturate-150 transition-transform duration-press ease-spring active:scale-[1.02] motion-reduce:active:scale-100",
        className,
      )}
      {...props}
    >
      {/* Prototype `.lc .sheen`: a soft band of light crossing every 9s, stopped while the card is turned. */}
      {!away && (
        <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-card">
          <i className="absolute -top-1/2 -bottom-1/2 left-[-40%] w-[120px] rotate-[18deg] animate-sheen bg-linear-to-r from-transparent via-glass/35 to-transparent motion-reduce:animate-none" />
        </span>
      )}
      {/* Prototype `.lc .spec`: a 1.5px rim lit by a slowly turning highlight. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-card p-[1.5px] [mask:linear-gradient(var(--glass)_0_0)_content-box_exclude,linear-gradient(var(--glass)_0_0)]"
      >
        <i className="absolute top-1/2 left-1/2 -mt-[700px] -ml-[700px] size-[1400px] animate-spin-slow bg-[conic-gradient(from_0deg,var(--glass),color-mix(in_oklab,var(--glass)_15%,transparent)_18%,color-mix(in_oklab,var(--glass)_15%,transparent)_32%,color-mix(in_oklab,var(--glass)_95%,transparent)_50%,color-mix(in_oklab,var(--glass)_15%,transparent)_68%,color-mix(in_oklab,var(--glass)_15%,transparent)_82%,var(--glass))] motion-reduce:animate-none" />
      </span>
      {away > 0.02 ? <Blurred turn={turn}>{content}</Blurred> : content()}
    </button>
  );
}

// Prototype `hmLayers`: four stacked copies of the content, each more blurred, cross-faded along the card from the edge
// nearest the view, so the side turning away goes soft. Each copy reaches 80px past the card so the blur is not cut.
function Blurred({ turn, children }: { turn: number; children: (main: boolean) => ReactNode }) {
  const away = Math.min(1, Math.abs(turn));
  const near = 0.15 + 0.35 * (1 - away);
  // A stop `t` of the way from the near point to the far edge, in the copy's own width (card + 2 × 80px).
  const at = (t: number) => `calc(80px + (100% - 160px) * ${(near + (1 - near) * t).toFixed(3)})`;
  const ramp = (...stops: string[]) => `linear-gradient(${turn > 0 ? "to right" : "to left"}, ${stops.join(", ")})`;
  const masks = [
    ramp("black 0", `black ${at(0)}`, `transparent ${at(0.34)}`),
    ramp(`transparent ${at(0)}`, `black ${at(0.34)}`, `transparent ${at(0.67)}`),
    ramp(`transparent ${at(0.34)}`, `black ${at(0.67)}`, `transparent ${at(1)}`),
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

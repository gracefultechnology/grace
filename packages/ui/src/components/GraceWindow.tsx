import { useCallback, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "../lib/cn.ts";
import { play, useReducedMotion } from "../lib/motion.ts";
import { useSize, watch } from "../lib/observe.ts";

export type GraceWindowProps = Omit<ComponentProps<"section">, "children" | "ref"> & {
  /** `compact` is three rows over the page (header, the current message, the answer row); `expanded` fills the screen. */
  size?: "compact" | "expanded";
  /** The compact window's height; by default it fits what it shows (prototype `sizeCompact()`). */
  height?: number;
  /** The expanded window's height as CSS, such as the screen less its margins and the keyboard; by default it fills what holds it. */
  expandedHeight?: string;
  /** `waiting`: laid out and not drawn yet; `open`. Opening from `waiting` rises from the screen's edge. */
  presence?: "waiting" | "open";
  /** Called with the compact window's height as it fits what it shows, so what is under it can make room. */
  onHeightChange?: (height: number) => void;
  /** Her header, a `GraceHeader`. */
  header: ReactNode;
  /** The conversation, a `GraceMessages`. */
  children?: ReactNode;
  /** The answer row, a `GraceDock`, floating over the conversation. */
  dock?: ReactNode;
};

const COMPACT = 260;
const LINE = 32;
const COMPACT_DOCK = 88;
const CLEAR = 12;

type Phase = "waiting" | "compact" | "expanded" | "collapsing";

function fitted(section: HTMLElement): number {
  let current = section.querySelector("[role=log]")?.lastElementChild;
  const answers = current?.hasAttribute("data-answers") ?? false;
  if (answers) current = current?.previousElementSibling;
  const lines = current instanceof HTMLElement ? Math.round((current.offsetHeight - 20) / LINE) : 1;
  return COMPACT + (lines >= 2 ? LINE : 0) + (answers ? 70 : 0);
}

function slide(sheet: HTMLElement, rest: number, direction: "rise" | "fall"): Animation[] {
  const held = sheet.querySelector("[data-grace-held]");
  const travel = rest > 0 ? sheet.offsetHeight - rest : sheet.offsetHeight + CLEAR;
  const frames = (by: number) => {
    const away = { transform: `translateY(${by}px)` };
    return direction === "rise" ? [away, { transform: "none" }] : [{ transform: "none" }, away];
  };
  const pace = direction === "rise" ? { duration: "window", ease: "settle" } as const : { duration: "window", ease: "standard", fill: "forwards" } as const;
  return [play(sheet, frames(travel), pace), held && play(held, frames(-travel), pace)].filter((motion) => motion != null);
}

/**
 * Grace's window: the header and the answer row float over her conversation, which scrolls beneath them
 * (prototype `#gwin`, `.chat-white`). Its size changes in one layout: growing, it is laid out at its new size at once
 * and its top edge rises to it; shrinking, the edge falls first and the layout follows. Only two transforms
 * move, the sheet's and the conversation's against it, so the conversation and the answer row stay where they are.
 * @model spec/app/assistant.md
 * @design packages/design-system/design.md#grace
 * @design packages/design-system/design.md#screens
 */
export function GraceWindow({ size = "expanded", height, expandedHeight, presence = "open", onHeightChange, header, dock, className, style, children, ...props }: GraceWindowProps) {
  const still = useReducedMotion();
  const [laid, setLaid] = useState(size);
  if (laid !== size && (size === "expanded" || still)) setLaid(size);
  const expanded = laid === "expanded";
  const phase: Phase = presence === "waiting" ? "waiting" : laid === size ? laid : "collapsing";
  const fits = !expanded && height === undefined;
  const [fit, setFit] = useState(COMPACT);
  const [dockRef, dockSize] = useSize<HTMLDivElement>();
  const dockHeight = dockSize?.height ?? 0;
  const dockExtra = Math.max(0, dockHeight - COMPACT_DOCK);
  const compactHeight = height ?? fit + dockExtra;
  const dockStyle = { "--grace-dock-height": `${dockHeight}px` };
  const wasRef = useRef<Phase>(null);
  const motionsRef = useRef<Animation[]>([]);
  const glide = useCallback(
    (sheet: HTMLElement | null) => {
      const was = wasRef.current;
      if (!sheet || was === phase) return;
      wasRef.current = phase;
      for (const motion of motionsRef.current) motion.cancel();
      if (phase === "collapsing") {
        const fall = slide(sheet, compactHeight, "fall");
        const last = fall.at(-1);
        if (last) last.onfinish = () => setLaid("compact");
        else setLaid("compact");
        motionsRef.current = fall;
      } else motionsRef.current = phase === "waiting" || was === null || was === "collapsing" ? [] : slide(sheet, was === "compact" ? compactHeight : 0, "rise");
    },
    [phase, compactHeight],
  );
  const fitRef = useCallback(
    (held: HTMLElement | null) =>
      held && fits
        ? watch(held, () => {
            const next = fitted(held);
            setFit(next);
            onHeightChange?.(next + dockExtra);
          })
        : undefined,
    [fits, onHeightChange, dockExtra],
  );
  return (
    <section
      ref={glide}
      aria-label="Grace"
      data-size={laid}
      className={cn("group/grace pointer-events-auto relative isolate w-full overflow-hidden rounded-device font-sans text-grace-ink shadow-window", expanded && !expandedHeight && "h-full", className)}
      style={{ ...dockStyle, height: expanded ? expandedHeight : compactHeight, ...style }}
      {...props}
    >
      <div ref={fitRef} data-grace-held className="absolute inset-0 flex flex-col overflow-hidden rounded-device bg-background p-4">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
        {dock != null && (
          <>
            <span
              aria-hidden
              className={cn("pointer-events-none absolute inset-x-0 bottom-0 z-[1] rounded-b-device bg-linear-to-t from-background/75 via-background/35 via-60% to-transparent mask-t-from-50% backdrop-blur-fade", expanded ? "h-[120px]" : "h-[110px]")}
            />
            <div ref={dockRef} className="absolute inset-x-4 bottom-4 z-[2]">{dock}</div>
          </>
        )}
      </div>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-[100px] rounded-t-device bg-linear-to-b from-background/55 via-background/15 via-70% to-transparent mask-b-from-50% backdrop-blur-soft"
      />
      <div className="absolute inset-x-4 top-4 z-[2]">{header}</div>
    </section>
  );
}

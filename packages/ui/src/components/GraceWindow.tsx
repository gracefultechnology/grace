import { useCallback, useState, type AnimationEvent, type ComponentProps, type ReactNode } from "react";
import { cn } from "../lib/cn.ts";
import { useReducedMotion } from "../lib/motion.ts";
import { useSize, watch } from "../lib/observe.ts";

export type GraceWindowProps = Omit<ComponentProps<"section">, "children" | "ref"> & {
  /** `compact` is three rows over the page (header, the current message, the answer row); `expanded` fills the screen. */
  size?: "compact" | "expanded";
  /** The compact window's height; by default it fits what it shows (prototype `sizeCompact()`). */
  height?: number;
  /** The expanded window's height as CSS, such as the screen less its margins and the keyboard; by default it fills what holds it. */
  expandedHeight?: string;
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
const ENTER = "calc(100% + 12px)";

type Motion = { kind: "rise" | "fall"; travel: string };
const motions: Record<string, Motion["kind"]> = { "grace-rise": "rise", "grace-fall": "fall" };

function fitted(section: HTMLElement): number {
  let current = section.querySelector("[role=log]")?.lastElementChild;
  const answers = current?.hasAttribute("data-answers") ?? false;
  if (answers) current = current?.previousElementSibling;
  const lines = current instanceof HTMLElement ? Math.round((current.offsetHeight - 20) / LINE) : 1;
  return COMPACT + (lines >= 2 ? LINE : 0) + (answers ? 70 : 0);
}

/**
 * Grace's window: the header and the answer row float over her conversation, which scrolls beneath them
 * (prototype `#gwin`, `.chat-white`). Its size changes in one layout. Growing, it is laid out at its new size at once;
 * until what holds it is `data-settled` there (the `settles` group) it shows its header over its answer row, as the
 * compact window did, and then its top edge rises. Shrinking, the edge falls first and the layout follows. Only two
 * transforms move, the window's and the conversation's against it, so the conversation and the answer row stay where
 * they are and every control stays inside the window's laid-out box. It takes taps only on the window itself, so what
 * lies above a falling edge is in reach at once. With reduced motion it changes size in one step.
 * @model spec/app/assistant.md
 * @design packages/design-system/design.md#grace
 * @design packages/design-system/design.md#screens
 */
export function GraceWindow({ size = "expanded", height, expandedHeight, onHeightChange, header, dock, className, style, children, ...props }: GraceWindowProps) {
  const still = useReducedMotion();
  const [asked, setAsked] = useState(size);
  const [laid, setLaid] = useState(size);
  const [motion, setMotion] = useState<Motion | undefined>(still ? undefined : { kind: "rise", travel: ENTER });
  const expanded = laid === "expanded";
  const fits = !expanded && height === undefined;
  const [fit, setFit] = useState(COMPACT);
  const [dockRef, dockSize] = useSize<HTMLDivElement>();
  const dockHeight = dockSize?.height ?? 0;
  const dockExtra = Math.max(0, dockHeight - COMPACT_DOCK);
  const compactHeight = height ?? fit + dockExtra;
  if (asked !== size) {
    setAsked(size);
    const travel = `calc(100% - ${compactHeight}px)`;
    if (size === "expanded") {
      setLaid(size);
      setMotion(still ? undefined : { kind: "rise", travel });
    } else if (still || laid === "compact") {
      setLaid(size);
      setMotion(undefined);
    } else setMotion({ kind: "fall", travel });
  }
  if (still && motion) {
    if (motion.kind === "fall") setLaid("compact");
    setMotion(undefined);
  }
  const ended = (event: AnimationEvent<HTMLElement>) => {
    if (!motion || event.target !== event.currentTarget || motions[event.animationName] !== motion.kind) return;
    if (motion.kind === "fall") setLaid("compact");
    setMotion(undefined);
  };
  const ref = useCallback(
    (section: HTMLElement | null) =>
      section && fits
        ? watch(section, () => {
            const next = fitted(section);
            setFit(next);
            onHeightChange?.(next + dockExtra);
          })
        : undefined,
    [fits, onHeightChange, dockExtra],
  );
  const vars = { "--grace-dock-height": `${dockHeight}px`, "--grace-travel": motion?.travel };
  const rising = motion?.kind === "rise";
  const growing = rising && motion.travel !== ENTER;
  const falling = motion?.kind === "fall";
  return (
    <section
      ref={ref}
      aria-label="Grace"
      data-size={laid}
      onAnimationEnd={ended}
      className={cn(
        "group/grace pointer-events-auto relative isolate flex w-full flex-col overflow-hidden rounded-device bg-background p-4 font-sans text-grace-ink shadow-window",
        expanded && !expandedHeight && "h-full",
        rising && "group-data-settled/settles:animate-grace-rise",
        falling && "animate-grace-fall",
        className,
      )}
      style={{ ...vars, height: expanded ? expandedHeight : compactHeight, ...style }}
      {...props}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-[100px] rounded-t-device bg-linear-to-b from-background/55 via-background/15 via-70% to-transparent mask-b-from-50% backdrop-blur-soft"
      />
      {header}
      <div
        className={cn(
          "absolute inset-0 flex flex-col p-4",
          rising && "group-data-settled/settles:animate-grace-rise-hold",
          growing && "group-[:not([data-settled])]/settles:[translate:0_calc(-1*var(--grace-travel))]",
          falling && "animate-grace-fall-hold",
        )}
      >
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
    </section>
  );
}

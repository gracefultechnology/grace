import { useCallback, useRef, useState, type AnimationEvent, type ComponentProps, type ReactNode } from "react";
import { cn } from "../lib/cn.ts";
import { useReducedMotion } from "../lib/motion.ts";
import { watch } from "../lib/observe.ts";

export type GraceWindowProps = Omit<ComponentProps<"section">, "children" | "ref"> & {
  /** `compact` is three rows over the page (header, the current message, the answer row); `expanded` fills the screen. */
  size?: "compact" | "expanded";
  /** Whether Grace's window is open; setting false slides it down off screen before calling `onClosed`. */
  open?: boolean;
  /** Called when the closing slide animation finishes. */
  onClosed?: () => void;
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

type Motion = { kind: "rise" | "fall" | "exit"; travel: string };
const motions: Record<string, readonly Motion["kind"][]> = { "grace-rise": ["rise"], "grace-fall": ["fall", "exit"] };

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
export function GraceWindow({ size = "expanded", open = true, onClosed, height, expandedHeight, onHeightChange, header, dock, className, style, children, ...props }: GraceWindowProps) {
  const still = useReducedMotion();
  const [wasOpen, setWasOpen] = useState(open);
  const [asked, setAsked] = useState(size);
  const [laid, setLaid] = useState(size);
  const [motion, setMotion] = useState<Motion | undefined>(still || !open ? undefined : { kind: "rise", travel: ENTER });
  const expanded = laid === "expanded";
  const fits = !expanded && height === undefined;
  const [fit, setFit] = useState(COMPACT);
  const [dockHeight, setDockHeight] = useState(0);
  const lastReportedRef = useRef<number | undefined>(undefined);
  const dockRef = useCallback((element: HTMLDivElement | null) => {
    if (!element) {
      setDockHeight(0);
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      const height = entry?.borderBoxSize[0]?.blockSize;
      if (height !== undefined) setDockHeight(height);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const dockExtra = Math.max(0, dockHeight - COMPACT_DOCK);
  const compactHeight = height ?? fit + dockExtra;
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) {
      setMotion(still ? undefined : { kind: "exit", travel: ENTER });
    } else {
      setAsked(size);
      setLaid(size);
      setMotion(still ? undefined : { kind: "rise", travel: ENTER });
    }
  } else if (open && asked !== size) {
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
    if (!motion || event.target !== event.currentTarget || !motions[event.animationName]?.includes(motion.kind)) return;
    const finished = motion.kind;
    if (finished === "fall") setLaid("compact");
    setMotion(undefined);
    if (finished === "exit") onClosed?.();
  };
  const ref = useCallback(
    (section: HTMLElement | null) => {
      if (!section || !fits || !open) {
        lastReportedRef.current = undefined;
        return;
      }
      const target = section.querySelector("[role=log]") ?? section;
      const stop = watch(target, () => {
        const next = fitted(section);
        setFit(next);
        const total = next + dockExtra;
        if (lastReportedRef.current !== total) {
          lastReportedRef.current = total;
          onHeightChange?.(total);
        }
      });
      return () => {
        stop();
        lastReportedRef.current = undefined;
      };
    },
    [fits, open, onHeightChange, dockExtra],
  );
  if (!open && motion?.kind !== "exit") return null;
  const vars = { "--grace-dock-height": `${dockHeight}px`, "--grace-travel": motion?.travel };
  const rising = motion?.kind === "rise";
  const growing = rising && motion.travel !== ENTER;
  const falling = motion?.kind === "fall";
  const exiting = motion?.kind === "exit";
  return (
    <section
      ref={ref}
      aria-label="Grace"
      aria-hidden={!open || undefined}
      inert={!open || undefined}
      data-size={laid}
      data-moving={motion ? "" : undefined}
      onAnimationEnd={ended}
      className={cn(
        "group/grace relative isolate flex w-full flex-col overflow-hidden rounded-window bg-background p-4 font-sans text-grace-ink shadow-window",
        open ? "pointer-events-auto" : "pointer-events-none",
        expanded && !expandedHeight && "h-full",
        motion && "will-change-transform",
        rising && "group-data-settled/settles:animate-grace-rise",
        (falling || exiting) && "animate-grace-fall",
        className,
      )}
      style={{ ...vars, height: expanded ? expandedHeight : compactHeight, ...style }}
      {...props}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-[100px] rounded-t-window bg-linear-to-b from-background/85 via-background/40 via-65% to-transparent"
      />
      {header}
      <div
        className={cn(
          "absolute inset-0 flex flex-col p-4",
          (rising || falling) && "will-change-transform",
          rising && "group-data-settled/settles:animate-grace-rise-hold",
          growing && "group-[:not([data-settled])]/settles:[transform:translateY(calc(-1*var(--grace-travel)))]",
          falling && "animate-grace-fall-hold",
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
        {dock != null && (
          <>
            <span
              aria-hidden
              className={cn("pointer-events-none absolute inset-x-0 bottom-0 z-[1] rounded-b-window bg-linear-to-t from-background/90 via-background/50 via-60% to-transparent", expanded ? "h-[120px]" : "h-[110px]")}
            />
            <div ref={dockRef} className="absolute inset-x-4 bottom-4 z-[2]">{dock}</div>
          </>
        )}
      </div>
    </section>
  );
}

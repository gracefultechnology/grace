import { useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "../lib/cn.ts";

export type GraceWindowProps = Omit<ComponentProps<"section">, "children" | "ref"> & {
  /** `compact` is three rows over the page (header, the current message, the answer row); `expanded` fills the screen. */
  size?: "compact" | "expanded";
  /** `white` is the solid chat window; `frost` the frosted glass one with white bubbles. */
  surface?: "white" | "frost";
  /** The compact window's height; by default it fits what it shows (prototype `sizeCompact()`). */
  height?: number;
  /** Called with the compact window's height as it fits what it shows, so what is under it can make room. */
  onHeightChange?: (height: number) => void;
  /** Her header, a `GraceHeader`. */
  header: ReactNode;
  /** The conversation, a `GraceMessages`. */
  children?: ReactNode;
  /** The answer row, a `GraceDock`, floating over the conversation. */
  dock?: ReactNode;
  /** `screen` places the window on a `TabletScreen`, right of the rail; `inline` fills its container's width. */
  placement?: "screen" | "inline";
};

const COMPACT = 260;
const LINE = 32;

/**
 * Prototype `sizeCompact()`: 260 for a message of one line, a line more for a longer one, and 70 more for a question
 * with its answers.
 */
function fitted(section: HTMLElement): number {
  let current = section.querySelector("[role=log]")?.lastElementChild;
  const answers = current?.hasAttribute("data-answers") ?? false;
  if (answers) current = current?.previousElementSibling;
  const lines = current instanceof HTMLElement ? Math.round((current.offsetHeight - 20) / LINE) : 1;
  return COMPACT + (lines >= 2 ? LINE : 0) + (answers ? 70 : 0);
}

/**
 * Grace's window: the header and the answer row float over her conversation, which scrolls beneath them
 * (prototype `#gwin`, `.chat-white`).
 * @model spec/app/assistant.md
 * @design packages/design-system/design.md#grace
 */
export function GraceWindow({ size = "expanded", surface = "white", height, onHeightChange, header, dock, placement = "screen", className, style, children, ...props }: GraceWindowProps) {
  const expanded = size === "expanded";
  const ref = useRef<HTMLElement>(null);
  const [fit, setFit] = useState(COMPACT);
  useLayoutEffect(() => {
    const section = ref.current;
    if (expanded || height !== undefined || !section) return;
    const measure = () => {
      const next = fitted(section);
      setFit(next);
      onHeightChange?.(next);
    };
    measure();
    // A message rewraps as the window's width changes.
    const observer = new ResizeObserver(measure);
    const log = section.querySelector("[role=log]");
    if (log) observer.observe(log);
    return () => observer.disconnect();
  });
  const white = surface === "white";
  // .gwin::before / ::after: the conversation softens under the toolbars, as in iOS Messages.
  const fade = white ? "from-background/55 via-background/15 via-70%" : "from-frost/60 via-frost/25 via-60%";
  return (
    <section
      ref={ref}
      aria-label="Grace"
      data-size={size}
      data-surface={surface}
      className={cn(
        // .gwin: 16px in, the corner concentric with its 64px capsules (32 + 16).
        "group/grace isolate flex flex-col gap-6 overflow-hidden rounded-device p-4 font-sans text-grace-ink transition-[height,bottom] duration-slow ease-settle motion-reduce:transition-none",
        white
          ? "bg-background shadow-window"
          : cn("shadow-banner backdrop-blur-2xl backdrop-saturate-150", expanded ? "bg-frost/94" : "bg-frost/86"),
        placement === "screen" ? cn("absolute bottom-1.5 left-[144px] z-[3] right-1.5", expanded && "top-1.5") : cn("relative w-full", expanded && "h-full"),
        className,
      )}
      style={expanded ? style : { height: height ?? fit, ...style }}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-[1] rounded-t-device bg-linear-to-b to-transparent mask-b-from-50%",
          white ? "h-[100px] backdrop-blur-soft" : "h-[120px] backdrop-blur-fade",
          fade,
        )}
      />
      {header}
      <div className="-mt-[88px] flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      {dock != null && (
        <>
          <span
            aria-hidden
            className={cn("pointer-events-none absolute inset-x-0 bottom-0 z-[1] rounded-b-device bg-linear-to-t to-transparent mask-t-from-50% backdrop-blur-fade", expanded ? "h-[120px]" : "h-[110px]", white ? "from-background/75 via-background/35 via-60%" : fade)}
          />
          <div className="absolute inset-x-4 bottom-4 z-[2]">{dock}</div>
        </>
      )}
    </section>
  );
}

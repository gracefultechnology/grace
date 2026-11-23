import { useCallback, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "../lib/cn.ts";
import { useSize, watch } from "../lib/observe.ts";

export type GraceWindowProps = Omit<ComponentProps<"section">, "children" | "ref"> & {
  /** `compact` is three rows over the page (header, the current message, the answer row); `expanded` fills the screen. */
  size?: "compact" | "expanded";
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
};

const COMPACT = 260;
const LINE = 32;
const COMPACT_DOCK = 88;

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
 * @design packages/design-system/design.md#screens
 */
export function GraceWindow({ size = "expanded", height, onHeightChange, header, dock, className, style, children, ...props }: GraceWindowProps) {
  const expanded = size === "expanded";
  const fits = !expanded && height === undefined;
  const [fit, setFit] = useState(COMPACT);
  const [dockRef, dockSize] = useSize<HTMLDivElement>();
  const dockHeight = dockSize?.height ?? 0;
  const dockExtra = Math.max(0, dockHeight - COMPACT_DOCK);
  const dockStyle = { "--grace-dock-height": `${dockHeight}px` };
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
  return (
    <section
      ref={ref}
      aria-label="Grace"
      data-size={size}
      className={cn(
        "group/grace relative isolate flex w-full flex-col gap-6 overflow-hidden rounded-device bg-background p-4 font-sans text-grace-ink shadow-window transition-[height] duration-slow ease-settle motion-reduce:transition-none",
        expanded && "h-full",
        className,
      )}
      style={expanded ? { ...dockStyle, ...style } : { ...dockStyle, height: height ?? fit + dockExtra, ...style }}
      {...props}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-[100px] rounded-t-device bg-linear-to-b from-background/55 via-background/15 via-70% to-transparent mask-b-from-50% backdrop-blur-soft"
      />
      {header}
      <div className="-mt-[88px] flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      {dock != null && (
        <>
          <span
            aria-hidden
            className={cn("pointer-events-none absolute inset-x-0 bottom-0 z-[1] rounded-b-device bg-linear-to-t from-background/75 via-background/35 via-60% to-transparent mask-t-from-50% backdrop-blur-fade", expanded ? "h-[120px]" : "h-[110px]")}
          />
          <div ref={dockRef} className="absolute inset-x-4 bottom-4 z-[2]">{dock}</div>
        </>
      )}
    </section>
  );
}

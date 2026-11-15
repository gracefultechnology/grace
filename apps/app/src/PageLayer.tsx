// spec/app/surface.md, "Story: Use the website under Grace's controls"
// What the interface measures for the page layer: the page's rect and the rect of every Grace control
// drawn over it, reported to PageHost (page.vibe) whenever layout settles.
import { cn } from "@repo/ui";
import { Effect } from "effect";
import { type ComponentProps, type ReactNode, createContext, use, useCallback, useEffect, useMemo, useState } from "react";
import type { Rect } from "../gen/app__surface.ts";
import { type Measured, PageHost } from "./page.vibe";
import { type Runtime, usePageLayer } from "./useApp.ts";

type Measurer = ReturnType<typeof measurer>;
const MeasurerContext = createContext<Measurer | null>(null);

/** Rects are whole CSS pixels in the interface's coordinates (spec/app/surface.md): a control's grows to every pixel it
 * touches, so no part of it passes a touch to the page, and the page's shrinks to the pixels it fills. */
function rectOf(element: Element, outward: boolean): Rect {
  const { left, top, right, bottom } = element.getBoundingClientRect();
  const [start, end] = outward ? [Math.floor, Math.ceil] : [Math.ceil, Math.floor];
  const x = start(left), y = start(top);
  return { x, y, width: Math.max(0, end(right) - x), height: Math.max(0, end(bottom) - y) };
}

const sameRect = (a: Rect, b: Rect) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/**
 * Measures after each layout change, a frame at a time, and reports only what changed. Each control is shown while the
 * page layer draws the rect it was last drawn at: a control that moved keeps that rect routed beside its new one, and is
 * painted there until the new one is drawn, so it never blinks out or loses focus as it moves, and takes touches only
 * where they are routed to Grace (spec/app/surface.md, "A Grace control is drawn over the page only after the host routes its rect to Grace").
 */
function measurer(report: (measured: Measured) => void) {
  let page: HTMLElement | null = null;
  let measured: Measured = { page: { x: 0, y: 0, width: 0, height: 0 }, corners: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 }, controls: [] };
  const controls = new Map<HTMLElement, { rect?: Rect; at?: Rect; show: (drawn: boolean) => void }>();
  let drawn: Rect[] = [];
  const isDrawn = (rect?: Rect) => rect !== undefined && drawn.some((r) => sameRect(r, rect));
  const follow = () => {
    for (const [element, control] of controls) {
      const { rect, at } = control;
      if (isDrawn(rect)) control.at = rect;
      control.show(isDrawn(control.at));
      // Its layout box at `rect`, mapped onto `at` while only that is drawn.
      const held = rect && at && isDrawn(at) && !isDrawn(rect);
      element.style.transformOrigin = held ? "0 0" : "";
      element.style.transform = held ? `translate(${at.x - rect.x}px, ${at.y - rect.y}px) scale(${at.width / (rect.width || 1)}, ${at.height / (rect.height || 1)})` : "";
    }
  };
  let queued = false;
  const settle = () => {
    queued = false;
    // Where each control is laid out, not where it is painted.
    for (const element of controls.keys()) element.style.transform = "";
    for (const [element, control] of controls) control.rect = rectOf(element, true);
    follow();
    const style = page && getComputedStyle(page);
    const next: Measured = {
      page: page ? rectOf(page, false) : measured.page,
      corners: style ? { topLeft: parseFloat(style.borderTopLeftRadius), topRight: parseFloat(style.borderTopRightRadius), bottomRight: parseFloat(style.borderBottomRightRadius), bottomLeft: parseFloat(style.borderBottomLeftRadius) } : measured.corners,
      // One rect per place, in reading order.
      controls: [...new Map([...controls.values()].flatMap(({ rect, at }) => [rect, at]).filter((r) => r !== undefined).map((r) => [JSON.stringify(r), r])).values()].sort((a, b) => a.y - b.y || a.x - b.x),
    };
    if (JSON.stringify(next) === JSON.stringify(measured)) return;
    measured = next;
    report(next);
  };
  const measure = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(settle);
  };
  const resized = new ResizeObserver(measure);
  return {
    measure,
    /** The rects the page layer draws now. */
    drawn(rects: Rect[]) {
      drawn = rects;
      follow();
      measure();
    },
    page(element: HTMLElement) {
      page = element;
      resized.observe(element);
      measure();
      return () => { resized.unobserve(element); if (page === element) page = null; };
    },
    control(element: HTMLElement, show: (drawn: boolean) => void) {
      controls.set(element, { show });
      resized.observe(element);
      measure();
      return () => { controls.delete(element); resized.unobserve(element); measure(); };
    },
  };
}

/** Measures for `runtime`'s PageHost, and tells it whether the interface is visible; a window resize or a finished transition moves things without resizing them. */
export function PageMeasurer({ runtime, children }: { runtime: Runtime; children: ReactNode }) {
  const value = useMemo(() => measurer((measured) => runtime.runFork(Effect.flatMap(Effect.service(PageHost), (host) => host.measure(measured)))), [runtime]);
  const drawn = usePageLayer()?.drawn;
  useEffect(() => value.drawn(drawn ?? []), [value, drawn]);
  const listen = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    const events = ["resize", "transitionend", "transitioncancel", "animationend"] as const;
    events.forEach((name) => window.addEventListener(name, value.measure, true));
    // spec/app/surface.md, "The page is paused while Grace's window is in the background"
    const visibility = () => runtime.runFork(Effect.flatMap(Effect.service(PageHost), (host) => host.showHost(document.visibilityState === "visible")));
    document.addEventListener("visibilitychange", visibility);
    visibility();
    return () => {
      events.forEach((name) => window.removeEventListener(name, value.measure, true));
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [runtime, value]);
  return <MeasurerContext value={value}><div ref={listen} className="contents">{children}</div></MeasurerContext>;
}

function useMeasurer() {
  const value = use(MeasurerContext);
  if (!value) throw new Error("outside PageMeasurer");
  return value;
}

/** The transparent rect the native page fills. Assistive technology reaches the website's own nodes there,
 * so this host node is hidden from it (definitions.ts, SurfaceLayer). */
export function PageArea({ className }: { className?: string }) {
  const measurer = useMeasurer();
  const ref = useCallback((element: HTMLDivElement | null) => element ? measurer.page(element) : undefined, [measurer]);
  return <div ref={ref} aria-hidden className={className} />;
}

/**
 * A Grace control over the page. It is drawn only once the page layer has drawn its rect, which waits
 * until the host routes that rect's touches to Grace; until then it is hidden and takes no input.
 * @model spec/app/surface.md
 */
// spec/app/surface.md, "A Grace control is drawn over the page only after the host routes its rect to Grace"
export function OverPage({ className, style, ...props }: ComponentProps<"div">) {
  const measurer = useMeasurer();
  const [drawn, setDrawn] = useState(false);
  const ref = useCallback((element: HTMLDivElement | null) => element ? measurer.control(element, setDrawn) : undefined, [measurer]);
  return <div ref={ref} inert={!drawn} className={cn(!drawn && "invisible", className)} style={style} {...props} />;
}

/** The radius of the page's bottom corners: the browser window's (PageArea's rounded-b-window). */
const windowRadius = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--radius-window")) || 0;

/** The screen's wash, with a hole where the shown page is so the website below shows through. */
export function PageBackdrop({ className }: { className?: string }) {
  const layer = usePageLayer();
  const page = layer?.shown ? layer.page : undefined;
  const r = windowRadius();
  const hole = page && `M${page.x} ${page.y}H${page.x + page.width}V${page.y + page.height - r}A${r} ${r} 0 0 1 ${page.x + page.width - r} ${page.y + page.height}H${page.x + r}A${r} ${r} 0 0 1 ${page.x} ${page.y + page.height - r}Z`;
  return <div aria-hidden className={className} style={hole ? { clipPath: `path(evenodd, "M0 0H100000V100000H0Z${hole}")` } : undefined} />;
}

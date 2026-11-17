// spec/app/surface.md, "Story: Use the website under Grace's controls"; spec/app/surface.md, "A Grace control is drawn over the page only after the host routes its rect to Grace"; spec/app/surface.md, "The page fills the rect the interface measured for it"
import { cn } from "@repo/ui";
import { Effect, Stream } from "effect";
import { type ComponentProps, type ReactNode, createContext, use, useCallback, useMemo, useState } from "react";
import { type Rect, Machine as PageLayers } from "../gen/app__surface.effect.vibe";
import { type Measured, PageHost } from "./page.vibe";
import { type Runtime, usePageLayer } from "./useApp.ts";

type Measurer = ReturnType<typeof measurer>;
const MeasurerContext = createContext<Measurer | null>(null);

function rectOf(element: Element, outward: boolean): Rect {
  const { left, top, right, bottom } = element.getBoundingClientRect();
  const [start, end] = outward ? [Math.floor, Math.ceil] : [Math.ceil, Math.floor];
  const x = start(left), y = start(top);
  return { x, y, width: Math.max(0, end(right) - x), height: Math.max(0, end(bottom) - y) };
}

const sameRect = (a: Rect, b: Rect) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
const sameRects = (a: Rect[], b: Rect[]) => a.length === b.length && a.every((r, i) => sameRect(r, b[i]));
const sameMeasured = (a: Measured, b: Measured) =>
  sameRect(a.page, b.page) && sameRects(a.controls, b.controls)
  && a.corners.topLeft === b.corners.topLeft && a.corners.topRight === b.corners.topRight
  && a.corners.bottomRight === b.corners.bottomRight && a.corners.bottomLeft === b.corners.bottomLeft;

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
      const held = rect && at && isDrawn(at) && !isDrawn(rect);
      element.style.transform = held ? `translate(${at.x - rect.x}px, ${at.y - rect.y}px)` : "";
      element.style.clipPath = held ? `inset(0 ${Math.max(0, rect.width - at.width)}px ${Math.max(0, rect.height - at.height)}px 0)` : "";
    }
  };
  let queued = false;
  const settle = () => {
    queued = false;
    for (const element of controls.keys()) element.style.transform = element.style.clipPath = "";
    for (const [element, control] of controls) control.rect = rectOf(element, true);
    follow();
    const style = page && getComputedStyle(page);
    const placed = [...controls.values()].flatMap(({ rect, at }) => [rect, at]).filter((r) => r !== undefined);
    const next: Measured = {
      page: page ? rectOf(page, false) : measured.page,
      corners: style ? { topLeft: parseFloat(style.borderTopLeftRadius), topRight: parseFloat(style.borderTopRightRadius), bottomRight: parseFloat(style.borderBottomRightRadius), bottomLeft: parseFloat(style.borderBottomLeftRadius) } : measured.corners,
      controls: placed.filter((r, i) => placed.findIndex((other) => sameRect(other, r)) === i).sort((a, b) => a.y - b.y || a.x - b.x),
    };
    if (sameMeasured(next, measured)) return;
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
    corners: () => measured.corners,
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

const moves = ["resize", "transitionend", "transitioncancel", "animationend"] as const;

export function PageMeasurer({ runtime, children }: { runtime: Runtime; children: ReactNode }) {
  const value = useMemo(() => measurer((measured) => runtime.runFork(Effect.flatMap(Effect.service(PageHost), (host) => host.measure(measured)))), [runtime]);
  const listen = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    moves.forEach((name) => window.addEventListener(name, value.measure, true));
    const drawn = runtime.runFork(Effect.flatMap(Effect.service(PageLayers), (layers) =>
      Stream.runForEach(Stream.changesWith(Stream.map(layers.changes, (l) => l.drawn), sameRects), (rects) => Effect.sync(() => value.drawn(rects)))));
    return () => {
      moves.forEach((name) => window.removeEventListener(name, value.measure, true));
      drawn.interruptUnsafe();
    };
  }, [runtime, value]);
  return <MeasurerContext value={value}><div ref={listen} className="contents">{children}</div></MeasurerContext>;
}

function useMeasurer() {
  const value = use(MeasurerContext);
  if (!value) throw new Error("outside PageMeasurer");
  return value;
}

export function PageArea({ className }: { className?: string }) {
  const measurer = useMeasurer();
  const ref = useCallback((element: HTMLDivElement | null) => element ? measurer.page(element) : undefined, [measurer]);
  return <div ref={ref} aria-hidden className={cn("pointer-events-none", className)} />;
}

export type OverPageProps = Omit<ComponentProps<"div">, "children"> & { children?: ReactNode | ((drawn: boolean) => ReactNode) };

/** @model spec/app/surface.md */
export function OverPage({ className, children, ...props }: OverPageProps) {
  const measurer = useMeasurer();
  const [drawn, setDrawn] = useState(false);
  const ref = useCallback((element: HTMLDivElement | null) => element ? measurer.control(element, setDrawn) : undefined, [measurer]);
  return <div ref={ref} inert={!drawn} className={cn(!drawn && "invisible", className)} {...props}>{typeof children === "function" ? children(drawn) : children}</div>;
}

export function PageBackdrop({ className }: { className?: string }) {
  const layer = usePageLayer();
  const { bottomLeft: r } = useMeasurer().corners();
  const page = layer?.shown ? layer.page : undefined;
  const hole = page && `M${page.x} ${page.y}H${page.x + page.width}V${page.y + page.height - r}A${r} ${r} 0 0 1 ${page.x + page.width - r} ${page.y + page.height}H${page.x + r}A${r} ${r} 0 0 1 ${page.x} ${page.y + page.height - r}Z`;
  return <div aria-hidden className={className} style={hole ? { clipPath: `path(evenodd, "M0 0H100000V100000H0Z${hole}")` } : undefined} />;
}

// spec/app/surface.md, "Story: Use the website under Grace's controls"; spec/app/surface.md, "A Grace control is drawn over the page only after the host routes its rect to Grace"; spec/app/surface.md, "The page fills the rect the interface measured for it"
import tokens from "@repo/design-system/tokens.json" with { type: "json" };
import { cn } from "@repo/ui";
import { Effect } from "effect";
import { type ComponentProps, type ReactNode, createContext, use, useCallback, useMemo, useState } from "react";
import { PageHost, Part } from "./page.vibe";
import { type Runtime, usePageLayer } from "./useApp.ts";
import { websites } from "./webPage.vibe";

type Watch = (element: HTMLElement, part: Part) => () => void;
const WatchContext = createContext<Watch | null>(null);

export function PageMeasurer({ runtime, children }: { runtime: Runtime; children: ReactNode }) {
  const watch = useMemo<Watch>(() => (element, part) => {
    runtime.runFork(Effect.flatMap(Effect.service(PageHost), (host) => host.watch(element, part)));
    return () => { runtime.runFork(Effect.flatMap(Effect.service(PageHost), (host) => host.unwatch(element))); };
  }, [runtime]);
  return <WatchContext value={watch}>{children}</WatchContext>;
}

export function useWatch(part: Part) {
  const watch = use(WatchContext);
  if (!watch) throw new Error("outside PageMeasurer");
  return useCallback((element: HTMLElement | null) => element ? watch(element, part) : undefined, [watch, part]);
}

const area = Part.Area();

export function PageArea({ className }: { className?: string }) {
  return <div ref={useWatch(area)} aria-hidden className={className} />;
}

/** @model spec/app/surface.md */
export function OverPage({ className, ...props }: ComponentProps<"div">) {
  const [drawn, setDrawn] = useState(false);
  const ref = useWatch(useMemo(() => Part.Control({ show: setDrawn }), []));
  return <div ref={ref} inert={!drawn} className={cn("pointer-events-auto", !drawn && "invisible", className)} {...props} />;
}

const r = parseFloat(tokens.rounded.window);

const adopt = (element: HTMLDivElement | null) => { element?.append(websites); };

export function PageBackdrop({ className }: { className?: string }) {
  const layer = usePageLayer();
  const page = layer?.shown ? layer.page : undefined;
  const hole = page && `M${page.x} ${page.y}H${page.x + page.width}V${page.y + page.height - r}A${r} ${r} 0 0 1 ${page.x + page.width - r} ${page.y + page.height}H${page.x + r}A${r} ${r} 0 0 1 ${page.x} ${page.y + page.height - r}Z`;
  return (
    <>
      <div aria-hidden className={className} style={hole ? { clipPath: `path(evenodd, "M0 0H100000V100000H0Z${hole}")` } : undefined} />
      <div ref={adopt} className="contents" />
    </>
  );
}

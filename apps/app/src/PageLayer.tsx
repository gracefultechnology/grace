// spec/app/surface.md, "Story: Use the website under Grace's controls"; spec/app/surface.md, "A Grace control is drawn over the page only after the host routes its rect to Grace"; spec/app/surface.md, "The page fills the rect the interface measured for it"
import tokens from "@repo/design-system/tokens.json" with { type: "json" };
import { cn, settles } from "@repo/ui";
import { Effect } from "effect";
import { type ComponentProps, type ReactNode, createContext, memo, use, useCallback, useMemo, useSyncExternalStore } from "react";
import type { PageLayer } from "../gen/app__surface.ts";
import { PageHost, Part } from "./page.vibe";
import { androidHost } from "./surfacePlugin.ts";
import { type Runtime, usePageLayerSelector } from "./useApp.ts";
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

function createControlStore() {
  let drawn = false;
  let listener: (() => void) | undefined;
  return {
    part: Part.Control({
      show: (next: boolean) => {
        if (drawn === next) return;
        drawn = next;
        listener?.();
      },
    }),
    subscribe: (notify: () => void) => {
      listener = notify;
      return () => { if (listener === notify) listener = undefined; };
    },
    get: () => drawn,
  };
}

/** @model spec/app/surface.md */
export function OverPage({ className, ...props }: ComponentProps<"div">) {
  const store = useMemo(() => createControlStore(), []);
  const drawn = useSyncExternalStore(store.subscribe, store.get, store.get);
  const ref = useWatch(store.part);
  return <div ref={ref} inert={!drawn} className={cn(settles, "pointer-events-auto", !drawn && "invisible", className)} {...props} />;
}

const r = parseFloat(tokens.rounded.window);

const adopt = (element: HTMLDivElement | null) => { element?.append(websites); };

const selectHole = (layer: PageLayer | undefined): string | undefined => {
  const page = androidHost && layer?.shown ? layer.page : undefined;
  if (!page) return undefined;
  return `M${page.x} ${page.y}H${page.x + page.width}V${page.y + page.height - r}A${r} ${r} 0 0 1 ${page.x + page.width - r} ${page.y + page.height}H${page.x + r}A${r} ${r} 0 0 1 ${page.x} ${page.y + page.height - r}Z`;
};

export const PageBackdrop = memo(function PageBackdrop({ className }: { className?: string }) {
  const hole = usePageLayerSelector(selectHole);
  return (
    <>
      <div aria-hidden className={className} style={hole ? { clipPath: `path(evenodd, "M0 0H100000V100000H0Z${hole}")` } : undefined} />
      <div ref={adopt} className="contents" />
    </>
  );
});

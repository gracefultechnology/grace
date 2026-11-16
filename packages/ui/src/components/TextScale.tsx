import { useLayoutEffect, useRef, type ComponentProps } from "react";
import { cn } from "../lib/cn.ts";

export type TextScaleProps = ComponentProps<"div"> & {
  /** Every word's size, in percent of the size it is drawn at: 90 Smaller, 100 Normal, 115 Larger, 130 Largest. */
  percent: number;
};

const zoomed = "[data-text-zoom]";
const kept = `${zoomed} *, [data-text-fixed], [data-text-fixed] *, svg *`;

function scale(el: Element, k: number, root: boolean) {
  const all = [el, ...el.querySelectorAll("*")].filter((e): e is HTMLElement => e instanceof HTMLElement && !e.matches(kept));
  const found = all.map((e) => {
    if (e.dataset.bfs || e.matches(zoomed)) return e;
    if (k === 1) return null;
    const cs = getComputedStyle(e);
    const parent = e.parentElement;
    const fs = parseFloat(cs.fontSize);
    if (!(e === el && root) && parent && Math.abs(fs - parseFloat(getComputedStyle(parent).fontSize)) < 0.01) return null;
    e.dataset.bfs = String(fs);
    if (cs.lineHeight.endsWith("px")) e.dataset.blh = String(parseFloat(cs.lineHeight));
    return e;
  });
  for (const e of found) {
    if (!e) continue;
    if (e.matches(zoomed)) {
      e.style.setProperty("zoom", String(k));
      continue;
    }
    e.style.setProperty("font-size", `${(Number(e.dataset.bfs) * k).toFixed(2)}px`, "important");
    if (e.dataset.blh) e.style.setProperty("line-height", `${(Number(e.dataset.blh) * k).toFixed(2)}px`);
  }
}

function forget(el: HTMLElement) {
  for (const e of [el, ...el.querySelectorAll<HTMLElement>("[data-bfs]")]) {
    e.style.removeProperty("font-size");
    e.style.removeProperty("line-height");
    delete e.dataset.bfs;
    delete e.dataset.blh;
  }
}

/**
 * Scales every word inside it by the Text size setting: each element's font size and line height, Home, the rail,
 * apps and Grace's messages alike, while their boxes keep their size. Wraps a `TabletScreen`'s content without a box
 * of its own.
 * @model spec/app/preferences.md
 * @design packages/design-system/design.md
 */
export function TextScale({ percent, className, children, ...props }: TextScaleProps) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const k = percent / 100;
    scale(root, k, true);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "attributes" && record.target instanceof HTMLElement && record.target !== root) {
          forget(record.target);
          scale(record.target, k, false);
        }
        for (const node of record.addedNodes) if (node instanceof Element) scale(node, k, false);
      }
    });
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [percent]);
  return (
    <div ref={ref} className={cn("contents", className)} {...props}>
      {children}
    </div>
  );
}

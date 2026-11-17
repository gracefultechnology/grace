import { useCallback, useState } from "react";

type Size = { width: number; height: number };

export function useSize<T extends Element>() {
  const [size, setSize] = useState<Size>();
  const ref = useCallback((element: T | null) => {
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry?.borderBoxSize[0];
      if (box) setSize({ width: box.inlineSize, height: box.blockSize });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

export function watch(element: Element, changed: () => void) {
  changed();
  const resize = new ResizeObserver(changed);
  const mutation = new MutationObserver(changed);
  resize.observe(element);
  mutation.observe(element, { childList: true, subtree: true, characterData: true });
  return () => {
    resize.disconnect();
    mutation.disconnect();
  };
}

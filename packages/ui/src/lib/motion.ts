import { useSyncExternalStore } from "react";
import tokens from "@repo/design-system/tokens.json" with { type: "json" };

const { duration, ease } = tokens.motion;
const reduced = "(prefers-reduced-motion: reduce)";

const subscribe = (change: () => void) => {
  const query = matchMedia(reduced);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
};

const prefersStill = () => matchMedia(reduced).matches;

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersStill, () => false);
}

type Pace = { duration: keyof typeof duration; ease: keyof typeof ease; fill?: FillMode };

export function play(element: Element, keyframes: Keyframe[], pace: Pace): Animation | undefined {
  if (prefersStill()) return undefined;
  return element.animate(keyframes, { duration: parseFloat(duration[pace.duration]), easing: ease[pace.ease], fill: pace.fill ?? "none" });
}

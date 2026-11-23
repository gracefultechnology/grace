import tokens from "@repo/design-system/tokens.json" with { type: "json" };

const { duration, ease } = tokens.motion;
const reduced = "(prefers-reduced-motion: reduce)";

type Pace = { duration: keyof typeof duration; ease: keyof typeof ease };

export function play(element: Element, keyframes: Keyframe[], pace: Pace): Animation | undefined {
  if (matchMedia(reduced).matches) return undefined;
  return element.animate(keyframes, { duration: parseFloat(duration[pace.duration]), easing: ease[pace.ease] });
}

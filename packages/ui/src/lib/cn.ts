import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import tokens from "@repo/design-system/tokens.json" with { type: "json" };

const groups: Record<string, unknown> = tokens;
const names = (group: string) => Object.keys(groups[group] ?? {});
const twMerge = extendTailwindMerge({
  extend: {
    theme: { text: names("text"), radius: names("rounded"), shadow: names("shadow"), blur: names("blur"), animate: names("animate") },
    classGroups: {
      duration: [{ duration: Object.keys(tokens.motion.duration) }],
      ease: [{ ease: Object.keys(tokens.motion.ease) }],
    },
  },
});

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const focusRing = "outline-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-solid focus-visible:outline-ring";

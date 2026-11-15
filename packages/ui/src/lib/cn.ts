import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import tokens from "@repo/design-system/tokens.json" with { type: "json" };

// The design tokens' own scales (packages/design-system/tokens.json), so `text-body` is a size, not a color.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: Object.keys(tokens.text),
      radius: Object.keys(tokens.rounded),
      shadow: Object.keys(tokens.shadow),
      blur: Object.keys(tokens.blur),
      animate: Object.keys(tokens.animate),
    },
    // So a later `duration-[180ms]` replaces a token's `duration-slow` (GraceCursor over GraceMark).
    classGroups: {
      duration: [{ duration: Object.keys(tokens.motion.duration) }],
      ease: [{ ease: Object.keys(tokens.motion.ease) }],
    },
  },
});

/** Joins class names; a later Tailwind utility replaces an earlier one it conflicts with. */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

/** The ring every control shows under keyboard focus: prototype `.screen :focus-visible`, a 3px outline 3px out. */
export const focusRing = "outline-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-solid focus-visible:outline-ring";

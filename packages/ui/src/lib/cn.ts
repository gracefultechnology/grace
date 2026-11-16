import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import tokens from "@repo/design-system/tokens.json" with { type: "json" };

// The token groups that name utilities (vibestack/design/generate.ts), so a later `text-body` replaces a
// size and not a color. Each group is optional in tokens.json.
const groups: Record<string, unknown> = tokens;
const names = (group: string) => Object.keys(groups[group] ?? {});
const twMerge = extendTailwindMerge({
  extend: {
    theme: { text: names("text"), radius: names("rounded"), shadow: names("shadow"), blur: names("blur"), animate: names("animate") },
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

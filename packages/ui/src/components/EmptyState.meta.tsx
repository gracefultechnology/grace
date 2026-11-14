import type { ComponentMeta } from "vibestack/stories";
import type { EmptyStateProps } from "./EmptyState.tsx";

export const meta: ComponentMeta<EmptyStateProps> = {
  // An empty email folder.
  args: { title: "Nothing here." },
  examples: { "No results": { title: "Nothing found. Try another word." } },
  decorator: (story) => <div className="w-[840px] bg-background p-6">{story()}</div>,
};

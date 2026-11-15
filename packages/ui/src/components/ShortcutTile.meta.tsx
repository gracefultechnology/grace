import { Ellipsis } from "lucide-react";
import { fn } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { ShortcutTileProps } from "./ShortcutTile.tsx";

export const meta: ComponentMeta<ShortcutTileProps> = {
  args: { label: "City Water", onClick: fn(), onHold: fn() },
  decorator: (story) => <div className="bg-gradient-frame p-8">{story()}</div>,
  examples: {
    New: { label: "Pharmacy", tag: "New" },
    "Needs repair": { label: "Pharmacy", tag: "Needs repair", tagTone: "warn" },
    More: { label: "More shortcuts", icon: <Ellipsis size={30} strokeWidth={2} aria-hidden />, onHold: undefined },
  },
};

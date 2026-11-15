import { useRef, type ComponentProps, type ReactNode } from "react";
import { Globe } from "lucide-react";
import { cn, focusRing } from "../lib/cn.ts";

export type ShortcutTileProps = Omit<ComponentProps<"button">, "children"> & {
  /** The shortcut's name: "City Water". */
  label: string;
  /** Its mark; a globe by default. "More shortcuts" passes its own. */
  icon?: ReactNode;
  /** A word on its corner: "New", or "Needs repair" when its address no longer opens. */
  tag?: string;
  /** The tag warns, as for "Needs repair". */
  tagTone?: "new" | "warn";
  /** Called by holding the tile: change or remove it. */
  onHold?: () => void;
};

const HOLD_MS = 600;

/**
 * A website Margaret saved to Home, opened by a tap and changed by holding it (senior-care ShortcutManager.tsx,
 * homeShortcutTiles), on the compact launcher card's glass.
 * @design packages/design-system/design.md#home
 */
export function ShortcutTile({ label, icon = <Globe size={30} strokeWidth={2} aria-hidden />, tag, tagTone = "new", onHold, className, ...props }: ShortcutTileProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const heldRef = useRef(false);
  const release = () => clearTimeout(timerRef.current);
  return (
    <button
      type="button"
      onPointerDown={() => {
        heldRef.current = false;
        if (onHold) timerRef.current = setTimeout(() => ((heldRef.current = true), onHold()), HOLD_MS);
      }}
      onPointerUp={release}
      onPointerLeave={release}
      onClickCapture={(event) => {
        if (heldRef.current) event.stopPropagation();
      }}
      onContextMenu={(event) => {
        if (!onHold) return;
        event.preventDefault();
        onHold();
      }}
      className={cn(
        focusRing,
        "relative flex h-[140px] w-[200px] cursor-pointer flex-col items-start justify-between rounded-card bg-glass/40 p-5 text-left font-sans text-foreground shadow-launcher transition-transform duration-press ease-spring active:scale-[1.02] motion-reduce:active:scale-100",
        className,
      )}
      {...props}
    >
      <span className="text-primary">{icon}</span>
      <span className="text-body-lg leading-[30px] font-bold">{label}</span>
      {tag && (
        <span className={cn("absolute top-4 right-4 rounded-tag px-2 text-caption leading-6 font-bold", tagTone === "warn" ? "bg-warn/12 text-warn" : "bg-primary/10 text-primary")}>{tag}</span>
      )}
    </button>
  );
}

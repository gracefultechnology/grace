import type { ComponentProps } from "react";
import { Undo2 } from "lucide-react";
import { cn, focusRing } from "../lib/cn.ts";

export type ToastProps = ComponentProps<"div"> & {
  /** Shown; it fades out when false. */
  open?: boolean;
  /** Offers to take back what was just done, with an Undo button. */
  onUndo?: () => void;
  /** The Undo button's words. */
  undoLabel?: string;
};

/**
 * A short dark note of what just happened, centered 24px above the bottom of the screen (prototype `.axtoast`).
 * @model spec/app/surface.md
 * @design packages/design-system/design.md#windows
 */
export function Toast({ open = true, onUndo, undoLabel = "Undo", className, children, ...props }: ToastProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex w-max items-center gap-[18px] rounded-tile bg-chrome px-5 py-3 text-body text-primary-foreground transition-opacity duration-slow",
        open ? "opacity-100" : "pointer-events-none opacity-0",
        className,
      )}
      {...props}
    >
      {children}
      {onUndo && (
        <button type="button" onClick={onUndo} className={cn(focusRing, "inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-full bg-glass/14 px-3.5 text-body font-bold text-frame-lilac")}>
          <Undo2 aria-hidden size={20} strokeWidth={2.4} />
          {undoLabel}
        </button>
      )}
    </div>
  );
}

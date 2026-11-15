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
  /** `screen` centers it 24px above the bottom of a `TabletScreen`, over the windows; `inline` leaves it in the flow. */
  placement?: "inline" | "screen";
  /** Compact Grace's window height while she is open: the toast rises to sit 24px above it instead of the screen's bottom. */
  above?: number;
};

/**
 * A short dark note of what just happened, centered 24px above the bottom of the screen (prototype `.axtoast`).
 * @model spec/app/surface.md
 * @design packages/design-system/design.md#windows
 */
export function Toast({ open = true, onUndo, undoLabel = "Undo", placement = "inline", above, className, style, children, ...props }: ToastProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex w-max items-center gap-[18px] rounded-tile bg-chrome px-5 py-3 font-sans text-body leading-[normal] text-primary-foreground transition-opacity duration-quick ease-css-default",
        // Prototype `.axtoast`, appended to `#screen`.
        placement === "screen" && "absolute bottom-6 left-1/2 z-[45] -translate-x-1/2",
        open ? "opacity-100" : "pointer-events-none opacity-0",
        className,
      )}
      // Prototype `axToast()`: `bottom` is Grace's window height + 24 while she is open and compact.
      style={above === undefined ? style : { bottom: above + 24, ...style }}
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

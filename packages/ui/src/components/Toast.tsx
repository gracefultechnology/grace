import type { ComponentProps, ReactNode } from "react";
import { Undo2, X } from "lucide-react";
import { cn, focusRing } from "../lib/cn.ts";

export type ToastProps = ComponentProps<"div"> & {
  /** Shown; it fades out when false. */
  open?: boolean;
  /** Offers to take back what was just done, with an Undo button. */
  onUndo?: () => void;
  /** The Undo button's words. */
  undoLabel?: string;
  /** Offers to put away what it tells, such as a due reminder, with a Dismiss button. */
  onDismiss?: () => void;
  /** The Dismiss button's words. */
  dismissLabel?: string;
  /** `screen` centers it 24px above the bottom of a `TabletScreen`, over the windows; `inline` leaves it in the flow. */
  placement?: "inline" | "screen";
  /** Compact Grace's window height while she is open: the toast rises to sit 24px above it instead of the screen's bottom. */
  above?: number;
};

/**
 * A short dark note of what just happened, or of a reminder that is due, centered 24px above the bottom of the screen,
 * with Undo or Dismiss when offered (prototype `.axtoast`).
 * @model spec/app/surface.md
 * @design packages/design-system/design.md#windows
 */
export function Toast({ open = true, onUndo, undoLabel = "Undo", onDismiss, dismissLabel = "Dismiss", placement = "inline", above, className, style, children, ...props }: ToastProps) {
  return (
    <div
      role="status"
      inert={!open}
      aria-hidden={!open || undefined}
      className={cn(
        "flex w-max items-center gap-[18px] rounded-tile bg-chrome px-5 py-3 font-sans text-body leading-[normal] text-primary-foreground transition-opacity duration-quick ease-css-default",
        placement === "screen" && "absolute bottom-6 left-1/2 z-[25] -translate-x-1/2",
        open ? "opacity-100" : "pointer-events-none opacity-0",
        className,
      )}
      style={above === undefined ? style : { bottom: above + 24, ...style }}
      {...props}
    >
      {children}
      {onUndo && <ToastAction onClick={onUndo} icon={<Undo2 aria-hidden size={20} strokeWidth={2.4} />} label={undoLabel} />}
      {onDismiss && <ToastAction onClick={onDismiss} icon={<X aria-hidden size={20} strokeWidth={2.4} />} label={dismissLabel} />}
    </div>
  );
}

function ToastAction({ onClick, icon, label }: { onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button type="button" onClick={onClick} className={cn(focusRing, "inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-full bg-glass/14 px-3.5 text-body font-bold text-frame-lilac")}>
      {icon}
      {label}
    </button>
  );
}

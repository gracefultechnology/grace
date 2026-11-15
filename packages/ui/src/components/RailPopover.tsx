import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";

export type RailPopoverProps = Omit<ComponentProps<"div">, "title"> & {
  /** The 30px icon before the title: `<Volume2 size={30} strokeWidth={2} />`. */
  icon: ReactNode;
  /** What the popover controls: "Volume", "Wi-Fi". */
  title: string;
  /** Its state beside the title: "60%", "Muted", "Connected". */
  value?: string;
  /** The ✕ in the header. */
  onClose?: () => void;
  /** The ✕'s accessible name. */
  closeLabel?: string;
  /** One line explaining what it affects, under the controls. */
  note?: ReactNode;
  /** The buttons at the bottom. */
  actions?: ReactNode;
  /** Distance in pixels from the top of the screen: 30px above the rail button it belongs to. */
  top?: number;
  /** Where the arrow points, in pixels from the popover's top: the middle of its rail button. */
  arrowTop?: number;
};

/**
 * A popover opening to the right of a rail button, for Volume or Wi-Fi: a header with the state and ✕, then the
 * controls (children), a note and buttons. Wi-Fi shows spec/app/network.md.
 * @model spec/app/preferences.md
 * @design packages/design-system/design.md#glass
 */
export function RailPopover({ icon, title, value, onClose, closeLabel = "Close", note, actions, top, arrowTop = 58, className, style, children, ...props }: RailPopoverProps) {
  // Prototype `.rpop` (line 506) and `drawPop()`: Grace's menu glass, 156px from the screen's left edge.
  return (
    <div
      role="dialog"
      aria-label={title}
      className={cn("absolute left-[156px] z-[200] box-border w-[560px] rounded-menu bg-glass/95 p-6 font-sans text-foreground shadow-menu backdrop-blur-frost backdrop-saturate-160", className)}
      style={{ top, "--arrow": `${arrowTop}px`, ...style } as CSSProperties}
      {...props}
    >
      {/* `.rpop::before`: the arrow toward the rail. */}
      <span aria-hidden className="absolute top-(--arrow) -left-2.5 size-5 rotate-45 bg-glass/86 shadow-arrow" />
      <div className="relative flex items-center gap-3 text-title-sm leading-8 font-bold text-chrome">
        <span aria-hidden className="flex">{icon}</span>
        {title}
        {value && <span className="ml-3 text-body-lg leading-7 font-semibold text-muted-foreground">{value}</span>}
        <span className="flex-1" />
        {onClose && (
          // `.rpx`: a 52px capsule, pulled into the header's padding.
          <Button variant="capsule" size="compact-icon" aria-label={closeLabel} onClick={onClose} className="-my-2 -mr-1.5 size-13 text-chrome backdrop-blur-none backdrop-saturate-100 transition-none active:scale-96">
            <X size={22} strokeWidth={2} aria-hidden />
          </Button>
        )}
      </div>
      {children}
      {note ? <div className={cn("text-body leading-[26px] font-medium text-muted-foreground", children ? "mt-4" : "mt-3")}>{note}</div> : null}
      {actions ? <div className="mt-[18px] flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

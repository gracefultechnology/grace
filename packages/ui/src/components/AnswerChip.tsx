import { useLayoutEffect, useRef, useState, type ComponentProps } from "react";
import { bubbleOutline } from "../lib/outline.ts";
import { cn, focusRing } from "../lib/cn.ts";

export type AnswerChipProps = Omit<ComponentProps<"button">, "ref" | "type">;

/**
 * An answer Margaret can tap: her words not yet said, a dashed outline of her bubble in her ink (prototype `.uchip`).
 * Tapped, it fills in and becomes her sent message.
 * @model spec/app/conversation.md
 * @design packages/design-system/design.md#grace
 */
export function AnswerChip({ className, children, ...props }: AnswerChipProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const [size, setSize] = useState<[number, number]>();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setSize([el.offsetWidth, el.offsetHeight]));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <button
      type="button"
      className={cn(
        focusRing,
        "group/chip relative isolate mr-2 h-[52px] shrink-0 cursor-pointer rounded-window bg-transparent px-8 text-lead leading-8 font-medium whitespace-nowrap text-user-ink transition-transform duration-press ease-spring active:scale-97 motion-reduce:active:scale-100",
        className,
      )}
      {...props}
      ref={ref}
    >
      {size && (
        <svg aria-hidden width={size[0] + 10} height={size[1] + 2} viewBox={`0 0 ${size[0] + 10} ${size[1] + 2}`} className="pointer-events-none absolute top-0 left-0 z-0 overflow-visible">
          {/* .uchip .dash path; on the frosted window a half-white fill; tapped (.uchip:active) it fills in solid. */}
          <path
            d={bubbleOutline(...size, size[1] / 2, 1)}
            className="fill-none stroke-user-ink/70 stroke-2 [stroke-dasharray:12_7] [stroke-linecap:round] [stroke-linejoin:round] group-active/chip:fill-user-ink group-active/chip:stroke-user-ink group-active/chip:[stroke-dasharray:none] group-data-[surface=frost]/grace:fill-glass/50"
          />
        </svg>
      )}
      <span className="relative z-[1] group-active/chip:text-primary-foreground">{children}</span>
    </button>
  );
}

export type AnswerChipsProps = ComponentProps<"div"> & {
  /** Steps the answers back while Margaret is talking (prototype `.sugg.fade`). */
  faded?: boolean;
};

/** The row of two or three answers under the question that asked, read from the right (prototype `.sugg`). */
export function AnswerChips({ faded = false, className, ...props }: AnswerChipsProps) {
  return (
    <div
      data-answers=""
      className={cn("flex flex-none flex-wrap justify-end gap-4 transition-opacity duration-base", faded && "pointer-events-none opacity-0", className)}
      {...props}
    />
  );
}

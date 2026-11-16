import { useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Check, Keyboard, X } from "lucide-react";
import { bubbleOutline, bubbleTail } from "../lib/outline.ts";
import { cn, focusRing } from "../lib/cn.ts";
import { Button } from "./Button.tsx";
import { Spinner } from "./Spinner.tsx";

const edges = { turn: "stroke-guide", ok: "stroke-ok" } as const;

const markBox = "relative flex size-8 flex-none items-center justify-center rounded-full";
const marks = {
  grace: (
    <span className={cn(markBox, "bg-gradient-ring")}>
      <b className="flex size-[27px] items-center justify-center rounded-full bg-glass text-caption leading-[normal] font-bold text-primary">G</b>
    </span>
  ),
  keyboard: <span className={cn(markBox, "bg-key-mark text-primary")}><Keyboard size={20} strokeWidth={2} /></span>,
  done: <span className={cn(markBox, "bg-ok text-glass")}><Check size={18} strokeWidth={3} /></span>,
  working: <span className={markBox}><Spinner size="lg" aria-hidden className="text-glass [&_circle]:[stroke-opacity:.35]" /></span>,
  paused: (
    <span className={cn(markBox, "bg-glass/16 text-glass")}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
    </span>
  ),
} satisfies Record<string, ReactNode>;

const defaultMark = { turn: "grace", ok: "done", working: "working" } as const;

export type GuideLabelProps = Omit<ComponentProps<"div">, "title"> & {
  /** What to do, or what Grace is showing: "Tap Pay card". */
  title: string;
  /** A second line, such as the date a balance is due. */
  detail?: string;
  /** `turn`: your turn, in Grace's bright violet; `working`: Grace is doing it, filled violet; `ok`: done, in green. */
  tone?: "turn" | "working" | "ok";
  /** The sign before the words; by default Grace's G for `turn`, a check for `ok` and a spinner for `working`. */
  mark?: keyof typeof marks;
  /**
   * `beside` the target, its tail at the bottom-left pointing back at it; `below` it, the tail at the top-left pointing up;
   * `below-end` under a target at the right edge, the tail at the top-right.
   */
  placement?: "beside" | "below" | "below-end";
  /** The words are a button, as the label of a field to type in is (prototype `.glab.tap`): tapping it opens the keyboard. */
  selectable?: boolean;
  /** Called by a tap on the words of a `selectable` label. */
  onSelect?: () => void;
  /** Offers the ghost close (prototype `.glab .glx`), which dismisses the label and its ring; never on a `working` label. */
  closable?: boolean;
  /** Called by the close button. */
  onClose?: () => void;
  /** The close button's accessible name. */
  closeLabel?: string;
};

/**
 * Grace's label beside the thing she points at: a speech bubble whose tail points back at it.
 * @model spec/app/execution.md
 * @design packages/design-system/design.md#guidance
 */
export function GuideLabel({ title, detail, tone = "turn", mark, placement = "beside", selectable = false, onSelect, closable = false, onClose, closeLabel = "Close this tip", className, ...props }: GuideLabelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const Words = selectable ? "button" : "div";
  const [size, setSize] = useState<[number, number]>();
  const working = tone === "working";
  const below = placement !== "beside";
  const end = placement === "below-end";
  useLayoutEffect(() => {
    const el = ref.current;
    if (working || !el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setSize([el.offsetWidth, el.offsetHeight]));
    observer.observe(el);
    return () => observer.disconnect();
  }, [working]);
  return (
    <div
      ref={ref}
      className={cn(
        "pointer-events-none relative w-max max-w-[420px] rounded-window p-[3px] font-sans animate-label-in motion-reduce:animate-none",
        selectable && "pointer-events-auto cursor-pointer",
        below ? (end ? "rounded-tr-none" : "rounded-tl-none") : "rounded-bl-none",
        working
          ? "z-2 bg-guide text-glass shadow-tag [animation-duration:.25s]"
          : "text-grace-ink drop-shadow-label [animation-delay:.25s]",
        className,
      )}
      onClick={selectable ? onSelect : undefined}
      {...props}
    >
      {working ? (
        <svg aria-hidden width="34" height={below ? 34 : 26} viewBox={below ? "0 0 34 34" : "0 0 34 26"} className={cn("absolute overflow-visible fill-guide", below ? (end ? "top-0 right-0 -scale-x-100" : "top-0 left-0") : "bottom-[3px] -left-[5px] stroke-guide")}>
          <path d={bubbleTail} strokeWidth={6} strokeLinejoin="round" transform={below ? "matrix(0 1 -1 0 26 -8)" : undefined} />
        </svg>
      ) : (
        size && (
          <svg aria-hidden width={size[0] + 10} height={size[1]} viewBox={`0 0 ${size[0] + 10} ${size[1]}`} className={cn("pointer-events-none absolute top-0 overflow-visible", end ? "left-0 -scale-y-100" : cn("-left-2.5", below ? "-scale-100" : "-scale-x-100"))}>
            <path d={bubbleOutline(...size, Math.min(size[1] / 2, 26), 1.5)} className={cn("fill-glass stroke-3", edges[tone])} strokeLinejoin="round" />
          </svg>
        )
      )}
      <div className={cn("relative flex gap-3 pr-[19px] pl-[15px]", working ? "items-start pt-[13px] pb-[15px]" : "items-center py-3.5")}>
        <Words
          {...(selectable && { type: "button" })}
          className={cn("relative flex gap-3 text-left", working ? "items-start" : "items-center", selectable && cn(focusRing, "flex-1 self-stretch cursor-pointer rounded-sm"))}
        >
          <span aria-hidden className="relative flex">{marks[mark ?? defaultMark[tone]]}</span>
          <span className="relative">
            <span className="block text-lead leading-8 font-semibold">{title}</span>
            {detail && <span className="mt-0.5 block text-lead leading-8 font-medium text-subtle">{detail}</span>}
          </span>
        </Words>
        {closable && !working && (
          <Button variant="plain" aria-label={closeLabel} onClick={(event) => { event.stopPropagation(); onClose?.(); }} className="pointer-events-auto relative -my-2.5 -mr-4 ml-1 size-11 cursor-pointer p-0 text-guide-close transition-none active:bg-primary/8">
            <X size={20} strokeWidth={2.2} aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}

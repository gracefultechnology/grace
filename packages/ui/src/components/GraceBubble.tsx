import type { ComponentProps, ReactNode } from "react";
import { bubbleTail } from "../lib/outline.ts";
import { cn } from "../lib/cn.ts";
import { Spinner } from "./Spinner.tsx";
import { ThinkingDots } from "./ThinkingDots.tsx";
import { VoiceBars } from "./VoiceBars.tsx";

export type GraceBubbleProps = Omit<ComponentProps<"div">, "children"> & {
  /** What Grace has said so far, in full ink. */
  children?: ReactNode;
  /** The rest of her reply, not yet spoken, in pale ink after what she has said. */
  rest?: string;
  /** What she is doing beside her words: voice bars while `speaking`, dots while `thinking`, a spinner while `working`. */
  activity?: "speaking" | "thinking" | "working";
  /** What the dots or spinner mean, for assistive technology. */
  activityLabel?: string;
  /** Why her words end early, such as "Paused" or "Interrupted", after a dash. */
  stopped?: string;
};

/**
 * One of Grace's messages: her lilac bubble with a tail on the left (prototype `.gb` in `.chat-white`, `TAIL_L`).
 * While she speaks, what she has said is dark and the rest pale.
 * @model spec/app/conversation.md
 * @design packages/design-system/design.md#grace
 */
export function GraceBubble({ rest, activity, activityLabel, stopped, className, children, ...props }: GraceBubbleProps) {
  const words = children != null || !!rest || !!stopped;
  return (
    <div className={cn("flex", className)} {...props}>
      {/* .gb: on the frosted window her bubble is white and lifted. */}
      <div className="relative isolate ml-2 inline-flex max-w-[940px] items-start gap-3 rounded-window bg-bubble px-8 py-2.5 text-lead leading-8 font-medium [overflow-wrap:anywhere] text-grace-ink group-data-[surface=frost]/grace:bg-card group-data-[surface=frost]/grace:shadow-float">
        <svg aria-hidden width="34" height="26" viewBox="0 0 34 26" className="absolute bottom-0 -left-2 -z-10 fill-bubble group-data-[surface=frost]/grace:fill-card">
          <path d={bubbleTail} />
        </svg>
        {activity === "speaking" && <VoiceBars />}
        {activity === "thinking" && <ThinkingDots label={activityLabel} />}
        {activity === "working" && (
          <span className="flex h-8 w-[25px] flex-none items-center justify-center">
            <Spinner label={activityLabel ?? "Grace is working on it"} />
          </span>
        )}
        {words && (
          // Her words stay selectable under the app's select-none (apps/app/src/App.tsx).
          <span className="min-w-0 select-text">
            {children}
            {rest && <span className="text-subtle"> {rest}</span>}
            {stopped && (
              <>
                — <span className="ml-3.5 text-lead-ink italic">{stopped}</span>
              </>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

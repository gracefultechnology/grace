import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn.ts";
import { RemovedNotice } from "./GraceBubble.tsx";

export type UserBubbleProps = Omit<ComponentProps<"div">, "children"> & {
  /** What Margaret said or typed. */
  children?: ReactNode;
  /** Rises into place, for the message she has just sent. */
  rise?: boolean;
  /** Her message held something that looked private: a fixed notice in muted ink replaces its words. */
  removed?: boolean;
  /** The notice that replaces a removed message. */
  removedLabel?: string;
};

/**
 * One of Margaret's messages: dark in her ink, on the right, with a tail (prototype `.ub`, `TAIL_R`).
 * @model spec/app/conversation.md
 * @design packages/design-system/design.md#grace
 */
export function UserBubble({ rise = false, removed = false, removedLabel = "I removed something that looked private.", className, children, ...props }: UserBubbleProps) {
  return (
    <div className={cn("flex justify-end", className)} {...props}>
      <div
        className={cn(
          "relative isolate mr-2 max-w-[560px] rounded-window bg-user-ink px-8 py-2.5 text-lead leading-8 font-medium [overflow-wrap:anywhere] text-primary-foreground shadow-elevation-bubble select-text",
          removed && "bg-muted",
          rise && "animate-rise motion-reduce:animate-none",
        )}
      >
        <svg aria-hidden width="34" height="26" viewBox="0 0 34 26" className={cn("absolute -right-2 bottom-0 -z-10", removed ? "fill-muted" : "fill-user-ink")}>
          <path d="M0 0H26V12C26 18 28.6 22.8 34 26C28.5 26.6 23.6 25.4 20 22.6C17 25 13.6 26 10 26H0Z" />
        </svg>
        {removed ? <RemovedNotice label={removedLabel} /> : children}
      </div>
    </div>
  );
}

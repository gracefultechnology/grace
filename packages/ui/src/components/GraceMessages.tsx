import { useLayoutEffect, useRef, type ComponentProps, type UIEvent } from "react";
import { cn, focusRing } from "../lib/cn.ts";

// Prototype focusMsg(): in the compact window the latest message sits centred between the two toolbars (each 64px over
// the list); one taller than that gap shows its end 104px above the list's bottom. Answers keep their question where it
// was and show whole in the 70px the window grows by (sizeCompact()). Expanded, the newest is at the bottom.
function latestTop(list: HTMLElement) {
  const end = list.scrollHeight - list.clientHeight;
  let last = list.lastElementChild;
  if (!(last instanceof HTMLElement) || !list.closest("[data-size=compact]")) return end;
  let view = list.clientHeight;
  if (last.hasAttribute("data-answers")) {
    last = last.previousElementSibling;
    if (!(last instanceof HTMLElement)) return end;
    view -= 70;
  }
  const top = last.offsetHeight > view - 128 ? last.offsetTop + last.offsetHeight - (view - 104) : last.offsetTop + last.offsetHeight / 2 - view / 2;
  return Math.min(end, Math.max(0, top));
}

export type GraceMessagesProps = ComponentProps<"div"> & {
  /** Keeps the newest message in view as it arrives; false while Margaret reads earlier messages. */
  following?: boolean;
  /** Called when Margaret scrolls away from the newest message (false) or back to it (true). */
  onFollowingChange?: (following: boolean) => void;
};

/**
 * Grace's conversation, top to bottom: `GraceBubble`s, `UserBubble`s and `AnswerChips`. It scrolls under the header and
 * the answer row (prototype `.msgs`).
 * @model spec/app/conversation.md
 * @design packages/design-system/design.md#grace
 */
export function GraceMessages({ following = true, onFollowingChange, onScroll, className, ...props }: GraceMessagesProps) {
  const ref = useRef<HTMLDivElement>(null);
  // spec/app/conversation.md, "New messages do not pull the reader away from earlier messages"
  useLayoutEffect(() => {
    if (following && ref.current) ref.current.scrollTop = latestTop(ref.current);
  });
  const scrolled = (event: UIEvent<HTMLDivElement>) => {
    const list = event.currentTarget;
    const atLatest = list.scrollTop >= latestTop(list) - 4;
    if (atLatest !== following) onFollowingChange?.(atLatest);
    onScroll?.(event);
  };
  return (
    <div
      ref={ref}
      role="log"
      aria-label="Conversation"
      // A keyboard can scroll back through the conversation.
      tabIndex={0}
      onScroll={scrolled}
      className={cn(
        focusRing,
        "focus-visible:ring-inset",
        // .msgs: 88px under the header and 96 over the answer row expanded; 92 and 104 compact.
        "relative flex min-h-0 flex-1 flex-col justify-start gap-4 overflow-y-auto px-4 pt-[88px] pb-24 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "group-data-[size=compact]/grace:pt-[92px] group-data-[size=compact]/grace:pb-[104px]",
        className,
      )}
      {...props}
    />
  );
}

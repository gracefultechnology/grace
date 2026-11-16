import { useLayoutEffect, useRef, type ComponentProps, type UIEvent } from "react";
import { ArrowDown } from "lucide-react";
import { cn, focusRing } from "../lib/cn.ts";
import { Button } from "./Button.tsx";

function latestTop(list: HTMLElement) {
  const end = list.scrollHeight - list.clientHeight;
  let last = list.lastElementChild;
  if (!(last instanceof HTMLElement) || !list.closest("[data-size=compact]")) return end;
  const answers = last.hasAttribute("data-answers");
  if (answers) last = last.previousElementSibling;
  if (!(last instanceof HTMLElement)) return end;
  const height = list.clientHeight - (answers ? 70 : 0);
  const view = height - 196;
  if (last.offsetHeight <= view + 68) return Math.min(end, Math.max(0, last.offsetTop + last.offsetHeight / 2 - height / 2));
  const rest = last.querySelector("[data-rest]")?.getClientRects()[0];
  const shown = rest ? rest.top - list.getBoundingClientRect().top + list.scrollTop + 32 : last.offsetTop + last.offsetHeight;
  const top = Math.max(last.offsetTop - 92, shown - 92 - view);
  return Math.min(end, Math.max(0, top));
}

export type GraceMessagesProps = ComponentProps<"div"> & {
  /** Keeps the newest message in view as it arrives; false while Margaret reads earlier messages. */
  following?: boolean;
  /** Called when Margaret scrolls away from the newest message (false) or back to it (true). */
  onFollowingChange?: (following: boolean) => void;
  /** A message has arrived below what Margaret is reading: offers the Newest message pill while she is not following. */
  hasNewer?: boolean;
  /** Called by the Newest message pill; only this moves her to the newest message. */
  onJumpToLatest?: () => void;
  /** The words of the Newest message pill. */
  latestLabel?: string;
};

/**
 * Grace's conversation, top to bottom: `GraceBubble`s, `UserBubble`s, `GraceActionLine`s and `AnswerChips`. It scrolls
 * under the header and the answer row (prototype `.msgs`); its props go to the scrolling log.
 * @model spec/app/conversation.md
 * @design packages/design-system/design.md#grace
 */
export function GraceMessages({
  following = true,
  onFollowingChange,
  hasNewer = false,
  onJumpToLatest,
  latestLabel = "Newest message",
  onScroll,
  className,
  ...props
}: GraceMessagesProps) {
  const ref = useRef<HTMLDivElement>(null);
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
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={ref}
        role="log"
        aria-label="Conversation"
        tabIndex={0}
        onScroll={scrolled}
        className={cn(
          focusRing,
          "focus-visible:ring-inset",
          "relative flex min-h-0 flex-1 flex-col justify-start gap-4 overflow-y-auto px-4 pt-[88px] pb-24 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "group-data-[size=compact]/grace:pt-[92px] group-data-[size=compact]/grace:pb-[104px]",
          className,
        )}
        {...props}
      />
      {hasNewer && !following && (
        <Button variant="capsule" size="pill" onClick={onJumpToLatest} className="absolute bottom-20 left-1/2 z-[2] -translate-x-1/2 animate-rise motion-reduce:animate-none">
          <ArrowDown size={22} strokeWidth={2.2} aria-hidden />
          {latestLabel}
        </Button>
      )}
    </div>
  );
}

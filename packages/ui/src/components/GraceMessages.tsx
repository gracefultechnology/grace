import { useCallback, type ComponentProps, type UIEvent } from "react";
import { ArrowDown } from "lucide-react";
import { cn, focusRing } from "../lib/cn.ts";
import { watch } from "../lib/observe.ts";
import { Button } from "./Button.tsx";

function latestTop(list: HTMLElement, compact?: boolean) {
  const end = list.scrollHeight - list.clientHeight;
  const isCompact = compact ?? Boolean(list.closest("[data-size=compact]"));
  if (!isCompact) return end;
  const last = list.lastElementChild;
  if (!(last instanceof HTMLElement) || last.hasAttribute("data-answers")) return end;
  const view = list.clientHeight;
  if (last.offsetHeight <= view + 68) return Math.min(end, Math.max(0, last.offsetTop + last.offsetHeight / 2 - view / 2));
  const rest = last.querySelector("[data-rest]")?.getClientRects()[0];
  const shown = rest ? rest.top - list.getBoundingClientRect().top + list.scrollTop + 32 : last.offsetTop + last.offsetHeight;
  return Math.min(end, Math.max(0, last.offsetTop, shown - view));
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
  /** Compact window: centres a short latest message or aligns its unspoken words instead of pinning to the bottom. */
  compact?: boolean;
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
  compact,
  onScroll,
  className,
  ...props
}: GraceMessagesProps) {
  const ref = useCallback(
    (list: HTMLDivElement | null) =>
      list && following
        ? watch(list, () => {
            list.scrollTop = latestTop(list, compact);
          })
        : undefined,
    [following, compact],
  );
  const scrolled = (event: UIEvent<HTMLDivElement>) => {
    const list = event.currentTarget;
    const end = list.scrollHeight - list.clientHeight;
    const atLatest = list.scrollTop >= end - 4 || list.scrollTop >= latestTop(list, compact) - 4;
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
          "focus-visible:-outline-offset-3",
          "relative flex min-h-0 flex-1 flex-col justify-start gap-4 overflow-y-auto px-4 pt-[88px] pb-24 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "group-data-[size]/grace:py-0",
          "group-data-[size=expanded]/grace:mt-[88px] group-data-[size=expanded]/grace:mb-[max(calc(var(--spacing)*24),calc(var(--grace-dock-height,0px)_+_var(--spacing)*4))]",
          "group-data-[size=compact]/grace:mt-16 group-data-[size=compact]/grace:mb-[max(calc(var(--spacing)*26),calc(var(--grace-dock-height,0px)_+_var(--spacing)*4))]",
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

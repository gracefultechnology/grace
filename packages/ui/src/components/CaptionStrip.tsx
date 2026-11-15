import { useLayoutEffect, useRef, useState, type ComponentProps } from "react";
import { MessageSquare } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { AnswerChip, AnswerChips } from "./AnswerChip.tsx";
import { Button } from "./Button.tsx";
import { Spinner } from "./Spinner.tsx";
import { ThinkingDots } from "./ThinkingDots.tsx";
import { VoiceBars } from "./VoiceBars.tsx";

export type CaptionStripProps = Omit<ComponentProps<"div">, "children"> & {
  /** Who is talking: Grace, shown by her mark, or Margaret. */
  who?: "grace" | "you";
  /** What is being said; the latest words show when it is too long. */
  text?: string;
  /** What is happening beside the words: voice bars while `speaking` or `listening`, dots `thinking`, a spinner `working`. */
  activity?: "speaking" | "listening" | "thinking" | "working";
  /** Answers to tap after Grace's question, in place of her words. */
  answers?: string[];
  /** Called with the tapped answer. */
  onAnswer?: (answer: string) => void;
  /** Called by a tap anywhere on the strip: it brings back the chat. */
  onShowChat?: () => void;
  /** The name of Grace's mark. */
  graceLabel?: string;
  /** The word for Margaret. */
  youLabel?: string;
  showChatLabel?: string;
  /** `screen` places the strip on a `TabletScreen` over the keyboard; `inline` fills its container. */
  placement?: "screen" | "inline";
};

/**
 * The conversation as one line while Margaret types into a website: who is talking and their latest words, with Show chat
 * (prototype `.capstrip`). Voice carries the talk; the page keeps its space.
 * @model spec/app/assistant.md
 * @design packages/design-system/design.md#grace
 */
export function CaptionStrip({
  who = "grace",
  text = "",
  activity,
  answers,
  onAnswer,
  onShowChat,
  graceLabel = "Grace",
  youLabel = "You",
  showChatLabel = "Show chat",
  placement = "screen",
  className,
  ...props
}: CaptionStripProps) {
  const lineRef = useRef<HTMLSpanElement>(null);
  // Prototype tailFit(): a long line drops whole words from its start, after "… ", until its latest words fit.
  const [fit, setFit] = useState({ text, cut: 0 });
  const cut = fit.text === text ? fit.cut : 0;
  const words = text.split(/\s+/);
  useLayoutEffect(() => {
    const el = lineRef.current;
    if (el && el.scrollWidth > el.clientWidth + 1 && cut < words.length - 1) setFit({ text, cut: cut + 1 });
  }, [fit, text, cut, words.length]);
  // Fits again from the whole line when the strip's width or its font changes.
  useLayoutEffect(() => {
    const el = lineRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const refit = () => setFit((f) => ({ ...f, cut: 0 }));
    const observer = new ResizeObserver(refit);
    observer.observe(el);
    document.fonts?.addEventListener("loadingdone", refit);
    return () => {
      observer.disconnect();
      document.fonts?.removeEventListener("loadingdone", refit);
    };
  }, []);
  const grace = who === "grace" || !!answers?.length;
  return (
    // The whole strip opens the chat, like a notification banner; Show chat is its visible, focusable control.
    <div
      onClick={onShowChat}
      className={cn(
        "group/strip isolate flex h-20 cursor-pointer items-center gap-3.5 rounded-segment bg-gradient-frame pr-2 pl-6 font-sans shadow-raised inset-ring inset-ring-glass/75",
        placement === "screen" ? "absolute bottom-[312px] left-[144px] z-[4] right-1.5" : "relative w-full",
        className,
      )}
      {...props}
    >
      {/* .capstrip: Grace's washes under white at 62%, brighter while pressed. */}
      <span aria-hidden className="absolute inset-0 -z-10 rounded-segment bg-glass/62 transition-colors duration-press group-active/strip:bg-glass/82" />
      {grace ? (
        // .gmk: her small mark.
        <span role="img" aria-label={graceLabel} className="flex size-8 flex-none items-center justify-center rounded-full bg-gradient-ring">
          <span className="flex size-[27px] items-center justify-center rounded-full bg-glass text-[15px] font-bold text-primary">G</span>
        </span>
      ) : (
        <span className="flex-none text-body font-bold text-label-ink">{youLabel}</span>
      )}
      {answers?.length ? (
        <AnswerChips className="flex-1 flex-nowrap gap-3">
          {answers.map((answer) => (
            <AnswerChip
              key={answer}
              onClick={(event) => {
                event.stopPropagation();
                onAnswer?.(answer);
              }}
            >
              {answer}
            </AnswerChip>
          ))}
        </AnswerChips>
      ) : (
        <>
          {(activity === "speaking" || activity === "listening") && <VoiceBars />}
          {activity === "thinking" && <ThinkingDots />}
          {activity === "working" && (
            <span className="flex h-8 w-[25px] flex-none items-center justify-center">
              <Spinner label="Grace is working on it" />
            </span>
          )}
          <span aria-live="polite" className="sr-only">
            {text}
          </span>
          <span ref={lineRef} aria-hidden className={cn("min-w-0 flex-1 overflow-hidden text-lead leading-8 font-medium whitespace-nowrap", grace ? "text-grace-ink" : "text-user-ink")}>
            {cut ? `… ${words.slice(cut).join(" ")}` : text}
          </span>
        </>
      )}
      {/* .capstrip .pill: the toolbar's tinted glass, so it shows on the pale strip. */}
      <Button variant="glass" size="pill" className="bg-primary/8 shadow-none inset-ring inset-ring-primary/12" onClick={(event) => { event.stopPropagation(); onShowChat?.(); }}>
        <MessageSquare size={22} strokeWidth={2} aria-hidden />
        {showChatLabel}
      </Button>
    </div>
  );
}

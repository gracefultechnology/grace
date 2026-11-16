import type { ComponentProps, ReactNode } from "react";
import { Maximize2, Minimize2, X } from "lucide-react";
import { PlayIcon } from "../icons.tsx";
import { cn } from "../lib/cn.ts";
import { Button, GracePill, pillPress } from "./Button.tsx";
import { GuideShowButton } from "./GuideShowButton.tsx";

// Prototype ICON.pause and ICON.play: solid, 20px.
const pauseIcon = (
  <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
);
const playIcon = <PlayIcon className="size-5" fill="currentColor" stroke="none" />;

export type GraceCapsuleProps = ComponentProps<"div">;

/** One glass capsule of Grace's controls, such as her name with Pause and Voice, or Attach with Mic (prototype `.hgrp`). */
export function GraceCapsule({ className, ...props }: GraceCapsuleProps) {
  return (
    <div
      className={cn(
        "flex h-16 shrink-0 items-center gap-0.5 rounded-full bg-glass/62 p-1 shadow-capsule backdrop-blur-capsule backdrop-saturate-160",
        // .hgrp on the frosted window: a white rim and a soft lift, no dark edge.
        "group-data-[surface=frost]/grace:bg-glass/55 group-data-[surface=frost]/grace:shadow-frost group-data-[surface=frost]/grace:backdrop-saturate-150",
        className,
      )}
      {...props}
    />
  );
}

export type GraceHeaderProps = ComponentProps<"div"> & {
  /** Her name, at the start of the first capsule. */
  title?: string;
  /** `live` while she speaks or works, so Pause works; `paused` offers Resume as the next step; `idle` dims Pause. */
  pause?: "idle" | "live" | "paused";
  onPause?: () => void;
  onResume?: () => void;
  pauseLabel?: string;
  resumeLabel?: string;
  /** Her voice and speed menu, a `GraceVoiceMenu`. */
  voice?: ReactNode;
  /** Offers Show me again after Voice, to bring back the tip Margaret closed; the host offers it only while that tip's
   * target is still current. */
  showGuide?: boolean;
  /** Called by Show me again. */
  onShowGuide?: () => void;
  /** The words on Show me again. */
  showGuideLabel?: string;
  /** Whether the window fills the screen; the pill offers the other size. */
  expanded?: boolean;
  /** Called with the size the pill asks for. */
  onExpandedChange?: (expanded: boolean) => void;
  /** Rings and pulses Expand or Collapse, when Grace asks Margaret to change the size herself (prototype nudgeCollapse()). */
  nudge?: boolean;
  expandLabel?: string;
  collapseLabel?: string;
  /** Called by ✕. */
  onClose?: () => void;
  /** The accessible name of ✕. */
  closeLabel?: string;
};

/**
 * Grace's header: her name, Pause and Voice in one capsule; Expand or Collapse and ✕ in the other (prototype `#gwin .hdr`).
 * @model spec/app/assistant.md
 * @design packages/design-system/design.md#grace
 */
export function GraceHeader({
  title = "Grace",
  pause = "idle",
  onPause,
  onResume,
  pauseLabel = "Pause",
  resumeLabel = "Resume",
  voice,
  showGuide = false,
  onShowGuide,
  showGuideLabel,
  expanded = false,
  onExpandedChange,
  nudge = false,
  expandLabel = "Expand",
  collapseLabel = "Collapse",
  onClose,
  closeLabel = `Close ${title}`,
  className,
  ...props
}: GraceHeaderProps) {
  const paused = pause === "paused";
  const Size = expanded ? Minimize2 : Maximize2;
  return (
    <div className={cn("relative z-[2] flex h-16 shrink-0 items-center gap-3 font-sans", className)} {...props}>
      <GraceCapsule>
        {/* .gwin .hgrp .hdrt */}
        <span className="mr-2 pr-2.5 pl-[18px] text-lead leading-8 font-bold text-grace-title">{title}</span>
        {/* #lcB: Pause and Resume share one slot, so nothing shifts; only Resume, the one next step, is indigo; with nothing to pause, only the label dims. */}
        <Button
          variant={paused ? "prominent" : "plain"}
          size="compact"
          aria-label={`${paused ? resumeLabel : pauseLabel} ${title}`}
          aria-disabled={pause === "idle" || undefined}
          onClick={paused ? onResume : pause === "live" ? onPause : undefined}
          // .pill.prom:active: Grace's header is not #ahdr, so a pressed Resume takes the pressed indigo.
          className={cn("w-[150px] justify-center px-4 shadow-none", paused ? "active:bg-primary-pressed" : cn("text-grace-ink aria-disabled:text-grace-ink/32", pillPress))}
        >
          {paused ? playIcon : pauseIcon}
          {paused ? resumeLabel : pauseLabel}
        </Button>
        {voice}
        {/* spec/app/assistant.md, "Dismiss hides only the label and Show restores only a still-current target". */}
        {showGuide && <GuideShowButton surface="header" label={showGuideLabel} onSelect={onShowGuide} />}
      </GraceCapsule>
      <span className="flex-1" />
      <GraceCapsule>
        {/* #expB.nudge: the guide ring, pulsing; the shadow set alone, without `shadow-*`'s empty layers, so the keyframe matches it layer for layer (as GuideRing). */}
        <GracePill
          aria-expanded={expanded}
          onClick={() => onExpandedChange?.(!expanded)}
          className={cn(nudge && "animate-guide-pulse motion-reduce:animate-none")}
          style={nudge ? { boxShadow: "var(--shadow-guide-nudge)" } : undefined}
        >
          <Size size={20} strokeWidth={2.2} aria-hidden />
          {expanded ? collapseLabel : expandLabel}
        </GracePill>
        {/* .winx: its pressed disc shows at once, with no fade. */}
        <Button variant="plain" size="compact-icon" className="transition-none" aria-label={closeLabel} onClick={onClose}>
          <X size={24} strokeWidth={1.75} aria-hidden />
        </Button>
      </GraceCapsule>
    </div>
  );
}

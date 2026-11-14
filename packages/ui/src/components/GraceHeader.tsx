import type { ComponentProps, ReactNode } from "react";
import { Maximize2, Minimize2, X } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Button, type ButtonProps } from "./Button.tsx";

// Prototype ICON.pause and ICON.play: solid, 20px.
const pauseIcon = (
  <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
);
const playIcon = (
  <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 5v14l12-7z" />
  </svg>
);

export type GraceCapsuleProps = ComponentProps<"div">;

/** One glass capsule of Grace's controls, such as her name with Pause and Voice, or Attach with Mic (prototype `.hgrp`). */
export function GraceCapsule({ className, ...props }: GraceCapsuleProps) {
  return (
    <div
      className={cn(
        "flex h-16 shrink-0 items-center gap-0.5 rounded-full bg-glass/62 p-1 shadow-capsule backdrop-blur-capsule backdrop-saturate-160",
        // .hgrp on the frosted window: a white rim and a soft lift, no dark edge.
        "group-data-[surface=frost]/grace:bg-glass/55 group-data-[surface=frost]/grace:shadow-frost",
        className,
      )}
      {...props}
    />
  );
}

export type GracePillProps = Omit<ButtonProps, "variant" | "size">;

/** A pill inside a `GraceCapsule`: no fill of its own, 56px tall (prototype `.gwin .hgrp .pill`). */
export function GracePill({ className, ...props }: GracePillProps) {
  return <Button variant="plain" size="compact" className={cn("text-grace-ink active:bg-glass/42", className)} {...props} />;
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
  /** Whether the window fills the screen; the pill offers the other size. */
  expanded?: boolean;
  /** Called with the size the pill asks for. */
  onExpandedChange?: (expanded: boolean) => void;
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
  expanded = false,
  onExpandedChange,
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
          className={cn("w-[150px] justify-center px-4 shadow-none", !paused && "text-grace-ink active:bg-glass/42 aria-disabled:text-grace-ink/32")}
        >
          {paused ? playIcon : pauseIcon}
          {paused ? resumeLabel : pauseLabel}
        </Button>
        {voice}
      </GraceCapsule>
      <span className="flex-1" />
      <GraceCapsule>
        <GracePill aria-expanded={expanded} onClick={() => onExpandedChange?.(!expanded)}>
          <Size size={20} strokeWidth={2.2} aria-hidden />
          {expanded ? collapseLabel : expandLabel}
        </GracePill>
        <Button variant="plain" size="compact-icon" aria-label={closeLabel} onClick={onClose}>
          <X size={24} strokeWidth={1.75} aria-hidden />
        </Button>
      </GraceCapsule>
    </div>
  );
}

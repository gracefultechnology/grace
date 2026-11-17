import { useId, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button, GracePill } from "./Button.tsx";
import { GraceBubble } from "./GraceBubble.tsx";
import { GraceCapsule } from "./GraceHeader.tsx";
import { GraceMessages } from "./GraceMessages.tsx";
import { GraceWindow, type GraceWindowProps } from "./GraceWindow.tsx";
import { GuideLabel } from "./GuideLabel.tsx";
import { GuideRing } from "./GuideRing.tsx";
import { PageText } from "./PageHeading.tsx";
import { ProgressStrip, type ProgressStripProps } from "./ProgressStrip.tsx";

export type SetupRing = "talk" | "type" | "close";

const dockRings: Record<Exclude<SetupRing, "close">, string> = {
  talk: "[&_[aria-pressed]]:shadow-guide-tight [&_[aria-pressed]]:animate-guide-pulse-tight motion-reduce:[&_[aria-pressed]]:animate-none",
  type: "[&_[data-open-keyboard]]:shadow-guide-tight [&_[data-open-keyboard]]:animate-guide-pulse-tight motion-reduce:[&_[data-open-keyboard]]:animate-none",
};

export type SetupStepProps = Omit<GraceWindowProps, "header" | "children" | "content" | "dock" | "size"> & {
  /** The step's name and "Step n of m"; none at the hand-over, which is no question. */
  progress?: Pick<ProgressStripProps, "title" | "step" | "total">;
  /** Grace's fixed written line for the step. */
  line: string;
  /** Grace reads the line aloud: from the name step on, while she can think and cloud speech is available. */
  speaking?: boolean;
  /** What the step asks for, under the line: the Wi-Fi list, the email account choice, the pace, or the text size with its preview. */
  content?: ReactNode;
  /** The step's own answer, such as Next or Retry; `saving` while the store has not yet acknowledged it. */
  action?: { label: string; onAction: () => void; saving?: boolean };
  /** Not now, with what putting the step off costs; absent on the explanation and the hand-over. */
  notNow?: { cost: string; onNotNow: () => void };
  /** The one control a practice step rings: the dock's Talk or Type, or Close. */
  ring?: SetupRing;
  /** The answer row, a `GraceDock` with `setup`, from the name step on. */
  dock?: ReactNode;
  /** Set-up's own Close, to Home where Carry on setting up returns; on the Close step, her answer. */
  onClose?: () => void;
};

/**
 * One step of set-up, filling Grace's window: Close, the progress strip, Grace's written line, what the step asks for,
 * its answer and Not now with its cost, over the answer row. Practice steps ring the control they teach.
 * @model spec/app/setup.md
 * @design packages/design-system/design.md#grace
 * @design packages/design-system/design.md#screens
 */
export function SetupStep({ progress, line, speaking = false, content, action, notNow, ring, dock, onClose, ...props }: SetupStepProps) {
  const tipId = useId();
  const costId = useId();
  const closeRinged = ring === "close";
  const header = (
    <div className="relative z-[2] flex h-16 shrink-0 items-center justify-between gap-3 font-sans">
      <GraceCapsule>
        <span className="px-[18px] text-lead leading-8 font-bold text-grace-title">Grace</span>
      </GraceCapsule>
      <GraceCapsule>
        <span className="relative inline-flex">
          <GracePill aria-describedby={closeRinged ? tipId : undefined} onClick={onClose}>
            <X size={22} strokeWidth={2.2} aria-hidden />
            Close
          </GracePill>
          {closeRinged ? (
            <>
              <GuideRing gap={4} radius={32} tight motion="tap" />
              <GuideLabel id={tipId} placement="below-end" title="Tap here" className="absolute top-[calc(100%+22px)] right-9 z-6" />
            </>
          ) : null}
        </span>
      </GraceCapsule>
    </div>
  );
  return (
    <GraceWindow
      aria-label="Setting up"
      size="expanded"
      header={header}
      dock={dock == null ? undefined : <div className={ring === "talk" || ring === "type" ? dockRings[ring] : undefined}>{dock}</div>}
      {...props}
    >
      {progress ? (
        <div className="flex flex-none flex-col px-4 pt-[88px]">
          <ProgressStrip {...progress} />
        </div>
      ) : null}
      <GraceMessages className={progress ? "pt-6" : undefined}>
        <GraceBubble activity={speaking ? "speaking" : undefined}>{line}</GraceBubble>
        {content}
        {action || notNow ? (
          <div className="flex flex-col items-end gap-3">
            <div className="flex flex-wrap justify-end gap-3">
              {notNow ? (
                <Button variant="capsule" size="pill" aria-describedby={costId} onClick={notNow.onNotNow}>
                  Not now
                </Button>
              ) : null}
              {action ? (
                <Button variant="prominent" size="pill" loading={action.saving} onClick={action.onAction}>
                  {action.label}
                </Button>
              ) : null}
            </div>
            {notNow ? (
              <PageText id={costId} tone="secondary">
                {notNow.cost}
              </PageText>
            ) : null}
          </div>
        ) : null}
      </GraceMessages>
    </GraceWindow>
  );
}

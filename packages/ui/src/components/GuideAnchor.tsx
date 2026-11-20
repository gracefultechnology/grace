import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn.ts";
import { GuideLabel } from "./GuideLabel.tsx";
import { GuideRing } from "./GuideRing.tsx";

export type GuideAnchorProps = Omit<ComponentProps<"span">, "title"> & {
  /** The thing Grace points at inside an app: a row, an option, a button. */
  children: ReactNode;
  /** The target's own corner radius in pixels; the ring, 8px outside it, adds the 8 so it follows its shape. */
  radius?: number;
  /** `point`: what Grace is talking about, in a violet ring that beats three times; `instruction`: Margaret's turn, the violet ring
   * pulsing until tapped, and `title` beside it; `confirm`: done, in a green ring that beats three times. */
  kind?: "point" | "instruction" | "confirm";
  /** What to do, on Grace's label beside the target: "Tap Largest". */
  title?: string;
  /** Called by the label's close button: it dismisses the label and its ring. */
  onClose?: () => void;
  /** The close button's accessible name. */
  closeLabel?: string;
  /** Where the label sits: `beside` a button, to its right; `below` a target as wide as the window, such as a row. */
  placement?: "beside" | "below";
};

/** What Grace says about the target she points at: how she points and, for an instruction, the words on her label. */
export type GuidePointing = Pick<GuideAnchorProps, "kind" | "title" | "onClose" | "closeLabel">;

/** Grace pointing at one of the targets a component holds, named by `targetId`. A component that is itself one target takes `GuidePointing`. */
export type Guide<Target extends string> = GuidePointing & { targetId: Target };

const gap = 8;

/**
 * Grace pointing inside an app window: her ring round the target and her label beside it, anchored to the element so they
 * follow it whatever the text size (prototype `.anch-w`, `.gring.anch`, `.glab.anch`).
 * @model spec/app/workspace.md
 * @design packages/design-system/design.md#guidance
 */
export function GuideAnchor({ children, radius = 12, kind = "point", title, onClose, closeLabel, placement = "beside", className, ...props }: GuideAnchorProps) {
  const instruction = kind === "instruction";
  return (
    <span className={cn("relative inline-flex", className)} {...props}>
      {children}
      <GuideRing gap={gap} radius={Math.min(radius + gap, 999)} tone={kind === "confirm" ? "ok" : "guide"} motion={instruction ? "tap" : "pulse"} />
      {instruction && title && (
        <GuideLabel
          title={title}
          closable
          onClose={onClose}
          closeLabel={closeLabel}
          placement={placement}
          className={cn(
            "pointer-events-auto absolute z-6",
            placement === "below" ? "top-[calc(100%+22px)] left-6" : "top-[calc(min(50%,40px)+22px)] left-[calc(100%+22px)] -translate-y-full",
          )}
        />
      )}
    </span>
  );
}

/** `target` in Grace's ring when `guide` names `targetId`, otherwise `target` alone. */
export function guided<Target extends string>(
  guide: Guide<Target> | undefined,
  targetId: Target,
  target: ReactNode,
  anchor?: Pick<GuideAnchorProps, "radius" | "placement" | "className">,
) {
  if (guide?.targetId !== targetId) return target;
  const { targetId: _targetId, ...pointing } = guide;
  return <GuideAnchor {...anchor} {...pointing}>{target}</GuideAnchor>;
}

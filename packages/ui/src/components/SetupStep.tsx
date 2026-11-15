import { useId, type ReactNode } from "react";
import { ListChecks, X } from "lucide-react";
import { AnswerChip, AnswerChips } from "./AnswerChip.tsx";
import { GraceCapsule, GracePill } from "./GraceHeader.tsx";
import { GraceMessages } from "./GraceMessages.tsx";
import { GraceWindow, type GraceWindowProps } from "./GraceWindow.tsx";
import { GuideLabel } from "./GuideLabel.tsx";
import { GuideRing } from "./GuideRing.tsx";
import { ProgressStrip, type ProgressStripProps } from "./ProgressStrip.tsx";

/** The words of set-up's own controls, for another language. */
export type SetupStepLabels = {
  /** Grace's name, at the start of the header. */
  grace: string;
  /** What the window is, for assistive technology. */
  region: string;
  tasks: string;
  close: string;
  /** Grace's label under the control she points at. */
  tapHere: string;
};

export const setupStepLabels: SetupStepLabels = {
  grace: "Grace",
  region: "Setting up",
  tasks: "Tasks",
  close: "Close",
  tapHere: "Tap here",
};

export type SetupStepProps = Omit<GraceWindowProps, "header" | "children" | "dock" | "size"> & {
  /** How far set-up has come; the tour's full-screen steps show none. */
  progress?: Pick<ProgressStripProps, "title" | "step" | "total" | "countLabel" | "progressLabel">;
  /** Over the conversation, on the first two steps: the language, a `LanguageChoice`. */
  language?: ReactNode;
  /** The conversation so far: `GraceBubble`s with Grace's words, `UserBubble`s, `GraceActionLine`s and `ValueCards`. */
  children?: ReactNode;
  /** Grace's question's answers, as chips under it, read from the right. */
  answers?: readonly string[];
  /** Called with the answer tapped. */
  onAnswer?: (answer: string) => void;
  /** Steps the answers back while Margaret is talking. */
  answersFaded?: boolean;
  /** The answer row: a `GraceDock` with `setup`, or a `SecretField` while a password is asked. */
  dock?: ReactNode;
  /** How many set-up tasks are kept; from one, Tasks shows in the header. */
  tasksCount?: number;
  onTasks?: () => void;
  onClose?: () => void;
  /** The header control Grace points at in the tour: her ring round it and her label under it. */
  guide?: "tasks" | "close";
  /** Words to replace, for another language; the rest keep their defaults. */
  labels?: Partial<SetupStepLabels>;
};

/**
 * Set-up, held in Grace's conversation (senior-care onboarding/OnboardingFlow.tsx): her header with Tasks and Close, the
 * progress strip, her question and Margaret's answers to tap or say, over the answer row. Each step is the words and
 * answers it is given.
 * @model spec/app/conversation.md
 * @design packages/design-system/design.md#grace
 */
export function SetupStep({
  progress,
  language,
  children,
  answers,
  onAnswer,
  answersFaded = false,
  dock,
  tasksCount = 0,
  onTasks,
  onClose,
  guide,
  labels: words,
  ...props
}: SetupStepProps) {
  const labels = { ...setupStepLabels, ...words };
  const labelId = useId();
  const band = progress !== undefined || language != null;
  // The ring 4px out from a pill inside its capsule (radius 28 + 4), the label 22px under it.
  const pointer = (target: SetupStepProps["guide"]) =>
    guide === target ? (
      <>
        <GuideRing gap={4} radius={32} tight motion="tap" />
        <GuideLabel id={labelId} placement="below" title={labels.tapHere} className="absolute top-[calc(100%+22px)] right-0 z-6" />
      </>
    ) : null;
  const described = (target: SetupStepProps["guide"]) => (guide === target ? labelId : undefined);
  const header = (
    <div className="relative z-[2] flex h-16 shrink-0 items-center gap-3 font-sans">
      <GraceCapsule>
        <span className="px-[18px] text-lead leading-8 font-bold text-grace-title">{labels.grace}</span>
      </GraceCapsule>
      <span className="flex-1" />
      <GraceCapsule>
        {tasksCount > 0 ? (
          <span className="relative inline-flex">
            <GracePill aria-describedby={described("tasks")} onClick={onTasks}>
              <ListChecks size={22} strokeWidth={2.2} aria-hidden />
              {labels.tasks}
              <span className="min-w-7 rounded-full bg-primary px-2 text-center text-caption leading-7 text-primary-foreground">{tasksCount}</span>
            </GracePill>
            {pointer("tasks")}
          </span>
        ) : null}
        <span className="relative inline-flex">
          <GracePill aria-describedby={described("close")} onClick={onClose}>
            <X size={22} strokeWidth={2.2} aria-hidden />
            {labels.close}
          </GracePill>
          {pointer("close")}
        </span>
      </GraceCapsule>
    </div>
  );
  return (
    <GraceWindow aria-label={labels.region} size="expanded" header={header} dock={dock} {...props}>
      {band ? (
        <div className="flex flex-none flex-col gap-4 px-4 pt-[88px]">
          {progress ? <ProgressStrip {...progress} /> : null}
          {language}
        </div>
      ) : null}
      <GraceMessages className={band ? "pt-6" : undefined}>
        {children}
        {answers?.length ? (
          <AnswerChips faded={answersFaded}>
            {answers.map((answer) => (
              <AnswerChip key={answer} onClick={() => onAnswer?.(answer)}>
                {answer}
              </AnswerChip>
            ))}
          </AnswerChips>
        ) : null}
      </GraceMessages>
    </GraceWindow>
  );
}

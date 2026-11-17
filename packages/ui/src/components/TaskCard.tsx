import { useCallback, useId, type ComponentProps } from "react";
import { CircleCheck, Clock, Pause, type LucideIcon } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";
import { StatusTag, type TagTone } from "./PaymentStatusBadge.tsx";

export type TaskStatus = "paused" | "waiting" | "done";

export type TaskCardLabels = Record<TaskStatus, string> & {
  resume: string;
  ask: string;
  stop: string;
  remove: string;
  stopQuestion: string;
  confirmStop: string;
  keep: string;
  removeQuestion: string;
  confirmRemove: string;
};

export const taskCardLabels: TaskCardLabels = {
  paused: "Paused",
  waiting: "Waiting",
  done: "Done",
  resume: "Resume",
  ask: "Ask Grace",
  stop: "Stop this task",
  remove: "Remove from list",
  stopQuestion: "Stop this task? Grace won’t carry on with it. Anything already done on the website stays done.",
  confirmStop: "Yes, stop it",
  keep: "Keep it",
  removeQuestion: "Remove this task from the list?",
  confirmRemove: "Yes, remove it",
};

const tags: Record<TaskStatus, { icon: LucideIcon; tone: TagTone }> = {
  paused: { icon: Pause, tone: "accent" },
  waiting: { icon: Clock, tone: "warn" },
  done: { icon: CircleCheck, tone: "ok" },
};

export type TaskCardProps = Omit<ComponentProps<"article">, "title"> & {
  status: TaskStatus;
  /** When it last changed, as the app words it: "Today", "Since Monday", "12 Sep". */
  when: string;
  /** What the task is, as Margaret would name it: "Paying the City Water bill". */
  title: string;
  /** One plain sentence: where it stopped, who it waits on, or what happened. */
  line: string;
  /** The question the card asks in place of its actions: before stopping, or before a finished task leaves the list. */
  asking?: "stop" | "remove";
  /** "Yes, stop it" was tapped and the task is stopping: the answers wait. */
  stopping?: boolean;
  /** The task is being checked: its actions wait. */
  pending?: boolean;
  /** Resume cannot simply carry on; the conversation explains what to check first. */
  resumeBlocked?: boolean;
  /** The task has already ended, so it can no longer be stopped. */
  ended?: boolean;
  /** Paused: carries on with the task. */
  onResume?: () => void;
  /** Waiting or done: opens Grace about this task. */
  onAsk?: () => void;
  /** Stop this task: the app asks first, with `asking="stop"`. */
  onStop?: () => void;
  /** "Yes, stop it". */
  onConfirmStop?: () => void;
  /** "Keep it": the question goes away. */
  onKeep?: () => void;
  /** Done: Remove from list; the app asks first, with `asking="remove"`. Without it there is no Remove. */
  onRemove?: () => void;
  /** "Yes, remove it". */
  onConfirmRemove?: () => void;
  /** The heading's level in its page. */
  headingLevel?: 2 | 3;
  /** The card's words, for another language. */
  labels?: Partial<TaskCardLabels>;
};

/**
 * One task Grace started: its status and date, its name and one line, then Resume or Ask Grace beside Stop this task.
 * Stop asks on the card before anything is stopped; a finished card can leave the list after one question.
 * @model spec/app/prep.md
 * @design packages/design-system/design.md#windows
 */
export function TaskCard({
  status,
  when,
  title,
  line,
  asking,
  stopping = false,
  pending = false,
  resumeBlocked = false,
  ended = false,
  onResume,
  onAsk,
  onStop,
  onConfirmStop,
  onKeep,
  onRemove,
  onConfirmRemove,
  headingLevel = 3,
  labels,
  className,
  ...props
}: TaskCardProps) {
  const l = { ...taskCardLabels, ...labels };
  const titleId = useId();
  const questionId = useId();
  const focusQuestion = useCallback((question: HTMLParagraphElement | null) => question?.focus(), []);
  const done = status === "done";
  const ask = asking === "stop" && !done ? "stop" : asking === "remove" && done ? "remove" : undefined;
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article
      aria-labelledby={titleId}
      aria-busy={pending || stopping || undefined}
      className={cn("box-border flex flex-col gap-3.5 rounded-window px-7 py-[26px] font-sans text-foreground", status === "paused" ? "bg-accent" : "bg-panel", className)}
      {...props}
    >
      <div className="flex items-center gap-3">
        <StatusTag {...tags[status]}>{l[status]}</StatusTag>
        <span className="text-body leading-[26px] font-medium text-muted-foreground">{when}</span>
      </div>
      <Heading id={titleId} className="m-0 text-title-sm leading-8 font-bold text-chrome">
        {title}
      </Heading>
      <p className="m-0 text-body-lg leading-[30px] text-foreground">{line}</p>
      {ask ? (
        <div role="group" aria-labelledby={questionId} className="mt-1 flex flex-col gap-2 border-t border-border pt-3">
          <p id={questionId} ref={focusQuestion} tabIndex={-1} className="m-0 text-body-lg leading-[30px] font-semibold text-chrome outline-none">
            {ask === "stop" ? l.stopQuestion : l.removeQuestion}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="warn" size="pill" aria-describedby={titleId} loading={stopping} onClick={ask === "stop" ? onConfirmStop : onConfirmRemove}>
              {ask === "stop" ? l.confirmStop : l.confirmRemove}
            </Button>
            <Button variant="capsule" size="pill" aria-describedby={titleId} disabled={stopping} onClick={onKeep}>
              {l.keep}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-3">
          {status === "paused" ? (
            <Button variant="prominent" size="pill" aria-describedby={titleId} disabled={pending || resumeBlocked} onClick={onResume}>
              {l.resume}
            </Button>
          ) : (
            <Button variant="capsule" size="pill" aria-describedby={titleId} disabled={pending} onClick={onAsk}>
              {l.ask}
            </Button>
          )}
          {!done && (
            <Button variant="capsule" size="pill" aria-describedby={titleId} disabled={pending || ended} onClick={onStop}>
              {l.stop}
            </Button>
          )}
          {done && onRemove && (
            <Button variant="capsule" size="pill" aria-describedby={titleId} onClick={onRemove}>
              {l.remove}
            </Button>
          )}
        </div>
      )}
    </article>
  );
}

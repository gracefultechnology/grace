import type { ComponentProps, ReactNode } from "react";
import { Check, CircleAlert } from "lucide-react";
import { cn } from "../lib/cn.ts";

type Tone = "action" | "record" | "result" | "problem";

export type GraceActionLineProps = Omit<ComponentProps<"div">, "children"> & {
  /** What happened, such as "You tapped Sign in." */
  children: ReactNode;
  /**
   * `action`: a tap Margaret made herself (prototype `.act`). The rest are system lines: `record` notes a step,
   * `result` something done, `problem` something that stopped.
   */
  tone?: Tone;
  /** A line that will be replaced, such as "Checking the website…": quieter. */
  transient?: boolean;
  /** The mark before the words, in place of the tone's. */
  icon?: ReactNode;
};

const marks: Record<Tone, ReactNode> = {
  action: <Check size={20} strokeWidth={2.4} aria-hidden />,
  record: null,
  result: <Check size={22} strokeWidth={2.4} aria-hidden className="text-ok" />,
  problem: <CircleAlert size={22} strokeWidth={2.2} aria-hidden />,
};

const tones: Record<Tone, string> = { action: "text-label-ink", record: "text-label-ink", result: "text-label-ink", problem: "text-warn" };

/**
 * A line in the conversation between Grace's messages, with no bubble: a tap Margaret made herself (prototype `.act`,
 * actLine()) or a step, result or problem of the task.
 * @model spec/app/conversation.md
 * @design packages/design-system/design.md#grace
 */
export function GraceActionLine({ tone = "action", transient = false, icon = marks[tone], className, children, ...props }: GraceActionLineProps) {
  return (
    <div className={cn("flex items-center justify-center gap-2 text-body leading-7 font-medium", tones[tone], tone !== "action" && "font-bold", transient && "opacity-70", className)} {...props}>
      {icon}
      <span className="min-w-0 select-text">{children}</span>
    </div>
  );
}

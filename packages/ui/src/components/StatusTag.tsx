import type { ComponentProps } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/cn.ts";

export type TagTone = "accent" | "ok" | "warn" | "caution";

const tagTones: Record<TagTone, string> = {
  accent: "bg-card text-primary inset-ring-primary/30",
  ok: "bg-card text-ok inset-ring-ok/30",
  warn: "bg-card text-warn inset-ring-warn/30",
  caution: "bg-caution text-destructive inset-ring-destructive/22",
};

export type StatusTagProps = ComponentProps<"span"> & {
  /** The icon before the word, from lucide-react. */
  icon: LucideIcon;
  /** The shared tone: `ok`, `warn`, `caution` or `accent`. */
  tone: TagTone;
};

/**
 * An icon and a word on a small tag, in one of the shared tones; a task's status and its outcome both draw one.
 * @design packages/design-system/design.md#grace
 */
export function StatusTag({ icon: Icon, tone, children, className, ...props }: StatusTagProps) {
  return (
    <span
      className={cn("inline-flex min-h-9 max-w-full items-start gap-2 rounded-tag px-3 py-[7px] text-left text-label leading-[22px] font-semibold inset-ring-[1.5px]", tagTones[tone], className)}
      {...props}
    >
      <Icon aria-hidden size={20} strokeWidth={2.2} className="mt-px flex-none" />
      <span className="min-w-0 break-words">{children}</span>
    </span>
  );
}

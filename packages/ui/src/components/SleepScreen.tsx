import type { ComponentProps, ReactNode } from "react";
import { Calendar } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { GraceOrb } from "./GraceOrb.tsx";

export type SleepScreenProps = ComponentProps<"div"> & {
  /** The clock, without its period: "8:57". */
  time: string;
  /** The long date: "Friday, November 13". */
  date: string;
  /** The next event, as one line: "Tomorrow: Doctor’s appointment, 10 am". Left out when nothing is coming. */
  next?: string;
  /** The icon before the next event. */
  nextIcon?: ReactNode;
  /** How to wake the tablet: "Touch the screen to wake it". */
  hint: string;
};

/**
 * The resting screen while the tablet sleeps: a large clock, the date, what is next, and how to wake it.
 * It covers the whole screen; a touch anywhere wakes it.
 * @model spec/app/wake.md
 * @design packages/design-system/design.md#grace
 * @design packages/design-system/design.md#screens
 */
export function SleepScreen({ time, date, next, nextIcon = <Calendar size={28} strokeWidth={2} />, hint, className, ...props }: SleepScreenProps) {
  return (
    <div
      className={cn("absolute -inset-1 z-40 flex flex-col items-center justify-center bg-gradient-sleep font-sans text-sleep-ink", className)}
      {...props}
    >
      <div className="text-[9.375rem] leading-none font-light tracking-[-.02em]">{time}</div>
      <div className="mt-3.5 text-display-sm leading-[42px] font-medium text-sleep-date">{date}</div>
      {next && (
        <div className="mt-10 flex items-center gap-3.5 rounded-full bg-glass/8 px-[26px] py-4 text-title-sm leading-8 font-medium">
          <span aria-hidden className="flex">{nextIcon}</span>
          {next}
        </div>
      )}
      <div className="absolute bottom-7 flex items-center gap-4 text-lead leading-[30px] font-medium text-sleep-hint">
        <GraceOrb glow="welcome" />
        {hint}
      </div>
    </div>
  );
}

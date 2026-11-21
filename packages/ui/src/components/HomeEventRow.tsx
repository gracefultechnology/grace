import type { ComponentProps } from "react";
import { cn, focusRing } from "../lib/cn.ts";
import { Panel } from "./Panel.tsx";

export type HomeEventRowProps = Omit<ComponentProps<"button">, "title" | "children" | "type"> & {
  /** The day, short and in capitals: "SAT", or "TODAY". */
  weekday: string;
  /** When it starts: "10 am". */
  time: string;
  /** What it is: "Doctor’s appointment". */
  title: string;
  /** Who and where: "Dr. Patel · Main St clinic". */
  detail?: string;
  /** The next thing on the calendar: its day and bar turn rose. */
  next?: boolean;
};

/**
 * One coming event on Home's Calendar card: the day and time, a bar, the title and who or where. Given `onClick`, the
 * row is a button that opens the event; without it, a picture of the row.
 * @model spec/app/calendarView.md
 * @design packages/design-system/design.md#glass
 */
export function HomeEventRow({ weekday, time, title, detail, next = false, onClick, className, ...props }: HomeEventRowProps) {
  const row = (
    <Panel variant="white" className={cn("flex items-center gap-[18px] text-left", !onClick && className)}>
      <span className="min-w-[74px] flex-none text-center whitespace-nowrap">
        <b className={cn("block text-control leading-[22px] tracking-[.06em]", next ? "text-rose" : "text-muted-foreground")}>{weekday}</b>
        <span className="block text-body-lg leading-7 font-bold">{time}</span>
      </span>
      <span aria-hidden className={cn("w-0.5 self-stretch rounded-full", next ? "bg-rose" : "bg-lavender")} />
      <span className="min-w-0 [overflow-wrap:break-word] hyphens-auto">
        <b className="block text-lead leading-[30px]">{title}</b>
        {detail && <span className="block text-body leading-[26px] text-muted-foreground">{detail}</span>}
      </span>
    </Panel>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(focusRing, "block cursor-pointer rounded-row p-0 font-sans", className)} {...props}>
      {row}
    </button>
  ) : (
    row
  );
}

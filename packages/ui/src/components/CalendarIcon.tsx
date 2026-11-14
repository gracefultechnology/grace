import { type ComponentProps, useId } from "react";
import { cn } from "../lib/cn.ts";

export type CalendarIconProps = Omit<ComponentProps<"svg">, "children"> & {
  /** The weekday on the red header, such as "FRI". */
  weekday: string;
  /** The day of the month on the page. */
  day: number | string;
  /** The width and height in pixels. */
  size?: number;
};

/**
 * The tilted tear-off calendar on Home's Calendar card, showing today (prototype `.lc[data-app="Calendar"]` svg).
 * @model spec/app/calendarView.md
 * @design packages/design-system/design.md#glass
 */
export function CalendarIcon({
  weekday,
  day,
  size = 120,
  className,
  ...props
}: CalendarIconProps) {
  const id = useId();
  return (
    <svg
      role="img"
      aria-label={`${weekday} ${day}`}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={cn(
        "block rotate-[8deg] overflow-visible drop-shadow-[0_14px_18px_color-mix(in_oklab,var(--alert)_28%,transparent)]",
        className,
      )}
      {...props}
    >
      <defs>
        <linearGradient id={`${id}page`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--card)" />
          <stop offset="1" stopColor="var(--calendar-page)" />
        </linearGradient>
        <linearGradient id={`${id}head`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--calendar-from)" />
          <stop offset="1" stopColor="var(--rose)" />
        </linearGradient>
      </defs>
      <rect
        x="10"
        y="16"
        width="100"
        height="96"
        rx="18"
        fill={`url(#${id}page)`}
      />
      <path
        d="M10 34a18 18 0 0 1 18-18h64a18 18 0 0 1 18 18v8H10z"
        fill={`url(#${id}head)`}
      />
      <rect
        x="32"
        y="8"
        width="9"
        height="20"
        rx="4.5"
        fill="var(--calendar-ring)"
      />
      <rect
        x="79"
        y="8"
        width="9"
        height="20"
        rx="4.5"
        fill="var(--calendar-ring)"
      />
      <text
        x="60"
        y="38"
        textAnchor="middle"
        fontWeight="800"
        fontSize="13"
        fill="var(--primary-foreground)"
        letterSpacing="1.5"
        className="font-sans"
      >
        {weekday}
      </text>
      <text
        x="60"
        y="94"
        textAnchor="middle"
        fontWeight="800"
        fontSize="46"
        fill="var(--calendar-ink)"
        className="font-sans"
      >
        {day}
      </text>
    </svg>
  );
}

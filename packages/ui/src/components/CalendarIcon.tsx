import { type ComponentProps, type ReactNode, useId } from "react";
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
        // Prototype `.lc[data-app="Calendar"] svg`.
        "block rotate-[8deg] overflow-visible drop-shadow-calendar",
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

// Prototype `AXP` (line 1786): the calendar's outlines, older than Lucide's icons of the same names.
const glyphs = {
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  person: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </>
  ),
  bell: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>
  ),
  repeat: (
    <>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </>
  ),
  mail: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </>
  ),
  pencil: <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />,
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type CalendarGlyphProps = Omit<ComponentProps<"svg">, "children"> & {
  /** Which outline. */
  name: keyof typeof glyphs;
  /** The width and height in pixels. */
  size?: number;
};

/** One of the line icons the Calendar app draws: its header, an event's details, the form's fields and Delete (prototype `axi()`). */
export function CalendarGlyph({ name, size = 24, strokeWidth = 2.2, ...props }: CalendarGlyphProps) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      {glyphs[name]}
    </svg>
  );
}

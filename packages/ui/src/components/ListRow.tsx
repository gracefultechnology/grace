import type { ComponentProps, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { UnreadDot } from "./UnreadDot.tsx";

export type ListRowProps = Omit<ComponentProps<"div">, "title" | "onClick" | "children"> & {
  /** The row's name, in bold. */
  title: ReactNode;
  /** A line under the title; it wraps unless `truncate`. */
  subtitle?: ReactNode;
  /** Keeps the subtitle to one line, cut with an ellipsis, as an email's subject (prototype `mrow()`). */
  truncate?: boolean;
  /** What stands before the text: an avatar, an icon or a time. */
  leading?: ReactNode;
  /** What stands at the end: a switch, a button or a signal icon. */
  trailing?: ReactNode;
  /** A time or short note at the top right, as on an email. */
  time?: string;
  /** Marks the row not yet read with a dot after its title. */
  unread?: boolean;
  /** Shows a chevron: the row opens a page. */
  chevron?: boolean;
  /** Makes the whole row tappable; a control in `trailing` stays its own. */
  onClick?: () => void;
};

/**
 * One row of a list on a white window (prototype `.a-row`): leading, title and subtitle, trailing.
 * @design packages/design-system/design.md#windows
 */
export function ListRow({ title, subtitle, truncate = false, leading, trailing, time, unread = false, chevron = false, onClick, className, ...props }: ListRowProps) {
  const text = (
    <>
      <span className="flex items-center gap-2.5 text-lead leading-[30px] font-bold text-chrome">
        {title}
        {unread && <UnreadDot />}
      </span>
      {subtitle ? <span className={cn("mt-0.5 block text-body leading-[26px] font-medium text-muted-foreground", truncate && "truncate")}>{subtitle}</span> : null}
    </>
  );
  return (
    <div
      className={cn(
        "relative box-border flex min-h-24 items-center gap-5 rounded-row bg-panel px-[22px] py-4 text-foreground",
        onClick && "has-[>button:active]:scale-[.99]",
        className,
      )}
      {...props}
    >
      {leading}
      {onClick ? (
        <button type="button" onClick={onClick} className="min-w-0 cursor-pointer text-left outline-none after:absolute after:inset-0 after:rounded-row focus-visible:after:outline-3 focus-visible:after:outline-offset-3 focus-visible:after:outline-solid focus-visible:after:outline-ring">
          {text}
        </button>
      ) : (
        <div className="min-w-0">{text}</div>
      )}
      {time && <span className="ml-auto self-start pt-1.5 text-control leading-6 font-medium whitespace-nowrap text-muted-foreground">{time}</span>}
      {trailing ? <span className="relative ml-auto flex flex-none items-center">{trailing}</span> : null}
      {chevron && <ChevronRight aria-hidden size={26} strokeWidth={2.4} className={cn("flex-none text-chevron", trailing ? "ml-3.5" : "ml-auto")} />}
    </div>
  );
}

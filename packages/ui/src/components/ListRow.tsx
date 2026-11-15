import type { ComponentProps, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { UnreadDot } from "./UnreadDot.tsx";

export type ListRowProps = Omit<ComponentProps<"div">, "title" | "onClick" | "children"> & {
  /** The row's name, in bold. */
  title: ReactNode;
  /** One line under the title. */
  subtitle?: ReactNode;
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
export function ListRow({ title, subtitle, leading, trailing, time, unread = false, chevron = false, onClick, className, ...props }: ListRowProps) {
  const text = (
    <>
      <span className="flex items-center gap-2.5 text-lead leading-[30px] font-bold text-chrome">
        {title}
        {unread && <UnreadDot />}
      </span>
      {subtitle ? <span className="mt-0.5 block truncate text-body leading-[26px] font-medium text-muted-foreground">{subtitle}</span> : null}
    </>
  );
  return (
    <div
      className={cn(
        "relative box-border flex min-h-24 items-center gap-5 rounded-row bg-panel px-[22px] py-4 text-foreground",
        onClick && "transition-transform duration-press ease-spring has-[>button:active]:scale-[.99]",
        className,
      )}
      {...props}
    >
      {leading}
      {onClick ? (
        // The button stretches over the whole row (prototype `.a-row[data-ax]`); `trailing` sits above it.
        <button type="button" onClick={onClick} className="min-w-0 cursor-pointer text-left outline-none after:absolute after:inset-0 after:rounded-row focus-visible:after:ring-2 focus-visible:after:ring-ring">
          {text}
        </button>
      ) : (
        <div className="min-w-0">{text}</div>
      )}
      {time && <span className="ml-auto self-start pt-1.5 text-lg leading-6 font-medium whitespace-nowrap text-muted-foreground">{time}</span>}
      {trailing ? <span className="relative ml-auto flex flex-none items-center">{trailing}</span> : null}
      {chevron && <ChevronRight aria-hidden size={26} strokeWidth={2.4} className="ml-auto flex-none text-chevron" />}
    </div>
  );
}

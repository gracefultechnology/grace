import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn.ts";

export type BannerProps = Omit<ComponentProps<"div">, "title"> & {
  /** The mark in the white tile at the start: a bell for a reminder, Wi-Fi off. */
  icon: ReactNode;
  /** What it is about, in bold. */
  title: string;
  /** One line under the title. */
  line?: string;
  /** The banner's buttons at its end: one prominent, and a plain ✕ to dismiss. */
  actions?: ReactNode;
};

/**
 * A notification on Home, on the cards' glass (prototype `.hban`, `drawBanner`).
 * @model spec/app/surface.md
 * @design packages/design-system/design.md#glass
 */
export function Banner({ icon, title, line, actions, className, ...props }: BannerProps) {
  return (
    <div
      role="status"
      className={cn("box-border flex min-h-[104px] items-center gap-[18px] rounded-card bg-glass/62 px-[22px] py-5 shadow-banner", className)}
      {...props}
    >
      <span aria-hidden className="flex size-[60px] flex-none items-center justify-center rounded-tab bg-card text-chrome shadow-badge">
        {icon}
      </span>
      <span className="min-w-0">
        <b className="block text-lead leading-[30px] font-bold text-foreground">{title}</b>
        {line && <span className="mt-0.5 block text-body leading-[26px] font-medium text-muted-foreground">{line}</span>}
      </span>
      {actions ? <span className="ml-auto flex flex-none items-center gap-3">{actions}</span> : null}
    </div>
  );
}

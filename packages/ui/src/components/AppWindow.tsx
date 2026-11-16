import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn.ts";
import { AppHeader, type AppHeaderProps } from "./AppHeader.tsx";
import { SplitView } from "./SplitView.tsx";

export type AppWindowProps = Omit<ComponentProps<"section">, "title"> &
  Pick<AppHeaderProps, "title" | "icon" | "backLabel" | "onBack" | "backAriaLabel" | "actions" | "onClose" | "closeLabel"> & {
    /** A side list, a `SideNav`: the window splits into the list and the page beside it. */
    nav?: ReactNode;
    /** `screen` places the window on a `TabletScreen`, right of the rail; `inline` fills its container. */
    placement?: "screen" | "inline";
  };

export const besideRail = "absolute top-1.5 bottom-1.5 left-[144px] right-1.5";

/**
 * An app's floating window (Calendar, Email, Files, Settings): white, 6px from the rail and the screen's
 * edges, with its header floating over the page that scrolls beneath it.
 * @model spec/app/workspace.md
 * @design packages/design-system/design.md#windows
 * @design packages/design-system/design.md#screens
 */
export function AppWindow({
  title,
  icon,
  backLabel,
  onBack,
  backAriaLabel,
  actions,
  onClose,
  closeLabel,
  nav,
  placement = "screen",
  className,
  children,
  ...props
}: AppWindowProps) {
  const header = (
    <AppHeader
      title={title}
      icon={icon}
      backLabel={backLabel}
      onBack={onBack}
      backAriaLabel={backAriaLabel}
      actions={actions}
      onClose={onClose}
      closeLabel={closeLabel}
      split={!!nav}
    />
  );
  return (
    <section
      aria-label={title}
      className={cn(
        "overflow-hidden rounded-window bg-background font-sans text-foreground shadow-pane transition-[bottom] duration-slow ease-settle motion-reduce:transition-none",
        placement === "screen" ? cn(besideRail, "z-[2]") : "relative size-full",
        className,
      )}
      {...props}
    >
      {nav ? (
        <SplitView nav={nav} header={header}>
          {children}
        </SplitView>
      ) : (
        <>
          <div className="absolute inset-0 overflow-y-auto px-6 pt-[104px] pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{children}</div>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10">{header}</div>
        </>
      )}
    </section>
  );
}

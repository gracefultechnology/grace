import type { ComponentProps } from "react";
import { cn } from "../lib/cn.ts";

export type HomeGreetingProps = Omit<ComponentProps<"div">, "children"> & {
  /** The greeting for the time of day: "Good evening". */
  greeting: string;
  /** Who it greets, in bold after a comma; the greeting alone without one. */
  name?: string;
  /** The line under it: "Here’s your day". */
  line?: string;
};

/**
 * Home's greeting at the top left: the time-of-day word and her name, light and large, with a line under it.
 * @model spec/app/shell.md
 * @design packages/design-system/design.md#glass
 */
export function HomeGreeting({ greeting, name, line, className, ...props }: HomeGreetingProps) {
  // Prototype `.hgr h2`, `.hgr h2 b`, `.hgr .sub`.
  return (
    <div className={cn("font-sans", className)} {...props}>
      <h2 className="m-0 text-display-sm leading-[42px] font-light tracking-[-.01em] text-foreground">
        {greeting}
        {name && <>, <b className="font-bold">{name}</b></>}
      </h2>
      {line && <div className="mt-0.5 text-title-lg leading-[38px] font-light text-greeting-sub">{line}</div>}
    </div>
  );
}

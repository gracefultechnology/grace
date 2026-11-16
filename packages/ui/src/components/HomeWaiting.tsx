import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn.ts";
import { Panel } from "./Panel.tsx";
import { WifiSlash } from "./Rail.tsx";

export type HomeWaitingProps = Omit<ComponentProps<"div">, "children"> & {
  /** What will happen once the tablet is back online. */
  message: string;
  /** The mark before it; Wi-Fi off by default. */
  icon?: ReactNode;
};

/**
 * What a Home card shows in place of its rows while the tablet is offline: Wi-Fi off and what is waiting.
 * @model spec/app/network.md
 * @design packages/design-system/design.md#glass
 */
export function HomeWaiting({ message, icon = <WifiSlash size={26} />, className, ...props }: HomeWaitingProps) {
  return (
    <Panel variant="white" className={cn("flex items-center gap-3.5 py-[18px] text-body-lg leading-7 font-medium", className)} {...props}>
      <span className="flex flex-none">{icon}</span>
      <span className="min-w-0">{message}</span>
    </Panel>
  );
}

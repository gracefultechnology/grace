import { Check, ChevronRight } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { ListRow, type ListRowProps } from "./ListRow.tsx";
import { WifiSignal } from "./WifiSignal.tsx";

export type WifiNetworkRowProps = Omit<ListRowProps, "title" | "subtitle" | "leading" | "trailing" | "chevron" | "time" | "unread"> & {
  /** The network's name. */
  name: string;
  /** Bars of signal, 0 to 3. */
  signal: number;
  /** The network asks for a password: a lock shows before the chevron. */
  locked?: boolean;
  /** The tablet is joined to this network: a raised white row with a check, and no chevron. */
  connected?: boolean;
  /** The tablet is joining this network now. */
  connecting?: boolean;
  /** The line under a joined network's name. */
  connectedLabel?: string;
  /** The line under a network being joined. */
  connectingLabel?: string;
  /** The lock's accessible name. */
  lockedLabel?: string;
};

/**
 * One Wi-Fi network in Settings: its signal, its name, a lock when it needs a password, and a chevron that opens it
 * (prototype `wifiPage()` rows).
 * @model spec/app/network.md
 * @design packages/design-system/design.md#windows
 */
export function WifiNetworkRow({
  name,
  signal,
  locked = false,
  connected = false,
  connecting = false,
  connectedLabel = "Connected",
  connectingLabel = "Connecting…",
  lockedLabel = "Needs a password",
  className,
  ...props
}: WifiNetworkRowProps) {
  if (connected)
    return (
      // The joined network: the shared selected platter (design.md#selected).
      <ListRow
        title={name}
        subtitle={connectedLabel}
        leading={<Check aria-hidden size={30} strokeWidth={2.6} className="flex-none text-ok" />}
        trailing={<WifiSignal strength={signal} />}
        className={cn("bg-card shadow-raised", className)}
        {...props}
      />
    );
  return (
    <ListRow
      title={name}
      subtitle={connecting ? connectingLabel : undefined}
      leading={<WifiSignal strength={signal} />}
      trailing={
        <>
          {locked && (
            // Prototype LOCK: a narrower padlock than Lucide's.
            <svg role="img" aria-label={lockedLabel} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              <rect x="5" y="11" width="14" height="10" rx="2" />
            </svg>
          )}
          {/* Prototype `.chev` margin 14px plus the row's 20px gap. */}
          <ChevronRight aria-hidden size={26} strokeWidth={2.4} className="ml-[34px] text-chevron" />
        </>
      }
      className={cn("min-h-[76px]", className)}
      {...props}
    />
  );
}

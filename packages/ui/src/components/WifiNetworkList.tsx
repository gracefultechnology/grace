import type { ComponentProps } from "react";
import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";
import { ListRow } from "./ListRow.tsx";
import { PageHeading } from "./PageHeading.tsx";
import { WifiSlash } from "./Rail.tsx";
import { WifiNetworkRow } from "./WifiNetworkRow.tsx";

/** A network the tablet can see. */
export interface WifiNetwork {
  name: string;
  /** Bars of signal, 0 to 3. */
  signal: number;
  /** It asks for a password or an account. */
  locked?: boolean;
}

export type WifiNetworkListProps = Omit<ComponentProps<"section">, "onSelect"> & {
  /** The network the tablet is joined to; without it the tablet is offline and Fix Wi-Fi shows. */
  current?: WifiNetwork;
  /** The other networks nearby, in the order to show them. */
  networks: WifiNetwork[];
  /** How many networks show before "Show more". */
  limit?: number;
  /** Every network shows. */
  expanded?: boolean;
  /** Called by "Show more" and "Show fewer". */
  onExpandedChange?: (expanded: boolean) => void;
  /** The network being joined now. */
  connecting?: string;
  /** Called with the network a person taps. */
  onSelect?: (name: string) => void;
  /** Called by Fix Wi-Fi, offline: Grace helps reconnect. */
  onFix?: () => void;
  /** The page's title. */
  title?: string;
  /** The label over the other networks. */
  othersLabel?: string;
  /** The row's title while offline. */
  offlineLabel?: string;
  /** The line under it. */
  offlineHint?: string;
  /** The words of the button that asks Grace to reconnect. */
  fixLabel?: string;
  /** The words of "Show more"; `{count}` becomes how many are hidden. */
  showMoreLabel?: string;
  /** The words of "Show fewer". */
  showFewerLabel?: string;
};

/**
 * Settings' Wi-Fi page: the network the tablet is on (or Fix Wi-Fi), then the others nearby, the strongest first
 * (prototype `wifiPage()`).
 * @model spec/app/network.md
 * @design packages/design-system/design.md#windows
 */
export function WifiNetworkList({
  current,
  networks,
  limit = 4,
  expanded = false,
  onExpandedChange,
  connecting,
  onSelect,
  onFix,
  title = "Wi-Fi",
  othersLabel = "Other networks nearby",
  offlineLabel = "Not connected",
  offlineHint = "Grace can help you reconnect",
  fixLabel = "Fix Wi-Fi",
  showMoreLabel = "Show {count} more networks",
  showFewerLabel = "Show fewer networks",
  className,
  ...props
}: WifiNetworkListProps) {
  const shown = expanded ? networks : networks.slice(0, limit);
  return (
    <section aria-label={title} className={cn("font-sans", className)} {...props}>
      <PageHeading>{title}</PageHeading>
      {current ? (
        <WifiNetworkRow connected name={current.name} signal={current.signal} className="mt-[18px]" />
      ) : (
        <ListRow
          className="mt-[18px]"
          title={offlineLabel}
          subtitle={offlineHint}
          leading={<WifiSlash size={30} />}
          trailing={
            <Button variant="prominent" size="pill" className="pr-[26px] pl-[22px]" onClick={onFix}>
              {fixLabel}
            </Button>
          }
        />
      )}
      <PageHeading level="section" className="mt-6 mb-2.5">{othersLabel}</PageHeading>
      <div className="flex flex-col gap-2.5">
        {shown.map((network) => (
          <WifiNetworkRow
            key={network.name}
            name={network.name}
            signal={network.signal}
            locked={network.locked}
            connecting={connecting === network.name}
            onClick={() => onSelect?.(network.name)}
          />
        ))}
      </div>
      {networks.length > limit && (
        <Button variant="capsule" size="pill" className="mt-3.5 pr-[26px] pl-[22px]" onClick={() => onExpandedChange?.(!expanded)}>
          {expanded ? showFewerLabel : showMoreLabel.replace("{count}", String(networks.length - limit))}
        </Button>
      )}
    </section>
  );
}

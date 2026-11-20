import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";
import { EmptyState } from "./EmptyState.tsx";
import { ListRow } from "./ListRow.tsx";
import { PageHeading, PageText } from "./PageHeading.tsx";
import { SettingsPageHeading } from "./SettingsPageHeading.tsx";
import { WifiSlash } from "./Rail.tsx";
import { Spinner } from "./Spinner.tsx";
import { WifiNetworkRow } from "./WifiNetworkRow.tsx";

export interface WifiNetwork {
  /** The network's identity, its name when absent. */
  id?: string;
  name: string;
  signal?: number;
  locked?: boolean;
}

export type WifiStatus = "off" | "scanning" | "none" | "ready";

export type WifiNetworkListProps = Omit<ComponentProps<"section">, "onSelect"> & {
  /** Whether Wi-Fi is on and what the last look for networks found. */
  status?: WifiStatus;
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
  /** The id of the network being joined now. */
  connecting?: string;
  /** The id of the network whose last join failed: its row says so and offers Try again. */
  failed?: string;
  /** Called by Try again on the `failed` network. */
  onRetry?: () => void;
  /** Called by Turn on while Wi-Fi is off. */
  onTurnOn?: () => void;
  /** Called with the id of the network a person taps. */
  onSelect?: (id: string) => void;
  /** Called by Fix Wi-Fi, offline: Grace helps reconnect. */
  onFix?: () => void;
  /** The one control under an empty list, such as Look again. */
  action?: ReactNode;
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
  /** The row's title while Wi-Fi is off. */
  offLabel?: string;
  /** The words of Turn on. */
  turnOnLabel?: string;
  /** What shows while the tablet looks for networks. */
  scanningLabel?: string;
  /** What shows when it finds none. */
  noneLabel?: string;
};

/**
 * Settings' Wi-Fi page: the network the tablet is on (or Fix Wi-Fi), then the others nearby, the strongest first
 * (prototype `wifiPage()`); or Turn on while Wi-Fi is off, and the look for networks while it runs or finds none.
 * @model spec/app/network.md
 * @design packages/design-system/design.md#windows
 */
export function WifiNetworkList({
  status = "ready",
  current,
  networks,
  limit = 4,
  expanded = false,
  onExpandedChange,
  connecting,
  failed,
  onRetry,
  onTurnOn,
  onSelect,
  onFix,
  action,
  title = "Wi-Fi",
  othersLabel = "Other networks nearby",
  offlineLabel = "Not connected",
  offlineHint = "Grace can help you reconnect",
  fixLabel = "Fix Wi-Fi",
  showMoreLabel = "Show {count} more networks",
  showFewerLabel = "Show fewer networks",
  offLabel = "Wi-Fi is off",
  turnOnLabel = "Turn on",
  scanningLabel = "Looking for networks…",
  noneLabel = "No networks nearby.",
  className,
  ...props
}: WifiNetworkListProps) {
  const shown = expanded ? networks : networks.slice(0, limit);
  return (
    <section aria-label={title} className={cn("font-sans", className)} {...props}>
      <SettingsPageHeading>{title}</SettingsPageHeading>
      {status === "off" ? (
        <ListRow
          className="mt-[18px]"
          title={offLabel}
          leading={<WifiSlash size={30} />}
          trailing={
            <Button variant="prominent" size="pill" onClick={onTurnOn}>
              {turnOnLabel}
            </Button>
          }
        />
      ) : (
        <>
          {current ? (
            <WifiNetworkRow connected name={current.name} signal={current.signal} className="mt-[18px]" />
          ) : (
            <ListRow
              className="mt-[18px]"
              title={offlineLabel}
              subtitle={offlineHint}
              leading={<WifiSlash size={30} />}
              trailing={
                <Button variant="prominent" size="pill" onClick={onFix}>
                  {fixLabel}
                </Button>
              }
            />
          )}
          <PageHeading level="section" className="mt-6 mb-2.5">{othersLabel}</PageHeading>
          {status === "scanning" && (
            <div role="status" className="flex items-center gap-3.5 px-1 py-2">
              <Spinner size="lg" aria-hidden />
              <PageText tone="secondary">{scanningLabel}</PageText>
            </div>
          )}
          {status === "none" && <EmptyState title={noneLabel} className="py-2">{action}</EmptyState>}
          {status === "ready" && (
            <>
              <div className="flex flex-col gap-2.5">
                {shown.map(({ id, name, signal, locked }) => (
                  <WifiNetworkRow
                    key={id ?? name}
                    name={name}
                    signal={signal}
                    locked={locked}
                    connecting={connecting === (id ?? name)}
                    failed={failed === (id ?? name)}
                    onRetry={onRetry}
                    onClick={() => onSelect?.(id ?? name)}
                  />
                ))}
              </div>
              {networks.length > limit && (
                <Button variant="capsule" size="pill" className="mt-3.5" onClick={() => onExpandedChange?.(!expanded)}>
                  {expanded ? showFewerLabel : showMoreLabel.replace("{count}", String(networks.length - limit))}
                </Button>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

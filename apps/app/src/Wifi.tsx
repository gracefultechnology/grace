// spec/app/network.md, "Story: Join the network I choose"; spec/app/network.md, "Story: See why no networks are listed"; spec/app/network.md, "The password goes from Grace's field to Android only, and Show never shares it with Grace"
import { Alert, Button, PageHeading, PageText, WifiJoinForm, WifiNetworkList, type WifiNetwork, type WifiStatus } from "@repo/ui";
import { Effect, ManagedRuntime } from "effect";
import { useState, useSyncExternalStore } from "react";
import type { Machine } from "../gen/app__network.effect.vibe";
import { type Discovery, type Event, type ListAction, type NetworkJoin, helpOffered, listAction } from "../gen/app__network.ts";
import { useMachine } from "../gen/app__network.react.ts";
import { wifiPlugin } from "./surfacePlugin.ts";
import { useWorkspace } from "./useApp.ts";
import { type Offer, WifiPage, wifiPage } from "./wifi.vibe";

export type WifiRuntime = ManagedRuntime.ManagedRuntime<WifiPage | Machine, never>;

const device: WifiRuntime | undefined = wifiPlugin && ManagedRuntime.make(wifiPage(wifiPlugin));

const statuses: Readonly<Record<Discovery, WifiStatus>> = {
  Scanning: "scanning", WifiOff: "off", NetworksFound: "ready",
  LocationAccessNeeded: "none", ExplainingLocation: "none", LocationRefused: "none", LocationOff: "none", NoNetworks: "none",
};
const reasons: Readonly<Partial<Record<Discovery, string>>> = {
  LocationAccessNeeded: "Grace needs your permission to look for networks.",
  ExplainingLocation: "The tablet uses its location only to find Wi-Fi networks nearby.",
  LocationRefused: "Android can show the networks nearby.",
  LocationOff: "Location is off, so the tablet can’t see networks nearby.",
  NoNetworks: "No networks nearby.",
};
const actionLabels: Readonly<Record<ListAction, string>> = { NoAction: "", OpenPanel: "Open Android’s Wi-Fi", Explain: "Look for networks", Allow: "Allow", Rescan: "Look again" };
const fixSteps = "Check the password on the internet box; capitals count. If it still won’t join, ask whoever looks after this network.";
const offlineSteps = "Check that the internet box is plugged in and its lights are on, then choose your network below. Its password is often on a sticker on the box.";
const fix = { type: "openGrace" } as const;

export function Wifi() {
  const { workspace, can, send } = useWorkspace();
  const online = workspace?.device.connectivity === "Online";
  if (!device) return <><PageHeading>Wi-Fi</PageHeading><PageText role="status">{online ? "Connected" : "No internet connection"}</PageText></>;
  return <WifiNetworks runtime={device} online={online} onFix={() => { if (can(fix)) void send(fix); }} />;
}

const row = (offer: Offer): WifiNetwork => ({ name: offer.name, signal: offer.signal, locked: offer.network.authentication !== "OpenNetwork" });

function notice(n: NetworkJoin, name: string) {
  if (n.phase === "JoinFailed") return `${n.explanation} ${fixSteps}`;
  if (n.phase === "JoinUnconfirmed") return "The tablet is online, but Android didn’t say on which network.";
  if (n.phase === "PortalEntry") return `Sign in to ${name} on the page Android shows.`;
  return undefined;
}

/** @model spec/app/network.md */
export function WifiNetworks({ runtime, online, onFix }: { runtime: WifiRuntime; online: boolean; onFix: () => void }) {
  const { state: n, can, send } = useMachine(runtime);
  const page = runtime.runSync(Effect.service(WifiPage));
  const offers = useSyncExternalStore(page.offers.subscribe, page.offers.current);
  const [password, setPassword] = useState("");
  if (!n) return null;
  const person = (event: Event) => { if (can(event, "Person")) void send(event, "Person"); };
  const run = (effect: Effect.Effect<void>) => void runtime.runPromise(effect);
  const name = offers.find((offer) => offer.network.id === n.selected.id)?.name ?? "";

  if (n.phase === "PrivateEntry") return (
    <WifiJoinForm network={name} password={password} showPassword={n.privateVisible}
      onPasswordChange={(typed) => {
        setPassword(typed);
        if ((typed !== "") !== n.entryReady) person({ type: "reportEntry", version: n.version, ready: typed !== "" });
      }}
      onShowPasswordChange={(visible) => person({ type: "showPrivate", visible })}
      error={n.explanation && (helpOffered(n) ? `${n.explanation} ${fixSteps}` : n.explanation)}
      onJoin={() => { setPassword(""); run(page.join(password)); }}
      onCancel={() => { setPassword(""); person({ type: "cancel" }); }} />
  );

  const current = online ? offers.find((offer) => offer.network.remembered) : undefined;
  const action = listAction(n.discovery);
  const act = { NoAction: () => {}, OpenPanel: () => run(page.openPanel()), Explain: () => person({ type: "explainLocation" }), Allow: () => run(page.allowLocation()), Rescan: () => person({ type: "rescan" }) }[action];
  const said = notice(n, name);
  return (
    <>
      <WifiNetworkList status={statuses[n.discovery]} current={current && row(current)} networks={offers.filter((offer) => offer !== current).map(row)}
        expanded={n.expanded} onExpandedChange={(expanded) => person({ type: "expand", expanded })}
        connecting={n.phase === "Joining" || n.phase === "AndroidPanel" || n.phase === "PortalEntry" ? name : undefined}
        failed={n.phase === "JoinFailed" ? name : undefined} onRetry={() => run(page.retry())}
        onTurnOn={() => run(page.openPanel())} onFix={onFix}
        onSelect={(picked) => {
          const offer = offers.find((candidate) => candidate.name === picked);
          if (offer && can({ type: "choose", network: offer.network }, "Person")) run(page.choose(offer));
        }}
        noneLabel={reasons[n.discovery]}
        action={action !== "NoAction" && <Button variant="prominent" size="pill" onClick={act}>{actionLabels[action]}</Button>} />
      {said && <Alert variant={n.phase === "JoinFailed" ? "caution" : "info"} className="mt-4">{said}</Alert>}
      {!online && n.discovery !== "WifiOff" && <Alert variant="info" className="mt-4">{offlineSteps}</Alert>}
    </>
  );
}

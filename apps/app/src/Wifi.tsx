// spec/app/network.md, "Story: Join the network I choose"; spec/app/network.md, "Story: See why no networks are listed"; spec/app/network.md, "The password goes from Grace's field to Android only, and Show never shares it with Grace"; spec/app/network.md, "Wi-Fi sign-in opens in Grace's browser"
import { Alert, Button, PageHeading, PageText, WifiJoinForm, WifiNetworkList, type WifiNetwork, type WifiStatus } from "@repo/ui";
import { Effect, ManagedRuntime } from "effect";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type { Machine } from "../gen/app__network.effect.vibe";
import { type Discovery, type Event, type ListAction, type NetworkJoin, helpOffered, listAction, wifiSignInOffered } from "../gen/app__network.ts";
import { useMachine } from "../gen/app__network.react.ts";
import { enabled, type Workspace } from "../gen/app__workspace.ts";
import { wifiPlugin } from "./surfacePlugin.ts";
import { graceWifi } from "./preferencesPlugin.ts";
import { shallowEqual, useWorkspaceActions, useWorkspaceSelector } from "./useApp.ts";
import { type Offer, WifiPage, ssidOf, wifiPage } from "./wifi.vibe";

export type WifiRuntime = ManagedRuntime.ManagedRuntime<WifiPage | Machine, never>;

let cachedDevice: WifiRuntime | undefined;
function getDeviceRuntime(): WifiRuntime | undefined {
  if (!wifiPlugin || !graceWifi) return undefined;
  cachedDevice ??= ManagedRuntime.make(wifiPage(wifiPlugin, graceWifi));
  return cachedDevice;
}

const wifiPages = new WeakMap<WifiRuntime, WifiPage["Service"]>();
function wifiPageFor(runtime: WifiRuntime): WifiPage["Service"] {
  const known = wifiPages.get(runtime);
  if (known) return known;
  const page = runtime.runSync(Effect.service(WifiPage));
  wifiPages.set(runtime, page);
  return page;
}

const statuses: Readonly<Record<Discovery["tag"], WifiStatus>> = {
  Scanning: "scanning", WifiOff: "off", NetworksFound: "ready", Unmanaged: "none", NoNetworks: "none",
};
const reasons: Readonly<Partial<Record<Discovery["tag"], string>>> = {
  Unmanaged: "Grace doesn’t manage this tablet, so Android shows the networks nearby.",
  NoNetworks: "No networks nearby.",
};
const actionLabels: Readonly<Record<ListAction, string>> = { NoAction: "", TurnOn: "Turn on", OpenPanel: "Open Android’s Wi-Fi", Rescan: "Look again" };
const fixSteps = "Check the password on the internet box; capitals count. If it still won’t join, ask whoever looks after this network.";
const offlineSteps = "Check that the internet box is plugged in and its lights are on, then choose your network below. Its password is often on a sticker on the box.";
const fix = { type: "openGrace" } as const;
const showBrowser = { type: "visit", destination: "Browser" } as const;
const portalProbe = "http://connectivitycheck.gstatic.com/generate_204";
const signInPage = { type: "changePage", browserInput: { tag: "Navigate", url: portalProbe } } as const;
const unnamed: WifiNetwork = { name: "Internet connection" };

const selectWifiWorkspace = (workspace: Workspace | undefined) => ({
  online: workspace?.device.connectivity === "Online",
  canFix: workspace !== undefined && enabled(workspace, fix, "Person"),
});

export function Wifi() {
  const { online, canFix } = useWorkspaceSelector(selectWifiWorkspace, shallowEqual);
  const { send } = useWorkspaceActions();
  const device = getDeviceRuntime();
  const onFix = useCallback(() => { if (canFix) void send(fix); }, [canFix, send]);
  const onSignIn = useCallback(() => { void send(showBrowser).then(() => send(signInPage)); }, [send]);
  if (!device) return <><PageHeading>Wi-Fi</PageHeading><PageText role="status">{online ? "Connected" : "No internet connection"}</PageText></>;
  return <WifiNetworks runtime={device} online={online} onFix={onFix} onSignIn={onSignIn} />;
}

const row = (offer: Offer): WifiNetwork => ({ id: offer.network.id, name: offer.name, signal: offer.signal, locked: offer.network.authentication !== "OpenNetwork" });

function notice(n: NetworkJoin, name: string) {
  if (n.phase === "JoinFailed") return n.selected.authentication === "SharedPassword"
    ? `${n.explanation} ${fixSteps}`
    : `${n.explanation} Move closer and try again. If it still won’t connect, ask whoever looks after this network.`;
  if (n.phase === "JoinUnconfirmed") return `Android hasn’t confirmed the connection to ${name}.`;
  return undefined;
}

function PrivateEntry({ n, name, person, join }: { n: NetworkJoin; name: string; person: (event: Event) => void; join: (password: string) => void }) {
  const [password, setPassword] = useState("");
  return (
    <WifiJoinForm network={name} password={password} showPassword={n.privateVisible}
      onPasswordChange={(typed) => {
        setPassword(typed);
        if ((typed !== "") !== n.entryReady) person({ type: "reportEntry", version: n.version, ready: typed !== "" });
      }}
      onShowPasswordChange={(visible) => person({ type: "showPrivate", visible })}
      error={n.explanation && (helpOffered(n) ? `${n.explanation} ${fixSteps}` : n.explanation)}
      onJoin={() => { setPassword(""); join(password); }}
      onCancel={() => person({ type: "cancel" })} />
  );
}

/** @model spec/app/network.md */
export function WifiNetworks({ runtime, online, onFix, onSignIn }: { runtime: WifiRuntime; online: boolean; onFix: () => void; onSignIn: () => void }) {
  const { state: n, can, send } = useMachine(runtime);
  const page = wifiPageFor(runtime);
  const { nearby: offers, connected: identified, signInRequired, wifiValidated } = useSyncExternalStore(page.offers.subscribe, page.offers.current);
  const offersById = useMemo(() => new Map(offers.map((offer) => [offer.network.id, offer])), [offers]);
  const discovery = n?.discovery;
  const nearby = useMemo(() => (
    discovery?.tag === "NetworksFound"
      ? discovery.networks.flatMap((network) => {
          const offer = offersById.get(network.id);
          return offer && network.id !== identified?.id ? [row(offer)] : [];
        })
      : []
  ), [discovery, offersById, identified?.id]);
  if (!n) return null;
  const person = (event: Event) => { if (can(event, "Person")) void send(event, "Person"); };
  const run = (effect: Effect.Effect<void>) => void runtime.runPromise(effect);
  const name = ssidOf(n);
  if (n.phase === "PrivateEntry") return <PrivateEntry key={n.version} n={n} name={name} person={person} join={(password) => run(page.join(password))} />;

  const connected = identified ?? (online ? unnamed : undefined);
  const action = listAction(n.discovery);
  const act = () => {
    switch (action) {
      case "TurnOn": return run(page.turnOn());
      case "OpenPanel": return run(page.openPanel());
      case "Rescan": return person({ type: "rescan" });
      case "NoAction": return;
    }
  };
  const signIn = wifiSignInOffered(n, signInRequired, wifiValidated);
  const said = notice(n, name);
  return (
    <>
      <WifiNetworkList status={statuses[n.discovery.tag]} current={signIn ? undefined : connected} networks={nearby}
        offlineLabel={signIn ? "Wi-Fi sign-in required" : undefined}
        offlineHint={signIn ? "This network asks you to sign in on its page first." : undefined}
        fixLabel={signIn ? "Sign in to this network" : undefined}
        expanded={n.expanded} onExpandedChange={(expanded) => person({ type: "expand", expanded })}
        connecting={n.phase === "Joining" || n.phase === "PortalEntry" ? n.selected.id : undefined}
        failed={n.phase === "JoinFailed" ? n.selected.id : undefined} onRetry={() => run(page.retry())}
        onTurnOn={() => run(page.turnOn())} onFix={signIn ? onSignIn : onFix}
        onSelect={(picked) => {
          const offer = offersById.get(picked);
          if (offer && can({ type: "choose", network: offer.network }, "Person")) run(page.choose(offer));
        }}
        noneLabel={reasons[n.discovery.tag]}
        action={action !== "NoAction" && <Button variant="prominent" size="pill" onClick={act}>{actionLabels[action]}</Button>} />
      {said && <Alert variant={n.phase === "JoinFailed" ? "caution" : "info"} className="mt-4">{said}</Alert>}
      {!connected && !signIn && n.discovery.tag !== "WifiOff" && <Alert variant="info" className="mt-4">{offlineSteps}</Alert>}
    </>
  );
}

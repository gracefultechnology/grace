// spec/app/network.md, "Story: Join the network I choose"; spec/app/network.md, "Story: See why no networks are listed"; spec/app/network.md, "The password goes from Grace's field to Android only, and Show never shares it with Grace"; spec/app/network.md, "Wi-Fi sign-in opens in Grace's browser"
import { Alert, Button, PageHeading, PageText, WifiJoinForm, WifiNetworkList, type WifiNetwork, type WifiStatus } from "@repo/ui";
import { Effect, Exit, ManagedRuntime } from "effect";
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

const deviceWifiStore = (() => {
  let active: WifiRuntime | undefined;
  let subscribers = 0;
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of listeners) listener();
  };
  return {
    get: () => active,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      subscribers += 1;
      if (!active && wifiPlugin && graceWifi) {
        active = ManagedRuntime.make(wifiPage(wifiPlugin, graceWifi));
        emit();
      }
      return () => {
        listeners.delete(listener);
        subscribers -= 1;
        if (subscribers === 0 && active) {
          const closing = active;
          active = undefined;
          void closing.dispose();
        }
      };
    },
  };
})();

type WifiOfferSnapshot = ReturnType<WifiPage["Service"]["offers"]["current"]>;
const emptyOffers: WifiOfferSnapshot = { nearby: [], connected: undefined, signInRequired: false, wifiValidated: false };

type WifiPageStore = {
  readonly subscribe: (listener: () => void) => () => void;
  readonly getPage: () => WifiPage["Service"] | undefined;
  readonly getOffers: () => WifiOfferSnapshot;
};

const wifiPageStores = new WeakMap<WifiRuntime, WifiPageStore>();

function wifiPageStoreFor(runtime: WifiRuntime): WifiPageStore {
  const known = wifiPageStores.get(runtime);
  if (known) return known;
  let page: WifiPage["Service"] | undefined;
  let offers: WifiOfferSnapshot = emptyOffers;
  let loading = false;
  let unsubscribeOffers: (() => void) | undefined;
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of listeners) listener();
  };
  const subscribeOffers = (resolved: WifiPage["Service"]) => {
    offers = resolved.offers.current();
    if (listeners.size > 0 && !unsubscribeOffers) {
      unsubscribeOffers = resolved.offers.subscribe(() => {
        const next = resolved.offers.current();
        if (Object.is(offers, next)) return;
        offers = next;
        emit();
      });
    }
  };
  const store: WifiPageStore = {
    getPage: () => page,
    getOffers: () => offers,
    subscribe: (listener) => {
      listeners.add(listener);
      if (page) {
        subscribeOffers(page);
      } else if (!loading) {
        loading = true;
        void runtime.runPromise(Effect.service(WifiPage)).then(
          (resolved) => {
            loading = false;
            page = resolved;
            subscribeOffers(resolved);
            emit();
          },
          () => { loading = false; },
        );
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          unsubscribeOffers?.();
          unsubscribeOffers = undefined;
        }
      };
    },
  };
  wifiPageStores.set(runtime, store);
  return store;
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
});

export function Wifi() {
  const { online } = useWorkspaceSelector(selectWifiWorkspace, shallowEqual);
  const { current, send } = useWorkspaceActions();
  const device = useSyncExternalStore(deviceWifiStore.subscribe, deviceWifiStore.get, deviceWifiStore.get);
  const onFix = useCallback(() => {
    if (enabled(current(), fix, "Person")) void send(fix);
  }, [current, send]);
  const onSignIn = useCallback(() => {
    if (!enabled(current(), showBrowser, "Person")) return;
    void send(showBrowser).then((exit) => {
      if (Exit.isSuccess(exit) && enabled(current(), signInPage, "Person")) void send(signInPage);
    });
  }, [current, send]);
  if (!wifiPlugin || !graceWifi) return <><PageHeading>Wi-Fi</PageHeading><PageText role="status">{online ? "Connected" : "No internet connection"}</PageText></>;
  if (!device) return null;
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
  const pageStore = wifiPageStoreFor(runtime);
  const page = useSyncExternalStore(pageStore.subscribe, pageStore.getPage, pageStore.getPage);
  const { nearby: offers, connected: identified, signInRequired, wifiValidated } = useSyncExternalStore(pageStore.subscribe, pageStore.getOffers, pageStore.getOffers);
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
  if (!n || !page) return null;
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

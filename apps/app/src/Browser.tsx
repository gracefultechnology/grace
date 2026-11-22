// spec/app/browser.md, "Story: Sign in privately on a website"; spec/app/browserControls.md, "Only the person can open a verification app from the current private tab"; spec/app/browserControls.md, "A new-mail hint belongs to one approved private visit"; spec/app/browser.md, "The padlock shows only on a page that loaded over a secure connection"
// spec/app/browser.md, "Story: Browse and return to the page I left"; spec/app/browserControls.md, "Story: Use every browser control without bypassing Grace's interruption boundary"; spec/app/browser.md, "Typed text that is not a web address searches with the default provider"; spec/app/browser.md, "Overflow retains the selected tab and the most recently used other tabs in opening order"; spec/app/browser.md, "A page that moves by itself keeps the address the person is typing"; spec/app/browser.md, "Load results must match the tab and request that produced them"; spec/app/browser.md, "Address entry preserves a draft and empty Go gives a visible explanation"; spec/app/browser.md, "Recent websites can be removed individually or cleared after one confirmation"
import { AddressBar, BrowserPageState, BrowserTabStrip, BrowserToolbar, BrowserWindow, Button, NewTabPage } from "@repo/ui";
import { CircleHelp } from "lucide-react";
import { type ComponentProps, useCallback, useRef, useState } from "react";
import { canStepPrivate, type HistoryDirection } from "../gen/app__deviceKeys.ts";
import { useMachine as useSetup } from "../gen/app__setup.react.ts";
import { historyFor, pageShows } from "../gen/app__surface.ts";
import { type BrowserInput, type PrivateInboxVisit, canOpenPrivateVerificationApp, canWatchPrivateInbox } from "../gen/app__browserControls.ts";
import { type Browser as BrowserModel, type Load, type Tab, type TypedAddress, activeTab, addressDestination, overflowTabs, showsSecureIndicator, tabUrl, visibleTabs } from "../gen/app__browser.ts";
import { parseBrowserAddressInput } from "@elizaos/os/browser/address";
import { OverPage, PageArea, useWatch } from "./PageLayer.tsx";
import { watchInboxArrival } from "./inboxArrival.vibe";
import { Part, type VerificationAppHandoff } from "./page.vibe";
import { useDraft, usePasswordGuide, usePageLayer, useRuntime, useWorkspace } from "./useApp.ts";
import type { PrivateVerificationApp } from "./surfacePlugin.ts";
import { WebsiteRequests, site } from "./WebsiteRequests.tsx";

const tabStrip = Part.Strip();

const failures: Partial<Record<Load, string>> = { LoadFailed: "This page didn't open.", SecurityBlocked: "This page isn't safe to open." };

const emptyAddress = "Type a website or what you’re looking for.";

const goWord = "Go";

const tabItem = (tab: Tab) => ({ id: tab.id, title: tab.manualSignIn ? "Private sign-in" : tabUrl(tab) === "" ? "New tab" : site(tabUrl(tab)), initial: site(tabUrl(tab)).slice(0, 1).toUpperCase() || undefined, pageLoading: tab.load === "Loading" });

function typed(text: string): TypedAddress {
  const parsed = parseBrowserAddressInput(text, { defaultProtocol: "https:" });
  switch (parsed.kind) {
    case "url": return { tag: "WebAddress", url: parsed.href };
    case "search": return { tag: "SearchWords", query: parsed.query };
    case "rejected": return { tag: "NoAddress" };
  }
}

function destination(text: string): string | undefined {
  const to = addressDestination(typed(text));
  switch (to.tag) {
    case "Visit": return to.url;
    case "Search": return `${to.provider}${encodeURIComponent(to.query)}`;
    case "Nowhere": return undefined;
    default: {
      const unreached: never = to;
      return unreached;
    }
  }
}

function secureOrigin(address: string): string {
  const parsed = URL.parse(address);
  return parsed?.protocol === "https:" && !parsed.username && !parsed.password ? parsed.origin : "";
}

type SignInHelpProps = {
  visit: PrivateInboxVisit;
  openVerificationApp: (app: PrivateVerificationApp) => Promise<VerificationAppHandoff>;
  canWatch: boolean;
  openInbox: ((visit: PrivateInboxVisit) => void) | undefined;
  dismiss: () => void;
};

const arrivalMessages = {
  starting: "Starting new mail watch…",
  waiting: "Watching for new mail in your connected inbox.",
  arrived: "New mail arrived",
  unavailable: "New mail alerts are unavailable. You can still open email.",
  expired: "New mail watch ended.",
};

function SignInHelp({ visit, openVerificationApp, canWatch, openInbox, dismiss }: SignInHelpProps) {
  const runtime = useRuntime();
  const [handoff, setHandoff] = useState<VerificationAppHandoff | "opening">();
  const [arrival, setArrival] = useState<keyof typeof arrivalMessages>();
  const openingRef = useRef(false);
  const mountedRef = useRef(false);
  const watchingRef = useRef<AbortController | undefined>(undefined);
  const stop = useCallback(() => {
    watchingRef.current?.abort();
    watchingRef.current = undefined;
    setArrival(undefined);
  }, []);
  const watchPanel = useCallback((element: HTMLElement | null) => {
    if (!element) return;
    mountedRef.current = true;
    const visibility = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", visibility);
      watchingRef.current?.abort();
      watchingRef.current = undefined;
    };
  }, [stop]);
  const start = () => {
    if (!canWatch || watchingRef.current || document.hidden) return;
    const request = new AbortController();
    watchingRef.current = request;
    setArrival("starting");
    setHandoff(undefined);
    void runtime.runPromise(watchInboxArrival(visit, (status) => {
      if (watchingRef.current === request && !document.hidden) setArrival(status === "cleared" ? undefined : status);
    }), { signal: request.signal }).catch(() => {
      if (watchingRef.current === request && !document.hidden) setArrival("unavailable");
    }).finally(() => {
      if (watchingRef.current === request) watchingRef.current = undefined;
    });
  };
  const openApp = (app: PrivateVerificationApp) => {
    if (openingRef.current || document.hidden) return;
    stop();
    openingRef.current = true;
    setHandoff("opening");
    void openVerificationApp(app).catch((): VerificationAppHandoff => "unavailable").then((result) => {
      openingRef.current = false;
      if (mountedRef.current) setHandoff(result);
    });
  };
  return (
    <section ref={watchPanel} aria-label="Sign-in help" className="pointer-events-auto flex flex-col gap-2 bg-card px-4 py-2 text-body text-label-ink">
      <p>Choose a saved login from Android or type it on the website. Enter verification codes and submit only on the website that asked for them.</p>
      <div className="flex flex-wrap gap-2">
        {canWatch && openInbox && <Button variant="capsule" size="pill" disabled={handoff === "opening"} onClick={() => {
          if (document.hidden) return;
          stop();
          dismiss();
          openInbox(visit);
        }}>Open Grace Email</Button>}
        <Button variant="capsule" size="pill" disabled={handoff === "opening"} onClick={() => openApp("email")}>Open email app</Button>
        <Button variant="capsule" size="pill" disabled={handoff === "opening"} onClick={() => openApp("messages")}>Open messages</Button>
        {canWatch && (arrival === "starting" || arrival === "waiting" || arrival === "arrived" ?
          <Button variant="capsule" size="pill" onClick={stop}>Stop watching</Button> :
          <Button variant="capsule" size="pill" disabled={handoff === "opening"} onClick={start}>Watch for new mail</Button>)}
        <Button variant="capsule" size="pill" onClick={() => { stop(); dismiss(); }}>Dismiss</Button>
      </div>
      <p>Use the account or authenticator the website named, or check on another device. Return to this tab to finish signing in.</p>
      {arrival !== undefined && <p role="status">{arrivalMessages[arrival]}</p>}
      {handoff === "requested" && <p role="status">Android received your request. Use Back or the app switcher to return here.</p>}
      {handoff === "unavailable" && <p role="status">This app couldn’t open on this device.</p>}
      {handoff === "stale" && <p role="status">Return to the current private website and try again.</p>}
    </section>
  );
}

type PrivateToolbarProps = {
  active: Tab;
  browser: BrowserModel;
  edit: (input: BrowserInput) => void;
  offered: (direction: HistoryDirection) => boolean;
  step: (direction: HistoryDirection) => void;
  navigate: (tab: number, address: string) => Promise<boolean>;
  openVerificationApp: ((app: PrivateVerificationApp) => Promise<VerificationAppHandoff>) | undefined;
  openInbox: SignInHelpProps["openInbox"];
};

function PrivateToolbar({ active, browser, edit, offered, step, navigate, openVerificationApp, openInbox }: PrivateToolbarProps) {
  const fieldRef = useRef<HTMLInputElement>(null);
  const helpButtonRef = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const { state: account } = useSetup(useRuntime());
  const grant = account?.googleLink.tag === "GoogleLinkConnected" && account.googleLink.mail
    ? account.googleLink.grant : undefined;
  const inbox = account?.graceAccount.tag === "GraceSignedIn" && grant
    ? [account.graceAccount.accountId, grant]
    : account?.graceAccount.tag === "GraceDeviceSignedIn" ? ["device"] : undefined;
  const [help, setHelp] = useState<{ revision: number; loadVersion: number }>();
  const helpAvailable = draft === null && openVerificationApp !== undefined;
  const currentHelp = helpAvailable && help?.revision === browser.revision && help.loadVersion === active.loadVersion ? help : undefined;
  if (help && !currentHelp) setHelp(undefined);
  const go = () => {
    if (draft === null || secureOrigin(draft) === "") {
      setNotice("Enter a secure website address beginning with https://.");
      return;
    }
    const address = draft;
    setDraft(null);
    setNotice(undefined);
    fieldRef.current?.blur();
    void navigate(active.id, address).then(
      (opened) => { if (!opened) setNotice("This private address couldn't open."); },
      () => setNotice("This private address couldn't open."),
    );
  };
  return (
    <>
      <BrowserToolbar className="pointer-events-auto" canGoBack={offered("HistoryBack")} canGoForward={offered("HistoryForward")} canGo={draft !== null}
        reloadable onReload={() => edit({ tag: "Reload" })} onBack={() => step("HistoryBack")} onForward={() => step("HistoryForward")}
        onGo={go} trailing={helpAvailable ? (
          <Button ref={helpButtonRef} variant="capsule" size="pill" aria-expanded={currentHelp !== undefined} onClick={() => {
            setHelp(currentHelp ? undefined : { revision: browser.revision, loadVersion: active.loadVersion });
          }}><CircleHelp aria-hidden /> Sign-in help</Button>
        ) : undefined}>
        <AddressBar ref={fieldRef} value={draft ?? tabUrl(active)} secureAddress={showsSecureIndicator(browser, draft !== null) ? tabUrl(active) : undefined} label="Private website address" enterKeyHint="go" aria-invalid={notice !== undefined || undefined}
          notice={notice} onValueChange={(text) => { setDraft(text); setNotice(undefined); }} onSubmit={go} />
      </BrowserToolbar>
      {currentHelp && openVerificationApp && <SignInHelp key={JSON.stringify([active.id, browser.revision, active.loadVersion, inbox])}
        visit={{ tab: active.id, revision: browser.revision, loadVersion: active.loadVersion }}
        openVerificationApp={openVerificationApp} canWatch={inbox !== undefined} openInbox={openInbox}
        dismiss={() => { setHelp(undefined); helpButtonRef.current?.focus(); }} />}
    </>
  );
}

/** @model spec/app/browserControls.md */
export function Browser(props: Pick<ComponentProps<"section">, "style" | "inert" | "aria-hidden">) {
  const strip = useWatch(tabStrip);
  const { guide } = usePasswordGuide();
  const { workspace, can, send, current, closeBrowser, navigatePrivate, stepPrivate, openPrivateVerificationApp, opensWebsites } = useWorkspace();
  const layer = usePageLayer();
  const browser = workspace?.browser;
  const active = browser && activeTab(browser);
  const [address, setAddress] = useDraft(browser?.editingAddress ? browser.addressDraft : active ? tabUrl(active) : "", browser?.editingAddress ?? false);
  const fieldRef = useRef<HTMLInputElement>(null);
  const [listingTabs, setListingTabs] = useState(false);
  if (!workspace || !browser || !active) return null;
  const overflow = overflowTabs(browser);
  if (listingTabs && overflow.length === 0) setListingTabs(false);
  const offered = (browserInput: BrowserInput) => can({ type: "changePage", browserInput });
  const edit = (browserInput: BrowserInput) => { if (offered(browserInput)) void send({ type: "changePage", browserInput }); };
  const url = destination(address);
  const going: BrowserInput = url === undefined ? { tag: "ExplainEmptyAddress" } : url === tabUrl(active) ? { tag: "Reload" } : { tag: "Navigate", url };
  const go = () => {
    edit(going);
    if (url === undefined) return fieldRef.current?.focus();
    edit({ tag: "DismissAddress" });
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  };
  const email = { type: "visit", destination: "Email" } as const;
  const openConnectedInbox = (visit: PrivateInboxVisit) => {
    const now = current();
    if (pageShows(now.device, now.assistant) && canWatchPrivateInbox(now.browser, visit)) void send(email);
  };
  const fixWifi = { type: "chooseSettingsPage", page: "NetworkSettings" } as const;
  const secureAddress = showsSecureIndicator(browser, false) ? tabUrl(active) : undefined;
  const failure = failures[active.load];
  const privateFailure = active.manualSignIn && active.load === "LoadFailed";
  const fillNotice = guide === "FillPasswordGuide"
    ? secureOrigin(tabUrl(active)) === "" ? "Open a secure website first." : "Ask Grace to use a saved password."
    : undefined;

  return (
    <BrowserWindow aria-label="Internet" className="bg-transparent" {...props}
      tabStrip={
        <BrowserTabStrip ref={strip} className="pointer-events-auto" selectedId={browser.selected}
          tabs={visibleTabs(browser).map(tabItem)} overflow={overflow.map(tabItem)} overflowOpen={listingTabs} onOverflowOpenChange={setListingTabs}
          onSelectTab={(id) => edit({ tag: "SelectTab", id })} onCloseTab={(id) => edit({ tag: "CloseTab", id })}
          onNewTab={() => edit({ tag: "NewTab" })} onCloseBrowser={() => { if (can({ type: "closeBrowser" })) void closeBrowser(); }} />
      }
      toolbar={active.manualSignIn ? <PrivateToolbar key={active.id} active={active} browser={browser} edit={edit} navigate={navigatePrivate}
        offered={(direction) => !!layer && canStepPrivate(workspace.device, browser, historyFor(layer, active.id), direction)}
        step={(direction) => void stepPrivate(active.id, direction)} openInbox={can(email) ? openConnectedInbox : undefined}
        openVerificationApp={pageShows(workspace.device, workspace.assistant) && canOpenPrivateVerificationApp(browser, active.id, browser.revision, "BrowserControlUser") ? (app) => openPrivateVerificationApp(active.id, browser.revision, app) : undefined} /> : (
        <BrowserToolbar className="pointer-events-auto" canGoBack={offered({ tag: "Back" })} canGoForward={offered({ tag: "Forward" })} canGo={offered(going)}
          reloadable={tabUrl(active) !== ""} onReload={() => edit({ tag: "Reload" })}
          onBack={() => edit({ tag: "Back" })} onForward={() => edit({ tag: "Forward" })} goLabel={goWord} onGo={go}>
          <AddressBar ref={fieldRef} value={address} secureAddress={secureAddress} enterKeyHint="go" aria-invalid={browser.emptyAddressNotice || undefined} notice={browser.emptyAddressNotice ? emptyAddress : fillNotice}
            onValueChange={(text) => { setAddress(text); edit({ tag: "EditAddress", text }); }}
            onSubmit={go} onBlur={(event) => { if (event.relatedTarget?.textContent !== goWord) edit({ tag: "DismissAddress" }); }} />
        </BrowserToolbar>
      )}>
      <PageArea className="absolute inset-0 rounded-b-window" />
      {listingTabs && <OverPage className="absolute inset-0 rounded-b-window" />}
      {browser.emptyAddressNotice && <OverPage className="absolute inset-x-0 top-0 h-20" />}
      {tabUrl(active) === "" && (
        <OverPage className="absolute inset-0 overflow-hidden rounded-b-window">
          <NewTabPage shortcuts={browser.recent.map((url) => ({ url, title: site(url) }))} onOpenShortcut={(url) => edit({ tag: "Navigate", url })}
            removable onRemoveShortcut={(url) => edit({ tag: "RemoveRecent", url })}
            clearable onClear={() => edit({ tag: "RequestClearHistory" })} confirmingClear={browser.clearRequested}
            onConfirmClear={() => edit({ tag: "AnswerClearHistory", confirmed: true })} onCancelClear={() => edit({ tag: "AnswerClearHistory", confirmed: false })} />
        </OverPage>
      )}
      {failure !== undefined && (
        <OverPage className="absolute inset-0 overflow-hidden rounded-b-window">
          <BrowserPageState kind={workspace.device.connectivity === "Online" ? "failed" : "offline"}
            labels={{ failed: () => privateFailure ? "Private sign-in couldn’t open" : failure }}
            message={privateFailure ? "Check your internet connection. If it still won’t open, update Android System WebView in the Play Store."
              : !opensWebsites && active.load === "LoadFailed" ? "Websites open in Grace on the tablet. Here Grace opens only pages served from this computer." : undefined}
            onRetry={() => edit({ tag: "Reload" })} onFixWifi={() => { if (can(fixWifi)) void send(fixWifi); }} />
        </OverPage>
      )}
      {!active.manualSignIn && <WebsiteRequests />}
    </BrowserWindow>
  );
}

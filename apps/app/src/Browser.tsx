// spec/app/browser.md, "Story: Sign in privately on a website"
// spec/app/browser.md, "Story: Browse and return to the page I left"; spec/app/browserControls.md, "Story: Use every browser control without bypassing Grace's interruption boundary"; spec/app/browser.md, "Typed text that is not a web address searches with the default provider"; spec/app/browser.md, "Overflow retains the selected tab and the most recently used other tabs in opening order"; spec/app/browser.md, "A page that moves by itself keeps the address the person is typing"; spec/app/browser.md, "Load results must match the tab and request that produced them"; spec/app/browser.md, "Address entry preserves a draft and empty Go gives a visible explanation"; spec/app/browser.md, "Recent websites can be removed individually or cleared after one confirmation"
import { AddressBar, BrowserPageState, BrowserTabStrip, BrowserToolbar, BrowserWindow, NewTabPage } from "@repo/ui";
import { LockKeyhole } from "lucide-react";
import { type ComponentProps, useRef, useState } from "react";
import type { BrowserInput } from "../gen/app__browserControls.ts";
import { type Load, type Tab, type TypedAddress, activeTab, addressDestination, overflowTabs, tabUrl, visibleTabs } from "../gen/app__browser.ts";
import { parseBrowserAddressInput } from "@elizaos/os/browser/address";
import { OverPage, PageArea, useWatch } from "./PageLayer.tsx";
import { Part } from "./page.vibe";
import { useDraft, usePasswordGuide, useWorkspace } from "./useApp.ts";
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

type PrivateToolbarProps = {
  active: Tab;
  edit: (input: BrowserInput) => void;
  offered: (input: BrowserInput) => boolean;
  navigate: (tab: number, address: string) => Promise<boolean>;
};

function PrivateToolbar({ active, edit, offered, navigate }: PrivateToolbarProps) {
  const fieldRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | undefined>(undefined);
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
    <BrowserToolbar className="pointer-events-auto" canGoBack={offered({ tag: "Back" })} canGoForward={offered({ tag: "Forward" })} canGo={draft !== null}
      reloadable onReload={() => edit({ tag: "Reload" })} onBack={() => edit({ tag: "Back" })} onForward={() => edit({ tag: "Forward" })}
      onGo={go} trailing={<span className="flex items-center gap-2 whitespace-nowrap text-body"><LockKeyhole aria-hidden /> Private sign-in</span>}>
      <AddressBar ref={fieldRef} value={draft ?? tabUrl(active)} label="Private website address" enterKeyHint="go" aria-invalid={notice !== undefined || undefined}
        notice={notice} onValueChange={(text) => { setDraft(text); setNotice(undefined); }} onSubmit={go} />
    </BrowserToolbar>
  );
}

/** @model spec/app/browserControls.md */
export function Browser(props: Pick<ComponentProps<"section">, "style" | "inert" | "aria-hidden">) {
  const strip = useWatch(tabStrip);
  const { guide } = usePasswordGuide();
  const { workspace, can, send, closeBrowser, navigatePrivate } = useWorkspace();
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
  const fixWifi = { type: "chooseSettingsPage", page: "NetworkSettings" } as const;
  const failure = failures[active.load];
  const privateFailure = active.manualSignIn && active.load === "LoadFailed";

  return (
    <BrowserWindow aria-label="Internet" className="bg-transparent" {...props}
      tabStrip={
        <BrowserTabStrip ref={strip} className="pointer-events-auto" selectedId={browser.selected}
          tabs={visibleTabs(browser).map(tabItem)} overflow={overflow.map(tabItem)} overflowOpen={listingTabs} onOverflowOpenChange={setListingTabs}
          onSelectTab={(id) => edit({ tag: "SelectTab", id })} onCloseTab={(id) => edit({ tag: "CloseTab", id })}
          onNewTab={() => edit({ tag: "NewTab" })} onCloseBrowser={() => { if (can({ type: "closeBrowser" })) void closeBrowser(); }} />
      }
      toolbar={active.manualSignIn ? <PrivateToolbar key={active.id} active={active} edit={edit} offered={offered} navigate={navigatePrivate} /> : (
        <BrowserToolbar className="pointer-events-auto" canGoBack={offered({ tag: "Back" })} canGoForward={offered({ tag: "Forward" })} canGo={offered(going)}
          reloadable={tabUrl(active) !== ""} onReload={() => edit({ tag: "Reload" })}
          onBack={() => edit({ tag: "Back" })} onForward={() => edit({ tag: "Forward" })} goLabel={goWord} onGo={go}>
          <AddressBar ref={fieldRef} value={address} enterKeyHint="go" aria-invalid={browser.emptyAddressNotice || undefined} notice={browser.emptyAddressNotice ? emptyAddress : guide === "FillPasswordGuide" && secureOrigin(tabUrl(active)) === "" ? "Open a secure website first." : undefined}
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
            message={privateFailure ? "Check your internet connection. If it still won’t open, update Android System WebView in the Play Store." : undefined}
            onRetry={() => edit({ tag: "Reload" })} onFixWifi={() => { if (can(fixWifi)) void send(fixWifi); }} />
        </OverPage>
      )}
      {!active.manualSignIn && <WebsiteRequests />}
    </BrowserWindow>
  );
}

// spec/app/browser.md, "Story: Browse and return to the page I left"; spec/app/browserControls.md, "Story: Use every browser control without bypassing Grace's interruption boundary"; spec/app/browser.md, "Typed text that is not a web address searches with the default provider"; spec/app/browser.md, "Overflow retains the selected tab and the most recently used other tabs in opening order"; spec/app/browser.md, "A page that moves by itself keeps the address the person is typing"
import { AddressBar, BrowserPageState, BrowserTabStrip, BrowserToolbar, BrowserWindow, NewTabPage } from "@repo/ui";
import { Effect } from "effect";
import { type ComponentProps, useCallback } from "react";
import type { BrowserInput } from "../gen/app__browserControls.ts";
import { type TypedAddress, activeTab, addressDestination, tabUrl, visibleTabs } from "../gen/app__browser.ts";
import { Machine as Workspaces } from "../gen/app__workspace.effect.vibe";
import { parseBrowserAddressInput } from "../../../vendor/eliza/packages/contracts/src/browser-address-input.ts";
import { OverPage, PageArea } from "./PageLayer.tsx";
import { useDraft, useRuntime, useWorkspace } from "./useApp.ts";
import { WebsiteRequests, site } from "./WebsiteRequests.tsx";

const TAB_WIDTH = 240;
const STRIP_SPARE = 140;

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
  }
}

const resizeTabs = (width: number) => Effect.flatMap(Effect.service(Workspaces), (workspaces) => Effect.flatMap(workspaces.get(), ({ browser }) => {
  const capacity = Math.max(1, Math.floor((width - STRIP_SPARE) / TAB_WIDTH));
  return capacity === browser.capacity ? Effect.void
    : Effect.ignore(workspaces.send({ type: "changePage", browserInput: { tag: "ResizeTabs", revision: browser.revision, capacity } }, "Host"));
}));

/** @model spec/app/browserControls.md */
export function Browser(props: Pick<ComponentProps<"section">, "style" | "inert" | "aria-hidden">) {
  const runtime = useRuntime();
  const { workspace, can, send, closeBrowser } = useWorkspace();
  const strip = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => runtime.runFork(resizeTabs(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [runtime]);
  const browser = workspace?.browser;
  const active = browser && activeTab(browser);
  const [address, setAddress] = useDraft(browser?.editingAddress ? browser.addressDraft : active ? tabUrl(active) : "", browser?.editingAddress ?? false);
  if (!workspace || !browser || !active) return null;
  const offered = (browserInput: BrowserInput) => can({ type: "changePage", browserInput });
  const edit = (browserInput: BrowserInput) => { if (offered(browserInput)) void send({ type: "changePage", browserInput }); };
  const go = () => {
    const url = destination(address);
    edit(url ? { tag: "Navigate", url } : { tag: "ExplainEmptyAddress" });
    if (url && document.activeElement instanceof HTMLElement) document.activeElement.blur();
  };
  const fixWifi = () => void send({ type: "visit", destination: "DeviceSettings" }).then(() => send({ type: "chooseSettingsPage", page: "NetworkSettings" }));
  const failed = active.load === "LoadFailed" || active.load === "SecurityBlocked";

  return (
    <BrowserWindow aria-label="Internet" className="bg-transparent" {...props}
      tabStrip={
        <BrowserTabStrip ref={strip} selectedId={browser.selected}
          tabs={visibleTabs(browser).map((tab) => ({ id: tab.id, title: tabUrl(tab) === "" ? "New tab" : site(tabUrl(tab)), initial: site(tabUrl(tab)).slice(0, 1).toUpperCase() || undefined }))}
          onSelectTab={(id) => edit({ tag: "SelectTab", id })} onCloseTab={(id) => edit({ tag: "CloseTab", id })}
          onNewTab={() => edit({ tag: "NewTab" })} onCloseBrowser={() => { if (can({ type: "closeBrowser" })) void closeBrowser(); }} />
      }
      toolbar={
        <BrowserToolbar canGoBack={offered({ tag: "Back" })} canGoForward={offered({ tag: "Forward" })} canGo={address !== ""}
          reloadable={offered({ tag: "Reload" })} onReload={() => edit({ tag: "Reload" })}
          onBack={() => edit({ tag: "Back" })} onForward={() => edit({ tag: "Forward" })} onGo={go}>
          <AddressBar value={address} enterKeyHint="go" aria-invalid={browser.emptyAddressNotice || undefined}
            onValueChange={(text) => { setAddress(text); edit({ tag: "EditAddress", text }); }}
            onSubmit={go} onBlur={() => edit({ tag: "DismissAddress" })} />
        </BrowserToolbar>
      }>
      <PageArea className="absolute inset-0 rounded-b-window" />
      {tabUrl(active) === "" && (
        <OverPage className="absolute inset-0 overflow-hidden rounded-b-window">
          <NewTabPage shortcuts={browser.recent.map((url) => ({ url, title: site(url) }))} onOpenShortcut={(url) => edit({ tag: "Navigate", url })} />
        </OverPage>
      )}
      {failed && (
        <OverPage className="absolute inset-0 overflow-hidden rounded-b-window">
          <BrowserPageState site={site(tabUrl(active))}
            kind={active.load === "SecurityBlocked" ? "blocked" : workspace.device.connectivity === "Online" ? "failed" : "offline"}
            onRetry={() => edit({ tag: "Reload" })} onBack={() => edit({ tag: "Back" })} onFixWifi={fixWifi} />
        </OverPage>
      )}
      <WebsiteRequests />
    </BrowserWindow>
  );
}

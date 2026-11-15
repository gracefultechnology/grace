// spec/app/browser.md, "Story: Browse and return to the page I left"; spec/app/browserControls.md, "Story: Use every browser control without bypassing Grace's interruption boundary"
// The browser window: folder tabs and a toolbar over the page, which is the native page below the
// interface, or the new-tab page for a blank tab.
import { AddressBar, BrowserTabStrip, BrowserToolbar, BrowserWindow, Button, EmptyState, NewTabPage } from "@repo/ui";
import { CloudOff, RotateCw, ShieldAlert } from "lucide-react";
import { type ComponentProps, useCallback, useEffect, useState } from "react";
import type { BrowserInput } from "../gen/app__browserControls.ts";
import { activeTab, tabUrl, visibleTabs } from "../gen/app__browser.ts";
import { parseBrowserAddressInput } from "../../../vendor/eliza/packages/contracts/src/browser-address-input.ts";
import { OverPage, PageArea } from "./PageLayer.tsx";
import { useDraft, useWorkspace } from "./useApp.ts";
import { WebsiteRequests, site } from "./WebsiteRequests.tsx";

/** The prototype's folder tab is 240px wide; the strip keeps room for New tab and Close browser. */
const TAB_WIDTH = 240;
const STRIP_SPARE = 140;

/** What the person sees in place of a page that did not load (spec/app/browser.md, "Load results must match the tab and request that produced them"). */
const failures = {
  LoadFailed: { title: "This page didn't open.", icon: <CloudOff size={56} strokeWidth={1.6} /> },
  SecurityBlocked: { title: "This page isn't safe to open.", icon: <ShieldAlert size={56} strokeWidth={1.6} /> },
};

/** What an address or search typed into the address field opens; nothing for one that names no web page. */
function destination(text: string): string | undefined {
  const parsed = parseBrowserAddressInput(text, { defaultProtocol: "https:" });
  if (parsed.kind === "url") return parsed.href;
  if (parsed.kind === "search") return `https://duckduckgo.com/?q=${encodeURIComponent(parsed.query)}`;
}

/** @model spec/app/browserControls.md */
export function Browser(props: Pick<ComponentProps<"section">, "style" | "inert" | "aria-hidden">) {
  const { workspace, can, send, closeBrowser } = useWorkspace();
  const browser = workspace!.browser;
  const active = activeTab(browser);
  const offered = (browserInput: BrowserInput) => can({ type: "changePage", browserInput });
  const edit = (browserInput: BrowserInput) => { if (offered(browserInput)) void send({ type: "changePage", browserInput }); };
  // spec/app/browser.md, "A page that moves by itself keeps the address the person is typing"
  const [address, setAddress] = useDraft(browser.editingAddress ? browser.addressDraft : tabUrl(active), browser.editingAddress);
  const go = () => {
    const url = destination(address);
    edit(url ? { tag: "Navigate", url } : { tag: "ExplainEmptyAddress" });
    // Going closes the keyboard, so the page has the whole window.
    if (url && document.activeElement instanceof HTMLElement) document.activeElement.blur();
  };

  // spec/app/browser.md, "Overflow retains the selected tab and the most recently used other tabs in opening order": the host reports how many fit.
  const [stripWidth, setStripWidth] = useState(0);
  const strip = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setStripWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const capacity = Math.max(1, Math.floor((stripWidth - STRIP_SPARE) / TAB_WIDTH));
  useEffect(() => {
    if (stripWidth > 0 && capacity !== browser.capacity) void send({ type: "changePage", browserInput: { tag: "ResizeTabs", revision: browser.revision, capacity } }, "Host");
  });

  return (
    // The window's glass would tint the website under it: only its strip and toolbar are painted.
    <BrowserWindow aria-label="Internet" className="bg-transparent" {...props}
      tabStrip={
        <BrowserTabStrip ref={strip} selectedId={browser.selected}
          tabs={visibleTabs(browser).map((tab) => ({ id: tab.id, title: tabUrl(tab) === "" ? "New tab" : site(tabUrl(tab)), initial: site(tabUrl(tab)).slice(0, 1).toUpperCase() || undefined }))}
          onSelectTab={(id) => edit({ tag: "SelectTab", id })} onCloseTab={(id) => edit({ tag: "CloseTab", id })}
          onNewTab={() => edit({ tag: "NewTab" })} onCloseBrowser={() => { if (can({ type: "closeBrowser" })) void closeBrowser(); }} />
      }
      toolbar={
        <BrowserToolbar canGoBack={offered({ tag: "Back" })} canGoForward={offered({ tag: "Forward" })} canGo={address !== ""}
          onBack={() => edit({ tag: "Back" })} onForward={() => edit({ tag: "Forward" })} onGo={go}>
          <Button variant="capsule" size="pill-icon" aria-label="Reload" disabled={!offered({ tag: "Reload" })} onClick={() => edit({ tag: "Reload" })}>
            <RotateCw size={22} className={active.load === "Loading" ? "animate-spin-slow" : undefined} />
          </Button>
          <AddressBar value={address} enterKeyHint="go" aria-invalid={browser.emptyAddressNotice || undefined}
            onValueChange={(text) => { setAddress(text); edit({ tag: "EditAddress", text }); }}
            onSubmit={go} onBlur={() => edit({ tag: "DismissAddress" })} />
        </BrowserToolbar>
      }>
      {/* spec/app/surface.md, "The page fills the rect the interface measured for it" */}
      <PageArea className="absolute inset-0 rounded-b-window" />
      {tabUrl(active) === "" && (
        // A blank tab shows the new-tab page; the page of the tab left may still be shown under it until the host hides it.
        <OverPage className="absolute inset-0 overflow-hidden rounded-b-window">
          <NewTabPage shortcuts={browser.recent.map((url) => ({ url, title: site(url) }))} onOpenShortcut={(url) => edit({ tag: "Navigate", url })} />
        </OverPage>
      )}
      {(active.load === "LoadFailed" || active.load === "SecurityBlocked") && (
        // Grace's own view over the page, which would show Android's error page: only Reload, which asks again, never a way past a security block.
        <OverPage className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-b-window bg-card">
          <EmptyState className="items-center" title={failures[active.load].title} icon={failures[active.load].icon}>
            <Button variant="capsule" size="pill" disabled={!offered({ tag: "Reload" })} onClick={() => edit({ tag: "Reload" })}><RotateCw aria-hidden />Reload</Button>
          </EmptyState>
        </OverPage>
      )}
      <WebsiteRequests />
    </BrowserWindow>
  );
}

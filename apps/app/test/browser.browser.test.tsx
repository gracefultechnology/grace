// spec/app/surface.md, "Story: Use the website under Grace's controls"; spec/app/browser.md, "Story: Enter a website and understand loading or failure"; spec/app/browser.md, "A page that moves by itself keeps the address the person is typing"; spec/app/browser.md, "Load results must match the tab and request that produced them"; spec/app/browser.md, "Back and Forward stay within the selected tab's history"; spec/app/browser.md, "Overflow retains the selected tab and the most recently used other tabs in opening order"
import { Effect, ManagedRuntime } from "effect";
import { createRoot } from "react-dom/client";
import { expect, inject, it, onTestFinished } from "vitest";
import { page, userEvent } from "vitest/browser";
import { Machine as PageLayers } from "../gen/app__surface.effect.vibe";
import { Machine as Workspaces } from "../gen/app__workspace.effect.vibe";
import { App } from "../src/App.tsx";
import { application } from "../src/app.vibe";
import type { SurfacePlugin } from "../src/surfacePlugin.ts";
import "../src/main.css";

const topmost = (element: Element) => {
  const { left, top, width, height } = element.getBoundingClientRect();
  return document.elementFromPoint(left + width / 2, top + height / 2);
};

it('Browse and return to the page I left (spec/app/browser.md, "Story: Browse and return to the page I left")', async () => {
  await page.viewport(1280, 800);
  const site = new URL("/browse/", inject("site")).href;
  const runtime = ManagedRuntime.make(application(undefined));
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  onTestFinished(async () => {
    root.unmount();
    await runtime.dispose();
  });
  root.render(<App runtime={runtime} />);
  const workspace = () => runtime.runSync(Effect.flatMap(Effect.service(Workspaces), (m) => m.get()));
  const tab = (id = 1) => workspace().browser.tabs.find((t) => t.id === id);
  const placed = () => runtime.runSync(Effect.flatMap(Effect.service(PageLayers), (m) => m.get())).page;
  const frames = () => [...document.querySelectorAll<HTMLIFrameElement>('iframe[title="Website"]')];
  const shown = (id = 1) => frames().find((frame) => frame.dataset.page === `tab-${id}`) ?? null;
  const showing = () => frames().filter((frame) => !frame.hidden).map((frame) => frame.src);
  const address = page.getByRole("textbox", { name: "Address" });
  const go = page.getByRole("button", { name: "Go", exact: true });
  const enter = () => userEvent.keyboard("{Enter}");
  const visit = async (url: string, id = 1, submit = enter) => {
    await userEvent.clear(address);
    await userEvent.type(address, url);
    await submit();
    await expect.poll(() => ({ src: shown(id)?.src, load: tab(id)?.load })).toEqual({ src: url, load: "Loaded" });
  };
  const host = new URL(site).hostname;
  const drawnTabs = () => page.getByRole("button", { name: host, exact: true }).elements();
  const tabsDrawn = () => drawnTabs().length;

  await userEvent.click(page.getByRole("button", { name: "Internet" }));
  await visit(`${site}index.html`);
  await expect.poll(() => {
    const frame = shown();
    const rect = frame?.getBoundingClientRect();
    const fills = rect !== undefined && [rect.x, rect.y, rect.width, rect.height].map(Math.round).join() === Object.values(placed()).join();
    return { hidden: frame?.hidden, top: frame !== null && topmost(frame) === frame, fills };
  }).toEqual({ hidden: false, top: true, fills: true });

  await visit(`${site}bill/index.html`, 1, () => userEvent.click(go));
  await userEvent.click(page.getByRole("button", { name: "Back" }));
  await expect.poll(() => ({ src: shown()?.src, cursor: tab()?.cursor, load: tab()?.load })).toEqual({ src: `${site}index.html`, cursor: 1, load: "Loaded" });
  await userEvent.click(page.getByRole("button", { name: "Forward" }));
  await expect.poll(() => ({ src: shown()?.src, cursor: tab()?.cursor, load: tab()?.load })).toEqual({ src: `${site}bill/index.html`, cursor: 2, load: "Loaded" });
  const loaded = tab()?.loadVersion ?? 0;
  await userEvent.click(page.getByRole("button", { name: "Reload" }));
  await expect.poll(() => ({ load: tab()?.load, reloaded: (tab()?.loadVersion ?? 0) > loaded })).toEqual({ load: "Loaded", reloaded: true });
  const reloaded = tab()?.loadVersion ?? 0;
  await userEvent.click(go);
  await expect.poll(() => ({ history: tab()?.history.length, load: tab()?.load, again: (tab()?.loadVersion ?? 0) > reloaded })).toEqual({ history: 3, load: "Loaded", again: true });

  await userEvent.click(page.getByRole("button", { name: "Back" }));
  await userEvent.click(page.getByRole("button", { name: "Back" }));
  await expect.poll(() => ({ cursor: tab()?.cursor, page: shown() })).toEqual({ cursor: 0, page: null });
  await userEvent.click(page.getByRole("button", { name: "Forward" }));
  await expect.poll(() => ({ src: shown()?.src, load: tab()?.load })).toEqual({ src: `${site}index.html`, load: "Loaded" });
  await userEvent.click(page.getByRole("button", { name: "Forward" }));
  await expect.poll(() => ({ src: shown()?.src, cursor: tab()?.cursor, load: tab()?.load })).toEqual({ src: `${site}bill/index.html`, cursor: 2, load: "Loaded" });

  await userEvent.click(page.getByRole("button", { name: "Open a new tab" }));
  await visit(`${site}booking/index.html`, 2, () => userEvent.click(go));
  await expect.poll(showing).toEqual([`${site}booking/index.html`]);
  await userEvent.click(page.getByRole("button", { name: host, exact: true }).first());
  await expect.poll(showing).toEqual([`${site}bill/index.html`]);
  const kept = tab()?.loadVersion;
  await userEvent.click(page.getByRole("button", { name: "Home", exact: true }));
  await userEvent.click(page.getByRole("button", { name: "Internet" }));
  await expect.poll(() => ({ showing: showing(), cursor: tab()?.cursor, loadVersion: tab()?.loadVersion })).toEqual({ showing: [`${site}bill/index.html`], cursor: 2, loadVersion: kept });

  await userEvent.click(page.getByRole("button", { name: "Open a new tab" }));
  await userEvent.click(go);
  await expect.poll(() => workspace().browser.emptyAddressNotice).toBe(true);
  const recent = () => workspace().browser.recent;
  const remembered = recent().length;
  await userEvent.click(page.getByRole("button", { name: `Remove ${host}` }).first());
  await expect.poll(() => recent().length).toBe(remembered - 1);
  const left = recent();
  await userEvent.click(page.getByRole("button", { name: "Clear", exact: true }));
  await userEvent.click(page.getByRole("dialog").getByRole("button", { name: "Cancel" }));
  await expect.poll(recent).toEqual(left);
  await userEvent.click(page.getByRole("button", { name: "Clear", exact: true }));
  await userEvent.click(page.getByRole("dialog").getByRole("button", { name: "Clear" }));
  await expect.poll(recent).toEqual([]);
  await visit(`${site}index.html`, 3);
  await expect.poll(tabsDrawn).toBe(3);
  await page.viewport(800, 800);
  await expect.poll(() => ({ drawn: tabsDrawn(), selected: drawnTabs().filter((t) => t.getAttribute("aria-current") === "page").length })).toEqual({ drawn: 2, selected: 1 });
  await userEvent.click(page.getByRole("button", { name: "1 more" }));
  await userEvent.click(page.getByRole("dialog", { name: "More tabs" }).getByRole("button", { name: host, exact: true }));
  await expect.poll(showing).toEqual([`${site}booking/index.html`]);
  await page.viewport(1280, 800);
  await expect.poll(() => ({ drawn: tabsDrawn(), tabs: frames().length })).toEqual({ drawn: 3, tabs: 3 });
  await userEvent.click(page.getByRole("button", { name: host, exact: true }).first());
  await expect.poll(showing).toEqual([`${site}bill/index.html`]);

  await userEvent.click(page.getByRole("button", { name: "Ask Grace" }));
  await expect.poll(() => shown()?.hidden).toBe(true);
  await userEvent.click(page.getByRole("button", { name: "Collapse" }));
  await expect.poll(() => shown()?.hidden).toBe(false);
  const grace = page.getByRole("region", { name: "Grace" });
  await expect.poll(() => grace.query()?.contains(topmost(grace.element())) ?? false).toBe(true);

  await page.viewport(800, 800);
  await userEvent.click(page.getByRole("button", { name: "1 more" }));
  await userEvent.click(page.getByRole("dialog", { name: "More tabs" }).getByRole("button", { name: `Close ${host}` }));
  await expect.poll(() => workspace().browser.tabs.length).toBe(2);

  await userEvent.click(page.getByRole("button", { name: "Close browser" }));
  await expect.poll(frames).toEqual([]);
});

/** The Android page plugin, which cannot run in a browser, at its boundary: what Grace asked of it, and the events it sends. */
function devicePlugin() {
  const calls: [string, Record<string, unknown>][] = [];
  const listeners = new Map<string, (event: unknown) => void>();
  const refused = { creates: 0 };
  const plugin = new Proxy({}, {
    get: (_, method: string) => (options: Record<string, unknown>, listener?: (event: unknown) => void) => {
      if (method === "addListener") {
        listeners.set(String(options), listener!);
        return Promise.resolve({ remove: () => Promise.resolve() });
      }
      calls.push([method, options]);
      if (method === "createSurface" && refused.creates > 0) {
        refused.creates -= 1;
        return Promise.reject(new Error("This WebView cannot isolate the page"));
      }
      return Promise.resolve({});
    },
  }) as SurfacePlugin;
  const emit = (event: string, fields: Record<string, unknown>) => {
    const [, { owner, session, epoch }] = calls.find(([method]) => method === "createSurface")!;
    listeners.get(event)!({ owner, session, epoch, id: "tab-1", ...fields });
  };
  return {
    plugin,
    refused,
    called: (method: string) => calls.filter(([m]) => m === method).map(([, options]) => options),
    started: (url = "") => emit("pageStarted", { url }),
    finished: (url: string) => emit("navigationChanged", { exists: true, currentUrl: url, progress: 100 }),
    crashed: () => emit("surfaceCrashed", {}),
  };
}

it('Enter a website and understand loading or failure (spec/app/browser.md, "Story: Enter a website and understand loading or failure")', async () => {
  await page.viewport(1280, 800);
  const device = devicePlugin();
  const runtime = ManagedRuntime.make(application(device.plugin));
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  onTestFinished(async () => {
    root.unmount();
    await runtime.dispose();
  });
  root.render(<App runtime={runtime} />);
  const tab = () => runtime.runSync(Effect.flatMap(Effect.service(Workspaces), (m) => m.get())).browser.tabs[0];
  const address = page.getByRole("textbox", { name: "Address" });
  const at = () => ({ url: tab().history[tab().cursor], load: tab().load, address: document.querySelector<HTMLInputElement>("input[aria-label=Address]")?.value });

  device.refused.creates = 1;
  await userEvent.click(page.getByRole("button", { name: "Internet" }));
  await userEvent.type(address, "example.com{Enter}");
  await expect.poll(at).toEqual({ url: "https://example.com/", load: "LoadFailed", address: "https://example.com/" });
  expect(device.called("createSurface")).toHaveLength(1);
  await userEvent.click(page.getByRole("button", { name: "Try again" }));
  await expect.poll(() => device.called("createSurface")).toHaveLength(2);
  device.started("https://example.com/");
  device.finished("https://example.com/");
  await expect.poll(at).toEqual({ url: "https://example.com/", load: "Loaded", address: "https://example.com/" });

  device.started("https://example.com/next");
  await expect.poll(at).toEqual({ url: "https://example.com/next", load: "Loading", address: "https://example.com/next" });
  device.finished("https://example.com/next");
  await expect.poll(at).toEqual({ url: "https://example.com/next", load: "Loaded", address: "https://example.com/next" });

  device.crashed();
  await expect.poll(() => device.called("createSurface").at(-1)?.url).toBe("https://example.com/next");
  device.started();
  device.finished("https://example.com/next");
  await userEvent.click(page.getByRole("button", { name: "Back" }));
  await expect.poll(() => ({ navigated: device.called("navigate").map((n) => n.url), back: device.called("goBack") })).toEqual({ navigated: ["https://example.com/"], back: [] });
  device.started("https://example.com/");
  device.finished("https://example.com/");
  await expect.poll(at).toEqual({ url: "https://example.com/", load: "Loaded", address: "https://example.com/" });
});

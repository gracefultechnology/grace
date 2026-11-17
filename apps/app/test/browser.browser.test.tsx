// spec/app/surface.md, "Story: Use the website under Grace's controls"; spec/app/browser.md, "Load results must match the tab and request that produced them"; spec/app/browser.md, "Back and Forward stay within the selected tab's history"; spec/app/browser.md, "Overflow retains the selected tab and the most recently used other tabs in opening order"
import { Effect, ManagedRuntime } from "effect";
import { createRoot } from "react-dom/client";
import { expect, inject, it, onTestFinished } from "vitest";
import { page, userEvent } from "vitest/browser";
import { Machine as PageLayers } from "../gen/app__surface.effect.vibe";
import { Machine as Workspaces } from "../gen/app__workspace.effect.vibe";
import { App } from "../src/App.tsx";
import { application } from "../src/app.vibe";
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
  const tab = (id = 1) => runtime.runSync(Effect.flatMap(Effect.service(Workspaces), (m) => m.get())).browser.tabs.find((t) => t.id === id);
  const placed = () => runtime.runSync(Effect.flatMap(Effect.service(PageLayers), (m) => m.get())).page;
  const frames = () => [...document.querySelectorAll<HTMLIFrameElement>('iframe[title="Website"]')];
  const shown = (id = 1) => frames().find((frame) => frame.dataset.page === `tab-${id}`) ?? null;
  const showing = () => frames().filter((frame) => !frame.hidden).map((frame) => frame.src);
  const address = page.getByRole("textbox", { name: "Address" });
  const visit = async (url: string, id = 1) => {
    await userEvent.clear(address);
    await userEvent.type(address, `${url}{Enter}`);
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

  await visit(`${site}bill/index.html`);
  await userEvent.click(page.getByRole("button", { name: "Back" }));
  await expect.poll(() => ({ src: shown()?.src, cursor: tab()?.cursor, load: tab()?.load })).toEqual({ src: `${site}index.html`, cursor: 1, load: "Loaded" });
  await userEvent.click(page.getByRole("button", { name: "Forward" }));
  await expect.poll(() => ({ src: shown()?.src, cursor: tab()?.cursor, load: tab()?.load })).toEqual({ src: `${site}bill/index.html`, cursor: 2, load: "Loaded" });
  const loaded = tab()?.loadVersion ?? 0;
  await userEvent.click(page.getByRole("button", { name: "Reload" }));
  await expect.poll(() => ({ load: tab()?.load, reloaded: (tab()?.loadVersion ?? 0) > loaded })).toEqual({ load: "Loaded", reloaded: true });

  await userEvent.click(page.getByRole("button", { name: "Open a new tab" }));
  await visit(`${site}booking/index.html`, 2);
  await expect.poll(showing).toEqual([`${site}booking/index.html`]);
  await userEvent.click(page.getByRole("button", { name: host, exact: true }).first());
  await expect.poll(showing).toEqual([`${site}bill/index.html`]);
  const kept = tab()?.loadVersion;
  await userEvent.click(page.getByRole("button", { name: "Home", exact: true }));
  await userEvent.click(page.getByRole("button", { name: "Internet" }));
  await expect.poll(() => ({ showing: showing(), cursor: tab()?.cursor, loadVersion: tab()?.loadVersion })).toEqual({ showing: [`${site}bill/index.html`], cursor: 2, loadVersion: kept });

  await userEvent.click(page.getByRole("button", { name: "Open a new tab" }));
  await visit(`${site}index.html`, 3);
  await expect.poll(tabsDrawn).toBe(3);
  await page.viewport(800, 800);
  await expect.poll(() => ({ drawn: tabsDrawn(), selected: drawnTabs().filter((t) => t.getAttribute("aria-current") === "page").length })).toEqual({ drawn: 2, selected: 1 });
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

  await userEvent.click(page.getByRole("button", { name: "Close browser" }));
  await expect.poll(frames).toEqual([]);
});

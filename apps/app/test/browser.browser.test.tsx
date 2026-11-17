// spec/app/surface.md, "Story: Use the website under Grace's controls"; spec/app/browser.md, "Load results must match the tab and request that produced them"; spec/app/browser.md, "Back and Forward stay within the selected tab's history"
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
  const tab = () => runtime.runSync(Effect.flatMap(Effect.service(Workspaces), (m) => m.get())).browser.tabs.find((t) => t.id === 1);
  const placed = () => runtime.runSync(Effect.flatMap(Effect.service(PageLayers), (m) => m.get())).page;
  const website = page.getByTitle("Website");
  const shown = () => {
    const frame = website.query();
    return frame instanceof HTMLIFrameElement ? frame : null;
  };
  const address = page.getByRole("textbox", { name: "Address" });
  const visit = async (url: string) => {
    await userEvent.clear(address);
    await userEvent.type(address, `${url}{Enter}`);
    await expect.poll(() => ({ src: shown()?.src, load: tab()?.load })).toEqual({ src: url, load: "Loaded" });
  };

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

  await userEvent.click(page.getByRole("button", { name: "Ask Grace" }));
  await expect.poll(() => shown()?.hidden).toBe(true);
  await userEvent.click(page.getByRole("button", { name: "Collapse" }));
  await expect.poll(() => shown()?.hidden).toBe(false);
  const grace = page.getByRole("region", { name: "Grace" });
  await expect.poll(() => grace.query()?.contains(topmost(grace.element())) ?? false).toBe(true);

  await userEvent.click(page.getByRole("button", { name: "Close browser" }));
  await expect.poll(shown).toBeNull();
});

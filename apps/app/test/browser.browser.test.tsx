// spec/app/browser.md, "Story: Browse and return to the page I left"; spec/app/surface.md, "Story: Use the website under Grace's controls"; spec/app/browser.md, "Load results must match the tab and request that produced them"; spec/app/browser.md, "Back and Forward stay within the selected tab's history"
import { Effect, ManagedRuntime } from "effect";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, expect, inject, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { Machine as Workspaces } from "../gen/app__workspace.effect.vibe";
import { App } from "../src/App.tsx";
import { application } from "../src/app.vibe";
import "../src/main.css";

const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
beforeAll(async () => { environment.IS_REACT_ACT_ENVIRONMENT = true; await page.viewport(1280, 800); });
afterAll(() => { environment.IS_REACT_ACT_ENVIRONMENT = false; });

const frame = () => document.querySelector<HTMLIFrameElement>("iframe[data-page='tab-1']");
const topmost = (element: Element) => {
  const { left, top, width, height } = element.getBoundingClientRect();
  return document.elementFromPoint(left + width / 2, top + height / 2);
};

it("Browse and return to the page I left", async () => {
  const site = `${inject("site")}/browse`;
  const runtime = ManagedRuntime.make(application(undefined));
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(() => Promise.resolve(root.render(<App runtime={runtime} />)));
  const tab = () => runtime.runSync(Effect.flatMap(Effect.service(Workspaces), (m) => m.get())).browser.tabs.find((t) => t.id === 1);
  const address = page.getByRole("textbox", { name: "Address" });
  const visit = async (url: string) => {
    await act(() => userEvent.clear(address));
    await act(() => userEvent.type(address, `${url}{Enter}`));
    await expect.poll(() => ({ src: frame()?.src, load: tab()?.load })).toEqual({ src: url, load: "Loaded" });
  };

  await act(() => userEvent.click(page.getByRole("button", { name: "Internet" })));
  await visit(`${site}/index.html`);
  const area = document.querySelector("section[aria-label='Internet'] div[aria-hidden='true']")!;
  await expect.poll(() => ({ shown: !frame()!.hidden, top: topmost(area) })).toEqual({ shown: true, top: frame() });
  const { x, y, width, height } = area.getBoundingClientRect();
  const placed = frame()!.getBoundingClientRect();
  expect([placed.x, placed.y, placed.width, placed.height].map(Math.round)).toEqual([x, y, width, height].map(Math.round));

  await visit(`${site}/bill/index.html`);
  await act(() => userEvent.click(page.getByRole("button", { name: "Back" })));
  await expect.poll(() => ({ src: frame()?.src, cursor: tab()?.cursor, load: tab()?.load })).toEqual({ src: `${site}/index.html`, cursor: 1, load: "Loaded" });
  await act(() => userEvent.click(page.getByRole("button", { name: "Forward" })));
  await expect.poll(() => ({ src: frame()?.src, cursor: tab()?.cursor, load: tab()?.load })).toEqual({ src: `${site}/bill/index.html`, cursor: 2, load: "Loaded" });
  const loaded = tab()!.loadVersion;
  await act(() => userEvent.click(page.getByRole("button", { name: "Reload" })));
  await expect.poll(() => ({ load: tab()?.load, reloaded: tab()!.loadVersion > loaded })).toEqual({ load: "Loaded", reloaded: true });

  await act(() => userEvent.click(page.getByRole("button", { name: "Ask Grace" })));
  await expect.poll(() => frame()?.hidden).toBe(true);
  await act(() => userEvent.click(page.getByRole("button", { name: "Collapse" })));
  await expect.poll(() => frame()?.hidden).toBe(false);
  const grace = page.getByRole("region", { name: "Grace" });
  await expect.poll(() => grace.query() !== null && grace.element().contains(topmost(grace.element()))).toBe(true);

  await act(() => userEvent.click(page.getByRole("button", { name: "Close browser" })));
  await expect.poll(frame).toBeNull();

  await act(() => Promise.resolve(root.unmount()));
  await runtime.dispose();
});

// spec/app/surface.md, "Story: Use the website under Grace's controls"; spec/app/browser.md, "Story: Enter a website and understand loading or failure"; spec/app/browser.md, "A load that ends at another address records where the page really is"; spec/app/browser.md, "A load that never starts or never ends becomes the failure view with Reload"; spec/app/browser.md, "The padlock shows only on a page that loaded over a secure connection"; spec/app/websiteRequests.md, "When the app or browser I confirmed does not open, I am told"; spec/app/browser.md, "A page that moves by itself keeps the address the person is typing"; spec/app/browser.md, "Load results must match the tab and request that produced them"; spec/app/browser.md, "Back and Forward stay within the selected tab's history"; spec/app/browser.md, "Overflow retains the selected tab and the most recently used other tabs in opening order"; spec/app/browser.md, "Address entry preserves a draft and empty Go gives a visible explanation"; spec/app/browser.md, "Recent websites can be removed individually or cleared after one confirmation"; spec/app/surface.md, "A Grace control is drawn over the page only after the host routes its rect to Grace"; spec/app/browser.md, "Stay on a leave-page warning keeps the page she was on"; spec/app/websiteRequests.md, "A website message is answered once with OK, Cancel or typed text"
import { Effect, Schema } from "effect";
import { TestClock } from "effect/testing";
import { expect, inject, it, onTestFinished } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import { loadWaitSeconds } from "../gen/app__browser.ts";
import { Machine as PageLayers } from "../gen/app__surface.effect.vibe";
import { Machine as WebsiteRequests } from "../gen/app__websiteRequests.effect.vibe";
import { client, script, signIn } from "./cloud.vibe";
import { androidPagePluginAtItsBoundary, BrowserControl, decisionCloud, launch, SelectorRead, startBrowserReadPlan, typedAddress } from "./journey.tsx";

const topmost = (element: Element) => {
  const { left, top, width, height } = element.getBoundingClientRect();
  return document.elementFromPoint(left + width / 2, top + height / 2);
};
const onTop = (element: Element | null) => element !== null && element.contains(topmost(element));

it('Browse and return to the page I left (spec/app/browser.md, "Story: Browse and return to the page I left")', async () => {
  const site = new URL("/browse/", inject("site")).href;
  const { runtime, workspace } = await launch();
  const tab = (id = 1) => workspace().browser.tabs.find((t) => t.id === id);
  const placed = () => runtime.runSync(Effect.flatMap(Effect.service(PageLayers), (m) => m.get())).page;
  const frames = () => [...document.querySelectorAll<HTMLIFrameElement>('iframe[title="Website"]')];
  const shown = (id = 1) => frames().find((frame) => frame.dataset.page === `tab-${id}`) ?? null;
  const showing = () => frames().filter((frame) => !frame.hidden).map((frame) => frame.src);
  const address = page.getByRole("textbox", { name: "Address" });
  const go = page.getByRole("button", { name: "Go", exact: true });
  const enter = () => userEvent.keyboard("{Enter}");
  const visit = async (url: string, id = 1, submit = enter) => {
    await address.fill(url);
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
  await userEvent.type(address, "wea");
  await userEvent.click(page.getByRole("button", { name: "Reload" }));
  await expect.poll(() => ({ load: tab()?.load, reloaded: (tab()?.loadVersion ?? 0) > loaded, address: typedAddress() })).toEqual({ load: "Loaded", reloaded: true, address: `${site}bill/index.html` });
  const reloaded = tab()?.loadVersion ?? 0;
  await userEvent.click(go);
  await expect.poll(() => ({ history: tab()?.history.length, load: tab()?.load, again: (tab()?.loadVersion ?? 0) > reloaded, address: typedAddress() })).toEqual({ history: 3, load: "Loaded", again: true, address: `${site}bill/index.html` });
  const notice = page.getByText("Type a website or what you’re looking for.");
  await userEvent.clear(address);
  await userEvent.click(go);
  await expect.poll(() => onTop(notice.query())).toBe(true);

  await userEvent.click(page.getByRole("button", { name: "Back" }));
  await userEvent.click(page.getByRole("button", { name: "Back" }));
  await expect.poll(() => ({ cursor: tab()?.cursor, page: shown() })).toEqual({ cursor: 0, page: null });
  await userEvent.click(page.getByRole("button", { name: "Forward" }));
  await expect.poll(() => ({ src: shown()?.src, load: tab()?.load })).toEqual({ src: `${site}index.html`, load: "Loaded" });
  await userEvent.click(page.getByRole("button", { name: "Forward" }));
  await expect.poll(() => ({ src: shown()?.src, cursor: tab()?.cursor, load: tab()?.load, address: typedAddress() })).toEqual({ src: `${site}bill/index.html`, cursor: 2, load: "Loaded", address: `${site}bill/index.html` });

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
  await expect.poll(() => onTop(notice.query())).toBe(true);
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
  await userEvent.click(page.getByRole("button", { name: "Open a new tab" }));
  await visit(`${site}bill/index.html`, 4);
  await page.viewport(800, 800);
  await expect.poll(() => ({ drawn: tabsDrawn(), selected: drawnTabs().filter((t) => t.getAttribute("aria-current") === "page").length })).toEqual({ drawn: 2, selected: 1 });
  const listed = page.getByRole("dialog", { name: "More tabs" }).getByRole("button", { name: host, exact: true });
  await userEvent.click(page.getByRole("button", { name: "2 more" }));
  await expect.poll(() => onTop(listed.nth(1).query())).toBe(true);
  await userEvent.click(listed.nth(1));
  await expect.poll(showing).toEqual([`${site}booking/index.html`]);
  await page.viewport(1280, 800);
  await expect.poll(() => ({ drawn: tabsDrawn(), tabs: frames().length })).toEqual({ drawn: 4, tabs: 4 });
  await userEvent.click(page.getByRole("button", { name: host, exact: true }).first());
  await expect.poll(showing).toEqual([`${site}bill/index.html`]);

  await userEvent.click(page.getByRole("button", { name: "Ask Grace" }));
  await expect.poll(() => shown()?.hidden).toBe(true);
  await userEvent.click(page.getByRole("button", { name: "Collapse" }));
  await expect.poll(() => shown()?.hidden).toBe(false);
  const grace = page.getByRole("region", { name: "Grace" });
  await expect.poll(() => grace.query()?.contains(topmost(grace.element())) ?? false).toBe(true);

  await page.viewport(800, 800);
  await userEvent.click(page.getByRole("button", { name: "2 more" }));
  const closing = page.getByRole("dialog", { name: "More tabs" }).getByRole("button", { name: `Close ${host}` }).nth(1);
  await expect.poll(() => onTop(closing.query())).toBe(true);
  await userEvent.click(closing);
  await expect.poll(() => workspace().browser.tabs.length).toBe(3);
  await userEvent.click(page.getByRole("dialog", { name: "More tabs" }).getByRole("button", { name: `Close ${host}` }));
  await expect.poll(() => ({ tabs: workspace().browser.tabs.length, top: onTop(frames().find((frame) => !frame.hidden) ?? null) })).toEqual({ tabs: 2, top: true });
  const framed = showing();
  await address.fill("https://bank.invalid/");
  await enter();
  await expect.poll(() => ({ load: workspace().browser.tabs.find((t) => t.id === workspace().browser.selected)?.load, showing: showing() })).toEqual({ load: "LoadFailed", showing: framed });

  const id = workspace().browser.selected;
  const readable = new URL("./site/index.html", import.meta.url).href;
  await visit(readable, id);
  const instruction = shown(id)?.contentDocument?.querySelector<HTMLAnchorElement>('a[href="instruction.html"]');
  if (!instruction) throw new Error("The local website did not offer its instruction page");
  instruction.click();
  await expect.element(address).toHaveValue(instruction.href);
  await expect.poll(() => tab(id)?.load).toBe("Loaded");
  const prior = tab(id)!;
  expect(prior.history.slice(-2)).toEqual([readable, instruction.href]);
  const instructionPage = shown(id)?.contentDocument;
  if (!instructionPage) throw new Error("The instruction page is unreadable");
  instructionPage.location.assign(new URL("index.html", site).href);
  await expect.poll(() => {
    const after = tab(id)!;
    return shown(id)?.contentDocument === null && after.loadVersion > prior.loadVersion && after.load === "Loaded";
  }).toBe(true);
  expect(tab(id)?.history).toEqual(prior.history);
  await expect.element(address).toHaveAccessibleDescription("");

  const unavailable = new URL(site);
  unavailable.protocol = "https:";
  await address.fill(unavailable.href);
  await enter();
  await expect.poll(() => {
    const active = tab(id);
    return shown(id)?.src === unavailable.href && active?.load !== "Loading" && active?.secure === false;
  }).toBe(true);

  await userEvent.click(page.getByRole("button", { name: "Close browser" }));
  await expect.poll(frames).toEqual([]);
});

it('Enter a website and understand loading or failure (spec/app/browser.md, "Story: Enter a website and understand loading or failure")', async () => {
  const unavailable = Object.assign(new Error("No app on this device opens this link"), { code: "EXTERNAL_APP_UNAVAILABLE" });
  let opening = (): Promise<{ status: "dispatched" }> => Promise.reject(unavailable);
  const device = androidPagePluginAtItsBoundary({ openExternalLink: () => opening() });
  const { runtime, workspace } = await launch(device.plugin, undefined, undefined, true);
  const tab = () => workspace().browser.tabs[0];
  const address = page.getByRole("textbox", { name: "Address" });
  const at = () => ({ url: tab().history[tab().cursor], load: tab().load, address: document.querySelector<HTMLInputElement>("input[aria-label=Address]")?.value });
  const later = async (seconds: number) => {
    await runtime.runPromise(TestClock.adjust(`${seconds} seconds`));
    await Effect.runPromise(Effect.sleep("100 millis"));
  };
  const count = (method: string) => device.called(method).length;
  const arrive = async (url: string) => {
    device.started(url);
    device.finished(url);
    await expect.poll(at).toEqual({ url, load: "Loaded", address: url });
  };

  device.refused.creates = 1;
  await userEvent.click(page.getByRole("button", { name: "Internet" }));
  await expect.element(address).toHaveAccessibleDescription("");
  await userEvent.type(address, "example.com{Enter}");
  await expect.poll(at).toEqual({ url: "https://example.com/", load: "LoadFailed", address: "https://example.com/" });
  await expect.element(address).toHaveAccessibleDescription("");
  expect(device.called("createSurface")).toHaveLength(1);
  await userEvent.click(page.getByRole("button", { name: "Try again" }));
  await expect.poll(() => device.called("createSurface")).toHaveLength(2);
  await arrive("https://example.com/");
  await expect.element(address).toHaveAccessibleDescription("Encrypted connection");

  const entries = tab().history.length;
  await arrive("https://example.com/b");
  expect(tab().history).toHaveLength(entries + 1);
  device.started("https://example.com/c");
  await expect.poll(at).toEqual({ url: "https://example.com/c", load: "Loading", address: "https://example.com/c" });
  await expect.element(address).toHaveAccessibleDescription("");
  await arrive("https://example.com/next");
  expect(tab().history).toHaveLength(entries + 2);
  await userEvent.click(page.getByRole("button", { name: "Back" }));
  await expect.poll(() => count("goBack")).toBe(1);
  await arrive("https://example.com/b");

  device.crashed();
  await expect.poll(() => device.called("createSurface").at(-1)?.url).toBe("https://example.com/b");
  device.started();
  device.finished("https://example.com/b");
  await userEvent.click(page.getByRole("button", { name: "Back" }));
  await expect.poll(() => ({ navigated: device.called("navigate").map((n) => n.url), back: count("goBack") })).toEqual({ navigated: ["https://example.com/"], back: 1 });
  await arrive("https://example.com/");
  await expect.element(address).toHaveAccessibleDescription("Encrypted connection");
  await userEvent.type(address, "x");
  await expect.element(address).toHaveAccessibleDescription("");
  const go = async (text: string, url: string) => {
    await userEvent.fill(address, text);
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => device.called("navigate").at(-1)?.url).toBe(url);
  };

  await go("example.com/start", "https://example.com/start");
  const history = tab().history.length;
  await arrive("https://www.example.com/home");
  expect(tab().history).toHaveLength(history);
  await expect.element(address).toHaveAccessibleDescription("Encrypted connection");
  const navigated = count("navigate");
  await userEvent.click(page.getByRole("button", { name: "Back" }));
  await expect.poll(() => count("goBack")).toBe(2);
  expect(count("navigate")).toBe(navigated);
  await arrive("https://example.com/");

  await later(loadWaitSeconds - 10);
  await go("example.com/slow", "https://example.com/slow");
  await later(10);
  expect(tab().load).toBe("Loading");
  await later(loadWaitSeconds - 10);
  await expect.poll(at).toEqual({ url: "https://example.com/slow", load: "LoadFailed", address: "https://example.com/slow" });
  expect(device.called("stopLoading")).toHaveLength(1);
  await expect.element(address).toHaveAccessibleDescription("");
  await userEvent.click(page.getByRole("button", { name: "Try again" }));
  await expect.poll(() => count("navigate")).toBe(navigated + 2);
  expect({ to: device.called("navigate").at(-1)?.url, reloaded: count("reloadSurface") }).toEqual({ to: "https://example.com/slow", reloaded: 0 });
  device.started("https://example.com/slow");
  device.finished("https://example.com/slow", { securityBlocked: true, pageError: "net::ERR_CERT_DATE_INVALID" });
  await expect.poll(at).toEqual({ url: "https://example.com/slow", load: "SecurityBlocked", address: "https://example.com/slow" });
  await expect.element(address).toHaveAccessibleDescription("");

  await go("example.com/hang", "https://example.com/hang");
  await later(loadWaitSeconds);
  await expect.poll(at).toEqual({ url: "https://example.com/hang", load: "LoadFailed", address: "https://example.com/hang" });
  await userEvent.click(page.getByRole("button", { name: "Back" }));
  await expect.poll(() => count("reloadSurface")).toBe(1);
  expect(count("goBack")).toBe(2);
  device.finished("https://example.com/slow");
  await expect.poll(at).toEqual({ url: "https://example.com/slow", load: "Loaded", address: "https://example.com/slow" });

  await go("example.com/stalled", "https://example.com/stalled");
  device.started("https://example.com/stalled");
  await later(loadWaitSeconds);
  await expect.poll(at).toEqual({ url: "https://example.com/stalled", load: "LoadFailed", address: "https://example.com/stalled" });
  await userEvent.click(page.getByRole("button", { name: "Try again" }));
  await expect.poll(() => count("reloadSurface")).toBe(2);
  device.finished("https://example.com/stalled");
  await expect.poll(at).toEqual({ url: "https://example.com/stalled", load: "Loaded", address: "https://example.com/stalled" });

  const question = page.getByRole("alertdialog");
  await go("example.com/ask", "https://example.com/ask");
  device.started("https://example.com/ask");
  device.ask("sitePermissionRequested", { requestId: "camera-1", origin: "https://example.com", kinds: ["camera"], topFrame: true });
  const refuse = question.getByRole("button", { name: "Don't allow" });
  await expect.element(refuse).toBeVisible();
  device.ask("dialogRequested", { dialogId: "hello-1", kind: "alert", message: "Welcome back" });
  await later(loadWaitSeconds + 10);
  expect(tab().load).toBe("Loading");
  await userEvent.click(refuse);
  await expect.element(question.getByText("Welcome back")).toBeVisible();
  await later(loadWaitSeconds + 10);
  expect(tab().load).toBe("Loading");
  await userEvent.click(question.getByRole("button", { name: "OK" }));
  await expect.poll(() => device.called("answerDialog")).toMatchObject([{ dialogId: "hello-1", accept: true }]);
  await later(loadWaitSeconds - 1);
  expect(tab().load).toBe("Loading");
  device.finished("https://example.com/ask");
  await expect.poll(at).toEqual({ url: "https://example.com/ask", load: "Loaded", address: "https://example.com/ask" });

  const kept = tab().history;
  await go("example.com/away", "https://example.com/away");
  device.ask("dialogRequested", { dialogId: "leave-1", kind: "beforeunload", message: "" });
  await expect.element(question).toBeVisible();
  await userEvent.click(question.getByRole("button", { name: "Stay" }));
  await expect.poll(at).toEqual({ url: "https://example.com/ask", load: "Loaded", address: "https://example.com/ask" });
  expect(tab().history).toEqual(kept);
  await expect.element(address).toHaveAccessibleDescription("Encrypted connection");
  await later(loadWaitSeconds);
  expect(tab().load).toBe("Loaded");

  await go("http://example.com/plain", "http://example.com/plain");
  await arrive("http://example.com/plain");
  await expect.element(address).toHaveAccessibleDescription("");

  // spec/app/browser.md, "Opened offline, the browser shows the offline page, never a blank page"; spec/app/shell.md, "Offline, Internet has no status and still opens the browser"
  const network = { online: false };
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => network.online });
  onTestFinished(() => { Reflect.deleteProperty(navigator, "onLine"); });
  const offlinePage = page.getByRole("heading", { name: "You’re offline" });
  await userEvent.click(page.getByRole("button", { name: "Home", exact: true }));
  window.dispatchEvent(new Event("offline"));
  await expect.poll(() => workspace().device.connectivity).toBe("Offline");
  await userEvent.click(page.getByRole("button", { name: "Internet" }));
  await expect.element(offlinePage).toBeVisible();
  await expect.element(page.getByRole("button", { name: "Fix Wi-Fi" })).toBeVisible();
  await go("example.com/later", "https://example.com/later");
  await expect.element(offlinePage).toBeVisible();
  await later(loadWaitSeconds);
  await expect.poll(at).toEqual({ url: "https://example.com/later", load: "LoadFailed", address: "https://example.com/later" });
  await expect.element(offlinePage).toBeVisible();
  const asked = count("reloadSurface") + count("navigate");
  network.online = true;
  window.dispatchEvent(new Event("online"));
  await expect.element(offlinePage).not.toBeInTheDocument();
  await expect.poll(() => count("reloadSurface") + count("navigate")).toBe(asked + 1);
  await arrive("https://example.com/later");
  await userEvent.click(page.getByRole("status").filter({ hasText: "Back online" }).getByRole("button", { name: "Close" }));

  const openings = () => runtime.runSync(Effect.flatMap(Effect.service(WebsiteRequests), (m) => m.get())).openings;
  const intent = "intent://pay#Intent;scheme=examplepay;package=com.example.pay;end";
  const fallback = "https://example.com/pay";
  const offer = async (fallbackUrl: string | null) => {
    const asked = count("openExternalLink");
    device.ask("externalLinkRequested", { url: intent, handoff: "view", fallbackUrl });
    await expect.element(question).toBeVisible();
    await userEvent.click(question.getByRole("button", { name: "Open" }));
    await expect.poll(() => count("openExternalLink")).toBe(asked + 1);
    expect(device.called("openExternalLink").at(-1)?.url).toBe(intent);
  };
  const before = count("navigate");
  device.ask("externalLinkRequested", { url: intent, handoff: "view", fallbackUrl: fallback });
  await expect.element(question).toBeVisible();
  expect(count("navigate")).toBe(before);
  await userEvent.click(question.getByRole("button", { name: "Open" }));
  await expect.poll(() => device.called("navigate").at(-1)?.url).toBe(fallback);
  expect(device.called("openExternalLink")).toMatchObject([{ url: intent }]);
  device.started(fallback);
  device.finished(fallback);
  await expect.poll(at).toEqual({ url: fallback, load: "Loaded", address: fallback });
  expect(openings()).toEqual([]);

  opening = () => Promise.resolve({ status: "dispatched" });
  await offer(fallback);
  await expect.poll(() => ({ navigated: count("navigate"), openings: openings() })).toEqual({ navigated: before + 1, openings: [] });

  opening = () => Promise.reject(Object.assign(new Error("Android refused the link"), { code: "EXTERNAL_LINK_DENIED" }));
  await offer(fallback);
  await expect.poll(() => openings().map((o) => o.failed)).toEqual([true]);
  expect(count("navigate")).toBe(before + 1);
  await userEvent.click(page.getByRole("button", { name: "Close", exact: true }));
  await expect.poll(openings).toEqual([]);

  opening = () => Promise.reject(unavailable);
  await offer("http://example.com/pay");
  await expect.poll(() => openings().map((o) => o.failed)).toEqual([true]);
  expect(count("navigate")).toBe(before + 1);
}, 180_000);

it.each(["later winner", "earlier winner", "tied latest", "changed scope", "mismatched detail", "wrong record kind", "ambiguous collection", "conflicting counts", "unclear count", "conflicting account", "private form", "newsletter list", "unverified account", "same-name account switch", "short dates", "public list"] as const)('Check the latest item across record pages ($0) (spec/app/workspace.md, "Story: Follow one reviewed plan across apps")', async (scenario) => {
  localStorage.clear();
  const status = scenario === "earlier winner" ? "cancelled" : "completed";
  const requested = `Show the most recent ${status} order`;
  const cloud = inject("cloud");
  const { secret } = await Effect.runPromise(Effect.provide(signIn(cloud), client));
  await Effect.runPromise(Effect.provide(script(cloud, secret, [{
    said: requested, answer: JSON.stringify({ text: "Review this record selection.", isQuestion: false, answers: [],
      actions: [{ kind: "proposeReadPlan", steps: [{ kind: "ReadLatestRecord", collection: "Order", status }] }] }),
  }]), client));
  const decisions = await Effect.runPromise(decisionCloud(cloud, secret));
  const route = commands.recordPage;
  const { url } = Schema.decodeUnknownSync(Schema.Struct({ url: Schema.NonEmptyString }))(await route({
    kind: "open", scenario, decisionUrl: new URL("/api/v1/decisions", cloud).href,
  }));
  onTestFinished(() => route({ kind: "close" }).then(() => undefined));
  let shown: string | null | undefined;
  const native = androidPagePluginAtItsBoundary({
    createSurface(request) {
      if (request.url !== url) return Promise.reject(new Error("The record fixture address changed"));
      native.started(url);
      native.finished(url);
      return Promise.resolve();
    },
    presentSurface(request) {
      shown = request.id;
      return Promise.resolve();
    },
    async readPage(request) {
      if (request.id !== shown) throw new Error("The record fixture is not in front");
      return Schema.decodeUnknownSync(SelectorRead)(await route({ kind: "read", selector: request.selector }));
    },
    async controlPage(request) {
      if (request.id !== shown && request.command.guidance?.kind !== "hide") throw new Error("The record fixture is not in front");
      return Schema.decodeUnknownSync(BrowserControl)(await route({ kind: "control", request }));
    },
  });
  const { ui, workspace } = await launch(native.plugin, decisions.host);
  await startBrowserReadPlan({ ui, workspace }, { url, question: requested, askWith: "pointer" });
  const show = ui.getByRole("button", { name: "Show me the link", exact: true });
  const check = ui.getByRole("button", { name: "Check page", exact: true });
  const next = (path: string) => new URL(path, url).href;
  const follow = async (path: string, label?: "View order" | "My Account") => {
    if (label) expect((await route({ kind: "manualRecordLink", label })).tapped).toBe(true);
    else await expect.poll(async () => (await route({ kind: "tapGuide" })).tapped, { timeout: 15_000 }).toBe(true);
    const destination = next(path);
    await expect.poll(async () => {
      const landed = await route({ kind: "read" });
      return { url: landed.url, readyState: landed.readyState };
    }, { timeout: 15_000 }).toEqual({ url: destination, readyState: "complete" });
    native.started(destination);
    native.finished(destination);
    await expect.poll(() => ({ address: typedAddress(), load: workspace().browser.tabs[0]?.load })).toEqual({ address: destination, load: "Loaded" });
    const resume = ui.getByRole("button", { name: "Resume Grace", exact: true });
    await expect.element(resume).toBeVisible();
    expect(workspace().assistant.activity).toBe("Paused");
    expect(workspace().plan.receipts).toHaveLength(0);
    await userEvent.click(resume);
    await expect.poll(() => workspace().assistant.activity).toBe("Rechecking");
  };
  const point = async () => {
    await userEvent.click(show);
    await expect.element(ui.getByRole("status", { name: "Link guide result" }), { timeout: 15_000 }).toBeVisible();
  };
  if (scenario === "same-name account switch") {
    const readRecordRow = async () => Schema.decodeUnknownSync(SelectorRead)(await route({ kind: "read", selector: "main table tbody tr" })).text;
    const preview = await readRecordRow();
    await point();
    await follow("/list");
    expect(await readRecordRow()).toBe(preview);
    await userEvent.click(show);
    await expect.element(ui.getByRole("status", { name: "Record check unavailable" }), { timeout: 15_000 }).toBeVisible();
    expect(await route({ kind: "inspectGuide" })).toEqual({ ringAvailable: false });
    const checkUnverified = async () => {
      await userEvent.click(check);
      await expect.element(ui.getByRole("status", { name: "Page check result" }), { timeout: 15_000 }).toBeVisible();
      expect(workspace().plan).toMatchObject({ recordSelection: { tag: "NoGuidedRecordSelection" }, receipts: [] });
    };
    await follow("/view/1", "View order");
    await checkUnverified();
    await follow("/home", "My Account");
    await checkUnverified();
    expect(await route({ kind: "accountVisits" })).toEqual({ visits: ["/home:A", "/list:B", "/view/1:B", "/home:A"] });
    expect(await route({ kind: "requests" })).toEqual({ count: 0, leaked: false });
    return;
  }
  if (["ambiguous collection", "conflicting counts", "unclear count", "conflicting account", "private form", "newsletter list", "unverified account", "short dates"].includes(scenario)) {
    await userEvent.click(show);
    await expect.element(ui.getByRole("status", { name: scenario === "ambiguous collection" ? "Link unavailable" : "Record check unavailable" }), { timeout: 15_000 }).toBeVisible();
    expect(await route({ kind: "inspectGuide" })).toEqual({ ringAvailable: false });
    expect(workspace().plan).toMatchObject({ recordSelection: { tag: "NoGuidedRecordSelection" }, receipts: [] });
    expect(await route({ kind: "requests" })).toEqual({ count: 0, leaked: false });
    return;
  }
  if (scenario === "public list") {
    await point();
    await follow("/view/1");
    await userEvent.click(check);
    await expect.element(ui.getByText("Read checks complete", { exact: true }), { timeout: 15_000 }).toBeVisible();
    expect(workspace().plan.receipts).toMatchObject([{ evidence: "Checked the latest matching record." }]);
    expect(await route({ kind: "requests" })).toEqual({ count: 0, leaked: false });
    return;
  }
  if (scenario === "later winner") {
    await point();
    await follow("/list");
    expect(workspace().plan.receipts).toHaveLength(0);
  }
  await point();
  await follow("/list?page=2");
  expect(workspace().plan.receipts).toHaveLength(0);
  await userEvent.click(show);
  if (scenario === "tied latest" || scenario === "changed scope") {
    await expect.element(ui.getByRole("status", { name: scenario === "changed scope" ? "Link unavailable" : "Record check unavailable" }), { timeout: 15_000 }).toBeVisible();
    expect(await route({ kind: "inspectGuide" })).toEqual({ ringAvailable: false });
    expect(workspace().plan).toMatchObject({ recordSelection: { tag: "NoGuidedRecordSelection" }, receipts: [] });
  } else {
    await expect.element(ui.getByRole("status", { name: "Link guide result" }), { timeout: 15_000 }).toBeVisible();
    if (scenario === "earlier winner") {
      await follow("/list");
      await point();
    }
    await follow(scenario === "earlier winner" ? "/view/1" : "/view/2");
    await userEvent.click(check);
    if (scenario === "mismatched detail" || scenario === "wrong record kind") {
      await expect.element(ui.getByRole("status", { name: "Page check result" }), { timeout: 15_000 }).toBeVisible();
      expect(workspace().plan.receipts).toHaveLength(0);
    } else {
      await expect.element(ui.getByText("Read checks complete", { exact: true }), { timeout: 15_000 }).toBeVisible();
      expect(workspace().plan.receipts).toMatchObject([{ evidence: "Checked the latest matching record." }]);
      expect(JSON.stringify(workspace().plan.receipts)).not.toContain("private-canary");
    }
  }
  expect(await route({ kind: "requests" })).toEqual({ count: 0, leaked: false });
}, 120_000);

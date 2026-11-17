// spec/app/surface.md, "Story: Use the website under Grace's controls"; spec/app/websiteRequests.md, "Story: Decide what a website may use"; spec/app/websiteRequests.md, "Story: Stay signed in to my websites"; spec/app/deviceKeys.md, "Story: Step back inside Grace before leaving"
// The native page plugin is native code and cannot run in a browser: it is faked once, at its boundary.
// Each routing request waits until the test answers it, as the native router answers after a round trip.
import { Effect, ManagedRuntime } from "effect";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { type Locator, page, userEvent } from "vitest/browser";
import { Machine as Workspaces } from "../gen/app__workspace.effect.vibe";
import type { EmbeddedAgent } from "../src/agentPlugin.ts";
import { App } from "../src/App.tsx";
import { application } from "../src/app.vibe";
import type { SurfacePlugin } from "../src/surfacePlugin.ts";
import "../src/main.css";

type Rect = { x: number; y: number; width: number; height: number };
type Call = { method: string; options: Record<string, unknown>; graceShown: boolean };
type Sent = Record<string, unknown> & { graceShown: boolean };

const hostNavigation = ["navigate", "goBack", "goForward", "reloadSurface"];
const graceWindow = () => document.querySelector<HTMLElement>("section[aria-label='Grace']");

/**
 * The plugin as the test sees it: every call, and the routing requests not yet answered; `android.allows` is Android's
 * answer to a grant, each purge waits until the test says whether it left the profile clean, and while `held.starts`
 * the page starts what Grace asked only when the test says, and only what it asked last.
 */
function fakePlugin() {
  const calls: Call[] = [];
  const android = { allows: true };
  const held = { starts: false };
  const starts: (() => Promise<void>)[] = [];
  const unanswered: (() => void)[] = [];
  const purges: ((clean: boolean) => void)[] = [];
  const listeners = new Map<string, (event: unknown) => void>();
  const plugin = new Proxy({}, {
    get: (_, method: string) => (options: Record<string, unknown>, listener?: (event: unknown) => void) => {
      if (method === "addListener") {
        listeners.set(options as unknown as string, listener!);
        return Promise.resolve({ remove: () => Promise.resolve() });
      }
      calls.push({ method, options, graceShown: graceWindow() !== null });
      if (method === "answerSitePermission") {
        const outcome = options.grant !== true ? "denied" : android.allows ? "granted" : "android-refused";
        return Promise.resolve({ granted: outcome === "granted", outcome });
      }
      if (method === "purgeProfiles") return new Promise((resolve) => purges.push((clean) => resolve({ purged: 1, clean })));
      // Grace's own navigation ends what the page holds, then starts its next page (definitions.ts, pageStarted).
      if (hostNavigation.includes(method)) {
        const start = () => emit("pageStarted", { id: options.id, url: options.url ?? "" });
        return Promise.resolve().then(() => held.starts ? void starts.push(start) : start());
      }
      return method === "setOcclusionRects" ? new Promise<void>((resolve) => unanswered.push(resolve)) : Promise.resolve();
    },
  }) as SurfacePlugin;
  /** A plugin event of this renderer's surfaces. */
  const emit = (event: string, fields: Record<string, unknown>) => act(() => {
    const { owner, session, epoch } = calls.find((c) => c.method === "createSurface")!.options;
    listeners.get(event)!({ owner, session, epoch, ...fields });
    return Promise.resolve();
  });
  return {
    plugin,
    android,
    held,
    /** The page starts what Grace asked last: a command superseded before it started never starts. */
    start: () => starts.splice(0).at(-1)?.(),
    calls: (method: string): Sent[] => calls.filter((c) => c.method === method).map((c) => ({ ...c.options, graceShown: c.graceShown })),
    /** Every call so far, in order, as its method and surface. */
    log: () => calls.map((c) => [c.method, c.options.id]),
    /** Answers every routing request sent so far. */
    route: () => act(() => { unanswered.splice(0).forEach((resolve) => resolve()); return Promise.resolve(); }),
    unanswered: () => unanswered.length,
    /** The page reports where it is, as Android does on each change, with any other field of the surface's state. */
    report: (id: string, url: string, progress: number, state: Record<string, unknown> = {}) => emit("navigationChanged", { id, exists: true, currentUrl: url, progress, ...state }),
    /** The page's website asks something, as the plugin reports it. */
    ask: (event: string, fields: Record<string, unknown>) => emit(event, fields),
    /** The page started its next page, whatever started it. */
    started: (id: string) => emit("pageStarted", { id, url: "" }),
    /** The page's renderer is gone. */
    crashed: (id: string) => emit("surfaceCrashed", { id }),
    /** The purge sent first ends, clean or not. */
    purged: (clean: boolean) => act(() => { purges.shift()!(clean); return Promise.resolve(); }),
  };
}

/** Every pixel a control touches, or only the pixels the page fills. */
const rectOf = (element: Element, control = false): Rect => {
  const { left, top, right, bottom } = element.getBoundingClientRect();
  const [start, end] = control ? [Math.floor, Math.ceil] : [Math.ceil, Math.floor];
  return { x: start(left), y: start(top), width: end(right) - start(left), height: end(bottom) - start(top) };
};

/** Drawn over the page: Grace hides a control until the host routes its rect. */
const shown = (locator: Locator) => locator.query()?.checkVisibility({ visibilityProperty: true }) ?? false;

const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
beforeAll(async () => { environment.IS_REACT_ACT_ENVIRONMENT = true; await page.viewport(1280, 800); });
afterAll(() => { environment.IS_REACT_ACT_ENVIRONMENT = false; });

it("Use the website under Grace's controls", async () => {
  const native = fakePlugin();
  const runtime = ManagedRuntime.make(application(native.plugin));
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(() => Promise.resolve(root.render(<App runtime={runtime} />)));
  /** A tab as the workspace holds it. */
  const tab = (id: number) => runtime.runSync(Effect.flatMap(Effect.service(Workspaces), (m) => m.get())).browser.tabs.find((t) => t.id === id)!;

  // spec/app/shell.md, "Settings and rail popovers preserve the surface underneath": Volume opens its popover, and a tap outside closes it.
  await act(() => userEvent.click(page.getByRole("button", { name: "Volume" })));
  const volume = page.getByRole("dialog", { name: "Volume" });
  await expect.element(volume).toBeVisible();
  // spec/app/preferences.md, "Undo restores the last setting choice without changing the microphone": zero is muted, and Unmute there chooses 50.
  const level = volume.getByRole("slider");
  await act(async () => { (level.element() as HTMLElement).focus(); await userEvent.keyboard("{Home}"); });
  await expect.element(level).toHaveAttribute("aria-valuenow", "0");
  await act(() => userEvent.click(volume.getByRole("button", { name: "Unmute" })));
  await expect.element(level).toHaveAttribute("aria-valuenow", "50");
  await act(() => userEvent.click(volume.element().parentElement!, { position: { x: 1000, y: 700 } }));
  await expect.element(volume).not.toBeInTheDocument();
  await act(() => userEvent.click(page.getByRole("button", { name: "Internet" })));
  await act(() => userEvent.type(page.getByRole("textbox", { name: "Address" }), "example.com{Enter}"));
  // spec/app/surface.md, "The page layer holds its rect, the controls drawn over it and the rects the host routes by"
  await expect.poll(() => native.calls("createSurface")).toMatchObject([{ id: "tab-1", url: "https://example.com/", layer: "below-host", process: "isolated", storage: "isolated", profileKey: "grace", answersRequests: true }]);
  // spec/app/surface.md, "A new page waits for its first routing before it takes any touch"
  await expect.poll(() => native.calls("setOcclusionRects")).toMatchObject([{ id: "tab-1", rects: [] }]);
  await native.route();
  await native.started("tab-1");
  await native.report("tab-1", "https://example.com/", 100);
  // spec/app/surface.md, "The page fills the rect the interface measured for it"
  const pageArea = document.querySelector("section[aria-label='Internet'] div[aria-hidden='true']")!;
  await expect.poll(() => native.calls("setBounds").at(-1)).toMatchObject({ id: "tab-1", ...rectOf(pageArea) });

  await act(() => userEvent.click(page.getByRole("button", { name: "Ask Grace" })));
  // spec/app/surface.md, "The page shows only on the ready browser surface while Grace is not expanded"
  await expect.poll(() => native.calls("presentSurface").at(-1)).toMatchObject({ id: null });
  // spec/app/surface.md, "The page is paused while Grace's window is in the background"
  expect(native.calls("pauseSurface").at(-1)).toMatchObject({ id: "tab-1" });
  // What expanded Grace covers is out of reach.
  expect(page.getByRole("textbox", { name: "Address" }).query()).toBeNull();
  // spec/app/surface.md, "A Grace control is drawn over the page only after the host routes its rect to Grace": expanded Grace
  // covers a page the host may still show, so it is drawn once its rect is routed.
  await expect.poll(native.unanswered).toBe(1);
  await expect.element(graceWindow()!.parentElement!).not.toBeVisible();
  await native.route();
  await act(() => userEvent.click(page.getByRole("button", { name: "Collapse" })));
  await expect.poll(() => native.calls("presentSurface").at(-1)).toMatchObject({ id: "tab-1" });
  // Collapsed, it stays drawn as it shrinks to its compact rect, which the host routes in turn; spec/app/surface.md, "The page
  // fills the rect the interface measured for it": the browser window shrinks to end above it (prototype `layout()`).
  const compact = graceWindow()!.parentElement!;
  await expect.poll(async () => {
    await native.route();
    const [routed, placed, at] = [native.calls("setOcclusionRects").at(-1)?.rects, native.calls("setBounds").at(-1)!, rectOf(compact, true)];
    return JSON.stringify([routed, (placed.y as number) + (placed.height as number)]) === JSON.stringify([[{ ...at, cornerRadius: 0 }], at.y - 6]);
  }).toBe(true);
  await expect.element(page.getByRole("region", { name: "Grace" })).toBeVisible();
  // A control that moves, as when the keyboard opens, stays drawn, and painted, where it is routed until its new rect is routed beside it.
  const painted = () => ({ ...rectOf(compact, true), cornerRadius: 0 });
  const routedAt = painted();
  await page.viewport(1280, 700);
  await expect.poll(native.unanswered).toBe(1);
  const [movedTo, held] = native.calls("setOcclusionRects").at(-1)?.rects as Rect[];
  expect([held, painted()]).toEqual([routedAt, routedAt]);
  await expect.element(compact).toBeVisible();
  await native.route();
  await expect.poll(() => native.calls("setOcclusionRects").at(-1)?.rects).toEqual([movedTo]);
  await expect.poll(painted).toEqual(movedTo);
  await native.route();

  await act(() => userEvent.click(page.getByRole("button", { name: "Close Grace" })));
  await expect.poll(() => native.calls("setOcclusionRects").at(-1)).toMatchObject({ rects: [], graceShown: false });
  await native.route();

  // spec/app/websiteRequests.md, "Only the first request of the selected tab is presented, while the browser is shown": the site asks for the camera, and only the person's Allow grants it.
  await native.ask("sitePermissionRequested", { id: "tab-1", requestId: "camera-1", origin: "https://example.com", kinds: ["camera"], topFrame: true, androidPermissions: [] });
  await expect.poll(native.unanswered).toBe(1);
  expect(native.calls("answerSitePermission")).toEqual([]);
  await native.route();
  await act(() => userEvent.click(page.getByRole("button", { name: "Allow" })));
  // spec/app/websiteRequests.md, "Only the website I am on can ask, and my answer holds for that website and those devices until Close browser"
  await expect.poll(() => native.calls("answerSitePermission")).toMatchObject([{ id: "tab-1", requestId: "camera-1", grant: true }]);
  await expect.poll(() => native.calls("setOcclusionRects").at(-1)).toMatchObject({ rects: [] });
  await native.route();
  await native.ask("sitePermissionRequested", { id: "tab-1", requestId: "camera-2", origin: "https://example.com", kinds: ["camera"], topFrame: true, androidPermissions: [] });
  await expect.poll(() => native.calls("answerSitePermission")).toMatchObject([{ requestId: "camera-1" }, { requestId: "camera-2", grant: true }]);

  // spec/app/websiteRequests.md, "Allow asks Android, and a website gets a device only when Android allows it too": Android refuses
  // the microphone. The surface already denied the page, so Grace makes no second call, says so, and asks again next time.
  native.android.allows = false;
  const microphone = (requestId: string) => native.ask("sitePermissionRequested", { id: "tab-1", requestId, origin: "https://example.com", kinds: ["microphone"], topFrame: true, androidPermissions: ["android.permission.RECORD_AUDIO"] });
  await microphone("microphone-1");
  await expect.poll(native.unanswered).toBe(1);
  await native.route();
  await act(() => userEvent.click(page.getByRole("button", { name: "Allow" })));
  // The notice is drawn once the host routes its new rect.
  await expect.poll(async () => { await native.route(); return shown(page.getByText("Android didn't allow your microphone.")); }).toBe(true);
  expect(native.calls("answerSitePermission").filter((c) => c.requestId === "microphone-1")).toMatchObject([{ grant: true }]);
  await act(() => userEvent.click(page.getByRole("button", { name: "Close" })));
  await microphone("microphone-2");
  await expect.poll(async () => { await native.route(); return shown(page.getByRole("button", { name: "Don't allow" })); }).toBe(true);
  await act(() => userEvent.click(page.getByRole("button", { name: "Don't allow" })));
  await expect.poll(() => native.calls("answerSitePermission").at(-1)).toMatchObject({ requestId: "microphone-2", grant: false });
  await expect.poll(() => native.calls("setOcclusionRects").at(-1)).toMatchObject({ rects: [] });
  await native.route();

  const pressBack = async () => {
    const event = new Event("hardware-back", { cancelable: true });
    await act(() => { window.dispatchEvent(event); return Promise.resolve(); });
    return event.defaultPrevented;
  };
  /** The website's question is drawn once the host routes its rect. */
  const asked = () => expect.poll(async () => { await native.route(); return shown(page.getByRole("alertdialog")); }).toBe(true);
  // spec/app/deviceKeys.md, "Each Back action is one event its guard allows": Back closes a website's prompt as its Cancel does.
  await native.ask("dialogRequested", { id: "tab-1", dialogId: "name-1", kind: "prompt", message: "Your name?" });
  await asked();
  expect(await pressBack()).toBe(true);
  await expect.poll(() => native.calls("answerDialog")).toMatchObject([{ dialogId: "name-1", accept: false }]);
  await expect.element(page.getByRole("alertdialog")).not.toBeInTheDocument();
  // spec/app/websiteRequests.md, "Looking away from a page ends what it asked, and never accepts it": the page's own navigation ends its question.
  await native.ask("dialogRequested", { id: "tab-1", dialogId: "sure-1", kind: "confirm", message: "Continue?" });
  await asked();
  await native.started("tab-1");
  await expect.element(page.getByRole("alertdialog")).not.toBeInTheDocument();
  expect(native.calls("answerDialog").filter((c) => c.accept !== false)).toEqual([]);
  await expect.poll(() => native.calls("setOcclusionRects").at(-1)).toMatchObject({ rects: [] });
  await native.route();
  // Grace's Reload ends it too, and accepts nothing.
  await native.ask("dialogRequested", { id: "tab-1", dialogId: "sure-2", kind: "confirm", message: "Continue?" });
  await asked();
  await act(() => userEvent.click(page.getByRole("button", { name: "Reload" })));
  await expect.poll(() => native.calls("reloadSurface")).toMatchObject([{ id: "tab-1" }]);
  await expect.element(page.getByRole("alertdialog")).not.toBeInTheDocument();
  expect(native.calls("answerDialog").filter((c) => c.accept !== false)).toEqual([]);
  // The closed dialog's rect is unrouted first, and the fiber takes no report until the host answers.
  await expect.poll(() => native.calls("setOcclusionRects").at(-1)).toMatchObject({ rects: [] });
  expect(native.unanswered()).toBe(1);
  // spec/app/browser.md, "Load results must match the tab and request that produced them": the site's certificate is refused this time.
  await native.report("tab-1", "https://example.com/", 100, { securityBlocked: true, pageError: "net::ERR_CERT_DATE_INVALID" });
  await act(() => new Promise((resolve) => setTimeout(resolve, 100)));
  expect(tab(1).load).not.toBe("SecurityBlocked");
  await native.route();
  await expect.poll(() => tab(1).load).toBe("SecurityBlocked");
  // Grace's own view takes the page's place once the host routes its rect; its Reload asks again.
  const failure = async (title: string) => {
    await expect.poll(async () => { await native.route(); return shown(page.getByText(title)); }).toBe(true);
    return page.getByText(title).element().parentElement!.querySelector("button")!;
  };
  const reload = await failure("This page isn't safe to open.");
  await act(() => userEvent.click(reload));
  await expect.poll(() => native.calls("reloadSurface")).toHaveLength(2);
  // This time the page does not open.
  await native.report("tab-1", "https://example.com/", 100, { pageError: "net::ERR_CONNECTION_RESET" });
  await failure("This page didn't open.");

  // spec/app/browser.md, "Back and Forward stay within the selected tab's history": the tablet's Back key goes back in the page.
  const address = page.getByRole("textbox", { name: "Address" });
  await act(() => userEvent.clear(address));
  // spec/app/browser.md, "A page that moves by itself keeps the address the person is typing"
  await act(() => userEvent.type(address, "example"));
  await native.report("tab-1", "https://example.com/#moved", 100);
  // The page arrived, and Grace's failure view is gone with the failure.
  await expect.poll(() => native.calls("setOcclusionRects").at(-1)).toMatchObject({ rects: [] });
  await native.route();
  // spec/app/browser.md, "Load results must match the tab and request that produced them": the page it leaves finishing
  // late does not finish the new one, which loads once it has started.
  native.held.starts = true;
  await act(() => userEvent.type(address, ".org{Enter}"));
  await expect.poll(() => native.calls("navigate")).toMatchObject([{ id: "tab-1", url: "https://example.org/" }]);
  await native.report("tab-1", "https://example.com/#moved", 100);
  // The fiber has heard the late report once it has had a moment.
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
  expect(tab(1).load).toBe("Loading");
  // The person goes back to where the page is before it starts: the navigate superseded never starts, and the page's start is the new load's.
  await act(() => userEvent.clear(address));
  await act(() => userEvent.type(address, "example.com/#moved{Enter}"));
  await expect.poll(() => native.calls("navigate")).toHaveLength(2);
  native.held.starts = false;
  await native.start();
  await native.report("tab-1", "https://example.com/#moved", 100);
  await expect.poll(() => tab(1).load).toBe("Loaded");
  // Back and then Forward before the page starts: Android records the step back only once the page starts it, so Forward waits.
  native.held.starts = true;
  expect(await pressBack()).toBe(true);
  await expect.poll(() => native.calls("goBack")).toHaveLength(1);
  await act(() => userEvent.click(page.getByRole("button", { name: "Forward" })));
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
  expect(native.calls("goForward")).toEqual([]);
  await native.start();
  await expect.poll(() => native.calls("goForward")).toMatchObject([{ id: "tab-1" }]);
  native.held.starts = false;
  await native.start();
  await native.report("tab-1", "https://example.com/#moved", 100);
  await expect.poll(() => tab(1).load).toBe("Loaded");
  // Two quick presses of the Back key go back two pages, as two steps back.
  const twice = [new Event("hardware-back", { cancelable: true }), new Event("hardware-back", { cancelable: true })];
  await act(() => { twice.forEach((back) => window.dispatchEvent(back)); return Promise.resolve(); });
  expect(twice.map((back) => back.defaultPrevented)).toEqual([true, true]);
  await expect.poll(() => native.calls("goBack")).toMatchObject([{ id: "tab-1" }, { id: "tab-1" }, { id: "tab-1" }]);
  expect(native.calls("navigate")).toHaveLength(2);
  expect(native.calls("reloadSurface")).toHaveLength(2);
  // spec/app/deviceKeys.md, "Back closes the nearest open thing first and leaves only from a resting Home": Back steps back to the
  // tab's new-tab page, then goes Home, and on a resting Home it is left to Android.
  expect(await pressBack()).toBe(true);
  await expect.poll(() => native.calls("goBack")).toHaveLength(4);
  expect(await pressBack()).toBe(true);
  await expect.poll(() => native.calls("destroySurface")).toMatchObject([{ id: "tab-1" }]);
  expect(await pressBack()).toBe(true);
  await expect.element(page.getByRole("button", { name: "Internet" })).toBeVisible();
  expect(await pressBack()).toBe(false);

  // spec/app/websiteRequests.md, "Website sign-ins last across tabs and Close browser until browsing data is cleared after one confirmation"
  // spec/app/surface.md, "A Grace control is drawn over the page only after the host routes its rect to Grace": what covers a
  // page that may still be shown, Settings or Home, is drawn once the host routes it.
  const tapRouted = async (name: string) => {
    await expect.poll(async () => { await native.route(); return shown(page.getByRole("button", { name })); }).toBe(true);
    await act(() => userEvent.click(page.getByRole("button", { name })));
  };
  const openAbout = async () => {
    await act(() => userEvent.click(page.getByRole("button", { name: "Settings" })));
    await tapRouted("About this tablet");
  };
  // The host answers each routing request, as a page under Grace waits for while Grace's controls change.
  const askToClear = async () => {
    await act(() => userEvent.click(page.getByRole("button", { name: "Clear browsing data" })));
    await expect.poll(async () => { await native.route(); return page.getByRole("dialog").query() !== null; }).toBe(true);
  };
  await openAbout();
  // spec/app/deviceKeys.md, "Each Back action is one event its guard allows": Back cancels the confirmation.
  await askToClear();
  expect(await pressBack()).toBe(true);
  await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  // Leaving Settings cancels it too, so it is not waiting when Settings opens again.
  await askToClear();
  await act(() => { window.dispatchEvent(new Event("launcher-home")); return Promise.resolve(); });
  await expect.element(page.getByRole("button", { name: "Internet" })).toBeVisible();
  await openAbout();
  await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  expect(native.calls("purgeProfiles")).toEqual([]);
  // A purge that leaves a cookie behind is shown, and forgets nothing: the stored Allow still answers the website.
  const browse = async () => {
    await act(() => userEvent.click(page.getByRole("button", { name: "Home" })));
    await tapRouted("Internet");
  };
  await browse();
  await act(() => userEvent.type(page.getByRole("textbox", { name: "Address" }), "example.com{Enter}"));
  await expect.poll(() => native.calls("createSurface")).toHaveLength(2);
  await native.route();
  await native.started("tab-1");
  await native.report("tab-1", "https://example.com/", 100);
  await openAbout();
  // spec/app/workspace.md, "A page that moves by itself where the person is not looking only records where it went"
  await native.report("tab-1", "https://example.com/away", 100);
  await expect.poll(() => tab(1)).toMatchObject({ history: ["", "https://example.com/", "https://example.com/away"], load: "Loaded" });
  await askToClear();
  await act(() => userEvent.click(page.getByRole("button", { name: "Clear", exact: true })));
  await expect.poll(() => native.calls("purgeProfiles")).toMatchObject([{ profileKey: "grace" }]);
  await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  await native.route();
  const purging = native.log().length;
  await native.purged(false);
  await expect.element(page.getByRole("alert")).toHaveTextContent("Your browsing data wasn't cleared.");
  // The page the failed purge may have left is destroyed before the tab's new one starts.
  await expect.poll(() => native.log().slice(purging).filter(([method]) => method === "destroySurface" || method === "createSurface"))
    .toEqual([["destroySurface", "tab-1"], ["createSurface", "tab-1"]]);
  // The notice is drawn once the host routes it for the new page.
  await expect.poll(async () => { await native.route(); return shown(page.getByRole("alert")); }).toBe(true);
  await act(() => userEvent.click(page.getByRole("button", { name: "Close" })));
  await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
  await browse();
  await native.route();
  await native.started("tab-1");
  native.android.allows = true;
  await native.ask("sitePermissionRequested", { id: "tab-1", requestId: "camera-3", origin: "https://example.com", kinds: ["camera"], topFrame: true, androidPermissions: [] });
  await expect.poll(() => native.calls("answerSitePermission").at(-1)).toMatchObject({ requestId: "camera-3", grant: true });
  expect(page.getByRole("alertdialog").query()).toBeNull();
  // A clean purge closes the page, which opens again only once the purge has ended.
  await openAbout();
  await askToClear();
  await act(() => userEvent.click(page.getByRole("button", { name: "Clear", exact: true })));
  await expect.poll(() => native.calls("purgeProfiles")).toHaveLength(2);
  await native.route();
  expect(native.calls("createSurface")).toHaveLength(3);
  await native.purged(true);
  await expect.poll(() => native.calls("createSurface")).toHaveLength(4);
  await expect.element(page.getByRole("alert")).not.toBeInTheDocument();

  // spec/app/browser.md, "A tab whose page moves by itself while I am not looking at it records where it went"; spec/app/workspace.md,
  // "A page that moves by itself where the person is not looking only records where it went": a second tab's page, in the background.
  await browse();
  await native.route();
  await act(() => userEvent.click(page.getByRole("button", { name: "Open a new tab" })));
  await act(() => userEvent.type(page.getByRole("textbox", { name: "Address" }), "example.net{Enter}"));
  await expect.poll(async () => { await native.route(); return native.calls("createSurface").at(-1)?.id; }).toBe("tab-2");
  await native.started("tab-2");
  await native.report("tab-2", "https://example.net/", 100);
  await expect.poll(async () => { await native.route(); return tab(2).load; }).toBe("Loaded");
  await act(() => userEvent.click(page.getByRole("button", { name: "example.com", exact: true })));
  await expect.poll(() => native.calls("presentSurface").at(-1)).toMatchObject({ id: "tab-1" });
  const selected = tab(1);
  await native.report("tab-2", "https://example.net/next", 100);
  await expect.poll(() => tab(2)).toMatchObject({ history: ["", "https://example.net/", "https://example.net/next"], load: "Loaded" });
  expect(tab(1)).toEqual(selected);
  // spec/app/surface.md, "A new page waits for its first routing before it takes any touch": the background page, opened again
  // once its renderer is gone, takes the rects already routed, and the shown page's routing does not start over.
  const routing = native.calls("setOcclusionRects");
  await native.crashed("tab-2");
  await expect.poll(() => native.calls("setOcclusionRects").slice(routing.length)).toMatchObject([{ id: "tab-2", rects: routing.at(-1)!.rects }]);
  await native.route();
  expect(native.calls("createSurface").at(-1)).toMatchObject({ id: "tab-2", url: "https://example.net/next" });
  expect(native.calls("setOcclusionRects")).toHaveLength(routing.length + 1);

  await act(() => Promise.resolve(root.unmount()));
  await runtime.dispose();
});


it('Send a typed turn through the native agent (spec/app/conversation.md, "Story: Talk or type without losing the conversation")', async () => {
  const listeners = new Map<string, (input: unknown) => void>();
  const requests: Parameters<EmbeddedAgent["requestStream"]>[0][] = [];
  const stopped: string[] = [];
  const agent: EmbeddedAgent = {
    getStatus: () => Promise.resolve({ state: "running" }),
    request: ({ path }) => {
      if (path.startsWith("/api/turns/")) {
        stopped.push(path);
        return Promise.resolve({ status: 200, data: {} });
      }
      expect(path).toBe("/api/conversations");
      return Promise.resolve({ status: 201, data: { conversation: { id: "conversation", roomId: "room" } } });
    },
    requestStream: (input) => { requests.push(input); return Promise.resolve({ id: input.id }); },
    abort: () => Promise.resolve({ aborted: true }),
    addListener: (event, listener) => {
      listeners.set(event, listener);
      return Promise.resolve({ remove: () => { listeners.delete(event); return Promise.resolve(); } });
    },
  };
  const runtime = ManagedRuntime.make(application(undefined, undefined, { native: true, agent }));
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  try {
    await act(() => Promise.resolve(root.render(<App runtime={runtime} />)));
    await expect.poll(() => runtime.runSync(Effect.flatMap(Workspaces, (machine) => machine.get())).device.reasoningAvailable).toBe(true);
    await act(() => userEvent.click(page.getByRole("button", { name: "Ask Grace" })));
    const input = page.getByRole("textbox", { name: "Message to Grace" });
    await act(() => userEvent.type(input, "What can you do?"));
    await act(() => userEvent.click(page.getByRole("button", { name: "Send" })));
    await expect.poll(() => requests[0]?.body).toEqual({ text: "What can you do?" });
    const id = requests[0].id;
    const data = (eventId: string, payload: Record<string, unknown>) => listeners.get("streamData")?.({ id: eventId, data: JSON.stringify(payload) });
    await act(() => {
      data("previous", { type: "done", fullText: "Stale reply" });
      data(id, { type: "token", text: "A provisional reply." });
      data(id, { type: "done", fullText: JSON.stringify({ text: "Would you like a quick introduction?", isQuestion: true, answers: ["Tell me more", "Not now"] }) });
      listeners.get("streamEnd")?.({ id, status: 200 });
      return Promise.resolve();
    });
    const state = () => runtime.runSync(Effect.flatMap(Workspaces, (machine) => machine.get())).assistant.conversation;
    await expect.poll(() => state().messages.map((message) => message.text)).toEqual(["What can you do?", "Would you like a quick introduction?"]);
    await act(() => userEvent.click(page.getByRole("button", { name: "Tell me more" })));
    await expect.poll(() => requests[1]?.body).toEqual({ text: "Tell me more" });
    await act(() => {
      const next = requests[1].id;
      data(next, { type: "done", fullText: "I can talk with you." });
      listeners.get("streamEnd")?.({ id: next, status: 200 });
      return Promise.resolve();
    });
    await expect.element(page.getByText("I can talk with you.", { exact: true })).toBeVisible();

    await act(() => userEvent.type(input, "My password is c0mputer{Enter}"));
    await expect.poll(() => state().messages.at(-1)?.text).toBe("[Private information removed]");
    await expect.poll(() => state().turn).toBe("Ready");
    await expect.element(input).toHaveValue("");
    expect(requests).toHaveLength(2);
    expect(state().messages.some((message) => message.text.includes("c0mputer"))).toBe(false);

    await act(() => userEvent.type(input, "One more question{Enter}"));
    await expect.poll(() => requests[2]?.body).toEqual({ text: "One more question" });
    await act(() => userEvent.click(page.getByRole("button", { name: "Close Grace" })));
    await expect.poll(() => stopped).toEqual(["/api/turns/room/abort"]);
  } finally {
    await act(() => Promise.resolve(root.unmount()));
    await runtime.dispose();
    host.remove();
  }
});

it('Talk and hear a reply through the metered voice transport (spec/app/conversation.md, "Story: Talk or type without losing the conversation")', async () => {
  const sessionId = "a0fe147c-3ee9-4e45-8104-e31cd1a2b6d7";
  const token = "8".repeat(64);
  const speechPath = "/api/v1/voice/speech";
  const calls: string[] = [];
  const voiceInput = "What time is it?";
  const voiceOutput = "It is noon.";
  let microphoneFrames = 0;
  const phrases: string[] = [];
  const microphone = new AudioContext({ sampleRate: 16_000 });
  const source = microphone.createOscillator();
  const inputMedia = microphone.createMediaStreamDestination();
  source.connect(inputMedia);
  source.start();
  const audio = vi.spyOn(navigator.mediaDevices, "getUserMedia").mockImplementation(async () => {
    await microphone.resume();
    return inputMedia.stream;
  });
  const originalFetch = window.fetch.bind(window);
  const request = vi.spyOn(window, "fetch").mockImplementation(async (input, options) => {
    const pathname = new URL(input instanceof Request ? input.url : input, location.href).pathname;
    if (!pathname.startsWith(speechPath)) return originalFetch(input, options);
    calls.push(pathname);
    if (pathname.endsWith("/consent")) return Response.json({ consentNonce: sessionId });
    if (pathname.endsWith("/session")) {
      expect(options?.body).toBe(JSON.stringify({ consentNonce: sessionId }));
      return Response.json({
        version: 1,
        sessionId,
        token,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        wsUrl: `ws://localhost:8787${speechPath}/ws?sessionId=${sessionId}`,
      });
    }
    return Response.json({ revoked: true });
  });
  class FixtureSocket extends EventTarget {
    readyState = 0;
    bufferedAmount = 0;

    constructor(url: string) {
      super();
      expect(new URL(url).pathname).toBe(speechPath + "/ws");
      queueMicrotask(() => {
        this.readyState = 1;
        this.dispatchEvent(new Event("open"));
      });
    }

    receive(payload: object | ArrayBuffer) {
      queueMicrotask(() => this.dispatchEvent(new MessageEvent("message", {
        data: payload instanceof ArrayBuffer ? payload : JSON.stringify(payload),
      })));
    }

    send(value: string | ArrayBuffer) {
      if (value instanceof ArrayBuffer) {
        expect(value.byteLength % 2).toBe(0);
        microphoneFrames += 1;
        if (microphoneFrames === 1) {
          this.receive({ t: "stt", event: { type: "start-of-turn", transcript: "" } });
          this.receive({ t: "stt", event: { type: "end-of-turn", transcript: voiceInput } });
        }
        return;
      }
      const command: unknown = JSON.parse(value);
      if (typeof command !== "object" || command === null || !("t" in command)) return;
      if (command.t === "hello" && "token" in command) {
        expect(command.token).toBe(token);
        this.receive({ t: "ready", version: 1, sampleRate: 16000, channels: 1 });
      } else if (command.t === "tts" && "text" in command && typeof command.text === "string" && "id" in command && typeof command.id === "string") {
        phrases.push(command.text);
        const id = new TextEncoder().encode(command.id);
        const output = new Uint8Array(2 + id.length + 3200);
        output[0] = 1;
        output[1] = id.length;
        output.set(id, 2);
        this.receive(output.buffer);
      } else if (command.t === "finish" && "id" in command && typeof command.id === "string") {
        this.receive({ t: "complete", id: command.id });
      } else if (command.t === "stop") {
        this.close();
      }
    }

    close() {
      if (this.readyState > 1) return;
      this.readyState = 3;
      queueMicrotask(() => this.dispatchEvent(new Event("close")));
    }
  }
  vi.stubGlobal("WebSocket", FixtureSocket);
  const listeners = new Map<string, (input: unknown) => void>();
  const agent: EmbeddedAgent = {
    getStatus: () => Promise.resolve({ state: "running" }),
    request: () => Promise.resolve({ status: 201, data: { conversation: { id: "voice", roomId: "room" } } }),
    requestStream: ({ id, body }) => {
      expect(body).toEqual({ text: voiceInput });
      queueMicrotask(() => {
        listeners.get("streamData")?.({ id, data: JSON.stringify({ type: "done", fullText: voiceOutput }) });
        listeners.get("streamEnd")?.({ id, status: 200 });
      });
      return Promise.resolve({ id });
    },
    abort: () => Promise.resolve({ aborted: true }),
    addListener: (event, listener) => {
      listeners.set(event, listener);
      return Promise.resolve({ remove: () => { listeners.delete(event); return Promise.resolve(); } });
    },
  };
  const runtime = ManagedRuntime.make(application(undefined, undefined, { native: false, agent }));
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  try {
    const workspace = () => runtime.runSync(Effect.flatMap(Workspaces, (machine) => machine.get()));
    await act(() => Promise.resolve(root.render(<App runtime={runtime} />)));
    await expect.poll(() => workspace().device.reasoningAvailable).toBe(true);
    await act(() => userEvent.click(page.getByRole("button", { name: "Ask Grace" })));
    await act(() => userEvent.click(page.getByRole("button", { name: "Allow mic" })));
    await act(async () => {
      await expect.poll(() => workspace().assistant.conversation.messages.map((turn) => turn.text)).toEqual([voiceInput, voiceOutput]);
      await expect.poll(() => workspace().assistant.conversation.turn).toBe("Ready");
      await expect.poll(() => inputMedia.stream.getAudioTracks()[0].readyState).toBe("ended");
    });
    expect(microphoneFrames).toBeGreaterThan(0);
    expect(phrases).toEqual([voiceOutput]);
    await expect.poll(() => calls).toEqual([speechPath + "/consent", speechPath + "/session", speechPath + "/session/" + sessionId + "/revoke"]);
  } finally {
    await act(() => Promise.resolve(root.unmount()));
    await runtime.dispose();
    await microphone.close();
    host.remove();
    request.mockRestore();
    audio.mockRestore();
    vi.unstubAllGlobals();
  }
});


it('Return to owned Google mail and calendar (spec/app/setup.md, "Story: Read the Google mail and calendar I connected")', async () => {
  const person = { id: "private-qa-account", email: "reader@example.test" };
  const time = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const end = new Date(Date.now() + 120 * 60 * 1000).toISOString();
  const mail = { externalId: "inbox-1", from: "Robin", subject: "Your receipt", receivedAt: time, isUnread: true, metadata: { historyId: "8" } };
  const grant = "58b549ef-4b49-4210-a3d1-ec31369a9f06";
  let trashed = false;
  let sent = false;
  let changed: string[] = [];
  const literalText = "<strong>This stays plain text.</strong>";
  const oldURL = window.location.href;
  const oldIntent = sessionStorage.getItem("grace-hosted-read");
  const hint = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(person.id));
  const ownerHint = Array.from(new Uint8Array(hint), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const url = new URL(oldURL);
  url.hash = "email";
  url.searchParams.set("owner_hint", ownerHint);
  window.history.replaceState(undefined, "", url);

  let signedIn = false;
  let replyFromOwner = false;
  const fetch = window.fetch.bind(window);
  let events = [{ externalId: "event-1", title: "Dentist", description: "Bring your glasses.", location: "Main Street", startAt: time, endAt: end, isAllDay: false, etag: '"one"', editable: true }];
  const reply = (body: unknown, status = 200) => Promise.resolve(Response.json(body, { status }));
  const provider = vi.spyOn(window, "fetch").mockImplementation((input, options) => {
    const api = new URL(typeof input === "string" || input instanceof URL ? input : input.url, window.location.href);
    switch (api.pathname) {
      case "/api/auth/session": return reply({ account: signedIn ? person : null });
      case "/api/auth/refresh": return reply({}, 401);
      case "/api/auth/providers": return reply({ google: false, email: true, sms: false });
      case "/api/auth/email/send":
        expect(options?.body).toBe(JSON.stringify({ email: person.email }));
        return reply({});
      case "/api/auth/email/verify":
        expect(options?.body).toBe(JSON.stringify({ email: person.email, code: "123456" }));
        signedIn = true;
        return reply({ account: person });
      case "/api/v1/billing/subscription": return reply({ status: "inactive", canManage: false, canCheckout: true });
      case "/api/v1/eliza/google/status":
        return reply({
          provider: "google", side: "owner", mode: "cloud_managed", configured: true, connected: true,
          identity: { email: person.email }, connectionId: grant, grantedCapabilities: ["google.gmail.triage", "google.calendar.read", "google.gmail.send", "google.gmail.trash", "google.calendar.write"],
        });
      case "/api/v1/eliza/gmail/triage": return reply({ accountId: person.id, messages: trashed ? [] : [mail], nextPageToken: null });
      case "/api/v1/eliza/gmail/read":
        expect(api.searchParams.get("messageId")).toBe(mail.externalId);
        return reply({
          accountId: replyFromOwner ? person.id : "different-owner", message: mail, bodyTextAvailable: true,
          bodyText: replyFromOwner ? literalText : "Another person’s message",
        });
      case "/api/v1/eliza/google/gmail/send": {
        const outbound = JSON.parse(String(options?.body));
        expect(outbound).toMatchObject({ accountId: person.id, grantId: grant, recipient: "robin@example.test", subject: "Hello", text: "See you soon." });
        sent = true;
        return reply({ accountId: person.id, operationId: outbound.operationId, messageId: "sent-1" });
      }
      case "/api/v1/eliza/google/gmail/trash": {
        const outbound = JSON.parse(String(options?.body));
        expect(outbound).toMatchObject({ accountId: person.id, grantId: grant, messageId: mail.externalId, version: trashed ? "9" : "8" });
        if (trashed) expect(outbound.undoOf).toEqual(expect.any(String));
        trashed = !trashed;
        return reply({ accountId: person.id, operationId: outbound.operationId, itemId: mail.externalId, version: "9" });
      }
      case "/api/v1/eliza/google/calendar/change": {
        const outbound = JSON.parse(String(options?.body));
        expect(outbound).toMatchObject({ accountId: person.id, grantId: grant });
        changed = [...changed, outbound.action];
        const itemId = outbound.id ?? outbound.operationId.replaceAll("-", "");
        if (outbound.action === "delete") events = events.filter((event) => event.externalId !== itemId);
        else if (outbound.action === "update") {
          expect(outbound.version).toBe('"one"');
          events = events.map((event) => event.externalId === itemId ? { ...event, ...outbound.event, etag: '"two"' } : event);
        } else events = [...events, { ...outbound.event, externalId: itemId, description: "", isAllDay: false, editable: true, etag: '"new"' }];
        return reply({ accountId: person.id, operationId: outbound.operationId, itemId });
      }
      case "/api/v1/eliza/calendar/feed":
        expect(api.searchParams.get("timeMin")).not.toBeNull();
        expect(api.searchParams.get("timeMax")).not.toBeNull();
        return reply({
          accountId: person.id, nextPageToken: null,
          events,
        });
      default: return fetch(input, options);
    }
  });

  const runtime = ManagedRuntime.make(application(undefined));
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  const tap = (name: string | RegExp) => act(() => userEvent.click(page.getByRole("button", { name, exact: true })));
  try {
    await act(() => Promise.resolve(root.render(<App runtime={runtime} />)));
    await tap("Go to Account");
    await tap("Use email");
    await act(() => userEvent.type(page.getByRole("textbox", { name: "Email address" }), person.email));
    await tap("Send code");
    await act(() => userEvent.type(page.getByRole("textbox", { name: "Sign-in code" }), "123456"));
    await tap("Sign in");
    await expect.element(page.getByRole("heading", { name: "Inbox" })).toBeVisible();

    await tap(/Your receipt/);
    await expect.element(page.getByRole("alert")).toBeVisible();
    expect(page.getByText("Another person’s message").query()).toBeNull();
    replyFromOwner = true;
    await tap(/Your receipt/);
    await expect.element(page.getByText(literalText, { exact: true })).toBeVisible();
    expect(Array.from(document.querySelectorAll("strong")).some((node) => node.textContent === "This stays plain text.")).toBe(false);

    await tap("Move to Trash");
    await expect.element(page.getByText("Moved to Trash.")).toBeVisible();
    await tap("Undo");
    await expect.element(page.getByText("Message restored.")).toBeVisible();
    await tap("New email");
    await act(() => userEvent.fill(page.getByRole("textbox", { name: "To", exact: true }), "robin@example.test"));
    await act(() => userEvent.fill(page.getByRole("textbox", { name: "Subject", exact: true }), "Hello"));
    await act(() => userEvent.fill(page.getByRole("textbox", { name: "Message", exact: true }), "See you soon."));
    await tap("Review email");
    await expect.element(page.getByText("To robin@example.test")).toBeVisible();
    expect(sent).toBe(false);
    await tap("Confirm and send");
    await expect.element(page.getByText("Gmail accepted your email.")).toBeVisible();
    expect(sent).toBe(true);
    await tap("Close Email");
    await tap("Calendar");
    await tap(/Dentist/);
    await expect.element(page.getByText("Bring your glasses.", { exact: true })).toBeVisible();
    await tap("Change appointment");
    await act(() => userEvent.fill(page.getByRole("textbox", { name: "Title" }), "Dentist follow-up"));
    await tap("Review appointment");
    await expect.element(page.getByText("Dentist follow-up")).toBeVisible();
    expect(changed).toEqual([]);
    await tap("Confirm appointment");
    await expect.element(page.getByText("Appointment saved.")).toBeVisible();
    await tap(/Dentist follow-up/);
    await tap("Change appointment");
    await tap("Remove appointment");
    await tap("Confirm removal");
    await expect.element(page.getByText("Appointment removed.")).toBeVisible();
    await tap("New appointment");
    await act(() => userEvent.fill(page.getByRole("textbox", { name: "Title" }), "Lunch"));
    await tap("Review appointment");
    await tap("Confirm appointment");
    await expect.element(page.getByRole("button", { name: /Lunch/ })).toBeVisible();
    expect(changed).toEqual(["update", "delete", "create"]);
  } finally {
    await act(() => Promise.resolve(root.unmount()));
    await runtime.dispose();
    host.remove();
    provider.mockRestore();
    if (oldIntent === null) sessionStorage.removeItem("grace-hosted-read");
    else sessionStorage.setItem("grace-hosted-read", oldIntent);
    window.history.replaceState(undefined, "", oldURL);
  }
});

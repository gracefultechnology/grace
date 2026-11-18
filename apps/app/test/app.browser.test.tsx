// spec/app/surface.md, "Story: Use the website under Grace's controls"; spec/app/websiteRequests.md, "Story: Decide what a website may use"; spec/app/websiteRequests.md, "Story: Stay signed in to my websites"; spec/app/deviceKeys.md, "Story: Step back inside Grace before leaving"; spec/app/conversation.md, "Story: Talk or type without losing the conversation"
// The native page plugin is native code and cannot run in a browser: it is faked once, at its boundary.
// Each routing request waits until the test answers it, as the native router answers after a round trip.
import { Effect, ManagedRuntime, Schema } from "effect";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, expect, inject, it } from "vitest";
import { type Locator, page, userEvent } from "vitest/browser";
import { allowedUse, chooseProvider, initial as initialAccounts, sheetResult } from "../gen/app__accounts.ts";
import { Machine as Workspaces } from "../gen/app__workspace.effect.vibe";
import { App } from "../src/App.tsx";
import { application } from "../src/app.vibe";
import type { SurfacePlugin } from "../src/surfacePlugin.ts";
import { client, reply, script, signIn, turns } from "./cloud.vibe";
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
function fakePlugin(controlPage?: (options: Record<string, unknown>) => unknown) {
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
      if (method === "controlPage" && controlPage) return Promise.resolve(controlPage(options));
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

it("Talk or type without losing the conversation", async () => {
  const cloud = inject("cloud");
  const { secret } = await Effect.runPromise(Effect.provide(signIn(cloud), client));
  const runtime = ManagedRuntime.make(application(fakePlugin().plugin, undefined, { url: cloud, key: secret }));
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(() => Promise.resolve(root.render(<App runtime={runtime} />)));
  const workspace = () => runtime.runSync(Effect.flatMap(Effect.service(Workspaces), (m) => m.get()));
  const field = page.getByRole("textbox", { name: "Message to Grace" });
  const type = (text: string) => act(() => userEvent.type(field, `${text}{Enter}`));

  await act(() => userEvent.click(page.getByRole("button", { name: "Ask Grace" })));
  // spec/app/conversation.md, "Send consumes one exact draft once and never submits a website form": the typed turn reaches Grace's agent, and her answer is written.
  await type("Hello Grace.");
  await expect.element(page.getByText(reply("Hello Grace."))).toBeVisible();
  // spec/app/conversation.md, "Answer chips come only with a closed question, two or three at a time": the agent's question comes with its answers,
  // and what she asked of the tablet that the tablet can do is done.
  await type("Make the text bigger.");
  await expect.element(page.getByText("I made the text larger. Is that easier to read?")).toBeVisible();
  await expect.poll(() => workspace().preferences.session.textSize).toBe("Larger");
  // spec/app/conversation.md, "A tapped answer is one of the offered answers and preserves whether the microphone was active"
  await act(() => userEvent.click(page.getByRole("button", { name: "A bit bigger" })));
  await expect.element(page.getByText(reply("A bit bigger"))).toBeVisible();
  expect(page.getByRole("button", { name: "Yes, thanks" }).query()).toBeNull();
  // spec/app/conversation.md, "A current speech or response failure leaves a usable typed fallback": an answer that does not read as a reply is an apology, and does nothing.
  await type("Say nothing.");
  await expect.element(page.getByText("Sorry, I didn’t catch that. Could you say it again?")).toBeVisible();
  expect(workspace().assistant.conversation.turn).toBe("Ready");
  expect(await Effect.runPromise(Effect.provide(turns(cloud, secret), client))).toEqual(
    ["Hello Grace.", "Make the text bigger.", "A bit bigger", "Say nothing."].map((said) => ({ said, outcome: "completed" })),
  );

  await act(() => Promise.resolve(root.unmount()));
  await runtime.dispose();
});

it('Follow one reviewed plan across apps (spec/app/workspace.md, "Story: Follow one reviewed plan across apps")', async () => {
  const cloud = inject("cloud");
  const { secret } = await Effect.runPromise(Effect.provide(signIn(cloud), client));
  const target = "Help center";
  const ask = 'Help me reach the help page named "Help center", then read my two appointment emails and saved appointment. Leave everything unchanged.';
  await Effect.runPromise(Effect.provide(script(cloud, secret, [{
    said: ask,
    answer: JSON.stringify({
      text: "Review and start the read plan.", isQuestion: false, answers: [],
      actions: [{ kind: "proposeReadPlan", steps: [{ kind: "ReachNamedPage", target }, "ReadMail", "ReadMail", "ReadCalendar"] }],
    }),
  }]), client));
  const subject = "Reminder: your appointment tomorrow at 10 am";
  const incoming = await fetch(new URL("/fake/gmail/incoming", cloud), {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ to: "owner@grace.test", from: "Westside Reception", fromEmail: "desk@westside.test", subject, body: "Your appointment is at our Westside office." }),
  });
  expect(incoming.ok).toBe(true);
  const chosen = chooseProvider(initialAccounts, "Gmail", "AccountPerson");
  const account = sheetResult(chosen, { attempt: chosen.signIn.attempt, outcome: "Allowed", address: "owner@grace.test", granted: allowedUse }, "Gmail", "AccountConnector");
  localStorage.clear();
  localStorage.setItem("accounts", JSON.stringify(account));
  const origin = "https://example.org";
  const home = { id: "example-home", path: "/", title: "Example", text: "Example\nHelp center" };
  const about = { id: "example-about", path: "/about", title: "About Example", text: "About Example\nHelp center\nOur team" };
  const help = { id: "example-help", path: "/help", title: target, text: "Help center\nFind answers to frequently asked questions." };
  let currentPage = home;
  const native = fakePlugin(({ command }) => {
    if (typeof command === "object" && command !== null && "subaction" in command && command.subaction === "snapshot") {
      return { documentId: currentPage.id, frameScope: "main", result: {
        snapshotId: currentPage.id, url: origin + currentPage.path, title: currentPage.title, text: currentPage.text,
        complete: true, readyState: "complete", blockers: [],
        viewport: { width: 800, height: 600, offsetLeft: 0, offsetTop: 0, scale: 1 },
        elements: [
          { id: "about", tag: "a", label: "About us", href: "https://example.org/about", inViewport: true },
          { id: "clipped-help", tag: "a", label: "Help center", href: "https://example.org/help", inViewport: true,
            bounds: { x: 100, y: -2, width: 100, height: 32 } },
          { id: "help", tag: "a", label: "Help center", href: "https://example.org/help", inViewport: true,
            bounds: { x: 100, y: 80, width: 100, height: 32 } },
        ],
      } };
    }
    return { result: { accepted: true } };
  });
  const runtime = ManagedRuntime.make(application(native.plugin, undefined, { url: cloud, key: secret }));
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(() => Promise.resolve(root.render(<App runtime={runtime} />)));

  const routeTo = (target: Locator) => expect.poll(async () => { await native.route(); return shown(target); }, { timeout: 10000 }).toBe(true);
  const tap = async (target: Locator) => {
    await routeTo(target);
    await act(() => userEvent.click(target));
  };

  try {
    await act(() => userEvent.click(page.getByRole("button", { name: "Internet" })));
    await native.route();
    await act(() => userEvent.type(page.getByRole("textbox", { name: "Address" }), "example.org{Enter}"));
    await expect.poll(async () => { await native.route(); return native.calls("createSurface").at(-1)?.id; }).toBe("tab-1");
    await native.started("tab-1");
    await native.report("tab-1", "https://example.org/", 100);

    await tap(page.getByRole("button", { name: "Ask Grace" }));
    const field = page.getByRole("textbox", { name: "Message to Grace" });
    await routeTo(field);
    await act(() => userEvent.type(field, ask + "{Enter}"));
    await routeTo(page.getByRole("list", { name: "Read plan" }).getByText(target, { exact: true }));
    await expect.element(page.getByRole("region", { name: "Review read plan" }).getByText(ask, { exact: true })).toBeVisible();
    await tap(page.getByRole("button", { name: "Collapse", exact: true }));
    await expect.poll(async () => { await native.route(); return native.calls("presentSurface").at(-1)?.id; }).toBe("tab-1");
    const check = page.getByRole("button", { name: "Check page" });
    const plan = page.getByRole("region", { name: "Task plan" });
    const pending = plan.locator('[aria-current="step"]');
    expect(check.query()).toBeNull();
    const showLink = page.getByRole("button", { name: "Show me the link" });
    expect(showLink.query()).toBeNull();
    await tap(page.getByRole("button", { name: "Start read plan" }));
    expect(check.query()).toBeNull();
    expect(showLink.query()).toBeNull();
    const allowReading = page.getByRole("button", { name: "Allow Grace to read this browser", exact: true });
    const resumeReading = page.getByRole("button", { name: "Resume Grace" });
    await tap(allowReading);
    await tap(resumeReading);
    await routeTo(showLink);
    await tap(page.getByRole("button", { name: "Turn off browser reading", exact: true }));
    expect(check.query()).toBeNull();
    expect(showLink.query()).toBeNull();
    await tap(allowReading);
    await tap(resumeReading);
    await tap(check);
    await expect.element(pending).toBeVisible();

    const resume = page.getByRole("button", { name: "Resume Grace" });
    currentPage = about;
    await native.report("tab-1", origin + about.path, 100);
    await tap(resume);
    await tap(check);
    await expect.element(page.getByRole("status", { name: "Page check result" })).toHaveTextContent(target);
    await expect.element(pending).toBeVisible();
    expect(plan.getByText(/^Open page:/).query()).toBeNull();
    expect(plan.getByText("Read checks complete").query()).toBeNull();
    await routeTo(check);

    await tap(showLink);
    await routeTo(page.getByText("Look for “Help center” on example.org."));
    expect(native.calls("controlPage").at(-1)).toMatchObject({ documentId: about.id, command: {
      subaction: "guide", guidance: { kind: "show", nodeId: "help" },
    } });
    await expect.element(pending).toBeVisible();

    currentPage = help;
    await native.report("tab-1", origin + help.path, 100);
    await native.route();
    await routeTo(resume);
    expect(check.query()).toBeNull();
    await tap(resume);
    await tap(check);
    await expect.element(page.getByRole("region", { name: "Task plan" }).getByText(/^Open the email you want me to read/)).toBeVisible();
    expect(check.query()).toBeNull();

    await tap(page.getByRole("button", { name: "Home", exact: true }));
    const mail = page.getByRole("button", { name: /^Email/ });
    await tap(mail);
    await tap(page.getByRole("button", { name: /Main St Clinic/ }));
    await expect.element(page.getByText(/appointment with Dr\. Patel tomorrow at 10:00 am/)).toBeVisible();
    await tap(resume);
    const checkEmail = page.getByRole("button", { name: "Check email" });
    await tap(checkEmail);
    await tap(page.getByRole("button", { name: "Expand", exact: true }));
    const checkedMail = page.getByRole("region", { name: "Task plan" }).getByText(`Open message: ${subject}`, { exact: true });
    await expect.element(checkedMail).toBeVisible();
    await tap(page.getByRole("button", { name: "Collapse", exact: true }));
    await tap(checkEmail);
    await expect.element(page.getByRole("region", { name: "Task plan" }).getByText(/^Open the email you want me to read/)).toBeVisible();
    await tap(page.getByRole("button", { name: "Close Grace", exact: true }));
    await tap(page.getByRole("button", { name: "Back to Inbox" }));
    await tap(page.getByRole("button", { name: /Westside Reception/ }));
    await expect.element(page.getByText("Your appointment is at our Westside office.")).toBeVisible();
    await tap(page.getByRole("button", { name: "Ask Grace", exact: true }));
    await tap(page.getByRole("button", { name: "Collapse", exact: true }));
    await tap(resume);
    await tap(checkEmail);
    await expect.element(page.getByRole("region", { name: "Task plan" }).getByText(/^Open the saved appointment/)).toBeVisible();

    await tap(page.getByRole("button", { name: "Home", exact: true }));
    const appointment = page.getByRole("button", { name: /^Calendar/ }).getByText("Eye check with Dr. Patel");
    await tap(appointment);
    await routeTo(page.getByText("Riverside Clinic"));
    await tap(resume);
    await tap(page.getByRole("button", { name: "Check appointment" }));
    await expect.element(plan.getByText("Read checks complete")).toBeVisible();
    await routeTo(plan.getByText(/^Eye check with Dr\. Patel · /));
    await tap(page.getByRole("button", { name: "Expand", exact: true }));
    await routeTo(plan.getByText("Open page: Help center", { exact: true }));
    await expect.poll(() => plan.getByText(`Open message: ${subject}`, { exact: true }).elements().length).toBe(2);
  } finally {
    await act(() => Promise.resolve(root.unmount()));
    await runtime.dispose();
    localStorage.clear();
  }
});

it('Save a separately approved email appointment in the reviewed plan (spec/app/workspace.md, "Story: Follow one reviewed plan across apps")', async () => {
  const cloud = inject("cloud");
  const { secret } = await Effect.runPromise(Effect.provide(signIn(cloud), client));
  const gmail = "owner@grace.test";
  const chosen = chooseProvider(initialAccounts, "Gmail", "AccountPerson");
  const account = sheetResult(chosen, { attempt: chosen.signIn.attempt, outcome: "Allowed", address: gmail, granted: allowedUse }, "Gmail", "AccountConnector");
  const start = "Check this open website, read the clinic email I open, and guide me through adding its appointment to my calendar.";
  const prepare = "Prepare the appointment from this email.";
  const approve = "Yes, add it";
  const title = "Visit with Dr. Patel";
  const when = new Date();
  when.setDate(when.getDate() + 1);
  when.setHours(10, 0, 0, 0);
  const day = [when.getFullYear(), String(when.getMonth() + 1).padStart(2, "0"), String(when.getDate()).padStart(2, "0")].join("-");
  await Effect.runPromise(Effect.provide(script(cloud, secret, [
    { said: start, answer: JSON.stringify({ text: "Review the plan.", isQuestion: false, answers: [], actions: [{ kind: "proposeReadPlan", steps: ["ReadBrowser", "ReadMail", "SaveMailAppointment"] }] }) },
    { said: prepare, answer: JSON.stringify({ text: "Add the visit with Dr. Patel tomorrow at 10 am?", isQuestion: true, answers: [approve, "No, thanks"], actions: [{ kind: "proposeFromMessage", title, day, time: "10:00" }] }) },
    { said: approve, answer: JSON.stringify({ text: "I will ask your calendar to save it.", isQuestion: false, answers: [], actions: [{ kind: "confirmProposal" }] }) },
  ]), client));
  localStorage.clear();
  localStorage.setItem("accounts", JSON.stringify(account));
  const native = fakePlugin();
  const runtime = ManagedRuntime.make(application(native.plugin, undefined, { url: cloud, key: secret }));
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(() => Promise.resolve(root.render(<App runtime={runtime} />)));
  const routeTo = (locator: Locator) => expect.poll(async () => { await native.route(); return shown(locator); }, { timeout: 10000 }).toBe(true);
  const tap = async (locator: Locator) => {
    await routeTo(locator);
    await act(() => userEvent.click(locator));
  };
  const button = (name: string | RegExp) => page.getByRole("button", { name });
  const say = async (text: string) => {
    const field = page.getByRole("textbox", { name: "Message to Grace" });
    await routeTo(field);
    await act(() => userEvent.type(field, `${text}{Enter}`));
  };
  const plan = page.getByRole("region", { name: "Task plan" });
  const receipt = page.getByText("Saved appointment: " + title, { exact: true });
  const saved = async () => {
    const Kept = Schema.Struct({
      boxes: Schema.Array(Schema.Struct({ address: Schema.String, calendar: Schema.Array(Schema.Struct({ title: Schema.String, startAt: Schema.String })) })),
    });
    const response = await fetch(`${cloud}/fake/account`, { headers: { authorization: `Bearer ${secret}` } });
    const { boxes } = Schema.decodeUnknownSync(Kept)(await response.json());
    return boxes.flatMap((box) => box.calendar.filter((event) => event.title === title).map((event) => ({ address: box.address, at: event.startAt })));
  };

  try {
    await tap(button("Internet"));
    await act(() => userEvent.type(page.getByRole("textbox", { name: "Address" }), "example.org{Enter}"));
    await expect.poll(async () => { await native.route(); return native.calls("createSurface").at(-1)?.id; }).toBe("tab-1");
    await native.started("tab-1");
    await native.report("tab-1", "https://example.org/", 100);
    await tap(button("Ask Grace"));
    await tap(button("Allow Grace to read this browser"));
    await say(start);
    await routeTo(page.getByRole("region", { name: "Review read plan" }).getByText(start, { exact: true }));
    await tap(button("Collapse"));
    await tap(button("Start read plan"));
    await tap(button("Check page"));
    await routeTo(plan.getByText(/^Open the email/));

    await tap(button("Home"));
    await tap(button(/^Email/));
    await tap(button(/Main St Clinic/));
    await routeTo(page.getByText(/appointment with Dr\. Patel tomorrow at 10:00 am/));
    await tap(button("Resume Grace"));
    await tap(button("Check email"));
    await routeTo(plan.getByText(/^Ask me to prepare the appointment/));
    await say(prepare);
    const yes = button(approve);
    await routeTo(yes);
    expect(await saved()).toEqual([]);
    expect(receipt.query()).toBeNull();
    await tap(yes);
    await expect.poll(saved, { timeout: 10000 }).toEqual([{ address: gmail, at: when.toISOString() }]);
    await tap(button("Home"));
    await tap(button(/^Calendar/));
    await tap(button("Resume Grace"));
    await tap(button("Check saved appointment"));
    await routeTo(plan.getByText("Planned checks complete", { exact: true }));
    await routeTo(receipt);
    await tap(button("Expand"));
    await routeTo(plan.getByText("Open page: https://example.org/", { exact: true }));
    await routeTo(plan.getByText("Open message: Reminder: your appointment tomorrow at 10 am", { exact: true }));
  } finally {
    await act(() => Promise.resolve(root.unmount()));
    await runtime.dispose();
    localStorage.clear();
  }
});

// spec/app/surface.md, "Story: Use the website under Grace's controls"; spec/app/websiteRequests.md, "Story: Decide what a website may use"; spec/app/websiteRequests.md, "Story: Stay signed in to my websites"; spec/app/deviceKeys.md, "Story: Step back inside Grace before leaving"
// The native page plugin is native code and cannot run in a browser: it is faked once, at its boundary.
// Each routing request waits until the test answers it, as the native router answers after a round trip.
import { Effect, ManagedRuntime } from "effect";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { Machine as Workspaces } from "../gen/app__workspace.effect.vibe";
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
 * the page starts what Grace asked only when the test says.
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
        const start = () => emit("pageStarted", { id: options.id, url: "" });
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
    /** The pages start what Grace asked of them. */
    start: () => Promise.all(starts.splice(0).map((start) => start())),
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

const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
beforeAll(async () => { environment.IS_REACT_ACT_ENVIRONMENT = true; await page.viewport(1280, 800); });
afterAll(() => { environment.IS_REACT_ACT_ENVIRONMENT = false; });

it("Use the website under Grace's controls", async () => {
  const native = fakePlugin();
  const runtime = ManagedRuntime.make(application(native.plugin));
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(() => Promise.resolve(root.render(<App runtime={runtime} />)));
  /** The first tab as the workspace holds it. */
  const firstTab = () => runtime.runSync(Effect.flatMap(Effect.service(Workspaces), (m) => m.get())).browser.tabs.find((t) => t.id === 1)!;

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
  // A control that moves, as when the keyboard opens, stays drawn where it is routed until its new rect is routed beside it.
  const routedAt = { ...rectOf(compact, true), cornerRadius: 0 };
  await page.viewport(1280, 700);
  await expect.poll(native.unanswered).toBe(1);
  const movedTo = { ...rectOf(compact, true), cornerRadius: 0 };
  expect(native.calls("setOcclusionRects").at(-1)?.rects).toEqual([movedTo, routedAt]);
  await expect.element(compact).toBeVisible();
  await native.route();
  await expect.poll(() => native.calls("setOcclusionRects").at(-1)?.rects).toEqual([movedTo]);
  await expect.element(compact).toBeVisible();
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
  await expect.poll(async () => { await native.route(); return page.getByText("Android didn't allow your microphone.").query()?.closest(".invisible") === null; }).toBe(true);
  expect(native.calls("answerSitePermission").filter((c) => c.requestId === "microphone-1")).toMatchObject([{ grant: true }]);
  await act(() => userEvent.click(page.getByRole("button", { name: "Close" })));
  await microphone("microphone-2");
  await expect.poll(async () => { await native.route(); return page.getByRole("button", { name: "Don't allow" }).query()?.closest(".invisible") === null; }).toBe(true);
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
  const asked = () => expect.poll(async () => { await native.route(); return page.getByRole("alertdialog").query()?.closest(".invisible") === null; }).toBe(true);
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
  // spec/app/browser.md, "Load results must match the tab and request that produced them": the site's certificate is refused this time.
  await native.report("tab-1", "https://example.com/", 100, { securityBlocked: true, pageError: "net::ERR_CERT_DATE_INVALID" });
  // The closed dialog's rect is unrouted first: the fiber takes the report only once routing is answered.
  await expect.poll(() => native.unanswered()).toBe(1);
  await expect.poll(() => native.calls("setOcclusionRects").at(-1)).toMatchObject({ rects: [] });
  await native.route();
  await expect.poll(() => firstTab().load).toBe("SecurityBlocked");

  // spec/app/browser.md, "Back and Forward stay within the selected tab's history": the tablet's Back key goes back in the page.
  const address = page.getByRole("textbox", { name: "Address" });
  await act(() => userEvent.clear(address));
  // spec/app/browser.md, "A page that moves by itself keeps the address the person is typing"
  await act(() => userEvent.type(address, "example"));
  await native.report("tab-1", "https://example.com/#moved", 100);
  // spec/app/browser.md, "Load results must match the tab and request that produced them": the page it leaves finishing
  // late does not finish the new one, which loads once it has started.
  native.held.starts = true;
  await act(() => userEvent.type(address, ".org{Enter}"));
  await expect.poll(() => native.calls("navigate")).toMatchObject([{ id: "tab-1", url: "https://example.org/" }]);
  await native.report("tab-1", "https://example.com/#moved", 100);
  // The fiber has heard the late report once it has had a moment.
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
  expect(firstTab().load).toBe("Loading");
  native.held.starts = false;
  await native.start();
  await native.report("tab-1", "https://example.org/", 100);
  await expect.poll(() => firstTab().load).toBe("Loaded");
  // Two quick presses of the Back key go back two pages, past the page's own move, as two steps back.
  const twice = [new Event("hardware-back", { cancelable: true }), new Event("hardware-back", { cancelable: true })];
  await act(() => { twice.forEach((back) => window.dispatchEvent(back)); return Promise.resolve(); });
  expect(twice.map((back) => back.defaultPrevented)).toEqual([true, true]);
  await expect.poll(() => native.calls("goBack")).toMatchObject([{ id: "tab-1" }, { id: "tab-1" }]);
  expect(native.calls("navigate")).toHaveLength(1);
  expect(native.calls("reloadSurface")).toHaveLength(1);
  // spec/app/deviceKeys.md, "Back closes the nearest open thing first and leaves only from a resting Home": Back steps back to the
  // tab's new-tab page, then goes Home, and on a resting Home it is left to Android.
  expect(await pressBack()).toBe(true);
  await expect.poll(() => native.calls("destroySurface")).toMatchObject([{ id: "tab-1" }]);
  expect(await pressBack()).toBe(true);
  await expect.element(page.getByRole("button", { name: "Internet" })).toBeVisible();
  expect(await pressBack()).toBe(false);

  // spec/app/websiteRequests.md, "Website sign-ins last across tabs and Close browser until browsing data is cleared after one confirmation"
  // spec/app/surface.md, "A Grace control is drawn over the page only after the host routes its rect to Grace": what covers a
  // page that may still be shown, Settings or Home, is drawn once the host routes it.
  const tapRouted = async (name: string) => {
    await expect.poll(async () => { await native.route(); return page.getByRole("button", { name }).query()?.closest(".invisible") === null; }).toBe(true);
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
  await expect.poll(firstTab).toMatchObject({ history: ["", "https://example.com/", "https://example.com/away"], load: "Loaded" });
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
  await expect.poll(async () => { await native.route(); return page.getByRole("alert").query()?.closest(".invisible") === null; }).toBe(true);
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

  await act(() => Promise.resolve(root.unmount()));
  await runtime.dispose();
});

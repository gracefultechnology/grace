// spec/app/surface.md, "Story: Use the website under Grace's controls"; spec/app/websiteRequests.md, "Story: Decide what a website may use"; spec/app/websiteRequests.md, "Story: Stay signed in to my websites"; spec/app/deviceKeys.md, "Story: Step back inside Grace before leaving"; spec/app/conversation.md, "Story: Talk or type without losing the conversation"
// The native page plugin is native code and cannot run in a browser: it is faked once, at its boundary.
// Each routing request waits until the test answers it, as the native router answers after a round trip.
import { Effect, ManagedRuntime, Schema } from "effect";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, inject, it, onTestFinished, vi } from "vitest";
import { cdp, type Locator, page, userEvent } from "vitest/browser";
import { allowedUse, chooseProvider, initial as initialAccounts, sheetResult } from "../gen/app__accounts.ts";
import { voiceDisclosure } from "../gen/app__conversation.ts";
import { Machine as Workspaces } from "../gen/app__workspace.effect.vibe";
import type { EmbeddedAgent } from "../src/agentPlugin.ts";
import { PasswordsClientError } from "../../../vendor/eliza/packages/os/src/bridges/passwords-client.ts";
import { App } from "../src/App.tsx";
import { PasswordBackupConsent } from "../src/PasswordBackupConsent.tsx";
import { application } from "../src/app.vibe";
import { Conversation } from "../src/conversation.vibe";
import { FileCatalog, FileLease, FileStorage } from "../src/files.vibe";
import { AccountActions } from "../src/graceAccount.vibe";
import type { PasswordVault } from "../src/passwords.vibe";
import type { GraceAction } from "../src/agent.vibe";
import type { SurfacePlugin } from "../src/surfacePlugin.ts";
import { client, otherPassword, photos, reply, script, signIn, turns } from "./cloud.vibe";
import { actOnScreen, mount, signInToGrace, tabletView } from "./screen.tsx";
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
function fakePlugin(controlPage?: (options: Record<string, unknown>) => unknown, autoRoute = false, readPage?: () => unknown) {
  const calls: Call[] = [];
  const android = { allows: true };
  const privateSignIn = { allows: true };
  const held = { starts: false };
  const starts: (() => void)[] = [];
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
      if (method === "createSurface" && options.purpose === "manual-sign-in" && !privateSignIn.allows) {
        return Promise.reject(new Error("Android private WebView unavailable"));
      }
      if (method === "readPage" && readPage) return Promise.resolve(readPage());
      if (method === "controlPage" && controlPage) return Promise.resolve(controlPage(options));
      if (method === "answerSitePermission") {
        const outcome = options.grant !== true ? "denied" : android.allows ? "granted" : "android-refused";
        return Promise.resolve({ granted: outcome === "granted", outcome });
      }
      if (method === "purgeProfiles") return new Promise((resolve) => purges.push((clean) => resolve({ purged: 1, clean })));
      // Grace's own navigation ends what the page holds, then starts its next page (definitions.ts, pageStarted).
      if (hostNavigation.includes(method)) {
        const start = () => publish("pageStarted", { id: options.id, url: options.url ?? "" });
        return Promise.resolve().then(() => held.starts ? void starts.push(start) : start());
      }
      return method === "setOcclusionRects" && !autoRoute ? new Promise<void>((resolve) => unanswered.push(resolve)) : Promise.resolve();
    },
  }) as SurfacePlugin;
  /** A plugin event of this renderer's surfaces. */
  const publish = (event: string, fields: Record<string, unknown>) => {
    const { owner, session, epoch } = calls.find((c) => c.method === "createSurface")!.options;
    listeners.get(event)!({ owner, session, epoch, ...fields });
  };
  const emit = (event: string, fields: Record<string, unknown>) => act(() => Promise.resolve(publish(event, fields)));
  return {
    plugin,
    android,
    privateSignIn,
    held,
    /** The page starts what Grace asked last: a command superseded before it started never starts. */
    start: () => act(() => Promise.resolve(starts.splice(0).at(-1)?.())),
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

actOnScreen();

const foregroundVault = {
  available: true, locked: false, unlockRemainingMs: null, unlockSeconds: 0, biometric: false, custody: "device-unlocked",
  autofill: { supported: true, selected: "this-app" },
} satisfies Awaited<ReturnType<PasswordVault["status"]>>;

async function visitExampleSite(native: ReturnType<typeof fakePlugin>) {
  await act(() => userEvent.type(page.getByRole("textbox", { name: "Address" }), "example.org{Enter}"));
  await expect.poll(async () => { await native.route(); return native.calls("createSurface").at(-1)?.id; }).toBe("tab-1");
  await native.started("tab-1");
  await native.report("tab-1", "https://example.org/", 100);
}

function routedControls(native: Pick<ReturnType<typeof fakePlugin>, "route">) {
  const routeTo = (target: Locator) => expect.poll(async () => { await native.route(); return shown(target); }, { timeout: 10000 }).toBe(true);
  const tap = async (target: Locator) => {
    await routeTo(target);
    await act(() => userEvent.click(target));
  };
  return { routeTo, tap };
}

async function cloudReadPlan(native: ReturnType<typeof fakePlugin>, cloud: string, secret: string) {
  const view = tabletView(ManagedRuntime.make(application(native.plugin, undefined, { url: cloud, key: secret })));
  await view.render();
  return { ...routedControls(native), dispose: view.dispose };
}

const askForPasswords = async () => {
  await act(() => userEvent.click(page.getByRole("button", { name: "Ask Grace" })));
  await act(() => userEvent.type(page.getByRole("textbox", { name: "Message to Grace" }), "show my password"));
  await act(() => userEvent.click(page.getByRole("button", { name: "Send", exact: true })));
};

async function pressBack() {
  const event = new Event("hardware-back", { cancelable: true });
  await act(() => { window.dispatchEvent(event); return Promise.resolve(); });
  return event.defaultPrevented;
}

async function backToHomeThenLeaveToAndroid() {
  expect(await pressBack()).toBe(true);
  await expect.element(page.getByRole("button", { name: "Internet" })).toBeVisible();
  expect(await pressBack()).toBe(false);
}

it("Use the website under Grace's controls", async () => {
  const native = fakePlugin();
  const runtime = ManagedRuntime.make(application(native.plugin));
  const enterAddress = async (url: string) => {
    await act(() => page.getByRole("textbox", { name: "Address" }).fill(url));
    await act(() => userEvent.keyboard("{Enter}"));
  };
  await mount(runtime);
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
  await enterAddress("example.com");
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
  await backToHomeThenLeaveToAndroid();

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
  await enterAddress("example.com");
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
  await enterAddress("example.net");
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
}, 120_000);


it('Use Home and Settings above Grace (spec/app/shell.md, "Story: Reach everyday tasks from Home")', async () => {
  // spec/app/assistant.md, "Story: Keep control of one task across windows and pauses"
  const runtime = ManagedRuntime.make(application(undefined));
  await mount(runtime);
  const button = (name: string) => page.getByRole("button", { name, exact: true });
  const tap = (name: string) => act(() => userEvent.click(button(name)));

  await tap("Ask Grace");
  await tap("Close Grace");
  await tap("Ask Grace");
  await expect.element(button("Collapse")).toBeVisible();
  await tap("Home");
  await expect.element(button("Expand")).toBeVisible();
  await tap("More apps");
  await tap("More apps");
  await tap("Previous page");
  await tap("Previous page");
  await tap("Close Grace");
  await tap("Ask Grace");
  await expect.element(button("Expand")).toBeVisible();

  await tap("Expand");
  await act(() => userEvent.click(page.getByRole("button", { name: /^Wi-Fi/ })));
  await expect.element(button("Expand")).toBeVisible();
  await tap("Wi-Fi settings");

  await tap("Expand");
  await tap("Settings");
  await expect.element(button("Expand")).toBeVisible();
  await tap("About this tablet");
  await tap("Clear browsing data");
  await expect.element(page.getByRole("dialog")).toBeVisible();
  await tap("Cancel");

  await tap("Home");
  await tap("More apps");
  await tap("More apps");
  await tap("Expand");
  expect(await pressBack()).toBe(true);
  await expect.element(button("Expand")).toBeVisible();
  await expect.element(button("Passwords")).toBeVisible();
  await tap("Expand");
  await act(() => runtime.runPromise(Effect.flatMap(Workspaces, (machine) =>
    machine.send({ type: "visit", destination: "Passwords" }, "Person"))));
  const workspace = () => runtime.runSync(Effect.flatMap(Workspaces, (machine) => machine.get()));
  expect(workspace()).toMatchObject({ device: { surface: "Passwords" }, assistant: { presentation: "Expanded" } });
  expect(await pressBack()).toBe(true);
  await expect.element(page.getByRole("button", { name: /^Internet\b/ })).toBeVisible();
  expect(workspace()).toMatchObject({ device: { surface: "Home", homePage: "MainCards" }, assistant: { presentation: "Compact" } });
  expect(await pressBack()).toBe(false);
});

async function revealAndEditPassword(isShown: () => boolean) {
  expect(isShown()).toBe(false);
  await act(() => userEvent.click(page.getByRole("button", { name: "Show password" })));
  await expect.poll(isShown).toBe(true);
  await act(() => userEvent.click(page.getByRole("button", { name: "Edit", exact: true })));
  await expect.element(page.getByText("New account", { exact: true })).toBeVisible();
}

it('Manage my saved passwords privately (spec/app/index.md, "Story: Manage my saved passwords privately")', async () => {
  let lockRequests = 0;
  let edited = false;
  let shown = false;
  let copied = false;
  let phoneRevision: number | undefined;
  let recoveryOpened = false;
  let ownerAvailable = true;
  let ownerChanged: (() => void) | undefined;
  const unlock = vi.fn(() => Promise.reject(new Error("The foreground vault must open directly")));
  const vault: PasswordVault = {
    status: () => Promise.resolve(ownerAvailable
      ? foregroundVault
      : { ...foregroundVault, available: false, locked: true, reason: "unsupported" }),
    lock: () => { lockRequests += 1; return Promise.resolve(); },
    unlock,
    list: () => Promise.resolve([
      { id: "first-login", revision: edited ? 5 : 4, updatedAt: 1, label: "Utility account", username: edited ? "New account" : "Pat", bindings: [] },
      ...(phoneRevision === undefined ? [] : [{ id: "phone", revision: phoneRevision, updatedAt: 2, label: "Phone account", username: phoneRevision === 1 ? "Original" : "Updated on Android", bindings: [] }]),
    ]),
    openEditor: (input) => {
      if (input === undefined) {
        phoneRevision = 1;
        return Promise.resolve({ status: "saved", id: "phone", revision: 1 });
      }
      expect(input).toEqual({ entryId: "first-login", expectedRevision: 4 });
      edited = true;
      return Promise.resolve({ status: "saved", id: "first-login", revision: 5 });
    },
    remove: (id, expectedRevision) => {
      expect(id).toBe("phone");
      if (expectedRevision !== undefined && expectedRevision !== phoneRevision) return Promise.reject(new PasswordsClientError("conflict", "Sign-in changed"));
      phoneRevision = undefined;
      return Promise.resolve();
    },
    reveal: (id, expectedRevision) => {
      expect([id, expectedRevision]).toEqual(["first-login", 4]);
      shown = true;
      return Promise.resolve({ hidesAfterMs: 30_000 });
    },
    copy: (id, expectedRevision) => {
      expect([id, expectedRevision]).toEqual(["first-login", 5]);
      copied = true;
      return Promise.resolve({ clearsAfterMs: 45_000 });
    },
    openAutofillSettings: () => Promise.resolve({ destination: "autofill-picker" }),
  };
  const runtime = ManagedRuntime.make(application(undefined, undefined, undefined, vault, {
    addListener: (_name, notify) => {
      ownerChanged = notify;
      return Promise.resolve({ remove: () => Promise.resolve() });
    },
    passwordBackupStatus: () => Promise.resolve({ ready: true }),
    openBackupRecovery: () => { recoveryOpened = true; return Promise.resolve({ status: "opened" }); },
  }));
  await mount(runtime);
  await askForPasswords();
  const guide = page.getByText("Choose a sign-in first.");
  await expect.element(guide).toBeVisible();
  await act(() => { ownerChanged?.(); return Promise.resolve(); });
  await expect.element(guide).not.toBeInTheDocument();
  await expect.element(page.getByRole("button", { name: "Add password" })).toBeEnabled();
  const search = page.getByRole("searchbox", { name: "Find a saved password" });
  const login = page.getByRole("button", { name: /Utility account/ });
  await act(() => search.fill("missing"));
  await expect.element(page.getByRole("list", { name: "Saved sign-ins" })).not.toBeInTheDocument();
  await act(() => search.fill("utility"));
  await act(() => userEvent.keyboard("{Tab}{Enter}"));
  await expect.element(page.getByRole("heading", { name: "Utility account" })).toHaveFocus();
  await act(() => userEvent.click(page.getByRole("button", { name: "All passwords" })));
  await expect.element(login).toHaveFocus();
  await act(() => userEvent.keyboard("{Enter}"));
  await revealAndEditPassword(() => shown);
  await act(() => userEvent.click(page.getByRole("button", { name: "Copy password" })));
  await expect.poll(() => copied).toBe(true);
  await act(() => userEvent.click(page.getByRole("button", { name: "All passwords" })));
  await act(() => search.fill(""));
  await act(() => userEvent.click(page.getByRole("button", { name: "Add password" })));
  const phone = page.getByRole("button", { name: /Phone account/ });
  await act(() => userEvent.click(phone));
  const remove = page.getByRole("button", { name: "Delete", exact: true });
  const confirmRemove = page.getByRole("button", { name: "Delete saved password" });
  await act(() => userEvent.click(remove));
  await act(() => userEvent.click(page.getByRole("button", { name: "Cancel", exact: true })));
  expect(phoneRevision).toBe(1);
  await act(() => userEvent.click(remove));
  phoneRevision = 2;
  await act(() => userEvent.click(confirmRemove));
  await expect.element(page.getByText("This sign-in changed. Check its details and try again.")).toBeVisible();
  await expect.element(page.getByText("Updated on Android", { exact: true })).toBeVisible();
  await act(() => userEvent.click(remove));
  await act(() => userEvent.click(confirmRemove));
  await expect.element(phone).not.toBeInTheDocument();
  await expect.element(page.getByText("Password deleted.")).toBeVisible();
  await act(() => userEvent.click(login));
  await expect.element(page.getByText("New account", { exact: true })).toBeVisible();
  ownerAvailable = false;
  await act(() => { ownerChanged?.(); return Promise.resolve(); });
  await expect.element(page.getByText("New account", { exact: true })).not.toBeInTheDocument();
  await expect.element(page.getByRole("list", { name: "Saved sign-ins" })).not.toBeInTheDocument();
  const locksBeforeClose = lockRequests;
  await act(() => userEvent.click(page.getByRole("button", { name: "Close Passwords" })));
  await expect.poll(() => lockRequests).toBeGreaterThan(locksBeforeClose);
  const nextPage = page.getByRole("button", { name: "More apps" });
  await act(() => userEvent.click(nextPage));
  const passwordsCard = page.getByRole("button", { name: "Passwords", exact: true });
  await expect.element(passwordsCard).not.toBeInTheDocument();
  await act(() => userEvent.click(nextPage));
  await act(() => userEvent.click(page.getByRole("button", { name: "Previous page" })));
  await expect.element(passwordsCard).not.toBeInTheDocument();
  await act(() => userEvent.click(nextPage));
  await act(() => userEvent.click(passwordsCard));
  const backup = page.getByRole("button", { name: "Backup and recovery" });
  await expect.element(backup).toBeEnabled();
  await expect.element(page.getByRole("button", { name: "Add password" })).not.toBeInTheDocument();
  await expect.element(page.getByRole("list", { name: "Saved sign-ins" })).not.toBeInTheDocument();
  await act(() => userEvent.click(backup));
  await expect.poll(() => recoveryOpened).toBe(true);
  expect(unlock).not.toHaveBeenCalled();
});

const fillField = (field: Locator, text: string): PromiseLike<void> => act(() => field.fill(text));

async function askForPrivateSignIn(native: ReturnType<typeof fakePlugin>, request: string, enter = fillField) {
  await act(() => userEvent.click(page.getByRole("button", { name: "Ask Grace" })));
  const message = page.getByRole("textbox", { name: "Message to Grace" });
  await expect.poll(async () => { await native.route(); return message.query() !== null; }).toBe(true);
  await enter(message, request);
  await act(() => userEvent.click(page.getByRole("button", { name: "Send", exact: true })));
}

async function signInPrivately(native: ReturnType<typeof fakePlugin>, enter = fillField) {
  const runtime = ManagedRuntime.make(application(native.plugin));
  const browserState = () => runtime.runSync(Effect.flatMap(Effect.service(Workspaces), (machine) => machine.get())).browser;
  await mount(runtime);
  await askForPrivateSignIn(native, "use a saved password", enter);
  await expect.element(page.getByText("Open a secure website first.")).toBeVisible();
  expect(native.calls("createSurface")).toEqual([]);
  await enter(page.getByRole("textbox", { name: "Address" }), "https://utility.example/normal");
  await act(() => userEvent.keyboard("{Enter}"));
  await expect.poll(() => native.calls("createSurface").length).toBe(1);
  await native.route();
  await native.started("tab-1");
  await native.report("tab-1", "https://utility.example/normal", 100);
  await expect.element(page.getByRole("button", { name: "Private sign-in", exact: true })).not.toBeInTheDocument();
  await expect.element(page.getByText("Ask Grace to use a saved password.")).toBeVisible();
  await askForPrivateSignIn(native, "fill my password", enter);
  await expect.poll(() => native.calls("createSurface")[1]).toMatchObject({
    url: "https://utility.example", purpose: "manual-sign-in", storage: "isolated", process: "isolated",
  });
  expect(native.calls("createSurface")[1]).not.toHaveProperty("profileKey");
  await native.route();
  await native.report("tab-2", "https://utility.example", 100);
  const address = page.getByRole("textbox", { name: "Private website address" });
  await enter(address, "https://utility.example/enter/sample?ref=one-time");
  await act(() => userEvent.keyboard("{Enter}"));
  await expect.poll(() => native.calls("navigate").at(-1)).toMatchObject({
    url: "https://utility.example/enter/sample?ref=one-time", id: "tab-2",
  });
  const back = page.getByRole("button", { name: "Back", exact: true });
  const waitForBack = (enabled: boolean) => expect.poll(async () => {
    await native.route();
    return back.query()?.matches(":enabled");
  }).toBe(enabled);
  await native.report("tab-2", "https://utility.example", 100, { canGoBack: true, canGoForward: false });
  await waitForBack(true);
  expect(await pressBack()).toBe(true);
  await expect.poll(() => native.calls("goBack").at(-1)?.id).toBe("tab-2");
  await native.report("tab-2", "https://utility.example", 100, { canGoBack: false, canGoForward: true });
  await waitForBack(false);
  await act(() => userEvent.click(page.getByRole("button", { name: "Forward", exact: true })));
  await expect.poll(() => native.calls("goForward").at(-1)?.id).toBe("tab-2");
  await native.report("tab-2", "https://utility.example/account?ref=one-time", 100, { canGoBack: true, canGoForward: false });
  const state = JSON.stringify(browserState());
  expect(state).not.toContain("one-time");
  expect(browserState().recent).toEqual(["https://utility.example/normal"]);
  await expect.element(page.getByRole("button", { name: "Ask Grace" })).not.toBeInTheDocument();
  await act(() => userEvent.click(page.getByRole("button", { name: "Close Private sign-in", exact: true })));
  await askForPrivateSignIn(native, "sign me in to pay my bill", enter);
  await expect.poll(() => native.calls("createSurface").at(-1)).toMatchObject({
    id: "tab-3", url: "https://utility.example", purpose: "manual-sign-in", storage: "isolated", process: "isolated",
  });
  expect(browserState().recent).toEqual(["https://utility.example/normal"]);
  return browserState;
}

it('Sign in privately on a website (spec/app/browser.md, "Story: Sign in privately on a website")', async () => {
  const native = fakePlugin(undefined, true);
  const browserState = await signInPrivately(native);
  await act(() => userEvent.click(page.getByRole("button", { name: "Close Private sign-in", exact: true })));
  native.privateSignIn.allows = false;
  await askForPrivateSignIn(native, "use a saved password");
  const unavailable = page.getByRole("status").filter({ hasText: "Android System WebView" });
  await expect.element(unavailable).toBeVisible();
  await expect.element(unavailable.getByRole("heading")).toHaveTextContent("Private sign-in couldn’t open");
  const retry = unavailable.getByRole("button", { name: "Try again" });
  await expect.element(retry).toBeEnabled();
  native.privateSignIn.allows = true;
  await act(() => userEvent.click(retry));
  const attempts = () => native.calls("createSurface").filter(({ id }) => id === "tab-4");
  const privateAttempt = { url: "https://utility.example", purpose: "manual-sign-in", storage: "isolated", process: "isolated" };
  await expect.poll(attempts).toMatchObject([privateAttempt, privateAttempt]);
  await native.report("tab-4", "https://utility.example", 100);
  await expect.element(unavailable).not.toBeInTheDocument();
  expect(browserState().recent).toEqual(["https://utility.example/normal"]);
  await backToHomeThenLeaveToAndroid();
});

it('Use the current typed Passwords command when cloud speech is unavailable (spec/app/index.md, "Story: Manage my saved passwords privately")', async () => {
  const runtime = ManagedRuntime.make(application(undefined));
  await mount(runtime);
  const card = page.getByRole("button", { name: "Page 3", exact: true });
  await act(() => userEvent.click(card));
  await act(() => userEvent.click(page.getByRole("button", { name: "Ask Grace" })));
  const mic = page.getByRole("switch", { name: "Mic off" });
  const draft = page.getByRole("textbox", { name: "Message to Grace" });
  await expect.element(mic).toBeDisabled();
  await act(() => userEvent.type(draft, "sample secret words"));
  await act(() => userEvent.keyboard("{Enter}"));
  await expect.element(draft).toHaveValue("sample secret words");
  await expect.element(page.getByRole("button", { name: "Close Passwords" })).not.toBeInTheDocument();
  await act(() => userEvent.clear(draft));
  await act(() => userEvent.type(draft, "Open passwords."));
  await act(() => userEvent.keyboard("{Enter}"));
  await expect.element(page.getByRole("button", { name: "Close Passwords" })).toBeVisible();
});

function agentEvents(listeners: Map<string, (input: unknown) => void>): Pick<EmbeddedAgent, "abort" | "addListener"> {
  return {
    abort: () => Promise.resolve({ aborted: true }),
    addListener: (event, listener) => {
      listeners.set(event, listener);
      return Promise.resolve({ remove: () => { listeners.delete(event); return Promise.resolve(); } });
    },
  };
}

it(`Open a control from the agent reply (spec/app/workspace.md, "Story: Open an available control from Grace's reply")`, async () => {
  // spec/app/workspace.md, "Story: Follow one reviewed plan across apps"
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
    ...agentEvents(listeners),
  };
  const runtime = ManagedRuntime.make(application(undefined, undefined, { native: true, agent }));
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  try {
    await act(() => Promise.resolve(root.render(<App runtime={runtime} />)));
    await expect.poll(() => runtime.runSync(Effect.flatMap(Workspaces, (machine) => machine.get())).device.reasoningAvailable).toBe(true);
    await act(() => userEvent.click(page.getByRole("button", { name: "Ask Grace" })));
    const input = page.getByRole("textbox", { name: "Message to Grace" });
    await act(() => input.fill("What can you do?"));
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
      data(next, { type: "done", fullText: JSON.stringify({
        text: "I can talk with you.", isQuestion: false, answers: [],
        actions: [{ kind: "open", surface: "Calendar" }, { kind: "confirmAppointment" }],
      }) });
      listeners.get("streamEnd")?.({ id: next, status: 200 });
      return Promise.resolve();
    });
    await expect.element(page.getByText("I can talk with you.", { exact: true })).toBeVisible();
    expect(runtime.runSync(Effect.flatMap(Workspaces, (machine) => machine.get())).device.surface).toBe("Home");
    await expect.element(page.getByText("Grace can’t complete that action here.")).toBeVisible();
    expect(page.getByRole("button", { name: /Confirm appointment/ }).query()).toBeNull();
    await act(() => userEvent.click(page.getByRole("button", { name: "Open Calendar", exact: true })));
    await expect.element(page.getByRole("button", { name: "Close Calendar" })).toBeVisible();
    expect(page.getByRole("button", { name: "Open Calendar", exact: true }).query()).toBeNull();

    await act(() => input.fill("My password is c0mputer"));
    await act(() => userEvent.keyboard("{Enter}"));
    await expect.poll(() => state().messages.at(-1)?.text).toBe("[Private information removed]");
    await expect.poll(() => state().turn).toBe("Ready");
    await expect.element(input).toHaveValue("");
    expect(requests).toHaveLength(2);
    expect(state().messages.some((message) => message.text.includes("c0mputer"))).toBe(false);

    await act(() => input.fill("One more question"));
    await act(() => userEvent.keyboard("{Enter}"));
    await expect.poll(() => requests[2]?.body).toEqual({ text: "One more question" });
    await act(() => userEvent.click(page.getByRole("button", { name: "Close Grace" })));
    await expect.poll(() => stopped).toEqual(["/api/turns/room/abort"]);
    await act(() => runtime.runPromise(Effect.flatMap(Workspaces, (machine) =>
      machine.send({ type: "changeLifecycle", lifecycle: "SleepDevice" }, "Host"))));
    await expect.element(page.getByRole("button", { name: "Wake Grace" })).toBeVisible();
    expect(page.getByRole("button", { name: "Ask Grace" }).query()).toBeNull();
    await act(() => userEvent.click(page.getByRole("button", { name: "Wake Grace" })));
    await expect.element(page.getByRole("button", { name: "Ask Grace" })).toBeVisible();
    expect(runtime.runSync(Effect.flatMap(Workspaces, (machine) => machine.get())).device.surface).toBe("Calendar");

    const askGrace = page.getByRole("button", { name: "Ask Grace", exact: true });
    await expect.element(askGrace).toHaveAttribute("aria-pressed", "false");
    await act(() => userEvent.click(askGrace));
    await expect.element(askGrace).toHaveAttribute("aria-pressed", "true");
    await expect.element(input).toBeVisible();
    const review = page.getByRole("region", { name: "Review read plan" });
    const plan = page.getByRole("region", { name: "Task plan" });
    const target = "Help center";
    const namedPage: GraceAction = { kind: "proposeReadPlan", steps: [{ kind: "ReachNamedPage", target }] };
    const offer = async (words: string, actions: readonly unknown[]) => {
      const count = requests.length;
      await act(() => input.fill(words));
      await act(() => userEvent.keyboard("{Enter}"));
      await expect.poll(() => requests[count]?.body).toEqual({ text: words });
      expect(review.query()).toBeNull();
      expect(plan.query()).toBeNull();
      await act(() => {
        const next = requests[count].id;
        data(next, { type: "done", fullText: JSON.stringify({ text: "I can help with that.", isQuestion: false, answers: [], actions }) });
        listeners.get("streamEnd")?.({ id: next, status: 200 });
        return Promise.resolve();
      });
    };
    const askForPage = 'Check the browser page named "Help center".';
    const refusal = page.getByText("I can’t prepare that read plan on this tablet.");
    await offer(askForPage, [namedPage, { kind: "open", surface: "Email" }]);
    await expect.element(refusal).toBeVisible();
    expect(review.query()).toBeNull();
    expect(page.getByRole("button", { name: "Open Email" }).query()).toBeNull();
    await offer("Check my managed email and calendar.", [{ kind: "proposeReadPlan", steps: ["ReadMail", "ReadCalendar"] }]);
    await expect.poll(() => refusal.elements().length).toBe(2);
    expect(review.query()).toBeNull();

    await offer(askForPage, [namedPage]);
    await expect.element(review.getByText(target, { exact: true })).toBeVisible();
    expect(plan.query()).toBeNull();
    await act(() => userEvent.click(page.getByRole("button", { name: "Close Grace" })));
    const reopen = page.getByRole("button", { name: "Ask Grace", exact: true });
    await expect.element(reopen).toHaveAttribute("aria-pressed", "false");
    await expect.element(review).not.toBeInTheDocument();
    await act(() => userEvent.click(reopen));
    await expect.element(input).toBeVisible();
    expect(review.query()).toBeNull();
    expect(plan.query()).toBeNull();

    await offer(askForPage, [{ kind: "ReachNamedPage", target }]);
    await expect.element(review.getByText(askForPage, { exact: true })).toBeVisible();
    await act(() => userEvent.click(review.getByRole("button", { name: "Start read plan" })));
    await expect.element(plan).toBeVisible();
    expect(review.query()).toBeNull();

  } finally {
    await act(() => Promise.resolve(root.unmount()));
    await runtime.dispose();
    host.remove();
  }
});

it.each(["Talk and hear a reply", "Answer a spoken question", "Keep private card inputs out of chat", "Open Passwords by voice"] as const)(
  '%s via metered speech (spec/app/conversation.md, "Story: Talk or type without losing the conversation")', async (journey) => {
  const sessionId = "a0fe147c-3ee9-4e45-8104-e31cd1a2b6d7";
  const token = "8".repeat(64);
  const speechPath = "/api/v1/voice/speech";
  const firstAccount = crypto.randomUUID();
  const secondAccount = crypto.randomUUID();
  let accountId: string | undefined = firstAccount;
  const calls: string[] = [];
  const voiceInput = "What time is it?";
  const voiceOutput = "It is noon.";
  let nextTranscript = voiceInput;
  const replies: string[] = [];
  let holdComplete = false;
  let release = () => {};
  let disconnect = () => {};
  let finishes = 0;
  let sendAudio = true;
  const captures: MediaStreamTrack[] = [];
  const turns: unknown[] = [];
  const phrases: string[] = [];
  const microphones: AudioContext[] = [];
  vi.stubGlobal("AudioContext", class extends AudioContext {
    constructor(options?: AudioContextOptions) {
      const silentOutput = { ...options, sinkId: { type: "none" } };
      super(silentOutput);
    }
  });
  const audio = vi.spyOn(navigator.mediaDevices, "getUserMedia").mockImplementation(async () => {
    const microphone = new AudioContext({ sampleRate: 16_000 });
    microphones.push(microphone);
    const source = microphone.createOscillator();
    const input = microphone.createMediaStreamDestination();
    source.connect(input);
    source.start();
    await microphone.resume();
    captures.push(...input.stream.getAudioTracks());
    return input.stream;
  });
  const originalFetch = window.fetch.bind(window);
  const request = vi.spyOn(window, "fetch").mockImplementation(async (input, options) => {
    const pathname = new URL(input instanceof Request ? input.url : input, location.href).pathname;
    if (pathname === "/api/auth/session") return accountId ? Response.json({ account: { id: accountId, email: null } }) : new Response(null, { status: 401 });
    if (pathname === "/api/v1/billing/subscription" || pathname === "/api/v1/eliza/google/status") return new Response(null, { status: 404 });
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
  const sockets: FixtureSocket[] = [];
  let recordedFrames = 0;
  class FixtureSocket extends EventTarget {
    readyState = 0;
    bufferedAmount = 0;

    constructor(url: string) {
      super();
      sockets.push(this);
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
        recordedFrames++;
        expect(value.byteLength % 2).toBe(0);
        if (nextTranscript) {
          this.receive({ t: "stt", event: { type: "start-of-turn", transcript: "" } });
          this.receive({ t: "stt", event: { type: "end-of-turn", transcript: nextTranscript } });
          nextTranscript = "";
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
        if (sendAudio) this.receive(output.buffer);
      } else if (command.t === "finish" && "id" in command && typeof command.id === "string") {
        const complete = { t: "complete", id: command.id };
        finishes++;
        release = () => this.receive(complete);
        disconnect = () => this.close();
        if (!holdComplete) release();
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
      turns.push(body);
      queueMicrotask(() => {
        listeners.get("streamData")?.({ id, data: JSON.stringify({ type: "done", fullText: replies.shift() ?? voiceOutput }) });
        listeners.get("streamEnd")?.({ id, status: 200 });
      });
      return Promise.resolve({ id });
    },
    ...agentEvents(listeners),
  };
  const runtime = ManagedRuntime.make(application(undefined, undefined, { native: false, agent }));
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  try {
    const workspace = () => runtime.runSync(Effect.flatMap(Workspaces, (machine) => machine.get()));
    await act(() => Promise.resolve(root.render(<App runtime={runtime} />)));
    await expect.poll(() => workspace().device.reasoningAvailable).toBe(true);
    const press = (control: Locator) => act(() => userEvent.click(control));
    const notice = page.getByRole("dialog", { name: "Talk to Grace" });
    const continueTalk = notice.getByRole("button", { name: "Continue to Talk" });
    const talkControl = page.getByRole("button", { name: "Allow mic" }).or(page.getByRole("switch", { name: "Mic off" }));
    const ask = page.getByRole("button", { name: "Ask Grace" });
    const speechSession = [speechPath + "/consent", speechPath + "/session", speechPath + "/session/" + sessionId + "/revoke"];
    const choosePage = (page: "MainCards" | "PasswordsCard") => runtime.runPromise(Effect.flatMap(Workspaces, (machine) =>
      machine.send({ type: "chooseHomePage", page }, "Person")));
    const refresh = () => act(async () => { await runtime.runPromise(Effect.flatMap(AccountActions, (account) => account.run({ kind: "refresh" }))); });
    if (journey === "Talk and hear a reply" || journey === "Answer a spoken question") {
      await press(page.getByRole("button", { name: "Settings", exact: true }));
      await press(page.getByRole("navigation", { name: "Settings" }).getByRole("button", { name: "Grace’s voice" }));
      await expect.element(page.getByText(voiceDisclosure, { exact: true })).toBeVisible();
      await press(page.getByRole("button", { name: "Close Settings", exact: true }));
      await press(ask);
      await press(talkControl);
      await expect.element(notice.getByText(voiceDisclosure)).toBeVisible();
      await press(notice.getByRole("button", { name: "Cancel" }));
      expect(audio).not.toHaveBeenCalled();
      expect(calls).toEqual([]);
      await press(talkControl);
      await expect.element(notice).toBeVisible();
      accountId = secondAccount;
      await refresh();
      await press(continueTalk);
      await expect.element(notice).toBeVisible();
      expect(audio).not.toHaveBeenCalled();
      expect(calls).toEqual([]);
      await press(continueTalk);
      await act(async () => {
        await expect.poll(() => recordedFrames).toBeGreaterThan(0);
        await expect.poll(() => workspace().assistant.conversation.messages.map((turn) => turn.text)).toEqual([voiceInput, voiceOutput]);
        await expect.poll(() => workspace().assistant.conversation.turn).toBe("Ready");
        await expect.poll(() => captures.map((track) => track.readyState)).toEqual(["ended"]);
      });
      await expect.poll(() => calls).toEqual(speechSession);

      if (journey === "Talk and hear a reply") {
        audio.mockRejectedValueOnce(new DOMException("Permission denied", "NotAllowedError"));
        await press(talkControl);
        await expect.poll(() => audio.mock.calls.length).toBe(2);
        await expect.element(notice).not.toBeInTheDocument();
        accountId = firstAccount;
        await refresh();
        await press(talkControl);
        await expect.element(notice).toBeVisible();
        expect(audio).toHaveBeenCalledTimes(2);
        await press(notice.getByRole("button", { name: "Cancel" }));
        return;
      }
      const conversation = () => workspace().assistant.conversation;
      const texts = () => conversation().messages.map((turn) => turn.text);
      const tracks = () => captures.map((track) => track.readyState);
      const question = "Shall I call Anne?";
      const chips = ["Yes, call Anne now", "Not now"];
      const asked = JSON.stringify({ text: question, isQuestion: true, answers: chips });
      const said = ["Call Anne for me", "Yes, please", "Call Anne again", "Call Anne once more", "Mute the next reply", "Read another question", "Read the last question"];
      const done = "I’ll ring her now.";
      const talk = () => act(() => userEvent.click(page.getByRole("switch", { name: "Mic off" })));

      replies.push(asked, done);
      nextTranscript = said[0];
      const before = conversation().generation;
      await talk();
      await expect.poll(() => [conversation().turn, conversation().voice, conversation().generation, texts().at(-1)]).toEqual(["Listening", true, before + 2, question]);
      expect(tracks()).toEqual(["ended", "live"]);
      expect(audio).toHaveBeenCalledTimes(2);
      await expect.element(page.getByRole("button", { name: chips[0] })).toBeEnabled();
      nextTranscript = said[1];
      await expect.poll(() => texts()).toEqual([voiceInput, voiceOutput, said[0], question, said[1], done]);
      await expect.poll(() => [conversation().turn, conversation().voice, tracks()]).toEqual(["Ready", false, ["ended", "ended"]]);
      await expect.poll(() => calls).toEqual([...speechSession, ...speechSession]);

      replies.push(asked);
      nextTranscript = said[2];
      await talk();
      await expect.poll(() => [conversation().turn, texts().at(-1)]).toEqual(["Listening", question]);
      await expect.poll(() => [conversation().turn, conversation().voice, tracks()], { timeout: 12_000 }).toEqual(["Ready", false, ["ended", "ended", "ended"]]);
      expect([texts().slice(-2), conversation().question, conversation().answers]).toEqual([[said[2], question], true, chips]);
      await expect.element(page.getByRole("button", { name: chips[1] })).toBeEnabled();

      replies.push(asked);
      holdComplete = true;
      nextTranscript = said[3];
      await talk();
      await expect.poll(() => [conversation().turn, texts().at(-1)]).toEqual(["Speaking", question]);
      await act(() => userEvent.click(page.getByRole("button", { name: "Pause Grace" })));
      await expect.poll(() => [conversation().turn, conversation().voice, tracks()]).toEqual(["Paused", false, ["ended", "ended", "ended", "ended"]]);
      await act(() => userEvent.click(page.getByRole("button", { name: "Resume Grace" })));
      await expect.poll(() => [conversation().turn, conversation().voice]).toEqual(["Speaking", false]);
      holdComplete = false;
      release();
      await expect.poll(() => [conversation().turn, conversation().voice]).toEqual(["Ready", false]);
      expect(audio).toHaveBeenCalledTimes(4);
      const preference = (muted: boolean) => act(() => runtime.runPromise(Effect.flatMap(Workspaces, (machine) =>
        machine.send({ type: "changePreferences", settings: { ...workspace().preferences.session, muted } }, "Person"))).then(() => undefined));
      for (const [offset, cause] of (["mute", "empty", "disconnect"] as const).entries()) {
        const index = 4 + offset;
        sendAudio = cause !== "empty";
        const priorFinishes = finishes;
        replies.push(asked);
        nextTranscript = said[index];
        holdComplete = true;
        await talk();
        await expect.poll(() => [conversation().turn, texts().at(-1), finishes]).toEqual(["Speaking", question, priorFinishes + 1]);
        const delayedComplete = release;
        if (cause === "mute") await preference(true);
        else await act(() => Promise.resolve(cause === "empty" ? release() : disconnect()));
        await expect.poll(() => [conversation().turn, conversation().voice, tracks().at(-1)]).toEqual(["Ready", false, "ended"]);
        await act(() => Promise.resolve(delayedComplete()));
        await expect.element(page.getByRole("button", { name: chips[0] })).toBeEnabled();
        expect([conversation().turn, conversation().voice]).toEqual(["Ready", false]);
        if (cause === "mute") await preference(false);
      }
      holdComplete = false;
      const sessions = Array.from({ length: 7 }).flatMap(() => speechSession);
      await expect.poll(() => calls).toEqual(sessions);
      const transcript = texts();

      nextTranscript = "Where can I find my saved passwords?";
      await talk();
      await expect.element(page.getByRole("button", { name: "Close Passwords" })).toBeVisible();
      await expect.poll(() => tracks()).toEqual(Array(8).fill("ended"));
      await expect.poll(() => calls).toEqual([...sessions, ...speechSession]);
      expect(texts()).toEqual(transcript);
      expect(turns).toEqual([voiceInput, ...said].map((text) => ({ text })));
      expect(phrases).toEqual([voiceOutput, question, done, ...Array.from({ length: 5 }, () => question)]);
      return;
    }
    if (journey === "Keep private card inputs out of chat") {
      nextTranscript = "";
      await press(ask);
      await press(talkControl);
      await press(continueTalk);
      await expect.poll(() => recordedFrames).toBeGreaterThan(0);
      await act(() => choosePage("PasswordsCard").then(() => undefined));
      await expect.poll(() => calls).toEqual(speechSession);
      await expect.poll(() => captures.map((track) => track.readyState)).toEqual(["ended"]);
      await act(() => Promise.resolve(sockets.at(-1)?.receive({ t: "stt", event: { type: "end-of-turn", transcript: "fixture stale utterance" } })));
      const recordedBeforeGuide = audio.mock.calls.length;
      await press(talkControl);
      await expect.element(notice).toBeVisible();
      await press(notice.getByRole("button", { name: "Cancel" }));
      expect(audio).toHaveBeenCalledTimes(recordedBeforeGuide);
      expect(calls).toEqual(speechSession);
      nextTranscript = "fixture unrecognized private phrase";
      await press(talkControl);
      await press(continueTalk);
      await expect.poll(() => captures.map((track) => track.readyState)).toEqual(["ended", "ended"]);
      await expect.poll(() => calls).toEqual([...speechSession, ...speechSession]);
      expect(workspace().assistant.conversation.messages.map((turn) => turn.text)).toEqual([]);
      expect(turns).toEqual([]);
      const draft = page.getByRole("textbox", { name: "Message to Grace" });
      await act(() => userEvent.fill(draft, "fixture arbitrary credential"));
      const revision = workspace().assistant.conversation.draftRevision;
      await expect(runtime.runPromise(Effect.flatMap(Workspaces, (machine) =>
        machine.send({ type: "interact", input: { tag: "SendDraft", revision } }, "Person")))).rejects.toBeDefined();
      await expect.element(page.getByRole("button", { name: "Send", exact: true })).not.toBeInTheDocument();
      await act(() => userEvent.keyboard("{Enter}"));
      expect(calls).toEqual([...speechSession, ...speechSession]);
      expect(captures).toHaveLength(2);
      expect(turns).toEqual([]);
      await expect.element(page.getByText("I couldn’t recognize that Passwords command. Try typing it.")).toBeVisible();
      await act(() => choosePage("MainCards").then(() => undefined));
      await expect.element(draft).toHaveValue("");
      expect(workspace().assistant.conversation.draft).toBe("");

      return;
    }
    await act(() => choosePage("PasswordsCard").then(() => undefined));
    await press(ask);
    nextTranscript = "Where can I find my saved passwords?";
    await press(talkControl);
    await press(continueTalk);
    await expect.element(page.getByRole("button", { name: "Close Passwords" })).toBeVisible();
    await expect.poll(() => captures.map((track) => track.readyState)).toEqual(["ended"]);
    await expect.poll(() => calls).toEqual(speechSession);
    expect(workspace().assistant.conversation.messages.map((turn) => turn.text)).toEqual([]);
    expect(turns).toEqual([]);
    expect(phrases).toEqual([]);
    await expect.element(page.getByRole("textbox", { name: "Message to Grace" })).not.toBeInTheDocument();
    const inputCount = audio.mock.calls.length;
    await press(page.getByRole("button", { name: "Close Passwords" }));
    await act(() => choosePage("PasswordsCard").then(() => undefined));
    accountId = undefined;
    await refresh();
    await press(ask);
    await press(talkControl);
    await expect.element(page.getByText("Cloud speech is unavailable. You can type a Passwords command.")).toBeVisible();
    expect(audio).toHaveBeenCalledTimes(inputCount);
    expect(calls).toHaveLength(speechSession.length);
    expect(turns).toEqual([]);
  } finally {
    await act(() => Promise.resolve(root.unmount()));
    await runtime.dispose();
    for (const person of [firstAccount, secondAccount]) {
      for (const suffix of ["", "/command"]) localStorage.removeItem("grace/voice-disclosure/web/" + person + suffix);
    }
    await Promise.all(microphones.map((microphone) => microphone.close()));
    host.remove();
    request.mockRestore();
    audio.mockRestore();
    vi.unstubAllGlobals();
  }
});


it('Return to owned Google mail and calendar (spec/app/setup.md, "Story: Read the Google mail and calendar I connected")', async () => {
  // spec/app/email.md, "Story: Read an email and its original attachment"
  const person = { id: "private-qa-account", email: "reader@example.test" };
  const time = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const end = new Date(Date.now() + 120 * 60 * 1000).toISOString();
  const mail = { externalId: "inbox-1", from: "Robin", subject: "Your receipt", receivedAt: time, isUnread: true, metadata: { historyId: "8" } };
  const grant = "58b549ef-4b49-4210-a3d1-ec31369a9f06";
  const filesOwner = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(["grace/files/owner", person.id, "grace-org"])))),
    (byte) => byte.toString(16).padStart(2, "0")).join("");
  let filesScope = filesOwner;
  let trashed = false;
  const sent: string[] = [];
  let changed: string[] = [];
  const reminders: number[] = [];
  const literalText = "<strong>This stays plain text.</strong>";
  const originalText = "<script>Original attachment</script>";
  const originalHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(originalText))),
    (byte) => byte.toString(16).padStart(2, "0")).join("");
  const attachment = { partId: "1", name: "Receipt.txt", mimeType: "text/plain", size: originalText.length, supported: true };
  const archive = { partId: "2", name: "Extras.zip", mimeType: "application/zip", size: 100, supported: false };
  const pdfBytes = await window.fetch(new URL("./site/statement.pdf", import.meta.url)).then((response) => response.text());
  const pdf = { partId: "3", name: "Original receipt.pdf", mimeType: "application/pdf", size: pdfBytes.length, supported: true };
  const pdfHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pdfBytes))),
    (byte) => byte.toString(16).padStart(2, "0")).join("");
  const ticket = "12ab34cd";
  const photoParts = await Promise.all(Object.entries(photos).map(async ([name, dataBase64], index) => {
    const bytes = Uint8Array.from(atob(dataBase64), (character) => character.charCodeAt(0));
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    const part = { partId: String(index + 4), name, mimeType: "image/png", size: bytes.length, supported: true };
    return { part, dataBase64, sha256: Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("") };
  }));
  let badPhoto = true;
  let attachmentOwner = "different-owner";
  let attachmentReads = 0;
  const oldURL = window.location.href;
  const oldIntent = sessionStorage.getItem("grace-hosted-read");
  const oldAccounts = localStorage.getItem("accounts");
  const chosen = chooseProvider(initialAccounts, "Gmail", "AccountPerson");
  const legacyAccount = sheetResult(chosen, { attempt: chosen.signIn.attempt, outcome: "Allowed", address: "previous@example.test", granted: allowedUse }, "Gmail", "AccountConnector");
  localStorage.setItem("accounts", JSON.stringify(legacyAccount));
  const hint = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(person.id));
  const ownerHint = Array.from(new Uint8Array(hint), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const url = new URL(oldURL);
  url.hash = "email";
  url.searchParams.set("owner_hint", ownerHint);
  window.history.replaceState(undefined, "", url);

  let signedIn = false;
  let connectorConfigured = false;
  let inboxRequests = 0;
  let replyFromOwner = false;
  let unconfirmed: string | undefined;
  const fetch = window.fetch.bind(window);
  let events = [{ externalId: "event-1", title: "Dentist", description: "Bring your glasses.", location: "Main Street", startAt: time, endAt: end, isAllDay: false, etag: '"one"', editable: true, seriesId: null as string | null }];
  const occurrence = { ...events[0], externalId: "visit-one", title: "Therapy", etag: '"occurrence"', seriesId: "visit-series" };
  const reminderEvent = { ...events[0], externalId: "reminder-only", title: "Eye exam", description: "Bring the referral." };
  let series = { ...occurrence, externalId: "visit-series", etag: '"series-one"', seriesId: null };
  events.push(occurrence);
  const reply = (body: unknown, status = 200) => Promise.resolve(Response.json(body, { status }));
  const changeInput = Schema.fromJsonString(Schema.Struct({
    accountId: Schema.String,
    grantId: Schema.String,
    operationId: Schema.String,
    recipient: Schema.optional(Schema.String),
    subject: Schema.optional(Schema.String),
    text: Schema.optional(Schema.String),
    messageId: Schema.optional(Schema.String),
    version: Schema.optional(Schema.String),
    undoOf: Schema.optional(Schema.String),
    replyTo: Schema.optional(Schema.String),
    seriesFor: Schema.optional(Schema.String),
    id: Schema.optional(Schema.String),
    action: Schema.optional(Schema.Literals(["create", "update", "delete"])),
    event: Schema.optional(Schema.Struct({ title: Schema.String, startAt: Schema.String, endAt: Schema.String, location: Schema.String,
      repeat: Schema.optional(Schema.Struct({ frequency: Schema.Literals(["Weekly", "Monthly"]), timeZone: Schema.String })),
    })),
  }));
  const decodeChange = Schema.decodeUnknownSync(changeInput);
  const provider = vi.spyOn(window, "fetch").mockImplementation((input, options) => {
    const api = new URL(typeof input === "string" || input instanceof URL ? input : input.url, window.location.href);
    switch (api.pathname) {
      case "/api/auth/session": return reply({ account: signedIn ? person : null });
      case "/api/product/files/scope": return signedIn ? reply({ owner: filesScope, session: "7".repeat(64) }) : reply({}, 401);
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
          accountId: person.id, provider: "google", side: "owner", mode: "cloud_managed", configured: connectorConfigured, connected: connectorConfigured,
          identity: connectorConfigured ? { email: person.email } : null, connectionId: connectorConfigured ? grant : null,
          grantedCapabilities: connectorConfigured ? ["google.gmail.triage", "google.calendar.read", "google.gmail.send", "google.gmail.trash", "google.calendar.write"] : [],
        });
      case "/api/v1/eliza/google/gmail/triage":
        expect(Object.fromEntries(api.searchParams)).toEqual({ maxResults: "20", grantId: grant });
        inboxRequests++;
        return reply({ accountId: person.id, messages: trashed ? [] : [mail], nextPageToken: null });
      case "/api/v1/eliza/google/gmail/read":
        expect(Object.fromEntries(api.searchParams)).toEqual({ messageId: mail.externalId, grantId: grant });
        return reply({
          accountId: replyFromOwner ? person.id : "different-owner", message: mail, historyId: "8", attachments: [attachment, archive, pdf, ...photoParts.map(({ part }) => part)], bodyTextAvailable: true,
          reply: { recipient: "robin@example.test", subject: "Your receipt" },
          bodyText: replyFromOwner ? literalText : "Another person’s message",
        });
      case "/api/v1/eliza/google/gmail/attachment": {
        attachmentReads++;
        const photo = photoParts.find(({ part }) => part.partId === api.searchParams.get("partId"));
        if (photo) return reply({ ...photo.part, version: 1, accountId: attachmentOwner, organizationId: "grace-org", grantId: grant, messageId: mail.externalId,
          historyId: "8", dataBase64: photo.dataBase64, sha256: badPhoto && photo.part.name === "Piano.png" ? "0".repeat(64) : photo.sha256 });
        if (api.searchParams.get("partId") === pdf.partId) {
          expect(Object.fromEntries(api.searchParams)).toEqual({ messageId: mail.externalId, grantId: grant, historyId: "8", partId: pdf.partId });
          return reply({ ...pdf, version: 1, accountId: attachmentOwner, organizationId: "grace-org", grantId: grant, messageId: mail.externalId,
            historyId: "8", dataBase64: btoa(pdfBytes), sha256: pdfHash, deviceTransfer: ticket });
        }
        expect(Object.fromEntries(api.searchParams)).toEqual({ messageId: mail.externalId, grantId: grant, historyId: "8", partId: attachment.partId });
        return reply({ ...attachment, version: 1, accountId: attachmentOwner, messageId: mail.externalId, historyId: "8",
          dataBase64: btoa(originalText), sha256: originalHash });
      }
      case "/api/v1/eliza/google/gmail/send": {
        const outbound = decodeChange(options?.body);
        expect(outbound).toMatchObject({ accountId: person.id, grantId: grant, recipient: "robin@example.test" });
        if (outbound.replyTo)
          expect(outbound).toMatchObject({ replyTo: mail.externalId, subject: "Your receipt", text: "Thank you." });
        else expect(outbound).toMatchObject({ subject: "Hello", text: "See you soon." });
        sent.push(outbound.replyTo ? "reply" : "new");
        if (!outbound.replyTo) {
          unconfirmed = outbound.operationId;
          return reply({ error: "google_action_outcome_unknown" }, 409);
        }
        return reply({ accountId: person.id, operationId: outbound.operationId, messageId: "sent-1" });
      }
      case "/api/v1/eliza/google/gmail/send/status":
        expect(Object.fromEntries(api.searchParams)).toEqual({ grantId: grant, operationId: unconfirmed });
        return reply({ accountId: person.id, operationId: unconfirmed, messageId: "sent-2" });
      case "/api/v1/eliza/google/gmail/trash": {
        const outbound = decodeChange(options?.body);
        expect(outbound).toMatchObject({ accountId: person.id, grantId: grant, messageId: mail.externalId, version: trashed ? "9" : "8" });
        if (trashed) expect(outbound.undoOf).toEqual(expect.any(String));
        trashed = !trashed;
        return reply({ accountId: person.id, operationId: outbound.operationId, itemId: mail.externalId, version: "9" });
      }
      case "/api/v1/eliza/google/calendar/reminder/event":
        expect(options?.method).toBe("GET");
        expect(Object.fromEntries(api.searchParams)).toEqual({ occurrenceId: reminderEvent.externalId, grantId: grant });
        return reply({ accountId: person.id, event: reminderEvent });
      case "/api/v1/eliza/google/calendar/reminder": {
        const input = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Struct({
          accountId: Schema.String, grantId: Schema.String, occurrenceId: Schema.String,
          version: Schema.String, minutes: Schema.Int,
        })))(options?.body);
        expect(input).toMatchObject({ accountId: person.id, grantId: grant, occurrenceId: "event-1", version: '"one"' });
        reminders.push(input.minutes);
        return reply({ ...input, status: input.minutes === 0 ? "cancelled" : "saved",
          fireAt: Date.parse(time) - input.minutes * 60_000 });
      }
      case "/api/v1/eliza/google/calendar/series":
        expect(api.searchParams.get("occurrenceId")).toBe(occurrence.externalId);
        expect(api.searchParams.get("grantId")).toBe(grant);
        return reply({ accountId: person.id, occurrenceId: occurrence.externalId, event: series });
      case "/api/v1/eliza/google/calendar/change": {
        const outbound = decodeChange(options?.body);
        expect(outbound).toMatchObject({ accountId: person.id, grantId: grant });
        if (!outbound.action) throw new Error("Missing calendar action");
        changed = [...changed, outbound.action];
        const itemId = outbound.id ?? outbound.operationId.replaceAll("-", "");
        if (outbound.seriesFor) {
          expect(itemId).toBe(series.externalId);
          expect(outbound.seriesFor).toBe(occurrence.externalId);
          expect(outbound.version).toBe(series.etag);
          if (outbound.action === "delete") events = events.filter((event) => event.seriesId !== series.externalId);
          else if (outbound.event) {
            series = { ...series, ...outbound.event, etag: '"series-two"' };
            events = events.map((event) => event.seriesId === series.externalId ? { ...event, title: series.title } : event);
          }
        } else if (outbound.action === "delete") events = events.filter((event) => event.externalId !== itemId);
        else if (outbound.event && outbound.action === "update") {
          expect(outbound.version).toBe('"one"');
          events = events.map((event) => event.externalId === itemId ? { ...event, ...outbound.event, etag: '"two"' } : event);
        } else if (outbound.event) {
          expect(outbound.event.repeat).toEqual({ frequency: "Weekly", timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
          events = [...events, { ...outbound.event, externalId: itemId, description: "", isAllDay: false, editable: true, seriesId: null, etag: '"new"' }];
        }
        return reply({ accountId: person.id, operationId: outbound.operationId, itemId });
      }
      case "/api/v1/eliza/google/calendar/feed":
        expect(api.searchParams.get("grantId")).toBe(grant);
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
  let view = tabletView(runtime);
  const tap = (name: string | RegExp) => act(() => userEvent.click(page.getByRole("button", { name, exact: true })));
  try {
    await view.render();
    await tap("Go to Account");
    await tap("Use email");
    await act(() => userEvent.type(page.getByRole("textbox", { name: "Email address" }), person.email));
    await tap("Send code");
    await act(() => userEvent.type(page.getByRole("textbox", { name: "Sign-in code" }), "123456"));
    await tap("Sign in");
    await expect.element(page.getByRole("button", { name: "Close Email" })).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Go to Account" })).not.toBeInTheDocument();
    expect(inboxRequests).toBe(0);

    connectorConfigured = true;
    await act(async () => {
      await runtime.runPromise(Effect.flatMap(AccountActions, (account) => account.run({ kind: "refresh" })));
    });
    await expect.element(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
    const homeUrl = new URL(window.location.href);
    homeUrl.hash = "";
    window.history.replaceState(undefined, "", homeUrl);
    await tap("Close Email");
    await tap(/^Email/);
    await expect.element(page.getByRole("heading", { name: "Inbox" })).toBeVisible();

    await tap(/Your receipt/);
    await expect.element(page.getByRole("alert")).toBeVisible();
    expect(page.getByText("Another person’s message").query()).toBeNull();
    replyFromOwner = true;
    await tap(/Your receipt/);
    await expect.element(page.getByText(literalText, { exact: true })).toBeVisible();
    const openOriginal = page.getByRole("button", { name: "Open original", exact: true });
    await expect.element(openOriginal.nth(1)).toBeDisabled();
    expect(attachmentReads).toBe(0);
    await act(() => openOriginal.nth(0).click());
    const original = page.getByRole("region", { name: "Original attachment" });
    await expect.element(page.getByText("Grace couldn’t open that. Try again.", { exact: true })).toBeVisible();
    expect(original.query()).toBeNull();
    attachmentOwner = person.id;
    await act(() => openOriginal.nth(0).click());
    await expect.element(original.getByText(originalText, { exact: true })).toBeVisible();
    const download = original.getByRole("link", { name: "Download original" });
    await expect.element(download).toHaveAttribute("download", attachment.name);
    const originalUrl = download.element().getAttribute("href") ?? "";
    expect(await fetch(originalUrl).then((response) => response.text())).toBe(originalText);
    await act(() => original.getByRole("button", { name: "Close attachment" }).click());
    expect(original.query()).toBeNull();
    await expect(fetch(originalUrl)).rejects.toThrow();
    expect(attachmentReads).toBe(2);
    const android = vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Android");
    try {
      await act(() => openOriginal.nth(2).click());
      await expect.element(original.getByRole("link", { name: "Save to Grace Files" })).toHaveAttribute("href", `https://app.graceforseniors.com/android/files/import#${ticket}`);
      const pdfUrl = original.getByRole("link", { name: "Open PDF" }).element().getAttribute("href") ?? "";
      expect(await fetch(pdfUrl).then((response) => response.text())).toBe(pdfBytes);
      await act(() => original.getByRole("button", { name: "Close attachment" }).click());
    } finally { android.mockRestore(); }
    await act(() => openOriginal.nth(2).click());
    filesScope = "8".repeat(64);
    await tap("Save to Files");
    const failedSave = page.getByText("Grace couldn’t save that to Files. Try again.", { exact: true });
    await expect.element(failedSave).toBeVisible();
    filesScope = filesOwner;
    await tap("Save to Files");
    await expect.element(original.getByRole("status")).toHaveTextContent("Saved to Files");
    await tap("Close attachment");
    await tap("Save all photos to Files");
    await expect.element(failedSave).toBeVisible();
    const storage = await runtime.runPromise(Effect.map(FileStorage, (files) => files.port));
    if (!storage) throw new Error("Browser Files is unavailable");
    const lease = Schema.decodeUnknownSync(FileLease)(await storage.open({ owner: filesOwner }));
    try {
      const catalog = Schema.decodeUnknownSync(FileCatalog)(await storage.list(lease));
      expect(catalog.entries.map((entry) => entry.name)).toEqual([pdf.name]);
    } finally { await storage.close(lease); }
    badPhoto = false;
    await tap("Save all photos to Files");
    await expect.element(page.getByText("3 photos saved to Files", { exact: true })).toBeVisible();
    expect(Array.from(document.querySelectorAll("strong")).some((node) => node.textContent === "This stays plain text.")).toBe(false);

    await tap("Reply");
    await act(() => userEvent.fill(page.getByRole("textbox", { name: "Message", exact: true }), "Thank you."));
    await tap("Review email");
    await expect.element(page.getByText("To robin@example.test")).toBeVisible();
    expect(sent).toEqual([]);
    await tap("Confirm and send");
    await expect.element(page.getByText("Gmail accepted your email.")).toBeVisible();
    expect(sent).toEqual(["reply"]);

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
    expect(sent).toEqual(["reply"]);
    await tap("Confirm and send");
    await tap("Check send status");
    await expect.element(page.getByText("Gmail accepted your email.")).toBeVisible();
    expect(sent).toEqual(["reply", "new"]);
    await tap("Close Email");
    await act(() => userEvent.click(page.getByRole("group", { name: "Calendar", exact: true }).getByRole("button", { name: /Dentist/ })));
    await expect.element(page.getByText("Bring your glasses.", { exact: true })).toBeVisible();
    expect(reminders).toEqual([]);
    await tap("One hour before");
    await expect.poll(() => reminders).toEqual([60]);
    await expect.element(page.getByText("Reminder choice saved. Your tablet schedules it when it reconnects.")).toBeVisible();
    await tap("Remove reminder");
    await expect.poll(() => reminders).toEqual([60, 0]);
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
    await act(() => userEvent.click(page.getByRole("radio", { name: "Every week" })));
    await tap("Review appointment");
    await expect.element(page.getByText("Every week · " + Intl.DateTimeFormat().resolvedOptions().timeZone)).toBeVisible();
    await tap("Confirm appointment");
    await expect.element(page.getByRole("button", { name: /Lunch/ })).toBeVisible();
    await tap(/Therapy/);
    await expect.element(page.getByRole("button", { name: "Change this occurrence" })).toBeVisible();
    await tap("Change entire series");
    await act(() => userEvent.fill(page.getByRole("textbox", { name: "Title" }), "Therapy sessions"));
    await tap("Review appointment");
    await expect.element(page.getByText("Entire series", { exact: true })).toBeVisible();
    await tap("Confirm appointment");
    await expect.element(page.getByText("Appointment saved.")).toBeVisible();
    await tap(/Therapy sessions/);
    await tap("Change entire series");
    await tap("Remove appointment");
    await expect.element(page.getByText("Entire series", { exact: true })).toBeVisible();
    await tap("Confirm removal");
    await expect.element(page.getByText("Appointment removed.")).toBeVisible();
    expect(changed).toEqual(["update", "delete", "create", "update", "delete"]);
    await tap("Close Calendar");
    await expect.element(page.getByText("Lunch", { exact: true })).toBeVisible();
    await expect.element(page.getByText("Your receipt", { exact: true })).toBeVisible();
    await tap("Settings");
    await act(() => page.getByRole("navigation", { name: "Settings" }).getByRole("button", { name: "Email & calendar" }).click());
    await expect.element(page.getByText(person.email, { exact: true })).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Manage connections in Grace account" })).toBeVisible();
    await expect.element(page.getByText("previous@example.test", { exact: true })).not.toBeInTheDocument();
    await tap("Close Settings");
    await tap("Page 2");
    await tap(/^Files/);
    await tap("Piano.png");
    await expect.element(page.getByRole("img", { name: "Piano.png" })).toHaveAttribute("src", "data:image/png;base64," + photos["Piano.png"]);
    await tap("Back to Files");
    await act(() => page.getByRole("radio", { name: "Documents" }).click());
    await tap("Open " + pdf.name);
    await expect.poll(() => document.querySelector("object[type='application/pdf']")?.getAttribute("data"))
      .toBe("data:application/pdf;base64," + btoa(pdfBytes) + "#page=1");

    await view.dispose();
    const noticeUrl = new URL(oldURL);
    noticeUrl.hash = "calendar";
    noticeUrl.searchParams.set("owner_hint", ownerHint);
    noticeUrl.searchParams.set("occurrence", reminderEvent.externalId);
    window.history.replaceState(undefined, "", noticeUrl);
    view = tabletView(ManagedRuntime.make(application(undefined)));
    await view.render();
    await expect.element(page.getByRole("heading", { name: reminderEvent.title, exact: true })).toBeVisible();
    await expect.element(page.getByText(reminderEvent.description, { exact: true })).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Back to calendar" })).toBeVisible();
    expect(new URL(window.location.href).searchParams.has("occurrence")).toBe(false);
  } finally {
    await view.dispose();
    provider.mockRestore();
    if (oldAccounts === null) localStorage.removeItem("accounts");
    else localStorage.setItem("accounts", oldAccounts);
    if (oldIntent === null) sessionStorage.removeItem("grace-hosted-read");
    else sessionStorage.setItem("grace-hosted-read", oldIntent);
    window.history.replaceState(undefined, "", oldURL);
  }
}, 120_000);

it('Read back brightness and mute (spec/app/preferences.md, "Night dimming and sound samples use the current preference without rewriting it")', async () => {
  const audio = { step: 0, min: 0, max: 15, muted: false };
  let brightness = 20;
  let denyBrightness = false;
  const readback: { brightness: number; muted: boolean; step: number }[] = [];
  const runtime = ManagedRuntime.make(application(undefined, undefined, {
    native: true,
    display: {
      getDevice: () => {
        readback.push({ brightness, muted: audio.muted, step: audio.step });
        return Promise.resolve({ volume: { ...audio }, brightness: { percent: brightness } });
      },
      setBrightness: ({ percent }) => { if (!denyBrightness) brightness = percent; return Promise.resolve(); },
      setVolume: ({ step, muted }) => { Object.assign(audio, { step, muted }); return Promise.resolve(); },
    },
  }));
  const tap = (name: string) => act(() => userEvent.click(page.getByRole("button", { name, exact: true })));
  await mount(runtime);
  await expect.poll(() => readback.at(-1)).toEqual({ brightness: 100, muted: false, step: 9 });
  await tap("Volume");
  await tap("Mute");
  await expect.poll(() => readback.at(-1)).toEqual({ brightness: 100, muted: true, step: 9 });
  await tap("Unmute");
  await expect.poll(() => readback.at(-1)).toEqual({ brightness: 100, muted: false, step: 9 });
  await tap("Volume");
  await tap("Settings");
  await tap("Brightness");
  await tap("Dimmer");
  await expect.poll(() => readback.at(-1)?.brightness).toBeLessThan(100);
  const applied = brightness;
  denyBrightness = true;
  await tap("Dimmer");
  await expect.element(page.getByText("The tablet couldn’t apply that setting.")).toBeVisible();
  expect(brightness).toBe(applied);
  denyBrightness = false;
  await tap("Close Settings");
  await tap("Volume");
  await tap("Mute");
  await expect.poll(() => readback.at(-1)?.muted).toBe(true);
  expect(brightness).toBeLessThan(applied);
});

it('Restore saved text size (spec/app/preferences.md, "Restart restores confirmed preferences and invalidates pending acknowledgements")', async () => {
  let stored: { revision: number; value?: string } = { revision: 0 };
  let rejectNextWrite = true;
  const options = {
    native: true,
    preferences: {
      read: () => Promise.resolve(stored),
      write: ({ revision, value }: { revision: number; value: string }) => {
        expect(revision).toBe(stored.revision);
        if (rejectNextWrite) {
          rejectNextWrite = false;
          return Promise.reject(new Error("Device storage unavailable"));
        }
        stored = { revision: revision + 1, value };
        return Promise.resolve({ revision: stored.revision });
      },
    },
  };
  const host = document.body.appendChild(document.createElement("div"));
  let runtime = ManagedRuntime.make(application(undefined, undefined, options));
  let root = createRoot(host);
  onTestFinished(async () => {
    await act(() => Promise.resolve(root.unmount()));
    await runtime.dispose();
    host.remove();
  });
  const mountSettings = async () => {
    await act(() => Promise.resolve(root.render(<App runtime={runtime} />)));
    await act(() => userEvent.click(page.getByRole("button", { name: "Settings", exact: true })));
  };
  const larger = page.getByRole("radio", { name: "Larger", exact: true });
  await mountSettings();
  await act(() => userEvent.click(larger));
  await expect.element(larger).toHaveAttribute("aria-checked", "true");
  await expect.element(page.getByRole("button", { name: "Try again", exact: true })).toBeVisible();
  expect(stored.revision).toBe(0);
  await act(() => userEvent.click(page.getByRole("button", { name: "Try again", exact: true })));
  await expect.poll(() => stored.revision).toBe(1);
  await act(() => Promise.resolve(root.unmount()));
  await runtime.dispose();
  root = createRoot(host);
  runtime = ManagedRuntime.make(application(undefined, undefined, options));
  await mountSettings();
  await expect.element(larger).toHaveAttribute("aria-checked", "true");
  expect(stored.revision).toBe(1);
});

it('Remove the chosen saved photo (spec/app/files.md, "Story: Save, share and remove the chosen file")', async () => {
  const lease = "6809777f-9d01-4857-8b5f-5ed6d7376f62";
  const photo = { id: "5860d0a8-b810-4c0e-ad5f-efeaf0d19f7f", kind: "photo", name: "Garden.jpg", savedAt: 3, pages: 0 };
  const attachment = { id: "85b46188-fb54-4a7e-a7b8-1f706e7a3b86", kind: "pdf", name: "Original.pdf", savedAt: 4, pages: 2,
    attachmentSource: "a".repeat(64), attachmentSha256: "b".repeat(64) };
  const request = "1be3319a-dcea-4235-8c56-69632ebc222d";
  let incoming: string | undefined;
  let notify: () => void = () => undefined;
  let entries: (typeof photo | typeof attachment)[] = [photo];
  const transfers: string[] = [];
  const removals: string[] = [];
  const runtime = ManagedRuntime.make(application(undefined, undefined, {
    native: true,
    files: {
      saveAttachments: () => Promise.reject(new Error("No mail attachments in this journey")),
      open: () => Promise.resolve({ lease }),
      close: () => Promise.resolve(),
      list: () => Promise.resolve({ entries }),
      preview: ({ id, page }) => Promise.resolve({ id, page, image: "data:image/jpeg;base64,/9j/2Q==" }),
      pick: () => Promise.resolve(),
      capture: () => Promise.resolve(),
      addListener: (_event, listener) => {
        notify = listener;
        return Promise.resolve({ remove: () => { notify = () => undefined; return Promise.resolve(); } });
      },
      attachmentImport: () => Promise.resolve({ id: incoming }),
      cancelAttachmentImport: (input) => {
        expect(input.request).toBe(incoming);
        incoming = undefined;
        return Promise.resolve();
      },
      stageAttachmentImport: (input) => {
        expect(input).toEqual({ lease, request: incoming });
        transfers.push(input.request);
        return Promise.resolve(attachment);
      },
      commit: (input) => {
        expect(input).toEqual({ lease, id: attachment.id });
        if (transfers.length === 1) return Promise.reject(new Error("Device storage unavailable"));
        if (!entries.includes(attachment)) entries.unshift(attachment);
        incoming = undefined;
        return Promise.resolve({ id: attachment.id });
      },
      remove: (request) => {
        expect(request).toEqual({ lease, id: photo.id });
        removals.push(request.id);
        if (removals.length === 1) return Promise.reject(new Error("Device storage unavailable"));
        entries = [];
        return Promise.resolve();
      },
    },
  }));
  await mount(runtime);
  await signInToGrace(runtime);
  await act(() => runtime.runPromise(Effect.flatMap(Workspaces, (workspace) =>
    workspace.send({ type: "chooseHomePage", page: "FilesCard" }, "Person"))));
  const tap = (name: string) => act(() => userEvent.click(page.getByRole("button", { name, exact: true })));
  await tap("Files");
  await tap("Garden.jpg");
  await tap("Delete");
  await tap("Cancel");
  expect(removals).toEqual([]);
  await tap("Delete");
  await tap("Delete photo");
  await expect.element(page.getByRole("img", { name: photo.name })).toBeVisible();
  await tap("Try again");
  await tap("Delete photo");
  await expect.poll(() => removals).toEqual([photo.id, photo.id]);
  await expect.element(page.getByRole("button", { name: "Import photo" })).toBeVisible();
  expect(page.getByRole("button", { name: photo.name }).query()).toBeNull();

  const handoff = () => act(() => { incoming = request; notify(); });
  await tap("Close Files");
  handoff();
  await tap("Cancel");
  expect(transfers).toEqual([]);
  handoff();
  await tap("Save attachment");
  await expect.element(page.getByRole("status").filter({ hasText: "The attachment couldn’t be saved." })).toBeVisible();
  expect(entries).toEqual([]);
  await tap("Save attachment");
  await expect.element(page.getByRole("button", { name: "Import photo" })).toBeVisible();
  handoff();
  await tap("Save attachment");
  await expect.element(page.getByRole("button", { name: "Import photo" })).toBeVisible();
  expect(entries).toEqual([attachment]);
  expect(transfers).toEqual([request, request, request]);
});

it('Use a standalone vault and private typed guidance (spec/app/index.md, "Story: Manage my saved passwords privately")', async () => {
  let lockRequests = 0;
  let needsMigration = true;
  let saved = { id: "first-login", revision: 4, updatedAt: 1, label: "Utility account", username: "Pat", bindings: [] };
  let shown = false;
  const vault: PasswordVault = {
    status: () => Promise.resolve(needsMigration
      ? { ...foregroundVault, locked: true, reason: "legacy-authorization-required" }
      : foregroundVault),
    lock: () => { lockRequests += 1; return Promise.resolve(); },
    unlock: async () => {
      if (!needsMigration) throw new Error("The existing sign-in was already migrated");
      needsMigration = false;
      return { unlockRemainingMs: null };
    },
    list: () => Promise.resolve([saved]),
    openEditor: (input) => {
      expect(input).toEqual({ entryId: "first-login", expectedRevision: 4 });
      saved = { ...saved, username: "New account", revision: 5 };
      return Promise.resolve({ status: "saved", id: "first-login", revision: 5 });
    },
    remove: () => Promise.resolve(),
    reveal: () => { shown = true; return Promise.resolve({ hidesAfterMs: 30_000 }); },
    copy: (_id, revision) => {
      if (revision === undefined) return Promise.reject(new PasswordsClientError("unavailable", "No displayed revision"));
      return revision === saved.revision
        ? Promise.resolve({ clearsAfterMs: 45_000 })
        : Promise.reject(new PasswordsClientError("conflict", "The record changed"));
    },
    openAutofillSettings: () => Promise.resolve({ destination: "autofill-picker" }),
  };
  const runtime = ManagedRuntime.make(application(undefined, undefined, { native: false, vault }));
  await mount(runtime);
  await askForPasswords();
  const migrate = page.getByRole("button", { name: "Open saved passwords" });
  await expect.element(migrate).toBeEnabled();
  await expect.element(page.getByRole("button", { name: /Utility account/ })).not.toBeInTheDocument();
  await act(() => userEvent.click(migrate));
  await act(() => userEvent.click(page.getByRole("button", { name: /Utility account/ })));
  await revealAndEditPassword(() => shown);
  saved = { ...saved, username: "Updated on this tablet", revision: 6 };
  await act(() => userEvent.click(page.getByRole("button", { name: "Copy password" })));
  await expect.element(page.getByText("Updated on this tablet", { exact: true })).toBeVisible();
  const locksBeforeClose = lockRequests;
  await act(() => userEvent.click(page.getByRole("button", { name: "Close Passwords" })));
  await expect.poll(() => lockRequests).toBeGreaterThan(locksBeforeClose);
  await expect.element(page.getByText("Updated on this tablet", { exact: true })).not.toBeInTheDocument();
  const filesPage = page.getByRole("button", { name: "Page 2", exact: true });
  await expect.element(filesPage).toBeVisible();
  const swipe = (direction: "left" | "right") => act(async () => {
    const session = cdp();
    const cards = filesPage.element().parentElement!.getBoundingClientRect();
    const [from, to] = direction === "left" ? [0.85, 0.2] : [0.2, 0.85];
    const point = (across: number) => [{ x: cards.left + cards.width * across, y: innerHeight * 0.4 }];
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(from) });
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: point(to) });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  });
  await swipe("left");
  await expect.element(filesPage).toHaveAttribute("aria-current", "true");
  await swipe("left");
  await expect.element(page.getByRole("button", { name: "Page 3", exact: true })).toHaveAttribute("aria-current", "true");
  await swipe("right");
  await expect.element(filesPage).toHaveAttribute("aria-current", "true");
  await act(() => userEvent.click(page.getByRole("button", { name: "More apps" })));
  await act(() => userEvent.click(page.getByRole("button", { name: "Passwords", exact: true })));
  await expect.element(page.getByRole("button", { name: "Add password" })).toBeEnabled();
  await act(() => userEvent.click(page.getByRole("button", { name: "Close Passwords" })));
  await act(() => userEvent.click(page.getByRole("button", { name: "Ask Grace" })));
  const draft = page.getByRole("textbox", { name: "Message to Grace" });
  await act(() => userEvent.type(draft, "Open passwords"));
  await act(() => userEvent.click(page.getByRole("button", { name: "Send", exact: true })));
  await expect.element(page.getByRole("button", { name: "Add password" })).toBeEnabled();
});

it('Use private sign-in in the standalone browser (spec/app/browser.md, "Story: Sign in privately on a website")', async () => {
  const native = fakePlugin();
  await signInPrivately(native, async (field, text) => {
    await act(() => userEvent.clear(field));
    await act(() => userEvent.type(field, text));
  });
});

const passwordBackupApproval = {
  clientId: "technology.graceful.grace", environment: "staging", purpose: "save",
  redirectUri: "https://app.graceforseniors.com/android/auth/callback", state: "s".repeat(43),
  codeChallenge: "c".repeat(43), codeChallengeMethod: "S256",
} as const;

function approvedBackupReturn() {
  const returned = new URL(passwordBackupApproval.redirectUri);
  returned.searchParams.set("code", "pbackup_" + "k".repeat(43));
  returned.searchParams.set("state", passwordBackupApproval.state);
  return returned;
}

it('Keep a cancelled tablet sign-in closed on return (spec/app/setup.md, "Story: Sign in to Grace and manage my subscription")', async () => {
  const original = location.href;
  const pending = sessionStorage.getItem("grace-device-sign-in");
  const destination = new URL(original);
  destination.searchParams.set("device_challenge", "a".repeat(43));
  destination.searchParams.set("device_state", "b".repeat(43));
  destination.hash = "account";
  history.replaceState(null, "", destination);
  const first = ManagedRuntime.make(application(undefined));
  const reopened = ManagedRuntime.make(application(undefined));
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  const network = window.fetch.bind(window);
  const service = vi.spyOn(window, "fetch").mockImplementation((input, init) => {
    if (typeof input === "string" && new URL(input, location.href).pathname === "/api/auth/session") {
      return Promise.resolve(Response.json({ account: { id: "tablet-owner", email: "tablet-owner@example.test" } }));
    }
    return network(input, init);
  });
  onTestFinished(async () => {
    await act(() => Promise.resolve(root.unmount()));
    await Promise.all([first.dispose(), reopened.dispose()]);
    service.mockRestore();
    host.remove();
    history.replaceState(null, "", original);
    if (pending === null) sessionStorage.removeItem("grace-device-sign-in");
    else sessionStorage.setItem("grace-device-sign-in", pending);
  });

  await act(() => Promise.resolve(root.render(<App key="first" runtime={first} />)));
  const cancel = page.getByRole("button", { name: "Cancel tablet sign-in" });
  await expect.element(cancel).toBeVisible();
  await act(() => userEvent.click(cancel));
  await expect.element(cancel).not.toBeInTheDocument();
  await act(() => Promise.resolve(root.render(<App key="reopened" runtime={reopened} />)));
  await expect.element(page.getByText("tablet-owner@example.test", { exact: true })).toBeVisible();
  await expect.element(cancel).not.toBeInTheDocument();
});

it('Approve the shown account before returning to the tablet (spec/app/setup.md, "Story: Approve a password backup in my browser")', async () => {
  const element = document.createElement("div");
  document.body.append(element);
  const root = createRoot(element);
  const approval = passwordBackupApproval;
  const returned = approvedBackupReturn();
  const requests: unknown[] = [];
  const network = window.fetch.bind(window);
  const fetch = vi.spyOn(window, "fetch").mockImplementation(async (input, init) => {
    if (typeof input !== "string" || !input.endsWith("/api/v1/app-auth/mobile/password-backup")) return network(input, init);
    requests.push(await new Response(init?.body).json());
    return Response.json({ redirectUrl: returned.href });
  });
  onTestFinished(async () => {
    fetch.mockRestore();
    await act(() => Promise.resolve(root.unmount()));
    element.remove();
  });
  await act(() => Promise.resolve(root.render(<PasswordBackupConsent approval={approval} account={{ id: "owner", email: "owner@example.test" }} />)));
  expect(requests).toEqual([]);
  await act(async () => { await page.getByRole("button", { name: "Approve" }).click(); });
  await expect.element(page.getByRole("link", { name: "Return to Grace" })).toHaveAttribute("href", returned.href);
  expect(requests).toEqual([{ approval, expectedOwnerId: "owner" }]);
});

it('Refresh an email-only sign-in before approving a password backup (spec/app/setup.md, "Story: Approve a password backup in my browser")', async () => {
  const element = document.createElement("div");
  document.body.append(element);
  const root = createRoot(element);
  const approval = passwordBackupApproval;
  const calls: string[] = [];
  const network = window.fetch.bind(window);
  const returned = approvedBackupReturn();
  let approves = 0;
  const mock = vi.spyOn(window, "fetch").mockImplementation(async (input, init) => {
    if (typeof input !== "string") return network(input, init);
    const pathname = new URL(input, window.location.href).pathname;
    if (pathname.startsWith("/api/auth/email/")) {
      calls.push(pathname);
      return Response.json({});
    }
    if (pathname === "/api/auth/session") return Response.json({ account: { id: "owner", email: "owner@example.test" } });
    if (pathname !== "/api/v1/app-auth/mobile/password-backup") return network(input, init);
    calls.push(pathname);
    if (++approves === 1) return new Response(null, { status: 401 });
    expect(await new Response(init?.body).json()).toEqual({ approval, expectedOwnerId: "owner" });
    return Response.json({ redirectUrl: returned.href });
  });
  onTestFinished(async () => {
    mock.mockRestore();
    await act(() => Promise.resolve(root.unmount()));
    element.remove();
  });
  await act(() => Promise.resolve(root.render(<PasswordBackupConsent approval={approval} account={{ id: "owner", email: "owner@example.test" }}
    providers={{ google: false, email: true, sms: false }} />)));
  await act(async () => { await page.getByRole("button", { name: "Approve" }).click(); });
  await act(async () => { await page.getByRole("button", { name: "Use email" }).click(); });
  await act(async () => { await page.getByLabelText("Email address").fill("owner@example.test"); });
  await act(async () => { await page.getByRole("button", { name: "Send code" }).click(); });
  await act(async () => { await page.getByLabelText("Sign-in code").fill("123456"); });
  await act(async () => { await page.getByRole("button", { name: "Sign in", exact: true }).click(); });
  expect(approves).toBe(1);
  await act(async () => { await page.getByRole("button", { name: "Approve" }).click(); });
  await expect.element(page.getByRole("link", { name: "Return to Grace" })).toHaveAttribute("href", returned.href);
  expect(calls).toEqual([
    "/api/v1/app-auth/mobile/password-backup", "/api/auth/email/send", "/api/auth/email/verify", "/api/v1/app-auth/mobile/password-backup",
  ]);
});

it("Talk or type without losing the conversation", async () => {
  const cloud = inject("cloud");
  const { secret } = await Effect.runPromise(Effect.provide(signIn(cloud), client));
  const runtime = ManagedRuntime.make(application(fakePlugin().plugin, undefined, { url: cloud, key: secret }));
  await mount(runtime);
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
  const home = { id: "example-home", path: "/", title: "Example", heading: "Example", text: "Example\nHelp center" };
  const about = { id: "example-about", path: "/about", title: target, heading: "About Example", text: "About Example\nHelp center\nOur team" };
  const help = { id: "example-help", path: "/help", title: target + " | Example", heading: target, text: "Help center\nFind answers to frequently asked questions." };
  let currentPage = home;
  let domRevision = 1;
  let reviseDuringRead = false;
  let replaceDocumentDuringRead = false;
  const native = fakePlugin(({ command }) => {
    if (typeof command === "object" && command !== null && "subaction" in command && command.subaction === "snapshot") {
      return { documentId: currentPage.id, frameScope: "main", result: {
        snapshotId: currentPage.id, domRevision, url: origin + currentPage.path, title: currentPage.title, text: currentPage.text,
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
  }, false, () => {
    if (reviseDuringRead) domRevision++;
    if (replaceDocumentDuringRead) {
      currentPage = { ...currentPage, id: currentPage.id + "-new-document" };
      replaceDocumentDuringRead = false;
    }
    return { url: origin + currentPage.path, title: currentPage.title, text: currentPage.heading, truncated: false };
  });
  let guideOwner: string | null = null;
  let guideCalls = 0;
  let replaceGuideOwner = true;
  const browserFetch = window.fetch.bind(window);
  const accountNetwork = vi.spyOn(window, "fetch").mockImplementation((input, init) => {
    const url = new URL(input instanceof Request ? input.url : input, window.location.origin);
    if (url.origin !== window.location.origin) return browserFetch(input, init);
    switch (url.pathname) {
      case "/api/auth/session": return Promise.resolve(Response.json({ account: guideOwner === null ? null : { id: guideOwner, email: "owner@grace.test" } }));
      case "/api/auth/refresh": return Promise.resolve(new Response(null, { status: 401 }));
      case "/api/auth/providers": return Promise.resolve(Response.json({ email: true, google: false, sms: false }));
      case "/api/v1/billing/subscription": return Promise.resolve(Response.json({ status: "inactive", canManage: false, canCheckout: false }));
      case "/api/v1/decisions": {
        guideCalls++;
        expect(init?.credentials).toBe("include");
        const headers = new Headers(init?.headers);
        expect(headers.has("Authorization")).toBe(false);
        expect(headers.get("X-Eliza-Account")).toBe(guideOwner);
        return browserFetch(new URL(url.pathname, cloud), { ...init, credentials: "omit",
          headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" } }).then((response) => {
          if (replaceGuideOwner) {
            guideOwner = "another-owner";
            replaceGuideOwner = false;
          }
          return response;
        });
      }
      default: return browserFetch(input, init);
    }
  });
  const { routeTo, tap, dispose } = await cloudReadPlan(native, cloud, secret);

  try {
    await act(() => userEvent.click(page.getByRole("button", { name: "Internet" })));
    await native.route();
    await visitExampleSite(native);

    await tap(page.getByRole("button", { name: "Ask Grace" }));
    const field = page.getByRole("textbox", { name: "Message to Grace" });
    await routeTo(field);
    await act(() => field.fill(ask));
    await act(() => userEvent.keyboard("{Enter}"));
    await routeTo(page.getByRole("list", { name: "Read plan" }).getByText(target, { exact: true }));
    await expect.element(page.getByRole("region", { name: "Review read plan" }).getByText(ask, { exact: true })).toBeVisible();
    await tap(page.getByRole("button", { name: "Collapse", exact: true }));
    await expect.poll(async () => { await native.route(); return native.calls("presentSurface").at(-1)?.id; }).toBe("tab-1");
    const check = page.getByRole("button", { name: "Check page" });
    const plan = page.getByRole("region", { name: "Task plan" });
    const pending = plan.getByRole("paragraph");
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
    await expect.element(pending).toHaveAttribute("aria-current", "step");

    const resume = page.getByRole("button", { name: "Resume Grace" });
    currentPage = about;
    await native.report("tab-1", origin + about.path, 100);
    await tap(resume);
    await tap(check);
    const result = page.getByRole("status", { name: "Page check result" });
    await expect.poll(() => result.query()?.textContent).toContain(target);
    await expect.element(pending).toHaveAttribute("aria-current", "step");
    expect(plan.getByText(/^Open page:/).query()).toBeNull();
    expect(plan.getByText("Read checks complete").query()).toBeNull();
    await routeTo(check);

    await tap(showLink);
    await routeTo(page.getByText("Sign in to Grace to get help choosing a link."));
    expect(guideCalls).toBe(0);
    guideOwner = "guide-owner";
    await tap(showLink);
    await routeTo(page.getByText("The page or task changed. Ask me again on the page you want."));
    const shownGuide = Schema.Struct({ command: Schema.Struct({ subaction: Schema.Literal("guide"), guidance: Schema.Struct({ kind: Schema.Literal("show") }) }) });
    expect(native.calls("controlPage").some(Schema.is(shownGuide))).toBe(false);
    guideOwner = "guide-owner";
    await tap(showLink);
    await routeTo(page.getByText("Look for “Help center” on example.org."));
    expect(native.calls("controlPage").at(-1)).toMatchObject({ documentId: about.id, command: {
      subaction: "guide", guidance: { kind: "show", nodeId: "help" },
    } });
    await expect.element(pending).toHaveAttribute("aria-current", "step");

    currentPage = help;
    await native.report("tab-1", origin + help.path, 100);
    await native.route();
    await routeTo(resume);
    expect(check.query()).toBeNull();
    await tap(resume);
    replaceDocumentDuringRead = true;
    await tap(check);
    await expect.poll(() => result.query()?.textContent).toContain(target);
    await expect.element(pending).toHaveAttribute("aria-current", "step");
    reviseDuringRead = true;
    await tap(check);
    await expect.element(page.getByRole("region", { name: "Task plan" }).getByText(/^Open the email you want me to read/)).toBeVisible();
    expect(result.query()).toBeNull();
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
    await routeTo(page.getByRole("button", { name: "Expand", exact: true }));
    await tap(resume);
    await tap(checkEmail);
    await expect.element(page.getByRole("region", { name: "Task plan" }).getByText(/^Open the saved appointment/)).toBeVisible();

    await tap(page.getByRole("button", { name: "Home", exact: true }));
    const appointment = page.getByRole("group", { name: "Calendar", exact: true }).getByText("Eye check with Dr. Patel");
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
    await dispose();
    accountNetwork.mockRestore();
    localStorage.clear();
  }
});

it('Use signed-in selections in a reviewed plan (spec/app/workspace.md, "Story: Follow one reviewed plan across apps")', async () => {
  // spec/app/setup.md, "Story: Read the Google mail and calendar I connected"
  const cloud = inject("cloud");
  const { secret } = await Effect.runPromise(Effect.provide(signIn(cloud), client));
  const ask = "Check my two open emails and one calendar appointment.";
  const save = "Read this email and save its appointment.";
  const browserAsk = "Check the website I have open.";
  const newAppointment = "Check the open appointment on this account.";
  await Effect.runPromise(Effect.provide(script(cloud, secret, [
    { said: ask, context: {
      includes: ["Selected email subject: Managed appointment details"],
      excludes: ["appointment with Dr. Patel", "Main St Clinic", "Eye check with Dr. Patel"],
    }, answer: JSON.stringify({ text: "Review the plan.", isQuestion: false, answers: [],
      actions: [{ kind: "proposeReadPlan", steps: ["ReadMail", "ReadMail", "ReadCalendar"] }] }) },
    { said: newAppointment, context: { includes: ["Selected calendar appointment: Account B appointment"], excludes: ["Managed appointment details"] },
      answer: JSON.stringify({ text: "Review the plan.", isQuestion: false, answers: [], actions: [{ kind: "proposeReadPlan", steps: ["ReadCalendar"] }] }) },
    { said: browserAsk, answer: JSON.stringify({ text: "Review the plan.", isQuestion: false, answers: [],
      actions: [{ kind: "proposeReadPlan", steps: ["ReadBrowser"] }] }) },
    { said: save, answer: JSON.stringify({ text: "Review the plan.", isQuestion: false, answers: [],
      actions: [{ kind: "proposeReadPlan", steps: ["ReadMail", "SaveMailAppointment"] }] }) },
  ]), client));

  const firstOwner = { id: "managed-plan-owner", email: "managed-a@grace.test" };
  const secondOwner = { id: "managed-plan-owner-b", email: "managed-b@grace.test" };
  let person = firstOwner;
  let browserCookieOwner: typeof firstOwner | undefined;
  let ownerProbes = 0;
  let hostedChoices = 0;
  const when = Date.now();
  const receivedAt = new Date(when).toISOString();
  const selected = { externalId: "mail-one", from: "Riverview Clinic", subject: "Managed appointment details", receivedAt,
    isUnread: true, metadata: { historyId: "one" } };
  const second = { ...selected, externalId: "mail-two", from: "Eastwood Clinic" };
  const appointment = { externalId: "event-one", title: "Managed calendar appointment", description: "", location: "Riverview",
    startAt: new Date(when + 3_600_000).toISOString(), endAt: new Date(when + 7_200_000).toISOString(), isAllDay: false, etag: "one" };
  const otherAppointment = { ...appointment, externalId: "event-b", title: "Account B appointment" };
  const chosen = chooseProvider(initialAccounts, "Gmail", "AccountPerson");
  const legacy = sheetResult(chosen, { attempt: chosen.signIn.attempt, outcome: "Allowed", address: "owner@grace.test", granted: allowedUse }, "Gmail", "AccountConnector");
  localStorage.clear();
  localStorage.setItem("accounts", JSON.stringify(legacy));

  let signedIn = false;
  let grant = "58b549ef-4b49-4210-a3d1-ec31369a9f06";
  let connected = true;
  let historyId = "one";
  const fetch = window.fetch.bind(window);
  const provider = vi.spyOn(window, "fetch").mockImplementation((input, options) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url, window.location.href);
    if (url.origin === new URL(cloud).origin) return fetch(input, options);
    const respond = (body: unknown, status = 200) => Promise.resolve(Response.json(body, { status }));
    switch (url.pathname) {
      case "/api/auth/session":
        if (browserCookieOwner) ownerProbes++;
        return respond({ account: signedIn ? browserCookieOwner ?? person : null });
      case "/api/v1/decisions":
        hostedChoices++;
        expect(new Headers(options?.headers).get("X-Eliza-Account")).toBe(secondOwner.id);
        return respond({ kind: "choice", status: "ok", choice: "1", model: "clef-flash", confidence: 0.91,
          probabilities: { "1": 0.91, none: 0.09 } });
      case "/api/auth/refresh": return respond({}, 401);
      case "/api/auth/providers": return respond({ google: false, email: true, sms: false });
      case "/api/v1/billing/subscription": return respond({ status: "inactive", canManage: false, canCheckout: true });
      case "/api/v1/eliza/google/status": return respond({
        accountId: person.id, provider: "google", side: "owner", mode: "cloud_managed", configured: connected, connected,
        identity: connected ? { email: person.email } : null, connectionId: connected ? grant : null,
        grantedCapabilities: connected ? ["google.gmail.triage", "google.calendar.read"] : [],
      });
      case "/api/v1/eliza/google/gmail/triage":
        expect(url.searchParams.get("grantId")).toBe(grant);
        return respond({ accountId: person.id, messages: [selected, second], nextPageToken: null });
      case "/api/v1/eliza/google/gmail/read": {
        expect(url.searchParams.get("grantId")).toBe(grant);
        const row = url.searchParams.get("messageId") === second.externalId ? second : selected;
        return respond({ accountId: person.id, message: { ...row, metadata: { historyId } }, historyId: null, attachments: [],
          bodyText: row.from + " message body", bodyTextAvailable: true });
      }
      case "/api/v1/eliza/google/calendar/feed":
        expect(url.searchParams.get("grantId")).toBe(grant);
        return respond({ accountId: person.id, events: [person === firstOwner ? appointment : otherAppointment], nextPageToken: null });
      default: return fetch(input, options);
    }
  });
  const browserUrl = "https://example.org/";
  const native = fakePlugin(({ command }) => {
    if (typeof command === "object" && command !== null && "subaction" in command && command.subaction === "snapshot") {
      return { documentId: "owner-guide-page", frameScope: "main", result: {
        snapshotId: "owner-guide-page", domRevision: 1, url: browserUrl, title: "Example",
        text: "Example Help center", complete: true, readyState: "complete", blockers: [],
        viewport: { width: 800, height: 600, offsetLeft: 0, offsetTop: 0, scale: 1 },
        elements: [{ id: "help", tag: "a", label: "Help center", href: browserUrl + "help", inViewport: true,
          bounds: { x: 100, y: 80, width: 100, height: 32 } }],
      } };
    }
    return { result: { accepted: true } };
  });
  const runtime = ManagedRuntime.make(application(native.plugin, undefined, { url: cloud, key: secret }));
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  const button = (name: string | RegExp) => page.getByRole("button", { name, exact: true });
  const { routeTo, tap } = routedControls(native);
  const send = async (message: string) => {
    const text = page.getByRole("textbox", { name: "Message to Grace" });
    await routeTo(text);
    await act(() => text.fill(message));
    await act(() => userEvent.keyboard("{Enter}"));
  };
  const refresh = () => act(async () => {
    await runtime.runPromise(Effect.flatMap(AccountActions, (account) => account.run({ kind: "refresh" })));
  });
  const check = async () => {
    const result = runtime.runPromise(Effect.flatMap(Conversation, (conversation) => conversation.checkGuidedRead()));
    await act(() => result.then(() => undefined));
    return result;
  };
  const receipts = () => runtime.runPromise(Effect.flatMap(Workspaces, (desk) => Effect.map(desk.get(), (w) => w.plan.receipts.map(({ evidence }) => evidence))));

  try {
    await act(() => Promise.resolve(root.render(<App runtime={runtime} />)));
    await tap(button(/^Email/));
    await tap(button(/Main St Clinic/));
    await routeTo(page.getByText(/appointment with Dr\. Patel/));
    signedIn = true;
    await refresh();
    await routeTo(page.getByRole("heading", { name: "Inbox", exact: true }));
    await tap(button(/Riverview Clinic/));
    await routeTo(page.getByText("Riverview Clinic message body"));
    await tap(button("Ask Grace"));
    await send(ask);
    const review = page.getByRole("region", { name: "Review read plan" });
    await routeTo(review);
    const revision = await runtime.runPromise(Effect.flatMap(Workspaces, (desk) => Effect.map(desk.get(), (w) => w.review.revision)));
    person = secondOwner;
    await refresh();
    expect(review.query()).toBeNull();
    const staleStart = runtime.runPromise(Effect.flatMap(Conversation, (conversation) => conversation.startReadReview(revision)));
    await act(() => staleStart.then(() => undefined));
    expect(await staleStart).toBe(false);
    person = firstOwner;
    await refresh();
    await routeTo(review);
    await tap(button("Collapse"));
    await tap(button("Start read plan"));

    await routeTo(page.getByRole("heading", { name: "Inbox", exact: true }));
    expect(await check()).toBe(false);
    expect(await receipts()).toEqual([]);

    await tap(button(/Riverview Clinic/));
    await routeTo(page.getByText("Riverview Clinic message body"));
    await tap(button("Check email"));
    const mailReceipt = "Open message: " + selected.subject;
    await expect.poll(receipts).toEqual([mailReceipt]);

    connected = false;
    await refresh();
    await routeTo(page.getByText("Google mail isn’t available right now", { exact: true }));
    expect(await check()).toBe(false);
    expect(await receipts()).toEqual([mailReceipt]);
    grant = "a356abb1-f5a0-4d82-8b9b-69e4235a4990";
    historyId = "two";
    connected = true;
    await refresh();
    await tap(button(/Riverview Clinic/));
    await routeTo(page.getByText("Riverview Clinic message body"));
    expect(await check()).toBe(false);
    expect(await receipts()).toEqual([mailReceipt]);

    await tap(button("Back to Inbox"));
    await tap(button(/Eastwood Clinic/));
    await routeTo(page.getByText("Eastwood Clinic message body"));
    await tap(button("Check email"));
    await expect.poll(receipts).toEqual([mailReceipt, mailReceipt]);
    await tap(button("Close Email"));
    await tap(button(/^Calendar/));
    await tap(button(/Managed calendar appointment/));
    await routeTo(page.getByRole("heading", { name: appointment.title, exact: true }));

    person = secondOwner;
    grant = "52c1abb1-6d1d-4ee4-8bd9-70e42a5d4458";
    await refresh();
    await tap(button(/Account B appointment/));
    await routeTo(page.getByRole("heading", { name: otherAppointment.title, exact: true }));
    const resumed = runtime.runPromise(Effect.flatMap(Conversation, (conversation) => conversation.resumeReadPlan()));
    await act(() => resumed.then(() => undefined));
    expect(await resumed).toBe(false);
    expect(await check()).toBe(false);
    expect(await receipts()).toEqual([mailReceipt, mailReceipt]);
    expect(page.getByRole("region", { name: "Task plan" }).query()).toBeNull();
    await tap(button("End previous task"));

    await send(newAppointment);
    await routeTo(page.getByRole("region", { name: "Review read plan" }));
    await tap(button("Start read plan"));
    await tap(button("Check appointment"));
    await routeTo(page.getByText("Read checks complete", { exact: true }));
    expect(await receipts()).toEqual([expect.stringMatching(/^Account B appointment · /)]);

    await send(save);
    await routeTo(page.getByText("I can check your mail and calendar, but I can’t save an appointment from that plan.", { exact: true }));
    expect(page.getByRole("region", { name: "Review read plan" }).query()).toBeNull();

    await tap(button("Close Calendar"));
    await tap(button("Internet"));
    const address = page.getByRole("textbox", { name: "Address" });
    await routeTo(address);
    await act(() => userEvent.type(address, "example.org{Enter}"));
    await expect.poll(async () => { await native.route(); return native.calls("createSurface").at(-1)?.id; }).toBe("tab-1");
    await native.started("tab-1");
    await native.report("tab-1", browserUrl, 100);
    await send(browserAsk);
    await routeTo(page.getByRole("region", { name: "Review read plan" }));
    if (button("Collapse").query()) await tap(button("Collapse"));
    await tap(button("Start read plan"));
    await tap(button("Allow Grace to read this browser"));
    await tap(button("Resume Grace"));

    browserCookieOwner = firstOwner;
    const guide = button("Show me the link");
    await tap(guide);
    await routeTo(page.getByRole("status", { name: "Link unavailable" }).getByText("The page or task changed. Ask me again on the page you want."));
    expect(ownerProbes).toBeGreaterThan(0);
    expect(hostedChoices).toBe(0);

    browserCookieOwner = undefined;
    await tap(guide);
    await routeTo(page.getByRole("status", { name: "Link guide result" }));
    expect(hostedChoices).toBe(1);
  } finally {
    await act(() => Promise.resolve(root.unmount()));
    await runtime.dispose();
    provider.mockRestore();
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
  const title = "Retinal scan with Dr. Chen";
  const place = "Riverview Clinic, room 7";
  const time = "14:35";
  const other = "family@comcast.net";
  const when = new Date();
  when.setDate(when.getDate() + 4);
  when.setHours(14, 35, 0, 0);
  const day = [when.getFullYear(), String(when.getMonth() + 1).padStart(2, "0"), String(when.getDate()).padStart(2, "0")].join("-");
  const subject = "Your appointment details";
  const selectedBody = `${title} on ${day} at ${time} in ${place}.`;
  const decoyBody = "Hearing test with Dr. Lewis at 08:20 in Eastwood, room 3.";
  const headers = { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" };
  const deliver = (from: string, fromEmail: string, body: string) => fetch(new URL("/fake/gmail/incoming", cloud), {
    method: "POST", headers, body: JSON.stringify({ to: gmail, from, fromEmail, subject, body }),
  });
  const alternate = await fetch(new URL("/api/v1/eliza/connections/other", cloud), {
    method: "POST", headers, body: JSON.stringify({ address: other, password: otherPassword }),
  });
  expect(alternate.ok).toBe(true);
  expect(await alternate.json()).toMatchObject({ outcome: "allowed", address: other });
  expect((await deliver("Riverview Eye Clinic", "eye@riverview.test", selectedBody)).ok).toBe(true);
  expect((await deliver("Eastwood Hearing Clinic", "hearing@eastwood.test", decoyBody)).ok).toBe(true);
  await Effect.runPromise(Effect.provide(script(cloud, secret, [
    { said: start, answer: JSON.stringify({ text: "Review the plan.", isQuestion: false, answers: [], actions: [{ kind: "proposeReadPlan", steps: ["ReadBrowser", "ReadMail", "SaveMailAppointment"] }] }) },
    { said: prepare, context: { includes: [selectedBody], excludes: [decoyBody] },
      answer: JSON.stringify({ text: `Add ${title} at ${time} in ${place}?`, isQuestion: true, answers: [approve, "No, thanks"], actions: [{ kind: "proposeFromMessage", title, day, time, place }] }) },
    { said: approve, answer: JSON.stringify({ text: "I will ask your calendar to save it.", isQuestion: false, answers: [], actions: [{ kind: "confirmProposal" }] }) },
  ]), client));
  localStorage.clear();
  localStorage.setItem("accounts", JSON.stringify(account));
  const native = fakePlugin();
  const { routeTo, tap, dispose } = await cloudReadPlan(native, cloud, secret);
  const button = (name: string | RegExp) => page.getByRole("button", { name });
  const say = async (text: string) => {
    const field = page.getByRole("textbox", { name: "Message to Grace" });
    await routeTo(field);
    await act(() => field.fill(text));
    await act(() => userEvent.keyboard("{Enter}"));
  };
  const plan = page.getByRole("region", { name: "Task plan" });
  const receipt = page.getByText("Saved appointment: " + title, { exact: true });
  const calendars = async () => {
    const Kept = Schema.Struct({
      boxes: Schema.Array(Schema.Struct({ address: Schema.String, calendar: Schema.Array(Schema.Struct({ title: Schema.String, startAt: Schema.String, location: Schema.String })) })),
    });
    const response = await fetch(`${cloud}/fake/account`, { headers: { authorization: `Bearer ${secret}` } });
    const { boxes } = Schema.decodeUnknownSync(Kept)(await response.json());
    return boxes;
  };

  try {
    await tap(button("Internet"));
    await visitExampleSite(native);
    await tap(button("Ask Grace"));
    await tap(button("Allow Grace to read this browser"));
    await say(start);
    await routeTo(page.getByRole("region", { name: "Review read plan" }).getByText(start, { exact: true }));
    await tap(button("Collapse"));
    await tap(button("Start read plan"));
    expect(plan.getByText(/^Open the email/).query()).toBeNull();
    await tap(button("Check page"));
    await routeTo(plan.getByText(/^Open the email/));

    await tap(button("Home"));
    await tap(button(/^Email/));
    await tap(button(/Riverview Eye Clinic/));
    await routeTo(page.getByText(selectedBody, { exact: true }));
    await tap(button("Resume Grace"));
    await tap(button("Check email"));
    await routeTo(plan.getByText(/^Ask me to prepare the appointment/));
    const previous = await calendars();
    expect(previous.map(({ address }) => address)).toEqual([gmail, other]);
    await say(prepare);
    const yes = button(approve);
    await routeTo(yes);
    expect(await calendars()).toEqual(previous);
    expect(receipt.query()).toBeNull();
    await tap(yes);
    await expect.poll(calendars, { timeout: 10000 }).toEqual(previous.map((box) => box.address === gmail
      ? { ...box, calendar: [...box.calendar, { title, startAt: when.toISOString(), location: place }] }
      : box));
    await tap(button("Home"));
    await tap(page.getByRole("group", { name: "Calendar", exact: true }).getByText("Calendar", { exact: true }));
    await tap(button("Resume Grace"));
    await tap(button("Check saved appointment"));
    await routeTo(plan.getByText("Planned checks complete", { exact: true }));
    await routeTo(receipt);
    await tap(button("Expand"));
    await routeTo(plan.getByText("Open page: https://example.org/", { exact: true }));
    await routeTo(plan.getByText(`Open message: ${subject}`, { exact: true }));
  } finally {
    await dispose();
    localStorage.clear();
  }
});

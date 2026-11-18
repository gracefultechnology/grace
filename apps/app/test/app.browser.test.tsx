// spec/app/surface.md, "Story: Use the website under Grace's controls"; spec/app/websiteRequests.md, "Story: Decide what a website may use"; spec/app/websiteRequests.md, "Story: Stay signed in to my websites"; spec/app/deviceKeys.md, "Story: Step back inside Grace before leaving"; spec/app/conversation.md, "Story: Talk or type without losing the conversation"
// The native page plugin is native code and cannot run in a browser: it is faked once, at its boundary.
// Each routing request waits until the test answers it, as the native router answers after a round trip.
import { Effect, ManagedRuntime, Schema } from "effect";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, expect, inject, it, onTestFinished, vi } from "vitest";
import { type Locator, page, userEvent } from "vitest/browser";
import { allowedUse, chooseProvider, initial as initialAccounts, sheetResult } from "../gen/app__accounts.ts";
import { Machine as PasswordViews } from "../gen/app.effect.vibe";
import { Machine as Setup } from "../gen/app__setup.effect.vibe";
import { Machine as Workspaces } from "../gen/app__workspace.effect.vibe";
import type { EmbeddedAgent } from "../src/agentPlugin.ts";
import { PasswordsClientError } from "../../../vendor/eliza/packages/os/src/bridges/passwords-client.ts";
import { App } from "../src/App.tsx";
import { PasswordBackupConsent } from "../src/PasswordBackupConsent.tsx";
import { application } from "../src/app.vibe";
import { AccountActions } from "../src/graceAccount.vibe";
import type { PasswordVault } from "../src/passwords.vibe";
import type { GraceAction } from "../src/agent.vibe";
import type { GuideSpeechResult, SurfacePlugin } from "../src/surfacePlugin.ts";
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
function fakePlugin(controlPage?: (options: Record<string, unknown>) => unknown, autoRoute = false, readPage?: () => unknown) {
  const calls: Call[] = [];
  const android = { allows: true };
  const privateSignIn = { allows: true };
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
        const start = () => emit("pageStarted", { id: options.id, url: options.url ?? "" });
        return Promise.resolve().then(() => held.starts ? void starts.push(start) : start());
      }
      return method === "setOcclusionRects" && !autoRoute ? new Promise<void>((resolve) => unanswered.push(resolve)) : Promise.resolve();
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
    privateSignIn,
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
  const element = document.body.appendChild(document.createElement("div"));
  const root = createRoot(element);
  onTestFinished(async () => {
    await act(() => Promise.resolve(root.unmount()));
    element.remove();
    await runtime.dispose();
  });
  const enterAddress = async (url: string) => {
    await act(() => page.getByRole("textbox", { name: "Address" }).fill(url));
    await act(() => userEvent.keyboard("{Enter}"));
  };
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


it('Use Home and Settings above Grace (spec/app/shell.md, "Story: Reach everyday tasks from Home"; spec/app/assistant.md, "Story: Keep control of one task across windows and pauses")', async () => {
  const runtime = ManagedRuntime.make(application(undefined));
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  onTestFinished(async () => {
    await act(() => root.unmount());
    host.remove();
    await runtime.dispose();
  });
  await act(() => root.render(<App runtime={runtime} />));
  const button = (name: string) => page.getByRole("button", { name, exact: true });
  const tap = (name: string) => act(() => userEvent.click(button(name)));

  await tap("Ask Grace");
  await tap("Close Grace");
  await tap("Ask Grace");
  await expect.element(button("Collapse")).toBeVisible();
  await tap("Home");
  await expect.element(button("Expand")).toBeVisible();
  await tap("More apps");
  await tap("Back to the first page");
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
});

it('Manage my saved passwords privately (spec/app/index.md, "Story: Manage my saved passwords privately")', async () => {
  let locked = true;
  let edited = false;
  let shown = false;
  let copied = false;
  let phoneRevision: number | undefined;
  let recoveryOpened = false;
  let ownerAvailable = true;
  let ownerChanged: (() => void) | undefined;
  const vault: PasswordVault = {
    status: () => Promise.resolve({
      available: true, locked, unlockRemainingMs: locked ? 0 : 60_000, unlockSeconds: 60, biometric: false,
      autofill: { supported: true, selected: "this-app" },
    }),
    lock: () => { locked = true; return Promise.resolve(); },
    unlock: () => {
      if (!ownerAvailable) return Promise.reject(new PasswordsClientError("not-admitted", "The account changed"));
      locked = false;
      return Promise.resolve({ unlockRemainingMs: 60_000 });
    },
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
  const element = document.body.appendChild(document.createElement("div"));
  const root = createRoot(element);
  onTestFinished(async () => {
    await act(() => Promise.resolve(root.unmount()));
    element.remove();
    await runtime.dispose();
  });
  await act(() => Promise.resolve(root.render(<App runtime={runtime} />)));
  await act(() => userEvent.click(page.getByRole("button", { name: "Ask Grace" })));
  await act(() => userEvent.type(page.getByRole("textbox", { name: "Message to Grace" }), "show my password"));
  await act(() => userEvent.click(page.getByRole("button", { name: "Send", exact: true })));
  const unlock = page.getByRole("button", { name: "Unlock Passwords" });
  await expect.element(unlock).toBeEnabled();
  const guide = () => runtime.runSync(Effect.flatMap(Effect.service(PasswordViews), (machine) => machine.get())).guide;
  expect(guide()).toBe("ShowPasswordGuide");
  await act(() => { ownerChanged?.(); return Promise.resolve(); });
  await expect.poll(guide).toBe("NoPasswordGuide");
  await expect.element(page.getByRole("list", { name: "Saved sign-ins" })).not.toBeInTheDocument();
  await act(() => userEvent.click(page.getByRole("button", { name: "Backup and recovery" })));
  await expect.poll(() => recoveryOpened).toBe(true);
  expect(locked).toBe(true);
  await act(() => userEvent.click(unlock));
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
  expect(shown).toBe(false);
  await act(() => userEvent.click(page.getByRole("button", { name: "Show password" })));
  await expect.poll(() => shown).toBe(true);
  await act(() => userEvent.click(page.getByRole("button", { name: "Edit", exact: true })));
  await expect.element(page.getByText("New account", { exact: true })).toBeVisible();
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
  await act(() => { ownerChanged?.(); return Promise.resolve(); });
  await expect.element(unlock).toBeEnabled();
  await expect.element(page.getByText("New account", { exact: true })).not.toBeInTheDocument();
  await act(() => userEvent.click(page.getByRole("button", { name: "Close Passwords" })));
  await expect.poll(() => locked).toBe(true);
  await expect.element(page.getByText("New account", { exact: true })).not.toBeInTheDocument();
  ownerAvailable = false;
  recoveryOpened = false;
  await act(() => userEvent.click(page.getByRole("button", { name: "More apps" })));
  await act(() => userEvent.click(page.getByRole("button", { name: "Passwords", exact: true })));
  await act(() => userEvent.click(unlock));
  await expect.element(unlock).not.toBeInTheDocument();
  await expect.element(page.getByText("New account", { exact: true })).not.toBeInTheDocument();
  await act(() => userEvent.click(page.getByRole("button", { name: "Backup and recovery" })));
  await expect.poll(() => recoveryOpened).toBe(true);
  expect(locked).toBe(true);
});

it('Sign in privately on a website (spec/app/browser.md, "Story: Sign in privately on a website")', async () => {
  const native = fakePlugin(undefined, true);
  const runtime = ManagedRuntime.make(application(native.plugin));
  const element = document.body.appendChild(document.createElement("div"));
  const root = createRoot(element);
  onTestFinished(async () => {
    await act(() => Promise.resolve(root.unmount()));
    element.remove();
    await runtime.dispose();
  });
  const browserState = () => runtime.runSync(Effect.flatMap(Effect.service(Workspaces), (machine) => machine.get())).browser;
  await act(() => Promise.resolve(root.render(<App runtime={runtime} />)));
  await act(() => userEvent.click(page.getByRole("button", { name: "Internet" })));
  await act(() => page.getByRole("textbox", { name: "Address" }).fill("https://utility.example/normal"));
  await act(() => userEvent.keyboard("{Enter}"));
  await expect.poll(() => native.calls("createSurface").length).toBe(1);
  await native.started("tab-1");
  await native.report("tab-1", "https://utility.example/normal", 100);
  await act(() => userEvent.click(page.getByRole("button", { name: "Private sign-in", exact: true })));
  await expect.poll(() => native.calls("createSurface")[1]).toMatchObject({
    url: "https://utility.example", purpose: "manual-sign-in", storage: "isolated", process: "isolated",
  });
  expect(native.calls("createSurface")[1]).not.toHaveProperty("profileKey");
  await native.report("tab-2", "https://utility.example", 100);
  const address = page.getByRole("textbox", { name: "Private website address" });
  await act(() => address.fill("https://utility.example/enter/sample?ref=one-time"));
  await act(() => userEvent.keyboard("{Enter}"));
  await expect.poll(() => native.calls("navigate").at(-1)).toMatchObject({
    url: "https://utility.example/enter/sample?ref=one-time", id: "tab-2",
  });
  await native.report("tab-2", "https://utility.example/account?ref=one-time", 100);
  const state = JSON.stringify(browserState());
  expect(state).not.toContain("one-time");
  expect(browserState().recent).toEqual(["https://utility.example/normal"]);
  await expect.element(page.getByRole("button", { name: "Ask Grace" })).not.toBeInTheDocument();
  await act(() => userEvent.click(page.getByRole("button", { name: "Close Private sign-in", exact: true })));
  await act(() => userEvent.click(page.getByRole("button", { name: "Ask Grace" })));
  await act(() => page.getByRole("textbox", { name: "Message to Grace" }).fill("sign me in to pay my bill"));
  await act(() => userEvent.click(page.getByRole("button", { name: "Send", exact: true })));
  await expect.poll(() => native.calls("createSurface").at(-1)).toMatchObject({
    id: "tab-3", url: "https://utility.example", purpose: "manual-sign-in", storage: "isolated", process: "isolated",
  });
  expect(browserState().recent).toEqual(["https://utility.example/normal"]);
  await act(() => userEvent.click(page.getByRole("button", { name: "Close Private sign-in", exact: true })));
  native.privateSignIn.allows = false;
  await act(() => userEvent.click(page.getByRole("button", { name: "Private sign-in", exact: true })));
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
});

it('Use only the current local speech for Passwords guidance (spec/app/index.md, "Story: Manage my saved passwords privately")', async () => {
  type Heard = { status: "complete"; text: string };
  const requests: ((result: Heard) => void)[] = [];
  const cancellations: string[] = [];
  const runtime = ManagedRuntime.make(application(undefined, undefined, undefined, undefined, undefined, {
    listen: () => new Promise<Heard>((resolve) => requests.push(resolve)),
    cancel: ({ id }) => { cancellations.push(id); return Promise.resolve(); },
  }));
  const element = document.body.appendChild(document.createElement("div"));
  const root = createRoot(element);
  onTestFinished(async () => {
    await act(() => Promise.resolve(root.unmount()));
    element.remove();
    await runtime.dispose();
  });
  await act(() => Promise.resolve(root.render(<App runtime={runtime} />)));
  const ask = page.getByRole("button", { name: "Ask Grace" });
  const mic = () => page.getByRole("switch", { name: "Mic off" });
  await act(() => userEvent.click(ask));
  expect(requests).toHaveLength(0);
  await act(() => userEvent.click(mic()));
  await expect.poll(() => requests.length).toBe(1);
  await act(() => userEvent.click(page.getByRole("textbox", { name: "Message to Grace" })));
  await expect.poll(() => cancellations.length).toBe(1);
  await act(() => { requests[0]?.({ status: "complete", text: "open passwords" }); return Promise.resolve(); });
  await expect.element(page.getByRole("button", { name: "Close Passwords" })).not.toBeInTheDocument();
  await act(() => userEvent.click(mic()));
  await expect.poll(() => requests.length).toBe(2);
  await act(() => { requests[1]?.({ status: "complete", text: "sample secret words" }); return Promise.resolve(); });
  await expect.element(mic()).toBeVisible();
  await expect.element(page.getByText("sample secret words")).not.toBeInTheDocument();
  await act(() => userEvent.click(mic()));
  await expect.poll(() => requests.length).toBe(3);
  await act(() => { requests[2]?.({ status: "complete", text: "Open passwords." }); return Promise.resolve(); });
  await expect.element(page.getByRole("button", { name: "Close Passwords" })).toBeVisible();
});


it(`Open a control from the agent reply (spec/app/workspace.md, "Story: Open an available control from Grace's reply"; spec/app/workspace.md, "Story: Follow one reviewed plan across apps")`, async () => {
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
      await act(() => userEvent.type(input, words + "{Enter}"));
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
  const sent: string[] = [];
  let changed: string[] = [];
  const reminders: number[] = [];
  const literalText = "<strong>This stays plain text.</strong>";
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
          accountId: replyFromOwner ? person.id : "different-owner", message: mail, bodyTextAvailable: true,
          reply: { recipient: "robin@example.test", subject: "Your receipt" },
          bodyText: replyFromOwner ? literalText : "Another person’s message",
        });
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
      case "/api/v1/eliza/google/calendar/reminder/event": {
        expect(api.searchParams.get("grantId")).toBe(grant);
        const event = events.find((item) => item.externalId === api.searchParams.get("occurrenceId"));
        return event ? reply({ accountId: person.id, event }) : reply({ error: "google_item_not_found" }, 404);
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

  let runtime = ManagedRuntime.make(application(undefined));
  const host = document.body.appendChild(document.createElement("div"));
  let root = createRoot(host);
  const tap = (name: string | RegExp) => act(() => userEvent.click(page.getByRole("button", { name, exact: true })));
  try {
    await act(() => Promise.resolve(root.render(<App runtime={runtime} />)));
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
    await tap("Calendar");
    await tap(/Dentist/);
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

    await act(() => Promise.resolve(root.unmount()));
    await runtime.dispose();
    const lunch = events.find((event) => event.title === "Lunch")!;
    const reminded = new URL(oldURL);
    reminded.hash = "calendar";
    reminded.searchParams.set("owner_hint", ownerHint);
    reminded.searchParams.set("occurrence", lunch.externalId);
    window.history.replaceState(undefined, "", reminded);
    runtime = ManagedRuntime.make(application(undefined));
    root = createRoot(host);
    await act(() => Promise.resolve(root.render(<App runtime={runtime} />)));
    await expect.element(page.getByRole("heading", { name: "Lunch" })).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Back to calendar" })).toBeVisible();
  } finally {
    await act(() => Promise.resolve(root.unmount()));
    await runtime.dispose();
    host.remove();
    provider.mockRestore();
    if (oldAccounts === null) localStorage.removeItem("accounts");
    else localStorage.setItem("accounts", oldAccounts);
    if (oldIntent === null) sessionStorage.removeItem("grace-hosted-read");
    else sessionStorage.setItem("grace-hosted-read", oldIntent);
    window.history.replaceState(undefined, "", oldURL);
  }
});

it('Check the Android readback for brightness and mute (spec/app/preferences.md, "Night dimming and sound samples use the current preference without rewriting it")', async () => {
  const audio = { step: 0, min: 0, max: 15, muted: false };
  let brightness = 20;
  let denyBrightness = false;
  const readback: { brightness: number; muted: boolean; step: number }[] = [];
  const runtime = ManagedRuntime.make(application(undefined, undefined, {
    native: true,
    display: {
      getDevice: async () => {
        readback.push({ brightness, muted: audio.muted, step: audio.step });
        return { volume: { ...audio }, brightness: { percent: brightness } };
      },
      setBrightness: async ({ percent }) => { if (!denyBrightness) brightness = percent; },
      setVolume: async ({ step, muted }) => { Object.assign(audio, { step, muted }); },
    },
  }));
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  onTestFinished(async () => {
    await act(() => root.unmount());
    await runtime.dispose();
    host.remove();
  });
  const tap = (name: string) => act(() => userEvent.click(page.getByRole("button", { name, exact: true })));
  await act(() => root.render(<App runtime={runtime} />));
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
});

it('Restore the saved text size when Grace restarts (spec/app/preferences.md, "Restart restores confirmed preferences and invalidates pending acknowledgements")', async () => {
  let stored: { revision: number; value?: string } = { revision: 0 };
  let rejectNextWrite = true;
  const options = {
    native: true,
    preferences: {
      read: async () => stored,
      write: async ({ revision, value }: { revision: number; value: string }) => {
        expect(revision).toBe(stored.revision);
        if (rejectNextWrite) {
          rejectNextWrite = false;
          throw new Error("Device storage unavailable");
        }
        stored = { revision: revision + 1, value };
        return { revision: stored.revision };
      },
    },
  };
  const host = document.body.appendChild(document.createElement("div"));
  let runtime = ManagedRuntime.make(application(undefined, undefined, options));
  let root = createRoot(host);
  onTestFinished(async () => {
    await act(() => root.unmount());
    await runtime.dispose();
    host.remove();
  });
  const mountSettings = async () => {
    await act(() => root.render(<App runtime={runtime} />));
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
  await act(() => root.unmount());
  await runtime.dispose();
  root = createRoot(host);
  runtime = ManagedRuntime.make(application(undefined, undefined, options));
  await mountSettings();
  await expect.element(larger).toHaveAttribute("aria-checked", "true");
  expect(stored.revision).toBe(1);
});

it('Remove the chosen saved photo (spec/app/files.md, "Story: Save, share, print and remove the chosen file")', async () => {
  const lease = "6809777f-9d01-4857-8b5f-5ed6d7376f62";
  const photo = { id: "5860d0a8-b810-4c0e-ad5f-efeaf0d19f7f", kind: "photo", name: "Garden.jpg", savedAt: 3, pages: 0 };
  let entries = [photo];
  const removals: string[] = [];
  const runtime = ManagedRuntime.make(application(undefined, undefined, {
    native: true,
    files: {
      open: async () => ({ lease }),
      close: async () => undefined,
      list: async () => ({ entries }),
      preview: async ({ id, page }) => ({ id, page, image: "data:image/jpeg;base64,/9j/2Q==" }),
      pick: async () => undefined,
      capture: async () => undefined,
      commit: async () => undefined,
      remove: async (request) => {
        expect(request).toEqual({ lease, id: photo.id });
        removals.push(request.id);
        if (removals.length === 1) throw new Error("Device storage unavailable");
        entries = [];
      },
    },
  }));
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  onTestFinished(async () => {
    await act(() => root.unmount());
    await runtime.dispose();
    host.remove();
  });
  await act(() => root.render(<App runtime={runtime} />));
  await expect.poll(async () => (await runtime.runPromise(Effect.flatMap(Setup, (setup) => setup.get()))).graceAccount.tag).toBe("AccountUnavailable");
  await act(() => runtime.runPromise(Effect.flatMap(Setup, (setup) => setup.send({ type: "reportGraceAccount",
    report: { tag: "GraceDeviceSignedIn" }, link: { tag: "GoogleLinkUnknown" } }))));
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
});

it('Use a standalone vault and local voice guidance (spec/app/index.md, "Story: Manage my saved passwords privately")', async () => {
  let locked = true;
  let saved = { id: "first-login", revision: 4, updatedAt: 1, label: "Utility account", username: "Pat", bindings: [] };
  let shown = false;
  const vault: PasswordVault = {
    status: () => Promise.resolve({
      available: true, locked, unlockRemainingMs: locked ? 0 : 60_000, unlockSeconds: 60, biometric: false,
      autofill: { supported: true, selected: "this-app" },
    }),
    lock: () => { locked = true; return Promise.resolve(); },
    unlock: () => { locked = false; return Promise.resolve({ unlockRemainingMs: 60_000 }); },
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
  let finishSpeech: ((result: GuideSpeechResult) => void) | undefined;
  const runtime = ManagedRuntime.make(application(undefined, undefined, {
    native: false, vault,
    guideSpeech: {
      listen: () => new Promise<GuideSpeechResult>((resolve) => { finishSpeech = resolve; }),
      cancel: () => { finishSpeech?.({ status: "cancelled" }); return Promise.resolve(); },
    },
  }));
  const element = document.body.appendChild(document.createElement("div"));
  const root = createRoot(element);
  onTestFinished(async () => {
    await act(() => Promise.resolve(root.unmount()));
    element.remove();
    await runtime.dispose();
  });
  await act(() => Promise.resolve(root.render(<App runtime={runtime} />)));
  await act(() => userEvent.click(page.getByRole("button", { name: "Ask Grace" })));
  await act(() => userEvent.type(page.getByRole("textbox", { name: "Message to Grace" }), "show my password"));
  await act(() => userEvent.click(page.getByRole("button", { name: "Send", exact: true })));
  const unlock = page.getByRole("button", { name: "Unlock Passwords" });
  await expect.element(unlock).toBeEnabled();
  await expect.element(page.getByRole("list", { name: "Saved sign-ins" })).not.toBeInTheDocument();
  await act(() => userEvent.click(unlock));
  await act(() => userEvent.click(page.getByRole("button", { name: /Utility account/ })));
  expect(shown).toBe(false);
  await act(() => userEvent.click(page.getByRole("button", { name: "Show password" })));
  await expect.poll(() => shown).toBe(true);
  await act(() => userEvent.click(page.getByRole("button", { name: "Edit", exact: true })));
  await expect.element(page.getByText("New account", { exact: true })).toBeVisible();
  saved = { ...saved, username: "Updated on this tablet", revision: 6 };
  await act(() => userEvent.click(page.getByRole("button", { name: "Copy password" })));
  await expect.element(page.getByText("Updated on this tablet", { exact: true })).toBeVisible();
  await act(() => userEvent.click(page.getByRole("button", { name: "Close Passwords" })));
  await expect.poll(() => locked).toBe(true);
  await expect.element(page.getByText("Updated on this tablet", { exact: true })).not.toBeInTheDocument();
  await act(() => userEvent.click(page.getByRole("button", { name: "More apps" })));
  await act(() => userEvent.click(page.getByRole("button", { name: "Passwords", exact: true })));
  await expect.element(unlock).toBeEnabled();
  await act(() => userEvent.click(page.getByRole("button", { name: "Close Passwords" })));
  await act(() => userEvent.click(page.getByRole("button", { name: "Ask Grace" })));
  await act(() => userEvent.click(page.getByRole("button", { name: "Say a Passwords command" })));
  await expect.poll(() => typeof finishSpeech).toBe("function");
  await act(async () => { finishSpeech?.({ status: "complete", text: "Open passwords" }); });
  await expect.element(unlock).toBeEnabled();
});

it('Use private sign-in in the standalone browser (spec/app/browser.md, "Story: Sign in privately on a website")', async () => {
  const native = fakePlugin();
  const runtime = ManagedRuntime.make(application(native.plugin));
  const element = document.body.appendChild(document.createElement("div"));
  const root = createRoot(element);
  onTestFinished(async () => {
    await act(() => Promise.resolve(root.unmount()));
    element.remove();
    await runtime.dispose();
  });
  const browserState = () => runtime.runSync(Effect.flatMap(Effect.service(Workspaces), (machine) => machine.get())).browser;
  await act(() => Promise.resolve(root.render(<App runtime={runtime} />)));
  await act(() => userEvent.click(page.getByRole("button", { name: "Internet" })));
  await act(() => userEvent.type(page.getByRole("textbox", { name: "Address" }), "https://utility.example/normal{Enter}"));
  await expect.poll(() => native.calls("createSurface").length).toBe(1);
  await native.route();
  await native.started("tab-1");
  await native.report("tab-1", "https://utility.example/normal", 100);
  await act(() => userEvent.click(page.getByRole("button", { name: "Private sign-in", exact: true })));
  await expect.poll(() => native.calls("createSurface")[1]).toMatchObject({
    url: "https://utility.example", purpose: "manual-sign-in", storage: "isolated", process: "isolated",
  });
  expect(native.calls("createSurface")[1]).not.toHaveProperty("profileKey");
  await native.route();
  await native.report("tab-2", "https://utility.example", 100);
  const address = page.getByRole("textbox", { name: "Private website address" });
  await act(() => userEvent.clear(address));
  await act(() => userEvent.type(address, "https://utility.example/enter/sample?ref=one-time{Enter}"));
  await expect.poll(() => native.calls("navigate").at(-1)).toMatchObject({
    url: "https://utility.example/enter/sample?ref=one-time", id: "tab-2",
  });
  await native.report("tab-2", "https://utility.example/account?ref=one-time", 100);
  const state = JSON.stringify(browserState());
  expect(state).not.toContain("one-time");
  expect(browserState().recent).toEqual(["https://utility.example/normal"]);
  await expect.element(page.getByRole("button", { name: "Ask Grace" })).not.toBeInTheDocument();
  await act(() => userEvent.click(page.getByRole("button", { name: "Close Private sign-in", exact: true })));
  await act(() => userEvent.click(page.getByRole("button", { name: "Ask Grace" })));
  const message = page.getByRole("textbox", { name: "Message to Grace" });
  await expect.poll(async () => { await native.route(); return message.query() !== null; }).toBe(true);
  await act(() => userEvent.type(message, "sign me in to pay my bill"));
  await act(() => userEvent.click(page.getByRole("button", { name: "Send", exact: true })));
  await expect.poll(() => native.calls("createSurface").at(-1)).toMatchObject({
    id: "tab-3", url: "https://utility.example", purpose: "manual-sign-in", storage: "isolated", process: "isolated",
  });
  expect(browserState().recent).toEqual(["https://utility.example/normal"]);
});

it('Approve the shown account before returning to the tablet (spec/app/setup.md, "Story: Approve a password backup in my browser")', async () => {
  const element = document.createElement("div");
  document.body.append(element);
  const root = createRoot(element);
  const approval = {
    clientId: "technology.graceful.grace", environment: "staging", purpose: "save",
    redirectUri: "https://app.graceforseniors.com/android/auth/callback", state: "s".repeat(43),
    codeChallenge: "c".repeat(43), codeChallengeMethod: "S256",
  } as const;
  const returned = new URL(approval.redirectUri);
  returned.searchParams.set("code", "pbackup_" + "k".repeat(43));
  returned.searchParams.set("state", approval.state);
  const requests: unknown[] = [];
  const network = window.fetch.bind(window);
  const fetch = vi.spyOn(window, "fetch").mockImplementation(async (input, init) => {
    if (typeof input !== "string" || !input.endsWith("/api/v1/app-auth/mobile/password-backup")) return network(input, init);
    requests.push(JSON.parse(String(init?.body)));
    return Response.json({ redirectUrl: returned.href });
  });
  onTestFinished(async () => {
    fetch.mockRestore();
    await act(() => root.unmount());
    element.remove();
  });
  await act(() => root.render(<PasswordBackupConsent approval={approval} account={{ id: "owner", email: "owner@example.test" }} />));
  expect(requests).toEqual([]);
  await act(async () => { await page.getByRole("button", { name: "Approve" }).click(); });
  await expect.element(page.getByRole("link", { name: "Return to Grace" })).toHaveAttribute("href", returned.href);
  expect(requests).toEqual([{ approval, expectedOwnerId: "owner" }]);
});

it('Refresh an email-only sign-in before approving a password backup (spec/app/setup.md, "Story: Approve a password backup in my browser")', async () => {
  const element = document.createElement("div");
  document.body.append(element);
  const root = createRoot(element);
  const approval = {
    clientId: "technology.graceful.grace", environment: "staging", purpose: "save",
    redirectUri: "https://app.graceforseniors.com/android/auth/callback", state: "s".repeat(43),
    codeChallenge: "c".repeat(43), codeChallengeMethod: "S256",
  } as const;
  const calls: string[] = [];
  const network = window.fetch.bind(window);
  const returned = new URL(approval.redirectUri);
  returned.searchParams.set("code", "pbackup_" + "k".repeat(43));
  returned.searchParams.set("state", approval.state);
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
    expect(JSON.parse(String(init?.body))).toEqual({ approval, expectedOwnerId: "owner" });
    return Response.json({ redirectUrl: returned.href });
  });
  onTestFinished(async () => {
    mock.mockRestore();
    await act(() => root.unmount());
    element.remove();
  });
  await act(() => root.render(<PasswordBackupConsent approval={approval} account={{ id: "owner", email: "owner@example.test" }}
    providers={{ google: false, email: true, sms: false }} />));
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
  const home = { id: "example-home", path: "/", title: "Example", heading: "Example", text: "Example\nHelp center" };
  const about = { id: "example-about", path: "/about", title: target, heading: "About Example", text: "About Example\nHelp center\nOur team" };
  const help = { id: "example-help", path: "/help", title: target + " | Example", heading: target, text: "Help center\nFind answers to frequently asked questions." };
  let currentPage = home;
  let domRevision = 1;
  let reviseDuringRead = false;
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
    if (reviseDuringRead) {
      domRevision++;
      reviseDuringRead = false;
    }
    return { url: origin + currentPage.path, title: currentPage.title, text: currentPage.heading, truncated: false };
  });
  let guideOwner: string | null = null;
  let guideCalls = 0;
  let replaceGuideOwner = true;
  const browserFetch = window.fetch.bind(window);
  const accountNetwork = vi.spyOn(window, "fetch").mockImplementation((input, init) => {
    const url = new URL(String(input), window.location.origin);
    if (url.origin !== window.location.origin) return browserFetch(input, init);
    switch (url.pathname) {
      case "/api/auth/session": return Promise.resolve(Response.json({ account: guideOwner === null ? null : { id: guideOwner, email: "owner@grace.test" } }));
      case "/api/auth/refresh": return Promise.resolve(new Response(null, { status: 401 }));
      case "/api/auth/providers": return Promise.resolve(Response.json({ email: true, google: false, sms: false }));
      case "/api/v1/billing/subscription": return Promise.resolve(Response.json({ status: "inactive", canManage: false, canCheckout: false }));
      case "/api/v1/decisions":
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
      default: return browserFetch(input, init);
    }
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
    expect(native.calls("controlPage")).not.toContainEqual(expect.objectContaining({
      command: expect.objectContaining({ subaction: "guide", guidance: expect.objectContaining({ kind: "show" }) }),
    }));
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
    accountNetwork.mockRestore();
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

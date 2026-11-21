// spec/app/notices.md, "Story: See one message at a time, in the order things happened"; spec/app/notices.md, "A toast stays its whole lifetime unless the person closes it or acts"; spec/app/notices.md, "Coming back online is told once, in a toast"; spec/app/notices.md, "No notice shows over a commitment review or a website's question"
import { Effect, ManagedRuntime, Stream } from "effect";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, onTestFinished } from "vitest";
import { page, userEvent } from "vitest/browser";
import { Machine as Notices } from "../gen/app__notices.effect.vibe";
import { type Event as ProposalEvent, Machine as Proposals, addVisit } from "../gen/app__proposal.effect.vibe";
import { Machine as Workspaces } from "../gen/app__workspace.effect.vibe";
import { App } from "../src/App.tsx";
import { application } from "../src/app.vibe";
import { NoticeHost, type Reply } from "../src/notices.vibe";
import { mount, signInToGrace } from "./screen.tsx";
import "../src/main.css";

describe('spec/app/notices.md, "Story: See one message at a time, in the order things happened"', () => {
  it("See one message at a time", async () => {
    await page.viewport(1280, 800);
    const network = { online: true };
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => network.online });
    const reach = (online: boolean) => {
      network.online = online;
      window.dispatchEvent(new Event(online ? "online" : "offline"));
    };
    const runtime = ManagedRuntime.make(application(undefined));
    const root = createRoot(document.body.appendChild(document.createElement("div")));
    const toasts: (string | null)[] = [null];
    const watcher = new MutationObserver(() => {
      const shown = document.querySelector("[role=status]")?.textContent ?? null;
      if (toasts.at(-1) !== shown) toasts.push(shown);
    });
    watcher.observe(document.body, { subtree: true, childList: true, characterData: true });
    onTestFinished(async () => {
      watcher.disconnect();
      root.unmount();
      await runtime.dispose();
      Reflect.deleteProperty(navigator, "onLine");
    });
    root.render(<App runtime={runtime} />);
    const notices = (use: (host: NoticeHost["Service"]) => Effect.Effect<unknown, unknown>) => runtime.runPromise(Effect.flatMap(Effect.service(NoticeHost), use));
    const connectivity = () => runtime.runPromise(Effect.flatMap(Effect.service(Workspaces), (w) => Effect.map(w.get(), ({ device }) => device.connectivity)));
    const replies: Reply[] = [];
    runtime.runFork(Effect.flatMap(Effect.service(NoticeHost), (host) => Stream.runForEach(host.replies, (reply) => Effect.sync(() => replies.push(reply)))));

    await expect.poll(connectivity).toBe("Online");
    reach(false);
    await expect.poll(connectivity).toBe("Offline");
    reach(true);
    await expect.element(page.getByRole("status")).toHaveTextContent("Back online");

    await notices((host) => Effect.all([host.raise({ source: "Settings", offer: "Undo", subject: "Text size changed" }), host.raise({ source: "Files", offer: "NoOffer", subject: "Saved to Files" })]));
    await userEvent.click(page.getByRole("button", { name: "Undo" }));
    await notices((host) => host.act(1));
    await expect.poll(() => ({ toasts, replies }), { timeout: 15_000 }).toEqual({
      toasts: [null, "Back online", "Text size changedUndo", "Saved to Files", null],
      replies: [
        { _tag: "Closed", notice: { id: 0, source: "Connectivity", offer: "NoOffer", subject: "online" } },
        { _tag: "Undo", notice: { id: 1, source: "Settings", offer: "Undo", subject: "Text size changed" } },
        { _tag: "Closed", notice: { id: 2, source: "Files", offer: "NoOffer", subject: "Saved to Files" } },
      ],
    });

    const question = (event: ProposalEvent, by: "Grace" | "Host") => runtime.runPromise(Effect.flatMap(Effect.service(Proposals), (p) => p.send(event, by)));
    const covered = () => runtime.runPromise(Effect.flatMap(Effect.service(Notices), (n) => Effect.map(n.get(), (x) => x.blocked)));
    const spoken = { generation: 1, workVersion: 1, origin: "Spoken" } as const;
    await question({ type: "propose", ask: addVisit, request: spoken, now: spoken }, "Grace");
    await expect.poll(covered).toBe(true);
    await notices((host) => host.raise({ source: "Files", offer: "NoOffer", subject: "Moved to Files" }));
    await expect.element(page.getByRole("status")).not.toBeInTheDocument();
    await question({ type: "withdraw", interruption: "Cancellation" }, "Host");
    await expect.element(page.getByRole("status")).toHaveTextContent("Moved to Files");
    expect(toasts.slice(4)).toEqual([null, "Moved to Files"]);
  });
});

it('Due reminder (spec/app/notices.md, "A due reminder is a banner on Home, a toast elsewhere and an Android notification in the background")', async () => {
  const id = "owned-calendar-" + "a".repeat(24) + "-" + "b".repeat(48);
  const reminders = [{ id, title: "Library visit", eventAt: Date.now() + 3600000 }];
  const actions: string[] = [];
  let entries: typeof reminders = [];
  let changed: (() => void) | undefined;
  let accept = false;
  const runtime = ManagedRuntime.make(application(undefined, undefined, {
    native: true,
    reminders: {
      enableManagedReminders: () => Promise.resolve(),
      managedDue: () => Promise.resolve({ reminders: entries }),
      openManagedDue: ({ id: selected }) => { actions.push("open:" + selected); return Promise.resolve(); },
      dismissManagedDue: ({ id: selected }) => {
        actions.push("dismiss:" + selected);
        if (!accept) return Promise.reject(new Error("Calendar could not save dismissal"));
        entries = [];
        return Promise.resolve({ id: selected });
      },
      addListener: (_event, listener) => {
        changed = listener;
        return Promise.resolve({ remove: () => { changed = undefined; return Promise.resolve(); } });
      },
    },
  }));
  await mount(runtime);
  await signInToGrace(runtime);
  const click = (name: string) => act(() => userEvent.click(page.getByRole("button", { name, exact: true })));
  await click("Settings");
  entries = reminders;
  await act(() => Promise.resolve(changed?.()));
  const toast = page.getByText(/^Reminder: Library visit/);
  await expect.element(toast).toBeVisible();
  await click("See details");
  await expect.poll(() => actions).toEqual(["open:" + id]);
  await click("Home");
  const banner = page.getByText(/^Library visit/);
  await expect.element(banner).toBeVisible();
  await click("Dismiss");
  await expect.poll(() => actions).toEqual(["open:" + id, "dismiss:" + id]);
  await expect.element(banner).toBeVisible();
  accept = true;
  await click("Dismiss");
  await expect.poll(() => actions).toEqual(["open:" + id, "dismiss:" + id, "dismiss:" + id]);
  await expect.element(banner).not.toBeInTheDocument();
});

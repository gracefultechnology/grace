// spec/app/notices.md, "Story: See one message at a time, in the order things happened"; spec/app/notices.md, "A toast stays its whole lifetime unless the person closes it or acts"; spec/app/notices.md, "Coming back online is told once, in a toast"; spec/app/notices.md, "No notice shows over a commitment review or a website's question"
import { Effect, ManagedRuntime, Stream } from "effect";
import { act } from "react";
import { beforeAll, describe, expect, it, onTestFinished } from "vitest";
import { page, userEvent } from "vitest/browser";
import { Machine as Notices } from "../gen/app__notices.effect.vibe";
import { type Event as ProposalEvent, Machine as Proposals, addVisit } from "../gen/app__proposal.effect.vibe";
import { Machine as Workspaces } from "../gen/app__workspace.effect.vibe";
import { application } from "../src/app.vibe";
import { NoticeHost, type Reply } from "../src/notices.vibe";
import { mockNetworkReach, mount, signInToGrace, tabletView } from "./screen.tsx";
import "../src/main.css";

beforeAll(() => page.viewport(1280, 800));

describe('spec/app/notices.md, "Story: See one message at a time, in the order things happened"', () => {
  it("See one message at a time", async () => {
    const reach = mockNetworkReach();
    const runtime = ManagedRuntime.make(application(undefined));
    const view = tabletView(runtime);
    const toasts: (string | null)[] = [null];
    const watcher = new MutationObserver(() => {
      const shown = [...document.querySelectorAll("[role=status]")].find((x) => x.querySelector("b") === null)?.textContent ?? null;
      if (toasts.at(-1) !== shown) toasts.push(shown);
    });
    onTestFinished(async () => {
      watcher.disconnect();
      await view.dispose();
    });
    await view.render();
    watcher.observe(document.body, { subtree: true, childList: true, characterData: true });
    const notices = (use: (host: NoticeHost["Service"]) => Effect.Effect<unknown, unknown>) => runtime.runPromise(Effect.flatMap(Effect.service(NoticeHost), use));
    const connectivity = () => runtime.runPromise(Effect.flatMap(Effect.service(Workspaces), (w) => Effect.map(w.get(), ({ device }) => device.connectivity)));
    const replies: Reply[] = [];
    runtime.runFork(Effect.flatMap(Effect.service(NoticeHost), (host) => Stream.runForEach(host.replies, (reply) => Effect.sync(() => replies.push(reply)))));

    await expect.poll(connectivity).toBe("Online");
    // spec/app/notices.md, "Home shows one banner, for the first cause: no Wi-Fi, a signed-out account, no email, then a reminder"
    await expect.element(page.getByRole("status").filter({ hasText: "Add your email" })).toBeVisible();
    await reach(false);
    await expect.poll(connectivity).toBe("Offline");
    await reach(true);
    await expect.element(page.getByRole("status").filter({ hasText: "Back online" })).toBeVisible();

    await notices((host) => Effect.all([host.raise({ source: "Settings", offer: "Undo", subject: "Text size changed" }), host.raise({ source: "Files", offer: "NoOffer", subject: "Saved to Files" })]));
    await act(() => userEvent.click(page.getByRole("button", { name: "Undo" })));
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
    await expect.element(page.getByRole("status").filter({ hasText: "Moved to Files" })).toBeVisible();
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

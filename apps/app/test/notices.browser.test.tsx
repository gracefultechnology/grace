// spec/app/notices.md, "Story: See one message at a time, in the order things happened"; spec/app/notices.md, "Story: See what needs me on Home"; spec/app/notices.md, "A toast stays its whole lifetime unless the person closes it or acts"; spec/app/notices.md, "Coming back online is told once, in a toast"
import { Effect, ManagedRuntime, Stream } from "effect";
import { createRoot } from "react-dom/client";
import { expect, it, onTestFinished } from "vitest";
import { page, userEvent } from "vitest/browser";
import { Machine as Workspaces } from "../gen/app__workspace.effect.vibe";
import { App } from "../src/App.tsx";
import { application } from "../src/app.vibe";
import { NoticeBanner } from "../src/Notices.tsx";
import { NoticeHost, type Reply } from "../src/notices.vibe";
import { RuntimeContext } from "../src/useApp.ts";
import "../src/main.css";

it('See one message at a time, and what needs me on Home (spec/app/notices.md, "Story: See one message at a time, in the order things happened"; spec/app/notices.md, "Story: See what needs me on Home")', async () => {
  await page.viewport(1280, 800);
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
  });
  root.render(<RuntimeContext value={runtime}><NoticeBanner /><App runtime={runtime} /></RuntimeContext>);
  const notices = (use: (host: NoticeHost["Service"]) => Effect.Effect<unknown, unknown>) => runtime.runPromise(Effect.flatMap(Effect.service(NoticeHost), use));
  const workspace = () => runtime.runPromise(Effect.flatMap(Effect.service(Workspaces), (w) => w.get()));
  const connect = (connection: "Online" | "Offline") => runtime.runPromise(Effect.flatMap(Effect.service(Workspaces), (w) => Effect.flatMap(w.get(), ({ device }) =>
    w.send({ type: "setAvailability", availability: { connection, reasoning: device.reasoningAvailable, microphone: device.microphoneAllowed, observation: device.observationAllowed } }, "Host"))));
  const replies: Reply[] = [];
  runtime.runFork(Effect.flatMap(Effect.service(NoticeHost), (host) => Stream.runForEach(host.replies, (reply) => Effect.sync(() => replies.push(reply)))));

  await expect.poll(async () => (await workspace()).device.connectivity).toBe("Online");
  await connect("Offline");
  await userEvent.click(page.getByRole("button", { name: "Fix Wi-Fi" }));
  await expect.poll(async () => (await workspace()).device.settingsPage).toBe("NetworkSettings");
  await expect.element(page.getByRole("button", { name: "Fix Wi-Fi" })).not.toBeInTheDocument();
  await connect("Online");
  await expect.element(page.getByRole("status")).toHaveTextContent("Back online");

  await notices((host) => Effect.all([host.raise({ source: "Settings", offer: "Undo", subject: "Text size changed" }), host.raise({ source: "Files", offer: "NoOffer", subject: "Saved to Files" })]));
  await userEvent.click(page.getByRole("button", { name: "Undo" }));
  await notices((host) => host.act(1));
  await expect.poll(() => toasts.length, { timeout: 15_000 }).toBe(5);
  expect({ toasts, replies }).toEqual({
    toasts: [null, "Back online", "Text size changedUndo", "Saved to Files", null],
    replies: [
      { _tag: "Closed", notice: { id: 0, source: "Connectivity", offer: "NoOffer", subject: "online" } },
      { _tag: "Undo", notice: { id: 1, source: "Settings", offer: "Undo", subject: "Text size changed" } },
      { _tag: "Closed", notice: { id: 2, source: "Files", offer: "NoOffer", subject: "Saved to Files" } },
    ],
  });
});

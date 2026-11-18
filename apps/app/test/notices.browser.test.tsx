// spec/app/notices.md, "Story: See one message at a time, in the order things happened"; spec/app/notices.md, "A toast stays its whole lifetime unless the person closes it or acts"; spec/app/notices.md, "Coming back online is told once, in a toast"
import { Effect, ManagedRuntime, Stream } from "effect";
import { createRoot } from "react-dom/client";
import { describe, expect, it, onTestFinished } from "vitest";
import { page, userEvent } from "vitest/browser";
import { Machine as Workspaces } from "../gen/app__workspace.effect.vibe";
import { App } from "../src/App.tsx";
import { application } from "../src/app.vibe";
import { NoticeHost, type Reply } from "../src/notices.vibe";
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
  });
});

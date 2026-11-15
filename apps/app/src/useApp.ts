// .claude/skills/shell/SKILL.md, "The React interface": the workspace and the page layer, as components read
// them, and the one way a component changes the workspace.
import { Effect, type ManagedRuntime, Stream } from "effect";
import { createContext, use, useEffect, useState, useSyncExternalStore } from "react";
import { Machine as PageLayers } from "../gen/app__surface.effect.vibe";
import { type Event as WebsiteEvent, Machine as WebsiteRequests, enabled as websiteEnabled } from "../gen/app__websiteRequests.effect.vibe";
import { type Event, type WorkspaceActor, Machine as Workspaces, enabled } from "../gen/app__workspace.effect.vibe";
import { Keyboard } from "./app.vibe";
import { PageHost } from "./page.vibe";

/** What `application` of app.vibe provides. */
export type Runtime = ManagedRuntime.ManagedRuntime<Workspaces | PageLayers | WebsiteRequests | PageHost | Keyboard, never>;

export const RuntimeContext = createContext<Runtime | null>(null);

export function useRuntime(): Runtime {
  const runtime = use(RuntimeContext);
  if (!runtime) throw new Error("useRuntime outside RuntimeContext");
  return runtime;
}

type Store = { get: () => unknown; subscribe: (notify: () => void) => () => void };
const stores = new WeakMap<Runtime, Map<unknown, Store>>();

/** The latest value of `changes`, shared by every component of `runtime`: one subscription while any listens. */
type Machines = Workspaces | PageLayers | WebsiteRequests | Keyboard;

function storeOf(runtime: Runtime, changes: Stream.Stream<unknown, never, Machines>): Store {
  const known = stores.get(runtime) ?? new Map<unknown, Store>();
  stores.set(runtime, known);
  const existing = known.get(changes);
  if (existing) return existing;
  let latest: unknown;
  let stop: (() => void) | undefined;
  const listeners = new Set<() => void>();
  const store: Store = {
    get: () => latest,
    subscribe: (notify) => {
      listeners.add(notify);
      if (!stop) {
        const fiber = runtime.runFork(Stream.runForEach(changes, (next) => Effect.sync(() => { latest = next; listeners.forEach((listener) => listener()); })));
        stop = () => fiber.interruptUnsafe();
      }
      return () => {
        listeners.delete(notify);
        if (listeners.size === 0) { stop?.(); stop = undefined; }
      };
    },
  };
  known.set(changes, store);
  return store;
}

function useChanges<A>(runtime: Runtime, changes: Stream.Stream<A, never, Machines>): A | undefined {
  const store = storeOf(runtime, changes);
  return useSyncExternalStore(store.subscribe, store.get) as A | undefined;
}

const workspaceChanges = Stream.unwrap(Effect.map(Effect.service(Workspaces), (m) => m.changes));
const layerChanges = Stream.unwrap(Effect.map(Effect.service(PageLayers), (m) => m.changes));
const requestChanges = Stream.unwrap(Effect.map(Effect.service(WebsiteRequests), (m) => m.changes));
const keyboardHeights = Stream.unwrap(Effect.map(Effect.service(Keyboard), (k) => k.height));

/** The workspace, what the rules allow the person, and sending an event; by the person unless the host measured it. */
export function useWorkspace() {
  const runtime = useRuntime();
  const workspace = useChanges(runtime, workspaceChanges);
  return {
    workspace,
    can: (event: Event) => workspace !== undefined && enabled(workspace, event, "Person"),
    send: (event: Event, by: WorkspaceActor = "Person") => runtime.runPromiseExit(Effect.flatMap(Effect.service(Workspaces), (m) => m.send(event, by))),
    /** The workspace as it is now, for an event handler: a render may not have caught up. */
    current: () => runtime.runSync(Effect.flatMap(Effect.service(Workspaces), (m) => m.get())),
    /** The person's Close browser, which the page host also tells what websites asked. */
    closeBrowser: () => runtime.runPromiseExit(Effect.flatMap(Effect.service(PageHost), (host) => host.closeBrowser())),
  };
}

/**
 * What websites ask, what the rules allow the person, and their answer, which the page host tells the page;
 * `said` is what the page wrote with a waiting request.
 */
export function useWebsiteRequests() {
  const runtime = useRuntime();
  const requests = useChanges(runtime, requestChanges);
  return {
    requests,
    can: (event: WebsiteEvent) => requests !== undefined && websiteEnabled(requests, event, "WebsitePerson"),
    send: (event: WebsiteEvent) => runtime.runPromise(Effect.flatMap(Effect.service(PageHost), (host) => host.website(event))),
    /** What websites ask as it is now, for an event handler: a render may not have caught up. */
    current: () => runtime.runSync(Effect.flatMap(Effect.service(WebsiteRequests), (m) => m.get())),
    said: (id: number) => runtime.runSync(Effect.map(Effect.service(PageHost), (host) => host.said.get(id) ?? "")),
  };
}

/** The page layer: the page's rect and the Grace controls drawn over it. */
export function usePageLayer() {
  return useChanges(useRuntime(), layerChanges);
}

/**
 * The text of a field the workspace fills, `value`, and what the person has typed there until they stop `typing`:
 * their keys reach the workspace a moment later, and a field set to the older value meanwhile would drop them.
 */
export function useDraft(value: string, typing: boolean): [string, (text: string) => void] {
  const [typed, setTyped] = useState<string | null>(null);
  useEffect(() => { if (!typing) setTyped(null); }, [typing]);
  return [typed ?? value, setTyped];
}

/** The height of the OS keyboard over the interface, in CSS pixels; 0 while it is closed. */
export function useKeyboardHeight(): number {
  return useChanges(useRuntime(), keyboardHeights) ?? 0;
}

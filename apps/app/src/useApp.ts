// .claude/skills/shell/SKILL.md, "The React interface": the workspace and the page layer, as components read
// them, and the one way a component changes the workspace.
import { Effect, type ManagedRuntime, Stream } from "effect";
import { createContext, use, useEffect, useState } from "react";
import type { Machine as PageLayers } from "../gen/app__surface.effect.vibe";
import { useMachine as usePageLayers } from "../gen/app__surface.react.ts";
import { type Event as WebsiteEvent, Machine as WebsiteRequests } from "../gen/app__websiteRequests.effect.vibe";
import { useMachine as useWebsiteRequestsMachine } from "../gen/app__websiteRequests.react.ts";
import { type Event, type WorkspaceActor, Machine as Workspaces } from "../gen/app__workspace.effect.vibe";
import { useMachine as useWorkspaceMachine } from "../gen/app__workspace.react.ts";
import type { Machine as Setup } from "../gen/app__setup.effect.vibe";
import type { FileLibrary } from "./fileLibrary.vibe";
import type { ManagedReads } from "./managedReads.vibe";
import type { AccountActions } from "./graceAccount.vibe";
import type { ReplyControls } from "./replyControls.vibe";
import type { SpeechActions } from "./graceSpeech.vibe";
import { Keyboard } from "./app.vibe";
import { PageHost } from "./page.vibe";

/** What `application` of app.vibe provides. */
export type Runtime = ManagedRuntime.ManagedRuntime<Workspaces | PageLayers | WebsiteRequests | PageHost | Keyboard | Setup | AccountActions | ManagedReads | FileLibrary | SpeechActions | ReplyControls, never>;

export const RuntimeContext = createContext<Runtime | null>(null);

export function useRuntime(): Runtime {
  const runtime = use(RuntimeContext);
  if (!runtime) throw new Error("useRuntime outside RuntimeContext");
  return runtime;
}

const keyboardHeights = Stream.unwrap(Effect.map(Effect.service(Keyboard), (k) => k.height));

/** The workspace, what the rules allow the person, and sending an event; by the person unless the host measured it. */
export function useWorkspace() {
  const runtime = useRuntime();
  const { state: workspace, can, send } = useWorkspaceMachine(runtime);
  return {
    workspace,
    can: (event: Event) => can(event, "Person"),
    send: (event: Event, by: WorkspaceActor = "Person") => send(event, by),
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
  const { state: requests, can } = useWebsiteRequestsMachine(runtime);
  return {
    requests,
    can: (event: WebsiteEvent) => can(event, "WebsitePerson"),
    send: (event: WebsiteEvent) => runtime.runPromise(Effect.flatMap(Effect.service(PageHost), (host) => host.website(event))),
    /** What websites ask as it is now, for an event handler: a render may not have caught up. */
    current: () => runtime.runSync(Effect.flatMap(Effect.service(WebsiteRequests), (m) => m.get())),
    said: (id: number) => runtime.runSync(Effect.map(Effect.service(PageHost), (host) => host.said.get(id) ?? "")),
  };
}

/** The page layer: the page's rect and the Grace controls drawn over it. */
export function usePageLayer() {
  return usePageLayers(useRuntime()).state;
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
  const runtime = useRuntime();
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const fiber = runtime.runFork(Stream.runForEach(keyboardHeights, (next) => Effect.sync(() => setHeight(next))));
    return () => fiber.interruptUnsafe();
  }, [runtime]);
  return height;
}

// .claude/skills/shell/SKILL.md, "The React interface": the workspace and the page layer, as components read
// them, and the one way a component changes the workspace.
// spec/app/mailboxes.md, "Each account’s state is read from its own mailbox and never stored twice"
import { Effect, type ManagedRuntime, Option, Stream } from "effect";
import { createContext, createElement, type ReactNode, use, useEffect, useState, useSyncExternalStore } from "react";
import { type Event as AccountEvent, Machine as Accounts } from "../gen/app__accounts.effect.vibe";
import { useMachine as useAccountsMachine } from "../gen/app__accounts.react.ts";
import type { Event as CalendarEvent } from "../gen/app__calendarView.effect.vibe";
import { useMachine as useCalendarMachine } from "../gen/app__calendarView.react.ts";
import type { Event as MailEvent } from "../gen/app__email.effect.vibe";
import { useMachine as useMailMachine } from "../gen/app__email.react.ts";
import { type Event as ProposalEvent, Machine as Proposal } from "../gen/app__proposal.effect.vibe";
import { useMachine as useProposalMachine } from "../gen/app__proposal.react.ts";
import type { Machine as PageLayers } from "../gen/app__surface.effect.vibe";
import { useMachine as usePageLayers } from "../gen/app__surface.react.ts";
import { type Event as WebsiteEvent, Machine as WebsiteRequests } from "../gen/app__websiteRequests.effect.vibe";
import { useMachine as useWebsiteRequestsMachine } from "../gen/app__websiteRequests.react.ts";
import { type Event, type WorkspaceActor, Machine as Workspaces } from "../gen/app__workspace.effect.vibe";
import { useMachine as useWorkspaceMachine } from "../gen/app__workspace.react.ts";
import type { Agent } from "./agent.vibe";
import { Keyboard } from "./app.vibe";
import { Conversation, type PersonTurn } from "./conversation.vibe";
import type { Contact } from "./connector.vibe";
import { Instances } from "./instances.vibe";
import { type Board, Mail } from "./mail.vibe";
import { PageHost } from "./page.vibe";

/** What `application` of app.vibe provides. */
export type Runtime = ManagedRuntime.ManagedRuntime<Workspaces | PageLayers | WebsiteRequests | PageHost | Keyboard | Agent | Conversation | Accounts | Proposal | Instances, never>;

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
    /** The person's turn in the conversation, which Grace then answers; false when the rules refuse it. */
    say: (input: PersonTurn) => runtime.runPromise(Effect.flatMap(Effect.service(Conversation), (c) => c.say(input))),
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

export function useAccounts() {
  const { state: accounts, can, send } = useAccountsMachine(useRuntime());
  return { accounts, can: (event: AccountEvent) => can(event, "AccountPerson"), send: (event: AccountEvent) => send(event, "AccountPerson") };
}

export function useProposal() {
  const { state: proposal, can, send } = useProposalMachine(useRuntime());
  return { proposal, can: (event: ProposalEvent) => can(event, "Person"), send: (event: ProposalEvent) => send(event, "Person") };
}

const shelves = new WeakMap<Runtime, Promise<Instances["Service"]>>();

function useInstances() {
  const runtime = useRuntime();
  const known = shelves.get(runtime);
  if (known) return use(known);
  const found = runtime.runPromise(Effect.service(Instances));
  shelves.set(runtime, found);
  return use(found);
}

/** What the connector last read of each account's emails: who, what about, when and the body, which no machine holds. */
export function useMailContent() {
  return useInstances().content;
}

type NestedProps<T> = { ids: readonly number[]; use: (id: number) => T | undefined; children: (all: readonly T[]) => ReactNode };

function Nested<T>({ ids, use, children }: NestedProps<T>): ReactNode {
  const [first, ...rest] = ids;
  return first === undefined ? children([]) : createElement(Level<T>, { key: first, id: first, rest, use, children });
}

function Level<T>({ id, rest, use, children }: Omit<NestedProps<T>, "ids"> & { id: number; rest: readonly number[] }): ReactNode {
  const own = use(id);
  return createElement(Nested<T>, { ids: rest, use, children: (others: readonly T[]) => children(own === undefined ? others : [own, ...others]) });
}

function useMailbox(id: number) {
  const { state, can, send } = useMailMachine(useInstances().mailRuntime(id));
  return state && { id, state, can: (event: MailEvent) => can(event, "MailUser"), send: (event: MailEvent) => send(event, "MailUser") };
}

function useCalendar(key: number) {
  const { state, can, send } = useCalendarMachine(useInstances().calendarRuntime(key));
  return state && { key, state, can: (event: CalendarEvent) => can(event, "ViewUser"), send: (event: CalendarEvent) => send(event, "ViewUser") };
}

export type MailInstance = NonNullable<ReturnType<typeof useMailbox>>;

const silence = () => () => {};
const blank: Board = { note: undefined, undeleted: new Set(), replies: new Map() };
const nothing = () => blank;
const contactLists = new WeakMap<Mail["Service"], Map<string, Promise<readonly Contact[]>>>();

export function useMail() {
  const runtime = useRuntime();
  const mail = Option.getOrUndefined(runtime.runSync(Effect.serviceOption(Mail)));
  const board = useSyncExternalStore(mail?.board.subscribe ?? silence, mail?.board.current ?? nothing);
  return mail && {
    ...board,
    hush: mail.hush,
    nameOf: mail.nameOf,
    reply: (id: number) => runtime.runPromise(mail.reply(id)),
    confirmSend: (id: number, revision: number) => runtime.runPromise(mail.confirmSend(id, revision)),
    moveDraft: (from: number, to: number) => runtime.runPromise(mail.moveDraft(from, to)),
    discarded: () => runtime.runPromise(mail.discarded()),
    contacts: (sources: string) => {
      const lists = contactLists.get(mail) ?? new Map<string, Promise<readonly Contact[]>>();
      contactLists.set(mail, lists);
      const known = lists.get(sources) ?? runtime.runPromise(mail.contacts());
      if (!lists.has(sources)) lists.clear();
      lists.set(sources, known);
      return known;
    },
  };
}

export type MailWriter = NonNullable<ReturnType<typeof useMail>>;
export type CalendarInstance = NonNullable<ReturnType<typeof useCalendar>>;

export function WithMailboxes({ ids, children }: { ids: readonly number[]; children: (boxes: readonly MailInstance[]) => ReactNode }) {
  return createElement(Nested<MailInstance>, { ids, use: useMailbox, children });
}

export function WithCalendars({ keys, children }: { keys: readonly number[]; children: (views: readonly CalendarInstance[]) => ReactNode }) {
  return createElement(Nested<CalendarInstance>, { ids: keys, use: useCalendar, children });
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

// spec/app/mailboxes.md, "Each account’s state is read from its own mailbox and never stored twice"
import { Duration, Effect, type Exit, type ManagedRuntime, Option, Stream } from "effect";
import { createContext, createElement, type ReactNode, use, useMemo, useState, useSyncExternalStore } from "react";
import type { Accounts as AccountsState, Event as AccountEvent } from "../gen/app__accounts.ts";
import { Machine as Accounts } from "../gen/app__accounts.effect.vibe";
import { useMachine as useAccountsMachine } from "../gen/app__accounts.react.ts";
import { type Event as CalendarEvent, Machine as CalendarMachine } from "../gen/app__calendarView.effect.vibe";
import { useMachine as useCalendarMachine } from "../gen/app__calendarView.react.ts";
import type { Event as MailEvent } from "../gen/app__email.effect.vibe";
import type { Files as LibraryFiles, SavedFile } from "../gen/app__files.effect.vibe";
import { Library } from "./files.vibe";
import { GuidedRecovery } from "./guidedRecovery.vibe";
import { useMachine as useMailMachine } from "../gen/app__email.react.ts";
import type { Event as ProposalEvent, Machine as Proposal } from "../gen/app__proposal.effect.vibe";
import { useMachine as useProposalMachine } from "../gen/app__proposal.react.ts";
import { Machine as PageLayers, historyFor } from "../gen/app__surface.effect.vibe";
import type { PageLayer } from "../gen/app__surface.ts";
import type { Machine as MailChoices } from "../gen/app__mailboxes.effect.vibe";
import type { PrivateVerificationApp } from "./surfacePlugin.ts";
import type { HistoryDirection } from "../gen/app__deviceKeys.ts";
import { type Event as WebsiteEvent, Machine as WebsiteRequests } from "../gen/app__websiteRequests.effect.vibe";
import { useMachine as useWebsiteRequestsMachine } from "../gen/app__websiteRequests.react.ts";
import { type Event, type GuidedNameCorrection, type WorkspaceActor, Machine as Workspaces } from "../gen/app__workspace.effect.vibe";
import { enabled, guidanceVisible, type Workspace } from "../gen/app__workspace.ts";
import { type GuidanceKind, guidanceLabel, guidanceMayShow } from "../gen/app__assistant.ts";
import type { Guide, GuidePointing, HomeEmailCardProps, HomeEvent, HomeMail, MailContact, MailPhoto } from "@repo/ui";
import type { Help } from "./context.vibe";
import { Machine as Setup } from "../gen/app__setup.effect.vibe";
import type { Setup as SetupState } from "../gen/app__setup.ts";
import { FileLibrary, type FileHome, type FileSnapshot } from "./fileLibrary.vibe";
import { filesAccount } from "./files.vibe";
import { ManagedReads, type HomeCards, type ManagedSnapshot } from "./managedReads.vibe";
import type { AccountActions } from "./graceAccount.vibe";
import { ReplyControls, type ReplyOffer } from "./replyControls.vibe";
import type { SpeechActions } from "./graceSpeech.vibe";
import { Machine as PasswordView } from "../gen/app.effect.vibe";
import type { PasswordGuide, PasswordView as PasswordViewState } from "../gen/app.ts";
import { Passwords } from "./passwords.vibe";
import { type MailServers, type OtherDetails, SignIns } from "./accounts.vibe";
import type { Agent } from "./agent.vibe";
import { Keyboard } from "./app.vibe";
import { BrowserGuide, type BrowserGuidance } from "./browserGuide.vibe";
import { CalendarNews, dayOf, horizon, midnight, type Opening, openingPlan, relative, settled, timeLabel } from "./calendar.vibe";
import { Conversation, type PersonTurn } from "./conversation.vibe";
import type { Contact, MailContent } from "./connector.vibe";
import { Instances } from "./instances.vibe";
import { type Board, Mail } from "./mail.vibe";
import { PageHost } from "./page.vibe";
import type { NoticeServices } from "./notices.vibe";
import type { EntryDetails } from "../gen/app__calendar.ts";
import { type CalendarSource, type CalRow, shownReminders, tabletKey, upcoming } from "../gen/app__calendars.ts";
import { type HomeMailStatus, type MailSource, type Row as MailRow, homeRows, homeStatus } from "../gen/app__mailboxes.ts";

export type Runtime = ManagedRuntime.ManagedRuntime<Workspaces | PageLayers | WebsiteRequests | PageHost | Keyboard | Setup | AccountActions | ManagedReads | FileLibrary | SpeechActions | PasswordView | Passwords | ReplyControls | Agent | Conversation | BrowserGuide | GuidedRecovery | CalendarNews | Accounts | Proposal | Instances | SignIns | NoticeServices | Library | MailChoices, never>;
type RuntimeEnv = Runtime extends ManagedRuntime.ManagedRuntime<infer Env, never> ? Env : never;

export const RuntimeContext = createContext<Runtime | null>(null);

export function useRuntime(): Runtime {
  const runtime = use(RuntimeContext);
  if (!runtime) throw new Error("useRuntime outside RuntimeContext");
  return runtime;
}

type SubscriptionStore<T> = {
  readonly subscribe: (notify: () => void) => () => void;
  readonly get: () => T;
};

export function shallowEqual<T extends Record<string, unknown>>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key) || !Object.is(a[key], b[key])) return false;
  }
  return true;
}

export function sameArray<T>(a: readonly T[], b: readonly T[]): boolean {
  if (Object.is(a, b)) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false;
  }
  return true;
}

function useStoreSelector<S, T>(
  store: SubscriptionStore<S>,
  select: (state: S) => T,
  equals: (a: T, b: T) => boolean = Object.is,
): T {
  const snapshot = useMemo(() => {
    let has = false;
    let lastState: S;
    let lastValue: T;
    return () => {
      const state = store.get();
      if (has && Object.is(lastState, state)) return lastValue;
      const next = select(state);
      if (has && equals(lastValue, next)) {
        lastState = state;
        return lastValue;
      }
      has = true;
      lastState = state;
      lastValue = next;
      return next;
    };
  }, [store, select, equals]);
  return useSyncExternalStore(store.subscribe, snapshot, snapshot);
}

function createValueStreamStore<S>(
  cache: WeakMap<Runtime, SubscriptionStore<S>>,
  runtime: Runtime,
  initial: S,
  stream: Stream.Stream<S, never, RuntimeEnv>,
): SubscriptionStore<S> {
  const known = cache.get(runtime);
  if (known) return known;
  let seen = initial;
  const listeners = new Set<() => void>();
  let active: object | undefined;
  let stop: (() => void) | undefined;
  const store: SubscriptionStore<S> = {
    get: () => seen,
    subscribe: (notify) => {
      listeners.add(notify);
      if (!active) {
        const token = {};
        active = token;
        const fiber = runtime.runFork(
          Stream.runForEach(
            stream,
            (next) => Effect.sync(() => {
              if (active !== token || Object.is(seen, next)) return;
              seen = next;
              for (const listener of listeners) listener();
            }),
          ),
        );
        stop = () => { fiber.interruptUnsafe(); };
      }
      return () => {
        listeners.delete(notify);
        if (listeners.size === 0) {
          active = undefined;
          stop?.();
          stop = undefined;
        }
      };
    },
  };
  cache.set(runtime, store);
  return store;
}

function createReadStreamStore<S>(
  cache: WeakMap<Runtime, SubscriptionStore<S>>,
  runtime: Runtime,
  read: () => S,
  changes: Stream.Stream<unknown, never, RuntimeEnv>,
): SubscriptionStore<S> {
  const known = cache.get(runtime);
  if (known) return known;
  let initialized = false;
  let seen: S;
  const listeners = new Set<() => void>();
  let active: object | undefined;
  let stop: (() => void) | undefined;
  const refresh = () => {
    const next = read();
    if (initialized && Object.is(seen, next)) return;
    initialized = true;
    seen = next;
    for (const listener of listeners) listener();
  };
  const store: SubscriptionStore<S> = {
    get: () => {
      if (!initialized || !active) {
        seen = read();
        initialized = true;
      }
      return seen;
    },
    subscribe: (notify) => {
      listeners.add(notify);
      if (!active) {
        const token = {};
        active = token;
        seen = read();
        initialized = true;
        const fiber = runtime.runFork(
          Stream.runForEach(
            changes,
            () => Effect.sync(() => {
              if (active !== token) return;
              refresh();
            }),
          ),
        );
        stop = () => { fiber.interruptUnsafe(); };
      }
      return () => {
        listeners.delete(notify);
        if (listeners.size === 0) {
          active = undefined;
          stop?.();
          stop = undefined;
        }
      };
    },
  };
  cache.set(runtime, store);
  return store;
}

const workspaceChanges = Stream.unwrap(Effect.map(Effect.service(Workspaces), (m) => m.changes));
const setupChanges = Stream.unwrap(Effect.map(Effect.service(Setup), (m) => m.changes));
const passwordViewChanges = Stream.unwrap(Effect.map(Effect.service(PasswordView), (m) => m.changes));
const pageLayerChanges = Stream.unwrap(Effect.map(Effect.service(PageLayers), (m) => m.changes));
const accountsChanges = Stream.unwrap(Effect.map(Effect.service(Accounts), (m) => m.changes));
const keyboardHeights = Stream.unwrap(Effect.map(Effect.service(Keyboard), (k) => k.height));
const libraryChanges = Stream.unwrap(Effect.map(Library, (library) => library.changes));
const fileLibraryChanges = Stream.unwrap(Effect.map(FileLibrary, (files) => files.changes));
const fileLibraryHomeChanges = Stream.unwrap(Effect.map(FileLibrary, (files) => files.home));
const managedReadsChanges = Stream.unwrap(Effect.map(ManagedReads, (reads) => reads.state));
const managedHomeChanges = Stream.unwrap(Effect.map(ManagedReads, (reads) => reads.home));
const replyOfferChanges = Stream.unwrap(Effect.map(ReplyControls, (controls) => controls.state));

const workspaceStores = new WeakMap<Runtime, SubscriptionStore<Workspace | undefined>>();
const setupStores = new WeakMap<Runtime, SubscriptionStore<SetupState | undefined>>();
const passwordViewStores = new WeakMap<Runtime, SubscriptionStore<PasswordViewState | undefined>>();
const pageLayerStores = new WeakMap<Runtime, SubscriptionStore<PageLayer | undefined>>();
const accountsStores = new WeakMap<Runtime, SubscriptionStore<AccountsState | undefined>>();
const keyboardStores = new WeakMap<Runtime, SubscriptionStore<number>>();
const filesStores = new WeakMap<Runtime, SubscriptionStore<LibraryFiles>>();
const fileLibraryStores = new WeakMap<Runtime, SubscriptionStore<FileSnapshot>>();
const fileLibraryHomeStores = new WeakMap<Runtime, SubscriptionStore<FileHome | undefined>>();
const managedReadsStores = new WeakMap<Runtime, SubscriptionStore<ManagedSnapshot>>();
const managedHomeStores = new WeakMap<Runtime, SubscriptionStore<HomeCards | undefined>>();
const replyOfferStores = new WeakMap<Runtime, SubscriptionStore<ReplyOffer | undefined>>();
const minuteStores = new WeakMap<Runtime, SubscriptionStore<Date>>();

function workspaceStoreFor(runtime: Runtime) {
  return createValueStreamStore<Workspace | undefined>(workspaceStores, runtime, undefined, workspaceChanges);
}

function setupStoreFor(runtime: Runtime) {
  return createValueStreamStore<SetupState | undefined>(setupStores, runtime, undefined, setupChanges);
}

function passwordViewStoreFor(runtime: Runtime) {
  return createValueStreamStore<PasswordViewState | undefined>(passwordViewStores, runtime, undefined, passwordViewChanges);
}

function pageLayerStoreFor(runtime: Runtime) {
  return createValueStreamStore<PageLayer | undefined>(pageLayerStores, runtime, undefined, pageLayerChanges);
}

function accountsStoreFor(runtime: Runtime) {
  return createValueStreamStore<AccountsState | undefined>(accountsStores, runtime, undefined, accountsChanges);
}

function minuteStoreFor(runtime: Runtime): SubscriptionStore<Date> {
  const known = minuteStores.get(runtime);
  if (known) return known;
  let current = new Date();
  const listeners = new Set<() => void>();
  let stop: (() => void) | undefined;
  const tick = () => {
    current = new Date();
    for (const listener of listeners) listener();
  };
  const store: SubscriptionStore<Date> = {
    get: () => current,
    subscribe: (listener) => {
      listeners.add(listener);
      if (!stop) {
        current = new Date();
        const delay = Math.max(1_000, 60_000 - (current.getTime() % 60_000));
        const fiber = runtime.runFork(
          Effect.flatMap(
            Effect.sleep(Duration.millis(delay)),
            () => Effect.andThen(
              Effect.sync(tick),
              Effect.forever(Effect.flatMap(Effect.sleep(Duration.minutes(1)), () => Effect.sync(tick))),
            ),
          ),
        );
        stop = () => { fiber.interruptUnsafe(); };
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          stop?.();
          stop = undefined;
        }
      };
    },
  };
  minuteStores.set(runtime, store);
  return store;
}

export function useMinute(): Date {
  const store = minuteStoreFor(useRuntime());
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

const selectToday = (now: Date) => dayOf(now.getTime());

export function useToday(): number {
  return useStoreSelector(minuteStoreFor(useRuntime()), selectToday);
}

export function useWorkspaceSelector<T>(
  select: (workspace: Workspace | undefined) => T,
  equals: (a: T, b: T) => boolean = Object.is,
): T {
  return useStoreSelector(workspaceStoreFor(useRuntime()), select, equals);
}

export function useSetupSelector<T>(
  select: (setup: SetupState | undefined) => T,
  equals: (a: T, b: T) => boolean = Object.is,
): T {
  return useStoreSelector(setupStoreFor(useRuntime()), select, equals);
}

export function usePageLayerSelector<T>(
  select: (layer: PageLayer | undefined) => T,
  equals: (a: T, b: T) => boolean = Object.is,
): T {
  return useStoreSelector(pageLayerStoreFor(useRuntime()), select, equals);
}

export function useAccountsSelector<T>(
  select: (accounts: AccountsState | undefined) => T,
  equals: (a: T, b: T) => boolean = Object.is,
): T {
  return useStoreSelector(accountsStoreFor(useRuntime()), select, equals);
}

const emptyIds: readonly number[] = [];
const selectAccountIds = (accounts: AccountsState | undefined): readonly number[] =>
  accounts ? accounts.accounts.map((a) => a.id) : emptyIds;
const selectCalendarKeys = (accounts: AccountsState | undefined): readonly number[] =>
  accounts ? [tabletKey, ...accounts.accounts.map((a) => a.id)] : emptyIds;

export function useAccountIds(): readonly number[] {
  return useAccountsSelector(selectAccountIds, sameArray);
}

export function useCalendarKeys(): readonly number[] {
  return useAccountsSelector(selectCalendarKeys, sameArray);
}

type PasswordGuideSlice = { readonly guide: PasswordGuide | undefined; readonly mic: PasswordViewState["guideMic"] | undefined };
const selectPasswordGuide = (state: PasswordViewState | undefined): PasswordGuideSlice => ({
  guide: state?.guide,
  mic: state?.guideMic,
});

const passwordRequests = new WeakMap<Runtime, (revision: number) => Promise<boolean>>();

export function usePasswordGuide() {
  const runtime = useRuntime();
  const { guide, mic } = useStoreSelector(passwordViewStoreFor(runtime), selectPasswordGuide, shallowEqual);
  let request = passwordRequests.get(runtime);
  if (!request) {
    request = (revision: number) => runtime.runPromise(Effect.flatMap(Effect.service(Passwords), (service) => service.guideTyped(revision)));
    passwordRequests.set(runtime, request);
  }
  return useMemo(() => ({ guide, mic, request }), [guide, mic, request]);
}

const pointings: Record<GuidanceKind, GuidePointing["kind"]> = { Look: "point", Tap: "instruction", Done: "confirm" };
const compact = { type: "interact", input: { tag: "Resize", expanded: false } } as const;
const askedForHelp = { type: "interact", input: { tag: "HostTurn", turnOrigin: "AskedForHelp" } } as const;

export function guideOn<Target extends string>(workspace: Workspace | undefined, idOf: (target: string) => Target | undefined, onClose?: () => void): Guide<Target> | undefined {
  if (workspace === undefined || !guidanceVisible(workspace) || !guidanceMayShow(workspace.assistant)) return undefined;
  const { assistant } = workspace;
  const targetId = idOf(assistant.guidance.target);
  if (targetId === undefined) return undefined;
  return { targetId, kind: pointings[assistant.guidance.kind], title: assistant.guidance.kind === "Look" ? undefined : guidanceLabel(assistant), onClose };
}

type WorkspaceActions = {
  readonly send: (event: Event, by?: WorkspaceActor) => Promise<Exit.Exit<unknown, unknown>>;
  readonly help: (need: Help) => Promise<void>;
  readonly current: () => Workspace;
  readonly say: (input: PersonTurn) => Promise<boolean>;
  readonly startReadReview: (revision: number) => Promise<boolean>;
  readonly resumeReadPlan: () => Promise<boolean>;
  readonly checkGuidedRead: () => ReturnType<Conversation["Service"]["checkGuidedRead"]> extends Effect.Effect<infer A, unknown, unknown> ? Promise<A> : never;
  readonly pointAtReadLink: (onMenu: (guidance: BrowserGuidance) => void) => Promise<BrowserGuidance>;
  readonly confirmGuidedName: (correction: GuidedNameCorrection) => Promise<boolean>;
  readonly privateHistory: (tab: number) => ReturnType<typeof historyFor>;
  readonly stepPrivate: (tab: number, direction: HistoryDirection) => Promise<boolean>;
  readonly navigatePrivate: (tab: number, address: string) => Promise<boolean>;
  readonly openPrivateVerificationApp: (tab: number, revision: number, app: PrivateVerificationApp) => ReturnType<PageHost["Service"]["openPrivateVerificationApp"]> extends Effect.Effect<infer A, unknown, unknown> ? Promise<A> : never;
  readonly opensWebsites: boolean;
  readonly closeBrowser: () => Promise<unknown>;
};

const workspaceActionCache = new WeakMap<Runtime, WorkspaceActions>();

export function workspaceActionsFor(runtime: Runtime): WorkspaceActions {
  const known = workspaceActionCache.get(runtime);
  if (known) return known;
  const current = () => runtime.runSync(Effect.flatMap(Effect.service(Workspaces), (m) => m.get()));
  const sendRaw = (event: Event, by: WorkspaceActor) =>
    runtime.runPromiseExit(Workspaces.use((machine) => machine.send(event, by)));
  const send = async (event: Event, by: WorkspaceActor = "Person") => {
    if (event.type === "openGrace") await runtime.runPromise(Effect.flatMap(Effect.service(GuidedRecovery), (r) => r.beforeOpen()));
    if (event.type === "abandonTask" && by === "Person") {
      const workspace = current();
      const fence = { task: workspace.assistant.taskId, version: workspace.assistant.workVersion };
      return runtime.runPromiseExit(Effect.flatMap(Effect.service(GuidedRecovery), (r) => r.abandon(fence)));
    }
    return sendRaw(event, by);
  };
  const help = async (need: Help) => {
    for (const event of [{ type: "openGrace" }, compact] as const)
      if (enabled(current(), event, "Person")) await send(event);
    await runtime.runPromise(Effect.flatMap(Effect.service(Conversation), (c) => c.help(need)));
  };
  const actions: WorkspaceActions = {
    send,
    help,
    current,
    say: (input: PersonTurn) => runtime.runPromise(Effect.flatMap(Effect.service(Conversation), (c) => c.say(input))),
    startReadReview: (revision: number) => runtime.runPromise(Effect.flatMap(Effect.service(Conversation), (c) => c.startReadReview(revision))),
    resumeReadPlan: () => runtime.runPromise(Effect.flatMap(Effect.service(Conversation), (c) => c.resumeReadPlan())),
    checkGuidedRead: () => runtime.runPromise(Effect.flatMap(Effect.service(Conversation), (c) => c.checkGuidedRead())),
    pointAtReadLink: (onMenu: (guidance: BrowserGuidance) => void) => runtime.runPromise(Effect.flatMap(Effect.service(BrowserGuide), (guide) => guide.point(onMenu))),
    confirmGuidedName: (correction: GuidedNameCorrection) => runtime.runPromise(correction.witness.tag === "LocatedSortCategory"
      ? Effect.flatMap(Effect.service(Conversation), (conversation) => conversation.confirmSortName(correction))
      : Effect.flatMap(Effect.service(BrowserGuide), (guide) => guide.confirmName(correction))),
    privateHistory: (tab: number) => runtime.runSync(Effect.flatMap(Effect.service(PageLayers), (layer) => Effect.map(layer.get(), (state) => historyFor(state, tab)))),
    stepPrivate: (tab: number, direction: HistoryDirection) => runtime.runPromise(Effect.flatMap(Effect.service(PageHost), (host) => host.stepPrivate(tab, direction))),
    navigatePrivate: (tab: number, address: string) => runtime.runPromise(Effect.flatMap(Effect.service(PageHost), (host) => host.navigatePrivate(tab, address))),
    openPrivateVerificationApp: (tab: number, revision: number, app: PrivateVerificationApp) => runtime.runPromise(Effect.flatMap(Effect.service(PageHost), (host) => host.openPrivateVerificationApp(tab, revision, app))),
    opensWebsites: runtime.runSync(Effect.map(Effect.service(PageHost), (host) => host.opensWebsites)),
    closeBrowser: () => runtime.runPromiseExit(Effect.flatMap(Effect.service(PageHost), (host) => host.closeBrowser())),
  };
  workspaceActionCache.set(runtime, actions);
  return actions;
}

export function useWorkspaceActions(): WorkspaceActions {
  return workspaceActionsFor(useRuntime());
}

export function useWorkspace() {
  const runtime = useRuntime();
  const store = workspaceStoreFor(runtime);
  const workspace = useSyncExternalStore(store.subscribe, store.get, store.get);
  const actions = workspaceActionsFor(runtime);
  return useMemo(() => {
    const can = (event: Event) => workspace !== undefined && enabled(workspace, event, "Person");
    const offer = (event: Event) => can(event) ? () => void actions.send(event, "Person") : undefined;
    return {
      workspace,
      can,
      send: actions.send,
      guide: <Target extends string>(idOf: (target: string) => Target | undefined) =>
        guideOn(workspace, idOf, workspace && offer({ type: "interact", input: { tag: "DismissGuidance", revision: workspace.assistant.guidance.revision } })),
      askGrace: (need: Help) => can({ type: "openGrace" }) || can(compact) || can(askedForHelp) ? () => void actions.help(need) : undefined,
      current: actions.current,
      say: actions.say,
      startReadReview: actions.startReadReview,
      resumeReadPlan: actions.resumeReadPlan,
      checkGuidedRead: actions.checkGuidedRead,
      pointAtReadLink: actions.pointAtReadLink,
      confirmGuidedName: actions.confirmGuidedName,
      privateHistory: actions.privateHistory,
      stepPrivate: actions.stepPrivate,
      navigatePrivate: actions.navigatePrivate,
      openPrivateVerificationApp: actions.openPrivateVerificationApp,
      opensWebsites: actions.opensWebsites,
      closeBrowser: actions.closeBrowser,
    };
  }, [workspace, actions]);
}

type WebsiteRequestActions = {
  readonly send: (event: WebsiteEvent) => Promise<void>;
  readonly current: () => ReturnType<WebsiteRequests["Service"]["get"]> extends Effect.Effect<infer A, unknown, unknown> ? A : never;
  readonly said: (id: number) => string;
};

const websiteActionCache = new WeakMap<Runtime, WebsiteRequestActions>();

export function websiteRequestActionsFor(runtime: Runtime): WebsiteRequestActions {
  const known = websiteActionCache.get(runtime);
  if (known) return known;
  const host = runtime.runSync(Effect.service(PageHost));
  const actions: WebsiteRequestActions = {
    send: (event: WebsiteEvent) => runtime.runPromise(host.website(event)),
    current: () => runtime.runSync(Effect.flatMap(Effect.service(WebsiteRequests), (m) => m.get())),
    said: (id: number) => host.said.get(id) ?? "",
  };
  websiteActionCache.set(runtime, actions);
  return actions;
}

export function useWebsiteRequests() {
  const runtime = useRuntime();
  const { state: requests, can } = useWebsiteRequestsMachine(runtime);
  const actions = websiteRequestActionsFor(runtime);
  return useMemo(() => ({
    requests,
    can: (event: WebsiteEvent) => can(event, "WebsitePerson"),
    send: actions.send,
    current: actions.current,
    said: actions.said,
  }), [requests, can, actions]);
}

export function useAccounts() {
  const { state: accounts, can, send } = useAccountsMachine(useRuntime());
  return useMemo(() => ({
    accounts,
    can: (event: AccountEvent) => can(event, "AccountPerson"),
    send: (event: AccountEvent) => send(event, "AccountPerson"),
  }), [accounts, can, send]);
}

const signInsCache = new WeakMap<Runtime, SignIns["Service"]>();

export function useSignIns() {
  const runtime = useRuntime();
  let flows = signInsCache.get(runtime);
  if (!flows) {
    flows = runtime.runSync(Effect.service(SignIns));
    signInsCache.set(runtime, flows);
  }
  const note = useSyncExternalStore(flows.notes.subscribe, flows.notes.current);
  const page = useSyncExternalStore(flows.page.subscribe, flows.page.current);
  return useMemo(() => ({
    note,
    page,
    other: (details: OtherDetails) => runtime.runPromise(flows.other(details)),
    servers: (servers: MailServers) => runtime.runPromise(flows.servers(servers)),
  }), [runtime, flows, note, page]);
}

export function useProposal() {
  const { state: proposal, can, send } = useProposalMachine(useRuntime());
  return useMemo(() => ({
    proposal,
    can: (event: ProposalEvent) => can(event, "Person"),
    send: (event: ProposalEvent) => send(event, "Person"),
  }), [proposal, can, send]);
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

export function useMailContent() {
  return useInstances().content;
}

export function useMailFile() {
  return useInstances().file;
}

export function useMailHeld() {
  return useInstances().held;
}

export function useFiles(): LibraryFiles {
  const runtime = useRuntime();
  const store = createReadStreamStore(
    filesStores,
    runtime,
    () => runtime.runSync(Effect.flatMap(Library, (library) => library.get())),
    libraryChanges,
  );
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export function useFileLibrarySnapshot(): FileSnapshot {
  const runtime = useRuntime();
  const store = createReadStreamStore(
    fileLibraryStores,
    runtime,
    () => runtime.runSync(Effect.flatMap(FileLibrary, (files) => files.get())),
    fileLibraryChanges,
  );
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export function useFileLibraryHomeSnapshot(): FileHome | undefined {
  const runtime = useRuntime();
  const store = createReadStreamStore(
    fileLibraryHomeStores,
    runtime,
    () => runtime.runSync(Effect.flatMap(FileLibrary, (files) => files.getHome())),
    fileLibraryHomeChanges,
  );
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export function useManagedReadsSnapshot(): ManagedSnapshot {
  const runtime = useRuntime();
  const store = createReadStreamStore(
    managedReadsStores,
    runtime,
    () => runtime.runSync(Effect.flatMap(ManagedReads, (reads) => reads.get())),
    managedReadsChanges,
  );
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export function useManagedHomeCardsSnapshot(): HomeCards | undefined {
  const runtime = useRuntime();
  const store = createReadStreamStore(
    managedHomeStores,
    runtime,
    () => runtime.runSync(Effect.flatMap(ManagedReads, (managed) => managed.homeCards())),
    managedHomeChanges,
  );
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export function useReplyControlsSnapshot(): ReplyOffer | undefined {
  const runtime = useRuntime();
  const store = createReadStreamStore(
    replyOfferStores,
    runtime,
    () => runtime.runSync(Effect.flatMap(ReplyControls, (controls) => controls.get())),
    replyOfferChanges,
  );
  return useSyncExternalStore(store.subscribe, store.get, store.get);
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
  return useMemo(() => state && {
    id,
    state,
    can: (event: MailEvent) => can(event, "MailUser"),
    send: (event: MailEvent) => send(event, "MailUser"),
  }, [id, state, can, send]);
}

function useCalendar(key: number) {
  const runtime = useInstances().calendarRuntime(key);
  const { state, can, send } = useCalendarMachine(runtime);
  return useMemo(() => state && {
    key,
    state,
    can: (event: CalendarEvent) => can(event, "ViewUser"),
    send: (event: CalendarEvent) => send(event, "ViewUser"),
    settled: (id: string) => runtime.runPromise(Effect.flatMap(Effect.service(CalendarMachine), (box) => settled(box, id))),
    current: () => runtime.runPromise(Effect.flatMap(Effect.service(CalendarMachine), (box) => box.get())),
  }, [key, runtime, state, can, send]);
}

export type MailInstance = NonNullable<ReturnType<typeof useMailbox>>;

const silence = () => () => {};
const blank: Board = { note: undefined, undeleted: new Set(), replies: new Map(), unsaved: new Set() };
const nothing = () => blank;
const contactLists = new WeakMap<Mail["Service"], Map<string, Promise<readonly Contact[]>>>();

type MailActions = {
  readonly service: Mail["Service"];
  readonly hush: Mail["Service"]["hush"];
  readonly nameOf: Mail["Service"]["nameOf"];
  readonly reply: (id: number) => Promise<void>;
  readonly confirmSend: (id: number, revision: number) => Promise<void>;
  readonly moveDraft: (from: number, to: number) => Promise<void>;
  readonly save: (id: number, refs: readonly string[]) => Promise<void>;
  readonly attach: (id: number, asset: SavedFile) => Promise<boolean>;
  readonly camera: Mail["Service"]["camera"];
  readonly capture: (id: number) => Promise<boolean>;
  readonly contacts: (sources: string) => Promise<readonly Contact[]>;
};

const mailServiceCache = new WeakMap<Runtime, MailActions | null>();

function mailActionsFor(runtime: Runtime): MailActions | undefined {
  const known = mailServiceCache.get(runtime);
  if (known !== undefined) return known ?? undefined;
  const mail = Option.getOrUndefined(runtime.runSync(Effect.serviceOption(Mail)));
  if (!mail) {
    mailServiceCache.set(runtime, null);
    return undefined;
  }
  const actions: MailActions = {
    service: mail,
    hush: mail.hush,
    nameOf: mail.nameOf,
    reply: (id: number) => runtime.runPromise(mail.reply(id)),
    confirmSend: (id: number, revision: number) => runtime.runPromise(mail.confirmSend(id, revision)),
    moveDraft: (from: number, to: number) => runtime.runPromise(mail.moveDraft(from, to)),
    save: (id: number, refs: readonly string[]) => runtime.runPromise(mail.save(id, refs)),
    attach: (id: number, asset: SavedFile) => runtime.runPromise(mail.attach(id, asset)),
    camera: mail.camera,
    capture: (id: number) => runtime.runPromise(mail.capture(id)),
    contacts: (sources: string) => {
      const lists = contactLists.get(mail) ?? new Map<string, Promise<readonly Contact[]>>();
      contactLists.set(mail, lists);
      const knownList = lists.get(sources) ?? runtime.runPromise(mail.contacts());
      if (!lists.has(sources)) lists.clear();
      lists.set(sources, knownList);
      return knownList;
    },
  };
  mailServiceCache.set(runtime, actions);
  return actions;
}

export function useMail() {
  const runtime = useRuntime();
  const actions = mailActionsFor(runtime);
  const mail = actions?.service;
  const board = useSyncExternalStore(mail?.board.subscribe ?? silence, mail?.board.current ?? nothing);
  return useMemo(() => actions && {
    ...board,
    hush: actions.hush,
    nameOf: actions.nameOf,
    reply: actions.reply,
    confirmSend: actions.confirmSend,
    moveDraft: actions.moveDraft,
    save: actions.save,
    attach: actions.attach,
    camera: actions.camera,
    capture: actions.capture,
    contacts: actions.contacts,
  }, [actions, board]);
}

const unnoted = () => undefined;
const calendarNewsCache = new WeakMap<Runtime, CalendarNews["Service"] | null>();

export function calendarNewsFor(runtime: Runtime): CalendarNews["Service"] | undefined {
  const known = calendarNewsCache.get(runtime);
  if (known !== undefined) return known ?? undefined;
  const news = Option.getOrUndefined(runtime.runSync(Effect.serviceOption(CalendarNews)));
  calendarNewsCache.set(runtime, news ?? null);
  return news;
}

export function useCalendarNote() {
  const news = calendarNewsFor(useRuntime());
  return useSyncExternalStore(news?.notes.subscribe ?? silence, news?.notes.current ?? unnoted);
}

export function useRecoveredCalendarDrafts() {
  const news = calendarNewsFor(useRuntime());
  return useSyncExternalStore(news?.recoveredDrafts.subscribe ?? silence, news?.recoveredDrafts.current ?? unnoted);
}

export type MailWriter = NonNullable<ReturnType<typeof useMail>>;
export type CalendarInstance = NonNullable<ReturnType<typeof useCalendar>>;

export function WithMailboxes({ ids, children }: { ids: readonly number[]; children: (boxes: readonly MailInstance[]) => ReactNode }) {
  return createElement(Nested<MailInstance>, { ids, use: useMailbox, children });
}

export function WithCalendars({ keys, children }: { keys: readonly number[]; children: (views: readonly CalendarInstance[]) => ReactNode }) {
  return createElement(Nested<CalendarInstance>, { ids: keys, use: useCalendar, children });
}

export function usePageLayer() {
  const store = pageLayerStoreFor(useRuntime());
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export function useDraft(value: string, typing: boolean): [string, (text: string) => void] {
  const [typed, setTyped] = useState<string | null>(null);
  const [wasTyping, setWasTyping] = useState(typing);
  if (typing !== wasTyping) {
    setWasTyping(typing);
    if (!typing && typed !== null) setTyped(null);
  }
  return [typed ?? value, setTyped];
}

export function useKeyboardHeight(): number {
  const runtime = useRuntime();
  const store = createValueStreamStore<number>(keyboardStores, runtime, 0, keyboardHeights);
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

const selectFilesAccount = (setup: SetupState | undefined) => filesAccount(setup?.graceAccount);

export function useFilesHome(): FileHome | undefined {
  const account = useSetupSelector(selectFilesAccount);
  const home = useFileLibraryHomeSnapshot();
  return account !== undefined ? home : undefined;
}

export type CalendarActions = {
  readonly open: (key: number, id: string, how: Opening) => void;
  readonly edit: (key: number, id: string) => void;
  readonly add: (day: number) => void;
  readonly reminderAt: CalendarNews["Service"]["reminderAt"];
};

const calendarActionsCache = new WeakMap<Runtime, CalendarActions | null>();

export function useCalendarActions(): CalendarActions | undefined {
  const runtime = useRuntime();
  const known = calendarActionsCache.get(runtime);
  if (known !== undefined) return known ?? undefined;
  const news = calendarNewsFor(runtime);
  if (!news) {
    calendarActionsCache.set(runtime, null);
    return undefined;
  }
  const actions: CalendarActions = {
    open: (key: number, id: string, how: Opening) => void runtime.runPromise(news.open(key, id, how)),
    edit: (key: number, id: string) => void runtime.runPromise(news.edit(key, id)),
    add: (day: number) => void runtime.runPromise(news.add(day)),
    reminderAt: news.reminderAt,
  };
  calendarActionsCache.set(runtime, actions);
  return actions;
}

export type HomeReminderNotice = { title: string; line: string; toast: string; seeDetails: boolean; dismiss: boolean };
export type HomeReminders = (subject: string) => HomeReminderNotice | undefined;

const homeWeekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const byStart = (a: CalRow, b: CalRow) => a.details.startAt - b.details.startAt;
const shortDay = (n: number, today: number) => (n === today ? "Today" : homeWeekdays[(new Date(midnight(n)).getDay() + 6) % 7]);
const whoWhere = (d: EntryDetails) => (d.participant ? [d.participant, d.location.split(" · ")[0]].filter(Boolean).join(" · ") : d.location);
const calendarSourcesOf = (views: readonly CalendarInstance[]): CalendarSource[] => views.map((v) => ({ key: v.key, view: v.state }));

function opensOccurrence(views: readonly CalendarInstance[], r: CalRow, how: Opening) {
  const lead = views.find((v) => v.key === tabletKey);
  const box = views.find((v) => v.key === r.key);
  return !!lead && !!box && openingPlan(lead.state, box.state, lead === box, dayOf(r.details.startAt), how, r.identity.occurrenceId) !== undefined;
}

export function homeCalendar(registry: AccountsState, views: readonly CalendarInstance[], now: number, actions: CalendarActions | undefined): { events: HomeEvent[]; status: string } {
  const today = dayOf(now);
  const sources = calendarSourcesOf(views);
  const events = upcoming(registry, sources, now, now + horizon).sort(byStart).slice(0, 3).map((r) => ({
    id: `${r.key}/${r.identity.occurrenceId}`,
    weekday: shortDay(dayOf(r.details.startAt), today).toUpperCase(),
    time: timeLabel(r.details.startAt),
    title: r.details.title,
    detail: whoWhere(r.details) || undefined,
    next: r.details.important,
    onClick: actions && opensOccurrence(views, r, "Occurrence")
      ? (e: { stopPropagation: () => void }) => { e.stopPropagation(); actions.open(r.key, r.identity.occurrenceId, "Occurrence"); }
      : undefined,
  }));
  return { events, status: upcoming(registry, sources, midnight(today), midnight(today + 1)).length > 0 ? "Today" : "Nothing else today" };
}

export function reminderNotice(registry: AccountsState, views: readonly CalendarInstance[], now: number, actions: CalendarActions | undefined, visiting: boolean): HomeReminders {
  const due = shownReminders(registry, calendarSourcesOf(views));
  const today = dayOf(now);
  return (subject: string): HomeReminderNotice | undefined => {
    const shown = actions?.reminderAt(subject);
    const r = shown && due.find((c) => c.key === shown.key && c.identity.occurrenceId === shown.id);
    const box = r && views.find((v) => v.key === r.key);
    if (!r || !box) return undefined;
    const d = r.details;
    const day = relative(dayOf(d.startAt), today);
    const at = ` at ${timeLabel(d.startAt)}`;
    return {
      title: d.title,
      line: [day + at, d.location.split(" · ")[0]].filter(Boolean).join(" · "),
      toast: `${d.title} ${day === "Today" || day === "Tomorrow" ? day.toLowerCase() : day}${at}`,
      seeDetails: visiting && opensOccurrence(views, r, "Reminder"),
      dismiss: box.can({ type: "changeOccurrence", id: r.identity.occurrenceId, command: { tag: "DismissReminder" } }),
    };
  };
}

export function nextAppointment(registry: AccountsState, views: readonly CalendarInstance[], now: number): string | undefined {
  const [next] = upcoming(registry, calendarSourcesOf(views), now, now + horizon).sort(byStart);
  return next && `${relative(dayOf(next.details.startAt), dayOf(now))}: ${next.details.title}, ${timeLabel(next.details.startAt)}`;
}

const mailTones = [1, 2, 3, 4, 5, 6] as const;
const toneOf = (key: string) => mailTones[[...key.trim().toLowerCase()].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 9973, 0) % mailTones.length];
const mailContact = (name: string, address: string): MailContact => ({ name, tone: toneOf(address || name) });
const homeStatuses = (status: HomeMailStatus): Pick<HomeEmailCardProps, "status" | "waiting" | "notConnected"> => {
  switch (status.tag) {
    case "NotConnected": return { notConnected: true };
    case "WaitingForInternet": return { status: "Waiting for the internet", waiting: "New email will arrive when you’re back online." };
    case "NewCount": return { status: `${status.count} new` };
    case "NoNew": return { status: "No new email" };
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
};

export function homeMail(
  registry: AccountsState,
  boxes: readonly MailInstance[],
  read: (id: number, ref: string) => MailContent | undefined,
  online: boolean,
): Pick<HomeEmailCardProps, "messages" | "status" | "waiting" | "notConnected"> {
  const sources: MailSource[] = boxes.map((b) => ({ account: b.id, mailbox: b.state }));
  const newest = (a: MailRow, b: MailRow) =>
    (read(b.account, b.record.identity.ref)?.receivedAt ?? 0) - (read(a.account, a.record.identity.ref)?.receivedAt ?? 0);
  const messages: HomeMail[] = homeRows(registry, sources).toSorted(newest).slice(0, 2).map((r) => {
    const c = read(r.account, r.record.identity.ref);
    return { id: `${r.account}/${r.record.identity.ref}`, ...mailContact(c?.from ?? "", c?.fromAddress ?? ""), subject: c?.subject ?? "", unread: r.record.unread };
  });
  return { messages, ...homeStatuses(homeStatus(registry, sources, online)) };
}

const escapedSvg = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const thumbnailCache = new Map<string, MailPhoto>();

export function mailThumbnail(file: Pick<SavedFile, "id" | "kind" | "name">): MailPhoto {
  const key = `${file.kind}|${file.id}|${file.name}`;
  const cached = thumbnailCache.get(key);
  if (cached) return cached;
  const label = file.kind === "Pdf" ? "PDF" : "Photo";
  const drawn = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 110"><desc>${escapedSvg(file.id)}</desc><rect width="150" height="110" fill="white"/><text x="75" y="50" text-anchor="middle" font-family="sans-serif" font-size="22" font-weight="700">${label}</text><text x="75" y="78" text-anchor="middle" font-family="sans-serif" font-size="13">${escapedSvg(file.name)}</text></svg>`;
  const photo: MailPhoto = { src: `data:image/svg+xml,${encodeURIComponent(drawn)}`, alt: file.name };
  if (thumbnailCache.size > 200) thumbnailCache.clear();
  thumbnailCache.set(key, photo);
  return photo;
}

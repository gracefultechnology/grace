// spec/app/index.md, "Story: Manage my saved passwords privately"
// spec/app/shell.md, "Story: Reach everyday tasks from Home"; spec/app/mailboxes.md, "Story: See all my email in one place"; spec/app/calendars.md, "Home and the sleep screen show the next saved appointments"; spec/app/workspace.md, "Home, native controls and Close have explicit interruption semantics"; spec/app/deviceKeys.md, "Story: Step back inside Grace before leaving"
import { AppWindow, AskGraceButton, besideRail, Button, HomeScreen, ListRow, Rail, RailButton, RailPopover, SleepScreen, Slider, Spinner, TextScale, WifiSlash, cn } from "@repo/ui";
import { Effect, ManagedRuntime } from "effect";
import { CalendarDays, House, KeyRound, Mail, Settings as Gear, Volume2, VolumeX, Wifi } from "lucide-react";
import { type ReactNode, Suspense, useCallback, useMemo, useState } from "react";
import { agentPlugin } from "./agentPlugin.ts";
import { application } from "./app.vibe";
import { Browser } from "./Browser.tsx";
import { Calendar } from "./Calendar.tsx";
import { Email } from "./Email.tsx";
import { Files } from "./Files.tsx";
import { ManagedRead } from "./ManagedRead.tsx";
import { PasswordsApp } from "./PasswordsApp.tsx";
import { Settings } from "./Settings.tsx";
import { devicePlugin, passwordClient, wifiPlugin } from "./surfacePlugin.ts";
import { type BackAction, backAction, declineChoice } from "../gen/app__deviceKeys.ts";
import { muteChoice, textScalePercent, volumeChoice } from "../gen/app__preferences.ts";
import type { Setup } from "../gen/app__setup.ts";
import type { Connectivity, RailPopover as Popover, Surface } from "../gen/app__shell.ts";
import { type Event as WebsiteEvent, type WebsiteRequests, presented } from "../gen/app__websiteRequests.ts";
import { canChangeLifecycle, enabled, privateSurfaceActive, type Event as WorkspaceEvent, type Workspace } from "../gen/app__workspace.ts";
import { dayOf, relative, timeLabel } from "./calendar.vibe";
import { type HomeCards, ManagedReads, surfaceOwner } from "./managedReads.vibe";
import { Grace } from "./Grace.tsx";
import { NoticeBanner, Notices } from "./Notices.tsx";
import { OverPage, PageBackdrop, PageMeasurer } from "./PageLayer.tsx";
import {
  RuntimeContext,
  type Runtime,
  homeCalendar,
  homeMail,
  nextAppointment,
  reminderNotice,
  shallowEqual,
  useAccountIds,
  useAccounts,
  useCalendarActions,
  useCalendarKeys,
  useFilesHome,
  useKeyboardHeight,
  useMailContent,
  useManagedHomeCardsSnapshot,
  useMinute,
  useRuntime,
  useSetupSelector,
  useToday,
  useWorkspaceActions,
  useWorkspaceSelector,
  websiteRequestActionsFor,
  WithCalendars,
  WithMailboxes,
  workspaceActionsFor,
} from "./useApp.ts";

// spec/app/deviceKeys.md, "Each Back action is one event its guard allows"
const websiteBackEvents: Record<"CancelClearData" | "DismissWebsiteRequest", (r: WebsiteRequests) => WebsiteEvent> = {
  CancelClearData: () => ({ type: "answerClearBrowsingData", confirmed: false }),
  DismissWebsiteRequest: (r) => ({ type: "answer", id: presented(r).id, choice: declineChoice(presented(r).ask) }),
};

const backEvents: Record<Exclude<BackAction, "Unconsumed" | "PrivatePageBack" | keyof typeof websiteBackEvents>, WorkspaceEvent> = {
  DismissPopover: { type: "dismissPopover" },
  DismissAddress: { type: "changePage", browserInput: { tag: "DismissAddress" } },
  DismissKeyboard: { type: "interact", input: { tag: "DismissKeyboard" } },
  CollapseGrace: { type: "interact", input: { tag: "Resize", expanded: false } },
  PageBack: { type: "changePage", browserInput: { tag: "Back" } },
  GoHome: { type: "visit", destination: "Home" },
  ShowMainCards: { type: "chooseHomePage", page: "MainCards" },
};

const lifted = "absolute top-1.5 right-1.5";
const appointmentClock = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });
const appointmentDay = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const railClock = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const railDate = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });
const sleepDate = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });

const startOf = (event: HomeCards["events"][number]) => new Date(event.isAllDay && event.startAt.length === 10 ? event.startAt + "T12:00:00" : event.startAt);
const managedNext = (cards: HomeCards | undefined, now: Date) => {
  const next = cards?.events[0];
  return next && `${relative(dayOf(startOf(next).getTime()), dayOf(now.getTime()))}: ${next.title || "Untitled appointment"}, ${next.isAllDay ? "All day" : timeLabel(startOf(next).getTime())}`;
};

const under = (covered: boolean) => (covered ? { inert: true, "aria-hidden": true } as const : {});
const tile = { size: 28, strokeWidth: 1.9 };
const wifiWords: Record<Connectivity, string> = {
  Offline: "Not connected", Scanning: "Looking for networks", NoNetworks: "No networks found", Connecting: "Connecting",
  Online: "Connected", CaptivePortal: "Needs sign-in", WrongPassword: "Wrong password", ConnectionFailed: "Couldn't connect",
};

const visitHome: WorkspaceEvent = { type: "visit", destination: "Home" };
const visitCalendar: WorkspaceEvent = { type: "visit", destination: "Calendar" };
const visitEmail: WorkspaceEvent = { type: "visit", destination: "Email" };
const visitBrowser: WorkspaceEvent = { type: "visit", destination: "Browser" };
const visitFiles: WorkspaceEvent = { type: "visit", destination: "Files" };
const visitPasswords: WorkspaceEvent = { type: "visit", destination: "Passwords" };
const visitSettings: WorkspaceEvent = { type: "visit", destination: "DeviceSettings" };
const openGraceEvent: WorkspaceEvent = { type: "openGrace" };
const toggleWifiEvent: WorkspaceEvent = { type: "togglePopover", popover: "WifiPopover" };
const toggleVolumeEvent: WorkspaceEvent = { type: "togglePopover", popover: "VolumePopover" };
const dismissPopoverEvent: WorkspaceEvent = { type: "dismissPopover" };
const networkSettingsEvent: WorkspaceEvent = { type: "chooseSettingsPage", page: "NetworkSettings" };

function clockParts(now: Date) {
  let hour = "";
  let minute = "";
  let dayPeriod: string | undefined;
  for (const part of railClock.formatToParts(now)) {
    if (part.type === "hour") hour = part.value;
    else if (part.type === "minute") minute = part.value;
    else if (part.type === "dayPeriod") dayPeriod = part.value;
  }
  return { time: `${hour}:${minute}`, period: dayPeriod };
}

type HomeCardIdentity = { readonly accountId: string; readonly grant: string } | undefined;
const selectHomeCardIdentity = (setup: Setup | undefined): HomeCardIdentity =>
  setup?.graceAccount.tag === "GraceSignedIn" && setup.googleLink.tag === "GoogleLinkConnected"
    ? { accountId: setup.graceAccount.accountId, grant: setup.googleLink.grant }
    : undefined;
const sameHomeCardIdentity = (a: HomeCardIdentity, b: HomeCardIdentity) =>
  a === b || (a !== undefined && b !== undefined && a.accountId === b.accountId && a.grant === b.grant);

function useHomeCards(): HomeCards | undefined {
  const identity = useSetupSelector(selectHomeCardIdentity, sameHomeCardIdentity);
  const snapshot = useManagedHomeCardsSnapshot();
  if (!identity || !snapshot) return undefined;
  return snapshot.accountId === identity.accountId && snapshot.grant === identity.grant ? snapshot : undefined;
}

const selectOwner = (setup: Setup | undefined) => surfaceOwner(setup, window.location.hash);

const selectTextScale = (workspace: Workspace | undefined) =>
  workspace ? textScalePercent(workspace.preferences.session) : 100;

function TextScaleBridge({ children }: { children: ReactNode }) {
  const percent = useWorkspaceSelector(selectTextScale);
  return <TextScale percent={percent}>{children}</TextScale>;
}

const selectRailSlice = (workspace: Workspace | undefined) => {
  if (!workspace) return undefined;
  const { device, assistant, preferences } = workspace;
  return {
    surface: device.surface,
    online: device.connectivity === "Online",
    muted: preferences.session.muted,
    railPopover: device.railPopover,
    privateSurface: privateSurfaceActive(workspace),
    graceOpen: assistant.presentation !== "Closed",
    canHome: enabled(workspace, visitHome, "Person"),
    canSettings: enabled(workspace, visitSettings, "Person"),
    canWifi: enabled(workspace, toggleWifiEvent, "Person"),
    canVolume: enabled(workspace, toggleVolumeEvent, "Person"),
    canOpenGrace: enabled(workspace, openGraceEvent, "Person"),
  };
};

const sameOptionalSlice = <T extends Record<string, unknown>>(a: T | undefined, b: T | undefined) =>
  a === b || (a !== undefined && b !== undefined && shallowEqual(a, b));

function VolumePopover({ anchor }: { anchor: number }) {
  const volume = useWorkspaceSelector((w) => w?.preferences.session);
  const canDismiss = useWorkspaceSelector((w) => w !== undefined && enabled(w, dismissPopoverEvent, "Person"));
  const canMuteToggle = useWorkspaceSelector((w) => w !== undefined && enabled(w, { type: "changePreferences", settings: muteChoice(w.preferences.session, !w.preferences.session.muted) }, "Person"));
  const { current, send } = useWorkspaceActions();
  if (!volume) return null;
  const muteEvent: WorkspaceEvent = { type: "changePreferences", settings: muteChoice(volume, !volume.muted) };
  return (
    <RailPopover className="left-3" top={Math.max(6, anchor - 58)} icon={volume.muted ? <VolumeX size={30} strokeWidth={2} /> : <Volume2 size={30} strokeWidth={2} />} title="Volume"
      value={volume.muted ? "Muted" : `${volume.volume}%`} onClose={() => { if (canDismiss) void send(dismissPopoverEvent); }}
      actions={<Button variant="capsule" size="pill" disabled={!canMuteToggle} onClick={() => void send(muteEvent)}>{volume.muted ? <Volume2 aria-hidden /> : <VolumeX aria-hidden />}{volume.muted ? "Unmute" : "Mute"}</Button>}>
      <Slider className="mt-5 gap-4" label="Volume" decreaseLabel="Quieter" increaseLabel="Louder" step={10} value={volume.muted ? 0 : volume.volume}
        onStep={(amount) => void send({ type: "adjustPreferenceLevel", levelStep: { tag: "VolumeBy", amount } })}
        onValueChange={(level) => {
          const event: WorkspaceEvent = { type: "changePreferences", settings: volumeChoice(volume, level) };
          if (enabled(current(), event, "Person")) void send(event);
        }} />
    </RailPopover>
  );
}

const selectWifiPopoverSlice = (workspace: Workspace | undefined) => workspace && {
  connectivity: workspace.device.connectivity,
  canNetworkSettings: enabled(workspace, networkSettingsEvent, "Person"),
};

function WifiPopover({ anchor }: { anchor: number }) {
  const slice = useWorkspaceSelector(selectWifiPopoverSlice, sameOptionalSlice);
  const { send } = useWorkspaceActions();
  if (!slice) return null;
  const online = slice.connectivity === "Online";
  return (
    <RailPopover className="left-3" top={Math.max(6, anchor - 58)} icon={online ? <Wifi size={30} strokeWidth={2} /> : <WifiSlash size={30} />} title="Wi-Fi"
      value={wifiWords[slice.connectivity]} onClose={() => void send(dismissPopoverEvent)}
      actions={<Button variant="capsule" size="pill" disabled={!slice.canNetworkSettings} onClick={() => void send(networkSettingsEvent)}>Wi-Fi settings</Button>} />
  );
}

// spec/app/shell.md, "Settings and rail popovers preserve the surface underneath"
function RailSection() {
  const slice = useWorkspaceSelector(selectRailSlice, sameOptionalSlice);
  const now = useMinute();
  const { send } = useWorkspaceActions();
  const [anchor, setAnchor] = useState(0);
  if (!slice) return null;
  const { time, period } = clockParts(now);
  const toggle = (popover: Popover, canToggle: boolean) => ({
    selected: slice.railPopover === popover,
    disabled: !canToggle,
    onClick: (event: { currentTarget: HTMLElement }) => {
      const { top, height } = event.currentTarget.getBoundingClientRect();
      setAnchor(top + height / 2);
      void send({ type: "togglePopover", popover });
    },
  });
  return (
    <>
      <Rail aria-label="Rail" time={time} period={period}
        date={railDate.format(now)}
        status={<RailButton icon={slice.online ? <Wifi {...tile} /> : <WifiSlash />} label="Wi-Fi" aria-label={slice.online ? "Wi-Fi" : "Wi-Fi, not connected"} {...toggle("WifiPopover", slice.canWifi)} />}
        footer={<RailButton icon={<Gear {...tile} />} label="Settings" selected={slice.surface === "DeviceSettings"} disabled={!slice.canSettings} onClick={() => void send(visitSettings)} />}
        ask={slice.privateSurface ? undefined : <AskGraceButton selected={slice.graceOpen} glow={slice.graceOpen ? "off" : "rest"} onClick={() => { if (slice.canOpenGrace) void send(openGraceEvent); }} />}>
        <RailButton icon={<House {...tile} />} label="Home" selected={slice.surface === "Home"} disabled={!slice.canHome} onClick={() => void send(visitHome)} />
        <RailButton icon={slice.muted ? <VolumeX {...tile} /> : <Volume2 {...tile} />} label="Volume" {...toggle("VolumePopover", slice.canVolume)} />
      </Rail>
      {slice.railPopover !== "NoPopover" && (
        <OverPage className={cn(besideRail, "inset-y-0 right-0 z-[5]")} onPointerDown={(event) => {
          if (event.target === event.currentTarget) void send(dismissPopoverEvent);
        }}>
          {slice.railPopover === "VolumePopover" ? <VolumePopover anchor={anchor} /> : <WifiPopover anchor={anchor} />}
        </OverPage>
      )}
    </>
  );
}

const selectHomeSlice = (workspace: Workspace | undefined) => workspace && {
  online: workspace.device.connectivity === "Online",
  homePage: workspace.device.homePage,
  canCalendar: enabled(workspace, visitCalendar, "Person"),
  canEmail: enabled(workspace, visitEmail, "Person"),
  canBrowser: enabled(workspace, visitBrowser, "Person"),
  canFiles: enabled(workspace, visitFiles, "Person"),
  canPasswords: enabled(workspace, visitPasswords, "Person"),
};

// spec/app/surface.md, "A Grace control is drawn over the page only after the host routes its rect to Grace"; spec/app/shell.md, "Home cards open their named surface without activating a microphone or controller"
function HomeSurface({ bottom, docked, covered }: { bottom: number; docked: boolean; covered: boolean }) {
  const runtime = useRuntime();
  const slice = useWorkspaceSelector(selectHomeSlice, sameOptionalSlice);
  const { current, send } = useWorkspaceActions();
  const owner = useSetupSelector(selectOwner);
  const cards = useHomeCards();
  const files = useFilesHome();
  const { accounts } = useAccounts();
  const accountIds = useAccountIds();
  const calKeys = useCalendarKeys();
  const calendarActions = useCalendarActions();
  const read = useMailContent();
  const now = useMinute();
  const onPageChange = useCallback((page: Workspace["device"]["homePage"]) => {
    const event: WorkspaceEvent = { type: "chooseHomePage", page };
    const allowed = enabled(current(), event, "Person");
    if (allowed) void send(event);
    return allowed;
  }, [current, send]);
  const openSurface = useCallback((destination: Surface) => () => void send({ type: "visit", destination }), [send]);
  const visitProps = useMemo(() => ({
    calendar: { disabled: !(slice?.canCalendar ?? false), onClick: openSurface("Calendar") },
    email: { disabled: !(slice?.canEmail ?? false), onClick: openSurface("Email") },
    browser: { disabled: !(slice?.canBrowser ?? false), onClick: openSurface("Browser") },
    files: { disabled: !(slice?.canFiles ?? false), onClick: openSurface("Files") },
    passwords: { disabled: !(slice?.canPasswords ?? false), onClick: openSurface("Passwords") },
  }), [slice?.canCalendar, slice?.canEmail, slice?.canBrowser, slice?.canFiles, slice?.canPasswords, openSurface]);

  if (!slice) return null;
  const ours = owner === "Ours";
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const nowMs = now.getTime();
  const weekday = appointmentDay.format(now).toUpperCase();
  const day = now.getDate();

  return (
    <OverPage className={cn(lifted, "left-1.5")} style={{ bottom, contain: "layout style" }}>
      <WithMailboxes ids={accountIds}>{(boxes) => (
        <WithCalendars keys={calKeys}>{(calendars) => (
          <HomeScreen className="inset-0"
            banner={<NoticeBanner reminders={accounts && ours ? reminderNotice(accounts, calendars, nowMs, calendarActions, slice.canCalendar) : undefined} />}
            layout={docked ? "compact" : "full"} {...under(covered)} greeting={greeting}
            calendar={{
              weekday,
              day,
              ...ours && accounts ? homeCalendar(accounts, calendars, nowMs, slice.canCalendar ? calendarActions : undefined) : {
                events: (cards?.events ?? []).slice(0, 3).map((event, index) => {
                  const when = startOf(event);
                  return {
                    id: event.externalId,
                    title: event.title || "Untitled appointment",
                    detail: event.location || undefined,
                    weekday: appointmentDay.format(when).toUpperCase(),
                    time: event.isAllDay ? "All day" : appointmentClock.format(when),
                    next: index === 0,
                    onClick: !cards || !slice.canCalendar ? undefined : () => void runtime.runPromise(Effect.flatMap(ManagedReads, (managed) =>
                      managed.send({ kind: "homeOccurrence", row: { accountId: cards.accountId, grant: cards.grant, id: event.externalId, version: event.etag ?? null } }))),
                  };
                }),
              },
              ...visitProps.calendar,
            }}
            email={{
              ...ours && accounts ? homeMail(accounts, boxes, read, slice.online) : {
                messages: (owner === "Hosted" ? cards?.mail ?? [] : []).slice(0, 2).map((message) => ({
                  id: message.externalId,
                  name: message.from || "Unknown sender",
                  subject: message.subject || "No subject",
                  unread: message.isUnread,
                })),
                ...slice.online ? {} : { status: "Waiting for the internet", waiting: "New email will arrive when you’re back online." },
              },
              ...visitProps.email,
            }}
            internet={visitProps.browser}
            files={{ photos: files?.photos ?? [], document: files?.document, ...visitProps.files }}
            passwords={visitProps.passwords}
            page={slice.homePage}
            onPageChange={onPageChange} />
        )}</WithCalendars>
      )}</WithMailboxes>
    </OverPage>
  );
}

function CalendarSurface({ covered }: { covered: boolean }) {
  const now = useMinute();
  return <Calendar now={now.getTime()} {...under(covered)} />;
}

function ManagedSurface({ surface, covered }: { surface: "Email" | "Calendar"; covered: boolean }) {
  const owner = useSetupSelector(selectOwner);
  const today = useToday();
  const canHome = useWorkspaceSelector((w) => w !== undefined && enabled(w, visitHome, "Person"));
  const { send } = useWorkspaceActions();
  return (
    <AppWindow {...under(covered)} title={surface} icon={surface === "Email" ? <Mail size={26} /> : <CalendarDays size={26} />} closeLabel={`Close ${surface}`} onClose={canHome ? () => void send(visitHome) : undefined}>
      {owner === "Hosted" ? <ManagedRead view={surface} today={today} />
        : <ListRow role="status" className="m-6" leading={<Spinner size="lg" aria-hidden />} title={`Getting your ${surface === "Email" ? "email" : "calendar"}…`} />}
    </AppWindow>
  );
}

function PasswordsSurface({ covered }: { covered: boolean }) {
  const canHome = useWorkspaceSelector((w) => w !== undefined && enabled(w, visitHome, "Person"));
  const { send } = useWorkspaceActions();
  return (
    <AppWindow {...under(covered)} title="Passwords" icon={<KeyRound size={26} aria-hidden />} closeLabel="Close Passwords" onClose={canHome ? () => void send(visitHome) : undefined}>
      <PasswordsApp />
    </AppWindow>
  );
}

function FilesSurface({ covered }: { covered: boolean }) {
  const { current, send } = useWorkspaceActions();
  const onClose = useCallback(() => {
    if (enabled(current(), visitHome, "Person")) void send(visitHome);
  }, [current, send]);
  return <Files {...under(covered)} onClose={onClose} />;
}

function ActiveSurface({ surface, bottom, docked, covered, sleeping }: { surface: Surface; bottom: number; docked: boolean; covered: boolean; sleeping: boolean }) {
  const owner = useSetupSelector(selectOwner);
  if (sleeping && surface !== "Browser") return null;
  const ours = owner === "Ours";
  const boxStyle = { bottom, contain: "layout style" } as const;
  if (surface === "Home") return <HomeSurface bottom={bottom} docked={docked} covered={covered} />;
  return (
    <>
      {surface === "Browser" && <div className={cn(lifted, besideRail, "pointer-events-none z-[1]")} style={boxStyle}><Browser {...under(covered)} /></div>}
      {surface === "Calendar" && ours && <OverPage className={cn(lifted, besideRail, "z-[2]")} style={boxStyle}><CalendarSurface covered={covered} /></OverPage>}
      {surface === "Email" && ours && <OverPage className={cn(lifted, besideRail, "z-[2]")} style={boxStyle}><Email {...under(covered)} /></OverPage>}
      {surface === "DeviceSettings" && <OverPage className={cn(lifted, besideRail, "z-[2]")} style={boxStyle}><Settings {...under(covered)} /></OverPage>}
      {surface === "Passwords" && <OverPage className={cn(lifted, besideRail, "z-[2]")} style={boxStyle}><PasswordsSurface covered={covered} /></OverPage>}
      {surface === "Files" && <OverPage className={cn(lifted, besideRail, "z-[2]")} style={boxStyle}><FilesSurface covered={covered} /></OverPage>}
      {!ours && (surface === "Email" || surface === "Calendar") && <OverPage className={cn(lifted, besideRail, "z-[2]")} style={boxStyle}><ManagedSurface surface={surface} covered={covered} /></OverPage>}
    </>
  );
}

function SleepOverlay() {
  const now = useMinute();
  const owner = useSetupSelector(selectOwner);
  const cards = useHomeCards();
  const { accounts } = useAccounts();
  const calKeys = useCalendarKeys();
  const { current, send } = useWorkspaceActions();
  const ours = owner === "Ours";
  const { time } = clockParts(now);
  const wake = useCallback(() => {
    if (canChangeLifecycle(current(), "WakeDevice", "Host")) void send({ type: "changeLifecycle", lifecycle: "WakeDevice" }, "Host");
  }, [current, send]);
  const renderSleep = (next: string | undefined) => (
    <SleepScreen role="button" tabIndex={0} aria-label="Wake Grace"
      time={time}
      date={sleepDate.format(now)}
      next={next}
      hint="Touch the screen to wake it" onClick={wake} onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); wake(); }
      }} />
  );
  if (!ours || !accounts) return renderSleep(managedNext(cards, now));
  return <WithCalendars keys={calKeys}>{(calendars) => renderSleep(nextAppointment(accounts, calendars, now.getTime()))}</WithCalendars>;
}

const selectScreenSlice = (workspace: Workspace | undefined) => {
  if (!workspace) return undefined;
  const privateSurface = privateSurfaceActive(workspace);
  return {
    surface: workspace.device.surface,
    sleeping: workspace.device.readiness === "Sleeping",
    privateSurface,
    benchmarkObservable: !privateSurface && !workspace.browser.tabs.some((tab) => tab.manualSignIn),
    covered: !privateSurface && workspace.assistant.presentation === "Expanded",
    docked: !privateSurface && workspace.assistant.presentation === "Compact",
    graceOpen: workspace.assistant.presentation !== "Closed",
  };
};

// spec/app/deviceKeys.md, "Back closes the nearest open thing first and leaves only from a resting Home"; spec/app/deviceKeys.md, "After launcher Home only Grace's own window is left for Back"; spec/app/assistant.md, "Story: Keep control of one task across windows and pauses"
function Screen() {
  const runtime = useRuntime();
  const slice = useWorkspaceSelector(selectScreenSlice, sameOptionalSlice);
  const keyboard = useKeyboardHeight();
  const [graceHeight, setGraceHeight] = useState(260);
  const bindKeys = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    const actions = workspaceActionsFor(runtime);
    const website = websiteRequestActionsFor(runtime);
    const back = (event: Event) => {
      const now = actions.current();
      const requests = website.current();
      const action = backAction(now.device, now.assistant, now.browser, requests, actions.privateHistory(now.browser.selected));
      if (action === "Unconsumed") return;
      event.preventDefault();
      if (action === "PrivatePageBack") return void actions.stepPrivate(now.browser.selected, "HistoryBack");
      if (action === "CancelClearData" || action === "DismissWebsiteRequest") return void website.send(websiteBackEvents[action](requests));
      if (action === "DismissAddress" && document.activeElement instanceof HTMLElement) document.activeElement.blur();
      void actions.send(backEvents[action]);
    };
    const home = () => {
      if (enabled(actions.current(), visitHome, "Person")) void actions.send(visitHome);
    };
    window.addEventListener("hardware-back", back);
    window.addEventListener("launcher-home", home);
    return () => {
      window.removeEventListener("hardware-back", back);
      window.removeEventListener("launcher-home", home);
    };
  }, [runtime]);

  if (!slice) return null;
  const bottom = keyboard + (slice.docked ? 6 + graceHeight + 6 : 6);

  return (
    <TextScaleBridge>
      <div ref={bindKeys} data-benchmark-observable={slice.benchmarkObservable} className="fixed inset-0 overflow-hidden font-sans text-foreground select-none">
        <div className="contents" {...under(slice.sleeping)}>
          <PageBackdrop className="absolute inset-0 bg-gradient-frame-soft" />
          <RailSection />
          <ActiveSurface surface={slice.surface} bottom={bottom} docked={slice.docked} covered={slice.covered} sleeping={slice.sleeping} />
          {!slice.privateSurface && !slice.sleeping && <Notices above={bottom - 6} />}
          {!slice.privateSurface && !slice.sleeping && slice.graceOpen && <Grace onHeightChange={setGraceHeight} />}
        </div>
        {slice.sleeping && <SleepOverlay />}
      </div>
    </TextScaleBridge>
  );
}

export function createAppRuntime(native: boolean): Runtime {
  return ManagedRuntime.make(application(devicePlugin, wifiPlugin, { native, agent: agentPlugin, vault: passwordClient }));
}

export function App({ runtime }: { runtime: Runtime }) {
  const screen = useMemo(() => runtime.context().then(() => <Screen />), [runtime]);
  return (
    <RuntimeContext value={runtime}>
      <PageMeasurer runtime={runtime}><Suspense>{screen}</Suspense></PageMeasurer>
    </RuntimeContext>
  );
}

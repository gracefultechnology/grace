// spec/app/index.md, "Story: Manage my saved passwords privately"
// spec/app/wake.md, "Settings and the sleep screen say when wake detection is unavailable"
// spec/app/shell.md, "Story: Reach everyday tasks from Home"; spec/app/mailboxes.md, "Story: See all my email in one place"; spec/app/calendars.md, "Home and the sleep screen show the next saved appointments"; spec/app/workspace.md, "Home, native controls and Close have explicit interruption semantics"; spec/app/deviceKeys.md, "Story: Step back inside Grace before leaving"
import { AppWindow, AskGraceButton, besideRail, Button, CaptionStrip, type CaptionStripProps, HomeScreen, type HomeScreenProps, ListRow, Rail, RailButton, RailPopover, ScreenDim, SleepScreen, Slider, Spinner, TextScale, WifiSlash, cn } from "@repo/ui";
import { Effect, ManagedRuntime } from "effect";
import { CalendarDays, Check, House, KeyRound, Mail, Settings as Gear, Volume2, VolumeX, Wifi } from "lucide-react";
import { type ReactNode, Suspense, useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { type Assistance, keyboardCaptionVisible } from "../gen/app__assistant.ts";
import { activeTab, tabUrl } from "../gen/app__browser.ts";
import type { Turn } from "../gen/app__conversation.ts";
import { type BackAction, backAction, declineChoice } from "../gen/app__deviceKeys.ts";
import { effectiveBrightness, muteChoice, textScalePercent, volumeChoice } from "../gen/app__preferences.ts";
import type { Setup } from "../gen/app__setup.ts";
import type { Connectivity, RailPopover as Popover, Surface } from "../gen/app__shell.ts";
import { sleepHint } from "../gen/app__wake.ts";
import { type Event as WebsiteEvent, type WebsiteRequests, presented } from "../gen/app__websiteRequests.ts";
import { canChangeLifecycle, enabled, privateSurfaceActive, type Event as WorkspaceEvent, type Workspace } from "../gen/app__workspace.ts";
import { agentPlugin } from "./agentPlugin.ts";
import { application } from "./app.vibe";
import { Browser } from "./Browser.tsx";
import { appointmentWeekday, Calendar, hostedAppointmentDate, hostedAppointmentDisplay } from "./Calendar.tsx";
import { dayOf, relative, timeLabel } from "./calendar.vibe";
import { Email } from "./Email.tsx";
import { Files } from "./Files.tsx";
import { Grace } from "./Grace.tsx";
import { ManagedRead } from "./ManagedRead.tsx";
import { type HomeCards, ManagedReads, surfaceOwner } from "./managedReads.vibe";
import { NoticeBanner, Notices } from "./Notices.tsx";
import { OverPage, PageBackdrop, PageMeasurer } from "./PageLayer.tsx";
import { PasswordsApp } from "./PasswordsApp.tsx";
import { Settings } from "./Settings.tsx";
import { androidHost, devicePlugin, passwordClient, wifiPlugin } from "./surfacePlugin.ts";
import { homeFilesHint, homeFilesStatus, internetStatusShown, passwordsCard, type SavedPasswords } from "../gen/app__shell.ts";
import {
  RuntimeContext,
  type Runtime,
  homeCalendar,
  homeMail,
  isRuntimePrimed,
  nextAppointment,
  primeRuntime,
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
  useUpdated,
  useSetupSelector,
  useToday,
  useWakeStatus,
  useWorkspaceActions,
  useWorkspaceSelector,
  websiteRequestActionsFor,
  WithCalendars,
  WithMailboxes,
  workspaceActionsFor,
} from "./useApp.ts";
import { site } from "./WebsiteRequests.tsx";

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
const railClock = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const railDate = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });
const sleepDate = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });

const managedNext = (cards: HomeCards | undefined, now: Date) => {
  const next = cards?.events[0];
  if (!next) return undefined;
  const at = hostedAppointmentDate(next).getTime();
  return `${relative(dayOf(at), dayOf(now.getTime()))}: ${next.title || "Untitled appointment"}, ${next.isAllDay ? "All day" : timeLabel(at)}`;
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
const showChatEvent: WorkspaceEvent = { type: "interact", input: { tag: "ShowChat" } };

type BatteryManager = EventTarget & { readonly level: number };
type BatteryNavigator = Navigator & { readonly getBattery?: () => Promise<BatteryManager> };

let batteryLevel: number | undefined;
const batteryListeners = new Set<() => void>();
let batteryObserved = false;

function subscribeBattery(listener: () => void) {
  batteryListeners.add(listener);
  if (!batteryObserved) {
    batteryObserved = true;
    const getBattery = (navigator as BatteryNavigator).getBattery;
    if (typeof getBattery === "function") {
      void getBattery.call(navigator).then((manager) => {
        const update = () => {
          const next = Math.round(manager.level * 100);
          if (next === batteryLevel) return;
          batteryLevel = next;
          for (const notify of batteryListeners) notify();
        };
        update();
        manager.addEventListener("levelchange", update);
      }, () => undefined);
    }
  }
  return () => { batteryListeners.delete(listener); };
}

function useBattery() {
  return useSyncExternalStore(subscribeBattery, () => batteryLevel);
}

function captionActivity(turn: Turn, activity: Assistance): CaptionStripProps["activity"] {
  if (turn === "Listening") return "listening";
  if (turn === "Speaking") return "speaking";
  if (turn === "Thinking") return "thinking";
  if (activity === "DoingWork" || activity === "WebsiteWait" || activity === "Rechecking") return "working";
  return undefined;
}

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

const selectPreferencesSession = (workspace: Workspace | undefined) => workspace?.preferences.session;

function ScreenDimBridge() {
  const volume = useWorkspaceSelector(selectPreferencesSession);
  const now = useMinute();
  if (androidHost || !volume) return null;
  return <ScreenDim brightness={effectiveBrightness(volume, now.getHours())} />;
}

const selectRailSlice = (workspace: Workspace | undefined) => {
  if (!workspace) return undefined;
  const { device, assistant, preferences } = workspace;
  const privateSurface = privateSurfaceActive(workspace);
  const websiteKeyboard = !privateSurface && assistant.presentation !== "Closed" && assistant.keyboard === "WebsiteKeyboard";
  const covered = !privateSurface && !websiteKeyboard && assistant.presentation === "Expanded";
  return {
    surface: device.surface,
    online: device.connectivity === "Online",
    muted: preferences.session.muted,
    railPopover: device.railPopover,
    privateSurface,
    websiteKeyboard,
    covered,
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

function popoverLayout(anchor: number) {
  const top = anchor > 0 ? Math.max(20, Math.min(anchor - 58, window.innerHeight - 300)) : 20;
  const arrowTop = anchor > 0 ? Math.max(38, anchor - top) : 58;
  return { top, arrowTop };
}

function VolumePopover({ anchor }: { anchor: number }) {
  const volume = useWorkspaceSelector(selectPreferencesSession);
  const canDismiss = useWorkspaceSelector((w) => w !== undefined && enabled(w, dismissPopoverEvent, "Person"));
  const canMuteToggle = useWorkspaceSelector((w) => w !== undefined && enabled(w, { type: "changePreferences", settings: muteChoice(w.preferences.session, !w.preferences.session.muted) }, "Person"));
  const { current, send } = useWorkspaceActions();
  if (!volume) return null;
  const { top, arrowTop } = popoverLayout(anchor);
  const muteEvent: WorkspaceEvent = { type: "changePreferences", settings: muteChoice(volume, !volume.muted) };
  return (
    <RailPopover className="left-3" top={top} arrowTop={arrowTop} icon={volume.muted ? <VolumeX size={30} strokeWidth={2} /> : <Volume2 size={30} strokeWidth={2} />} title="Volume"
      value={volume.muted ? "Muted" : `${volume.volume}%`} onClose={() => { if (canDismiss) void send(dismissPopoverEvent); }}
      note={volume.muted ? "Grace will show her words on screen while you’re muted." : "Grace’s voice, videos and sounds all use this volume."}
      actions={<Button variant={volume.muted ? "prominent" : "capsule"} size="pill" disabled={!canMuteToggle} onClick={() => void send(muteEvent)}>{volume.muted ? <Volume2 aria-hidden /> : <VolumeX aria-hidden />}{volume.muted ? "Unmute" : "Mute"}</Button>}>
      <Slider className="mt-5 gap-4" label="Volume" decreaseLabel="Quieter" increaseLabel="Louder" step={10} value={volume.volume}
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

function WifiPopover({ anchor, wifiSsid }: { anchor: number; wifiSsid: string | null }) {
  const slice = useWorkspaceSelector(selectWifiPopoverSlice, sameOptionalSlice);
  const { send } = useWorkspaceActions();
  if (!slice) return null;
  const online = slice.connectivity === "Online";
  const { top, arrowTop } = popoverLayout(anchor);
  return (
    <RailPopover className="left-3" top={top} arrowTop={arrowTop} icon={online ? <Wifi size={30} strokeWidth={2} /> : <WifiSlash size={30} />} title="Wi-Fi"
      value={wifiWords[slice.connectivity]} onClose={() => void send(dismissPopoverEvent)}
      note={online ? undefined : "Email and the internet need it. Grace can help you reconnect."}
      actions={online ? (
        <Button variant="capsule" size="pill" disabled={!slice.canNetworkSettings} onClick={() => void send(networkSettingsEvent)}>Choose another network</Button>
      ) : (
        <Button variant="prominent" size="pill" disabled={!slice.canNetworkSettings} onClick={() => void send(networkSettingsEvent)}><Wifi aria-hidden size={22} strokeWidth={2.2} />Fix Wi-Fi</Button>
      )}>
      {online && <ListRow className="mt-[18px] bg-glass/70" leading={<Check size={30} strokeWidth={2.6} aria-hidden className="shrink-0 text-ok" />} title={wifiSsid ?? "Internet connection"} subtitle="Strong signal" />}
    </RailPopover>
  );
}

// spec/app/shell.md, "Settings and rail popovers preserve the surface underneath"
function RailSection() {
  const slice = useWorkspaceSelector(selectRailSlice, sameOptionalSlice);
  const now = useMinute();
  const battery = useBattery();
  const { send } = useWorkspaceActions();
  const [anchor, setAnchor] = useState(0);
  const [wifiSsid, setWifiSsid] = useState<string | null>(null);
  if (!slice) return null;
  const { time, period } = clockParts(now);
  const popoverOpen = slice.railPopover !== "NoPopover";
  const toggle = (popover: Popover, canToggle: boolean) => ({
    selected: slice.railPopover === popover,
    disabled: !canToggle,
    onClick: (event: { currentTarget: HTMLElement }) => {
      const { top, height } = event.currentTarget.getBoundingClientRect();
      setAnchor(top + height / 2);
      if (popover === "WifiPopover" && wifiPlugin) {
        void wifiPlugin.getConnectivity().then((status) => setWifiSsid(status.ssid ?? null), () => setWifiSsid(null));
      }
      void send({ type: "togglePopover", popover });
    },
  });
  return (
    <>
      <Rail aria-label="Rail" battery={battery} time={time} period={period}
        date={railDate.format(now)}
        status={<RailButton icon={slice.online ? <Wifi {...tile} /> : <WifiSlash />} label="Wi-Fi" aria-label={slice.online ? "Wi-Fi" : "Wi-Fi, not connected"} {...toggle("WifiPopover", slice.canWifi)} />}
        footer={<RailButton icon={<Gear {...tile} />} label="Settings" selected={!popoverOpen && !slice.covered && slice.surface === "DeviceSettings"} disabled={!slice.canSettings} onClick={() => void send(visitSettings)} />}
        ask={slice.privateSurface ? undefined : <AskGraceButton selected={!slice.websiteKeyboard && slice.graceOpen} glow={slice.graceOpen ? "off" : "rest"} onClick={() => { if (slice.canOpenGrace) void send(openGraceEvent); }} />}>
        <RailButton icon={<House {...tile} />} label="Home" selected={!popoverOpen && !slice.covered && slice.surface === "Home"} disabled={!slice.canHome} onClick={() => void send(visitHome)} />
        <RailButton icon={slice.muted ? <VolumeX {...tile} /> : <Volume2 {...tile} />} label="Volume" {...toggle("VolumePopover", slice.canVolume)} />
      </Rail>
      {popoverOpen && (
        <OverPage className={cn(besideRail, "inset-y-0 right-0 z-[5]")} onPointerDown={(event) => {
          if (event.target === event.currentTarget) void send(dismissPopoverEvent);
        }}>
          {slice.railPopover === "VolumePopover" ? <VolumePopover anchor={anchor} /> : <WifiPopover anchor={anchor} wifiSsid={wifiSsid} />}
        </OverPage>
      )}
    </>
  );
}

const selectCaptionSlice = (workspace: Workspace | undefined) => {
  if (!workspace) return undefined;
  const { assistant } = workspace;
  const last = assistant.conversation.messages.at(-1);
  const guideEvent: WorkspaceEvent = { type: "interact", input: { tag: "ShowGuidance", revision: assistant.guidance.revision } };
  return {
    turn: assistant.conversation.turn,
    activity: assistant.activity,
    generation: assistant.conversation.generation,
    guidanceRevision: assistant.guidance.revision,
    lastAuthor: last?.author,
    lastText: last?.text ?? "",
    answers: assistant.conversation.answers,
    canShowChat: enabled(workspace, showChatEvent, "Person"),
    canShowGuide: enabled(workspace, guideEvent, "Person"),
  };
};

function CaptionSection({ keyboard }: { keyboard: number }) {
  const slice = useWorkspaceSelector(selectCaptionSlice, sameOptionalSlice);
  const { current, send, say } = useWorkspaceActions();
  if (!slice) return null;
  const nowState = current();
  const captionAnswers = slice.answers.filter((text) =>
    enabled(nowState, { type: "interact", input: { tag: "ChooseAnswer", token: slice.generation, text } }, "Person"));
  const showGuideEvent: WorkspaceEvent = { type: "interact", input: { tag: "ShowGuidance", revision: slice.guidanceRevision } };
  return (
    <OverPage className={cn(besideRail, "z-[4]")} style={{ bottom: 6 + keyboard }}>
      <CaptionStrip
        who={slice.turn === "Listening" || slice.lastAuthor === "HumanMessage" ? "you" : "grace"}
        text={slice.lastText}
        activity={captionActivity(slice.turn, slice.activity)}
        answers={captionAnswers.length > 0 ? captionAnswers : undefined}
        onAnswer={(text) => void say({ tag: "ChooseAnswer", token: slice.generation, text })}
        onShowChat={() => { if (slice.canShowChat) void send(showChatEvent); }}
        showGuide={slice.canShowGuide}
        onShowGuide={() => { if (slice.canShowGuide) void send(showGuideEvent); }}
      />
    </OverPage>
  );
}

const selectHomeSlice = (workspace: Workspace | undefined) => {
  if (!workspace) return undefined;
  const activePage = activeTab(workspace.browser);
  const publicUrl = activePage && !activePage.manualSignIn ? tabUrl(activePage) : "";
  return {
    online: workspace.device.connectivity === "Online",
    connectivity: workspace.device.connectivity,
    publicUrl,
    homePage: workspace.device.homePage,
    canCalendar: enabled(workspace, visitCalendar, "Person"),
    canEmail: enabled(workspace, visitEmail, "Person"),
    canBrowser: enabled(workspace, visitBrowser, "Person"),
    canFiles: enabled(workspace, visitFiles, "Person"),
    canPasswords: enabled(workspace, visitPasswords, "Person"),
  };
};

const savedPasswords: SavedPasswords = { tag: "CountUnknown" };

// spec/app/shell.md, "Passwords offers Grace’s help while none are saved, then shows only how many"
function passwordsProps(saved: SavedPasswords, open: { disabled: boolean; onClick: () => void }): NonNullable<HomeScreenProps["passwords"]> {
  const view = passwordsCard(saved);
  switch (view.tag) {
    case "PlainPasswords": return open;
    case "OfferToSave": return { ...open, status: "None saved yet", offer: { message: "Grace offers to save them as you sign in", action: "Add one", onAction: open.disabled ? undefined : open.onClick } };
    case "ShowsSaved": return { ...open, status: `${view.count} saved, only on this tablet`, onAdd: open.disabled ? undefined : open.onClick };
    default: {
      const _exhaustive: never = view;
      return _exhaustive;
    }
  }
}

// spec/app/surface.md, "A Grace control is drawn over the page only after the host routes its rect to Grace"; spec/app/shell.md, "Home cards open their named surface without activating a microphone or controller"; spec/app/shell.md, "Files says No photos yet, and how photos arrive while it holds nothing"; spec/app/shell.md, "Offline, Internet has no status and still opens the browser"; spec/app/calendars.md, "Home’s calendar card says Last updated only while it can’t update, and otherwise what is planned"; spec/app/mailboxes.md, "The Home Email card says No email added yet, Last updated only while it can’t update, or how many are new"
function HomeSurface({ bottom, docked, keyboard, covered }: { bottom: number; docked: boolean; keyboard: number; covered: boolean }) {
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
  const updated = useUpdated();
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
  const weekday = appointmentWeekday(now);
  const day = now.getDate();
  const internetStatus = !internetStatusShown(slice.connectivity) ? undefined : slice.publicUrl !== "" ? `${site(slice.publicUrl)} was open` : "Open a website";
  const photos = files?.photos ?? [];

  return (
    <OverPage className={cn(lifted, "left-1.5")} style={{ bottom, contain: "layout style" }}>
      <WithMailboxes ids={accountIds}>{(boxes) => (
        <WithCalendars keys={calKeys}>{(calendars) => (
          <HomeScreen className="inset-0"
            banner={<NoticeBanner reminders={accounts && ours ? reminderNotice(accounts, calendars, nowMs, calendarActions, slice.canCalendar) : undefined} />}
            layout={docked ? (keyboard > 0 ? "greeting" : "compact") : "full"} {...under(covered)} greeting={greeting} line="Here’s your day"
            calendar={{
              weekday,
              day,
              ...ours && accounts ? homeCalendar(accounts, calendars, boxes, slice.online, nowMs, updated, slice.canCalendar ? calendarActions : undefined) : {
                events: (cards?.events ?? []).slice(0, 3).map((event, index) => {
                  const { date, time } = hostedAppointmentDisplay(event);
                  return {
                    id: event.externalId,
                    title: event.title || "Untitled appointment",
                    detail: event.location || undefined,
                    weekday: appointmentWeekday(date),
                    time,
                    next: index === 0,
                    onClick: !cards || !slice.canCalendar ? undefined : () => void runtime.runPromise(Effect.flatMap(ManagedReads, (managed) =>
                      managed.send({ kind: "homeOccurrence", row: { accountId: cards.accountId, grant: cards.grant, id: event.externalId, version: event.etag ?? null } }))),
                  };
                }),
              },
              ...visitProps.calendar,
            }}
            email={{
              ...ours && accounts ? homeMail(accounts, boxes, read, slice.online, nowMs, updated) : {
                messages: (owner === "Hosted" ? cards?.mail ?? [] : []).slice(0, 2).map((message) => ({
                  id: message.externalId,
                  name: message.from || "Unknown sender",
                  subject: message.subject || "No subject",
                  unread: message.isUnread,
                })),
              },
              ...visitProps.email,
            }}
            internet={{ ...visitProps.browser, "aria-label": "Internet", status: internetStatus, openLabel: slice.online && slice.publicUrl !== "" ? "Continue" : "Open" }}
            files={{
              photos,
              document: files?.document,
              status: homeFilesStatus(photos.length) === "NoPhotosYet" ? "No photos yet" : undefined,
              hint: homeFilesHint(photos.length, files?.document ? 1 : 0) ? "Photos you save from email will appear here." : undefined,
              ...visitProps.files,
            }}
            passwords={passwordsProps(savedPasswords, visitProps.passwords)}
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

function SettingsSurface({ covered }: { covered: boolean }) {
  const owner = useSetupSelector(selectOwner);
  const cards = useHomeCards();
  return <Settings {...under(covered)} hostedAppointment={owner === "Hosted" ? cards?.events[0] : undefined} />;
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

function ActiveSurface({ surface, bottom, docked, keyboard, covered, sleeping }: { surface: Surface; bottom: number; docked: boolean; keyboard: number; covered: boolean; sleeping: boolean }) {
  const owner = useSetupSelector(selectOwner);
  if (sleeping && surface !== "Browser") return null;
  const ours = owner === "Ours";
  const boxStyle = { bottom, contain: "layout style" } as const;
  if (surface === "Home") return <HomeSurface bottom={bottom} docked={docked} keyboard={keyboard} covered={covered} />;
  return (
    <>
      {surface === "Browser" && <div className={cn(lifted, besideRail, "pointer-events-none z-[1]")} style={boxStyle}><Browser {...under(covered)} /></div>}
      {surface === "Calendar" && ours && <OverPage className={cn(lifted, besideRail, "z-[2]")} style={boxStyle}><CalendarSurface covered={covered} /></OverPage>}
      {surface === "Email" && ours && <OverPage className={cn(lifted, besideRail, "z-[2]")} style={boxStyle}><Email {...under(covered)} /></OverPage>}
      {surface === "DeviceSettings" && <OverPage className={cn(lifted, besideRail, "z-[2]")} style={boxStyle}><SettingsSurface covered={covered} /></OverPage>}
      {surface === "Passwords" && <OverPage className={cn(lifted, besideRail, "z-[2]")} style={boxStyle}><PasswordsSurface covered={covered} /></OverPage>}
      {surface === "Files" && <OverPage className={cn(lifted, besideRail, "z-[2]")} style={boxStyle}><FilesSurface covered={covered} /></OverPage>}
      {!ours && (surface === "Email" || surface === "Calendar") && <OverPage className={cn(lifted, besideRail, "z-[2]")} style={boxStyle}><ManagedSurface surface={surface} covered={covered} /></OverPage>}
    </>
  );
}

const selectWakeEnabled = (workspace: Workspace | undefined) => workspace?.preferences.session.wakeEnabled ?? false;

function SleepOverlay() {
  const now = useMinute();
  const owner = useSetupSelector(selectOwner);
  const cards = useHomeCards();
  const { accounts } = useAccounts();
  const calKeys = useCalendarKeys();
  const wakeEnabled = useWorkspaceSelector(selectWakeEnabled);
  const wakeStatus = useWakeStatus();
  const { current, send } = useWorkspaceActions();
  const ours = owner === "Ours";
  const { time } = clockParts(now);
  const wakeHint = sleepHint(wakeEnabled, wakeStatus.armed);
  const wake = useCallback(() => {
    if (canChangeLifecycle(current(), "WakeDevice", "Host")) void send({ type: "changeLifecycle", lifecycle: "WakeDevice" }, "Host");
  }, [current, send]);
  const renderSleep = (next: string | undefined) => (
    <SleepScreen role="button" tabIndex={0} aria-label="Wake Grace" aria-description={wakeHint}
      time={time}
      date={sleepDate.format(now)}
      next={next}
      hint={wakeHint} onClick={wake} onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); wake(); }
      }} />
  );
  if (!ours || !accounts) return renderSleep(managedNext(cards, now));
  return <WithCalendars keys={calKeys}>{(calendars) => renderSleep(nextAppointment(accounts, calendars, now.getTime()))}</WithCalendars>;
}

const selectScreenSlice = (workspace: Workspace | undefined) => {
  if (!workspace) return undefined;
  const privateSurface = privateSurfaceActive(workspace);
  const { assistant } = workspace;
  const websiteKeyboard = !privateSurface && assistant.presentation !== "Closed" && assistant.keyboard === "WebsiteKeyboard";
  const showCaption = websiteKeyboard && (keyboardCaptionVisible(assistant) || assistant.conversation.answers.length > 0);
  return {
    surface: workspace.device.surface,
    sleeping: workspace.device.readiness === "Sleeping",
    privateSurface,
    websiteKeyboard,
    showCaption,
    benchmarkObservable: !privateSurface && !workspace.browser.tabs.some((tab) => tab.manualSignIn),
    covered: !privateSurface && !websiteKeyboard && assistant.presentation === "Expanded",
    docked: !privateSurface && !websiteKeyboard && assistant.presentation === "Compact",
    graceOpen: assistant.presentation !== "Closed",
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
  const bottom = keyboard + (slice.docked ? 6 + graceHeight + 6 : slice.showCaption ? 6 + 80 + 6 : 6);
  const toastAbove = slice.covered ? keyboard + 92 : bottom - 6;

  return (
    <TextScaleBridge>
      <div ref={bindKeys} data-benchmark-observable={slice.benchmarkObservable} className="fixed inset-0 overflow-clip font-sans text-foreground select-none">
        <div className="contents" {...under(slice.sleeping)}>
          <PageBackdrop className="absolute inset-0 bg-gradient-frame-soft" />
          <RailSection />
          <ActiveSurface surface={slice.surface} bottom={bottom} docked={slice.docked} keyboard={keyboard} covered={slice.covered} sleeping={slice.sleeping} />
          {!slice.privateSurface && !slice.sleeping && <Notices above={toastAbove} />}
          {slice.showCaption && <CaptionSection keyboard={keyboard} />}
          {!slice.privateSurface && !slice.websiteKeyboard && !slice.sleeping && slice.graceOpen && <Grace onHeightChange={setGraceHeight} />}
        </div>
        {slice.sleeping && <SleepOverlay />}
        <ScreenDimBridge />
      </div>
    </TextScaleBridge>
  );
}

export function createAppRuntime(native: boolean): Runtime {
  return ManagedRuntime.make(application(devicePlugin, wifiPlugin, { native, agent: agentPlugin, vault: passwordClient }));
}

export function App({ runtime }: { runtime: Runtime }) {
  const ready = isRuntimePrimed(runtime);
  const screen = useMemo(() => (ready ? <Screen /> : primeRuntime(runtime).then(() => <Screen />)), [runtime, ready]);
  return (
    <RuntimeContext value={runtime}>
      <PageMeasurer runtime={runtime}>{ready ? screen : <Suspense>{screen}</Suspense>}</PageMeasurer>
    </RuntimeContext>
  );
}
